"""TIER-2 corpus: Corpán's OWN phrases (release.sqlite3) → TTS audio.

This is the domain-TEXT eval: short, conversational, imperative
target-language utterances drawn from our real corpus (~10k/lang in
dja/release.sqlite3, the exact shape a learner dictates), synthesized to
speech. It measures "does the model transcribe OUR phrase distribution +
vocabulary," which FLEURS's news-y read-speech does NOT.

HONEST LIMITATION: TTS is clean, native-sounding audio. So this tier validates
domain-TEXT fit, NOT accent/L2 robustness — that's `common_voice` (accented
natural speech) and `gold` (the owner's real learner recordings). Reported as a
distinct sub-tier so the three signals aren't conflated.

TTS engine is pluggable (`--tts`). Default = Meta MMS-TTS (facebook/mms-tts-*,
~1100 langs, CC-BY) for the broadest language coverage on a CUDA box. A
language with no TTS voice is SKIPPED and recorded as a coverage gap — never
silently dropped.
"""

from __future__ import annotations

import os
import sqlite3

from . import Sample
from .wavio import read_refs, source_dir, write_refs

SOURCE = "corpan_tts"
TIER = "domain"

# Our code → MMS-TTS ISO 639-3 model suffix (facebook/mms-tts-<iso3>). MMS
# covers a huge set; these are the mappings for our languages. None = no MMS
# voice → coverage gap (recorded, not crashed). Script variants share a voice
# (MMS is phoneme/grapheme-based per language, not per script).
MMS_VOICE = {
    "en": "eng", "es": "spa", "fr": "fra", "de": "deu", "it": "ita",
    "pt-BR": "por", "pt-PT": "por", "nl": "nld", "ru": "rus", "sv": "swe",
    "da": "dan", "no": "nob", "fi": "fin", "tr": "tur", "uk": "ukr",
    "pl": "pol", "cs": "ces", "sk": "slk", "sl": "slv", "hr": "hrv",
    "sr": "srp", "bg": "bul", "ro": "ron", "hu": "hun", "el": "ell",
    "ca": "cat", "lt": "lit", "he": "heb", "ar": "ara", "fa": "fas",
    "ur": "urd", "hi": "hin", "bn": "ben", "ta": "tam", "te": "tel",
    "kn": "kan", "mr": "mar", "gu": "guj", "pa-Guru": "pan", "ne": "nep",
    "ja": "jpn", "ko-polite": "kor", "zh-Hans": "cmn", "zh-Hant": "cmn",
    "yue-Hant-HK": "yue", "th": "tha", "vi": "vie", "id": "ind",
    "ms": "zlm", "sw": "swh", "pa-Arab": None,
}


def corpan_phrases(our_code: str, n: int, db_path: str) -> list[str]:
    """Pull up to `n` short phrases for a language from release.sqlite3.

    Short = the dictation shape: we prefer the lower-CEFR, shorter entries (a
    learner says a phrase, not a paragraph). Deterministic order (by entry id)
    so the same N is reproducible across runs and engines.
    """
    con = sqlite3.connect(db_path)
    try:
        cur = con.cursor()
        rows = cur.execute(
            """
            SELECT t.text
            FROM cor_translation t
            JOIN cor_language l ON t.language_id = l.id
            WHERE l.code = ?
              AND length(t.text) BETWEEN 8 AND 80   -- short, phone-dictation shape
            ORDER BY t.entry_id
            LIMIT ?
            """,
            (our_code, n),
        ).fetchall()
        return [r[0] for r in rows if r[0]]
    finally:
        con.close()


def load(
    our_code: str, _config, *, n: int, corpus_dir: str,
    db_path: str | None = None, tts: str = "mms", **_opts,
) -> list[Sample]:
    voice = MMS_VOICE.get(our_code)
    if voice is None:
        # No TTS voice for this language → coverage gap (e.g. pa-Arab). The
        # runner records the absence; the report shows it as not-evaluated here.
        print(f"  [corpan_tts] no {tts} voice for {our_code} — skipping", flush=True)
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

    db = db_path or _default_db()
    phrases = corpan_phrases(our_code, n, db)
    if not phrases:
        print(f"  [corpan_tts] no phrases for {our_code} in {db}", flush=True)
        return []

    synth = _make_tts(tts, voice)
    out: list[Sample] = []
    rows: list[dict] = []
    for i, text in enumerate(phrases):
        wav_name = f"{i:04d}.wav"
        wav_path = os.path.join(lang_dir, wav_name)
        if not os.path.exists(wav_path):
            try:
                synth(text, wav_path)
            except Exception as exc:  # noisy, not silent
                print(f"  [corpan_tts] synth failed {our_code}#{i}: {exc}", flush=True)
                continue
        sid = f"{SOURCE}:{our_code}:{i}"
        out.append(Sample(wav_path, text, sid, tier=TIER, source=SOURCE))
        rows.append({"wav": wav_name, "reference": text, "id": sid})
    write_refs(refs_path, rows)
    return out


def _default_db() -> str:
    # infra/asr-bakeoff/corpora/ → up 3 = corpan/, then dja/release.sqlite3.
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.normpath(os.path.join(here, "..", "..", "..", "dja", "release.sqlite3"))


def _make_tts(engine: str, voice: str):
    """Return a `synth(text, dst_wav)` callable. Lazy-imports the TTS dep."""
    if engine == "mms":
        from transformers import VitsModel, AutoTokenizer
        import torch
        import soundfile as sf

        repo = f"facebook/mms-tts-{voice}"
        model = VitsModel.from_pretrained(repo)
        tok = AutoTokenizer.from_pretrained(repo)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = model.to(device)
        sr = model.config.sampling_rate

        def synth(text: str, dst: str) -> None:
            inputs = tok(text, return_tensors="pt").to(device)
            with torch.no_grad():
                wav = model(**inputs).waveform[0].cpu().numpy()
            sf.write(dst, wav, sr, subtype="PCM_16")

        return synth
    raise ValueError(f"unknown tts engine: {engine!r}")
