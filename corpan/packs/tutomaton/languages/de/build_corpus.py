"""Build German sqlite corpus for Tutomaton.

Generated from the universal template. Customize the LANG-SPECIFIC sections
(marked with `# === LANG-SPECIFIC ===`) for this language's particulars.

Inputs:
  - ~/data/kaikki/kaikki-de.jsonl     (download from kaikki.org;
                                                  cached, gitignored)
  - lesson_data.py                              (hand-authored lessons)
  - theme_data.py                               (hand-authored vocab themes)
  - l1_errors_data.py                           (hand-authored L1-error patterns)
  - _source/core_vocab.json (optional)          (hand-curated top-300 overrides)
  - schema_base.sql (from ../_template/)

Output:
  data/de.sqlite3
"""
from __future__ import annotations
import json
import sqlite3
import sys
from pathlib import Path

# ============================================================
# CONFIG — edit these for each language
# ============================================================

LANG_CODE = "de"      # ISO 639-1, e.g. "en", "es", "zh", "fr"
LANG_NAME = "German"      # human name, e.g. "English", "Spanish"
TOP_WORDS = 8000               # how many lemmas to include in words table
LEVEL_SYSTEM = "CEFR"          # "CEFR" or "HSK" or custom

# ============================================================
# PATHS
# ============================================================

HERE = Path(__file__).parent
TEMPLATE_DIR = HERE.parent / "_template"
SCHEMA_PATH = TEMPLATE_DIR / "schema_base.sql"
DB_PATH = HERE / "data" / f"de.sqlite3"
KAIKKI_CACHE = Path.home() / "data" / "kaikki" / f"kaikki-de.jsonl"
CORE_VOCAB_PATH = HERE / "_source" / "core_vocab.json"

# ============================================================
# HELPERS
# ============================================================

def init_db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA_PATH.read_text())
    # Language-specific schema additions go here:
    # === LANG-SPECIFIC === (uncomment + adapt for languages that need extras)
    # conn.executescript(\"\"\"
    #     DROP TABLE IF EXISTS phrasal_verbs;
    #     CREATE TABLE phrasal_verbs (...);
    # \"\"\")
    return conn


def iter_kaikki(path: Path):
    """Yield each kaikki Wiktionary entry as a dict."""
    if not path.exists():
        print(f"WARN: kaikki dump not found at {path}", file=sys.stderr)
        print(f"      Download from https://kaikki.org/dictionary/German/", file=sys.stderr)
        return
    with path.open() as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    continue


def primary_gloss(entry: dict) -> str:
    """Extract a clean English gloss from a kaikki entry."""
    senses = entry.get("senses", [])
    glosses = []
    for s in senses[:3]:
        for g in s.get("glosses", [])[:1]:
            glosses.append(g)
    return "; ".join(glosses)


def primary_ipa(entry: dict, accent_filter: str | None = None) -> str:
    """Extract an IPA from a kaikki entry's `sounds[]`. Optionally filter
    by accent tag (e.g. 'General American', 'Received Pronunciation')."""
    for s in entry.get("sounds", []):
        if "ipa" not in s:
            continue
        if accent_filter:
            tags = " ".join(s.get("tags", []) + [s.get("accent", "")])
            if accent_filter.lower() not in tags.lower():
                continue
        return s["ipa"]
    # Fallback: first IPA regardless of accent
    for s in entry.get("sounds", []):
        if "ipa" in s:
            return s["ipa"]
    return ""


# ============================================================
# POPULATE
# ============================================================

def populate_words(conn: sqlite3.Connection):
    """Top-N most-frequent lemmas. Override per language if you have a
    better frequency source than kaikki's ordering (English: SUBTLEX;
    Chinese: HSK; Spanish: RAE+CREA)."""
    cur = conn.cursor()
    count = 0
    seen = set()
    for entry in iter_kaikki(KAIKKI_CACHE):
        lemma = entry.get("word")
        if not lemma or lemma in seen:
            continue
        pos = entry.get("pos", "")
        if pos not in {"noun", "verb", "adj", "adv", "prep", "conj", "pron", "num", "intj", "det"}:
            continue
        seen.add(lemma)
        cur.execute(
            "INSERT OR REPLACE INTO words(lemma, pos, ipa, glosses_en, frequency_rank) "
            "VALUES (?, ?, ?, ?, ?)",
            (lemma, pos, primary_ipa(entry), primary_gloss(entry), count + 1),
        )
        count += 1
        if count >= TOP_WORDS:
            break
    print(f"  words: {count}")


def populate_lessons(conn: sqlite3.Connection):
    """Load from lesson_data.py."""
    sys.path.insert(0, str(HERE))
    from lesson_data import LESSONS  # type: ignore
    cur = conn.cursor()
    for l in LESSONS:
        cur.execute(
            "INSERT INTO lessons(topic, title, level, body_markdown, related_topics, l1_notes_json) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                l["topic"],
                l["title"],
                l.get("level", ""),
                l["body"].strip(),
                ",".join(l.get("related", [])),
                json.dumps(l.get("l1_notes", {}), ensure_ascii=False) if l.get("l1_notes") else None,
            ),
        )
    conn.execute("INSERT INTO lessons_fts(lessons_fts) VALUES('rebuild')")
    print(f"  lessons: {len(LESSONS)}")


def populate_themes(conn: sqlite3.Connection):
    """Load from theme_data.py."""
    from theme_data import THEMES  # type: ignore
    cur = conn.cursor()
    total = 0
    for theme, items in THEMES.items():
        for pos, item in enumerate(items):
            # item is a dict: {"word": "...", "ipa": "...", "l1": {"es":"...","fr":"..."}, "notes": ""}
            cur.execute(
                "INSERT INTO vocabulary_themes(theme, position, target_word, ipa, l1_translations_json, notes) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (
                    theme,
                    pos,
                    item["word"],
                    item.get("ipa"),
                    json.dumps(item.get("l1", {}), ensure_ascii=False) if item.get("l1") else None,
                    item.get("notes"),
                ),
            )
            total += 1
    print(f"  themes: {len(THEMES)} ({total} items)")


def populate_l1_errors(conn: sqlite3.Connection):
    """Load from l1_errors_data.py. No-op if the file doesn't exist
    (some languages defer L1-errors to later versions)."""
    try:
        from l1_errors_data import L1_ERRORS  # type: ignore
    except ImportError:
        print(f"  l1_errors: skipped (no l1_errors_data.py)")
        return
    cur = conn.cursor()
    n = 0
    for err in L1_ERRORS:
        cur.execute(
            "INSERT INTO l1_errors(l1_code, error_pattern, correct_form, l1_name, "
            "l1_explanation, en_explanation, example_wrong, example_right, severity, lesson_topic) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                err["l1_code"],
                err["error_pattern"],
                err["correct_form"],
                err.get("l1_name"),
                err.get("l1_explanation"),
                err["en_explanation"],
                err.get("example_wrong"),
                err.get("example_right"),
                err.get("severity", "med"),
                err.get("lesson_topic"),
            ),
        )
        n += 1
    print(f"  l1_errors: {n}")


def populate_core_vocab_overrides(conn: sqlite3.Connection):
    """Override Wiktionary glosses for the top-N most-common words where
    Wiktionary's noisy sense ordering hurts (e.g. 'gato' → 'whoremonger')."""
    if not CORE_VOCAB_PATH.exists():
        return
    data = json.loads(CORE_VOCAB_PATH.read_text())
    cur = conn.cursor()
    n = 0
    for entry in data:
        cur.execute(
            "INSERT OR REPLACE INTO words(lemma, pos, ipa, glosses_en, "
            "example_target, example_en, frequency_rank, register) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                entry["lemma"],
                entry.get("pos"),
                entry.get("ipa"),
                entry.get("glosses_en"),
                entry.get("example_target"),
                entry.get("example_en"),
                entry.get("frequency_rank"),
                entry.get("register"),
            ),
        )
        n += 1
    print(f"  core_vocab overrides: {n}")


# ============================================================
# MAIN
# ============================================================

def main():
    print(f"Building German (de) corpus → {DB_PATH}")
    conn = init_db()
    populate_words(conn)
    populate_core_vocab_overrides(conn)
    populate_lessons(conn)
    populate_themes(conn)
    populate_l1_errors(conn)
    # === LANG-SPECIFIC === (add populate_phrasal_verbs, populate_chengyu, etc.)
    conn.commit()
    size_kb = DB_PATH.stat().st_size / 1024
    print(f"DONE. size={size_kb:.1f} KB")
    conn.close()


if __name__ == "__main__":
    main()
