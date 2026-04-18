#!/usr/bin/env python3
"""
Generate segments.json from manuscript markdown files.

Each segment represents one "page" or scroll unit in the Corpan reader,
and one TTS chunk for autoplay. Segments are split at paragraph boundaries
(double newlines). Image references become segment break points.

Usage:
    python3 generate_segments.py manuscript/00-frontmatter.md manuscript/01-*.md ...
"""

import json
import re
import sys
from pathlib import Path


def clean_for_tts(text: str) -> str:
    """Remove markdown formatting and image refs for TTS."""
    # Remove image references
    text = re.sub(r"!\[.*?\]\(.*?\)", "", text)
    # Remove bold/italic markers
    text = re.sub(r"\*{1,3}(.*?)\*{1,3}", r"\1", text)
    # Remove links, keep text
    text = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", text)
    # Remove heading markers
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    # Clean up extra whitespace
    text = re.sub(r"\n{2,}", "\n\n", text)
    return text.strip()


def extract_title(line: str) -> str:
    """Extract title from a markdown heading line."""
    return re.sub(r"^#{1,6}\s+", "", line).strip()


def parse_manuscript(filepaths: list[str]) -> list[dict]:
    """Parse markdown files into segments."""
    segments = []
    current_part = 0
    current_chapter = 0
    current_chapter_title = ""
    segment_counter = 0

    for filepath in filepaths:
        content = Path(filepath).read_text(encoding="utf-8")

        # Strip YAML frontmatter
        if content.startswith("---"):
            end = content.find("---", 3)
            if end != -1:
                content = content[end + 3:].strip()

        # Split into blocks by double newline
        blocks = re.split(r"\n{2,}", content)

        for block in blocks:
            block = block.strip()
            if not block:
                continue

            # Detect part headings
            if re.match(r"^# Part \w+:", block) or re.match(r"^# ", block):
                title = extract_title(block)
                if "Part" in title:
                    current_part += 1
                    current_chapter_title = title
                else:
                    current_chapter_title = title
                continue

            # Detect chapter headings
            chapter_match = re.match(r"^## Chapter (\d+)", block)
            if chapter_match:
                current_chapter = int(chapter_match.group(1))
                current_chapter_title = extract_title(block)
                continue

            # Detect section headings (### level)
            if re.match(r"^###\s+", block):
                current_chapter_title = extract_title(block)
                continue

            # Detect image references
            img_match = re.search(r"!\[(.*?)\]\((.*?)\)", block)
            if img_match:
                segment_counter += 1
                segments.append({
                    "id": f"ch{current_chapter:02d}-{segment_counter:03d}",
                    "part": current_part,
                    "chapter": current_chapter,
                    "title": current_chapter_title,
                    "type": "image",
                    "image": img_match.group(2),
                    "image_alt": img_match.group(1),
                    "tts": {
                        "text": img_match.group(1),
                        "pause_after_ms": 1200,
                    },
                })
                # If block has text beyond the image, add it as a segment too
                remaining = re.sub(r"!\[.*?\]\(.*?\)", "", block).strip()
                if remaining:
                    segment_counter += 1
                    segments.append({
                        "id": f"ch{current_chapter:02d}-{segment_counter:03d}",
                        "part": current_part,
                        "chapter": current_chapter,
                        "title": current_chapter_title,
                        "text": remaining,
                        "tts": {
                            "text": clean_for_tts(remaining),
                            "pause_after_ms": 800,
                        },
                    })
                continue

            # Regular text paragraph
            segment_counter += 1
            pause = 2000 if segment_counter == 1 else 800
            segments.append({
                "id": f"ch{current_chapter:02d}-{segment_counter:03d}",
                "part": current_part,
                "chapter": current_chapter,
                "title": current_chapter_title,
                "text": block,
                "tts": {
                    "text": clean_for_tts(block),
                    "pause_after_ms": pause,
                },
            })

    return segments


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 generate_segments.py <markdown files...>", file=sys.stderr)
        sys.exit(1)

    filepaths = sys.argv[1:]
    segments = parse_manuscript(filepaths)

    output = {
        "version": "1.0.0",
        "book_id": "book_the_shadow_war_in_persia",
        "total_segments": len(segments),
        "segments": segments,
    }

    print(json.dumps(output, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
