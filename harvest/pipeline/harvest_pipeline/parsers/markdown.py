"""Markdown (CommonMark subset) and plain text -> outline blocks.

ATX headings (#..######), paragraphs (blank-line separated), bullet and numbered list items
(nesting by indent), pipe tables, images, blockquotes (`> NOTE: ...` becomes a note). Plain text
(`parser: text`) treats lines in ALL CAPS or matching `number_regex` as headings.
"""

from __future__ import annotations

import re

from ..model import ParsedDoc
from . import register
from .outline import DEFAULT_NUMBER, Block, build_doc

_H = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
_LI = re.compile(r"^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$")
_IMG = re.compile(r"!\[([^\]]*)\]\(([^)\s]+)[^)]*\)")
_TROW = re.compile(r"^\s*\|.*\|\s*$")
_TSEP = re.compile(r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$")


def _inline(text: str) -> str:
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*|__([^_]+)__", lambda m: m.group(1) or m.group(2), text)
    text = re.sub(r"(?<![*\w])\*([^*]+)\*(?!\*)|(?<![_\w])_([^_]+)_(?!_)", lambda m: m.group(1) or m.group(2), text)
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    return text


def md_blocks(src: str) -> list[Block]:
    lines = src.replace("\r\n", "\n").split("\n")
    blocks: list[Block] = []
    para: list[str] = []
    in_code = False

    def flush():
        if para:
            blocks.append(Block("para", _inline(" ".join(para))))
            para.clear()

    i = 0
    while i < len(lines):
        line = lines[i]
        if line.strip().startswith("```"):
            flush()
            in_code = not in_code
            i += 1
            continue
        if in_code:
            para.append(line)
            i += 1
            continue
        if not line.strip():
            flush()
            i += 1
            continue
        h = _H.match(line)
        if h:
            flush()
            blocks.append(Block("heading", _inline(h.group(2)), level=len(h.group(1))))
            i += 1
            continue
        if _TROW.match(line) and i + 1 < len(lines) and _TSEP.match(lines[i + 1]):
            flush()
            rows = [[c.strip() for c in line.strip().strip("|").split("|")]]
            i += 2
            while i < len(lines) and _TROW.match(lines[i]):
                rows.append([_inline(c.strip()) for c in lines[i].strip().strip("|").split("|")])
                i += 1
            caption = None
            if blocks and blocks[-1].kind == "para" and re.match(r"^Table\b", blocks[-1].text):
                caption = blocks.pop().text
            blocks.append(Block("table", rows=rows, caption=caption))
            continue
        img = _IMG.fullmatch(line.strip())
        if img:
            flush()
            blocks.append(Block("figure", caption=img.group(1) or None, src=img.group(2)))
            i += 1
            continue
        if line.lstrip().startswith(">"):
            flush()
            quote = []
            while i < len(lines) and lines[i].lstrip().startswith(">"):
                quote.append(lines[i].lstrip()[1:].strip())
                i += 1
            text = _inline(" ".join(quote))
            blocks.append(Block("note" if re.match(r"(NOTE|CAUTION|WARNING|DANGER)\b", text, re.I) else "para", text))
            continue
        li = _LI.match(line)
        if li:
            flush()
            depth = len(li.group(1).replace("\t", "    ")) // 2 + 1
            item = [li.group(2)]
            i += 1
            while i < len(lines) and lines[i].strip() and not _LI.match(lines[i]) and not _H.match(lines[i]) \
                    and lines[i].startswith(" "):
                item.append(lines[i].strip())
                i += 1
            blocks.append(Block("item", _inline(" ".join(item)), level=depth))
            continue
        para.append(line.strip())
        i += 1
    flush()
    return blocks


def text_blocks(src: str, number_regex: str = DEFAULT_NUMBER) -> list[Block]:
    rx = re.compile(number_regex)
    blocks: list[Block] = []
    para: list[str] = []
    for line in src.replace("\r\n", "\n").split("\n") + [""]:
        s = line.strip()
        is_head = bool(s) and len(s) < 90 and not s.endswith(".") and (
            (s.isupper() and re.search(r"[A-Z]{3}", s)) or bool(rx.match(s) and len(s.split()) <= 12))
        if not s or is_head:
            if para:
                blocks.append(Block("para", " ".join(para)))
                para = []
            if is_head:
                depth = 1 + (rx.match(s).group(1).count(".") if rx.match(s) else 0)
                blocks.append(Block("heading", s, level=depth))
            continue
        para.append(s)
    return blocks


@register("markdown")
def parse_markdown(data: bytes, source_id: str, options: dict) -> ParsedDoc:
    return build_doc(md_blocks(data.decode(options.get("encoding", "utf-8"))), source_id, options)


@register("text")
def parse_text(data: bytes, source_id: str, options: dict) -> ParsedDoc:
    blocks = text_blocks(data.decode(options.get("encoding", "utf-8")), options.get("number_regex", DEFAULT_NUMBER))
    return build_doc(blocks, source_id, options)
