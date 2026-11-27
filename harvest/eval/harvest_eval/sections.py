"""Citation-path matching between retrieved/cited ids and gold ids.

Section ids are CONTRACT citation paths: a base (e.g. ``29cfr1926.1408``,
``29cfr1926-subpartCC-appC``) followed by paragraph labels ``(a)(2)(i)`` or a
``-table<X>`` suffix. Containment is purely lexical:

* ``r`` is *within* ``g`` when ``r == g`` or ``r`` starts with ``g + "("`` or
  ``g + "-"`` (a deeper paragraph, or a table of the section).

Three matching levels, all reported:

* ``strict``  -- ``r`` within ``g``: the system pointed at the gold paragraph or
  something more specific inside it.
* ``lineage`` -- ``r`` within ``g`` or ``g`` within ``r``: one contains the
  other (a coarser paragraph that holds the gold text also counts). This is
  the headline level.
* ``section`` -- same base section (``§1926.1408`` for ``§1926.1408(a)(2)``).

``aliases`` (regex -> replacement, applied in order) normalize a pack whose
scheme differs from the set's, e.g. a different appendix spelling.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

LEVELS = ("strict", "lineage", "section")


def base(sid: str) -> str:
    m = re.match(r"^([^()]*?)(?:-table[^()]*)?(?:\(.*)?$", sid)
    return m.group(1) if m else sid


def within(r: str, g: str) -> bool:
    return r == g or r.startswith(g + "(") or r.startswith(g + "-")


def match(r: str, g: str, level: str) -> bool:
    if level == "strict":
        return within(r, g)
    if level == "lineage":
        return within(r, g) or within(g, r)
    if level == "section":
        return base(r) == base(g)
    raise ValueError(level)


@dataclass
class Normalizer:
    aliases: list[tuple[str, str]] = field(default_factory=list)

    def __call__(self, sid: str) -> str:
        s = sid.strip()
        s = re.sub(r"^§\s*", "", s)
        for pat, rep in self.aliases:
            s = re.sub(pat, rep, s)
        return s


# "§1926.1408(a)(2)", "29 CFR 1926.1408(a)(2)", "29cfr1926.1408(a)(2)", or a bare
# "1926.1408(a)(2)" (bare numbers need a four-digit part, so "3.5 feet" never matches).
_PARENS = r"((?:\([0-9a-zA-Z]{1,5}\))*)"
CITE_RE = re.compile(
    r"(?:(?:\d+\s*C\.?F\.?R\.?\s*(?:[Pp]art\s*)?§*\s*|§+\s*|\d+cfr)(\d{1,4}\.\d{1,5})" + _PARENS
    + r"|\b(\d{4}\.\d{2,5})" + _PARENS + r")")


def cites_in_text(text: str, prefix: str = "29cfr") -> list[str]:
    """Pull citation paths out of free text (for baselines that answer in prose)."""
    out = []
    for m in CITE_RE.finditer(text):
        num, par = (m.group(1), m.group(2)) if m.group(1) else (m.group(3), m.group(4))
        out.append(f"{prefix}{num}{par}")
    return list(dict.fromkeys(out))
