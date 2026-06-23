"""TIER-2 corpus: the owner's REAL learner recordings (the gold set).

The truest signal we can get: actual non-native speakers saying actual Corpán
target phrases on real phone mics (e.g. captured via Parlometron usage). When
the owner routes these, drop them in as a MANIFEST so this loader picks them up
with zero code changes.

Manifest = `corpus/gold/<our_code>/refs.jsonl`, one JSON object per line:
    {"wav": "0001.wav", "reference": "la cuenta, por favor", "id": "gold:es:1"}
with the wav files alongside it (any sample rate / channels — we re-mux to
16 kHz mono on first use into `_16k/`). The owner just provides
(wav, expected-text) pairs; everything else is automatic.

If no manifest exists for a language, this loader returns [] (no gold yet) —
the report shows the gold sub-tier as "—" for that language until recordings
arrive. Nothing here downloads or synthesizes; it's purely the owner's data.
"""

from __future__ import annotations

import os

from . import Sample
from .wavio import ensure_wav, read_refs, source_dir, write_refs

SOURCE = "gold"
TIER = "domain"


def load(our_code: str, _config, *, n: int, corpus_dir: str, **_opts) -> list[Sample]:
    lang_dir = source_dir(corpus_dir, SOURCE, our_code)
    refs_path = os.path.join(lang_dir, "refs.jsonl")
    manifest = read_refs(refs_path)
    if not manifest:
        return []  # no gold recordings for this language yet

    norm_dir = os.path.join(lang_dir, "_16k")
    os.makedirs(norm_dir, exist_ok=True)

    out: list[Sample] = []
    rewritten: list[dict] = []
    for r in manifest[:n]:
        src_wav = os.path.join(lang_dir, r["wav"])
        if not os.path.exists(src_wav):
            print(f"  [gold] missing wav {src_wav} — skipping", flush=True)
            continue
        norm_wav = os.path.join(norm_dir, r["wav"])
        if not os.path.exists(norm_wav):
            try:
                import soundfile as sf
                data, sr = sf.read(src_wav, dtype="float32", always_2d=False)
                ensure_wav(data, sr, norm_wav)
            except Exception as exc:  # noisy, not silent
                print(f"  [gold] remux failed {src_wav}: {exc}", flush=True)
                continue
        sid = r.get("id") or f"{SOURCE}:{our_code}:{len(out)}"
        out.append(Sample(norm_wav, r["reference"], sid, tier=TIER, source=SOURCE))
        rewritten.append(r)
    # Keep refs.jsonl as the owner supplied it; don't clobber their manifest.
    if rewritten and not os.path.exists(os.path.join(norm_dir, "refs.jsonl")):
        write_refs(os.path.join(norm_dir, "refs.jsonl"), rewritten)
    return out
