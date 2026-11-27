"""PDF (text, tables, figures) via pdfplumber (MIT) and pypdfium2 (Apache-2.0/BSD); OCR via Tesseract.

Layout -> blocks:
  * words grouped into lines; running headers/footers (text repeated in the top/bottom margin of
    two or more pages, or bare page numbers) dropped
  * body font size = the most common size; a line is a heading when its size is clearly larger
    (level by size rank), when it is a short bold line, or when it matches `heading_regex`
  * lines join into paragraphs; a new paragraph starts at a vertical gap, a bullet, or a line
    matching `para_number_regex`; hyphenated line ends are rejoined
  * tables from pdfplumber's ruled-table finder, placed at their position; their text is removed
    from the running text
  * images larger than `min_figure_pt` become figure blocks (`page<N>-img<K>`)
  * pages with no text layer (scans), or every page with `parser: ocr`, are rendered at `ocr_dpi`
    and read by the `tesseract` binary

Options: pages ("12-30,41"), heading_regex, para_number_regex, number_regex, id_prefix,
citation_prefix, ocr_dpi (300), ocr_lang ("eng"), heading_ratio (1.15), min_figure_pt (60),
x_tolerance (1.5 pt: the largest gap inside a word; tightly kerned PDFs need it small).
"""

from __future__ import annotations

import io
import re
import shutil
import statistics
import subprocess
import tempfile
from collections import Counter
from pathlib import Path

from ..model import ParsedDoc
from . import register
from .markdown import text_blocks
from .outline import DEFAULT_NUMBER, Block, build_doc

_BULLET = re.compile(r"^\s*(?:[•●▪◦·\-–]|\(?[a-z0-9]{1,3}[.)])\s+")


def parse_pages(spec: str | None, n: int) -> list[int]:
    if not spec:
        return list(range(n))
    out = []
    for part in str(spec).split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-")
            out.extend(range(int(a) - 1, min(int(b), n)))
        elif part:
            out.append(int(part) - 1)
    return [p for p in out if 0 <= p < n]


def ocr_image(img, lang: str = "eng") -> str:
    exe = shutil.which("tesseract")
    if not exe:
        raise SystemExit("OCR needs the tesseract binary (brew install tesseract / apt install tesseract-ocr)")
    with tempfile.TemporaryDirectory(prefix="harvest-ocr-") as td:
        p = Path(td) / "page.png"
        img.save(p)
        r = subprocess.run([exe, str(p), "stdout", "-l", lang, "--psm", "3"], capture_output=True, text=True)
        if r.returncode != 0:
            raise RuntimeError(f"tesseract failed: {r.stderr[-300:]}")
        return r.stdout


def _render(data: bytes, index: int, dpi: int):
    import pypdfium2 as pdfium
    pdf = pdfium.PdfDocument(data)
    try:
        return pdf[index].render(scale=dpi / 72).to_pil()
    finally:
        pdf.close()


def _lines(page, exclude: list[tuple], x_tolerance: float = 1.5) -> list[dict]:
    def outside(obj):
        cx, cy = (obj["x0"] + obj["x1"]) / 2, (obj["top"] + obj["bottom"]) / 2
        return not any(b[0] <= cx <= b[2] and b[1] <= cy <= b[3] for b in exclude)

    words = page.filter(outside).extract_words(extra_attrs=["size", "fontname"], keep_blank_chars=False,
                                               use_text_flow=True, x_tolerance=x_tolerance)
    lines: list[dict] = []
    for w in words:
        if lines and abs(w["top"] - lines[-1]["top"]) <= max(2.0, 0.35 * w["size"]) \
                and lines[-1]["x1"] - 1 <= w["x0"] <= lines[-1]["x1"] + 2.5 * w["size"]:   # not across a column gap
            ln = lines[-1]
            ln["words"].append(w)
            ln["x1"] = w["x1"]
            ln["bottom"] = max(ln["bottom"], w["bottom"])
        else:
            lines.append({"words": [w], "top": w["top"], "bottom": w["bottom"], "x0": w["x0"], "x1": w["x1"]})
    for ln in lines:
        ws = ln["words"]
        ln["text"] = re.sub(r"\(cid:\d+\)", "•", " ".join(w["text"] for w in ws))
        ln["size"] = round(statistics.median(w["size"] for w in ws), 1)
        ln["bold"] = sum(len(w["text"]) for w in ws if re.search(r"Bold|Black|Heavy|Semibold", w["fontname"])) \
            >= 0.6 * sum(len(w["text"]) for w in ws)
    return lines


def pdf_blocks(data: bytes, options: dict) -> list[Block]:
    try:
        import pdfplumber
    except ImportError:
        raise SystemExit("pip install 'harvest-pipeline[pdf]' for the pdf parser")
    force_ocr = options.get("force_ocr", False)
    dpi = int(options.get("ocr_dpi", 300))
    lang = options.get("ocr_lang", "eng")
    head_rx = re.compile(options["heading_regex"]) if options.get("heading_regex") else None
    para_rx = re.compile(options["para_number_regex"]) if options.get("para_number_regex") else None
    ratio = float(options.get("heading_ratio", 1.15))
    min_fig = float(options.get("min_figure_pt", 60))

    pages: list[tuple[int, list]] = []   # (page_no, [(top, kind, payload)])
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        idxs = parse_pages(options.get("pages"), len(pdf.pages))
        for i in idxs:
            page = pdf.pages[i]
            if force_ocr or not page.chars:
                pages.append((i + 1, [(0, "ocr", ocr_image(_render(data, i, dpi), lang))]))
                continue
            items = []
            tables = page.find_tables()
            boxes = [t.bbox for t in tables]
            for t in tables:
                rows = [[c or "" for c in r] for r in t.extract()]
                if rows:
                    items.append((t.bbox[1], "table", rows))
            for ln in _lines(page, boxes, float(options.get("x_tolerance", 1.5))):
                ln["page_h"] = page.height
                items.append((ln["top"], "line", ln))
            for k, im in enumerate(page.images, 1):
                if (im["x1"] - im["x0"]) >= min_fig and (im["bottom"] - im["top"]) >= min_fig:
                    items.append((im["top"], "figure", f"page{i + 1}-img{k}"))
            items.sort(key=lambda x: x[0])
            pages.append((i + 1, items))

    # running headers / footers: same text in the margin band on 3+ pages, or bare page numbers
    band = Counter()
    for _, items in pages:
        for top, kind, ln in items:
            if kind == "line" and (top < 0.08 * ln["page_h"] or top > 0.92 * ln["page_h"]):
                band[re.sub(r"\d+", "#", ln["text"])] += 1

    def is_running(ln) -> bool:
        if not (ln["top"] < 0.08 * ln["page_h"] or ln["top"] > 0.92 * ln["page_h"]):
            return False
        key = re.sub(r"\d+", "#", ln["text"])
        return band[key] >= 2 or bool(re.fullmatch(r"(Page\s+)?[#\-–\s]+(of\s+#)?", key, re.I))

    sizes = Counter()
    for _, items in pages:
        for _, kind, ln in items:
            if kind == "line":
                sizes[ln["size"]] += len(ln["text"])
    body = sizes.most_common(1)[0][0] if sizes else 10.0
    big = sorted({s for s in sizes if s >= body * ratio}, reverse=True)

    blocks: list[Block] = []
    para: list[str] = []
    last_bottom = None

    def flush():
        nonlocal para
        if para:
            text = ""
            for piece in para:
                if text.endswith("-") and piece[:1].islower():
                    text = text[:-1] + piece
                else:
                    text = f"{text} {piece}" if text else piece
            kind = "item" if _BULLET.match(text) and not (para_rx and para_rx.match(text)) else "para"
            blocks.append(Block(kind, _BULLET.sub("", text) if kind == "item" else text))
            para = []

    for pno, items in pages:
        last_bottom = None
        for top, kind, payload in items:
            if kind == "ocr":
                flush()
                blocks.extend(text_blocks(payload, options.get("number_regex", DEFAULT_NUMBER)))
                continue
            if kind == "table":
                flush()
                caption = None
                if blocks and blocks[-1].kind in ("para", "heading") and re.match(r"^Table\b", blocks[-1].text):
                    caption = blocks.pop().text
                blocks.append(Block("table", rows=payload, caption=caption, page=pno))
                continue
            if kind == "figure":
                flush()
                blocks.append(Block("figure", src=payload, page=pno))
                continue
            ln = payload
            if is_running(ln):
                continue
            text = ln["text"].strip()
            short = len(text) < 90 and not text.endswith((".", ",", ";"))
            level = None
            if ln["size"] in big:
                level = big.index(ln["size"]) + 1
            elif head_rx and head_rx.match(text):
                level = len(big) + 1
            elif ln["bold"] and short and ln["size"] >= body * 0.95 and (
                    last_bottom is None or top - last_bottom >= 0.4 * ln["size"]
                    or (blocks and blocks[-1].kind == "heading" and not para)):
                level = len(big) + 1
            if level is not None:
                flush()
                if blocks and blocks[-1].kind == "heading" and blocks[-1].level == level and last_bottom is not None \
                        and top - last_bottom < ln["size"] * 0.6:
                    blocks[-1].text += " " + text      # a heading wrapped onto two lines
                else:
                    blocks.append(Block("heading", text, level=level, page=pno))
                last_bottom = ln["bottom"]
                continue
            gap = top - last_bottom if last_bottom is not None else 0
            continues = bool(para) and not re.search(r"[.:;!?\u201d\"]$", para[-1]) and text[:1].islower()
            if para and not continues and (gap > ln["size"] * 0.9 or _BULLET.match(text)
                                           or (para_rx and para_rx.match(text))):
                flush()
            para.append(text)
            last_bottom = ln["bottom"]
        # a sentence that runs onto the next page stays one paragraph
        if para and re.search(r"[.:;!?\u201d\"]$", para[-1]):
            flush()
    flush()
    return blocks


@register("pdf")
def parse_pdf(data: bytes, source_id: str, options: dict) -> ParsedDoc:
    return build_doc(pdf_blocks(data, options), source_id, options)


@register("ocr")
def parse_ocr(data: bytes, source_id: str, options: dict) -> ParsedDoc:
    """Scanned PDFs (every page OCR'd) or a single image (PNG/TIFF/JPEG)."""
    if data[:5] == b"%PDF-":
        return build_doc(pdf_blocks(data, {**options, "force_ocr": True}), source_id, options)
    from PIL import Image
    text = ocr_image(Image.open(io.BytesIO(data)), options.get("ocr_lang", "eng"))
    return build_doc(text_blocks(text, options.get("number_regex", DEFAULT_NUMBER)), source_id, options)
