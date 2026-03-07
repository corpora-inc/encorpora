#!/usr/bin/env python3
"""
One-shot patch: fix TTS phonetic misspellings in alignment & manifest word entries.

The TTS pipeline uses phonetic spellings (e.g. "Oahaca" for "Oaxaca") to improve
pronunciation. Whisper alignment picks up these spellings in word entries, but the
display text (text/text_markdown) is correct. This script patches only the word
entries in alignment_*.json and audio_manifest_*.json.

Usage:
    python fix_tts_word_spellings.py          # dry-run (default)
    python fix_tts_word_spellings.py --apply  # write changes
"""

import json
import re
import sys
from pathlib import Path

PACK_DIR = (
    Path(__file__).resolve().parent.parent
    / "01-mystery-of-monte-alban"
    / "pack"
)

# TTS phonetic spelling → correct display spelling.
# Each key is the bare word (no punctuation). Replacement preserves any
# trailing punctuation from the original word entry.
TTS_WORD_CORRECTIONS = {
    # English
    "mahgay": "maguey",
    "chahpoolinehs": "chapulines",
    "molay": "mole",
    "jagwar": "jaguar",
    "Dahnsahntess": "Danzantes",
    "Meeshtek": "Mixtec",
    "Meeshteka": "Mixteca",
    "Sahpotek": "Zapotec",
    "ka": "か",
    "shan": "山",
    # Spanish
    "Oahaca": "Oaxaca",
    "oahaqueño": "oaxaqueño",
    "Oahaqueño": "Oaxaqueño",
    "oahaqueños": "oaxaqueños",
    "Teotiguacán": "Teotihuacán",
    "teotiguacana": "teotihuacana",
}


def strip_trailing_punct(word: str) -> tuple[str, str]:
    """Split a word into (base, trailing_punctuation).

    Examples:
        "Oahaca,"  → ("Oahaca", ",")
        "Oahaca."  → ("Oahaca", ".")
        "Oahaca—"  → ("Oahaca", "—")
        'Oahaqueño",' → ('Oahaqueño', '",')
        "hello"    → ("hello", "")
    """
    # Match trailing punctuation: period, comma, semicolon, colon, em-dash,
    # exclamation, question, quotes, etc.
    m = re.match(r'^(.+?)([\.\,\;\:\!\?\"\'\"\"\—\–]+)$', word)
    if m:
        return m.group(1), m.group(2)
    return word, ""


def fix_word(word: str) -> str | None:
    """If word (possibly with trailing punct) matches a TTS misspelling,
    return the corrected word. Otherwise return None (no change)."""
    base, punct = strip_trailing_punct(word)
    if base in TTS_WORD_CORRECTIONS:
        return TTS_WORD_CORRECTIONS[base] + punct
    return None


def patch_file(path: Path, dry_run: bool) -> int:
    """Patch word entries in a JSON file. Returns count of replacements."""
    with open(path) as f:
        data = json.load(f)

    count = 0

    # alignment files: {seg_id: {words: [{word, start_ms, end_ms}, ...]}}
    # manifest files:  {segments: {seg_id: {words: [{word, start_ms, end_ms}, ...]}}}
    if "segments" in data and isinstance(data["segments"], dict):
        # manifest format
        container = data["segments"]
    else:
        # alignment format (top-level keys are segment IDs)
        container = data

    for seg_id, seg_data in container.items():
        if not isinstance(seg_data, dict):
            continue
        words = seg_data.get("words", [])
        for entry in words:
            old = entry.get("word", "")
            fixed = fix_word(old)
            if fixed is not None:
                entry["word"] = fixed
                count += 1

    if count > 0 and not dry_run:
        tmp = path.with_suffix(".json.tmp")
        with open(tmp, "w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        tmp.replace(path)

    return count


def main():
    dry_run = "--apply" not in sys.argv

    if dry_run:
        print("DRY RUN — pass --apply to write changes\n")

    files = sorted(PACK_DIR.glob("alignment_*.json")) + sorted(
        PACK_DIR.glob("audio_manifest_*.json")
    )

    total = 0
    for path in files:
        count = patch_file(path, dry_run)
        status = "(would fix)" if dry_run else "(fixed)"
        if count:
            print(f"  {path.name}: {count} replacements {status}")
        else:
            print(f"  {path.name}: no changes")
        total += count

    action = "would fix" if dry_run else "fixed"
    print(f"\nTotal: {action} {total} word entries across {len(files)} files")


if __name__ == "__main__":
    main()
