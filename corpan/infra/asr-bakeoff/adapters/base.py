"""Engine adapter interface for the bake-off.

Every engine — Whisper, Qwen3-ASR, Parakeet, SenseVoice — is wrapped so the
runner can treat them identically:

    adapter = make_adapter("qwen3", model_dir=...)
    adapter.load(lang)                 # lazy, once per (engine, lang)
    out = adapter.transcribe(wav_path, lang)
    # out.text, out.latency_s, out.peak_rss_mb

Adapters lazy-import their heavy deps INSIDE load()/transcribe(), never at
module import, so the harness runs with whatever subset of engines is
installed (you can benchmark Qwen3 alone without sherpa-onnx present).

Memory: we measure peak RSS of THIS process across the transcribe call via
`resource.getrusage(RUSAGE_SELF).ru_maxrss` deltas, plus a psutil sample.
ru_maxrss is high-water-mark (monotonic), so we read it before/after and
report the max — good enough to rank engines by footprint. The authoritative
co-resident-with-4B number comes from the on-device leg (device/RUNBOOK.md),
not this desktop proxy; desktop RAM is a RELATIVE ranking signal.
"""

from __future__ import annotations

import resource
import sys
import time
from dataclasses import dataclass


def _rss_mb() -> float:
    """Current process max-RSS high-water mark in MB. ru_maxrss is bytes on
    macOS, kilobytes on Linux — normalize."""
    val = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return val / (1024 * 1024) if sys.platform == "darwin" else val / 1024


@dataclass
class TranscribeOut:
    text: str
    latency_s: float
    peak_rss_mb: float
    error: str | None = None


class Adapter:
    """Base class. Subclasses implement `_load` and `_transcribe`."""

    engine_id: str = "base"

    def __init__(self, **opts):
        self.opts = opts
        self._loaded_for: str | None = None

    # --- public ---------------------------------------------------------
    def load(self, lang_code: str) -> None:
        # Some engines load one multilingual model (Whisper/Qwen3/SenseVoice)
        # and just pass a language hint per call; others (sherpa configs) are
        # per-language. Subclasses decide; default reloads only if the
        # requested lang differs and the subclass is per-language.
        if self._loaded_for == lang_code:
            return
        self._load(lang_code)
        self._loaded_for = lang_code

    def transcribe(self, wav_path: str, lang_code: str) -> TranscribeOut:
        before = _rss_mb()
        t0 = time.perf_counter()
        try:
            text = self._transcribe(wav_path, lang_code)
            err = None
        except Exception as exc:  # noisy, not silent — surfaced in the row
            text = ""
            err = f"{type(exc).__name__}: {exc}"
        latency = time.perf_counter() - t0
        peak = max(before, _rss_mb())
        return TranscribeOut(text=text, latency_s=latency, peak_rss_mb=peak, error=err)

    # --- to override ----------------------------------------------------
    def _load(self, lang_code: str) -> None:
        raise NotImplementedError

    def _transcribe(self, wav_path: str, lang_code: str) -> str:
        raise NotImplementedError
