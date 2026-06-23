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

ABBREVIATIONS = [
    "Mr", "Mrs", "Ms", "Dr", "Prof", "Sr", "Jr", "St", "No", "Vol",
    "vs", "etc", "approx", "ca", "fig", "ed", "trans", "Rev", "Gen",
    "Col", "Sgt", "Corp", "Inc", "Ltd", "Co", "Dept", "Univ",
]


# ---------------------------------------------------------------------------
# tts.text phonetics — Chatterbox can't be trusted with abbreviations,
# foreign loan words, or hyphens (they become ~1s pauses). Display text
# (text/text_markdown) keeps the real spelling. Only tts.text gets respelled.
#
# Hard rules:
#   - NEVER use a "-" between syllables. Chatterbox treats "-" as a ~1s pause.
#   - Use spaces between syllables, or write the word as a single phonetic
#     blob, whichever sounds right.
#   - Test by ear before adding to this map.
# ---------------------------------------------------------------------------

EN_PHONETICS = {
    # Acronyms — read as letters, not as words. ICE in particular would
    # otherwise be read as "ice" (the cold solid).
    "TGV":  "T G V",
    "ICE":  "I C E",
}

_ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
_TEENS = [
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
    "sixteen", "seventeen", "eighteen", "nineteen",
]
_TENS = [
    "", "", "twenty", "thirty", "forty", "fifty",
    "sixty", "seventy", "eighty", "ninety",
]
_DECADE_PLURAL = {
    "twenty": "twenties", "thirty": "thirties", "forty": "forties",
    "fifty": "fifties", "sixty": "sixties", "seventy": "seventies",
    "eighty": "eighties", "ninety": "nineties",
}
_CENTURY_WORD = {
    18: "eighteen", 19: "nineteen", 20: "twenty",
}


def _spell_two_digit(n: int) -> str:
    if n == 0:
        return "zero"
    if n < 10:
        return _ONES[n]
    if n < 20:
        return _TEENS[n - 10]
    tens, ones = divmod(n, 10)
    if ones == 0:
        return _TENS[tens]
    return f"{_TENS[tens]} {_ONES[ones]}"


def _spell_year(yyyy: str) -> str:
    n = int(yyyy)
    century, rest = divmod(n, 100)
    cw = _CENTURY_WORD.get(century)
    if cw is None:
        if 2000 <= n < 2010:
            return f"two thousand{'' if rest == 0 else ' ' + _spell_two_digit(rest)}"
        return yyyy
    if rest == 0:
        return f"{cw} hundred"
    if rest < 10:
        return f"{cw} oh {_ONES[rest]}"
    return f"{cw} {_spell_two_digit(rest)}"


def _spell_decade(prefix: str) -> str:
    n = int(prefix)
    century, rest = divmod(n, 100)
    cw = _CENTURY_WORD.get(century, str(century))
    if rest == 0:
        return f"{cw} hundreds"
    if rest < 20:
        teen = _TEENS[rest - 10]
        return f"{cw} {teen}s"
    tens = _TENS[rest // 10]
    return f"{cw} {_DECADE_PLURAL[tens]}"


def _spell_int(n: int) -> str:
    if n < 100:
        return _spell_two_digit(n)
    hundreds, rest = divmod(n, 100)
    head = f"{_ONES[hundreds]} hundred"
    if rest == 0:
        return head
    return f"{head} {_spell_two_digit(rest)}"


def apply_phonetics(text: str, phonetics: dict[str, str] | None = None) -> str:
    phonetics = phonetics or EN_PHONETICS
    out = text

    for key in sorted(phonetics.keys(), key=len, reverse=True):
        pattern = re.compile(rf"(?<![A-Za-z0-9]){re.escape(key)}(?![A-Za-z0-9])")
        out = pattern.sub(phonetics[key], out)

    out = re.sub(
        r"\b(1[89]\d{2}|20\d{2})s\b",
        lambda m: _spell_decade(m.group(1)),
        out,
    )

    out = re.sub(
        r"\b(1[789]\d{2}|20\d{2})\b",
        lambda m: _spell_year(m.group(1)),
        out,
    )

    out = re.sub(
        r"\b(\d{1,3})\b",
        lambda m: _spell_int(int(m.group(1))),
        out,
    )

    return out


def strip_markdown(text: str) -> str:
    text = re.sub(r"!\[.*?\]\(.*?\)", "", text)
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
        protected = re.sub(
            rf"\b{re.escape(abbr)}\.", abbr + "\x00", protected,
        )

    parts = re.split(r"(?<=[.!?])\s+", protected)

    sentences = [p.replace("\x00", ".").strip() for p in parts]
    return [s for s in sentences if s]


def compute_repetition_penalty(text: str) -> float:
    words = text.lower().split()
    if len(words) < 2:
        return 2.0
    unique_ratio = len(set(words)) / len(words)
    return round(1.2 + 0.8 * unique_ratio, 1)


def detect_heading(block: str):
    m = re.match(r"^(#{1,6})\s+(.*)", block)
    if m:
        return len(m.group(1)), m.group(2).strip()
    return None


def detect_image(block: str):
    return re.search(r"!\[(.*?)\]\((.*?)\)", block)


def detect_blockquote(block: str):
    if block.startswith("> "):
        return re.sub(r"^>\s?", "", block, flags=re.MULTILINE).strip()
    return None


def detect_list_items(block: str):
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
                items.append((current_type, current_item, idx))
                idx += 1
            current_item = ul.group(1)
            current_type = "unordered"
        elif ol:
            if current_item is not None:
                items.append((current_type, current_item, idx))
                idx += 1
            current_item = ol.group(2)
            current_type = "ordered"
        elif current_item is not None:
            current_item += " " + line.strip()
        else:
            return None

    if current_item is not None:
        items.append((current_type, current_item, idx))
    return items or None


def detect_code_block(block: str):
    m = re.match(r"^```(\w*)\n(.*?)```$", block, re.DOTALL)
    if m:
        return m.group(1) or "", m.group(2).strip()
    return None


def detect_hr(block: str) -> bool:
    s = block.strip()
    return bool(re.match(r"^-{3,}$", s) or re.match(r"^\*{3,}$", s))


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

    def _emit_sentences(
        block_md: str,
        pid: str,
        block_type: str,
        *,
        extra: dict | None = None,
    ) -> None:
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
            seg["tts"] = {
                "text": apply_phonetics(plain),
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

            if detect_hr(block):
                seg_counter += 1
                seg = {"id": _make_id(), **_base_fields(pid)}
                seg["block_type"] = "hr"
                seg["text"] = ""
                seg["text_markdown"] = ""
                segments.append(seg)
                continue

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
                    "repetition_penalty": 2.0,
                }
                segments.append(seg)
                remaining = re.sub(r"!\[.*?\]\(.*?\)", "", block).strip()
                if remaining:
                    _emit_sentences(remaining, pid, "text")
                continue

            bq_text = detect_blockquote(block)
            if bq_text:
                _emit_sentences(bq_text, pid, "blockquote")
                continue

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
                        "repetition_penalty": compute_repetition_penalty(plain),
                    }
                    segments.append(seg)
                continue

            _emit_sentences(block, pid, "text")

    return segments


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
        "book_id": "book_train_history",
        "total_segments": len(segments),
        "segments": segments,
    }

    print(json.dumps(output, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
