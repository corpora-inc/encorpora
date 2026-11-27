"""Deterministic verifiers shared by tasks. Each returns a list of problems (empty = pass)."""

from __future__ import annotations

import re

from .stage import Stage
from .textutil import locate, norm_ws, numbers_in

UNIT_ALIASES = {
    "ft": ["ft", "foot", "feet", "'"], "feet": ["ft", "foot", "feet"], "foot": ["ft", "foot", "feet"],
    "in": ["in", "inch", "inches", '"'], "inch": ["inch", "inches", "in."], "inches": ["inch", "inches", "in."],
    "m": ["m", "meter", "meters", "metre"], "cm": ["cm", "centimeter"], "mm": ["mm", "millimeter"],
    "kv": ["kv", "kilovolt"], "v": ["v", "volt", "volts"], "mph": ["mph", "miles per hour"],
    "lb": ["lb", "lbs", "pound", "pounds"], "lbs": ["lb", "lbs", "pound", "pounds"],
    "pound": ["lb", "pound", "pounds"], "pounds": ["lb", "lbs", "pound", "pounds"],
    "ton": ["ton", "tons"], "tons": ["ton", "tons"], "%": ["%", "percent"], "percent": ["%", "percent"],
    "degree": ["degree", "degrees", "°"], "degrees": ["degree", "degrees", "°"],
    "day": ["day", "days", "daily"], "days": ["day", "days"], "month": ["month", "months", "monthly"],
    "months": ["month", "months"], "year": ["year", "years", "annual", "yearly"], "years": ["year", "years"],
    "hour": ["hour", "hours", "hr"], "hours": ["hour", "hours", "hr"], "minute": ["minute", "minutes", "min"],
    "minutes": ["minute", "minutes"], "second": ["second", "seconds", "sec"], "seconds": ["second", "seconds"],
    "psi": ["psi", "pounds per square inch"],
}

_NUM_WORDS = {"one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6", "seven": "7",
              "eight": "8", "nine": "9", "ten": "10", "twelve": "12", "fifteen": "15", "twenty": "20",
              "fifty": "50", "hundred": "100", "half": "1/2"}


def check_quote(item: dict, stage: Stage, allowed_ids: list[str] | None, field: str = "quote",
                id_field: str = "section_id", required: bool = True) -> list[str]:
    """The quote is an exact substring of the cited section's text; the section exists and is in scope.

    On success the item's quote is replaced by the exact source span (see textutil.locate)."""
    sid = item.get(id_field)
    quote = item.get(field)
    if not quote:
        return [f"{field} missing"] if required else []
    if not sid or not stage.exists(sid):
        return [f"cited section {sid!r} does not exist"]
    if allowed_ids is not None and sid not in allowed_ids:
        return [f"cited section {sid!r} is outside this input"]
    exact = locate(quote, stage.text(sid))
    if exact is None:
        return [f"{field} is not verbatim in {sid}"]
    item[field] = exact
    return []


def _num_forms(text: str) -> set[str]:
    forms = set(numbers_in(text))
    low = (text or "").lower()
    for w, d in _NUM_WORDS.items():
        if re.search(rf"\b{w}\b", low):
            forms.add(d)
    return forms


def check_numbers(claimed: str | None, quote: str, what: str = "value") -> list[str]:
    """Every number in `claimed` appears in the quote (digits or a common number word)."""
    if not claimed:
        return []
    have = _num_forms(quote)
    missing = [n for n in numbers_in(claimed) if n not in have]
    return [f"{what} number(s) {', '.join(missing)} not in quote"] if missing else []


def check_unit(unit: str | None, quote: str) -> list[str]:
    if not unit:
        return []
    u = unit.strip().lower().rstrip(".")
    q = norm_ws(quote).lower()
    forms = UNIT_ALIASES.get(u, [u])
    # compound units ('feet per minute') pass when every word appears
    if any(f in q for f in forms) or all(w in q for w in u.split()):
        return []
    return [f"unit {unit!r} not in quote"]


_STD = re.compile(r"\b(?:ASME|ANSI)\b[^.;,)]{0,20}?(B\s?\d+(?:\.\d+)*)", re.I)


def check_no_outside_standard(texts: list[str], source_text: str) -> list[str]:
    """Generated text may name a consensus standard (e.g. ASME B30.x) only where the source does.

    The standards are copyrighted: cite by number, never restate their content. A mention the
    source does not make is treated as content from outside the source."""
    src = norm_ws(source_text).replace(" ", "")
    problems = []
    for t in texts:
        for m in _STD.finditer(t or ""):
            num = m.group(1).replace(" ", "")
            if num not in src:
                problems.append(f"mentions {num}, which the source does not cite")
    return problems


_QUOTED = re.compile(r"[\"“]([^\"”]{25,})[\"”]")


def check_inline_quotes(body: str, source_text: str) -> list[str]:
    """Any passage in quotation marks (25+ chars) must be verbatim from the source."""
    bad = [m.group(1)[:60] for m in _QUOTED.finditer(body or "") if locate(m.group(1), source_text) is None]
    return [f"quoted text not in source: {b!r}" for b in bad]


def check_new_numbers(body: str, source_text: str) -> list[str]:
    """Numbers in generated prose must come from the source (limits are never invented)."""
    have = _num_forms(source_text)
    extra = sorted({n for n in numbers_in(body) if n not in have})
    return [f"numbers not in source: {', '.join(extra)}"] if extra else []
