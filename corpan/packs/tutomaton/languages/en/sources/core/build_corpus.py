"""Build English sqlite corpus for Tutomaton."""
from __future__ import annotations
import json
import sqlite3
import sys
from pathlib import Path

LANG_CODE = "en"
LANG_NAME = "English"

HERE = Path(__file__).parent
TEMPLATE_DIR = HERE.parents[2] / "_template"  # languages/_template/
SCHEMA_PATH = TEMPLATE_DIR / "schema_base.sql"
DB_PATH = HERE / "data" / "english.sqlite3"

# Language-specific schema additions for English
EN_EXTRA_SCHEMA = """
DROP TABLE IF EXISTS phrasal_verbs;
CREATE TABLE phrasal_verbs (
  verb            TEXT NOT NULL,
  particle        TEXT NOT NULL,
  meaning         TEXT NOT NULL,
  example_en      TEXT,
  separability    TEXT,
  register        TEXT,
  PRIMARY KEY (verb, particle, meaning)
);
CREATE INDEX phrasal_verb ON phrasal_verbs(verb);
CREATE INDEX phrasal_particle ON phrasal_verbs(particle);

DROP TABLE IF EXISTS modal_verbs;
CREATE TABLE modal_verbs (
  modal           TEXT NOT NULL,
  function        TEXT NOT NULL,
  meaning         TEXT NOT NULL,
  example_en      TEXT,
  notes           TEXT,
  PRIMARY KEY (modal, function)
);
CREATE INDEX modals_modal ON modal_verbs(modal);
"""


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA_PATH.read_text())
    conn.executescript(EN_EXTRA_SCHEMA)
    return conn


def populate_lessons(conn):
    sys.path.insert(0, str(HERE))
    from lesson_data import LESSONS  # type: ignore
    cur = conn.cursor()
    for l in LESSONS:
        cur.execute(
            "INSERT INTO lessons(topic, title, level, body_markdown, related_topics, l1_notes_json) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                l["topic"], l["title"], l.get("level", ""),
                l["body"].strip(), ",".join(l.get("related", [])),
                json.dumps(l.get("l1_notes", {}), ensure_ascii=False) if l.get("l1_notes") else None,
            ),
        )
    conn.execute("INSERT INTO lessons_fts(lessons_fts) VALUES('rebuild')")
    print(f"  lessons: {len(LESSONS)}")


def populate_themes(conn):
    from theme_data import THEMES  # type: ignore
    cur = conn.cursor()
    total = 0
    for theme, items in THEMES.items():
        for pos, item in enumerate(items):
            cur.execute(
                "INSERT INTO vocabulary_themes(theme, position, target_word, ipa, l1_translations_json, notes) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (
                    theme, pos, item["word"], item.get("ipa"),
                    json.dumps(item.get("l1", {}), ensure_ascii=False) if item.get("l1") else None,
                    item.get("notes"),
                ),
            )
            total += 1
    print(f"  themes: {len(THEMES)} ({total} items)")


def populate_l1_errors(conn):
    from l1_errors_data import L1_ERRORS  # type: ignore
    cur = conn.cursor()
    for err in L1_ERRORS:
        cur.execute(
            "INSERT INTO l1_errors(l1_code, error_pattern, correct_form, l1_name, "
            "l1_explanation, en_explanation, example_wrong, example_right, severity, lesson_topic) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                err["l1_code"], err["error_pattern"], err["correct_form"],
                err.get("l1_name"), err.get("l1_explanation"), err["en_explanation"],
                err.get("example_wrong"), err.get("example_right"),
                err.get("severity", "med"), err.get("lesson_topic"),
            ),
        )
    print(f"  l1_errors: {len(L1_ERRORS)}")


def populate_phrasal_verbs(conn):
    from phrasal_verbs_data import PHRASAL_VERBS, MODAL_VERBS  # type: ignore
    cur = conn.cursor()
    for pv in PHRASAL_VERBS:
        cur.execute(
            "INSERT INTO phrasal_verbs(verb, particle, meaning, example_en, separability, register) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (pv["verb"], pv["particle"], pv["meaning"], pv.get("example_en"),
             pv.get("separability"), pv.get("register", "neutral")),
        )
    for m in MODAL_VERBS:
        cur.execute(
            "INSERT OR IGNORE INTO modal_verbs(modal, function, meaning, example_en, notes) "
            "VALUES (?, ?, ?, ?, ?)",
            (m["modal"], m["function"], m["meaning"], m.get("example_en"), m.get("notes")),
        )
    print(f"  phrasal_verbs: {len(PHRASAL_VERBS)}, modal_verbs: {len(MODAL_VERBS)}")


def main():
    print(f"Building {LANG_NAME} ({LANG_CODE}) corpus → {DB_PATH}")
    conn = init_db()
    populate_lessons(conn)
    populate_themes(conn)
    populate_l1_errors(conn)
    populate_phrasal_verbs(conn)
    conn.commit()
    size_kb = DB_PATH.stat().st_size / 1024
    print(f"DONE. size={size_kb:.1f} KB")
    conn.close()


if __name__ == "__main__":
    main()
