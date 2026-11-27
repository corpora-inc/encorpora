"""Answer-cache intent check: the engine's alias similarity, ported, and collision tests.

`similarity(query, alias)` mirrors harvest/core `answer::similarity` over
`normalize::normalize_query` without pack synonyms (synonyms only raise a score,
so collisions found here are a lower bound): Dice overlap of content stems
(Snowball English), halved when the two sides carry different numbers. The
engine serves a cached answer when a question reaches `CACHE_THRESHOLD` against
one of its aliases. An alias that comes within `COLLIDE` of another answer's
question or alias, or of a practice question of another skill, can serve the
wrong answer to a question it was never written for; the writer drops it.
"""

from __future__ import annotations

import re

import snowballstemmer

CACHE_THRESHOLD = 0.75
COLLIDE = 0.6

_STEM = snowballstemmer.stemmer("english")

STOPWORDS = frozenset("""a about after all also am an and any are as at be because been before being but by can could did do
does doing for from get got had has have having he her here him his how i if in into is it its just know like many
me much my need of ok okay on or our out please really she should so some such tell than that the their them then
there these they thing things this those to too us want was way we were what when where which while who whom why
will with would you your""".split())

_NUM_WORDS = {w: i for i, w in enumerate(
    "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen "
    "eighteen nineteen".split())}
_NUM_WORDS.update({"twenty": 20, "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90})

_UNITS = [
    (("ft", "feet", "foot"), "feet", False), (("in", "inch", "inches"), "inches", True),
    (("lb", "lbs", "pound", "pounds"), "pounds", False), (("kg", "kgs", "kilogram", "kilograms"), "kilograms", False),
    (("m", "meter", "meters", "metre", "metres"), "meters", True), (("mm", "millimeter", "millimeters"), "millimeters", False),
    (("kv", "kilovolt", "kilovolts"), "kv", False), (("v", "volt", "volts"), "volts", True), (("mph",), "mph", False),
    (("percent", "pct"), "percent", False), (("deg", "degree", "degrees"), "degrees", False),
    (("ton", "tons", "tonne", "tonnes"), "tons", False), (("hr", "hrs", "hour", "hours"), "hours", False),
    (("min", "mins", "minute", "minutes"), "minutes", True),
]


def fold(s: str) -> str:
    s = s.replace("‘", "'").replace("’", "'").replace("′", "'").replace("“", '"').replace("”", '"').replace("″", '"')
    s = re.sub("[‐-―]", "-", s).replace(" ", " ")
    s = re.sub(r"(?<=\d),(?=\d)", "", s)
    return " ".join(s.lower().split())


def _is_number(t: str) -> bool:
    return bool(t) and t[0].isdigit() and all(c.isdigit() or c == "." for c in t)


def _raw_tokens(f: str) -> list[str]:
    out, cur = [], ""
    for i, c in enumerate(f):
        prev_d = i > 0 and f[i - 1].isdigit()
        next_d = i + 1 < len(f) and f[i + 1].isdigit()
        if c.isalnum():
            if cur and all(x.isdigit() or x == "." for x in cur) and not c.isdigit():
                out.append(cur)
                cur = ""
            cur += c
        elif c == "." and prev_d and next_d and cur:
            cur += c
        else:
            if cur:
                out.append(cur)
                cur = ""
            if c == "'" and prev_d:
                out.append("feet")
            elif c == '"' and prev_d:
                out.append("inches")
            elif c == "%":
                out.append("percent")
            elif c == "°":
                out.append("degrees")
    if cur:
        out.append(cur)
    return out


def tokens(text: str) -> list[str]:
    raw = _raw_tokens(fold(text))
    out: list[str] = []
    i = 0
    while i < len(raw):
        if raw[i] in _NUM_WORDS:
            total = group = 0
            j = i
            while j < len(raw):
                w = raw[j]
                if w in _NUM_WORDS:
                    group += _NUM_WORDS[w]
                elif w == "hundred" and group > 0:
                    group *= 100
                elif w == "thousand" and (group > 0 or total > 0):
                    total += max(group, 1) * 1000
                    group = 0
                else:
                    break
                j += 1
            out.append(str(total + group))
            i = j
            continue
        after = bool(out) and _is_number(out[-1])
        t = raw[i]
        for spellings, canon, needs in _UNITS:
            if t in spellings and (after or not needs):
                t = canon
                break
        out.append(t)
        i += 1
    return out


def stem(t: str) -> str:
    return t if _is_number(t) else _STEM.stemWord(t)


def concepts(text: str) -> list[str]:
    out: list[str] = []
    for t in tokens(text):
        if t in STOPWORDS:
            continue
        s = stem(t)
        if not out or out[-1] != s:  # Vec::dedup_by: consecutive duplicates only
            out.append(s)
    return out


def similarity(query: str, alias: str) -> float:
    qc = concepts(query)
    a_stems = {stem(t) for t in tokens(alias) if t not in STOPWORDS}
    if not qc or not a_stems:
        return 0.0
    matched = sum(1 for c in qc if c in a_stems)
    dice = 2.0 * matched / (len(qc) + len(a_stems))
    qn = {t for t in tokens(query) if _is_number(t)}
    an = {t for t in tokens(alias) if t and t[0].isdigit()}
    return dice * 0.5 if qn != an else min(dice, 1.0)


def collision(a: str, b: str) -> float:
    """The engine scores a query against an alias; either text can be the query."""
    return max(similarity(a, b), similarity(b, a))
