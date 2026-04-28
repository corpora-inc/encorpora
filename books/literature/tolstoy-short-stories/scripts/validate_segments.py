#!/usr/bin/env python3
"""Pre-generation segment validation.

Run BEFORE ttsctl generate to catch segmentation and translation issues
that would waste GPU time or produce bad audio.

Usage:
    python3 validate_segments.py /path/to/pack
"""

import json
import re
import sys
from pathlib import Path

ROMAN = {"I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"}


def validate_pack(pack_dir: Path) -> int:
    """Validate all segment files in a pack. Returns error count."""
    errors = 0
    warnings = 0

    # Load source segments
    src_path = pack_dir / "segments.json"
    if not src_path.exists():
        print(f"FAIL: segments.json not found in {pack_dir}")
        return 1

    with open(src_path) as f:
        src = json.load(f)

    src_ids = [s["id"] for s in src["segments"]]
    src_count = len(src_ids)
    print(f"Source: {src_count} segments")

    # Check all segment files
    all_files = [src_path] + sorted(pack_dir.glob("segments_*.json"))

    for seg_file in all_files:
        lang = seg_file.stem.replace("segments_", "").replace("segments", "PRIMARY")
        with open(seg_file) as f:
            d = json.load(f)

        segs = d["segments"]
        lang_ids = [s["id"] for s in segs]

        # 1. Segment count alignment
        if lang_ids != src_ids:
            print(f"  FAIL [{lang}]: segment IDs don't match source ({len(lang_ids)} vs {src_count})")
            errors += 1
            continue

        # Per-segment checks
        for s in segs:
            sid = s["id"]
            text = s.get("text", "")
            tts_text = s.get("tts", {}).get("text", "")

            # 2. Empty text
            if not text.strip():
                if s.get("block_type") != "hr":
                    print(f"  FAIL [{lang}] {sid}: empty text")
                    errors += 1

            # 3. Empty tts.text (when tts field exists)
            if "tts" in s and not tts_text.strip():
                print(f"  FAIL [{lang}] {sid}: empty tts.text")
                errors += 1

            # 4. Arabic digits in tts.text
            if tts_text and re.search(r"\d", tts_text):
                print(f"  FAIL [{lang}] {sid}: digits in tts.text: {tts_text[:60]}")
                errors += 1

            # 5. Standalone Roman numerals in tts.text
            if tts_text:
                words = tts_text.split()
                for w in words:
                    clean = w.strip(".,;:!?()\"'«»")
                    if clean in ROMAN and len(words) < 5:
                        print(f"  WARN [{lang}] {sid}: Roman numeral '{clean}' in short tts.text: {tts_text[:60]}")
                        warnings += 1
                        break

            # 6. Very short segments (likely split artifacts)
            if text and len(text.strip()) < 3 and s.get("block_type") == "text":
                print(f"  WARN [{lang}] {sid}: very short text ({len(text)} chars): '{text}'")
                warnings += 1

            # 7. Double periods
            if tts_text and ".." in tts_text and "..." not in tts_text:
                print(f"  WARN [{lang}] {sid}: double period in tts.text: ...{tts_text[-30:]}")
                warnings += 1

    print(f"\nResult: {errors} errors, {warnings} warnings")
    if errors:
        print("FIX ERRORS BEFORE GENERATING TTS.")
    return errors


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 validate_segments.py /path/to/pack", file=sys.stderr)
        sys.exit(1)
    pack = Path(sys.argv[1])
    errors = validate_pack(pack)
    sys.exit(1 if errors else 0)
