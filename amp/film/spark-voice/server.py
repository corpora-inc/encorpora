"""The film kit's local voice: Chatterbox on the Spark, one request at a time.

  POST /tts   {"model", "voice", "text", "words", "seed", "stage"?}
              -> audio/wav (44.1 kHz mono 16-bit), or with "align": true
                 JSON {"sample_rate", "pcm" (base64 16-bit), "words": [{word, start, end}], ...}
  POST /hear  {"pcm" (base64 16-bit), "sample_rate"} -> {"text", "words": [{text, start, end, type}]}
              what Whisper large-v3-turbo hears, in the shape of ElevenLabs Scribe's answer,
              so the kit checks a house take without spending ElevenLabs credits
  GET  /health

`words` are the text's words as spoken (lower case letters), in order; the
answer times each of them by forced alignment (align.py). A take is a pure
function of model, voice, text, seed and stage, so a retake is a new seed.
See README.md for running it.
"""
from __future__ import annotations

import argparse
import base64
import ctypes
import fcntl
import gc
import io
import json
import os
import random
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from master import master_wav, room_tone, trim_by_words, trim_raw  # noqa: E402

# Chatterbox settings that voiced the Corpán books (ttsctl narration.yaml),
# with ttsctl's retry stages (ttsctl/config.py RETRY_SCHEDULES) for retakes.
BASE = {"cfg_weight": 0.85, "exaggeration": 0.3, "temperature": 0.3, "top_p": 0.85, "min_p": 0.1, "repetition_penalty": 2.0}
STAGES = [{}, {"cfg_weight": 0.8, "temperature": 0.5}, {"cfg_weight": 0.5, "temperature": 0.3, "exaggeration": 0.2},
          {"cfg_weight": 0.6, "temperature": 0.7, "exaggeration": 0.6}, {"cfg_weight": 1.0, "temperature": 0.2}]
# Chatterbox Turbo (350M, English) takes no guidance or exaggeration; its own defaults apply.
TURBO = {"temperature": 0.8, "top_p": 0.95, "min_p": 0.0, "repetition_penalty": 1.2}
MODELS = ("chatterbox-v3", "chatterbox-turbo")


def name_process(name: str) -> None:
    try:
        ctypes.CDLL("libc.so.6").prctl(15, name.encode()[:15], 0, 0, 0)
    except OSError:
        pass


def available_gb() -> float:
    for line in open("/proc/meminfo"):
        if line.startswith("MemAvailable:"):
            return int(line.split()[1]) / 1e6
    return 0.0


class Busy(Exception):
    pass


class Voice:
    def __init__(self, args):
        self.args = args
        self.voices = json.loads((HERE / "voices.json").read_text())
        self.tts = None
        self.model = None
        self.conds: dict[str, object] = {}
        self.aligner = None
        self.whisper = None
        self.used = time.time()
        self.lock = threading.Lock()

    def guard(self) -> None:
        """Never start work while amp-cinema holds the GPU or memory is short."""
        for path in self.args.locks:
            if not os.path.exists(path):
                continue
            with open(path, "a") as f:
                try:
                    fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    fcntl.flock(f, fcntl.LOCK_UN)
                except BlockingIOError:
                    raise Busy(f"{os.path.basename(path)} is held by another GPU job")
        need = self.args.min_free_gb if self.tts is None else 4
        if available_gb() < need:
            raise Busy(f"only {available_gb():.0f} GB memory available, need {need}")
        if os.getloadavg()[0] > self.args.max_load:
            raise Busy(f"load average {os.getloadavg()[0]:.1f} is over {self.args.max_load}")

    def load(self, model: str):
        if self.model == model:
            return
        import torch

        if self.tts is not None:  # one model at a time; the aligner stays
            self.tts, self.model, self.conds = None, None, {}
            gc.collect()
            torch.cuda.empty_cache()

        from align import Aligner

        self.torch = torch
        if model == "chatterbox-turbo":
            from chatterbox.tts_turbo import ChatterboxTurboTTS

            self.tts = ChatterboxTurboTTS.from_pretrained(device="cuda")
        else:
            from chatterbox.mtl_tts import ChatterboxMultilingualTTS

            self.tts = ChatterboxMultilingualTTS.from_pretrained(device="cuda", t3_model="v3")
        self.aligner = self.aligner or Aligner("cuda")
        self.model = model

    def unload(self) -> None:
        if self.tts is None and self.whisper is None:
            return
        self.tts = self.aligner = self.model = self.whisper = None
        self.conds = {}
        gc.collect()
        self.torch.cuda.empty_cache()

    def unload_if_idle(self) -> None:
        with self.lock:
            if (self.tts is not None or self.whisper is not None) and time.time() - self.used > self.args.idle_minutes * 60:
                self.unload()
                print("unloaded after idle", flush=True)

    def say(self, req: dict) -> dict:
        model, voice, text, words = req["model"], req["voice"], req["text"], req["words"]
        seed, stage = int(req.get("seed", 0)), int(req.get("stage", 0))
        if model not in MODELS:
            raise ValueError(f"unknown model {model}; have {', '.join(MODELS)}")
        if voice not in self.voices:
            raise ValueError(f"unknown voice {voice}; have {', '.join(self.voices)}")
        with self.lock:
            self.guard()
            self.load(model)
            spec = self.voices[voice]
            turbo = model == "chatterbox-turbo"
            params = dict(TURBO) if turbo else {**BASE, **spec.get("params", {}), **STAGES[stage % len(STAGES)]}
            if voice not in self.conds:
                self.tts.prepare_conditionals(str(Path(self.args.refs) / spec["ref"]), exaggeration=params.get("exaggeration", 0.0))
                self.conds[voice] = self.tts.conds
            self.tts.conds = self.conds[voice]
            t0 = time.time()
            torch = self.torch
            random.seed(seed)
            np.random.seed(seed % 2**32)
            torch.manual_seed(seed)
            torch.cuda.manual_seed_all(seed)
            wav = (self.tts.generate(text, **params) if turbo else self.tts.generate(text, language_id="en", **params)).squeeze(0).numpy()
            self._clean()
            raw = trim_raw(wav, self.tts.sr, len(text))
            with tempfile.TemporaryDirectory(prefix="lf-voice-") as tmp:
                src, dst = os.path.join(tmp, "raw.wav"), os.path.join(tmp, "master.wav")
                sf.write(src, raw, self.tts.sr, subtype="FLOAT")
                mastering = master_wav(src, dst)
                audio, sr = sf.read(dst, dtype="float32")
            timed = self.aligner.align(audio, sr, words)
            audio = room_tone(trim_by_words(audio, sr, timed[0]["start"], timed[-1]["end"]), seed)
            self.used = time.time()
            pcm = (np.clip(audio, -1, 1) * 32767).astype("<i2")
            return {"sample_rate": sr, "pcm": pcm, "words": timed, "seed": seed, "stage": stage, "params": params,
                    "mastering": mastering, "seconds": round(len(pcm) / sr, 2), "raw_seconds": round(len(wav) / self.tts.sr, 2), "generate_s": round(time.time() - t0, 2)}

    def hear(self, req: dict) -> dict:
        pcm = np.frombuffer(base64.b64decode(req["pcm"]), dtype="<i2").astype(np.float32) / 32768
        sr = int(req["sample_rate"])
        with self.lock:
            self.guard()
            import torch
            import torchaudio.functional as F
            import whisper

            self.torch = torch
            if self.whisper is None:
                self.whisper = whisper.load_model("large-v3-turbo", device="cuda")
            x = F.resample(torch.from_numpy(pcm).unsqueeze(0), sr, 16000).squeeze(0).numpy() if sr != 16000 else pcm
            out = self.whisper.transcribe(x, language="en", temperature=0, word_timestamps=True, condition_on_previous_text=False)
            self.used = time.time()
        words = [{"text": w["word"].strip(), "start": round(w["start"], 3), "end": round(w["end"], 3), "type": "word"}
                 for seg in out["segments"] for w in seg.get("words", []) if w["word"].strip()]
        return {"text": out["text"].strip(), "words": words}

    def _clean(self) -> None:
        # ttsctl/tts_engine.py cleanup_tts_memory: Chatterbox leaks forward hooks per call.
        t3 = getattr(self.tts, "t3", None)
        for layer in getattr(getattr(t3, "tfmr", None), "layers", []):
            attn = getattr(layer, "self_attn", None)
            if attn is not None and hasattr(attn, "_forward_hooks"):
                attn._forward_hooks.clear()
        if t3 is not None:
            t3.compiled = False
            if hasattr(t3, "patched_model"):
                t3.patched_model = None
        gc.collect()
        self.torch.cuda.empty_cache()


def handler(voice: Voice):
    class H(BaseHTTPRequestHandler):
        def _send(self, code: int, body: bytes, kind: str):
            self.send_response(code)
            self.send_header("Content-Type", kind)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _json(self, code: int, obj):
            self._send(code, json.dumps(obj).encode(), "application/json")

        def do_GET(self):
            if self.path != "/health":
                return self._json(404, {"error": "not found"})
            self._json(200, {"ok": True, "loaded": voice.tts is not None, "models": list(MODELS), "voices": list(voice.voices)})

        def do_POST(self):
            if self.path not in ("/tts", "/hear"):
                return self._json(404, {"error": "not found"})
            try:
                req = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
                if self.path == "/hear":
                    return self._json(200, voice.hear(req))
                out = voice.say(req)
            except Busy as e:
                return self._json(503, {"error": str(e)})
            except (KeyError, ValueError) as e:
                return self._json(400, {"error": str(e)})
            except Exception as e:  # noqa: BLE001 - a failed take is reported, never silent
                print(f"tts failed: {e!r}", flush=True)
                return self._json(500, {"error": repr(e)})
            pcm = out.pop("pcm")
            if req.get("align"):
                return self._json(200, {**out, "pcm": base64.b64encode(pcm.tobytes()).decode()})
            buf = io.BytesIO()
            sf.write(buf, pcm, out["sample_rate"], format="WAV", subtype="PCM_16")
            self._send(200, buf.getvalue(), "audio/wav")

        def log_message(self, fmt, *args):
            print(f"{time.strftime('%H:%M:%S')} {fmt % args}", flush=True)

    return H


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--host", required=True, help="the Spark's LAN or tailnet address; never 0.0.0.0")
    p.add_argument("--port", type=int, default=18093)
    p.add_argument("--refs", default=os.path.expanduser("~/voice-lab/refs"))
    p.add_argument("--locks", nargs="*", default=[os.path.expanduser(f"~/projects/video-processing/amp-cinema/{n}") for n in ("gpu.lock", "workload.lock")])
    p.add_argument("--min-free-gb", type=float, default=24)
    p.add_argument("--max-load", type=float, default=16)
    p.add_argument("--idle-minutes", type=float, default=15)
    args = p.parse_args()
    if args.host in ("0.0.0.0", "::", ""):
        raise SystemExit("bind to one interface address, not all of them")
    name_process("lf-voice-serve")
    voice = Voice(args)

    def idle():
        while True:
            time.sleep(60)
            voice.unload_if_idle()

    threading.Thread(target=idle, daemon=True).start()
    print(f"lf-voice-serve on {args.host}:{args.port}", flush=True)
    HTTPServer((args.host, args.port), handler(voice)).serve_forever()


if __name__ == "__main__":
    main()
