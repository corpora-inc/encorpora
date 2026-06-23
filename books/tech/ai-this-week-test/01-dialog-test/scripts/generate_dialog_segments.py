#!/usr/bin/env python3
"""Generate segments.json for a dialog pack from a markdown script.

Markdown format:
  **NAME:** content       (one paragraph per dialog turn → one segment)
  ## Heading              (level-2 heading; emitted as heading segment,
                           never spoken in this test pack)

Speaker labels are case-insensitive on the markdown side (UPPERCASE by
convention). They map to lowercase speaker_id values that must exist in
the narration.yaml `speakers:` block.

Usage:
    python3 generate_dialog_segments.py <book_id> <markdown files...>
"""
import json
import re
import sys
from pathlib import Path

# Mapping from markdown speaker labels to narration.yaml speaker_ids.
SPEAKER_NAMES = {
    # Role-based labels (preferred for dialog packs)
    "HOST": "host",
    "ANALYST": "analyst",
    # Legacy character-name labels from earlier test passes
    "SKYLAR": "skylar",
    "VICTOR": "victor",
    "AOEDE": "aoede",
}

SPEAKER_LINE = re.compile(r"^\*\*([A-Z]+):\*\*\s+(.*)$", re.DOTALL)

# Gemini Director's Notes & inline-tag stripping for the DISPLAY-text path.
# tts.text keeps the full direction (Gemini consumes it verbatim). The
# reader shows the cleaned version. See:
#   /home/skyl/tmp/gemini-tts-eval/_tag_validation/REPORT.md  (validated syntax)
#   ~/.claude/projects/-home-skyl/memory/feedback_gemini_tts_tag_set.md
#     (canonical commonly-used tag list)
_STYLE_PREFIX_RE = re.compile(r"^Style:[^\n]*\n+", re.IGNORECASE)
_READTHIS_RE = re.compile(r"^\s*Read this:\s*", re.IGNORECASE)
_BRACKET_RE = re.compile(r"\[[^\]]*\]")
_WS_RE = re.compile(r"\s+")


def strip_direction(text: str) -> str:
    """Remove ``Style: ...`` prefix, ``Read this:`` label, and ``[...]`` tags.

    Returns the speakable content with whitespace collapsed. Use for the
    DISPLAY ``text`` field; the original is preserved in ``tts.text`` so
    Gemini sees the direction.
    """
    t = _STYLE_PREFIX_RE.sub("", text, count=1)
    t = _READTHIS_RE.sub("", t, count=1)
    t = _BRACKET_RE.sub("", t)
    return _WS_RE.sub(" ", t).strip()


def parse_dialog(filepaths: list[str], book_id: str) -> list[dict]:
    segments: list[dict] = []
    seg_counter = 0
    chapter = 0
    chapter_title = ""
    first_tts_emitted = False

    for filepath in filepaths:
        text = Path(filepath).read_text(encoding="utf-8")
        # Strip YAML frontmatter
        if text.startswith("---"):
            end = text.find("---", 3)
            if end != -1:
                text = text[end + 3:].strip()

        blocks = re.split(r"\n{2,}", text)
        for block in blocks:
            block = block.strip()
            if not block:
                continue

            # Heading
            h = re.match(r"^(#{1,6})\s+(.*)$", block, re.DOTALL)
            if h:
                level = len(h.group(1))
                title = h.group(2).strip()
                if level == 2:
                    chapter += 1
                    chapter_title = title
                seg_counter += 1
                segments.append({
                    "id": f"ch{chapter:02d}-{seg_counter:03d}",
                    "chapter": chapter,
                    "title": chapter_title,
                    "block_type": "heading",
                    "heading_level": level,
                    "text": title,
                    "text_markdown": title,
                })
                continue

            # Dialog turn
            m = SPEAKER_LINE.match(block)
            if not m:
                continue  # silently skip non-dialog text

            speaker_label = m.group(1)
            content = m.group(2).strip()
            speaker_id = SPEAKER_NAMES.get(speaker_label)
            if speaker_id is None:
                raise SystemExit(
                    f"unknown speaker label {speaker_label!r} in {filepath} — "
                    f"expected one of {sorted(SPEAKER_NAMES)}"
                )

            seg_counter += 1
            pause = 2000 if not first_tts_emitted else 600
            first_tts_emitted = True

            display = strip_direction(content)

            segments.append({
                "id": f"ch{chapter:02d}-{seg_counter:03d}",
                "chapter": chapter,
                "title": chapter_title,
                "block_type": "text",
                "speaker_id": speaker_id,
                "text": display,
                "text_markdown": display,
                "tts": {
                    "text": content,
                    "pause_after_ms": pause,
                    "speaker_id": speaker_id,
                    "repetition_penalty": 2.0,
                },
            })

    return segments


def main() -> None:
    if len(sys.argv) < 3:
        print(
            "Usage: python3 generate_dialog_segments.py <book_id> <markdown files...>",
            file=sys.stderr,
        )
        sys.exit(1)

    book_id = sys.argv[1]
    filepaths = sys.argv[2:]
    segments = parse_dialog(filepaths, book_id)

    output = {
        "version": "2.0.0",
        "book_id": book_id,
        "format": "dialog",
        "total_segments": len(segments),
        "segments": segments,
    }
    print(json.dumps(output, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
