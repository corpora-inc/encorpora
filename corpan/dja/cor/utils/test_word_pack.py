# tests/test_word_pack.py
#
# Tests for the word-explanation pack pipeline (dja/word_pack). They run under
# plain pytest with only the stdlib + pydantic available -- exactly the deps
# the CI `dja` gate installs. The pipeline modules live in dja/word_pack/ and
# import each other as top-level modules (mirroring dja/hanzi_pack), so we add
# that directory to sys.path here. The LLM provider is imported lazily inside
# generate_word_explanations.main(), so importing the module for its parsing
# helpers never touches corpora_ai.

import json
import sqlite3
import sys
from pathlib import Path

import pytest

# dja/word_pack lives two levels up from cor/utils/.
WORD_PACK = Path(__file__).resolve().parents[2] / "word_pack"
if str(WORD_PACK) not in sys.path:
    sys.path.insert(0, str(WORD_PACK))

import build_word_pack  # noqa: E402
import extract_words  # noqa: E402
import generate_word_explanations as gen  # noqa: E402


# ---------------------------------------------------------------------------
# Tokenization: the word universe must be stable and predictable.
# ---------------------------------------------------------------------------
def test_tokenize_lowercases_and_keeps_apostrophes():
    assert extract_words.tokenize("Don't STOP running!") == [
        "don't",
        "stop",
        "running",
    ]


def test_tokenize_drops_numbers_and_punctuation():
    assert extract_words.tokenize("Room 101 -- the x-ray, 3.5kg.") == [
        "room",
        "the",
        "x",
        "ray",
        "kg",
    ]


def test_tokenize_empty():
    assert extract_words.tokenize("12345 !!! ???") == []


# ---------------------------------------------------------------------------
# Seed parsing: the builder must ignore malformed records, never crash.
# ---------------------------------------------------------------------------
def test_load_explanations_filters_bad_records(tmp_path):
    seed = tmp_path / "seed.json"
    seed.write_text(
        json.dumps(
            [
                {"word": "running", "explanation": {"en": "to move fast", "es": "correr"}},
                {"word": "bad", "explanation": "not a dict"},  # dropped
                {"explanation": {"en": "no word key"}},  # dropped
                {"word": "blank", "explanation": {"en": "   ", "zh-Hans": "解释"}},
                "totally wrong",  # dropped
            ]
        ),
        encoding="utf-8",
    )
    out = build_word_pack.load_explanations(seed)
    assert set(out) == {"running", "blank"}
    assert out["running"] == {"en": "to move fast", "es": "correr"}
    # empty/whitespace paragraphs are stripped out per-language
    assert out["blank"] == {"zh-Hans": "解释"}


def test_load_explanations_missing_file(tmp_path):
    assert build_word_pack.load_explanations(tmp_path / "nope.json") == {}


# ---------------------------------------------------------------------------
# Checked-in canonical sample: structural contract the pack relies on.
# ---------------------------------------------------------------------------
SEED_PATH = WORD_PACK / "seed" / "explanations_seed.json"
SAMPLE_LANGS = {"en", "zh-Hans", "ar", "hi", "es"}


def _load_seed_records():
    return json.loads(SEED_PATH.read_text(encoding="utf-8"))


def test_sample_seed_is_valid_and_complete():
    records = _load_seed_records()
    assert len(records) >= 15, "sample should be ~15-20 words"
    words = {r["word"] for r in records}
    assert "running" in words, "the locked exemplar must be present"
    for r in records:
        # every word carries all four sample targets + English
        assert SAMPLE_LANGS.issubset(set(r["explanation"])), r["word"]
        for lang in SAMPLE_LANGS:
            assert r["explanation"][lang].strip(), f"{r['word']}/{lang} empty"
        # origin confidence is recorded and from the allowed set
        assert r["origin_confidence"] in {"high", "medium", "low"}, r["word"]


def test_sample_paragraphs_are_roughly_fifty_words():
    for r in _load_seed_records():
        n = len(r["explanation"]["en"].split())
        assert 35 <= n <= 70, f"{r['word']} English paragraph is {n} words"


def test_sample_scripts_match_languages():
    def has(text, lo, hi):
        return any(lo <= ord(c) <= hi for c in text)

    for r in _load_seed_records():
        e = r["explanation"]
        assert has(e["zh-Hans"], 0x4E00, 0x9FFF), f"{r['word']} zh missing Han"
        assert has(e["ar"], 0x0600, 0x06FF), f"{r['word']} ar missing Arabic"
        assert has(e["hi"], 0x0900, 0x097F), f"{r['word']} hi missing Devanagari"


# ---------------------------------------------------------------------------
# Build: the seed -> SQLite emit must produce the generic schema + rows.
# ---------------------------------------------------------------------------
def test_build_emits_generic_schema(tmp_path, monkeypatch):
    # Avoid scanning the real corpus: stub the word scan to the seed's words.
    records = _load_seed_records()
    words = sorted(r["word"] for r in records)
    monkeypatch.setattr(build_word_pack, "collect_words", lambda *a, **k: words)

    out = tmp_path / "word.sqlite3"
    # release.sqlite3 must exist for the core-db guard; point at any real file.
    monkeypatch.setattr(
        sys, "argv", ["build", "--core-db", str(SEED_PATH), "--out", str(out)]
    )
    build_word_pack.main()

    conn = sqlite3.connect(out)
    try:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(word_explanation)")]
        assert cols == ["word", "language_code", "paragraph"]
        meta = dict(conn.execute("SELECT key, value FROM pack_meta"))
        assert meta["schema_version"] == build_word_pack.SCHEMA_VERSION
        assert int(meta["word_count"]) == len(words)
        rows = conn.execute("SELECT COUNT(*) FROM word_explanation").fetchone()[0]
        assert rows == len(words) * len(SAMPLE_LANGS)
        para = conn.execute(
            "SELECT paragraph FROM word_explanation "
            "WHERE word='running' AND language_code='en'"
        ).fetchone()[0]
        assert "Old English" in para
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Generator schemas: confidence field + import safety (no corpora_ai needed).
# ---------------------------------------------------------------------------
def test_verify_item_defaults():
    item = gen.VerifyItem(word="egg", confidence="high")
    assert item.note == "" and item.corrected == ""


def test_save_and_load_seed_roundtrips_metadata(tmp_path):
    path = tmp_path / "full.json"
    data = {
        "egg": {
            "explanation": {"en": "An egg.", "es": "Un huevo."},
            "origin_confidence": "high",
        }
    }
    gen.save_seed(path, data)
    back = gen.load_seed(path)
    assert back["egg"]["explanation"]["es"] == "Un huevo."
    assert back["egg"]["origin_confidence"] == "high"
