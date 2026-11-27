"""DOCX -> outline blocks via python-docx (MIT).

Body order is preserved (paragraphs and tables interleaved). Heading N / Title styles become
headings; list styles and numbered paragraphs become items at their list level; drawings become
figures; tables keep their cell text.
"""

from __future__ import annotations

import io
import re

from ..model import ParsedDoc
from . import register
from .outline import Block, build_doc


def docx_blocks(data: bytes) -> list[Block]:
    try:
        import docx
        from docx.table import Table
        from docx.text.paragraph import Paragraph
    except ImportError:
        raise SystemExit("pip install 'harvest-pipeline[docx]' for the docx parser")
    d = docx.Document(io.BytesIO(data))
    blocks: list[Block] = []
    ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    for el in d.element.body.iterchildren():
        if el.tag == f"{ns}tbl":
            t = Table(el, d)
            rows = [[c.text for c in r.cells] for r in t.rows]
            caption = None
            if blocks and blocks[-1].kind == "para" and re.match(r"^Table\b", blocks[-1].text):
                caption = blocks.pop().text
            blocks.append(Block("table", rows=rows, caption=caption))
            continue
        if el.tag != f"{ns}p":
            continue
        p = Paragraph(el, d)
        style = (p.style.name if p.style is not None else "") or ""
        if el.findall(f".//{ns}drawing"):
            blocks.append(Block("figure", caption=p.text.strip() or None, src="embedded"))
            if not p.text.strip():
                continue
        text = p.text
        if not text.strip():
            continue
        m = re.match(r"Heading\s*(\d)", style)
        if m:
            blocks.append(Block("heading", text, level=int(m.group(1))))
        elif style == "Title":
            blocks.append(Block("heading", text, level=1))
        else:
            numpr = el.find(f"{ns}pPr/{ns}numPr")
            if "List" in style or numpr is not None:
                ilvl = numpr.find(f"{ns}ilvl") if numpr is not None else None
                level = int(ilvl.get(f"{ns}val")) + 1 if ilvl is not None else 1
                blocks.append(Block("item", text, level=level))
            else:
                blocks.append(Block("para", text))
    return blocks


@register("docx")
def parse_docx(data: bytes, source_id: str, options: dict) -> ParsedDoc:
    return build_doc(docx_blocks(data), source_id, options)
