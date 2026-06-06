"""Whisper large-v3 adapter (desktop proxy for the on-device ggml-q5 ship).

On device we run whisper.cpp ggml-large-v3-q5_0.bin (CPU on Android,
Metal on iOS). For the DESKTOP bake-off we use faster-whisper (CTranslate2)
large-v3 int8 as a stand-in for ACCURACY ranking — same weights, different
runtime. The desktop latency/RAM numbers are NOT the device numbers; the
device leg (device/RUNBOOK.md) measures the real ggml-q5 cost. What transfers
from desktop is the WER/CER ranking, which is weight- not runtime-bound.

Language hint: Whisper takes a 2-letter ISO code. We map our codes down
(zh-Hans→zh, ko-polite→ko, pa-Guru→pa, yue-Hant-HK→yue) — the same mapping
tauri-plugin-stt already does (`whisper_language` field).
"""

from __future__ import annotations

from .base import Adapter

# Our-code → whisper 2-letter hint. Mirrors the app's TranscriptionResult
# .whisperLanguage derivation.
_WHISPER_LANG = {
    "pt-BR": "pt", "pt-PT": "pt", "zh-Hans": "zh", "zh-Hant": "zh",
    "yue-Hant-HK": "yue", "ko-polite": "ko", "pa-Guru": "pa", "pa-Arab": "pa",
}


def whisper_code(our_code: str) -> str:
    if our_code in _WHISPER_LANG:
        return _WHISPER_LANG[our_code]
    return our_code.split("-")[0]


class WhisperAdapter(Adapter):
    engine_id = "whisper"

    def _load(self, lang_code: str) -> None:
        from faster_whisper import WhisperModel  # lazy

        if getattr(self, "_model", None) is None:
            size = self.opts.get("model", "large-v3")
            compute = self.opts.get("compute_type", "int8")
            device = self.opts.get("device", "cpu")
            self._model = WhisperModel(size, device=device, compute_type=compute)

    def _transcribe(self, wav_path: str, lang_code: str) -> str:
        segments, _info = self._model.transcribe(
            wav_path,
            language=whisper_code(lang_code),
            beam_size=self.opts.get("beam_size", 5),
            vad_filter=False,
        )
        return "".join(seg.text for seg in segments).strip()
