"""Generic XML / SGML manuals -> outline blocks, driven by a configurable element map.

Well-formed XML parses with ElementTree. SGML (unclosed tags, undeclared entities, DOCTYPE
subsets) falls back to a tolerant tree builder. Element names are matched case-insensitively.

`parser_options.element_map` overrides any of (defaults shown):

    section: [chapter, section, sect1, sect2, sect3, sect4, sect5, part, appendix, wp, task, subtask, level1, level2, level3, level4]
    heading: [title, head, heading, hd]
    para:    [para, p, simpara, text]
    item:    [listitem, item, li, step]
    list:    [list, itemizedlist, orderedlist, randlist, seqlist, ul, ol, proclist]
    table:   [table, informaltable]
    row:     [row, tr]
    cell:    [entry, td, th, cell]
    figure:  [figure, graphic, img, image]
    note:    [note, caution, warning, danger]
    skip:    [indexterm, remark, comment]
    number_attrs: [num, number, label, id]   # first present attribute prefixes the heading for ids
"""

from __future__ import annotations

import html.entities
import re
import xml.etree.ElementTree as ET
from html.parser import HTMLParser

from ..model import ParsedDoc
from . import register
from .outline import Block, build_doc

DEFAULT_MAP = {
    "section": ["chapter", "section", "sect1", "sect2", "sect3", "sect4", "sect5", "part", "appendix", "wp", "task",
                "subtask", "level1", "level2", "level3", "level4"],
    "heading": ["title", "head", "heading", "hd"],
    "para": ["para", "p", "simpara", "text"],
    "item": ["listitem", "item", "li", "step"],
    "list": ["list", "itemizedlist", "orderedlist", "randlist", "seqlist", "ul", "ol", "proclist"],
    "table": ["table", "informaltable"],
    "row": ["row", "tr"],
    "cell": ["entry", "td", "th", "cell"],
    "figure": ["figure", "graphic", "img", "image"],
    "note": ["note", "caution", "warning", "danger"],
    "skip": ["indexterm", "remark", "comment"],
    "number_attrs": ["num", "number", "label"],
}


class _Tolerant(HTMLParser):
    """Builds an ElementTree from SGML-ish markup; unclosed elements close at their parent's end."""

    def __init__(self, empty: set[str], leaves: set[str], blocks: set[str]):
        super().__init__(convert_charrefs=True)
        self.root = ET.Element("_root")
        self.stack = [self.root]
        self.empty = empty
        self.leaves = leaves      # text elements whose end tag SGML may omit (title, para, step)
        self.blocks = blocks      # starting one of these closes an open leaf

    @staticmethod
    def _name(tag: str) -> str:
        tag = tag.lower()
        return tag[3:] if tag.startswith("sg-") else tag

    def handle_starttag(self, tag, attrs):
        tag = self._name(tag)
        if tag in self.blocks:
            while len(self.stack) > 1 and self.stack[-1].tag in self.leaves:
                self.stack.pop()
        el = ET.SubElement(self.stack[-1], tag, {k: v or "" for k, v in attrs})
        if tag not in self.empty:
            self.stack.append(el)

    def handle_startendtag(self, tag, attrs):
        ET.SubElement(self.stack[-1], self._name(tag), {k: v or "" for k, v in attrs})

    def handle_endtag(self, tag):
        tag = self._name(tag)
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        cur = self.stack[-1]
        if len(cur):
            cur[-1].tail = (cur[-1].tail or "") + data
        else:
            cur.text = (cur.text or "") + data


def _strip_ns(el: ET.Element) -> None:
    for e in el.iter():
        if isinstance(e.tag, str) and "}" in e.tag:
            e.tag = e.tag.split("}", 1)[1]
        if isinstance(e.tag, str):
            e.tag = e.tag.lower()


def load_tree(data: bytes, element_map: dict | None = None) -> ET.Element:
    text = data.decode("utf-8", errors="replace")
    try:
        root = ET.fromstring(data)
        _strip_ns(root)
        return root
    except ET.ParseError:
        pass
    text = re.sub(r"<!DOCTYPE[^\[>]*(\[.*?\])?\s*>", "", text, flags=re.S)
    text = re.sub(r"<\?.*?\?>", "", text, flags=re.S)
    known = html.entities.name2codepoint

    def ent(m):
        name = m.group(1)
        return m.group(0) if name in known or name in ("amp", "lt", "gt", "quot", "apos") else " "

    text = re.sub(r"&([A-Za-z][A-Za-z0-9.]*);", ent, text)
    m = {**DEFAULT_MAP, **(element_map or {})}
    leaves = set(m["heading"]) | set(m["para"]) | set(m["item"])
    blocks = leaves | set(m["section"]) | set(m["table"]) | set(m["note"]) | set(m["list"]) | set(m["figure"])
    p = _Tolerant({"graphic", "img", "image", "br", "xref", "colspec", "spanspec"}, leaves, blocks)
    # prefix every tag name so html.parser applies no HTML rules (e.g. raw-text <title>)
    p.feed(re.sub(r"<(/?)([A-Za-z])", r"<\1sg-\2", text))
    p.close()
    return p.root


def _text(el: ET.Element, skip: set[str]) -> str:
    parts = []

    def rec(e):
        if e.tag in skip:
            if e.tail:
                parts.append(e.tail)
            return
        if e.text:
            parts.append(e.text)
        for c in e:
            rec(c)
        if e.tail and e is not el:
            parts.append(e.tail)

    rec(el)
    return " ".join("".join(parts).split())


def xml_blocks(root: ET.Element, element_map: dict | None = None) -> list[Block]:
    m = {k: (set(v) if isinstance(v, list) and k != "number_attrs" else v)
         for k, v in {**DEFAULT_MAP, **(element_map or {})}.items()}
    skip = set(m["skip"])
    blocks: list[Block] = []

    def walk(el: ET.Element, depth: int, list_depth: int):
        tag = el.tag
        if tag in skip:
            return
        if tag in m["section"]:
            head = next((c for c in el if c.tag in m["heading"]), None)
            title = _text(head, skip) if head is not None else ""
            num = next((el.get(a) for a in m["number_attrs"] if el.get(a)), None)
            if num and not title.startswith(num):
                title = f"{num} {title}".strip()
            if tag == "appendix" and not title.lower().startswith("appendix"):
                title = f"Appendix {num or ''} {title}".replace("  ", " ").strip()
            if title:
                blocks.append(Block("heading", title, level=depth + 1))
            for c in el:
                if c is not head:
                    walk(c, depth + 1, list_depth)
            return
        if tag in m["heading"]:
            blocks.append(Block("heading", _text(el, skip), level=depth + 1))
            return
        if tag in m["table"]:
            caption_el = next((c for c in el if c.tag in m["heading"] or c.tag == "caption"), None)
            rows = [[_text(c, skip) for c in r if c.tag in m["cell"]] for r in el.iter() if r.tag in m["row"]]
            blocks.append(Block("table", rows=[r for r in rows if r],
                                caption=_text(caption_el, skip) if caption_el is not None else None))
            return
        if tag in m["figure"]:
            cap = next((c for c in el if c.tag in m["heading"] or c.tag in ("caption", "figcaption")), None)
            src = el.get("src") or el.get("boardno") or el.get("fileref") or el.get("entityref") or \
                next((g.get("src") or g.get("boardno") or g.get("fileref") for g in el.iter() if g is not el and
                      g.tag in m["figure"]), None)
            blocks.append(Block("figure", caption=_text(cap, skip) if cap is not None else None, src=src))
            return
        if tag in m["note"]:
            t = _text(el, skip)
            if t:
                label = tag.upper()
                blocks.append(Block("note", t if t.upper().startswith(label) else f"{label}: {t}"))
            return
        if tag in m["list"]:
            for c in el:
                walk(c, depth, list_depth + 1)
            return
        if tag in m["item"]:
            own = [c for c in el if c.tag in m["para"]]
            nested = [c for c in el if c.tag not in m["para"]]
            text = " ".join(_text(c, skip) for c in own) if own else _text(el, skip)
            if own or not any(c.tag in m["list"] for c in el):
                blocks.append(Block("item", text, level=max(1, list_depth)))
            for c in nested:
                walk(c, depth, list_depth + 1)
            return
        if tag in m["para"]:
            t = _text(el, skip)
            if t:
                blocks.append(Block("para", t))
            return
        if el.text and el.text.strip() and not len(el):
            blocks.append(Block("para", el.text))
            return
        for c in el:
            walk(c, depth, list_depth)

    walk(root, 0, 0)
    return blocks


@register("xml")
def parse_xml(data: bytes, source_id: str, options: dict) -> ParsedDoc:
    em = options.get("element_map")
    return build_doc(xml_blocks(load_tree(data, em), em), source_id, options)


@register("sgml")
def parse_sgml(data: bytes, source_id: str, options: dict) -> ParsedDoc:
    return parse_xml(data, source_id, options)
