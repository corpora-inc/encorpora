#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set, Tuple


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


def decode_char_from_stem(stem: str) -> Optional[str]:
    if len(stem) == 1 and is_hanzi(stem):
        return stem
    if stem.startswith("U+") and len(stem) > 2:
        try:
            return chr(int(stem[2:], 16))
        except ValueError:
            return None
    if all(c in "0123456789ABCDEFabcdef" for c in stem):
        try:
            return chr(int(stem, 16))
        except ValueError:
            return None
    return None


def normalize_entry(obj: dict, fallback_char: Optional[str]) -> Optional[Tuple[str, List, List]]:
    char = obj.get("char") or obj.get("character") or fallback_char
    strokes = obj.get("strokes")
    medians = obj.get("medians")
    if not isinstance(char, str):
        return None
    if not isinstance(strokes, list) or not isinstance(medians, list):
        return None
    return (char, strokes, medians)


def load_graphics_file(path: Path, allowed: Set[str]) -> Dict[str, dict]:
    out: Dict[str, dict] = {}
    with path.open("r", encoding="utf-8") as handle:
        first = handle.readline()
        if not first:
            return out
        handle.seek(0)
        if first.lstrip().startswith("["):
            items = json.load(handle)
            if not isinstance(items, list):
                return out
            for item in items:
                if not isinstance(item, dict):
                    continue
                entry = normalize_entry(item, None)
                if not entry:
                    continue
                char, strokes, medians = entry
                if char in allowed:
                    out[char] = {
                        "char": char,
                        "strokes": strokes,
                        "medians": medians,
                        "tags": ["imported"],
                    }
        else:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    item = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if not isinstance(item, dict):
                    continue
                entry = normalize_entry(item, None)
                if not entry:
                    continue
                char, strokes, medians = entry
                if char in allowed:
                    out[char] = {
                        "char": char,
                        "strokes": strokes,
                        "medians": medians,
                        "tags": ["imported"],
                    }
    return out


def load_directory(path: Path, allowed: Set[str]) -> Dict[str, dict]:
    candidates = ["graphics.txt", "graphics.jsonl", "graphics.json"]
    for name in candidates:
        candidate = path / name
        if candidate.exists():
            return load_graphics_file(candidate, allowed)

    out: Dict[str, dict] = {}
    for file in sorted(path.glob("*.json")):
        try:
            data = json.loads(file.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if not isinstance(data, dict):
            continue
        fallback_char = decode_char_from_stem(file.stem)
        entry = normalize_entry(data, fallback_char)
        if not entry:
            continue
        char, strokes, medians = entry
        if char not in allowed:
            continue
        out[char] = {
            "char": char,
            "strokes": strokes,
            "medians": medians,
            "tags": ["imported"],
        }
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--core-db",
        dest="core_db",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "release.sqlite3",
    )
    ap.add_argument(
        "--source",
        dest="source",
        type=Path,
        required=True,
        help="Path to a stroke dataset (directory or graphics.jsonl/graphics.txt)",
    )
    ap.add_argument(
        "--out",
        dest="out",
        type=Path,
        default=Path(__file__).parent / "seed" / "strokes_full.json",
    )
    ap.add_argument(
        "--langs",
        dest="langs",
        nargs="*",
        default=["zh-Hans", "zh-Hant"],
        help="Language codes to scan for characters in the core DB",
    )
    args = ap.parse_args()

    core_db = args.core_db.resolve()
    if not core_db.exists():
        print(f"Core DB not found: {core_db}", file=sys.stderr)
        sys.exit(1)

    source = args.source.resolve()
    if not source.exists():
        print(f"Stroke dataset not found: {source}", file=sys.stderr)
        sys.exit(1)

    allowed = collect_characters(core_db, args.langs)
    if source.is_dir():
        strokes = load_directory(source, allowed)
    else:
        strokes = load_graphics_file(source, allowed)

    out = args.out.resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    payload = [
        strokes[char] for char in sorted(strokes.keys())
    ]
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    missing = sorted(allowed - set(strokes.keys()))
    print(f"Imported strokes: {len(strokes)}")
    print(f"Missing strokes: {len(missing)}")
    print(f"Output: {out}")


if __name__ == "__main__":
    main()
