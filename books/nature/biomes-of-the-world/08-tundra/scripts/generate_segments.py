#!/usr/bin/env python3
"""Generate segments.json for a Biomes of the World book.

One sentence per paragraph, one paragraph per segment, single-H1 per
chapter. H1 headings are display-only (no `tts` field). No images,
blockquotes, lists, or code blocks in this series.

Usage:
    python3 generate_segments.py manuscript/00-*.md manuscript/01-*.md ...
"""

import json
import re
import sys
from pathlib import Path

ABBREVIATIONS = [
    "Mr", "Mrs", "Ms", "Dr", "Prof", "Sr", "Jr", "St", "vs", "etc",
]

BOOK_ID = "book_biomes_tundra"

PAUSE_FIRST = 700
PAUSE_LAST_OF_PARAGRAPH = 600
PAUSE_MID_PARAGRAPH = 400
PAUSE_CHAPTER_END = 1500


def compute_repetition_penalty(text: str) -> float:
    words = [w.lower().strip(".,!?;:'\"") for w in text.split()]
    if len(words) <= 1:
        return 2.0
    unique_ratio = len(set(words)) / len(words)
    penalty = 1.2 + 0.8 * unique_ratio
    return round(min(2.0, max(1.2, penalty)), 2)


def strip_markdown(text: str) -> str:
    text = re.sub(r"\*{1,3}(.*?)\*{1,3}", r"\1", text)
    text = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", text)
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def split_sentences(text: str) -> list[str]:
    if not text.strip():
        return []
    protected = text
    protected = re.sub(r"(?<=\s[A-Z])\.", "\x00", protected)
    protected = re.sub(r"(?<=[A-Z])\.(?=[A-Z])", "\x00", protected)
    for abbr in ABBREVIATIONS:
        protected = re.sub(rf"\b{re.escape(abbr)}\.", abbr + "\x00", protected)
    parts = re.split(r"(?<=[.!?])\s+", protected)
    return [p.replace("\x00", ".").strip() for p in parts if p.strip()]


def detect_heading(block: str):
    m = re.match(r"^(#{1,6})\s+(.*)", block)
    if m:
        return len(m.group(1)), m.group(2).strip()
    return None


def parse_manuscript(filepaths: list[str]) -> list[dict]:
    segments: list[dict] = []
    current_chapter = 0
    current_chapter_title = ""
    seg_counter = 0
    para_counter = 0
    first_tts_emitted = False

    # Walk all blocks first to know which paragraph closes each chapter.
    parsed: list[tuple[str, str]] = []  # (kind, raw_block) kind in {"heading","text"}
    for filepath in filepaths:
        content = Path(filepath).read_text(encoding="utf-8")
        if content.startswith("---"):
            end = content.find("---", 3)
            if end != -1:
                content = content[end + 3:].strip()
        for block in re.split(r"\n{2,}", content):
            block = block.strip()
            if not block:
                continue
            parsed.append((
                "heading" if detect_heading(block) else "text",
                block,
            ))

    # Index the last text-block index inside each chapter so we can mark
    # its final sentence as the chapter-end (longer pause).
    last_text_idx_in_chapter: dict[int, int] = {}
    chapter_idx = 0
    for i, (kind, _) in enumerate(parsed):
        if kind == "heading":
            chapter_idx += 1
        elif kind == "text":
            last_text_idx_in_chapter[chapter_idx] = i

    chapter_idx = 0
    for i, (kind, block) in enumerate(parsed):
        para_counter += 1
        pid = f"p{para_counter}"

        if kind == "heading":
            level, title = detect_heading(block)
            if level == 1:
                chapter_idx += 1
                current_chapter = chapter_idx
                current_chapter_title = title
            seg_counter += 1
            segments.append({
                "id": f"ch{current_chapter:02d}-{seg_counter:03d}",
                "chapter": current_chapter,
                "title": current_chapter_title,
                "paragraph_id": pid,
                "sentence_index": 0,
                "block_type": "heading",
                "heading_level": level,
                "text": title,
                "text_markdown": title,
            })
            continue

        # Regular text paragraph
        md_sentences = split_sentences(block)
        plain_sentences = [strip_markdown(s) for s in md_sentences]
        n = len(md_sentences)
        is_chapter_closing_paragraph = (i == last_text_idx_in_chapter.get(current_chapter))
        for si, (plain, md) in enumerate(zip(plain_sentences, md_sentences)):
            seg_counter += 1
            is_last_in_para = si == n - 1
            if not first_tts_emitted:
                pause = PAUSE_FIRST
                first_tts_emitted = True
            elif is_chapter_closing_paragraph and is_last_in_para:
                pause = PAUSE_CHAPTER_END
            elif is_last_in_para:
                pause = PAUSE_LAST_OF_PARAGRAPH
            else:
                pause = PAUSE_MID_PARAGRAPH
            segments.append({
                "id": f"ch{current_chapter:02d}-{seg_counter:03d}",
                "chapter": current_chapter,
                "title": current_chapter_title,
                "paragraph_id": pid,
                "sentence_index": si,
                "block_type": "text",
                "text": plain,
                "text_markdown": md,
                "tts": {
                    "text": plain,
                    "pause_after_ms": pause,
                    "repetition_penalty": compute_repetition_penalty(plain),
                },
            })

    return segments


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 generate_segments.py <markdown files...>", file=sys.stderr)
        sys.exit(1)
    segments = parse_manuscript(sys.argv[1:])
    print(json.dumps({
        "version": "2.0.0",
        "book_id": BOOK_ID,
        "total_segments": len(segments),
        "segments": segments,
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
