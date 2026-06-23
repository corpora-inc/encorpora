"""TIER-1 corpus: FLEURS (google/fleurs, CC-BY) — cross-language ranking.

Native, clean read-speech, 350-sentence `test` split per language. This is the
DECISION GATE that ranks the models across all our languages. It is NOT our
real input shape (a non-native learner saying a short phrase on a phone mic) —
that's the TIER-2 domain-matched eval (`corpan_phrases`, `common_voice`,
`gold`). A winner must clear both tiers.

We stream FLEURS (no full download), take the first N samples, write 16 kHz
mono WAVs under corpus/fleurs/<lang>/, cache a refs.jsonl. Cap N (default 20)
for a stable relative ranking; bump for close calls.
"""

from __future__ import annotations

import os

from . import Sample
from .wavio import ensure_wav, read_refs, source_dir, write_refs

SOURCE = "fleurs"
TIER = "fleurs"


def load(our_code: str, fleurs_config: str, *, n: int, corpus_dir: str) -> list[Sample]:
    lang_dir = source_dir(corpus_dir, SOURCE, our_code)
    refs_path = os.path.join(lang_dir, "refs.jsonl")

    cached = read_refs(refs_path)
    if len(cached) >= n:
        return [
            Sample(os.path.join(lang_dir, r["wav"]), r["reference"], r["id"],
                   tier=TIER, source=SOURCE)
            for r in cached[:n]
        ]

    from datasets import load_dataset  # lazy

    ds = load_dataset(
        "google/fleurs", fleurs_config, split="test", streaming=True,
        trust_remote_code=True,
    )
    out: list[Sample] = []
    rows: list[dict] = []
    for i, row in enumerate(ds):
        if len(out) >= n:
            break
        audio = row["audio"]
        wav_name = f"{i:04d}.wav"
        wav_path = os.path.join(lang_dir, wav_name)
        # raw_transcription keeps casing/punct (our normalizer handles the rest).
        reference = row.get("raw_transcription") or row.get("transcription") or ""
        if not os.path.exists(wav_path):
            ensure_wav(audio["array"], audio["sampling_rate"], wav_path)
        sid = f"{SOURCE}:{our_code}:{i}"
        out.append(Sample(wav_path, reference, sid, tier=TIER, source=SOURCE))
        rows.append({"wav": wav_name, "reference": reference, "id": sid})
    write_refs(refs_path, rows)
    return out
