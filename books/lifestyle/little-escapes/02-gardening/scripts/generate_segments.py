#!/usr/bin/env python3
"""
Generate segments.json from manuscript markdown files.

Copied and minimally adapted from
encorpora/books/science/fascinating-science/001-what-is-an-atom/scripts/generate_segments.py
to keep all Little Escapes volumes consistent with Fascinating Science conventions:

  - h1 = chapter title (silent, display only)
  - h2+ = section heading (spoken with pause_after_ms 1500) — not used in this book
  - First TTS segment of the book gets pause_after_ms 2000
  - Last sentence of every paragraph gets pause_after_ms 800
  - Mid-paragraph sentences get pause_after_ms 500
  - Per-segment repetition_penalty in [1.2, 2.0] from word uniqueness

Sky-diving has no chemical formulas, so TTS_OVERRIDES is empty by default.

Usage:
    python3 generate_segments.py manuscript/01-*.md ... > segments.json
"""

import json
import re
import sys
from pathlib import Path

ABBREVIATIONS = [
    "Mr", "Mrs", "Ms", "Dr", "Prof", "Sr", "Jr", "St", "No", "Vol",
    "vs", "etc", "approx", "ca", "fig", "ed", "trans", "Rev", "Gen",
    "Col", "Sgt", "Corp", "Inc", "Ltd", "Co", "Dept", "Univ",
]

# Display text -> TTS spoken form. Empty for Sky-diving.
TTS_OVERRIDES: dict[str, str] = {}


def compute_repetition_penalty(text: str) -> float:
    words = [w.lower().strip(".,!?;:'\"") for w in text.split()]
    if len(words) <= 1:
        return 2.0
    unique_ratio = len(set(words)) / len(words)
    penalty = 1.2 + 0.8 * unique_ratio
    return round(min(2.0, max(1.2, penalty)), 2)


def strip_markdown(text: str) -> str:
    text = re.sub(r"!\[.*?\]\(.*?\)", "", text)
    text = re.sub(r"\*{1,3}(.*?)\*{1,3}", r"\1", text)
    text = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", text)
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def apply_tts_overrides(tts_text: str) -> str:
    for k, v in TTS_OVERRIDES.items():
        tts_text = tts_text.replace(k, v)
    return tts_text


def split_sentences(text: str) -> list[str]:
    if not text.strip():
        return []
    protected = text
    protected = re.sub(r"(?<=\s[A-Z])\.", "\x00", protected)
    protected = re.sub(r"(?<=[A-Z])\.(?=[A-Z])", "\x00", protected)
    for abbr in ABBREVIATIONS:
        protected = re.sub(rf"\b{re.escape(abbr)}\.", abbr + "\x00", protected)
    parts = re.split(r"(?<=[.!?])\s+", protected)
    sentences = [p.replace("\x00", ".").strip() for p in parts]
    return [s for s in sentences if s]


def detect_heading(block: str):
    m = re.match(r"^(#{1,6})\s+(.*)", block)
    if m:
        return len(m.group(1)), m.group(2).strip()
    return None


def parse_manuscript(filepaths: list[str]) -> list[dict]:
    segments: list[dict] = []
    current_part = 0
    current_chapter = 0
    current_chapter_title = ""
    seg_counter = 0
    para_counter = 0
    first_tts_emitted = False

    def _make_id() -> str:
        return f"ch{current_chapter:02d}-{seg_counter:03d}"

    def _base_fields(pid: str, sentence_index: int = 0) -> dict:
        return {
            "part": current_part,
            "chapter": current_chapter,
            "title": current_chapter_title,
            "paragraph_id": pid,
            "sentence_index": sentence_index,
        }

    def _emit_sentences(block_md: str, pid: str, block_type: str) -> None:
        nonlocal seg_counter, first_tts_emitted
        md_sentences = split_sentences(block_md)
        plain_sentences = [strip_markdown(s) for s in md_sentences]
        n = len(md_sentences)
        for si, (plain, md) in enumerate(zip(plain_sentences, md_sentences)):
            seg_counter += 1
            is_last = si == n - 1
            if not first_tts_emitted:
                pause = 2000
                first_tts_emitted = True
            elif is_last:
                pause = 800
            else:
                pause = 500
            seg: dict = {"id": _make_id(), **_base_fields(pid, si)}
            seg["block_type"] = block_type
            seg["text"] = plain
            seg["text_markdown"] = md
            seg["tts"] = {
                "text": apply_tts_overrides(plain),
                "pause_after_ms": pause,
                "repetition_penalty": compute_repetition_penalty(plain),
            }
            segments.append(seg)

    for filepath in filepaths:
        content = Path(filepath).read_text(encoding="utf-8")
        if content.startswith("---"):
            end = content.find("---", 3)
            if end != -1:
                content = content[end + 3:].strip()

        blocks = re.split(r"\n{2,}", content)

        for block in blocks:
            block = block.strip()
            if not block:
                continue

            para_counter += 1
            pid = f"p{para_counter}"

            heading = detect_heading(block)
            if heading:
                level, title = heading
                if level == 1:
                    current_chapter += 1
                    current_chapter_title = title

                seg_counter += 1
                seg = {"id": _make_id(), **_base_fields(pid)}
                seg["block_type"] = "heading"
                seg["heading_level"] = level
                seg["text"] = title
                seg["text_markdown"] = title
                if level >= 2:
                    seg["tts"] = {
                        "text": title,
                        "pause_after_ms": 1500,
                        "repetition_penalty": compute_repetition_penalty(title),
                    }
                segments.append(seg)
                continue

            _emit_sentences(block, pid, "text")

    return segments


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 generate_segments.py <markdown files...>", file=sys.stderr)
        sys.exit(1)

    filepaths = sys.argv[1:]
    segments = parse_manuscript(filepaths)

    output = {
        "version": "2.0.0",
        "book_id": "book_sky_diving",
        "total_segments": len(segments),
        "segments": segments,
    }
    print(json.dumps(output, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
