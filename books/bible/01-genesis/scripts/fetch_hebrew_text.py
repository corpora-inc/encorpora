#!/usr/bin/env python3
"""Fetch vocalized Hebrew text of Genesis from Sefaria API and build segments.json.

Sefaria returns Masoretic Hebrew text with:
  - Nikud (vowel points, U+05B0-U+05C7) — KEEP for TTS
  - Cantillation marks (trope, U+0591-U+05AF) — STRIP
  - HTML tags (<big>, <small>, etc.) — STRIP
  - Maqaf (U+05BE, Hebrew hyphen) — REPLACE with space
  - Pasek (U+05C0) — REMOVE
  - Sof pasuq (U+05C3, ׃) — REMOVE for TTS

YHWH (יהוה) is replaced with Adonai (אֲדֹנָי) in tts.text only.

Output: segments.json in v2.0.0 format (Hebrew is primary_language).
"""

import html
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

# Cantillation marks (trope) — strip for TTS
_CANTILLATION = re.compile("[\u0591-\u05AF]")
# HTML tags
_HTML_TAGS = re.compile(r"<[^>]+>")
# Maqaf (Hebrew hyphen)
_MAQAF = "\u05BE"
# Pasek
_PASEK = "\u05C0"
# Sof pasuq (end of verse)
_SOF_PASUQ = "\u05C3"
# Tetragrammaton
_YHWH = "יהוה"
_ADONAI = "אֲדֹנָי"

# Parashah markers like {פ} {ס} — editorial, not read aloud
_PARASHAH = re.compile(r"\{[פסנ]\}")


def _clean_hebrew(text: str) -> str:
    """Clean Hebrew text for display: strip HTML, entities, cantillation."""
    text = _HTML_TAGS.sub("", text)
    text = html.unescape(text)  # &thinsp; &nbsp; etc.
    text = _CANTILLATION.sub("", text)
    text = _PARASHAH.sub("", text)
    text = text.replace(_MAQAF, " ")
    text = text.replace(_PASEK, "")
    text = text.replace(_SOF_PASUQ, "")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _tts_text(text: str) -> str:
    """Prepare Hebrew text for TTS: clean + YHWH → Adonai."""
    cleaned = _clean_hebrew(text)
    return cleaned.replace(_YHWH, _ADONAI)


def fetch_chapter(chapter: int) -> list[str]:
    """Fetch one chapter from Sefaria API. Returns list of verse texts."""
    url = f"https://www.sefaria.org/api/v3/texts/Genesis.{chapter}?version=hebrew"
    req = urllib.request.Request(url, headers={"User-Agent": "ttsctl-genesis-fetcher/1.0"})

    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read())
            # Find the Hebrew version
            for version in data.get("versions", []):
                if version.get("language") == "he":
                    return version.get("text", [])
            print(f"  WARNING: No Hebrew version found for chapter {chapter}")
            return []
        except Exception as e:
            if attempt < 2:
                print(f"  Retry {attempt + 1} for chapter {chapter}: {e}")
                time.sleep(2)
            else:
                raise RuntimeError(f"Failed to fetch chapter {chapter}: {e}")


def build_segments(all_chapters: dict[int, list[str]]) -> list[dict]:
    """Build segments list from fetched chapter data."""
    segments = []
    part = 1

    for chapter in sorted(all_chapters.keys()):
        verses = all_chapters[chapter]

        # Chapter heading segment
        heading_id = f"ch{chapter:02d}-000"
        title = f"פרק {chapter}"
        segments.append({
            "id": heading_id,
            "part": part,
            "chapter": chapter,
            "title": title,
            "paragraph_id": f"ch{chapter}",
            "sentence_index": 0,
            "block_type": "heading",
            "text": title,
            "text_markdown": f"## {title}",
            "tts": {
                "text": title,
                "pause_after_ms": 3000,
            },
        })

        # Verse segments
        for verse_idx, verse_text in enumerate(verses, start=1):
            seg_id = f"ch{chapter:02d}-{verse_idx:03d}"
            display_text = _clean_hebrew(verse_text)
            tts = _tts_text(verse_text)

            # Pause: longer at chapter ends, paragraph breaks
            if verse_idx == len(verses):
                pause = 3000  # chapter end
            else:
                pause = 800  # normal verse

            segments.append({
                "id": seg_id,
                "part": part,
                "chapter": chapter,
                "title": f"פרק {chapter}",
                "paragraph_id": f"v{verse_idx}",
                "sentence_index": 0,
                "block_type": "text",
                "text": display_text,
                "text_markdown": display_text,
                "tts": {
                    "text": tts,
                    "pause_after_ms": pause,
                },
            })

        # Increment part every ~5 chapters
        if chapter % 5 == 0:
            part += 1

    return segments


def main():
    pack_dir = Path("/home/skyl/encorpora/books/bible/01-genesis/pack")

    print("Fetching Genesis from Sefaria API...")
    all_chapters: dict[int, list[str]] = {}

    for chapter in range(1, 51):
        verses = fetch_chapter(chapter)
        all_chapters[chapter] = verses
        print(f"  Chapter {chapter:2d}: {len(verses)} verses")
        time.sleep(0.5)  # Be polite to the API

    # Count total verses
    total_verses = sum(len(v) for v in all_chapters.values())
    print(f"\nTotal: {total_verses} verses across 50 chapters")

    # Build segments
    segments = build_segments(all_chapters)
    print(f"Built {len(segments)} segments ({total_verses} verses + 50 headings)")

    # Validate: no cantillation marks in TTS text
    bad = []
    for seg in segments:
        tts_text = seg.get("tts", {}).get("text", "")
        if re.search("[\u0591-\u05AF]", tts_text):
            bad.append(seg["id"])
    if bad:
        print(f"ERROR: {len(bad)} segments still have cantillation marks!")
        sys.exit(1)
    print("Validation: no cantillation marks in TTS text ✓")

    # Validate: no YHWH in TTS text
    yhwh_segs = [s["id"] for s in segments if _YHWH in s.get("tts", {}).get("text", "")]
    if yhwh_segs:
        print(f"ERROR: {len(yhwh_segs)} segments still have YHWH in TTS text!")
        sys.exit(1)
    print("Validation: YHWH → Adonai substitution complete ✓")

    # Write segments.json
    output = {
        "version": "2.0.0",
        "source": "Sefaria API — Miqra according to the Masorah",
        "language": "he",
        "segments": segments,
    }

    output_path = pack_dir / "segments.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"\nWrote {output_path} ({len(segments)} segments)")


if __name__ == "__main__":
    main()
