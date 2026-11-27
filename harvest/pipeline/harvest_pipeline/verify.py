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


_CITE = re.compile(r"§+\s*\d[\d.]*(?:\s*\([^)\s]{1,6}\))*|\b\d{3,4}\.\d+[a-z]?(?:\s*\([^)\s]{1,6}\))*"
                   r"|\b\d+\s+CFR\b|\((?:[a-z]{1,5}|\d{1,3}|[A-Z]{1,2})\)")


def strip_citations(text: str) -> str:
    """Drop citation-like tokens ('§ 1926.1408(a)(2)', '(c)(18)', 'Option (1)', '49 CFR') before number checks."""
    return _CITE.sub(" ", text or "")


def check_numbers(claimed: str | None, quote: str, what: str = "value", context: str = "") -> list[str]:
    """Every number in `claimed` appears in the quote, or in `context` when one is given
    (digits or a common number word). Citation tokens in `claimed` are ignored."""
    if not claimed:
        return []
    claimed = strip_citations(claimed)
    have = _num_forms(quote) | (_num_forms(context) if context else set())
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


_CURLY = re.compile("“([^“”\n]*)”")
_STRAIGHT = re.compile(r'"([^"\n]*)"')
_ID_REF = re.compile(r"\[([0-9]+cfr[^\]\s]+|[a-z][\w.\-]*:[^\]\s]+)\]")


def quoted_spans(body: str) -> list[str]:
    """Passages in quotation marks: curly pairs first, then straight pairs; never across a line break."""
    spans = [m.group(1) for m in _CURLY.finditer(body or "")]
    rest = _CURLY.sub(" ", body or "")
    spans += [m.group(1) for m in _STRAIGHT.finditer(rest)]
    return spans


def check_inline_quotes(body: str, source_text: str, min_len: int = 25) -> list[str]:
    """Any passage in quotation marks (min_len+ chars) must be verbatim from the source."""
    bad = [q[:60] for q in quoted_spans(body) if len(q) >= min_len and locate(q, source_text) is None]
    return [f"quoted text not in source: {b!r}" for b in bad]


def id_refs(body: str) -> list[str]:
    """Section ids cited inline as [29cfr1926.1408(a)(2)]."""
    return _ID_REF.findall(body or "")


def check_id_refs(body: str, stage: Stage) -> list[str]:
    return [f"cites unknown section {sid}" for sid in id_refs(body) if not stage.exists(sid)]


def check_new_numbers(body: str, source_text: str, allowed: set[str] | None = None) -> list[str]:
    """Numbers in generated prose must come from the source (limits are never invented).
    Inline [section_id] references and citation tokens are ignored; `allowed` adds known numbers."""
    have = _num_forms(source_text) | (allowed or set())
    text = strip_citations(_ID_REF.sub(" ", body or ""))
    extra = sorted({n for n in numbers_in(text) if n not in have})
    return [f"numbers not in source: {', '.join(extra)}"] if extra else []
