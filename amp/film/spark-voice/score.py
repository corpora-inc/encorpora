"""Choosing the best of several takes of one line. Pure Python, tested in CI.

Each candidate is measured by the service: what Whisper heard, sounds that are
no word (quality.noises), a learned naturalness score (UTMOS22, 1 to 5), the
voice encoder's similarity to the reference (0 to 1) and the pace in words per
second. A wrong word or a noise outweighs everything else; among clean takes
the most natural, most like the voice and nearest its usual pace wins.
"""
from __future__ import annotations

import re

ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
        "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]


def number_words(n: int) -> str:
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + (f" {ONES[n % 10]}" if n % 10 else "")
    for size, name in ((10**9, "billion"), (10**6, "million"), (1000, "thousand"), (100, "hundred")):
        if n >= size:
            rest = n % size
            return f"{number_words(n // size)} {name}" + (f" {number_words(rest)}" if rest else "")
    return str(n)


def spoken(text: str) -> list[str]:
    """Words as spoken, lower case: Whisper's digits read out ("48" is "forty eight")."""
    t = text.lower().replace("’", "'").replace("%", " percent")
    t = re.sub(r"(\d),(\d{3})", r"\1\2", t)
    t = re.sub(r"(\d+)\.(\d+)", lambda m: f"{m.group(1)} point " + " ".join(m.group(2)), t)
    t = re.sub(r"\d+", lambda m: f" {number_words(int(m.group()))} ", t)
    return [w for w in re.split(r"[^a-z']+", t.replace("-", " ")) if w and w != "'"]


def errors(want: list[str], heard: str) -> int:
    """Word edits between the script's spoken words and what was heard ("and" may come or go)."""
    a = [w for w in want if w != "and"]
    b = [w for w in spoken(heard) if w != "and"]
    row = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        prev, row[0] = row[:], i
        for j in range(1, len(b) + 1):
            row[j] = min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] != b[j - 1]))
    return row[len(b)]


def score(c: dict, pace: float | None = None) -> float:
    """Higher is better. `c` has errors, noises (list), utmos, similarity, wps."""
    s = -10.0 * c["errors"] - 8.0 * len(c["noises"])
    s += 2.0 * (c.get("utmos") or 0.0) + 10.0 * (c.get("similarity") or 0.0)
    if pace and c.get("wps"):
        s -= 3.0 * abs(c["wps"] - pace) / pace
    return s


def best(candidates: list[dict], pace: float | None = None) -> int:
    """Index of the best candidate; the first wins a tie, so one candidate is always itself."""
    scores = [score(c, pace) for c in candidates]
    return max(range(len(candidates)), key=lambda i: (scores[i], -i))
