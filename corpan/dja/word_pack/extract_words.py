#!/usr/bin/env python3
"""Extract the unique English word list for the word-explanation pack.

Source = the English side of the core corpus (`release.sqlite3`) PLUS every
phrase pack under `corpan/tools/phrase-packs/phrase-*/phrases.json`. This is
the canonical universe of words the pack must explain.

Tokenization keeps it deliberately simple and stable: lowercase, then take
runs of ASCII letters with internal apostrophes (so "don't" stays one token,
"x-ray" splits into "x" and "ray"). Numbers and pure punctuation are dropped.
The result is the set of surface words; lemmatization is intentionally NOT done
here so the pack can explain words exactly as a learner meets them in a phrase.
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
from pathlib import Path
from typing import Iterable, List, Set


WORD_RE = re.compile(r"[a-z]+(?:'[a-z]+)*")


def tokenize(text: str) -> Iterable[str]:
    return WORD_RE.findall(text.lower())


def core_english(core_db: Path) -> List[str]:
    conn = sqlite3.connect(f"file:{core_db}?mode=ro&immutable=1", uri=True)
    try:
        row = conn.execute(
            "SELECT id FROM cor_language WHERE code = 'en'"
        ).fetchone()
        if not row:
            return []
        (en_id,) = row
        return [
            text
            for (text,) in conn.execute(
                "SELECT text FROM cor_translation WHERE language_id = ?",
                (en_id,),
            )
            if text
        ]
    finally:
        conn.close()


def phrase_pack_english(packs_dir: Path) -> List[str]:
    out: List[str] = []
    for phrases_json in sorted(packs_dir.glob("phrase-*/phrases.json")):
        try:
            data = json.loads(phrases_json.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001
            print(f"[warn] skipping {phrases_json}: {exc}", file=sys.stderr)
            continue
        if not isinstance(data, list):
            continue
        for item in data:
            if isinstance(item, dict) and isinstance(item.get("english"), str):
                out.append(item["english"])
    return out


def collect_words(core_db: Path, packs_dir: Path) -> List[str]:
    texts: List[str] = []
    texts.extend(core_english(core_db))
    texts.extend(phrase_pack_english(packs_dir))
    words: Set[str] = set()
    for text in texts:
        words.update(tokenize(text))
    return sorted(words)


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
        "--out",
        type=Path,
        default=None,
        help="Write the word list (one per line) here. Default: stdout.",
    )
    args = ap.parse_args()

    core_db = args.core_db.resolve()
    if not core_db.exists():
        print(f"Core DB not found: {core_db}", file=sys.stderr)
        sys.exit(1)

    words = collect_words(core_db, args.packs_dir.resolve())
    print(f"[words] unique English words: {len(words)}", file=sys.stderr)

    if args.out:
        args.out.write_text("\n".join(words) + "\n", encoding="utf-8")
        print(f"[words] wrote {args.out}", file=sys.stderr)
    else:
        for w in words:
            print(w)


if __name__ == "__main__":
    main()
