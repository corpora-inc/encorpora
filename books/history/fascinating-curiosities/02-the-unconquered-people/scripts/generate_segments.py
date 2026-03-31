#!/usr/bin/env python3
"""
Generate segments.json from manuscript markdown files.

Segments are split at sentence boundaries within paragraph blocks.
Each segment carries structural metadata (block_type, paragraph_id, etc.)
for reconstruction and flexible rendering.

Block types handled:
  text, heading, image, blockquote, list_item, code_block, hr

Usage:
    python3 generate_segments.py manuscript/00-frontmatter.md manuscript/01-*.md ...
"""

import json
import re
import sys
from pathlib import Path

# Abbreviations whose trailing period should not trigger a sentence split.
ABBREVIATIONS = [
    "Mr", "Mrs", "Ms", "Dr", "Prof", "Sr", "Jr", "St", "No", "Vol",
    "vs", "etc", "approx", "ca", "fig", "ed", "trans", "Rev", "Gen",
    "Col", "Sgt", "Corp", "Inc", "Ltd", "Co", "Dept", "Univ",
]


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------

def strip_markdown(text: str) -> str:
    """Remove markdown inline formatting, returning plain text."""
    text = re.sub(r"!\[.*?\]\(.*?\)", "", text)          # images
    text = re.sub(r"\*{1,3}(.*?)\*{1,3}", r"\1", text)  # bold / italic
    text = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", text)      # links → text
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)  # headings
    text = re.sub(r"\s+", " ", text)                      # collapse whitespace
    return text.strip()


def split_sentences(text: str) -> list[str]:
    """Split *text* into sentences at sentence-ending punctuation.

    Protects common abbreviations and single-letter initials so that
    ``Mr. Smith`` or ``Kent V. Flannery`` are not falsely split.
    """
    if not text.strip():
        return []

    protected = text

    # Protect single uppercase letter + period (middle initials: "V. Flannery")
    protected = re.sub(r"(?<=\s[A-Z])\.", "\x00", protected)
    # Protect abbreviation-style runs like "U.S.A."
    protected = re.sub(r"(?<=[A-Z])\.(?=[A-Z])", "\x00", protected)
    # Protect common abbreviations
    for abbr in ABBREVIATIONS:
        protected = re.sub(
            rf"\b{re.escape(abbr)}\.", abbr + "\x00", protected,
        )

    parts = re.split(r"(?<=[.!?])\s+", protected)

    sentences = [p.replace("\x00", ".").strip() for p in parts]
    return [s for s in sentences if s]


# ---------------------------------------------------------------------------
# Block-type detectors
# ---------------------------------------------------------------------------

def detect_heading(block: str):
    """Return ``(level, title)`` if *block* is a heading, else ``None``."""
    m = re.match(r"^(#{1,6})\s+(.*)", block)
    if m:
        return len(m.group(1)), m.group(2).strip()
    return None


def detect_image(block: str):
    """Return a ``re.Match`` if *block* contains an image reference."""
    return re.search(r"!\[(.*?)\]\((.*?)\)", block)


def detect_blockquote(block: str):
    """Return stripped text if *block* is a blockquote, else ``None``."""
    if block.startswith("> "):
        return re.sub(r"^>\s?", "", block, flags=re.MULTILINE).strip()
    return None


def detect_list_items(block: str):
    """Return ``[(list_type, text, index), ...]`` if *block* is a list."""
    lines = block.split("\n")
    items: list[tuple[str, str, int]] = []
    current_item = None
    current_type = None
    idx = 0

    for line in lines:
        ul = re.match(r"^[-*]\s+(.*)", line)
        ol = re.match(r"^(\d+)\.\s+(.*)", line)
        if ul:
            if current_item is not None:
                items.append((current_type, current_item, idx))  # type: ignore[arg-type]
                idx += 1
            current_item = ul.group(1)
            current_type = "unordered"
        elif ol:
            if current_item is not None:
                items.append((current_type, current_item, idx))  # type: ignore[arg-type]
                idx += 1
            current_item = ol.group(2)
            current_type = "ordered"
        elif current_item is not None:
            # continuation line
            current_item += " " + line.strip()
        else:
            return None  # not a list block

    if current_item is not None:
        items.append((current_type, current_item, idx))  # type: ignore[arg-type]
    return items or None


def detect_code_block(block: str):
    """Return ``(language, code)`` if *block* is a fenced code block."""
    m = re.match(r"^```(\w*)\n(.*?)```$", block, re.DOTALL)
    if m:
        return m.group(1) or "", m.group(2).strip()
    return None


def detect_hr(block: str) -> bool:
    """Return ``True`` if *block* is a horizontal rule."""
    s = block.strip()
    return bool(re.match(r"^-{3,}$", s) or re.match(r"^\*{3,}$", s))


# ---------------------------------------------------------------------------
# Main parser
# ---------------------------------------------------------------------------

def parse_manuscript(filepaths: list[str]) -> list[dict]:
    """Parse markdown files into sentence-level segments with metadata."""
    segments: list[dict] = []
    current_part = 0
    current_chapter = 0
    current_chapter_title = ""
    seg_counter = 0   # running segment counter (for IDs)
    para_counter = 0  # running paragraph/block counter
    first_tts_emitted = False  # track whether we've emitted the first TTS segment

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

    def _emit_sentences(
        block_md: str,
        pid: str,
        block_type: str,
        *,
        extra: dict | None = None,
    ) -> None:
        """Split *block_md* into sentences and emit one segment each."""
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
            if extra:
                seg.update(extra)
            seg["text"] = plain
            seg["text_markdown"] = md
            seg["tts"] = {"text": plain, "pause_after_ms": pause}
            segments.append(seg)

    for filepath in filepaths:
        content = Path(filepath).read_text(encoding="utf-8")

        # Strip YAML frontmatter
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

            # ── Heading ────────────────────────────────────────────
            heading = detect_heading(block)
            if heading:
                level, title = heading
                # Update tracking state
                if level == 1:
                    if re.match(r"Part\s+\w+:", title):
                        current_part += 1
                    current_chapter_title = title
                elif level == 2:
                    chapter_match = re.match(r"Chapter\s+(\d+)", title)
                    if chapter_match:
                        current_chapter = int(chapter_match.group(1))
                    current_chapter_title = title
                elif level == 3:
                    current_chapter_title = title

                seg_counter += 1
                seg = {"id": _make_id(), **_base_fields(pid)}
                seg["block_type"] = "heading"
                seg["heading_level"] = level
                seg["text"] = title
                seg["text_markdown"] = title
                segments.append(seg)
                continue

            # ── Horizontal rule ────────────────────────────────────
            if detect_hr(block):
                seg_counter += 1
                seg = {"id": _make_id(), **_base_fields(pid)}
                seg["block_type"] = "hr"
                seg["text"] = ""
                seg["text_markdown"] = ""
                segments.append(seg)
                continue

            # ── Fenced code block ──────────────────────────────────
            code = detect_code_block(block)
            if code:
                language, code_text = code
                seg_counter += 1
                seg = {"id": _make_id(), **_base_fields(pid)}
                seg["block_type"] = "code_block"
                seg["language"] = language
                seg["text"] = code_text
                seg["text_markdown"] = block
                segments.append(seg)
                continue

            # ── Image ──────────────────────────────────────────────
            img_match = detect_image(block)
            if img_match:
                seg_counter += 1
                seg = {"id": _make_id(), **_base_fields(pid)}
                seg["block_type"] = "image"
                seg["text"] = img_match.group(1)
                seg["text_markdown"] = block
                seg["image"] = img_match.group(2)
                seg["image_alt"] = img_match.group(1)
                seg["tts"] = {
                    "text": img_match.group(1),
                    "pause_after_ms": 1200,
                }
                segments.append(seg)
                # Text remaining after the image
                remaining = re.sub(r"!\[.*?\]\(.*?\)", "", block).strip()
                if remaining:
                    _emit_sentences(remaining, pid, "text")
                continue

            # ── Blockquote ─────────────────────────────────────────
            bq_text = detect_blockquote(block)
            if bq_text:
                _emit_sentences(bq_text, pid, "blockquote")
                continue

            # ── List items ─────────────────────────────────────────
            list_items = detect_list_items(block)
            if list_items:
                for list_type, item_text, list_idx in list_items:
                    seg_counter += 1
                    plain = strip_markdown(item_text)
                    seg = {"id": _make_id(), **_base_fields(pid, list_idx)}
                    seg["block_type"] = "list_item"
                    seg["list_type"] = list_type
                    seg["list_index"] = list_idx
                    seg["text"] = plain
                    seg["text_markdown"] = item_text
                    seg["tts"] = {
                        "text": plain,
                        "pause_after_ms": (
                            500 if list_idx < len(list_items) - 1 else 800
                        ),
                    }
                    segments.append(seg)
                continue

            # ── Regular text paragraph ─────────────────────────────
            _emit_sentences(block, pid, "text")

    return segments


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) < 2:
        print(
            "Usage: python3 generate_segments.py <markdown files...>",
            file=sys.stderr,
        )
        sys.exit(1)

    filepaths = sys.argv[1:]
    segments = parse_manuscript(filepaths)

    output = {
        "version": "2.0.0",
        "book_id": "book_the_unconquered_people",
        "total_segments": len(segments),
        "segments": segments,
    }

    print(json.dumps(output, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
