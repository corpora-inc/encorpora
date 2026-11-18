"""The film kit's local voice: Chatterbox on the Spark, one request at a time.

  POST /tts   {"model", "voice", "text", "words", "seed", "stage"?, "n"?}
              -> audio/wav (44.1 kHz mono 16-bit), or with "align": true
                 JSON {"sample_rate", "pcm" (base64 16-bit), "words": [{word, start, end}],
                       "faults": [sounds that are no word], "candidates": [...], ...}
              With n > 1 it makes n candidates and answers the best (score.py).
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
from master import master_wav, room_tone, trim_raw  # noqa: E402
from quality import FADE_IN, noises, onset, speech_end, trim  # noqa: E402
from score import best, errors  # noqa: E402

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
        self.utmos = None
        self.ref_embed: dict[str, np.ndarray] = {}
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
            self.tts, self.model, self.conds, self.ref_embed = None, None, {}, {}
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
        self.tts = self.aligner = self.model = self.whisper = self.utmos = None
        self.conds, self.ref_embed = {}, {}
        gc.collect()
        self.torch.cuda.empty_cache()

    def unload_if_idle(self) -> None:
        with self.lock:
            if (self.tts is not None or self.whisper is not None) and time.time() - self.used > self.args.idle_minutes * 60:
                self.unload()
                print("unloaded after idle", flush=True)

    def say(self, req: dict) -> dict:
        """The best of `n` candidates of one line (score.py). Candidate j uses seed
        seed + 7919 j and retry stage stage + j, so the n candidates differ in seed,
        guidance, temperature and exaggeration, and a request is still a pure
        function of its fields."""
        model, voice, text, words = req["model"], req["voice"], req["text"], req["words"]
        seed, stage, n = int(req.get("seed", 0)), int(req.get("stage", 0)), max(1, min(8, int(req.get("n", 1))))
        if model not in MODELS:
            raise ValueError(f"unknown model {model}; have {', '.join(MODELS)}")
        if voice not in self.voices:
            raise ValueError(f"unknown voice {voice}; have {', '.join(self.voices)}")
        with self.lock:
            self.guard()
            self.load(model)
            t0 = time.time()
            cands = [self._take(model, voice, text, words, seed + 7919 * j, stage + j) for j in range(n)]
            if n > 1:
                for c in cands:
                    self._measure(c, voice, words)
            pick = best(cands, self.voices[voice].get("pace")) if n > 1 else 0
            self.used = time.time()
        c = cands[pick]
        pcm = (np.clip(c.pop("audio"), -1, 1) * 32767).astype("<i2")
        summary = [{k: v for k, v in x.items() if k in ("seed", "stage", "errors", "noises", "utmos", "similarity", "wps", "heard", "run_on_cut", "onset_kept", "fade_db")} for x in cands]
        return {"sample_rate": c["sr"], "pcm": pcm, "words": c["words"], "seed": c["seed"], "stage": c["stage"], "params": c["params"],
                "faults": c["noises"], "picked": pick, "candidates": summary, "seconds": round(len(pcm) / c["sr"], 2),
                "raw_seconds": c["raw_seconds"], "generate_s": round(time.time() - t0, 2)}

    def _take(self, model: str, voice: str, text: str, words: list[str], seed: int, stage: int) -> dict:
        spec = self.voices[voice]
        turbo = model == "chatterbox-turbo"
        params = dict(TURBO) if turbo else {**BASE, **spec.get("params", {}), **STAGES[stage % len(STAGES)]}
        if voice not in self.conds:
            self.tts.prepare_conditionals(str(Path(self.args.refs) / spec["ref"]), exaggeration=params.get("exaggeration", 0.0))
            self.conds[voice] = self.tts.conds
        self.tts.conds = self.conds[voice]
        torch = self.torch
        random.seed(seed)
        np.random.seed(seed % 2**32)
        torch.manual_seed(seed)
        torch.cuda.manual_seed_all(seed)
        # Chatterbox V3 has no end-of-text guard and often keeps going after the
        # last word: cap the speech tokens (25 a second) at a slow reading of the text.
        cap = int(25 * (0.1 * len(text) + 1.5))
        inference = self.tts.t3.inference
        self.tts.t3.inference = lambda **kw: inference(**{**kw, "max_new_tokens": min(kw.get("max_new_tokens") or cap, cap)})
        try:
            wav = (self.tts.generate(text, **params) if turbo else self.tts.generate(text, language_id="en", **params)).squeeze(0).numpy()
        finally:
            self.tts.t3.inference = inference
        self._clean()
        raw = trim_raw(wav, self.tts.sr, len(text))
        with tempfile.TemporaryDirectory(prefix="lf-voice-") as tmp:
            src, dst = os.path.join(tmp, "raw.wav"), os.path.join(tmp, "master.wav")
            sf.write(src, raw, self.tts.sr, subtype="FLOAT")
            master_wav(src, dst)
            audio, sr = sf.read(dst, dtype="float32")
        timed = self.aligner.align(audio, sr, words)
        out, _ = trim(audio, sr, timed[0]["start"], speech_end(timed))
        # Faults are what can still be heard after the trim, or a word the model stretched;
        # the run-on the trim removed is kept as a count.
        cut = sum(1 for f in noises(audio, sr, timed) if "runs on for" in f)
        found = noises(out, sr, timed)
        # proof of the onset: the first 80 ms of the first word's sound, kept / as made,
        # and the level of the fade-in before it (it must sit in silence)
        on = onset(audio, sr, timed[0]["start"])
        a, b, f = int(on * sr), int((on + 0.08) * sr), int(max(0.0, on - FADE_IN) * sr)
        kept = float(np.sum(out[a:b] ** 2) / max(np.sum(audio[a:b] ** 2), 1e-12))
        fade_db = float(20 * np.log10(max(np.sqrt(np.mean(audio[f:a] ** 2)) if a > f else 0.0, 1e-9)))
        timed[-1]["end"] = round(min(timed[-1]["end"], speech_end(timed)), 3)
        return {"audio": room_tone(out, seed), "sr": sr, "words": timed, "noises": found, "run_on_cut": cut,
                "onset": round(on, 3), "onset_kept": round(kept, 3), "fade_db": round(fade_db, 1), "seed": seed, "stage": stage, "params": params,
                "raw_seconds": round(len(wav) / self.tts.sr, 2)}

    def _measure(self, c: dict, voice: str, words: list[str]) -> None:
        """What Whisper hears, UTMOS22 naturalness, similarity to the reference, pace."""
        import librosa
        import torch

        x16 = librosa.resample(c["audio"], orig_sr=c["sr"], target_sr=16000)
        heard = self._whisper().transcribe(x16, language="en", temperature=0, condition_on_previous_text=False)["text"].strip()
        c["heard"], c["errors"] = heard, errors(words, heard)
        if self.utmos is None:
            self.utmos = torch.hub.load("tarepan/SpeechMOS:v1.2.0", "utmos22_strong", trust_repo=True).to("cuda").eval()
        with torch.no_grad():
            c["utmos"] = round(float(self.utmos(torch.from_numpy(x16).unsqueeze(0).to("cuda"), 16000)), 3)
        if voice not in self.ref_embed:
            ref, rsr = sf.read(str(Path(self.args.refs) / self.voices[voice]["ref"]), dtype="float32")
            self.ref_embed[voice] = self.tts.ve.embeds_from_wavs([librosa.resample(ref, orig_sr=rsr, target_sr=16000)], sample_rate=16000).mean(0)
        e = self.tts.ve.embeds_from_wavs([x16], sample_rate=16000).mean(0)
        r = self.ref_embed[voice]
        c["similarity"] = round(float(np.dot(e, r) / np.linalg.norm(e) / np.linalg.norm(r)), 4)
        speech = c["words"][-1]["end"] - c["words"][0]["start"]
        c["wps"] = round(len(c["words"]) / max(speech, 0.1), 2)

    def _whisper(self):
        import whisper

        if self.whisper is None:
            self.whisper = whisper.load_model("large-v3-turbo", device="cuda")
        return self.whisper

    def hear(self, req: dict) -> dict:
        pcm = np.frombuffer(base64.b64decode(req["pcm"]), dtype="<i2").astype(np.float32) / 32768
        sr = int(req["sample_rate"])
        with self.lock:
            self.guard()
            import torch
            import torchaudio.functional as F

            self.torch = torch
            x = F.resample(torch.from_numpy(pcm).unsqueeze(0), sr, 16000).squeeze(0).numpy() if sr != 16000 else pcm
            out = self._whisper().transcribe(x, language="en", temperature=0, word_timestamps=True, condition_on_previous_text=False)
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
