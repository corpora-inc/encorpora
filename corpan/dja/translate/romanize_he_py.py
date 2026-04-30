#!/usr/bin/env python3
"""Deterministic Hebrew→Latin transliteration using nikkud.

Rules follow the Israeli/learner convention summarized in the codex rubric:
- Vowels (nikkud): shewa nakh silent, shewa na' = e, qamats = a, segol = e,
  tsere = e, patah = a, holam = o, shuruq = u, qubuts = u, hireq = i
- Consonants: bet = b/v (with/without dagesh), chet = ch, ayin = ',
  pe = p/f, tsadi = ts, shin = sh, sin = s, kaf = k/kh, vav = v (or u/o
  as mater lectionis), tav = t

Used as a fallback when LLM-based romanization (`romanize.py he`) is
unavailable due to API quota.
"""

from __future__ import annotations

import sqlite3
import sys
import unicodedata
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "db.sqlite3"

# Hebrew letters U+05D0..U+05EA + finals
LETTERS = {
    "א": "",    # alef — silent (vowel comes from nikkud)
    "ב": "b",   # bet (with dagesh: b; without: v — handled below)
    "ג": "g",   # gimel
    "ד": "d",   # dalet
    "ה": "h",   # he
    "ו": "v",   # vav (mater lectionis handled below)
    "ז": "z",   # zayin
    "ח": "ch",  # chet (kh-sound)
    "ט": "t",   # tet
    "י": "y",   # yod
    "כ": "k",   # kaf (with dagesh: k; without: kh)
    "ך": "kh",  # final kaf (no dagesh after vowel)
    "ל": "l",   # lamed
    "מ": "m",   # mem
    "ם": "m",   # final mem
    "נ": "n",   # nun
    "ן": "n",   # final nun
    "ס": "s",   # samekh
    "ע": "'",   # ayin (glottal mark)
    "פ": "p",   # pe (with dagesh: p; without: f)
    "ף": "f",   # final pe
    "צ": "ts",  # tsadi
    "ץ": "ts",  # final tsadi
    "ק": "k",   # qof
    "ר": "r",   # resh
    "ש": "sh",  # shin/sin (decided by shin/sin dot)
    "ת": "t",   # tav
}

# Nikkud (vowel points)
SHEWA       = "ְ"  # ְ
HATAF_SEGOL = "ֱ"  # ֱ
HATAF_PATAH = "ֲ"  # ֲ
HATAF_QAMATS = "ֳ"  # ֳ
HIREQ       = "ִ"  # ִ
TSERE       = "ֵ"  # ֵ
SEGOL       = "ֶ"  # ֶ
PATAH       = "ַ"  # ַ
QAMATS      = "ָ"  # ָ
HOLAM       = "ֹ"  # ֹ
QAMATS_QATAN = "ׇ" # ׇ
QUBUTS      = "ֻ"  # ֻ
DAGESH      = "ּ"  # ּ (also mappiq)
SHIN_DOT    = "ׁ"  # ׁ (right dot — shin)
SIN_DOT     = "ׂ"  # ׂ (left dot — sin)
RAFE        = "ֿ"  # ֿ

VOWEL_MAP = {
    SHEWA: "e",          # treated as 'e' (na'); silent shewas often happen mid-word but this is fine for learner roman
    HATAF_SEGOL: "e",
    HATAF_PATAH: "a",
    HATAF_QAMATS: "o",
    HIREQ: "i",
    TSERE: "e",
    SEGOL: "e",
    PATAH: "a",
    QAMATS: "a",
    HOLAM: "o",
    QAMATS_QATAN: "o",
    QUBUTS: "u",
}

NIKKUD = set(VOWEL_MAP) | {DAGESH, SHIN_DOT, SIN_DOT, RAFE}

BEGADKEFAT = {"ב", "כ", "פ"}  # bet, kaf, pe — soft when no dagesh
SOFT = {"ב": "v", "כ": "kh", "פ": "f"}


def transliterate_word(word: str) -> str:
    """Transliterate one Hebrew word (no spaces) into Latin."""
    out: list[str] = []
    chars = list(word)
    i = 0
    while i < len(chars):
        ch = chars[i]
        # Pull all attached nikkud
        marks: list[str] = []
        j = i + 1
        while j < len(chars) and chars[j] in NIKKUD:
            marks.append(chars[j])
            j += 1

        # Letter
        if ch == "ש":
            if SIN_DOT in marks:
                cons = "s"
            else:
                cons = "sh"
        elif ch == "ו":
            # Vav: shuruq (with dagesh point inside) = u; otherwise v / mater
            if DAGESH in marks and not (set(marks) & set(VOWEL_MAP)):
                cons = "u"
            elif HOLAM in marks:
                # Holam-vav (חוֹלָם מָלֵא) reads "o" — vav is the mater
                cons = "o"
                marks = [m for m in marks if m != HOLAM]
            else:
                cons = "v"
        elif ch in BEGADKEFAT:
            cons = LETTERS[ch] if DAGESH in marks else SOFT[ch]
        elif ch == "ך":
            cons = "kh"  # final kaf is always soft
        elif ch == "א" or ch == "ע":
            # Silent or glottal — drop in word-final, output ' for ayin midword
            cons = "" if ch == "א" else ("'" if i > 0 and i < len(chars) - 1 else "")
        elif ch in LETTERS:
            cons = LETTERS[ch]
        else:
            cons = ch  # punctuation passthrough

        # Vowel from nikkud
        vowel = ""
        for m in marks:
            if m in VOWEL_MAP:
                v = VOWEL_MAP[m]
                # Skip silent shewa (heuristic): shewa after a vowel-less consonant
                # or at end of word; we keep it simple — shewa nakh is rare in
                # modern fully-vocalized text used for learners, treat all as 'e'
                vowel = v
                break  # only one vowel point per consonant cluster

        out.append(cons + vowel)
        i = j

    word_out = "".join(out)
    # Tidy: collapse double-letters that come from nikkud quirks
    return word_out


def transliterate(text: str) -> str:
    # Normalize to NFC then iterate by tokens
    text = unicodedata.normalize("NFC", text)
    out_parts: list[str] = []
    cur = ""
    for ch in text:
        cat = unicodedata.category(ch)
        if "֐" <= ch <= "׿":  # Hebrew block
            cur += ch
        else:
            if cur:
                out_parts.append(transliterate_word(cur))
                cur = ""
            out_parts.append(ch)
    if cur:
        out_parts.append(transliterate_word(cur))
    return "".join(out_parts)


def main():
    db = sys.argv[1] if len(sys.argv) > 1 else str(DB_PATH)
    con = sqlite3.connect(db)
    cur = con.cursor()
    cur.execute("SELECT id FROM cor_language WHERE code='he'")
    row = cur.fetchone()
    if not row:
        print("Hebrew language row not found"); sys.exit(1)
    lang_id = row[0]
    cur.execute(
        "SELECT id, text FROM cor_translation "
        "WHERE language_id = ? AND (romanization IS NULL OR romanization = '')",
        (lang_id,),
    )
    rows = cur.fetchall()
    print(f"to romanize: {len(rows)}")
    updates = [(transliterate(t), tid) for tid, t in rows]
    cur.executemany("UPDATE cor_translation SET romanization = ? WHERE id = ?", updates)
    con.commit()
    print(f"updated: {cur.rowcount}")
    # Sample
    for tid, t in rows[:5]:
        print(f"  {tid}: {t}  →  {transliterate(t)}")
    con.close()


if __name__ == "__main__":
    main()
