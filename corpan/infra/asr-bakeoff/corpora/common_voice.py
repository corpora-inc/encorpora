"""TIER-2 corpus: Common Voice — accented / L2-leaning natural speech.

Mozilla Common Voice (CC0) is crowd-sourced read speech with rich speaker
metadata, including `accent`/`accents`. Unlike FLEURS's professional native
readers, CV has a wide accent distribution and many non-native speakers — the
closest PUBLIC proxy for "a learner saying a phrase on a phone mic." This tier
measures ACCENT/L2 robustness; `corpan_tts` measures domain-text fit; `gold`
(the owner's real learner recordings) is the truest signal when available.

We stream the CV `test`/`validated` split (HF `mozilla-foundation/
common_voice_17_0`, gated — needs `huggingface-cli login`), and where accent
metadata exists, PREFER non-empty-accent rows (skewing toward accented speech).
A language CV doesn't cover is recorded as a coverage gap, not a crash.
"""

from __future__ import annotations

import os

from . import Sample
from .wavio import ensure_wav, read_refs, source_dir, write_refs

SOURCE = "common_voice"
TIER = "domain"

# Our code → Common Voice language code. None = not in CV → coverage gap.
CV_LANG = {
    "en": "en", "es": "es", "fr": "fr", "de": "de", "it": "it",
    "pt-BR": "pt", "pt-PT": "pt", "nl": "nl", "ru": "ru", "sv": "sv-SE",
    "da": "da", "no": "nn-NO", "fi": "fi", "tr": "tr", "uk": "uk",
    "pl": "pl", "cs": "cs", "sk": "sk", "sl": "sl", "hr": "hr",
    "sr": "sr", "bg": "bg", "ro": "ro", "hu": "hu", "el": "el",
    "ca": "ca", "lt": "lt", "he": None, "ar": "ar", "fa": "fa",
    "ur": "ur", "hi": "hi", "bn": "bn", "ta": "ta", "te": None,
    "kn": "kn", "mr": "mr", "gu": None, "pa-Guru": "pa-IN", "ne": "ne-NP",
    "ja": "ja", "ko-polite": "ko", "zh-Hans": "zh-CN", "zh-Hant": "zh-TW",
    "yue-Hant-HK": "yue", "th": "th", "vi": "vi", "id": "id",
    "ms": None, "sw": "sw", "pa-Arab": None,
}


def load(
    our_code: str, _config, *, n: int, corpus_dir: str,
    cv_dataset: str = "mozilla-foundation/common_voice_17_0",
    prefer_accented: bool = True, **_opts,
) -> list[Sample]:
    cv = CV_LANG.get(our_code)
    if cv is None:
        print(f"  [common_voice] no CV language for {our_code} — skipping", flush=True)
        return []

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

    try:
        ds = load_dataset(cv_dataset, cv, split="test", streaming=True,
                          trust_remote_code=True)
    except Exception as exc:
        # CV is gated; if not logged in / lang absent, record the gap.
        print(f"  [common_voice] load failed for {our_code} ({cv}): {exc}", flush=True)
        return []

    # Pass 1 (if preferring accented): collect rows whose accent field is set.
    # Fall back to any rows to reach N. CV's accent field name varies by
    # version ("accent" vs "accents"); handle both.
    def accent_of(row) -> str:
        return (row.get("accent") or row.get("accents") or "").strip()

    picked: list = []
    overflow: list = []
    for row in ds:
        if len(picked) >= n:
            break
        if prefer_accented and accent_of(row):
            picked.append(row)
        else:
            if len(overflow) < n:
                overflow.append(row)
    rows_in = (picked + overflow)[:n] if prefer_accented else overflow[:n]

    out: list[Sample] = []
    rows: list[dict] = []
    for i, row in enumerate(rows_in):
        audio = row["audio"]
        wav_name = f"{i:04d}.wav"
        wav_path = os.path.join(lang_dir, wav_name)
        reference = (row.get("sentence") or row.get("text") or "").strip()
        if not reference:
            continue
        if not os.path.exists(wav_path):
            ensure_wav(audio["array"], audio["sampling_rate"], wav_path)
        acc = accent_of(row)
        sid = f"{SOURCE}:{our_code}:{i}"
        out.append(Sample(wav_path, reference, sid, tier=TIER, source=SOURCE))
        rows.append({"wav": wav_name, "reference": reference, "id": sid,
                     "accent": acc})
    write_refs(refs_path, rows)
    return out
