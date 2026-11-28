"""Applicability as printed: which variants a statement names, and what it is printed on.

A statement is a printed run that names variants and nothing else: model names or the part that
tells them apart ("RK-5A1, RK-5A2", "A2 ONLY", "Diesel models only"), or a serial range
("Serial numbers 1250 and subsequent", "S/N 1001 thru 1249"), with only connectors around them
(and, or, commas, ONLY, MODELS, parentheses). A sentence that merely mentions a model ("On the A2
the indication is on the display") is not a statement and scopes nothing.

Variants are named by their distinguishing words: the words of a variant's name that no other
variant's name has ("5" for RK-5 beside RK-5A1), or a token that only one variant's distinguishing
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
    if not named and not rng and not parse_conditions(t, v)[0]:
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
        # words of a finer condition (PRE SB 31-007, model year 2026, firmware 2.4 and later, rev B) are part
        # of the statement too
        cond, _ = parse_conditions(t, v)
        cond_words = {"pre", "post", "sb", "mod", "service", "bulletin", "year", "my", "firmware", "hardware",
                      "revision", "revisions", "rev", "later", "newer", "up", "subsequent", "applies", "to", "only",
                      "and", "or", "all", "from", "updates", "s", "n"}
        rest = [w for w in leftover if w not in cond_words and not re.fullmatch(r"[\da-z]?\d[\d.]*|[a-z]", w)]
        if not cond or rest:
            return None
        return {"named": named, "serial": rng, "cond": cond, "text": t}
    cond, _ = parse_conditions(t, v)
    return {"named": named, "serial": rng, "cond": cond, "text": t}


def prefix_statement(text: str, v: Variants) -> tuple[dict, int] | None:
    """A statement leading a line and closed by a colon ('RK-5A1, RK-5A2: check ...')."""
    m = re.match(r"^\s*(?:\(?(?:\d{1,3}|[a-zA-Z])[.)]\s+)?([^:]{2,80}):\s+\S", text or "")
    if m:
        st = statement(m.group(1), v)
        if st:
            return st, len(m.group(1).split()), m.group(1) + ":"
    # a parenthesised statement leading a step: "(3) (RX-8 PRE SB 31-007) Do the adjustment."
    m = re.match(r"^\s*(?:\(?(?:\d{1,3}|[a-zA-Z])[.)]\s+)?(\([^()]{2,80}\))\s+\S", text or "")
    if m:
        st = statement(m.group(1), v)
        if st:
            return st, len(m.group(1).split()), m.group(1)
    return None


# ---- conditions over declared attributes (pack_meta.attributes, applic rows) ---------------------------
ATTRS = {"model": {"id": "model", "label": "Model", "type": "text", "source": "plate"},
         "serial": {"id": "serial", "label": "Serial number", "type": "serial", "source": "plate"},
         "model_year": {"id": "model_year", "label": "Model year", "type": "number", "source": "plate"},
         "firmware": {"id": "firmware", "label": "Firmware version", "type": "version", "source": "vehicle"},
         "hardware_revision": {"id": "hardware_revision", "label": "Hardware revision", "type": "text",
                               "source": "plate"}}
_SER = r"(?:[A-Z]{1,3}\d?-)?\d{3,}"


def _serial_tests(c: str) -> list[dict]:
    out = []
    for m in re.finditer(rf"(?i)(?:\bS/?N|serial(?:\s+(?:numbers?|nos?\.?))?)?\s*({_SER})\s*(?:-|–|through|thru|to)\s*({_SER})\b", c):
        if re.search(r"(?i)s/?n|serial", c) or re.match(r"[A-Z]", m.group(1)):
            out.append({"attr": "serial", "op": "range", "min": m.group(1), "max": m.group(2)})
    for m in re.finditer(rf"(?i)(?:\bS/?N|serial(?:\s+(?:numbers?|nos?\.?))?)\s*({_SER})\s+and\s+(?:on|up|subsequent|later|above)", c):
        out.append({"attr": "serial", "op": "range", "min": m.group(1)})
    for m in re.finditer(rf"\b([A-Z]{{1,3}}\d?-\d{{3,}})\s+and\s+(?:on|up|subsequent|later|above)", c):
        if not any(t.get("min") == m.group(1) for t in out):
            out.append({"attr": "serial", "op": "range", "min": m.group(1)})
    return out


def parse_conditions(text: str, v: "Variants") -> tuple[dict | None, set[str]]:
    """A printed statement as a condition over attributes, and the attributes it names. Clauses separated by
    ';' are alternatives; inside one clause everything must hold. None when it says nothing finer than which
    models (those go to applies_to)."""
    clauses = [c.strip() for c in re.split(r";", text or "") if c.strip()]
    anys, used, finer = [], set(), False
    for c in clauses:
        tests = []
        names = [e["name"] for e in v.leaves if e["equip_id"] in v.named(c)]
        if names:
            tests.append({"attr": "model", "op": "in", "values": names} if len(names) > 1 else
                         {"attr": "model", "op": "eq", "value": names[0]})
            used.add("model")
        for m in re.finditer(r"(?i)\b(pre|post)[\s-]+((?:sb|mod|service bulletin)[\s-]*[a-z0-9][\w-]*)", c):
            aid = re.sub(r"[^a-z0-9]+", "_", m.group(2).lower()).strip("_")
            ATTRS.setdefault(aid, {"id": aid, "label": m.group(2).upper(), "type": "text", "source": "manual"})
            tests.append({"attr": aid, "op": "eq", "value": m.group(1).lower()})
            used.add(aid)
            finer = True
        for t in _serial_tests(c):
            tests.append(t)
            used.add("serial")
            finer = True
        for m in re.finditer(r"(?i)\b(?:model\s+year|MY)\s*(\d{4})\b|\b(\d{4})\s+model\s+year", c):
            tests.append({"attr": "model_year", "op": "eq", "value": int(m.group(1) or m.group(2))})
            used.add("model_year")
            finer = True
        m = re.search(r"(?i)firmware\s+(\d+(?:\.\d+)+)\s*(?:to|through|-)\s*(\d+(?:\.\d+)+)", c)
        if m:
            tests.append({"attr": "firmware", "op": "range", "min": m.group(1), "max": m.group(2)})
        else:
            m = re.search(r"(?i)firmware\s+(\d+(?:\.\d+)+)(\s*(?:and|or)\s+(?:later|newer|above|up)|\+)?", c)
            if m:
                tests.append({"attr": "firmware", "op": "ge" if m.group(2) else "eq", "value": m.group(1)})
        if m:
            used.add("firmware")
            finer = True
        m = re.search(r"(?i)\b(?:hardware\s+)?rev(?:ision)?s?\.?\s+([A-Z](?:\s*(?:,|and|or|/)\s*[A-Z])*)\b", c)
        if m:
            vals = re.findall(r"[A-Z]", m.group(1))
            tests.append({"attr": "hardware_revision", "op": "in", "values": vals} if len(vals) > 1 else
                         {"attr": "hardware_revision", "op": "eq", "value": vals[0]})
            used.add("hardware_revision")
            finer = True
        if tests:
            anys.append(tests[0] if len(tests) == 1 else {"all": tests})
    if not finer or not anys:
        return None, set()
    return (anys[0] if len(anys) == 1 else {"any": anys}), used


def attribute_decls(used: set[str]) -> list[dict]:
    order = ["model", "serial", "model_year", "firmware", "hardware_revision"]
    return [ATTRS[a] for a in order if a in used] + [ATTRS[a] for a in sorted(used) if a not in order and a in ATTRS]
