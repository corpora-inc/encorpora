"""Common outline builder for document formats without a native citation scheme.

Format parsers (PDF, OCR, DOCX, HTML, Markdown, XML/SGML) emit a flat list of Blocks; this module
turns them into a section tree with stable ids:

  heading  -> kind 'section' (or 'appendix' when it reads "Appendix X"), nested by level
  para     -> kind 'paragraph'
  item     -> kind 'paragraph' (list item), nested under the preceding paragraph by list level
  table    -> kind 'table'   (rows joined with " | ")
  figure   -> kind 'figure'  (text "[Figure: src]"; caption as heading)
  note     -> kind 'note'    (NOTE / CAUTION / WARNING / DANGER blocks)

Ids: `<prefix>:<number>` when a heading or paragraph carries a section number the options'
`number_regex` recognizes (e.g. "16.A.01", "11-3", "4.2.1"); otherwise `<parent>/<slug>` for headings
and `<parent>-p<n>` for paragraphs, so ids are stable while the outline is unchanged.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from ..model import Node, ParsedDoc
from ..textutil import norm_ws, slug

DEFAULT_NUMBER = r"^(?:(?:Section|Chapter|Part|Article)\s+)?(\d+(?:[.\-][0-9A-Z]+)*)(?=[.:)\s]|$)"
_NOTE = re.compile(r"^\s*(NOTE|NOTES|CAUTION|WARNING|DANGER)\b\s*[:.\-—]?", re.I)
_APPX = re.compile(r"^\s*Appendix\s+([A-Z0-9]+)\b", re.I)


@dataclass
class Block:
    kind: str                       # heading | para | item | table | figure | note
    text: str = ""
    level: int = 1                  # heading level or list depth
    rows: list[list[str]] = field(default_factory=list)
    caption: str | None = None
    src: str | None = None
    page: int | None = None


def table_text(rows: list[list[str]], caption: str | None) -> str:
    lines = [caption] if caption else []
    for r in rows:
        cells = [norm_ws(c or "") for c in r]
        if any(cells):
            lines.append(" | ".join(cells))
    return "\n".join(lines)


def build_doc(blocks: list[Block], source_id: str, options: dict | None = None) -> ParsedDoc:
    o = options or {}
    prefix = o.get("id_prefix", source_id)
    cite_prefix = o.get("citation_prefix", "")
    num_rx = re.compile(o.get("number_regex", DEFAULT_NUMBER))
    para_num_rx = re.compile(o["para_number_regex"]) if o.get("para_number_regex") else None
    detect_notes = o.get("detect_notes", True)
    doc = ParsedDoc(source_id=source_id, roots=[])
    root = Node(prefix, "section", o.get("title_citation", cite_prefix or prefix),
                heading=o.get("title"), own_text=o.get("title") or "")
    if o.get("root_node", False):
        doc.roots.append(root)
    used: set[str] = set()
    heading_stack: list[tuple[int, Node]] = []
    counters: dict[str, int] = {}
    last_para: Node | None = None
    item_stack: list[tuple[int, Node]] = []

    def uid(sid: str) -> str:
        if sid not in used:
            used.add(sid)
            return sid
        k = 2
        while f"{sid}~{k}" in used:
            k += 1
        used.add(f"{sid}~{k}")
        return f"{sid}~{k}"

    def container() -> Node | None:
        return heading_stack[-1][1] if heading_stack else (root if o.get("root_node") else None)

    def attach(node: Node, parent: Node | None) -> Node:
        if parent is None:
            node.parent_id = None
            doc.roots.append(node)
        else:
            parent.add(node)
        return node

    def count(key: str) -> int:
        counters[key] = counters.get(key, 0) + 1
        return counters[key]

    def cite(num: str | None, fallback: str) -> str:
        if num:
            return f"{cite_prefix} {num}".strip()
        return fallback

    for b in blocks:
        text = norm_ws(b.text)
        if b.kind == "heading":
            if not text:
                continue
            while heading_stack and heading_stack[-1][0] >= b.level:
                heading_stack.pop()
            parent = container()
            m = num_rx.match(text)
            am = _APPX.match(text)
            kind = "appendix" if am else "section"
            if am:
                sid = uid(f"{prefix}:appendix-{am.group(1)}")
                citation = f"{cite_prefix} Appendix {am.group(1)}".strip()
            elif m:
                sid = uid(f"{prefix}:{m.group(1)}")
                citation = cite(m.group(1), text)
            else:
                base = parent.section_id if parent else prefix
                sid = uid(f"{base}/{slug(text, 40)}")
                citation = f"{cite_prefix} {text}".strip() if cite_prefix else text
            heading = text[m.end():].strip(" .:-—") if (m and not am) else text
            node = attach(Node(sid, kind, citation, heading=heading or text, own_text=text), parent)
            heading_stack.append((b.level, node))
            last_para, item_stack = None, []
            continue

        parent = container()
        base = parent.section_id if parent else prefix
        if b.kind == "table":
            n = count(f"{base}#t")
            label = None
            if b.caption:
                tm = re.match(r"\s*Table\s+([A-Z0-9][\w.\-]*)", b.caption)
                label = tm.group(1).rstrip(".-") if tm else None
            sid = uid(f"{base}-table-{label or n}")
            attach(Node(sid, "table", f"{parent.citation if parent else cite_prefix} table {label or n}".strip(),
                        heading=b.caption, own_text=table_text(b.rows, b.caption)), parent)
            continue
        if b.kind == "figure":
            n = count(f"{base}#f")
            sid = uid(f"{base}-fig-{n}")
            node = Node(sid, "figure", f"{parent.citation if parent else cite_prefix} figure {n}".strip(),
                        heading=b.caption or f"Figure {n}", own_text=f"[Figure: {b.src or 'embedded'}]",
                        meta={"src": b.src, "page": b.page})
            attach(node, parent)
            continue
        if not text:
            continue
        if b.kind == "note" or (detect_notes and b.kind == "para" and _NOTE.match(text)):
            n = count(f"{base}#n")
            sid = uid(f"{base}-note-{n}")
            nm = _NOTE.match(text)
            attach(Node(sid, "note", f"{parent.citation if parent else cite_prefix} note {n}".strip(),
                        heading=nm.group(1).upper() if nm else "NOTE", own_text=text), parent)
            continue
        if b.kind == "item" and last_para is not None:
            while item_stack and item_stack[-1][0] >= b.level:
                item_stack.pop()
            host = item_stack[-1][1] if item_stack else last_para
            n = count(f"{host.section_id}#i")
            node = attach(Node(uid(f"{host.section_id}.{n}"), "paragraph", f"{host.citation}.{n}", own_text=text), host)
            item_stack.append((b.level, node))
            continue
        pm = para_num_rx.match(text) if para_num_rx else None
        if pm:
            sid = uid(f"{prefix}:{pm.group(1)}")
            citation = cite(pm.group(1), pm.group(1))
        else:
            n = count(f"{base}#p")
            sid = uid(f"{base}-p{n}")
            citation = f"{parent.citation if parent else cite_prefix} ¶{n}".strip()
        last_para = attach(Node(sid, "paragraph", citation, own_text=text), parent)
        item_stack = []
    if o.get("keep_headings"):
        _keep(doc, re.compile(o["keep_headings"]))
    return doc


def _keep(doc: ParsedDoc, rx: re.Pattern) -> None:
    """Keep only headed subtrees whose heading matches, plus the ancestors that lead to them."""
    def prune(node: Node, inside: bool) -> bool:
        hit = inside or (node.kind in ("section", "appendix") and bool(rx.search(node.own_text or "")))
        node.children = [c for c in node.children if prune(c, hit)]
        return hit or bool(node.children)

    doc.roots = [r for r in doc.roots if prune(r, False)]
