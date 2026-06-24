#!/usr/bin/env python3
"""Build the SQLite database shipped with the word-explanation pack.

This generalizes the Hanzi pack pipeline (`dja/hanzi_pack`) from per-character
etymologies to per-word explanations. Each word gets ONE ~50-word paragraph in
each of the corpus languages, capturing the word's range of common senses
(polysemy), how those senses relate, where the word came from, and how the
origin branched into the modern senses.

Schema (one generic table, mirrors `hanzi_etymology`):

    word_explanation(word, language_code, paragraph)

The pack DB is standalone: it uses the core DB only to discover the word
universe (via extract_words.py), and reads explanation text from the seed JSON.

    seed/explanations_seed.json := [
        {"word": "running", "explanation": {"en": "...", "zh-Hans": "...", ...}},
        ...
    ]
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List

from extract_words import collect_words

# Bumped from the Hanzi pack's schema_version=2: the word-explanation pack is a
# new pack family with its own schema. Kept as a string for parity with the
# Hanzi pack_meta convention.
SCHEMA_VERSION = "1"

SCHEMA_SQL = """
CREATE TABLE pack_meta(
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE word_explanation(
  word TEXT NOT NULL,
  language_code TEXT NOT NULL,
  paragraph TEXT NOT NULL,
  PRIMARY KEY(word, language_code)
);

CREATE INDEX word_explanation_language ON word_explanation(language_code);
"""


def load_explanations(path: Path) -> Dict[str, Dict[str, str]]:
    """Parse seed JSON into {word: {lang_code: paragraph}}."""
    if not path.exists():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    out: Dict[str, Dict[str, str]] = {}
    if not isinstance(raw, list):
        return out
    for item in raw:
        if not isinstance(item, dict):
            continue
        word = item.get("word")
        explanation = item.get("explanation")
        if not isinstance(word, str) or not isinstance(explanation, dict):
            continue
        clean = {
            lang: text
            for lang, text in explanation.items()
            if isinstance(lang, str) and isinstance(text, str) and text.strip()
        }
        if clean:
            out[word] = clean
    return out


def main() -> None:
    here = Path(__file__).resolve()
    dja = here.parents[1]
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--core-db", type=Path, default=dja / "release.sqlite3")
    ap.add_argument(
        "--packs-dir",
        type=Path,
        default=dja.parent / "tools" / "phrase-packs",
    )
    ap.add_argument(
        "--explanations",
        type=Path,
        default=here.parent / "seed" / "explanations_seed.json",
    )
    ap.add_argument(
        "--out",
        type=Path,
        default=dja.parent / "packs" / "wordpan" / "data" / "word.sqlite3",
    )
    ap.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Limit number of words (0 = all). For quick iteration.",
    )
    ap.add_argument(
        "--include-seed-words",
        action="store_true",
        help=(
            "Union the live corpus word scan with words already present in "
            "the explanations seed. Keeps the pack's word universe stable "
            "across corpus slims (mirrors the Hanzi pack's "
            "--include-etymology-chars)."
        ),
    )
    args = ap.parse_args()

    core_db = args.core_db.resolve()
    if not core_db.exists():
        print(f"Core DB not found: {core_db}", file=sys.stderr)
        sys.exit(1)

    words: List[str] = collect_words(core_db, args.packs_dir.resolve())
    explanations = load_explanations(args.explanations.resolve())

    if args.include_seed_words and explanations:
        seed_words = set(explanations.keys())
        scan = set(words)
        added = len(seed_words - scan)
        if added:
            print(
                f"[words] include-seed-words: scan={len(scan)} "
                f"+ seed-only={added} = {len(scan | seed_words)} total",
            )
        words = sorted(scan | seed_words)

    if args.limit:
        words = words[: args.limit]

    out = args.out.resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()

    conn = sqlite3.connect(str(out))
    conn.isolation_level = None
    conn.execute("PRAGMA journal_mode=OFF;")
    conn.execute("PRAGMA synchronous=OFF;")
    conn.execute("PRAGMA temp_store=MEMORY;")
    conn.execute("PRAGMA foreign_keys=OFF;")
    conn.executescript(SCHEMA_SQL)

    now = datetime.now(timezone.utc).isoformat()
    conn.executemany(
        "INSERT INTO pack_meta(key, value) VALUES(?, ?)",
        [
            ("schema_version", SCHEMA_VERSION),
            ("generated_at", now),
            ("core_db", str(core_db)),
            ("word_count", str(len(words))),
        ],
    )

    rows = 0
    with_explanation = 0
    conn.execute("BEGIN")
    for word in words:
        by_lang = explanations.get(word, {})
        if by_lang:
            with_explanation += 1
        for lang, paragraph in by_lang.items():
            conn.execute(
                "INSERT INTO word_explanation(word, language_code, paragraph) "
                "VALUES(?, ?, ?)",
                (word, lang, paragraph),
            )
            rows += 1
    conn.execute("COMMIT")

    conn.execute("ANALYZE;")
    conn.execute("PRAGMA optimize;")
    conn.execute("VACUUM;")
    conn.close()

    print("== Word-explanation pack DB built ==")
    print(f"Words (universe): {len(words)}")
    print(f"Words with >=1 explanation: {with_explanation}")
    print(f"Explanation rows: {rows}")
    print(f"Output: {out}")


if __name__ == "__main__":
    main()
