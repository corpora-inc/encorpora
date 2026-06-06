"""Adapter factory. Maps an engine id → a configured Adapter instance.

Model locations and per-engine options come from `opts` (the runner passes
CLI/config values through). Importing an adapter does NOT import its heavy
deps — those are lazy inside load()/transcribe() — so `make_adapter` is cheap
and a missing engine dep only fails when you actually run that engine.
"""

from __future__ import annotations

from .base import Adapter, TranscribeOut


def make_adapter(engine_id: str, **opts) -> Adapter:
    if engine_id == "whisper":
        from .whisper_adapter import WhisperAdapter
        return WhisperAdapter(**opts)
    if engine_id == "qwen3":
        from .qwen3_adapter import Qwen3Adapter
        return Qwen3Adapter(**opts)
    if engine_id == "parakeet":
        from .sherpa_adapter import ParakeetAdapter
        return ParakeetAdapter(**opts)
    if engine_id == "sensevoice":
        from .sherpa_adapter import SenseVoiceAdapter
        return SenseVoiceAdapter(**opts)
    raise ValueError(f"unknown engine id: {engine_id!r}")


__all__ = ["Adapter", "TranscribeOut", "make_adapter"]
