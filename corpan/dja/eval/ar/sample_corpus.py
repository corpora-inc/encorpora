#!/usr/bin/env python3
"""Extract a stratified Arabic phrase sample from release.sqlite3.

Writes two key->string JSON files (keyed by entry_id) so the same
`grade_locale.py` harness can grade corpus phrases against their English
source. Sampling is spread across CEFR levels so the grade reflects the whole
corpus, not just the easy A1 tail.

Usage:
  python sample_corpus.py --db ../../release.sqlite3 \
      --per-level 30 --en-out /tmp/corpus_en.json --ar-out /tmp/corpus_ar.json

Deterministic: orders by entry_id and takes an evenly-strided slice per level
(no RNG — reproducible across runs).
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

EN_ID, AR_ID = 13, 23
LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--per-level", type=int, default=30)
    ap.add_argument("--en-out", required=True)
    ap.add_argument("--ar-out", required=True)
    args = ap.parse_args()

    con = sqlite3.connect(args.db)
    en, ar = {}, {}
    for level in LEVELS:
        rows = con.execute(
            """SELECT e.id, s.text, t.text
                 FROM cor_entry e
                 JOIN cor_translation s ON s.entry_id=e.id AND s.language_id=?
                 JOIN cor_translation t ON t.entry_id=e.id AND t.language_id=?
                WHERE e.level=?
                ORDER BY e.id""",
            (EN_ID, AR_ID, level),
        ).fetchall()
        if not rows:
            continue
        # Evenly strided slice → spread across the level, not the first N.
        stride = max(1, len(rows) // args.per_level)
        picked = rows[::stride][: args.per_level]
        for eid, en_text, ar_text in picked:
            key = f"{level}:{eid}"
            en[key] = en_text
            ar[key] = ar_text

    Path(args.en_out).write_text(
        json.dumps(en, ensure_ascii=False, indent=2), encoding="utf-8")
    Path(args.ar_out).write_text(
        json.dumps(ar, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Sampled {len(ar)} phrases across {len(LEVELS)} levels "
          f"→ {args.en_out}, {args.ar_out}")


if __name__ == "__main__":
    main()
