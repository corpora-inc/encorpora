"""HTML -> outline blocks (stdlib html.parser; no dependencies).

h1-h6 headings, p / div text, li (nesting by list depth), tables (caption, th/td), img and
figure/figcaption, aside / blockquote / .note / .caution / .warning as notes. script, style,
nav, header, footer and elements matching `skip_selectors` (tag names or classes) are dropped.
"""

from __future__ import annotations

import html as htmllib
from html.parser import HTMLParser

from ..model import ParsedDoc
from . import register
from .outline import Block, build_doc

_SKIP = {"script", "style", "nav", "header", "footer", "noscript", "template", "svg", "head"}
_BLOCK = {"p", "div", "section", "article", "main", "body", "dd", "dt", "pre", "address"}
_VOID = {"br", "img", "hr", "meta", "link", "input", "col", "area", "base", "source", "wbr"}


class _P(HTMLParser):
    def __init__(self, skip: set[str]):
        super().__init__(convert_charrefs=True)
        self.blocks: list[Block] = []
        self.buf: list[str] = []
        self.mode: tuple | None = None    # ('h', level) | ('li', depth) | ('note',) | ('caption',)
        self.skip_depth = 0
        self.skip = skip
        self.list_depth = 0
        self.table: list[list[str]] | None = None
        self.row: list[str] | None = None
        self.cell: list[str] | None = None
        self.caption: str | None = None
        self.stack: list[str] = []
        self.note_depth = 0

    def _flush(self, kind: str = "para", level: int = 1):
        text = " ".join("".join(self.buf).split())
        self.buf = []
        if text:
            if self.note_depth and kind == "para":
                kind = "note"
            self.blocks.append(Block(kind, text, level=level))

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        classes = set((a.get("class") or "").split())
        if tag not in _VOID:
            self.stack.append(tag)
        if self.skip_depth or tag in _SKIP or tag in self.skip or classes & self.skip:
            if tag not in _VOID:
                self.skip_depth += 1
            return
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            self._flush()
            self.mode = ("h", int(tag[1]))
        elif tag in ("ul", "ol"):
            self._flush("item", self.list_depth) if self.mode and self.mode[0] == "li" else self._flush()
            self.list_depth += 1
        elif tag == "li":
            self._flush("item", self.list_depth) if self.mode and self.mode[0] == "li" else self._flush()
            self.mode = ("li", self.list_depth)
        elif tag == "table":
            self._flush()
            self.table, self.caption = [], None
        elif tag == "caption":
            self.mode = ("caption",)
        elif tag == "tr" and self.table is not None:
            self.row = []
        elif tag in ("td", "th") and self.row is not None:
            self.cell = []
        elif tag == "img":
            self._flush()
            self.blocks.append(Block("figure", caption=a.get("alt") or a.get("title"), src=a.get("src")))
        elif tag in ("aside", "blockquote") or classes & {"note", "caution", "warning", "danger"}:
            self._flush()
            self.note_depth += 1
        elif tag == "br":
            self.buf.append(" ")
        elif tag in _BLOCK:
            if not (self.mode and self.mode[0] == "li"):
                self._flush()

    def handle_endtag(self, tag):
        if tag in _VOID:
            return
        while self.stack and self.stack[-1] != tag:
            self.stack.pop()
        if self.stack:
            self.stack.pop()
        if self.skip_depth:
            self.skip_depth -= 1
            return
        if tag in ("h1", "h2", "h3", "h4", "h5", "h6") and self.mode and self.mode[0] == "h":
            self._flush("heading", self.mode[1])
            self.mode = None
        elif tag == "li":
            self._flush("item", self.list_depth)
            self.mode = ("li", self.list_depth - 1) if self.list_depth > 1 else None
        elif tag in ("ul", "ol"):
            if self.mode and self.mode[0] == "li":
                self._flush("item", self.list_depth)
            self.list_depth = max(0, self.list_depth - 1)
            self.mode = None
        elif tag == "caption":
            self.caption = " ".join("".join(self.buf).split()) or None
            self.buf = []
            self.mode = None
        elif tag in ("td", "th") and self.cell is not None and self.row is not None:
            self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None
        elif tag == "tr" and self.row is not None and self.table is not None:
            self.table.append(self.row)
            self.row = None
        elif tag == "table" and self.table is not None:
            self.blocks.append(Block("table", rows=self.table, caption=self.caption))
            self.table = None
        elif tag == "figcaption":
            cap = " ".join("".join(self.buf).split())
            self.buf = []
            if self.blocks and self.blocks[-1].kind == "figure" and cap:
                self.blocks[-1].caption = cap
        elif tag in ("aside", "blockquote") and self.note_depth:
            self._flush()
            self.note_depth -= 1
        elif tag in _BLOCK:
            if not (self.mode and self.mode[0] == "li"):
                self._flush()

    def handle_data(self, data):
        if self.skip_depth:
            return
        if self.cell is not None:
            self.cell.append(data)
        else:
            self.buf.append(data)

    def close(self):
        super().close()
        self._flush()


def html_blocks(src: str, skip: set[str] | None = None) -> list[Block]:
    p = _P(skip or set())
    p.feed(src)
    p.close()
    return p.blocks


@register("html")
def parse_html(data: bytes, source_id: str, options: dict) -> ParsedDoc:
    text = data.decode(options.get("encoding", "utf-8"), errors="replace")
    return build_doc(html_blocks(htmllib.unescape(text) if options.get("double_escaped") else text,
                                 set(options.get("skip_selectors") or [])), source_id, options)
