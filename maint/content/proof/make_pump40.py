"""Draw the fictional Model 40 pump manual as a PDF with the hard layout of real manuals, write its
answer key and the same content as S1000D-style data modules.

    python maint/content/proof/make_pump40.py [OUT_DIR]   (default: next to this file)

Writes pump40-manual.pdf, pump40-expected.json and s1000d/*.xml. Deterministic: the same
content gives the same bytes (fixed creation date, no compression randomness), so the committed
PDF and its SHA-256 in the lock file only change when the content does. Needs reportlab.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pump40_content as C  # noqa: E402

W, H = letter
FONT, BOLD = "Helvetica", "Helvetica-Bold"
FS, LEAD = 7.5, 9.0
PAD = 4.0


class Page:
    """Drawing helpers in top-down coordinates (yt = distance from the top edge)."""

    def __init__(self, c: canvas.Canvas, label: str, change: bool = False):
        self.c, self.label, self.change = c, label, change
        c.setFont(FONT, 7)
        c.drawString(40, H - 24, "MODEL 40 UTILITY PUMP")
        c.drawRightString(W - 40, H - 24, "FIELD MAINTENANCE")
        c.setFont(BOLD, 9)
        c.drawCentredString(W / 2, 28, label)
        if change:
            c.setFont(FONT, 7)
            c.drawString(40, 28, "Change 1")

    def text(self, x, yt, s, font=FONT, size=FS):
        self.c.setFont(font, size)
        self.c.drawString(x, H - yt, s)

    def para(self, x, yt, w, s, font=FONT, size=FS, lead=LEAD) -> float:
        """Wrapped text; returns the yt below it."""
        lines = simpleSplit(s, font, size, w)
        self.c.setFont(font, size)
        for i, ln in enumerate(lines):
            self.c.drawString(x, H - (yt + size + i * lead), ln)
        return yt + size + (len(lines) - 1) * lead + (lead - size) + 2

    def box(self, x, yt, w, body: list[tuple[str, str]], heading: str | None = None, min_h=0.0,
            heading_center=False, lw=0.8) -> tuple[float, float, float, float]:
        """A ruled box: optional bold heading, then paragraphs (font, text). Returns (x0, yt0, x1, yt1)."""
        inner = w - 2 * PAD
        lines: list[tuple[str, str, float]] = []
        if heading:
            lines.append((BOLD, heading, 0))
        for font, s in body:
            for ln in simpleSplit(s, font, FS, inner):
                lines.append((font, ln, 0))
        h = max(min_h, 2 * PAD + len(lines) * LEAD + 1)
        c = self.c
        c.setLineWidth(lw)
        c.rect(x, H - yt - h, w, h, stroke=1, fill=0)
        for i, (font, ln, _) in enumerate(lines):
            c.setFont(font, FS)
            y = H - (yt + PAD + FS + i * LEAD)
            if heading_center and i == 0 and heading:
                c.drawCentredString(x + w / 2, y, ln)
            else:
                c.drawString(x + PAD, y, ln)
        return (x, yt, x + w, yt + h)

    def arrow(self, pts: list[tuple[float, float]], label: str | None = None, at: tuple[float, float] | None = None):
        c = self.c
        c.setLineWidth(0.8)
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            c.line(x0, H - y0, x1, H - y1)
        (xa, ya), (xb, yb) = pts[-2], pts[-1]
        dx, dy = xb - xa, yb - ya
        n = max((dx * dx + dy * dy) ** 0.5, 1e-6)
        ux, uy = dx / n, dy / n
        s = 5.0
        p = c.beginPath()
        p.moveTo(xb, H - yb)
        p.lineTo(xb - s * ux + 0.5 * s * uy, H - (yb - s * uy - 0.5 * s * ux))
        p.lineTo(xb - s * ux - 0.5 * s * uy, H - (yb - s * uy + 0.5 * s * ux))
        p.close()
        c.drawPath(p, stroke=0, fill=1)
        if label:
            lx, ly = at or ((xa + xb) / 2 + 3, (ya + yb) / 2)
            self.text(lx, ly, label, BOLD, 6.5)

    def figure(self, x, yt, w, h, parts: list[tuple[float, float, str]], caption: str):
        c = self.c
        c.setLineWidth(0.6)
        c.rect(x, H - yt - h, w, h)
        prev = None
        for (px, py, name) in parts:
            bx, by = x + px, yt + py
            c.rect(bx, H - by - 16, 62, 16)
            c.setFont(FONT, 6.5)
            c.drawCentredString(bx + 31, H - by - 11, name)
            if prev:
                c.line(prev[0] + 62, H - prev[1] - 8, bx, H - by - 8)
            prev = (bx, by)
        return self.para(x, yt + h + 4, w, caption, BOLD)


def mid_bottom(b):
    return ((b[0] + b[2]) / 2, b[3])


def mid_top(b):
    return ((b[0] + b[2]) / 2, b[1])


def facet_column(pg: Page, x, yt, w, groups: dict) -> float:
    for f, texts in groups.items():
        b = pg.box(x, yt, w, [(FONT, f"{i}. {t}") for i, t in enumerate(texts, 1)], heading=C.FACET_HEADINGS[f])
        yt = b[3] + 4
    return yt


def step_list(pg: Page, x, yt, w, items: list[tuple[str, str]]) -> float:
    """Numbered steps and the warning/caution/note boxes between them, in manual order."""
    n = 0
    for kind, s in items:
        if kind == "step":
            n += 1
            yt = pg.para(x, yt, w, f"{n}. {s}") + 6
        else:
            b = pg.box(x + 30, yt, w - 60, [(FONT, s)], heading=kind.upper(), heading_center=True, lw=1.4)
            yt = b[3] + 8
    return yt


def setup_box(pg: Page, x, yt, w, rows) -> tuple:
    return pg.box(x, yt, w, [(FONT, f"{a} {b}") for _, a, b in rows], heading="INITIAL SETUP")


def page_ch1(c):
    pg = Page(c, "1-1")
    pg.text(40, 60, "CHAPTER 1. GENERAL", BOLD, 11)
    yt = pg.para(40, 80, W - 80, C.CH1_TEXT) + 10
    pg.text(40, yt + 8, "Table 1-1. Variants", BOLD, 8)
    yt += 16
    widths = [130, 80, 140, 182]
    rows = [C.VARIANT_HEAD] + C.VARIANTS
    for r, row in enumerate(rows):
        x = 40
        for wd, cell in zip(widths, row):
            c.rect(x, H - yt - 16, wd, 16)
            pg.text(x + 4, yt + 11, cell, BOLD if r == 0 else FONT)
            x += wd
        yt += 16
    yt = pg.para(40, yt + 12, W - 80, C.RATED_FLOW)
    pg.para(40, yt + 4, W - 80, C.SUPPLY)
    c.showPage()


def table(pg: Page, x, yt, widths, rows) -> float:
    for r, row in enumerate(rows):
        lines = [simpleSplit(cell, BOLD if r == 0 else FONT, FS, wd - 8) for wd, cell in zip(widths, row)]
        h = 6 + max(len(l) for l in lines) * LEAD
        cx = x
        for wd, ls in zip(widths, lines):
            pg.c.rect(cx, H - yt - h, wd, h)
            for i, ln in enumerate(ls):
                pg.text(cx + 4, yt + 3 + FS + i * LEAD, ln, BOLD if r == 0 else FONT)
            cx += wd
        yt += h
    return yt


def page_31(c):
    pg = Page(c, "3-1")
    pg.text(40, 60, "CHAPTER 3. TROUBLESHOOTING", BOLD, 11)
    yt = pg.para(40, 80, W - 80, C.CH3_TEXT) + 8
    b = pg.box(110, yt, W - 220, [(FONT, C.CH3_WARNING)], heading="WARNING", heading_center=True, lw=1.4)
    yt = b[3] + 16
    pg.text(40, yt, "Table 3-0. Symptom index", BOLD, 8)
    yt = table(pg, 40, yt + 6, [200, 150, 80], [C.SYMPTOM_HEAD] + C.SYMPTOMS) + 18
    pg.text(40, yt, "Table 3-3. Displayed fault codes", BOLD, 8)
    table(pg, 40, yt + 6, [110, 250, 172], [C.CODE_HEAD] + C.CODES)
    c.showPage()


def page_32(c):
    pg = Page(c, "3-2")
    pg.text(40, 52, f"Table 3-1. {C.T1_TITLE}. (Sheet 1 of 2)", BOLD, 10)
    pg.text(40, 64, C.T1_APPLIES, FONT, 8)
    s = setup_box(pg, 40, 72, W - 80, C.T1_SETUP)
    top = s[3] + 10
    fx, fw = 40, 165            # facet column
    qx, qw = 220, 160           # question column
    ax, aw = 445, 127           # action column
    sym = pg.box(qx, top, qw, [(FONT, C.SYM1)])
    q1 = pg.box(qx, sym[3] + 22, qw, [(BOLD, "1. " + C.Q1)])
    pg.arrow([mid_bottom(sym), mid_top(q1)])
    f1 = facet_column(pg, fx, q1[1], fw, C.Q1_FACETS)
    a1 = pg.box(ax, q1[1], aw, [(FONT, C.A1)])
    ym = q1[1] + 12
    pg.arrow([(q1[2], ym), (a1[0], ym)], "NO", (q1[2] + 8, ym - 3))
    end = pg.box(ax + 25, a1[3] + 30, aw - 25, [(FONT, C.END1)])
    xe = end[2] - 20
    pg.arrow([(xe, a1[3]), (xe, end[1])], "YES", (xe + 3, a1[3] + 16))
    q2 = pg.box(qx, max(f1 + 10, end[3] + 40), qw, [(BOLD, "2. " + C.Q2)])
    xq = q1[0] + 50
    pg.arrow([(xq, q1[3]), (xq, q2[1])], "YES", (xq + 3, q1[3] + 16))
    xa = a1[0] + 8              # A1 NO: down the left of the end box, then onto Q2's top
    pg.arrow([(xa, a1[3]), (xa, end[3] + 16), (q2[2] - 20, end[3] + 16), (q2[2] - 20, q2[1])], "NO",
             (xa - 16, a1[3] + 14))
    facet_column(pg, fx, q2[1], fw, C.Q2_FACETS)
    a2 = pg.box(ax, q2[1], aw, [(FONT, C.A2)])
    pg.arrow([(q2[2], q2[1] + 10), (a2[0], q2[1] + 10)], C.Q2_LABELS[0], (q2[2] + 6, q2[1] + 7))
    a3 = pg.box(ax, max(a2[3], q2[3]) + 24, aw, [(FONT, C.A3)])
    y3 = (a3[1] + a3[3]) / 2
    x3 = q2[2] - 15
    pg.arrow([(x3, q2[3]), (x3, y3), (a3[0], y3)], C.Q2_LABELS[1], (x3 + 6, y3 - 3))
    go = pg.box(qx + 10, a3[3] + 40, qw - 50, [(BOLD, C.GO3)])
    pg.arrow([(xq, q2[3]), (xq, go[1])], C.Q2_LABELS[2], (xq + 3, go[1] - 8))
    xr = q2[2] - 40             # retry: from A3's bottom back up to Q2
    yr = a3[3] + 14
    pg.arrow([((a3[0] + a3[2]) / 2, a3[3]), ((a3[0] + a3[2]) / 2, yr), (xr, yr), (xr, q2[3])], C.RETRY_LABEL,
             (xr + 22, yr + 9))
    c.showPage()


def page_33(c):
    pg = Page(c, "3-3")
    pg.text(40, 52, f"TEST PROCEDURE FOR QUESTION 2. {C.TP2_TITLE}.", BOLD, 10)
    yt = step_list(pg, 60, 72, W - 120, [("warning", C.TP2_WARNING), ("step", C.TP2_STEPS[0]),
                                          ("caution", C.TP2_CAUTION), ("step", C.TP2_STEPS[1]),
                                          ("note", C.TP2_NOTE), ("step", C.TP2_STEPS[2])])
    pg.figure(60, yt + 20, W - 120, 120, [(10, 30, "Battery"), (90, 30, "Battery switch"), (170, 30, "Fuse F2"),
                                          (250, 30, "Key switch"), (330, 60, "Relay K1"), (410, 60, "Starter")],
              C.FIG31)
    c.showPage()


def page_34(c):
    pg = Page(c, "3-4", change=True)
    pg.text(40, 52, f"Table 3-1. {C.T1_TITLE}. (Sheet 2 of 2)", BOLD, 10)
    fx, fw, qx, qw, ax, aw = 40, 165, 220, 160, 445, 127
    frm = pg.box(qx + 20, 72, qw - 60, [(BOLD, C.FROM2)])
    q3 = pg.box(qx, frm[3] + 24, qw, [(BOLD, "3. " + C.Q3)])
    pg.arrow([mid_bottom(frm), mid_top(q3)])
    c.setLineWidth(3)
    c.line(30, H - q3[1], 30, H - q3[3])     # change bar beside the changed question
    yt = facet_column(pg, fx, q3[1], fw, C.Q3_FACETS)
    e3 = pg.box(ax, q3[1], aw, [(FONT, C.E3)])
    ym = (q3[1] + q3[3]) / 2
    pg.arrow([(q3[2], ym), (e3[0], ym)], "NO", (q3[2] + 8, ym - 3))
    q4 = pg.box(qx, max(yt, q3[3] + 60), qw, [(BOLD, "4. " + C.Q4)])
    xq = (q3[0] + q3[2]) / 2
    pg.arrow([(xq, q3[3]), (xq, q4[1])], "YES", (xq + 4, q3[3] + 18))
    facet_column(pg, fx, q4[1], fw, C.Q4_FACETS)
    e4 = pg.box(ax, q4[1], aw, [(FONT, C.E4P)])
    ym = (q4[1] + q4[3]) / 2
    pg.arrow([(q4[2], ym), (e4[0], ym)], "PASS", (q4[2] + 8, ym - 3))
    a4 = pg.box(qx + 20, q4[3] + 40, qw - 40, [(FONT, C.A4F)])
    pg.arrow([(xq, q4[3]), (xq, a4[1])], "FAIL", (xq + 4, q4[3] + 20))
    c.showPage()


def page_35(c):
    pg = Page(c, "3-5")
    pg.text(40, 52, f"TEST PROCEDURE FOR QUESTION 4. {C.TP4_TITLE}.", BOLD, 10)
    pg.text(60, 72, "Tools: " + C.TP4_TOOLS)
    step_list(pg, 60, 86, W - 120, [("step", C.TP4_STEPS[0]), ("caution", C.TP4_CAUTION), ("step", C.TP4_STEPS[1]),
                                    ("step", C.TP4_STEPS[2])])
    c.showPage()


def page_36(c):
    pg = Page(c, "3-6")
    pg.text(40, 52, f"Table 3-2. {C.T2_TITLE}.", BOLD, 10)
    pg.text(40, 64, C.T2_APPLIES, FONT, 8)
    w1 = pg.box(40, 74, 255, [(BOLD, C.T2_W1_APPLIES), (FONT, C.T2_W1)], heading="WARNING", heading_center=True, lw=1.4)
    pg.box(317, 74, 255, [(BOLD, C.T2_W2_APPLIES), (FONT, C.T2_W2)], heading="WARNING", heading_center=True, lw=1.4)
    fx, fw, qx, qw, ax, aw = 40, 165, 220, 160, 445, 127
    sym = pg.box(qx, w1[3] + 16, qw, [(FONT, C.SYM2)])
    h1 = pg.box(qx, sym[3] + 22, qw, [(BOLD, "1. " + C.H1)])
    pg.arrow([mid_bottom(sym), mid_top(h1)])
    yt = facet_column(pg, fx, h1[1], fw, C.H1_FACETS)
    n1 = pg.box(ax, h1[1], aw, [(FONT, C.H1N)])
    ym = (h1[1] + h1[3]) / 2
    pg.arrow([(h1[2], ym), (n1[0], ym)], "NO", (h1[2] + 8, ym - 3))
    h2 = pg.box(qx, max(yt, h1[3] + 50), qw, [(BOLD, "2. " + C.H2)])
    xq = (h1[0] + h1[2]) / 2
    pg.arrow([(xq, h1[3]), (xq, h2[1])], "YES", (xq + 4, h1[3] + 16))
    facet_column(pg, fx, h2[1], fw, C.H2_FACETS)
    t = pg.box(ax, h2[1], aw, [(FONT, C.H2T)])
    pg.arrow([(h2[2], h2[1] + 10), (t[0], h2[1] + 10)], C.H2_LABELS[0], (h2[2] + 8, h2[1] + 7))
    lo = pg.box(ax, max(t[3], h2[3]) + 24, aw, [(FONT, C.H2L)])
    yl = (lo[1] + lo[3]) / 2
    xl = h2[2] - 15
    pg.arrow([(xl, h2[3]), (xl, yl), (lo[0], yl)], C.H2_LABELS[1], (xl + 8, yl - 3))
    br = pg.box(qx + 10, lo[3] + 40, qw - 40, [(FONT, C.H2B)])
    pg.arrow([(xq, h2[3]), (xq, br[1])], C.H2_LABELS[2], (xq + 3, br[1] - 8))
    c.showPage()


def page_37(c):
    pg = Page(c, "3-7")
    pg.text(40, 52, f"TEST PROCEDURE FOR QUESTION 2. {C.TPH2_TITLE}.", BOLD, 10)
    yt = step_list(pg, 60, 72, W - 120, [("warning", C.TPH2_WARNING), ("step", C.TPH2_STEPS[0]),
                                          ("note", C.TPH2_NOTE), ("step", C.TPH2_STEPS[1]), ("step", C.TPH2_STEPS[2])])
    pg.figure(60, yt + 20, W - 120, 100, [(40, 20, "1"), (200, 50, "2"), (360, 20, "3")], C.FIG32)
    c.showPage()


def page_41(c):
    pg = Page(c, "4-1")
    pg.text(40, 52, "CHAPTER 4. MAINTENANCE TASKS", BOLD, 11)
    yt = pg.para(40, 68, W - 80, C.CH4_TEXT) + 10
    pg.text(40, yt + 8, f"Task 4-3. {C.T43_TITLE}.", BOLD, 10)
    pg.text(40, yt + 20, C.T43_APPLIES, FONT, 8)
    s = setup_box(pg, 40, yt + 28, W - 80, C.T43_SETUP)
    items = [("step", C.T43_STEPS[0]), ("caution", C.T43_CAUTION), ("step", C.T43_STEPS[1]),
             ("warning", C.T43_WARNING), ("step", C.T43_STEPS[2])]
    step_list(pg, 60, s[3] + 16, W - 120, items)
    c.showPage()


def page_42(c):
    pg = Page(c, "4-2")
    pg.text(40, 52, f"Task 4-3. {C.T43_TITLE}. (Continued)", BOLD, 10)
    yt = 72
    for n, s in enumerate(C.T43_STEPS[3:], 4):
        yt = pg.para(60, yt, W - 120, f"{n}. {s}") + 6
    c.showPage()


def make_pdf(path: Path) -> None:
    c = canvas.Canvas(str(path), pagesize=letter, invariant=1, pageCompression=1)
    c.setTitle(C.TITLE)
    c.setAuthor("Harvest proof (fictional)")
    for fn in (page_ch1, page_31, page_32, page_33, page_34, page_35, page_36, page_37, page_41, page_42):
        fn(c)
    c.save()


def main(argv=None) -> int:
    out = Path((argv or sys.argv[1:] or [Path(__file__).resolve().parent])[0])
    out.mkdir(parents=True, exist_ok=True)
    make_pdf(out / "pump40-manual.pdf")
    (out / "pump40-expected.json").write_text(json.dumps(C.expected(), indent=1, ensure_ascii=False) + "\n")
    from s1000d import write_modules
    write_modules(out / "s1000d")
    print(f"wrote {out}/pump40-manual.pdf, pump40-expected.json, s1000d/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
