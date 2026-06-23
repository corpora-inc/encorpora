"""Shared 16 kHz mono WAV writer + a refs.jsonl cache, used by every loader.

All engines in the bake-off want 16 kHz mono PCM. Every corpus source
materializes its clips through `ensure_wav` and records a `refs.jsonl`
(wav name + reference + id) so re-runs are free and the corpus is inspectable.
"""

from __future__ import annotations

import json
import os


def ensure_wav(audio_array, sr: int, dst: str) -> None:
    """Write a float array as 16 kHz mono PCM_16 WAV, resampling if needed."""
    import numpy as np
    import soundfile as sf

    arr = np.asarray(audio_array, dtype="float32")
    if arr.ndim > 1:  # stereo → mono
        arr = arr.mean(axis=1)
    if sr != 16000:
        import librosa

        arr = librosa.resample(arr, orig_sr=sr, target_sr=16000)
        sr = 16000
    sf.write(dst, arr, sr, subtype="PCM_16")


def source_dir(corpus_dir: str, source: str, our_code: str) -> str:
    """Per-(source, language) dir, so tiers don't collide
    (corpus/<source>/<lang>/)."""
    d = os.path.join(corpus_dir, source, our_code)
    os.makedirs(d, exist_ok=True)
    return d


def read_refs(refs_path: str) -> list[dict]:
    if not os.path.exists(refs_path):
        return []
    return [json.loads(line) for line in open(refs_path, encoding="utf-8") if line.strip()]


def write_refs(refs_path: str, rows: list[dict]) -> None:
    with open(refs_path, "w", encoding="utf-8") as f:
        f.write("\n".join(json.dumps(r, ensure_ascii=False) for r in rows))
