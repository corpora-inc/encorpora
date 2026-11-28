"""The page model: what every later stage knows about a page, built from layout, never from a model.

Plain text extraction of flowchart spreads comes out in the wrong order, so structure comes from
geometry. Per page:

  * words with their boxes, font size and weight, from the text layer (pdfplumber), or from
    Tesseract's word boxes when the page has no text layer
  * regions: ruled boxes (the innermost box holding a word's centre owns it), table cells, figure
    frames (a box over a "Figure N" caption; boxes and labels inside it belong to the figure),
    and blocks of free text grouped by line spacing and column; the running header and footer
  * connectors: drawn lines chained end to end, with the arrowhead that gives their direction,
    the regions their tail and head touch, and the short free-text label printed beside them
    (YES, NO, PASS, "Below 11.5 V")
  * the printed page label ("3-2", "2-1475"), change marking (change bars in the margin, a
    "Change N" line in the footer) and the rendered page image

A region is the unit of verification: a text field of a generated row must be a contiguous word
sequence inside one region of the page it cites (`spans.py`). Coordinates are PDF points from the
top-left; `norm_box` gives them as 0..1 of the page.
"""

from __future__ import annotations

import io
import json
import re
import shutil
import statistics
import subprocess
import tempfile
from dataclasses import asdict, dataclass, field
from pathlib import Path

LABEL_RX = r"^(?:[A-Z]{1,4}-)?\d{1,3}-\d{1,4}(?:\.\d+)?[A-Z]?$|^[A-Z]-\d{1,4}$|^\d{1,4}$"
CHANGE_RX = r"^(?:Change|CHANGE|Revision|REV\.?)\s+\d+\b"


@dataclass
class Word:
    i: int
    text: str
    x0: float
    top: float
    x1: float
    bottom: float
    size: float = 0.0
    bold: bool = False


@dataclass
class Region:
    id: str
    kind: str                     # box | cell | table | figure | text | header | footer
    bbox: tuple[float, float, float, float]
    words: list[int] = field(default_factory=list)   # reading order
    parent: str | None = None
    lines: list[list[int]] = field(default_factory=list)
    changed: bool = False         # a change bar runs beside it
    row: int | None = None        # table cells: row and column
    col: int | None = None


@dataclass
class Connector:
    tail: str | None              # region id the line leaves
    head: str | None              # region id the arrowhead points into
    label: str | None             # region id of the printed label beside it
    points: list[tuple[float, float]] = field(default_factory=list)


@dataclass
class PageModel:
    source_id: str
    index: int                    # 0-based page index in the file
    width: float
    height: float
    label: str | None = None
    change: str | None = None     # "Change 1" when the footer says so
    ocr: bool = False
    words: list[Word] = field(default_factory=list)
    regions: list[Region] = field(default_factory=list)
    connectors: list[Connector] = field(default_factory=list)
    image: str | None = None      # path of the rendered page image (pack asset)
    image_size: tuple[int, int] | None = None
    image_id: str | None = None   # what the image is a rendering of (source hash, page, width): the cache
                                  # key uses this, not the image bytes, so a renderer upgrade misses nothing

    # ---- access ---------------------------------------------------------------------------
    def region(self, rid: str) -> Region | None:
        return next((r for r in self.regions if r.id == rid), None)

    def region_text(self, r: Region, sep: str = " ") -> str:
        if r.lines:
            return sep.join(" ".join(self.words[i].text for i in ln) for ln in r.lines)
        return " ".join(self.words[i].text for i in r.words)

    def text_regions(self) -> list[Region]:
        """Regions that own words (containers and tables own none)."""
        return [r for r in self.regions if r.words]

    def norm_box(self, b) -> dict:
        x0, t, x1, bt = b
        cl = lambda v: round(min(1.0, max(0.0, v)), 4)  # noqa: E731
        return {"x0": cl(x0 / self.width), "y0": cl(t / self.height), "x1": cl(x1 / self.width),
                "y1": cl(bt / self.height)}

    def to_json(self) -> dict:
        return asdict(self)

    @classmethod
    def from_json(cls, d: dict) -> "PageModel":
        d = dict(d)
        d["words"] = [Word(**w) for w in d["words"]]
        d["regions"] = [Region(**{**r, "bbox": tuple(r["bbox"])}) for r in d["regions"]]
        d["connectors"] = [Connector(**{**c, "points": [tuple(p) for p in c["points"]]}) for c in d["connectors"]]
        if d.get("image_size"):
            d["image_size"] = tuple(d["image_size"])
        return cls(**d)


# ---- geometry -------------------------------------------------------------------------------
def _area(b) -> float:
    return max(0.0, b[2] - b[0]) * max(0.0, b[3] - b[1])


def _inside(pt, b, tol=0.5) -> bool:
    return b[0] - tol <= pt[0] <= b[2] + tol and b[1] - tol <= pt[1] <= b[3] + tol


def _contains(outer, inner, tol=1.0) -> bool:
    return outer[0] - tol <= inner[0] and outer[1] - tol <= inner[1] and inner[2] <= outer[2] + tol \
        and inner[3] <= outer[3] + tol


def _dist_to_box(pt, b) -> float:
    dx = max(b[0] - pt[0], 0, pt[0] - b[2])
    dy = max(b[1] - pt[1], 0, pt[1] - b[3])
    return (dx * dx + dy * dy) ** 0.5


def _seg_dist(p, a, b) -> float:
    ax, ay = a
    bx, by = b
    px, py = p
    dx, dy = bx - ax, by - ay
    L = dx * dx + dy * dy
    t = 0.0 if L == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L))
    qx, qy = ax + t * dx, ay + t * dy
    return ((px - qx) ** 2 + (py - qy) ** 2) ** 0.5


def _box_seg_dist(b, a, c) -> float:
    pts = [(b[0], b[1]), (b[2], b[1]), (b[0], b[3]), (b[2], b[3]), ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)]
    return min(_seg_dist(p, a, c) for p in pts)


def _lines_of(words: list[Word], idxs: list[int]) -> list[list[int]]:
    """Group word indices into lines (by top, tolerance from font size), each sorted by x."""
    ws = sorted(idxs, key=lambda i: (words[i].top, words[i].x0))
    lines: list[list[int]] = []
    for i in ws:
        w = words[i]
        if lines:
            ref = words[lines[-1][0]]
            if abs(w.top - ref.top) <= max(1.5, 0.4 * max(w.size, ref.size, 1)):
                lines[-1].append(i)
                continue
        lines.append([i])
    return [sorted(ln, key=lambda i: words[i].x0) for ln in lines]


# ---- building -------------------------------------------------------------------------------
def build_page(source_id: str, index: int, page, options: dict | None = None) -> PageModel:
    """A page model from a pdfplumber page with a text layer."""
    o = options or {}
    pm = PageModel(source_id, index, float(page.width), float(page.height))
    raw = page.extract_words(extra_attrs=["size", "fontname"], keep_blank_chars=False, use_text_flow=False,
                             x_tolerance=float(o.get("x_tolerance", 1.5)))
    for k, w in enumerate(raw):
        text = re.sub(r"\(cid:\d+\)", "•", w["text"])
        pm.words.append(Word(k, text, round(w["x0"], 2), round(w["top"], 2), round(w["x1"], 2),
                             round(w["bottom"], 2), round(float(w.get("size") or 0), 2),
                             bool(re.search(r"Bold|Black|Heavy|Semibold|Demi", w.get("fontname") or ""))))
    _regions_from_layout(pm, page, o)
    return pm


def _regions_from_layout(pm: PageModel, page, o: dict) -> None:
    W, H = pm.width, pm.height
    words = pm.words
    min_box = float(o.get("min_box_pt", 8))
    # segments: page lines, thin rects, polyline curves (not small filled shapes: arrowheads)
    segs: list[tuple[tuple[float, float], tuple[float, float], float]] = []
    heads: list[tuple[float, float, tuple]] = []   # arrowhead tip (x, top) and its box
    bars: list[tuple] = []
    boxes: list[tuple] = []
    for r in page.rects:
        b = (float(r["x0"]), float(r["top"]), float(r["x1"]), float(r["bottom"]))
        w, h = b[2] - b[0], b[3] - b[1]
        if w >= min_box and h >= min_box:
            boxes.append(b)
        elif w <= 4.5 and h > 8 and (b[2] < 0.12 * W or b[0] > 0.88 * W):
            bars.append(b)
        elif w <= 1.5 or h <= 1.5:
            segs.append((((b[0] + b[2]) / 2, (b[1] + b[3]) / 2) if w <= 1.5 else (b[0], (b[1] + b[3]) / 2),
                         ((b[0] + b[2]) / 2, b[3]) if w <= 1.5 else (b[2], (b[1] + b[3]) / 2), 0.0))
    for ln in page.lines:
        (x0, t0), (x1, t1) = ln["pts"][0], ln["pts"][-1]
        lw = float(ln.get("linewidth") or 0)
        if abs(x0 - x1) < 0.5 and abs(t1 - t0) > 8 and lw >= 2 and (x0 < 0.12 * W or x0 > 0.88 * W):
            bars.append((x0 - lw / 2, min(t0, t1), x0 + lw / 2, max(t0, t1)))
            continue
        segs.append(((float(x0), float(t0)), (float(x1), float(t1)), lw))
    for cv in page.curves:
        b = (float(cv["x0"]), float(cv["top"]), float(cv["x1"]), float(cv["bottom"]))
        pts = [(float(x), float(y)) for x, y in cv["pts"]]
        if cv.get("fill") and (b[2] - b[0]) <= 10 and (b[3] - b[1]) <= 10 and len(pts) >= 3:
            # the tip is the vertex farthest from the centroid of the others
            cx = sum(p[0] for p in pts) / len(pts)
            cy = sum(p[1] for p in pts) / len(pts)
            tip = max(pts, key=lambda p: (p[0] - cx) ** 2 + (p[1] - cy) ** 2)
            heads.append((tip[0], tip[1], b))
        elif (b[2] - b[0]) >= min_box and (b[3] - b[1]) >= min_box and (_closed_rect(pts) or _closed(pts)):
            boxes.append(b)          # ruled boxes drawn as paths, and round off-page connectors
        else:
            segs.extend(((pts[k], pts[k + 1], 0.0) for k in range(len(pts) - 1)))
    boxes = _dedupe(boxes)
    # tables (ruled grids): their cells are regions; boxes inside a table are its cells
    tables = []
    if o.get("tables", True):
        try:
            for t in page.find_tables():
                cells = [tuple(map(float, c)) for c in t.cells if c]
                # boxes stacked a few points apart read as a one-column grid: keep them boxes
                if len(cells) >= 2 and len({round(c[0]) for c in cells}) >= 2:
                    tables.append((tuple(map(float, t.bbox)), cells))
        except Exception as e:  # a malformed drawing must not stop the page; noisy, never silent
            print(f"[layout] page {pm.index}: table finder failed: {e!r}")
    boxes = [b for b in boxes if not any(_contains(tb, b, 2.0) for tb, _ in tables)]
    rid = 0

    def new(kind, bbox, parent=None, **kw) -> Region:
        nonlocal rid
        rid += 1
        r = Region(f"p{pm.index}.r{rid}", kind, tuple(round(v, 2) for v in bbox), parent=parent, **kw)
        pm.regions.append(r)
        return r

    owner: dict[int, str] = {}
    centre = {w.i: ((w.x0 + w.x1) / 2, (w.top + w.bottom) / 2) for w in words}
    for tb, cells in tables:
        treg = new("table", tb)
        tops = sorted({round(c[1], 1) for c in cells})
        lefts = sorted({round(c[0], 1) for c in cells})
        for c in sorted(cells, key=lambda c: (c[1], c[0])):
            creg = new("cell", c, parent=treg.id, row=tops.index(round(c[1], 1)), col=lefts.index(round(c[0], 1)))
            for w in words:
                if w.i not in owner and _inside(centre[w.i], c):
                    owner[w.i] = creg.id
    # figures: a box over (or holding) a "Figure N" caption; its inner boxes are drawing parts
    caption_rx = re.compile(o.get("figure_caption_regex", r"^(Figure|FIGURE|Fig\.)\s+[A-Z0-9][\w.\-]*"))
    lines_free = _lines_of(words, [w.i for w in words if w.i not in owner])
    figures = []
    for b in sorted(boxes, key=_area, reverse=True):
        inner = [x for x in boxes if x is not b and _contains(b, x)]
        if len(inner) < 2:
            continue
        below = [ln for ln in lines_free if 0 <= words[ln[0]].top - b[3] <= 24 and words[ln[0]].x0 >= b[0] - 4
                 and words[ln[0]].x0 <= b[2]]
        if below and caption_rx.match(words[below[0][0]].text + " " + " ".join(words[i].text for i in below[0][1:3])):
            figures.append(b)
    for fb in figures:
        boxes = [x for x in boxes if x is fb or not _contains(fb, x)]
    box_regs: list[tuple[tuple, Region]] = []
    for b in sorted(boxes, key=_area, reverse=True):
        parent = next((r.id for bb, r in reversed(box_regs) if _contains(bb, b)), None)
        reg = new("figure" if b in figures else "box", b, parent=parent)
        box_regs.append((b, reg))
    for w in words:
        if w.i in owner:
            continue
        hits = [(bb, r) for bb, r in box_regs if _inside(centre[w.i], bb)]
        if hits:
            owner[w.i] = min(hits, key=lambda h: _area(h[0]))[1].id
    # a figure caption belongs with the figure region's text block (kept as its own text region)
    # free text: lines -> blocks by spacing, column overlap and font change
    free = [w.i for w in words if w.i not in owner]
    head_h, foot_h = float(o.get("header_band", 0.06)) * H, float(o.get("footer_band", 0.94)) * H
    blocks: list[dict] = []
    for ln in _lines_of(words, free):
        x0 = min(words[i].x0 for i in ln)
        x1 = max(words[i].x1 for i in ln)
        top = min(words[i].top for i in ln)
        bot = max(words[i].bottom for i in ln)
        size = statistics.median(words[i].size for i in ln) or 8.0
        band = "header" if bot <= head_h else "footer" if top >= foot_h else "text"
        # split a line at wide gaps (separate labels or columns on one baseline)
        pieces, cur = [], [ln[0]]
        for a, b2 in zip(ln, ln[1:]):
            if words[b2].x0 - words[a].x1 > max(12.0, 2.2 * size):
                pieces.append(cur)
                cur = [b2]
            else:
                cur.append(b2)
        pieces.append(cur)
        for pc in pieces:
            px0, px1 = words[pc[0]].x0, words[pc[-1]].x1
            joined = None
            for blk in reversed(blocks[-6:]):
                gap = top - blk["bottom"]
                if blk["band"] == band and -1 <= gap <= 0.9 * size and min(px1, blk["x1"]) - max(px0, blk["x0"]) > 0 \
                        and abs(blk["size"] - size) < 0.6 and band == "text":
                    joined = blk
                    break
            if joined is None:
                blocks.append({"lines": [pc], "x0": px0, "x1": px1, "top": top, "bottom": bot, "band": band,
                               "size": size})
            else:
                joined["lines"].append(pc)
                joined["x0"], joined["x1"] = min(joined["x0"], px0), max(joined["x1"], px1)
                joined["bottom"] = max(joined["bottom"], bot)
    for blk in blocks:
        reg = new(blk["band"], (blk["x0"], blk["top"], blk["x1"], blk["bottom"]))
        for pc in blk["lines"]:
            for i in pc:
                owner[i] = reg.id
    # words and lines per region, reading order
    by_reg: dict[str, list[int]] = {}
    for i, r in owner.items():
        by_reg.setdefault(r, []).append(i)
    for reg in pm.regions:
        idxs = by_reg.get(reg.id, [])
        reg.lines = _lines_of(words, idxs)
        reg.words = [i for ln in reg.lines for i in ln]
    pm.regions.sort(key=lambda r: (r.bbox[1], r.bbox[0]))
    # page label and change marking from the footer (else the header)
    lab_rx = re.compile(o.get("page_label_regex", LABEL_RX))
    chg_rx = re.compile(o.get("change_regex", CHANGE_RX))
    for band in ("footer", "header"):
        for reg in sorted((r for r in pm.regions if r.kind == band), key=lambda r: abs((r.bbox[0] + r.bbox[2]) / 2 - W / 2)):
            t = pm.region_text(reg)
            if pm.label is None and lab_rx.match(t):
                pm.label = t
            m = chg_rx.match(t)
            if m and pm.change is None:
                pm.change = m.group(0)
    for b in bars:
        for reg in pm.regions:
            if reg.words and min(reg.bbox[3], b[3]) - max(reg.bbox[1], b[1]) > 2:
                reg.changed = True
    pm.connectors = _connectors(pm, segs, heads)


def _closed_rect(pts) -> bool:
    xs = {round(p[0]) for p in pts}
    ys = {round(p[1]) for p in pts}
    return len(pts) >= 4 and len(xs) <= 2 and len(ys) <= 2


def _closed(pts) -> bool:
    """A closed outline (circle, rounded box): it ends where it starts and is not a thin line."""
    return len(pts) >= 4 and abs(pts[0][0] - pts[-1][0]) < 1.0 and abs(pts[0][1] - pts[-1][1]) < 1.0


def _dedupe(boxes):
    out = []
    for b in boxes:
        if not any(all(abs(a - c) < 1.0 for a, c in zip(b, o)) for o in out):
            out.append(b)
    return out


def _connectors(pm: PageModel, segs, heads, tol: float = 2.0) -> list[Connector]:
    """Chain segments that share endpoints into polylines; find the regions at each end and the
    label beside them."""
    n = len(segs)
    parent = list(range(n))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def near(p, q):
        return abs(p[0] - q[0]) <= tol and abs(p[1] - q[1]) <= tol

    for a in range(n):
        for b in range(a + 1, n):
            if any(near(p, q) for p in segs[a][:2] for q in segs[b][:2]):
                parent[find(a)] = find(b)
    groups: dict[int, list[int]] = {}
    for a in range(n):
        groups.setdefault(find(a), []).append(a)
    boxes = [r for r in pm.regions if r.kind in ("box", "cell", "text") and r.words]
    labels = [r for r in pm.regions if r.kind == "text" and r.words and len(r.words) <= 6]
    out = []
    for members in groups.values():
        ends: dict[tuple, int] = {}
        for m in members:
            for p in segs[m][:2]:
                key = (round(p[0]), round(p[1]))
                ends[key] = ends.get(key, 0) + 1
        free_ends = [k for k, c in ends.items() if c == 1] or list(ends)
        if not free_ends:
            continue
        head_end = None
        for hx, hy, hb in heads:
            for e in free_ends:
                if abs(e[0] - hx) <= 6 and abs(e[1] - hy) <= 6:
                    head_end = e
        if head_end is None:
            continue   # a line with no arrowhead is a rule or a drawing, not a branch
        tail_end = max((e for e in free_ends if e != head_end), default=None,
                       key=lambda e: (e[0] - head_end[0]) ** 2 + (e[1] - head_end[1]) ** 2)

        def at(pt):
            if pt is None:
                return None
            cands = [(r, _dist_to_box(pt, r.bbox)) for r in boxes]
            cands = [c for c in cands if c[1] <= 4.0]
            ruled = [c for c in cands if c[0].kind != "text"]
            cands = ruled or cands
            return min(cands, key=lambda c: (c[1], _area(c[0].bbox)))[0].id if cands else None

        tail, head = at(tail_end), at(head_end)
        lab = None
        best = 18.0
        for r in labels:
            if r.id in (tail, head):
                continue
            d = min(_box_seg_dist(r.bbox, segs[m][0], segs[m][1]) for m in members)
            if d < best:
                best, lab = d, r.id
        pts = [tail_end, head_end] if tail_end else [head_end]
        out.append(Connector(tail, head, lab, [tuple(map(float, p)) for p in pts]))
    out.sort(key=lambda c: (c.points[0][1], c.points[0][0]))
    return out


# ---- OCR fallback ---------------------------------------------------------------------------
def ocr_page(source_id: str, index: int, img, width_pt: float, height_pt: float, lang: str = "eng") -> PageModel:
    """Words with boxes from Tesseract (TSV); regions are its paragraphs."""
    exe = shutil.which("tesseract")
    if not exe:
        raise SystemExit("OCR needs the tesseract binary")
    pm = PageModel(source_id, index, width_pt, height_pt, ocr=True)
    sx, sy = width_pt / img.width, height_pt / img.height
    with tempfile.TemporaryDirectory(prefix="harvest-ocr-") as td:
        p = Path(td) / "page.png"
        img.save(p)
        r = subprocess.run([exe, str(p), "stdout", "-l", lang, "--psm", "3", "tsv"], capture_output=True, text=True)
        if r.returncode != 0:
            raise RuntimeError(f"tesseract failed: {r.stderr[-300:]}")
    paras: dict[tuple, list[int]] = {}
    for row in r.stdout.splitlines()[1:]:
        f = row.split("\t")
        if len(f) < 12 or not f[11].strip() or float(f[10]) < 0:
            continue
        x, y, w, h = (int(v) for v in f[6:10])
        k = len(pm.words)
        pm.words.append(Word(k, f[11].strip(), round(x * sx, 2), round(y * sy, 2), round((x + w) * sx, 2),
                             round((y + h) * sy, 2), round(h * sy, 2), False))
        paras.setdefault((int(f[2]), int(f[3]), int(f[4])), []).append(k)
    n = 0
    for key, idxs in sorted(paras.items()):
        # a paragraph splits where a line opens a numbered or lettered item ("4.", "a.", "(1)")
        groups: list[list[list[int]]] = []
        for ln in _lines_of(pm.words, idxs):
            first = pm.words[ln[0]].text
            if not groups or re.match(r"^(?:\d{1,3}|[a-z])[.)]$|^\(\w{1,3}\)$", first):
                groups.append([ln])
            else:
                groups[-1].append(ln)
        for lines in groups:
            n += 1
            ws = [pm.words[i] for ln in lines for i in ln]
            reg = Region(f"p{index}.r{n}", "text", (min(w.x0 for w in ws), min(w.top for w in ws),
                                                   max(w.x1 for w in ws), max(w.bottom for w in ws)))
            reg.lines = lines
            reg.words = [i for ln in lines for i in ln]
            pm.regions.append(reg)
    for reg in pm.regions:
        if reg.bbox[1] >= 0.94 * height_pt:
            reg.kind = "footer"
            t = pm.region_text(reg)
            if pm.label is None and re.match(LABEL_RX, t):
                pm.label = t
            m = re.match(CHANGE_RX, t)
            if m and pm.change is None:
                pm.change = m.group(0)
        elif reg.bbox[3] <= 0.06 * height_pt:
            reg.kind = "header"
    if pm.label is None:   # the label may share a footer line with other text ("Change 1    4-2")
        for reg in pm.regions:
            if reg.kind == "footer":
                for w in (pm.words[i] for i in reg.words):
                    if re.match(LABEL_RX, w.text) and abs((w.x0 + w.x1) / 2 - width_pt / 2) < 0.15 * width_pt:
                        pm.label = w.text
    pm.regions.sort(key=lambda r: (r.bbox[1], r.bbox[0]))
    return pm


# ---- whole documents --------------------------------------------------------------------------
def render_page(data: bytes, index: int, width_px: int):
    import pypdfium2 as pdfium
    pdf = pdfium.PdfDocument(data)
    try:
        page = pdf[index]
        scale = width_px / page.get_width()
        return page.render(scale=scale).to_pil().convert("RGB")
    finally:
        pdf.close()


def page_models(data: bytes, source_id: str, options: dict | None = None,
                pages: list[int] | None = None) -> list[PageModel]:
    """Page models for a PDF (0-based `pages`, default all). Pages without a text layer are OCR'd."""
    import pdfplumber
    o = options or {}
    out = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        idxs = pages if pages is not None else list(range(len(pdf.pages)))
        for i in idxs:
            page = pdf.pages[i]
            if page.chars and not o.get("force_ocr"):
                pm = build_page(source_id, i, page, o)
            else:
                img = render_page(data, i, int(o.get("ocr_px", 2550)))
                pm = ocr_page(source_id, i, img, float(page.width), float(page.height), o.get("ocr_lang", "eng"))
            out.append(pm)
    return out


def save_models(models: list[PageModel], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(json.dumps(m.to_json(), separators=(",", ":")) for m in models) + "\n")


def load_models(path: Path) -> list[PageModel]:
    return [PageModel.from_json(json.loads(x)) for x in path.read_text().splitlines() if x.strip()]
