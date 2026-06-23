#!/usr/bin/env python3
"""
Generate segments.json from Russian manuscript markdown for Tolstoy's
"Three Questions" (Три вопроса).

Adapted from the U10 soccer generate_segments.py for Russian-language
literary text. Splits at sentence boundaries with Russian-aware
abbreviation protection and em-dash dialogue handling.

Usage:
    python3 generate_segments.py [manuscript/three-questions.md]

Outputs segments.json to stdout.
"""

import json
import re
import sys
from pathlib import Path

BOOK_ID = "book_tolstoy_three_questions"

# Russian abbreviations whose trailing period should not trigger a sentence split.
RUSSIAN_ABBREVIATIONS = [
    "т.е", "т.д", "т.п", "и.т.д", "и.т.п",  # то есть, так далее, тому подобное
    "г", "гг",         # год, годы
    "в", "вв",         # век, века
    "н.э",             # нашей эры
    "ст", "см",        # статья, смотри
    "др", "пр",        # другие, прочие
    "т.н", "т.наз",    # так называемый
    "ок",              # около
    "рис", "табл",     # рисунок, таблица
    "стр",             # страница
]

# Russian digit words for TTS normalization
RUSSIAN_DIGIT_WORDS = {
    "0": "ноль",
    "1": "один",
    "2": "два",
    "3": "три",
    "4": "четыре",
    "5": "пять",
    "6": "шесть",
    "7": "семь",
    "8": "восемь",
    "9": "девять",
    "10": "десять",
}


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------

def compute_repetition_penalty(text: str) -> float:
    """Compute per-segment repetition_penalty based on word uniqueness.

    High-uniqueness text (all distinct words) gets a high penalty (2.0)
    to suppress model babble.  Text with intentional repetition gets a
    lower penalty so the model can naturally repeat words.

    Returns a value in [1.2, 2.0].
    """
    words = [w.lower().strip(".,!?;:'\"«»—") for w in text.split()]
    if len(words) <= 1:
        return 2.0
    unique_ratio = len(set(words)) / len(words)
    penalty = 1.2 + 0.8 * unique_ratio
    return round(min(2.0, max(1.2, penalty)), 2)


def strip_markdown(text: str) -> str:
    """Remove markdown inline formatting, returning plain text."""
    text = re.sub(r"!\[.*?\]\(.*?\)", "", text)          # images
    text = re.sub(r"\*{1,3}(.*?)\*{1,3}", r"\1", text)  # bold / italic
    text = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", text)      # links → text
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)  # headings
    text = re.sub(r"\s+", " ", text)                      # collapse whitespace
    return text.strip()


def normalize_tts_text(text: str) -> str:
    """Normalize text for Russian TTS.

    - Spell out standalone Arabic numerals as Russian words
    - Expand common abbreviations that confuse TTS
    - Preserve all other text as-is
    """
    result = text

    # Spell out standalone digits (1-10)
    for digit, word in sorted(RUSSIAN_DIGIT_WORDS.items(), key=lambda x: -len(x[0])):
        result = re.sub(rf"\b{digit}\b", word, result)

    return result


def check_tts_warnings(seg_id: str, text: str) -> list[str]:
    """Check for potential TTS issues in Russian text. Returns warning strings."""
    warnings = []

    # Check for remaining Arabic numerals
    if re.search(r"\d+", text):
        warnings.append(f"  WARNING {seg_id}: contains Arabic numerals: {text[:80]}")

    # Check for Latin characters (loan words, abbreviations)
    latin_matches = re.findall(r"[a-zA-Z]+", text)
    if latin_matches:
        warnings.append(
            f"  WARNING {seg_id}: contains Latin characters: {', '.join(latin_matches)} — {text[:80]}"
        )

    # Check for unusual Unicode
    if re.search(r"[^\u0000-\u007F\u0400-\u04FF\s.,!?;:'\"\-—–«»…()№]", text):
        warnings.append(f"  WARNING {seg_id}: contains unusual characters: {text[:80]}")

    return warnings


def split_sentences_russian(text: str) -> list[str]:
    """Split Russian text into sentences at sentence-ending punctuation.

    Handles:
    - Russian abbreviations (т.е., т.д., etc.)
    - Em-dash dialogue attribution merging (— Речь? — сказал он. → single segment)
    - Ellipsis protection (...)
    - Single-letter initials (Л. Н. Толстой)
    """
    if not text.strip():
        return []

    protected = text

    # Protect ellipsis
    protected = protected.replace("...", "\x01\x01\x01")

    # Protect single uppercase Cyrillic letter + period (initials)
    protected = re.sub(r"(?<=\s[А-ЯЁ])\.", "\x00", protected)
    protected = re.sub(r"(?<=[А-ЯЁ])\.(?=[А-ЯЁ])", "\x00", protected)

    # Protect Russian abbreviations
    for abbr in RUSSIAN_ABBREVIATIONS:
        escaped = re.escape(abbr)
        protected = re.sub(
            rf"\b{escaped}\.", abbr.replace(".", "\x00") + "\x00", protected,
        )

    # Split at sentence-ending punctuation followed by whitespace
    # and then an uppercase letter, opening quote, or em-dash
    parts = re.split(r"(?<=[.!?])\s+(?=[А-ЯЁ«—\"])", protected)

    # Restore protected characters
    sentences = []
    for p in parts:
        restored = p.replace("\x00", ".").replace("\x01\x01\x01", "...").strip()
        if restored:
            sentences.append(restored)

    # Merge dialogue attributions back into their speech
    # Pattern: a fragment starting with "— " + lowercase (attribution like "— сказал царь.")
    # should be merged with the preceding sentence
    merged = []
    for s in sentences:
        if (
            merged
            and s.startswith("—")
            and len(s) > 2
            and s[2:3].islower()
        ):
            # This is a dialogue attribution — merge with previous
            merged[-1] = merged[-1] + " " + s
        else:
            merged.append(s)

    return merged


# ---------------------------------------------------------------------------
# Main parser
# ---------------------------------------------------------------------------

def parse_manuscript(filepath: str) -> list[dict]:
    """Parse a Russian markdown manuscript into sentence-level segments."""
    segments: list[dict] = []
    current_chapter = 0
    current_chapter_title = ""
    seg_counter = 0
    para_counter = 0
    first_tts_emitted = False
    all_warnings: list[str] = []

    def _make_id() -> str:
        return f"ch{current_chapter:02d}-{seg_counter:03d}"

    def _base_fields(pid: str, sentence_index: int = 0) -> dict:
        return {
            "part": 0,
            "chapter": current_chapter,
            "title": current_chapter_title,
            "paragraph_id": pid,
            "sentence_index": sentence_index,
        }

    content = Path(filepath).read_text(encoding="utf-8")

    # Strip YAML frontmatter if present
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
        heading_match = re.match(r"^(#{1,6})\s+(.*)", block)
        if heading_match:
            level = len(heading_match.group(1))
            title = heading_match.group(2).strip()

            if level == 1:
                current_chapter += 1
                current_chapter_title = title

            seg_counter += 1
            seg = {"id": _make_id(), **_base_fields(pid)}
            seg["block_type"] = "heading"
            seg["heading_level"] = level
            seg["text"] = title
            seg["text_markdown"] = title
            # heading_level 1 = display only, no TTS (per pipeline convention)
            if level >= 2:
                seg["tts"] = {
                    "text": title,
                    "pause_after_ms": 1500,
                    "repetition_penalty": compute_repetition_penalty(title),
                }
            segments.append(seg)
            continue

        # ── Regular text paragraph ─────────────────────────────
        # Collapse internal line breaks (Tolstoy text is prose paragraphs)
        block_text = re.sub(r"\n", " ", block).strip()
        md_sentences = split_sentences_russian(block_text)

        n = len(md_sentences)
        for si, sentence in enumerate(md_sentences):
            seg_counter += 1
            plain = strip_markdown(sentence)
            tts_text = normalize_tts_text(plain)

            # Check for TTS warnings
            warnings = check_tts_warnings(_make_id(), tts_text)
            all_warnings.extend(warnings)

            is_last = si == n - 1
            if not first_tts_emitted:
                pause = 2000
                first_tts_emitted = True
            elif is_last:
                pause = 800
            else:
                pause = 500

            seg = {"id": _make_id(), **_base_fields(pid, si)}
            seg["block_type"] = "text"
            seg["text"] = plain
            seg["text_markdown"] = sentence

            tts_entry = {
                "text": tts_text,
                "pause_after_ms": pause,
                "repetition_penalty": compute_repetition_penalty(plain),
            }
            seg["tts"] = tts_entry
            segments.append(seg)

    # Print warnings to stderr
    if all_warnings:
        print(f"\n{'=' * 60}", file=sys.stderr)
        print(f"TTS WARNINGS ({len(all_warnings)}):", file=sys.stderr)
        print(f"{'=' * 60}", file=sys.stderr)
        for w in all_warnings:
            print(w, file=sys.stderr)
        print(file=sys.stderr)

    return segments


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    script_dir = Path(__file__).parent
    default_manuscript = script_dir.parent / "manuscript" / "three-questions.md"

    if len(sys.argv) >= 2:
        filepath = sys.argv[1]
    elif default_manuscript.exists():
        filepath = str(default_manuscript)
    else:
        print(
            "Usage: python3 generate_segments.py [manuscript/three-questions.md]",
            file=sys.stderr,
        )
        sys.exit(1)

    segments = parse_manuscript(filepath)

    output = {
        "version": "2.0.0",
        "book_id": BOOK_ID,
        "language": "ru",
        "total_segments": len(segments),
        "segments": segments,
    }

    print(json.dumps(output, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
