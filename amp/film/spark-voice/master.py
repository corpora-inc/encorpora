"""Clean-up of a raw Chatterbox take: trim, master, and trim again by alignment.

Vendored from ttsctl (the Corpán narration pipeline on the Spark):
  - trim_raw:        ttsctl/trimmer.py trim_tts_output (lead-in, ZCR garbage-tail
                     detection, text-length cap, end fade and 300 ms pad)
  - master_wav:      ttsctl/mastering.py master_segment and _build_filter_chain
                     (constant gain to a loudness target, then
                     highpass -> adeclick -> afftdn -> agate -> acompressor -> alimiter)
  (ttsctl's alignment-based trim_trailing_silence was used here until
  2026-11-18; it cut leading consonants and kept drones. quality.py replaced it.)
Changes from ttsctl: no AAC encode (the film kit wants 44.1 kHz PCM), and no
final loudnorm pass. The kit levels every take to its own speaking loudness
(-23.6 LUFS, amp/film/audio.ts `even`), so mastering here is for cleanliness:
the constant gain only puts the gate and compressor at the levels ttsctl tuned
them for (-18 LUFS, ttsctl decision 2026-05-20).
"""
from __future__ import annotations

import json
import re
import subprocess

import numpy as np

TARGET_LUFS = -18.0
TARGET_TP = -1.0
CHAIN = [
    "highpass=f=80:width_type=q:width=0.7",
    "adeclick=window=55:overlap=75:threshold=1.5",
    "afftdn=nr=15:nf=-35:tn=1",
    "agate=threshold=0.018:range=0.01:attack=5:release=50",
    "acompressor=threshold=0.1:ratio=2:attack=10:release=100:makeup=1",
    "alimiter=limit=0.8913:level=false",
]
OUT_SR = 44100


def trim_raw(audio: np.ndarray, sr: int, text_len: int) -> np.ndarray:
    """ttsctl trim_tts_output with its English defaults."""
    if not len(audio):
        return audio
    audio = audio.astype(np.float32)
    lead = int(sr * 0.1)
    if len(audio) > lead and float(np.sqrt(np.mean(audio[: int(sr * 0.02)] ** 2))) > 0.005:
        audio = np.concatenate([np.zeros(lead, dtype=np.float32), audio])
    win_ms = 500
    win = int(sr * win_ms / 1000)
    if win and len(audio) > win * 8:
        n = len(audio) // win
        zcr = np.array([np.sum(np.abs(np.diff(np.sign(audio[i * win:(i + 1) * win])))) / 2 / (win_ms / 1000) for i in range(n)])
        ref_end = max(1, int(n * 0.5))
        speech = float(np.median(zcr[:ref_end]))
        if speech > 0:
            start, thr, run, found = max(ref_end, int(n * 0.6)), speech * 2.5, 0, None
            for i in range(start, n):
                if zcr[i] > thr:
                    run += 1
                    if run >= 3 and found is None:
                        found = i - 2
                elif found is None:
                    run = 0
            if found is not None:
                cut = min(found * win + int(sr * 0.3), len(audio))
                if len(audio) - cut > sr:
                    audio = audio[:cut]
    cap = int((text_len * 0.12 + 5.0) * sr)
    if len(audio) > cap:
        audio = audio[:cap]
        f = int(sr * 0.05)
        audio[-f:] *= np.linspace(1.0, 0.0, f, dtype=np.float32)
    f = int(sr * 0.05)
    if f < len(audio):
        audio[-f:] *= np.exp(-np.linspace(0, 5, f)).astype(np.float32)
    return np.concatenate([audio, np.zeros(int(sr * 0.3), dtype=np.float32)])


def _loudness(path: str) -> tuple[float, float]:
    r = subprocess.run(["ffmpeg", "-hide_banner", "-y", "-i", path, "-af", "loudnorm=I=-20:TP=-3:LRA=11:print_format=json", "-f", "null", "/dev/null"],
                       capture_output=True, text=True, timeout=60)
    m = re.search(r"\{[^}]+\}", r.stderr, re.DOTALL)
    if not m:
        raise RuntimeError(f"loudness: {r.stderr[-300:]}")
    d = json.loads(m.group())
    return float(d["input_i"]), float(d["input_tp"])


def master_wav(src: str, dst: str) -> dict:
    """Constant gain to TARGET_LUFS (clamped by true peak), the ttsctl chain, 44.1 kHz mono 16-bit."""
    lufs, tp = _loudness(src)
    gain = TARGET_LUFS - lufs
    if tp + gain > TARGET_TP:
        gain = TARGET_TP - tp
    chain = ",".join([f"volume={gain:.2f}dB", *CHAIN])
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-af", chain, "-ar", str(OUT_SR), "-ac", "1", "-c:a", "pcm_s16le", dst],
                       capture_output=True, text=True, timeout=120)
    if r.returncode:
        raise RuntimeError(f"mastering: {r.stderr[-300:]}")
    return {"input_lufs": lufs, "input_tp": tp, "gain_db": round(gain, 2), "chain": chain}


# Room tone: about -72 dBFS RMS, far under the kit's silence floor (-49 dBFS).
ROOM = 10 ** (-72 / 20)


def room_tone(audio: np.ndarray, seed: int) -> np.ndarray:
    """Add a faint, seeded noise floor. The gate and denoiser leave stretches of
    exact digital silence inside a take, and the kit rejects any place where
    digital silence meets sound (audio.ts `audioProblems`); a recorded voice has
    room tone there. Seeded, so a take stays a pure function of its request."""
    return audio + np.random.default_rng(seed).standard_normal(len(audio)).astype(np.float32) * ROOM
