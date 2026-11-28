"""Applicability as printed: which variants a statement names, and what it is printed on.

A statement is a printed run that names variants and nothing else: model names or the part that
tells them apart ("DGT-30A1, DGT-30A2", "A2 ONLY", "Diesel models only"), or a serial range
("Serial numbers 1250 and subsequent", "S/N 1001 thru 1249"), with only connectors around them
(and, or, commas, ONLY, MODELS, parentheses). A sentence that merely mentions a model ("On the A2
the indication is on the display") is not a statement and scopes nothing.

Variants are named by their distinguishing words: the words of a variant's name that no other
variant's name has ("30" for DGT-30 beside DGT-30A1), or a token that only one variant's distinguishing
word ends with ("A2"). Serial ranges map through the manual's own effectivity, printed as "<variant>
serial numbers <a> through <b>" (or "<a> and subsequent"); a range that covers part of a variant
becomes a child variant carrying that serial range, so the engine picks it by the data plate.
"""

from __future__ import annotations

import re

CONNECTORS = {"and", "or", "only", "models", "model", "sets", "set", "units", "unit", "all", "&", "with", "s/n",
              "sn", "serial", "numbers", "number", "nos", "no", "through", "thru", "to", "subsequent", "later",
              "above", "prior", "before", "effective", "on", "from", "configuration", "applies", "variant",
              "variants", "only:"}
SERIAL = [re.compile(r"(?i)\b(?:serial\s+(?:numbers?|nos?\.?)|s/?n)\s*:?\s*(\d+)\s*(?:through|thru|to|-|–)\s*(\d+)"),
          re.compile(r"(?i)\b(?:serial\s+(?:numbers?|nos?\.?)|s/?n)\s*:?\s*(\d+)\s+and\s+(?:subsequent|later|above|up)"),
          re.compile(r"(?i)\b(?:serial\s+(?:numbers?|nos?\.?)|s/?n)\s*:?\s*(?:prior\s+to|before|below)\s+(\d+)")]


def _words(s: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", (s or "").lower())


class Variants:
    def __init__(self, leaves: list[dict]):
        self.leaves = leaves
        words = {e["equip_id"]: set(_words(e["name"])) for e in leaves}
        self.own = {}
        for eid, ws in words.items():
            others = set().union(*(w for k, w in words.items() if k != eid)) if len(words) > 1 else set()
            self.own[eid] = ws - others
        self.serial: dict[str, tuple[int, int]] = {}

    def named(self, text: str) -> list[str]:
        toks = _words(text)
        hits = []
        for eid, own in self.own.items():
            if own and own & set(toks):
                hits.append(eid)
        for t in toks:
            if re.search(r"[a-z]", t) and re.search(r"\d", t):
                ends = [eid for eid, own in self.own.items() if any(o.endswith(t) and o != t for o in own)]
                if len(ends) == 1 and ends[0] not in hits:
                    hits.append(ends[0])
        return hits

    def effectivity(self, texts: list[str]) -> None:
        """'<name> serial numbers a through b' / 'a and subsequent', as the manual prints them."""
        for e in self.leaves:
            name = re.escape(e["name"]).replace(r"\ ", r"\s+")
            for t in texts:
                m = re.search(rf"(?i){name}\W+(?:serial\s+(?:numbers?|nos?\.?)|s/?n)\s*:?\s*(\d+)\s*(?:through|thru|to|-|–)\s*(\d+)", t)
                if m:
                    self.serial[e["equip_id"]] = (int(m.group(1)), int(m.group(2)))
                    break
                m = re.search(rf"(?i){name}\W+(?:serial\s+(?:numbers?|nos?\.?)|s/?n)\s*:?\s*(\d+)\s+and\s+(?:subsequent|later|above|up)", t)
                if m:
                    self.serial[e["equip_id"]] = (int(m.group(1)), 10 ** len(m.group(1)) - 1)
                    break

    def serial_range(self, text: str) -> tuple[int, int] | None:
        for k, rx in enumerate(SERIAL):
            m = rx.search(text or "")
            if m:
                if k == 0:
                    return int(m.group(1)), int(m.group(2))
                if k == 1:
                    return int(m.group(1)), 10 ** len(m.group(1)) - 1
                return 0, int(m.group(1)) - 1
        return None

    def by_serial(self, rng: tuple[int, int]) -> list[tuple[str, tuple[int, int] | None]]:
        """(variant, the part of its range the statement covers, or None for all of it)."""
        out = []
        for eid, (lo, hi) in self.serial.items():
            a, b = max(lo, rng[0]), min(hi, rng[1])
            if a > b:
                continue
            out.append((eid, None if (a, b) == (lo, hi) else (a, b)))
        return out


def statement(text: str, v: Variants) -> dict | None:
    """The variants a printed run names, when the run is a statement (else None)."""
    t = " ".join((text or "").split())
    if not t:
        return None
    rng = v.serial_range(t)
    named = v.named(t)
    if not named and not rng:
        return None
    rest = t
    for rx in SERIAL:
        rest = rx.sub(" ", rest)
    leftover = []
    owned = set().union(*v.own.values()) if v.own else set()
    for w in _words(rest):
        if w in CONNECTORS or w in owned or any(o.endswith(w) and re.search(r"\d", w) for o in owned):
            continue
        if any(w in _words(e["name"]) for e in v.leaves):
            continue
        leftover.append(w)
    if leftover:
        return None
    return {"named": named, "serial": rng}


def prefix_statement(text: str, v: Variants) -> tuple[dict, int] | None:
    """A statement leading a line and closed by a colon ('DGT-30A1, DGT-30A2: check ...')."""
    m = re.match(r"^\s*(?:\(?(?:\d{1,3}|[a-zA-Z])[.)]\s+)?([^:]{2,80}):\s+\S", text or "")
    if not m:
        return None
    st = statement(m.group(1), v)
    return (st, len(m.group(1).split())) if st else None
