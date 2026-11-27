"""Cross-references in CFR text -> xref rows.

Recognized:
  "§ 1926.1404(d)", "§§ 1926.1417 through 1926.1425", "section 1926.1430(c)", "1910.179(b)(2)"
  "paragraph (b)(3)(v) of this section", "paragraphs (j)(1) and (2) of this section"
  "Table A of this section", "appendix A of this subpart", "subpart V of this part"
  "ASME B30.5-2004"  (kind 'standard': cited by number only, never ingested)

kind: 'cites' (target in this corpus; to_id is the deepest existing ancestor of the cited path),
'external' (target not in this corpus; to_id is the cited path), 'standard'.
"""

from __future__ import annotations

import re

from ..model import Node, ParsedDoc, Xref

_PATH = r"(?:\(\s*(?:[a-zA-Z]{1,6}|\d{1,3})\s*\))+"
_SECNUM = r"\d{1,4}\.\d{1,4}[a-z]?"
_SEC_REF = re.compile(
    rf"(?:§§?\s*|\b[Ss]ections?\s+|\bsec\.\s*)?(?<![\w.])({_SECNUM})((?:{_PATH})?)"
    rf"(?:\s*(?:through|to|-|–)\s*(?:§\s*)?({_SECNUM}))?"
)
_SEC_LIST_TAIL = re.compile(rf"\s*(?:,|,?\s*and|,?\s*or)\s*(?:§\s*)?({_SECNUM})((?:{_PATH})?)")
_PARA_REF = re.compile(
    rf"\bparagraphs?\s+({_PATH}(?:\s*(?:,|and|or|through)\s*{_PATH})*)\s+of\s+this\s+(section|appendix)"
)
_TABLE_REF = re.compile(r"\bTables?\s+([A-Z][A-Z0-9]?\d?)(?:\s+(?:and|through)\s+([A-Z][A-Z0-9]?\d?))?\s+of\s+this\s+section")
_APPX_REF = re.compile(r"\b[Aa]ppendix\s+([A-Z])\s+(?:of|to)\s+this\s+subpart")
_SUBPART_REF = re.compile(r"\bsubpart\s+([A-Z]{1,3})\s+of\s+this\s+part")
_ASME = re.compile(r"\b(?:ASME|ANSI(?:/ASME)?)\s+(B\d+(?:\.\d+)*[a-z]?(?:\s*[-–]\s*\d{4})?)")

_MARK = re.compile(r"\(\s*([a-zA-Z]{1,6}|\d{1,3})\s*\)")


def _marks(path: str) -> list[str]:
    return _MARK.findall(path)


def _kind_of(m: str) -> str:
    if m.isdigit():
        return "num"
    if m.isupper():
        return "upper"
    if re.fullmatch(r"[ivxl]+", m) and m not in ("i", "v", "x", "l"):
        return "roman"
    return "lower_or_roman"


def _compatible(a: str, b: str) -> bool:
    ka, kb = _kind_of(a), _kind_of(b)
    if ka == kb:
        return True
    return {ka, kb} == {"roman", "lower_or_roman"}


def _expand_list(spec: str) -> list[list[str]]:
    """'(j)(1) and (2)' -> [['j','1'], ['j','2']]; '(a), (b)' -> [['a'], ['b']]."""
    pieces = re.split(r"\s*(?:,|\band\b|\bor\b|\bthrough\b)\s*", spec)
    out: list[list[str]] = []
    prev: list[str] | None = None
    for piece in pieces:
        ms = _marks(piece)
        if not ms:
            continue
        if prev is None:
            out.append(ms)
        else:
            # Relative tail: replace from the position whose marker type matches.
            k = next((i for i in range(len(prev) - 1, -1, -1) if _compatible(prev[i], ms[0])), None)
            if k is None or k == 0 and len(ms) >= len(prev):
                out.append(ms)
            else:
                out.append(prev[:k] + ms)
        prev = out[-1]
    return out


def _section_id(prefix: str, num: str, marks: list[str]) -> str:
    return f"{prefix}{num}" + "".join(f"({m})" for m in marks)


def _section_base(node_id: str) -> str:
    return re.sub(r"[(\-~].*$", "", node_id)


def extract_xrefs(doc: ParsedDoc, prefix: str) -> list[Xref]:
    ids = doc.by_id()
    found: dict[tuple[str, str, str], None] = {}

    def resolve(target: str) -> tuple[str, str]:
        t = target
        while t:
            if t in ids:
                return t, "cites"
            if "(" not in t:
                break
            t = t[: t.rfind("(")]
        return target, "external"

    def add(frm: str, target: str):
        to, kind = resolve(target)
        if to != frm:
            found[(frm, to, kind)] = None

    for node, _ in doc.walk():
        text = node.own_text
        if not text or node.kind in ("part", "subpart", "figure"):
            continue
        base = _section_base(node.section_id)
        # appendix ids keep their full base ('29cfr1926-subpart-CC-appendix-C')
        if node.kind == "appendix" or "-appendix-" in node.section_id:
            base = re.sub(r"(-appendix-[A-Z0-9]+).*$", r"\1", node.section_id)
        own_head = node.own_text.split("\n", 1)[0] if node.kind in ("section", "appendix") else ""

        for m in _SEC_REF.finditer(text):
            if own_head and m.start() < len(own_head):
                continue  # the section's own heading line
            start_num, path, end_num = m.group(1), m.group(2), m.group(3)
            explicit = bool(re.search(r"(§|[Ss]ections?|sec\.)\s*$", text[max(0, m.start() - 12): m.start(1)]))
            if not explicit and not re.fullmatch(r"\d{4}\.\d{1,4}[a-z]?", start_num):
                continue  # bare decimals ("0.75 kV") are not references
            add(node.section_id, _section_id(prefix, start_num, _marks(path)))
            if end_num:
                a, b = start_num.split("."), end_num.split(".")
                if a[0] == b[0] and a[1].isdigit() and b[1].isdigit() and 0 < int(b[1]) - int(a[1]) <= 60:
                    for k in range(int(a[1]) + 1, int(b[1]) + 1):
                        add(node.section_id, f"{prefix}{a[0]}.{k}")
            # "§§ 1926.1437, 1926.1439, and 1926.1441"
            pos = m.end()
            while True:
                t = _SEC_LIST_TAIL.match(text, pos)
                if not t:
                    break
                add(node.section_id, _section_id(prefix, t.group(1), _marks(t.group(2))))
                pos = t.end()

        for m in _PARA_REF.finditer(text):
            for marks in _expand_list(m.group(1)):
                add(node.section_id, base + "".join(f"({x})" for x in marks))

        for m in _TABLE_REF.finditer(text):
            for label in filter(None, (m.group(1), m.group(2))):
                add(node.section_id, f"{base}-table-{label}")

        part = re.match(rf"{prefix}(\d+)", base)
        subpart = None
        anc = node
        while anc is not None:
            sm = re.search(r"-subpart-([A-Z]+)$", anc.section_id)
            if sm:
                subpart = sm.group(1)
                break
            anc = ids.get(anc.parent_id) if anc.parent_id else None
        if part:
            p = part.group(1)
            for m in _APPX_REF.finditer(text):
                if subpart:
                    add(node.section_id, f"{prefix}{p}-subpart-{subpart}-appendix-{m.group(1)}")
            for m in _SUBPART_REF.finditer(text):
                add(node.section_id, f"{prefix}{p}-subpart-{m.group(1)}")

        for m in _ASME.finditer(text):
            std = re.sub(r"\s+", "", m.group(1)).replace("–", "-")
            found[(node.section_id, f"asme:{std}", "standard")] = None

    return [Xref(f, t, k) for (f, t, k) in found]
