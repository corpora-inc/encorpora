#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set


SCHEMA_SQL = """
CREATE TABLE pack_meta(
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE hanzi_character(
  char TEXT PRIMARY KEY,
  pinyin TEXT,
  stroke_count INTEGER,
  radical TEXT,
  frequency INTEGER,
  tags_json TEXT
);

CREATE TABLE hanzi_writer(
  char TEXT PRIMARY KEY,
  data_json TEXT NOT NULL
);

CREATE TABLE hanzi_etymology(
  char TEXT NOT NULL,
  language_code TEXT NOT NULL,
  summary TEXT NOT NULL,
  PRIMARY KEY(char, language_code)
);

CREATE INDEX hanzi_etymology_language ON hanzi_etymology(language_code);
"""


def is_hanzi(ch: str) -> bool:
    code = ord(ch)
    return (
        0x3400 <= code <= 0x9FFF
        or 0xF900 <= code <= 0xFAFF
        or 0x20000 <= code <= 0x2FA1F
    )


def extract_hanzi(text: str) -> Iterable[str]:
    for ch in text:
        if is_hanzi(ch):
            yield ch


def load_json(path: Path) -> object:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def try_pinyin(char: str) -> str:
    try:
        from pypinyin import Style, lazy_pinyin  # type: ignore
    except Exception:
        return ""
    toks = lazy_pinyin(char, style=Style.TONE, strict=False, errors="default")
    return toks[0] if toks else ""


@dataclass
class StrokeRecord:
    char: str
    strokes: List[str]
    medians: List[List[List[float]]]
    radical: Optional[str] = None
    frequency: Optional[int] = None
    tags: Optional[List[str]] = None


def parse_strokes(raw: object) -> Dict[str, StrokeRecord]:
    if not isinstance(raw, list):
        return {}
    out: Dict[str, StrokeRecord] = {}
    for item in raw:
        if not isinstance(item, dict):
            continue
        char = item.get("char") or item.get("character")
        strokes = item.get("strokes")
        medians = item.get("medians")
        if not isinstance(char, str):
            continue
        if not isinstance(strokes, list) or not isinstance(medians, list):
            continue
        out[char] = StrokeRecord(
            char=char,
            strokes=strokes,
            medians=medians,
            radical=item.get("radical"),
            frequency=item.get("frequency"),
            tags=item.get("tags"),
        )
    return out


def parse_etymologies(raw: object) -> Dict[str, Dict[str, str]]:
    if not isinstance(raw, list):
        return {}
    out: Dict[str, Dict[str, str]] = {}
    for item in raw:
        if not isinstance(item, dict):
            continue
        char = item.get("char")
        ety = item.get("etymology")
        if not isinstance(char, str) or not isinstance(ety, dict):
            continue
        clean = {
            lang: text
            for lang, text in ety.items()
            if isinstance(lang, str) and isinstance(text, str) and text.strip()
        }
        if clean:
            out[char] = clean
    return out


def collect_characters(core_db: Path, langs: List[str]) -> Set[str]:
    conn = sqlite3.connect(f"file:{core_db}?mode=ro&immutable=1", uri=True)
    placeholders = ",".join(["?"] * len(langs))
    sql = f"""
        SELECT t.text
        FROM cor_translation t
        JOIN cor_language l ON l.id = t.language_id
        WHERE l.code IN ({placeholders})
    """
    chars: Set[str] = set()
    for (text,) in conn.execute(sql, langs):
        if not text:
            continue
        chars.update(extract_hanzi(text))
    conn.close()
    return chars


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--core-db",
        dest="core_db",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "release.sqlite3",
        help="Path to core release.sqlite3",
    )
    ap.add_argument(
        "--out",
        dest="out",
        type=Path,
        default=Path(__file__).resolve().parents[2]
        / "games"
        / "hanzi-atelier"
        / "data"
        / "hanzi.sqlite3",
    )
    ap.add_argument(
        "--strokes",
        dest="strokes",
        type=Path,
        default=Path(__file__).parent / "seed" / "strokes_seed.json",
    )
    ap.add_argument(
        "--etymology",
        dest="etymology",
        type=Path,
        default=Path(__file__).parent / "seed" / "etymology_seed.json",
    )
    ap.add_argument(
        "--lang",
        dest="langs",
        nargs="+",
        default=["zh-Hans", "zh-Hant"],
        help="Language codes to scan for characters in the core DB",
    )
    ap.add_argument(
        "--limit",
        dest="limit",
        type=int,
        default=0,
        help="Limit number of characters (0 = all)",
    )
    args = ap.parse_args()

    core_db = args.core_db.resolve()
    if not core_db.exists():
        print(f"Core DB not found: {core_db}", file=sys.stderr)
        sys.exit(1)

    chars = sorted(collect_characters(core_db, args.langs))
    if args.limit:
        chars = chars[: args.limit]

    strokes_raw = load_json(args.strokes)
    ety_raw = load_json(args.etymology)
    strokes = parse_strokes(strokes_raw)
    etymologies = parse_etymologies(ety_raw)

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
    meta_rows = [
        ("schema_version", "2"),
        ("generated_at", now),
        ("core_db", str(core_db)),
    ]
    conn.executemany("INSERT INTO pack_meta(key, value) VALUES(?, ?)", meta_rows)

    conn.execute("BEGIN")
    for ch in chars:
        stroke = strokes.get(ch)
        if stroke:
            stroke_count = len(stroke.strokes)
            radical = stroke.radical
            frequency = stroke.frequency
            tags_json = json.dumps(stroke.tags or [], ensure_ascii=False)
            writer_json = json.dumps(
                {
                    "character": ch,
                    "strokes": stroke.strokes,
                    "medians": stroke.medians,
                },
                ensure_ascii=False,
            )
        else:
            stroke_count = None
            radical = None
            frequency = None
            tags_json = json.dumps([], ensure_ascii=False)
            writer_json = json.dumps({}, ensure_ascii=False)

        conn.execute(
            """
            INSERT INTO hanzi_character(
              char, pinyin, stroke_count, radical, frequency, tags_json
            ) VALUES(?, ?, ?, ?, ?, ?)
            """,
            (
                ch,
                try_pinyin(ch),
                stroke_count,
                radical,
                frequency,
                tags_json,
            ),
        )
        conn.execute(
            "INSERT INTO hanzi_writer(char, data_json) VALUES(?, ?)",
            (ch, writer_json),
        )

        for lang, summary in etymologies.get(ch, {}).items():
            conn.execute(
                "INSERT INTO hanzi_etymology(char, language_code, summary) VALUES(?, ?, ?)",
                (ch, lang, summary),
            )
    conn.execute("COMMIT")

    conn.execute("ANALYZE;")
    conn.execute("PRAGMA optimize;")
    conn.execute("VACUUM;")
    conn.close()

    print("== Hanzi pack DB built ==")
    print(f"Characters: {len(chars)}")
    print(f"Output: {out}")


if __name__ == "__main__":
    main()
