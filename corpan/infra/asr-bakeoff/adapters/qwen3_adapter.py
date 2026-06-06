"""Qwen3-ASR-0.6B adapter — the north-star candidate.

Desktop path uses the official `qwen-asr` PyPI package (transformers
backend) loading `Qwen/Qwen3-ASR-0.6B` (Apache-2.0, 52 langs). This measures
the ACCURACY that decides whether Qwen3-ASR-0.6B can be Corpán's default
download tier (the north-star question).

The DEVICE path is different and is what actually ships: the GGUF
(`ggml-org/Qwen3-ASR-0.6B-GGUF`, Q8_0 ≈ 805 MB) on the GGML runtime via
`qwen3-asr.cpp` / llama.cpp — i.e. the SAME llama.cpp the corpan-llm plugin
already vendors (the §3.3 runtime-sharing prize). The device leg measures
real co-resident RAM with the 4B LLM loaded. `qwen3-asr.cpp` benched ~247 MB
RSS + ~294 MB Metal for a 92 s clip → ~0.5 GB co-resident, inside the
masterplan's 0.4–0.7 GB estimate. Sources: device/RUNBOOK.md.

Qwen3-ASR takes our codes more directly than Whisper (it has language ids for
its 52-lang set); we pass a best-effort language hint and let it auto-detect
when unsure.
"""

from __future__ import annotations

from .base import Adapter

# Our-code → Qwen3-ASR language hint (its card lists language names; the
# package accepts ISO-ish codes). Conservative: when unsure, pass None and
# let the model identify the language itself (it does LID natively).
_QWEN_LANG = {
    "pt-BR": "pt", "pt-PT": "pt", "zh-Hans": "zh", "zh-Hant": "zh",
    "yue-Hant-HK": "yue", "ko-polite": "ko", "pa-Guru": "pa",
}


def qwen_code(our_code: str) -> str | None:
    if our_code in _QWEN_LANG:
        return _QWEN_LANG[our_code]
    base = our_code.split("-")[0]
    return base or None


class Qwen3Adapter(Adapter):
    engine_id = "qwen3"

    def _load(self, lang_code: str) -> None:
        if getattr(self, "_model", None) is not None:
            return
        # `qwen-asr` exposes Qwen3ASRModel.from_pretrained for the
        # transformers backend (per the model card). Import lazily so the
        # harness runs without this heavy dep when only other engines are
        # requested.
        from qwen_asr import Qwen3ASRModel  # type: ignore

        repo = self.opts.get("model", "Qwen/Qwen3-ASR-0.6B")
        self._model = Qwen3ASRModel.from_pretrained(
            repo,
            dtype=self.opts.get("dtype", "auto"),
            device_map=self.opts.get("device", "auto"),
        )

    def _transcribe(self, wav_path: str, lang_code: str) -> str:
        hint = qwen_code(lang_code)
        # The package accepts a local path and an optional language hint;
        # returns transcription text. Kept defensive about the exact return
        # shape (str vs object) since the package API is young.
        result = self._model.transcribe(wav_path, language=hint)
        if isinstance(result, str):
            return result.strip()
        # Common shapes: {"text": ...} or an object with .text
        text = getattr(result, "text", None)
        if text is None and isinstance(result, dict):
            text = result.get("text") or result.get("transcription")
        return (text or "").strip()
