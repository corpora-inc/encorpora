#!/usr/bin/env python3
"""
Normalize English tts.text fields in segments.json for Chatterbox TTS.

Expands Arabic numerals, Roman numerals, tildes, and other non-verbal
tokens into speakable English. Only modifies tts.text -- leaves text
and text_markdown unchanged.

Usage:
    python normalize_tts_en.py                    # apply changes
    python normalize_tts_en.py --dry-run           # preview without writing
    python normalize_tts_en.py --report            # save JSON change log
    python normalize_tts_en.py --dry-run --report  # preview + report
"""

import json
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
SEGMENTS_PATH = (
    SCRIPT_DIR.parent
    / "01-mystery-of-monte-alban"
    / "pack"
    / "segments.json"
)

# ---------------------------------------------------------------------------
# Pronunciation map (empty for now -- no tested substitutions for English yet)
# ---------------------------------------------------------------------------

PRONUNCIATION_MAP: list[tuple[str, str]] = []

# ---------------------------------------------------------------------------
# Manual TTS rewrites for segments needing structural simplification
# ---------------------------------------------------------------------------

MANUAL_TTS_REWRITES: dict[str, str] = {}

# ---------------------------------------------------------------------------
# Number-to-words engine
# ---------------------------------------------------------------------------

ONES = [
    "", "one", "two", "three", "four", "five", "six", "seven",
    "eight", "nine", "ten", "eleven", "twelve", "thirteen",
    "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
]

TENS = [
    "", "", "twenty", "thirty", "forty", "fifty",
    "sixty", "seventy", "eighty", "ninety",
]

ORDINAL_ONES = [
    "", "first", "second", "third", "fourth", "fifth", "sixth", "seventh",
    "eighth", "ninth", "tenth", "eleventh", "twelfth", "thirteenth",
    "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth",
    "nineteenth",
]

ORDINAL_TENS = [
    "", "", "twentieth", "thirtieth", "fortieth", "fiftieth",
    "sixtieth", "seventieth", "eightieth", "ninetieth",
]


def int_to_words(n: int) -> str:
    """Convert integer to English words (quantity reading)."""
    if n == 0:
        return "zero"
    if n < 0:
        return "negative " + int_to_words(-n)

    parts: list[str] = []

    if n >= 1_000_000:
        parts.append(int_to_words(n // 1_000_000) + " million")
        n %= 1_000_000

    if n >= 1_000:
        parts.append(int_to_words(n // 1_000) + " thousand")
        n %= 1_000

    if n >= 100:
        parts.append(ONES[n // 100] + " hundred")
        n %= 100

    if n >= 20:
        word = TENS[n // 10]
        if n % 10:
            word += " " + ONES[n % 10]
        parts.append(word)
    elif n > 0:
        parts.append(ONES[n])

    return " ".join(parts)


def year_to_words(n: int) -> str:
    """Convert a number to English year reading.

    1932 -> nineteen thirty two
    1500 -> fifteen hundred
    2018 -> twenty eighteen
    500  -> five hundred (falls through to int_to_words for < 1100)
    """
    if n < 1100:
        return int_to_words(n)

    hi = n // 100
    lo = n % 100

    if lo == 0:
        return int_to_words(hi) + " hundred"

    # 2000-2009: "two thousand one" etc.
    if 2000 <= n <= 2009:
        return "two thousand " + ONES[lo]

    # Single-digit remainder: "nineteen oh two"
    if lo < 10:
        return int_to_words(hi) + " oh " + ONES[lo]

    # General: "nineteen thirty two", "fifteen twenty one"
    return int_to_words(hi) + " " + int_to_words(lo)


def ordinal_to_words(n: int) -> str:
    """Convert integer to English ordinal words. e.g. 9 -> ninth."""
    if n < 20:
        return ORDINAL_ONES[n]
    if n < 100 and n % 10 == 0:
        return ORDINAL_TENS[n // 10]
    if n < 100:
        return TENS[n // 10] + " " + ORDINAL_ONES[n % 10]
    # For larger numbers, append "th" heuristic
    words = int_to_words(n)
    if words.endswith("y"):
        return words[:-1] + "ieth"
    return words + "th"


# ---------------------------------------------------------------------------
# Roman numerals
# ---------------------------------------------------------------------------

ROMAN_VALUES = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100}


def roman_to_int(s: str) -> int:
    total = 0
    prev = 0
    for ch in reversed(s.upper()):
        val = ROMAN_VALUES.get(ch, 0)
        if val < prev:
            total -= val
        else:
            total += val
        prev = val
    return total


# ---------------------------------------------------------------------------
# Letter pronunciation map (for building designations)
# ---------------------------------------------------------------------------

LETTER_NAMES = {
    "A": "Ay", "B": "Bee", "C": "See", "D": "Dee", "E": "Ee",
    "F": "Eff", "G": "Jee", "H": "Aitch", "I": "Eye", "J": "Jay",
    "K": "Kay", "L": "El", "M": "Em", "N": "En", "O": "Oh",
    "P": "Pee", "Q": "Cue", "R": "Ar", "S": "Ess", "T": "Tee",
    "U": "You", "V": "Vee", "W": "Double You", "X": "Ex", "Y": "Why",
    "Z": "Zee",
}

# ---------------------------------------------------------------------------
# Decade pluralization
# ---------------------------------------------------------------------------

DECADE_PLURAL = {
    "twenty": "twenties", "thirty": "thirties", "forty": "forties",
    "fifty": "fifties", "sixty": "sixties", "seventy": "seventies",
    "eighty": "eighties", "ninety": "nineties",
    "ten": "tens", "hundred": "hundreds",
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

MONTHS = (
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
)


def _parse_num(s: str) -> int:
    """Parse a number string that may contain commas."""
    return int(s.replace(",", ""))


def _num_to_words_era(n: int) -> str:
    """Use year reading for numbers >= 1100, else quantity reading."""
    if n >= 1100:
        return year_to_words(n)
    return int_to_words(n)


# ---------------------------------------------------------------------------
# Conversion rules
# ---------------------------------------------------------------------------

def convert_numbers_in_text(text: str) -> str:
    """Apply all normalization rules in order."""

    # Rule 1: Tilde + range  ~300-500
    def replace_tilde_range(m):
        a = _parse_num(m.group(1))
        b = _parse_num(m.group(2))
        return "approximately " + int_to_words(a) + " to " + int_to_words(b)

    text = re.sub(r"~(\d[\d,]*)\s*[-\u2013]\s*(\d[\d,]*)", replace_tilde_range, text)

    # Rule 2: Tilde standalone  ~500
    def replace_tilde(m):
        n = _parse_num(m.group(1))
        return "approximately " + int_to_words(n)

    text = re.sub(r"~(\d[\d,]*)", replace_tilde, text)

    # Rule 3: Number ranges with en-dash/hyphen  500-100 BCE, 1896-1970
    # Negative lookahead (?![a-zA-Z]) prevents matching 260-day
    def replace_range(m):
        a = _parse_num(m.group(1))
        a_era = (m.group(2) or "").strip()
        b = _parse_num(m.group(3))
        b_era = (m.group(4) or "").strip()

        has_era = bool(a_era or b_era)

        if has_era:
            a_w = _num_to_words_era(a)
            b_w = _num_to_words_era(b)
        elif a >= 1100 and b >= 1100:
            a_w = year_to_words(a)
            b_w = year_to_words(b)
        else:
            a_w = int_to_words(a)
            b_w = int_to_words(b)

        result = a_w
        if a_era:
            result += " " + a_era
        result += " to "
        result += b_w
        if b_era:
            result += " " + b_era
        return result

    text = re.sub(
        r"(\d[\d,]*)\s*(BCE\b)?\s*[-\u2013](?![a-zA-Z])\s*(\d[\d,]*)\s*((?:BCE|CE)\b)?",
        replace_range,
        text,
    )

    # Rule 4: Decades  1930s -> nineteen thirties
    def replace_decade(m):
        n = int(m.group(1))
        words = year_to_words(n)
        last_word = words.rsplit(" ", 1)[-1]
        plural = DECADE_PLURAL.get(last_word, last_word + "s")
        prefix = words.rsplit(" ", 1)[0] if " " in words else ""
        if prefix:
            return prefix + " " + plural
        return plural

    text = re.sub(r"\b(\d{4})s\b", replace_decade, text)

    # Rule 5: Full dates  January 9, 1932
    def replace_full_date(m):
        month = m.group(1)
        day = int(m.group(2))
        year = int(m.group(3))
        return month + " " + ordinal_to_words(day) + ", " + year_to_words(year)

    months_pat = "|".join(MONTHS)
    text = re.sub(
        rf"\b({months_pat})\s+(\d{{1,2}}),\s*(\d{{4}})",
        replace_full_date,
        text,
    )

    # Rule 6: Year + era marker  1500 BCE, 500 CE
    def replace_year_era(m):
        n = _parse_num(m.group(1))
        era = m.group(2)
        return _num_to_words_era(n) + " " + era

    text = re.sub(r"\b(\d[\d,]*)\s+(BCE|CE)\b", replace_year_era, text)

    # Rule 7: Roman numerals after Period/Phase
    def replace_roman(m):
        prefix = m.group(1)
        roman = m.group(2)
        letter = (m.group(3) or "").strip()
        n = roman_to_int(roman)
        result = prefix + " " + int_to_words(n)
        if letter:
            result += " " + letter.upper()
        return result

    text = re.sub(
        r"\b(Period|Phase)\s+([IVXLCivxlc]+)([ABab]?)\b",
        replace_roman,
        text,
    )

    # Rule 8: Building letter designations  Building J -> Building Jay
    def replace_building_letter(m):
        prefix = m.group(1)
        letter = m.group(2)
        return prefix + " " + LETTER_NAMES.get(letter, letter)

    text = re.sub(
        r"\b(Building|Structure|Monument|System|Mound)\s+([A-Z])\b",
        replace_building_letter,
        text,
    )

    # Rule 9: Unit abbreviations  400 m -> four hundred meters
    def replace_units(m):
        n = _parse_num(m.group(1))
        unit = m.group(2)
        unit_word = {"m": "meters", "km": "kilometers"}[unit]
        return int_to_words(n) + " " + unit_word

    text = re.sub(r"\b(\d[\d,]*)\s*(km|m)\b", replace_units, text)

    # Rule 10: No. N -> Number N
    def replace_no(m):
        n = int(m.group(1))
        return "Number " + int_to_words(n)

    text = re.sub(r"\bNo\.\s*(\d+)", replace_no, text)

    # Rule 11: Ordinals  7th -> seventh
    def replace_ordinal(m):
        n = int(m.group(1))
        return ordinal_to_words(n)

    text = re.sub(r"\b(\d+)(?:st|nd|rd|th)\b", replace_ordinal, text)

    # Rule 12: Comma-formatted numbers  2,500 -> two thousand five hundred
    def replace_comma_num(m):
        n = _parse_num(m.group(0))
        return int_to_words(n)

    text = re.sub(r"\b\d{1,3}(?:,\d{3})+\b", replace_comma_num, text)

    # Rule 13: Hyphenated number-word compounds  260-day -> two hundred sixty day
    def replace_hyphen_compound(m):
        n = int(m.group(1))
        word = m.group(2)
        return int_to_words(n) + " " + word

    text = re.sub(r"\b(\d+)-(day|year|minute|hour|foot|feet|meter|mile)\b", replace_hyphen_compound, text)

    # Rule 14: Standalone 4-digit years (remaining)
    def replace_4digit(m):
        n = int(m.group(0))
        return year_to_words(n)

    text = re.sub(r"\b\d{4}\b", replace_4digit, text)

    # Rule 15: Catch-all bare integers
    def replace_remaining(m):
        n = int(m.group(0))
        return int_to_words(n)

    text = re.sub(r"\b\d+\b", replace_remaining, text)

    # Apply pronunciation map
    for old, new in PRONUNCIATION_MAP:
        text = text.replace(old, new)

    return text


# ---------------------------------------------------------------------------
# Detection
# ---------------------------------------------------------------------------

def needs_normalization(text: str) -> bool:
    """Return True if text contains tokens that need TTS normalization."""
    if re.search(r"\d", text):
        return True
    if "~" in text:
        return True
    if re.search(r"\b(?:Period|Phase)\s+[IVXivx]", text):
        return True
    if re.search(r"\bBuilding\s+[A-Z]\b", text):
        return True
    return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    dry_run = "--dry-run" in sys.argv
    save_report = "--report" in sys.argv

    if dry_run:
        print("DRY RUN -- no files will be modified\n")

    with open(SEGMENTS_PATH, "r") as f:
        data = json.load(f)

    changed = 0
    changes: list[dict] = []

    for seg in data["segments"]:
        tts = seg.get("tts")
        if not tts:
            continue
        old_text = tts.get("text", "")
        if not old_text:
            continue

        seg_id = seg["id"]

        if seg_id in MANUAL_TTS_REWRITES:
            new_text = MANUAL_TTS_REWRITES[seg_id]
        elif needs_normalization(old_text):
            new_text = convert_numbers_in_text(old_text)
        else:
            continue

        if new_text != old_text:
            changed += 1
            changes.append({"id": seg_id, "old": old_text, "new": new_text})

            if not dry_run:
                tts["text"] = new_text

            old_pre = old_text[:120] + ("..." if len(old_text) > 120 else "")
            new_pre = new_text[:120] + ("..." if len(new_text) > 120 else "")
            print(f"  {seg_id}:")
            print(f"    OLD: {old_pre}")
            print(f"    NEW: {new_pre}")
            print()

    # Verification: no Arabic numerals should remain in tts.text
    if not dry_run:
        remaining = []
        for seg in data["segments"]:
            tts_text = seg.get("tts", {}).get("text", "")
            if re.search(r"\d", tts_text):
                remaining.append((seg["id"], tts_text))
    else:
        proposed = {c["id"]: c["new"] for c in changes}
        remaining = []
        for seg in data["segments"]:
            tts_text = seg.get("tts", {}).get("text", "")
            if seg["id"] in proposed:
                tts_text = proposed[seg["id"]]
            if re.search(r"\d", tts_text):
                remaining.append((seg["id"], tts_text))

    if remaining:
        print(f"\nWARNING: {len(remaining)} segments still contain Arabic numerals:")
        for sid, txt in remaining[:30]:
            nums = re.findall(r"\d+", txt)
            print(f"  {sid}: {nums}")
        if len(remaining) > 30:
            print(f"  ... and {len(remaining) - 30} more")
        if not dry_run:
            print("\nNot saving -- fix these first!")
            sys.exit(1)

    # Save
    if not dry_run and changed > 0:
        tmp = SEGMENTS_PATH.with_suffix(".json.tmp")
        with open(tmp, "w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        tmp.replace(SEGMENTS_PATH)
        print(f"Saved to {SEGMENTS_PATH}")

    # Report
    if save_report:
        report_path = SCRIPT_DIR / "normalize_tts_en_report.json"
        with open(report_path, "w") as f:
            json.dump({"total_changed": changed, "changes": changes}, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"Report saved to {report_path}")

    mode = "DRY RUN" if dry_run else "APPLIED"
    print(f"\n[{mode}] {changed} segments normalized")


if __name__ == "__main__":
    main()
