"""eCFR XML (versioner API `full` endpoint) -> section tree with stable citation paths.

Ids: `29cfr1926.1408`, `29cfr1926.1408(a)(2)`, `29cfr1926.1408-table-A`, `29cfr1926.1404-note-1`,
`29cfr1926-subpart-CC`, `29cfr1926.cc.appA` (Appendix A to Subpart CC), `29cfr1926.cc.appC(d)(3)`.

Paragraph levels follow the Federal Register convention: (a) lowercase letter, (1) number,
(i) lowercase roman, (A) capital letter, then italic (a)/(1)/(i) for deeper levels. Markers sit
inline at the start of each <P>, so the level of an ambiguous marker such as "(i)" (letter i or
roman one) is decided from the open paragraph stack and, if still ambiguous, the next marker.
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET

from ..model import Node, ParsedDoc
from ..textutil import norm_ws
from .ecfr_xrefs import extract_xrefs

ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv",
         "xvi", "xvii", "xviii", "xix", "xx", "xxi", "xxii", "xxiii", "xxiv", "xxv", "xxvi", "xxvii",
         "xxviii", "xxix", "xxx", "xxxi", "xxxii", "xxxiii", "xxxiv", "xxxv", "xxxvi", "xxxvii",
         "xxxviii", "xxxix", "xl"]
ROMAN_IDX = {r: i for i, r in enumerate(ROMAN)}

L_LOWER, L_NUM, L_ROMAN, L_UPPER, L_ILOWER, L_INUM, L_IROMAN = 1, 2, 3, 4, 5, 6, 7

_MARK = re.compile(r"\(\s*([a-zA-Z]{1,6}|\d{1,3})\s*\)")


def _letter_index(m: str) -> int | None:
    """a=0..z=25, aa=26..zz=51 (doubled letters continue the sequence)."""
    if re.fullmatch(r"[a-z]", m):
        return ord(m) - 97
    if re.fullmatch(r"([a-z])\1", m):
        return 26 + ord(m[0]) - 97
    return None


def _upper_index(m: str) -> int | None:
    if re.fullmatch(r"[A-Z]", m):
        return ord(m) - 65
    if re.fullmatch(r"([A-Z])\1", m):
        return 26 + ord(m[0]) - 65
    return None


def _candidates(m: str, italic: bool) -> list[tuple[int, int]]:
    """(level, index-in-sequence) pairs this marker could be."""
    out = []
    if m.isdigit():
        out.append((L_INUM if italic else L_NUM, int(m) - 1))
        return out
    li = _letter_index(m)
    if li is not None:
        out.append((L_ILOWER if italic else L_LOWER, li))
    if m in ROMAN_IDX:
        out.append((L_IROMAN if italic else L_ROMAN, ROMAN_IDX[m]))
    ui = _upper_index(m)
    if ui is not None:
        out.append((L_UPPER, ui))
    return out


class _Stack:
    """Open paragraph path: list of (level, index, marker, node)."""

    def __init__(self):
        self.items: list[tuple[int, int, str, Node]] = []

    def valid(self, level: int, idx: int) -> bool:
        # Successor of an open entry at the same level...
        for lv, ix, _, _ in self.items:
            if lv == level:
                return ix + 1 == idx
        # ...or the first of a new, deeper level.
        deepest = self.items[-1][0] if self.items else 0
        return idx == 0 and level > deepest

    def resolve(self, m: str, italic: bool, nxt: str | None) -> tuple[int, int]:
        cands = _candidates(m, italic)
        if not cands:
            raise ValueError(f"not a paragraph marker: ({m})")
        if len(cands) == 1:
            return cands[0]
        ok = [c for c in cands if self.valid(*c)]
        if len(ok) == 1:
            return ok[0]
        pool = ok or cands
        # Ambiguous letter/roman: look at the next marker.
        letter = next((c for c in pool if c[0] in (L_LOWER, L_ILOWER)), None)
        roman = next((c for c in pool if c[0] in (L_ROMAN, L_IROMAN)), None)
        if letter and roman and nxt is not None:
            if nxt in ROMAN_IDX and ROMAN_IDX[nxt] == roman[1] + 1:
                return roman
            li = _letter_index(nxt)
            if li is not None and li == letter[1] + 1 and nxt not in ROMAN_IDX:
                return letter
            if nxt == "1":       # a letter paragraph's first child is (1)
                return letter
            if nxt == "A":       # a roman paragraph's first child is (A)
                return roman
        return roman or pool[0]

    def push(self, level: int, idx: int, marker: str, node: Node):
        while self.items and self.items[-1][0] >= level:
            self.items.pop()
        self.items.append((level, idx, marker, node))

    def path(self) -> list[str]:
        return [mk for _, _, mk, _ in self.items]

    def top(self) -> Node | None:
        return self.items[-1][3] if self.items else None


def _text(el: ET.Element) -> str:
    """Element text with <br/> as a space; whitespace-normalized."""
    parts: list[str] = []

    def rec(e: ET.Element):
        if e.tag == "br":
            parts.append(" ")
        if e.text:
            parts.append(e.text)
        for c in e:
            rec(c)
            if c.tail:
                parts.append(c.tail)

    rec(el)
    return norm_ws("".join(parts))


def _leading_markers(p: ET.Element) -> tuple[list[tuple[str, bool]], str | None, bool]:
    """Markers at the very start of a <P>, whether each is italic, the inline heading, and
    whether further markers follow that heading (a heading-only parent plus a child in one <P>)."""
    raw = ET.tostring(p, encoding="unicode")
    body = re.sub(r"^<P[^>]*>", "", raw)
    marks: list[tuple[str, bool]] = []
    pos = 0
    pat = re.compile(r"\s*\(\s*(?:<I>([a-zA-Z]{1,6}|\d{1,3})</I>|([a-zA-Z]{1,6}|\d{1,3}))\s*\)")
    while True:
        m = pat.match(body, pos)
        if not m:
            break
        tok = m.group(1) or m.group(2)
        if not _candidates(tok, bool(m.group(1))):
            break
        marks.append((tok, bool(m.group(1))))
        pos = m.end()
    heading = None
    trailing = False
    if marks:
        hm = re.match(r"\s*<(I|E)[^>]*>(.*?)</\1>", body[pos:], re.S)
        if hm:
            heading = norm_ws(re.sub(r"<[^>]+>", "", hm.group(2)))
            rest = body[pos + hm.end():]
            if pat.match(rest):
                trailing = True
    return marks, heading, trailing


_LEAD = re.compile(r"\s*\(\s*([a-zA-Z]{1,6}|\d{1,3})\s*\)")
# A first-child marker inline after a heading: "(17) Material delivery. (i) Text", "(c) Cabs—(1) ..."
_INLINE_FIRST = re.compile(r"(?<=[.\u2014])\s*(?=\((?:i|1|a|A)\)\s*\S)")


def _plain_markers(text: str) -> list[str]:
    out, pos = [], 0
    while True:
        m = _LEAD.match(text, pos)
        if not m or not _candidates(m.group(1), False):
            return out
        out.append(m.group(1))
        pos = m.end()


def _strip_markers(text: str) -> str:
    pos = 0
    while True:
        m = _LEAD.match(text, pos)
        if not m:
            return text[pos:].strip()
        pos = m.end()


def _split_inline(text: str) -> list[str]:
    """Split '(c) Cabs—(1) Cab location. (i) Body' into ['(c) Cabs—', '(1) Cab location.', '(i) Body'].

    Only a first-of-level marker ((i), (1), (a), (A)) that follows a short heading ending in a
    period or em dash starts a new paragraph; anything else stays inside the text."""
    segs = []
    rest = text
    while True:
        head_end = len(_LEAD.match(rest).group(0)) if _LEAD.match(rest) else 0
        while _LEAD.match(rest, head_end):
            head_end = _LEAD.match(rest, head_end).end()
        cut = None
        for m in _INLINE_FIRST.finditer(rest, head_end):
            if m.start() - head_end <= 120:
                cut = m
            break
        if cut is None:
            segs.append(rest.strip())
            return segs
        segs.append(rest[: cut.start()].strip())
        rest = rest[cut.end():]


def _table_text(tbl: ET.Element) -> tuple[str | None, str]:
    cap = tbl.find("CAPTION")
    caption = _text(cap) if cap is not None else None
    lines = [caption] if caption else []
    for tr in tbl.iter("TR"):
        cells = [_text(c) for c in tr if c.tag in ("TD", "TH")]
        lines.append(" | ".join(cells))
    return caption, "\n".join(lines)


def _gpotable_text(tbl: ET.Element) -> tuple[str | None, str]:
    """Older GPOTABLE markup: TTITLE, BOXHD/CHED, ROW/ENT."""
    tt = tbl.find("TTITLE")
    caption = _text(tt) if tt is not None and _text(tt) else None
    lines = [caption] if caption else []
    heads = [_text(c) for c in tbl.iter("CHED")]
    if heads:
        lines.append(" | ".join(heads))
    for row in tbl.iter("ROW"):
        lines.append(" | ".join(_text(c) for c in row if c.tag == "ENT"))
    return caption, "\n".join(lines)


def _table_label(caption: str | None, n: int) -> str:
    if caption:
        m = re.match(r"\s*Table\s+([A-Z0-9][\w.-]*)", caption)
        if m:
            return m.group(1).rstrip(".-")
    return str(n)


class _SectionParser:
    def __init__(self, doc: ParsedDoc, base_id: str, cite_base: str, root: Node, ecfr_graphics: str):
        self.doc = doc
        self.base_id = base_id        # '29cfr1926.1408'
        self.cite_base = cite_base    # '§1926.1408'
        self.root = root
        self.stack = _Stack()
        self.counts: dict[str, int] = {}
        self.ids: set[str] = set()
        self.graphics = ecfr_graphics

    def _uid(self, sid: str) -> str:
        if sid not in self.ids:
            self.ids.add(sid)
            return sid
        k = 2
        while f"{sid}~{k}" in self.ids:
            k += 1
        self.doc.warnings.append(f"duplicate paragraph id {sid}; kept as {sid}~{k}")
        self.ids.add(f"{sid}~{k}")
        return f"{sid}~{k}"

    def _current(self) -> Node:
        return self.stack.top() or self.root

    def _count(self, key: str) -> int:
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key]

    def _append_text(self, node: Node, text: str):
        node.own_text = f"{node.own_text}\n{text}" if node.own_text else text

    def _paragraph(self, marks, heading, text, nxt):
        for i, (mk, italic) in enumerate(marks):
            following = marks[i + 1][0] if i + 1 < len(marks) else nxt
            level, idx = self.stack.resolve(mk, italic, following)
            parent = self.root
            # parent = deepest open entry with a smaller level
            for lv, _, _, nd in reversed(self.stack.items):
                if lv < level:
                    parent = nd
                    break
            self.stack.push(level, idx, mk, Node("", "paragraph", ""))
            path = "".join(f"({m})" for m in self.stack.path())
            sid = self._uid(self.base_id + path)
            node = self.stack.items[-1][3]
            node.section_id = sid
            node.citation = self.cite_base + ("" if self.cite_base.startswith("§") else " ") + path
            parent.add(node)
            if i == len(marks) - 1:
                node.own_text = text
                node.heading = heading.rstrip(".") if heading else None

    def handle_p(self, el: ET.Element, nxt_marker: str | None):
        text = _text(el)
        if not text:
            return
        marks0, heading0, _ = _leading_markers(el)
        if not marks0:
            self._append_text(self._current(), text)
            return
        segs = _split_inline(text)
        for k, seg in enumerate(segs):
            if k == 0:
                marks = marks0
            else:
                marks = [(m, False) for m in _plain_markers(seg)]
            last = k == len(segs) - 1
            if k == 0 and heading0 and heading0 in seg:
                heading = heading0
            elif not last:
                heading = _strip_markers(seg)
            else:
                heading = None
            nxt = _plain_markers(segs[k + 1])[0] if not last else nxt_marker
            self._paragraph(marks, heading.rstrip(".—:- ") if heading else None, seg, nxt)

    def handle_table(self, el: ET.Element, gpo: bool = False):
        caption, text = (_gpotable_text if gpo else _table_text)(el)
        n = self._count("table")
        label = _table_label(caption, n)
        sid = self._uid(f"{self.base_id}-table-{label}")
        cite = f"Table {label} to {self.cite_base}" if caption else f"{self.cite_base} table {n}"
        self._current().add(Node(sid, "table", cite, heading=caption, own_text=text))

    def handle_note(self, el: ET.Element):
        hed = el.find("HED")
        n = self._count("note")
        lines = [_text(c) for c in el if c.tag in ("HED", "P", "FP", "PSPACE")]
        text = "\n".join(t for t in lines if t)
        sid = self._uid(f"{self.base_id}-note-{n}")
        self._current().add(Node(sid, "note", f"{self.cite_base} note {n}",
                                 heading=_text(hed) if hed is not None else "Note", own_text=text))

    def handle_img(self, el: ET.Element):
        src = el.get("src", "")
        n = self._count("fig")
        url = src if src.startswith("http") else self.graphics + src
        sid = self._uid(f"{self.base_id}-fig-{n}")
        node = Node(sid, "figure", f"{self.cite_base} figure {n}", heading=f"Figure {n}",
                    own_text=f"[Figure: {url}]", meta={"src": url})
        self._current().add(node)

    def run(self, div: ET.Element):
        flat = list(_flatten(div))
        markers = []
        for kind, el in flat:
            if kind == "P":
                mk, _, _ = _leading_markers(el)
                markers.append(mk[0][0] if mk else None)
            else:
                markers.append(None)
        for i, (kind, el) in enumerate(flat):
            nxt = next((m for m in markers[i + 1:] if m), None)
            if kind == "P":
                self.handle_p(el, nxt)
            elif kind == "TABLE":
                self.handle_table(el)
            elif kind == "GPOTABLE":
                self.handle_table(el, gpo=True)
            elif kind == "NOTE":
                self.handle_note(el)
            elif kind == "img":
                self.handle_img(el)


def _escape(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _flatten(div: ET.Element):
    """Content blocks of a section/appendix in document order."""
    for el in div:
        tag = el.tag
        if tag in ("HEAD", "CITA", "SECAUTH", "AUTH", "SOURCE", "EDNOTE"):
            continue
        if tag in ("P", "FP"):
            yield "P", el
            for img in el.iter("img"):
                yield "img", img
        elif tag in ("NOTE", "NOTES"):
            yield "NOTE", el
        elif tag == "TABLE":
            yield "TABLE", el
        elif tag == "GPOTABLE":
            yield "GPOTABLE", el
        elif tag == "img":
            yield "img", el
        elif tag in ("DIV", "EXTRACT", "GPH", "APPRO", "FTNT"):
            yield from _flatten(el)
        elif tag.startswith("DIV"):
            continue  # nested hierarchy divisions are handled by the walker
        else:
            for img in el.iter("img"):
                yield "img", img


_SEC_NUM = re.compile(r"^\s*§+\s*([\d.]+[a-z]?)\s*(.*)$")


def parse_ecfr(data: bytes, source_id: str, title: int, options: dict | None = None) -> ParsedDoc:
    """Parse one eCFR `full` XML response (a part, subpart or section)."""
    options = options or {}
    graphics = options.get("graphics_base", "https://www.ecfr.gov")
    root_el = ET.fromstring(data)
    doc = ParsedDoc(source_id=source_id, roots=[])
    prefix = f"{title}cfr"

    def section(div: ET.Element, parent: Node | None, part: str | None):
        num = div.get("N", "")
        head = _text(div.find("HEAD")) if div.find("HEAD") is not None else ""
        m = _SEC_NUM.match(head)
        heading = m.group(2).rstrip(".") if m else head
        base = f"{prefix}{num}"
        node = Node(base, "section", f"§{num}", heading=heading, own_text=head)
        if parent:
            parent.add(node)
        else:
            doc.roots.append(node)
        _SectionParser(doc, base, f"§{num}", node, graphics).run(div)
        return node

    def appendix(div: ET.Element, parent: Node | None, part: str | None, subpart: str | None):
        name = div.get("N", "")  # 'Appendix A to Subpart CC of Part 1926'
        head = _text(div.find("HEAD")) if div.find("HEAD") is not None else name
        m = re.match(r"Appendix\s+([A-Z0-9]+)", name)
        letter = m.group(1) if m else str(len(parent.children) if parent else 0)
        # '29cfr1926.cc.appA' (Appendix A to Subpart CC of Part 1926); '29cfr1910.appA' without a subpart
        base = f"{prefix}{part}" + (f".{subpart.lower()}" if subpart else "") + f".app{letter}"
        node = Node(base, "appendix", name, heading=head, own_text=head)
        if parent:
            parent.add(node)
        else:
            doc.roots.append(node)
        _SectionParser(doc, base, name, node, graphics).run(div)

    def walk(el: ET.Element, parent: Node | None, part: str | None, subpart: str | None):
        typ = el.get("TYPE", "")
        if typ == "SECTION":
            section(el, parent, part)
        elif typ == "APPENDIX":
            appendix(el, parent, part, subpart)
        elif typ == "PART":
            n = el.get("N")
            head = _text(el.find("HEAD")) if el.find("HEAD") is not None else f"Part {n}"
            node = Node(f"{prefix}{n}", "part", f"{title} CFR Part {n}", heading=head, own_text=head)
            (parent.add(node) if parent else doc.roots.append(node))
            for c in el:
                walk(c, node, n, None)
        elif typ == "SUBPART":
            n = el.get("N")
            part_n = part or _part_from_meta(el) or options.get("part")
            head = _text(el.find("HEAD")) if el.find("HEAD") is not None else f"Subpart {n}"
            node = Node(f"{prefix}{part_n}-subpart-{n}", "subpart", f"Subpart {n} of Part {part_n}",
                        heading=head, own_text=head)
            (parent.add(node) if parent else doc.roots.append(node))
            for c in el:
                walk(c, node, part_n, n)
        elif el.tag.startswith("DIV"):  # title, chapter, subchapter, subject group: transparent
            for c in el:
                walk(c, parent, part, subpart)

    walk(root_el, None, options.get("part"), options.get("subpart"))
    doc.xrefs = extract_xrefs(doc, prefix)
    return doc


def _part_from_meta(el: ET.Element) -> str | None:
    meta = el.get("hierarchy_metadata", "")
    m = re.search(r"part-(\d+)", meta)
    return m.group(1) if m else None
