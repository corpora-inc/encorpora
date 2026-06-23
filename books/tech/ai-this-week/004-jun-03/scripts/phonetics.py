"""Forward phonetics for AI This Week — display → tts.text spell-out.

The manuscript markdown is written in **display form**: numerals, model
versions with dashes/dots ("GPT-5.5", "Kimi K2.6", "May 20, 2026"),
percentages, dollar amounts. The `text` field on each segment stores
this verbatim.

`tts.text` needs every number, version, and ambiguous token spelled
out so the TTS engine (Gemini Flash 3.1 today; may be Chatterbox
later) speaks them cleanly. This module is the deterministic forward
transform that produces tts.text from display.

**Idempotent + bounded.** No per-segment literal-string dicts (see
LESSONS.md rake #17 + #20). Only programmatic rules. If a new model
version or pattern shows up in the manuscript, extend the rule set —
do not paste literal strings into a per-segment table.

Public surface:
    spell_out(display: str) -> str

Rule order (longest patterns first to avoid partial-match collisions):
    1. Specific multi-word phrases (model names, "I/O", Roman numerals)
    2. Dates: "Month DD, YYYY" / "Month DD" / "DD"
    3. Years (4-digit standalone)
    4. Versions like "X.Y" / "vX.Y.Z" inside a model name context
    5. Money: $X[.Y] [scale]
    6. Percent: X[.Y]%
    7. Cardinals with scale: "1.6 trillion" → "one point six trillion"
    8. Plain integers in word-boundary context
"""
from __future__ import annotations

import re

from num2words import num2words


# ----- 1. Specific phrases (applied first, longest first) ------------

# Model versions and proper nouns where the natural spell-out is not
# automatic. Keys MUST be sorted longest-first when applied so that
# e.g. "GPT-5.5 Instant" doesn't get half-matched on "GPT-5".
_PHRASE_MAP: dict[str, str] = {
    # GPT family
    "GPT-5.5": "GPT five point five",
    "GPT-5.6": "GPT five point six",
    "GPT-4": "GPT four",
    # Claude / Opus
    "Opus 4.8": "Opus four point eight",
    "Opus 4.7": "Opus four point seven",
    "Opus 4.6": "Opus four point six",
    "Sonnet 4.6": "Sonnet four point six",
    "Haiku 4.5": "Haiku four point five",
    # Gemini
    "Gemini 3.5 Flash": "Gemini three point five Flash",
    "Gemini 3.5 Pro": "Gemini three point five Pro",
    "Gemini 3.5": "Gemini three point five",
    # Open weights — Chinese stack
    "Kimi K2.6": "Kimi K two point six",
    "Kimi K 2.6": "Kimi K two point six",
    "Kimi K2.5": "Kimi K two point five",
    "Kimi K 2.5": "Kimi K two point five",
    "DeepSeek V4-Pro": "DeepSeek V four Pro",
    "DeepSeek V4 Pro": "DeepSeek V four Pro",
    "DeepSeek V4-Flash": "DeepSeek V four Flash",
    "DeepSeek V4 Flash": "DeepSeek V four Flash",
    "DeepSeek V4": "DeepSeek V four",
    "V4-Pro": "V four Pro",
    "V4-Flash": "V four Flash",
    "V4": "V four",
    "GLM-4.7": "GLM four point seven",
    "GLM 4.7": "GLM four point seven",
    "Qwen 3.7 Plus": "Qwen three point seven Plus",
    "Qwen 3.7-Plus": "Qwen three point seven Plus",
    "Qwen 3.7 Max": "Qwen three point seven Max",
    "Qwen 3.7": "Qwen three point seven",
    "Qwen3.7": "Qwen three point seven",
    "Qwen 3.6": "Qwen three point six",
    "Qwen 3.5": "Qwen three point five",
    "Qwen3.6": "Qwen three point six",
    "Qwen3.5": "Qwen three point five",
    "GLM-5.1": "G L M five point one",
    "GLM 5.1": "G L M five point one",
    "GLM-5": "G L M five",
    "MiniMax M3": "MiniMax M three",
    "MiniMax M2.7": "MiniMax M two point seven",
    "MiniMax M2.5": "MiniMax M two point five",
    "M2 to M3": "M two to M three",
    "M3": "M three",
    # Ep4 — June 2026 model and tool names
    "Nemotron 3 Ultra": "Nemotron three Ultra",
    "Nemotron 3 Nano Omni": "Nemotron three Nano Omni",
    "Nemotron 3 Nano": "Nemotron three Nano",
    "MAI-Thinking-1": "M A I Thinking one",
    "MAI-Code-1-Flash": "M A I Code one Flash",
    "MAI-Code-1": "M A I Code one",
    "MAI": "M A I",
    "MSA": "M S A",
    "GB10": "G B ten",
    "LPDDR5x": "L P D D R five x",
    "LPDDR5X": "L P D D R five x",
    "ConnectX-7": "Connect X seven",
    "Ryzen AI Max+ 395": "Ryzen A I Max Plus three ninety five",
    "Ryzen AI Max+": "Ryzen A I Max Plus",
    "Ryzen AI Halo": "Ryzen A I Halo",
    "DGX Spark": "D G X Spark",
    "Strix Halo": "Strix Halo",
    "Ollama 0.30.5": "Ollama zero point thirty point five",
    "Ollama 0.30": "Ollama zero point thirty",
    "SGLang 0.5.11": "S G Lang zero point five point eleven",
    "EAGLE-3": "Eagle three",
    "GDPval-AA": "G D P val Double A",
    "CVE-2026-10775": "C V E twenty twenty six dash one zero seven seven five",
    "256K": "two hundred fifty six K",
    "1M": "one million",
    # Ep3 — open TTS / audio + infra proper nouns
    "MOSS-TTS-Nano": "MOSS T T S Nano",
    "VoxCPM2": "Vox C P M two",
    "VoxCPM": "Vox C P M",
    "OmniVoice": "Omni Voice",
    "SGLang": "S G Lang",
    "llama.cpp": "llama C P P",
    "Moonshine v2": "Moonshine version two",
    "Hy3": "H Y three",
    "TTS": "T T S",
    "MoE": "mixture of experts",
    "MIT": "M I T",
    "Mistral Medium 3.5": "Mistral Medium three point five",
    "Medium 3.5": "Medium three point five",
    # Zyphra — product name; spell letters + digits
    "ZAYA1-8B": "ZAYA one eight B",
    # Inference engines
    "vLLM v0.21.0": "v L L M version zero point twenty one",
    "vLLM v0.21": "v L L M version zero point twenty one",
    "vLLM": "v L L M",
    # Quantization formats
    "Q4_K_M": "Q four K M",
    # SWE benchmarks
    "SWE-bench Verified": "SWE bench Verified",
    "SWE-bench Pro": "SWE bench Pro",
    "SWE-bench": "SWE bench",
    "SWE-rebench": "SWE rebench",
    # Acronyms with internal slash
    "I/O": "I O",
    # Idioms
    "24/7": "twenty four seven",
    # Roman numerals on popes
    "Pope Leo XIV": "Pope Leo the fourteenth",
    "Pope Leo XIII": "Pope Leo the thirteenth",
    # Rank
    "#1": "number one",
    "#7": "number seven",
    "#9": "number nine",
}


def _apply_phrase_map(text: str) -> str:
    """Apply specific-phrase substitutions, longest first."""
    for src in sorted(_PHRASE_MAP, key=len, reverse=True):
        text = text.replace(src, _PHRASE_MAP[src])
    return text


# ----- 2. Dates (Month DD, YYYY) -------------------------------------

_MONTHS = ("January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November",
          "December")
_MONTH_RE = "|".join(_MONTHS)
_DATE_RE = re.compile(rf"\b({_MONTH_RE})\s+(\d{{1,2}})(?:,\s*(\d{{4}}))?\b")


def _spell_date(m: re.Match) -> str:
    month = m.group(1)
    day = int(m.group(2))
    year = m.group(3)
    day_words = num2words(day, to="ordinal").replace("-", " ")
    out = f"{month} {day_words}"
    if year:
        out += f", {_spell_year(int(year))}"
    return out


def _spell_year(y: int) -> str:
    """Year-form: 2026 → 'twenty twenty six'. Also covers 4-digit numbers
    in year-like ranges (1000-2099) — Elo ratings like 1569 spell out
    as 'fifteen sixty nine' which is what we want."""
    if 2000 <= y <= 2099:
        tail = y - 2000
        if tail < 10:
            return f"twenty oh {num2words(tail)}"
        return f"twenty {num2words(tail).replace('-', ' ')}"
    if 1000 <= y <= 1999:
        # "fifteen sixty nine" / "eighteen ninety one"
        hundreds = y // 100
        tail = y % 100
        hundreds_w = num2words(hundreds).replace('-', ' ')
        if tail == 0:
            return f"{hundreds_w} hundred"
        if tail < 10:
            return f"{hundreds_w} oh {num2words(tail)}"
        return f"{hundreds_w} {num2words(tail).replace('-', ' ')}"
    # fallback
    return num2words(y, to="year").replace("-", " ")


# ----- 3. 4-digit years (and year-form for 4-digit numerics) ---------

# Any 4-digit number in 1000-2099 spells as year-form ("fifteen sixty
# nine", "twenty twenty six"). Elo ratings like 1569 read naturally
# this way too.
_YEAR_RE = re.compile(r"\b([12]\d{3})\b")


def _spell_year_match(m: re.Match) -> str:
    return _spell_year(int(m.group(1)))


# ----- 4. Money: $X[.Y] [scale?] -------------------------------------

_SCALE_WORDS = ("trillion", "billion", "million", "thousand", "hundred")
_SCALE_RE = "|".join(_SCALE_WORDS)
_MONEY_RE = re.compile(
    rf"\$(\d+(?:\.\d+)?)(?:\s+({_SCALE_RE}))?"
)


def _spell_money(m: re.Match) -> str:
    amt_str = m.group(1)
    scale = m.group(2)
    amt = _spell_decimal(amt_str)
    if scale:
        return f"{amt} {scale} dollars"
    return f"{amt} dollars"


# ----- 5. Percentages: X[.Y]% ----------------------------------------

_PERCENT_RE = re.compile(r"\b(\d+(?:\.\d+)?)%")


def _spell_percent(m: re.Match) -> str:
    return f"{_spell_decimal(m.group(1))} percent"


# ----- 6. Numbers with explicit scale: "1.6 trillion" ----------------

_NUM_SCALE_RE = re.compile(
    rf"\b(\d+(?:\.\d+)?)\s+({_SCALE_RE})\b"
)


def _spell_num_scale(m: re.Match) -> str:
    return f"{_spell_decimal(m.group(1))} {m.group(2)}"


# ----- 7. Helpers ----------------------------------------------------

def _spell_decimal(s: str) -> str:
    """Spell '1.6' → 'one point six'; '32' → 'thirty two'; '49' → 'forty nine'."""
    if "." in s:
        whole, frac = s.split(".", 1)
        whole_words = num2words(int(whole)).replace("-", " ")
        whole_words = re.sub(r"\s+and\s+", " ", whole_words).replace(",", "")
        frac_words = " ".join(num2words(int(d)) for d in frac)
        return f"{whole_words} point {frac_words}"
    out = num2words(int(s)).replace("-", " ")
    out = re.sub(r"\s+and\s+", " ", out).replace(",", "")
    return out


# ----- 7c. Thousand-separator integers ("100,000" / "1,024") ---------

_BIG_INT_RE = re.compile(r"\b(\d{1,3}(?:,\d{3})+)\b")


def _spell_big_int(m: re.Match) -> str:
    n = int(m.group(1).replace(",", ""))
    out = num2words(n).replace("-", " ")
    out = re.sub(r"\s+and\s+", " ", out).replace(",", "")
    return out


# ----- 8a. Standalone decimals "X.Y" (before integers!) --------------

_DEC_RE = re.compile(r"\b(\d+\.\d+)\b")


def _spell_dec(m: re.Match) -> str:
    return _spell_decimal(m.group(1))


# ----- 8b. Standalone integers (the catch-all, applied LAST) ---------

_INT_RE = re.compile(r"\b(\d{1,4})\b")


def _spell_int(m: re.Match) -> str:
    n = int(m.group(1))
    s = num2words(n).replace("-", " ")
    # num2words returns "and" for hundreds; American-style strips it.
    s = re.sub(r"\s+and\s+", " ", s)
    # num2words includes commas in "one thousand, five hundred ..." —
    # strip the comma but not other punctuation in surrounding text.
    s = s.replace(",", "")
    return s


# ----- 9. Cleanup: stray hyphens / underscores in alphanumerics ------

_DASH_BETWEEN_ALNUM = re.compile(r"(?<=[A-Za-z0-9])-(?=[A-Za-z0-9])")


# ----- public entry --------------------------------------------------

def spell_out(display: str) -> str:
    """Convert display-form text to tts-friendly spelled-out form.

    Rule order matters. Phrase substitutions happen first so model
    versions don't get caught by the date / number passes.
    """
    text = display

    # 1. Specific phrases
    text = _apply_phrase_map(text)

    # 2. Dates with optional year
    text = _DATE_RE.sub(_spell_date, text)

    # 3. Standalone years
    text = _YEAR_RE.sub(_spell_year_match, text)

    # 4. Money
    text = _MONEY_RE.sub(_spell_money, text)

    # 5. Percent
    text = _PERCENT_RE.sub(_spell_percent, text)

    # 6. Numbers + scale words
    text = _NUM_SCALE_RE.sub(_spell_num_scale, text)

    # 7a. Decimals (must run before integers)
    text = _DEC_RE.sub(_spell_dec, text)

    # 7b. Thousand-separator integers (must run before naked integers)
    text = _BIG_INT_RE.sub(_spell_big_int, text)

    # 7c. Remaining naked integers
    text = _INT_RE.sub(_spell_int, text)

    # 8. Hyphens between alphanumerics → space (for "SWE-bench" leftovers
    #    if any), but the phrase map handles known cases.
    text = _DASH_BETWEEN_ALNUM.sub(" ", text)

    return text


if __name__ == "__main__":
    # Smoke test
    cases = [
        "Today is Wednesday, May 20, 2026.",
        "OpenAI rolled out GPT-5.5 last week, on May 5.",
        "OpenAI says the model writes 30% fewer words and 50% fewer hallucinations.",
        "Moonshot raised $2 billion at a $20 billion valuation.",
        "Anthropic's Claude Opus 4.7 hit an Elo of 1569 on LM Arena.",
        "Kimi K2.6 has 1 trillion parameters total but only 32 billion active.",
        "Pope Leo XIV signed the encyclical on May 15 — 135 years after Pope Leo XIII signed Rerum Novarum.",
        "vLLM v0.21.0 shipped May 15, 2026.",
        "DeepSeek V4-Pro is 1.6T total / 49B active.",
        "Apple's on-device model is about 3 billion parameters at 2 bits per weight.",
        "AI Ultra dropped from $250 to $100 per month.",
        "GLM-4.7 was trained on Huawei Ascend with a 1.2% hallucination rate.",
        "ZAYA1-8B is Apache 2.0.",
        "I/O is on Tuesday and Wednesday.",
        "GPT-5.5 sits at #7 on the LM Arena coding leaderboard.",
    ]
    for c in cases:
        print(f"IN : {c}")
        print(f"OUT: {spell_out(c)}")
        print()
