"""The pump manual, variant 2: the same machine laid out the hard way, so the proof is not flattering.

    python maint/content/proof/make_pump40v2.py [OUT_DIR]

Harder than variant 1 (which stays the regression case):
  * the "Engine will not crank" tree runs across three spreads with "(CONT)" headers;
  * question 3's YES leaves the page through a lettered off-page connector (circle A) and comes
    back in at the top of the third spread;
  * the test procedure for question 4 has its CAUTION floating in a side column beside step 2;
  * task 4-3 has a two-level numbered procedure (4, a, b, 5);
  * the displayed-code table splits across a page break, header repeated, "(Continued)";
  * running headers carry a document number, change bars and "Change 1" on several pages;
  * the last page is a scan: rasterized, no text layer, so the OCR path with word boxes runs.
Writes pump40v2-manual.pdf and pump40v2-expected.json. Deterministic bytes.
"""

from __future__ import annotations

import copy
import io
import json
import sys
from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

sys.path.insert(0, str(Path(__file__).resolve().parent))
import make_pump40 as V1  # noqa: E402
import pump40_content as C  # noqa: E402
from make_pump40 import BOLD, FONT, H, W, Page, facet_column, mid_bottom, mid_top, setup_box, step_list, table  # noqa: E402

GO3 = "Go to Question 3, page 3-5."
FROM2 = "From Question 2, page 3-3."
T43_STEPS = [("1", C.T43_STEPS[0]), ("2", C.T43_STEPS[1]), ("3", C.T43_STEPS[2]), ("4", "Install the new battery."),
             ("a", "Connect the positive cable first."), ("b", "Connect the negative cable."),
             ("5", C.T43_STEPS[4]), ("6", C.T43_STEPS[5])]


class Page2(Page):
    def __init__(self, c, label, change=False):
        super().__init__(c, label, change)
        c.setFont(FONT, 7)
        c.drawCentredString(W / 2, H - 24, "TM M40-20")

    def bar(self, top, bottom):
        self.c.setLineWidth(3)
        self.c.line(W - 30, H - top, W - 30, H - bottom)
        self.c.setLineWidth(0.8)

    def circle(self, cx, cyt, r, letter_):
        self.c.setLineWidth(0.8)
        self.c.circle(cx, H - cyt, r, stroke=1, fill=0)
        self.c.setFont(BOLD, 9)
        self.c.drawCentredString(cx, H - cyt - 3, letter_)
        return (cx - r, cyt - r, cx + r, cyt + r)


def p31(c):
    pg = Page2(c, "3-1")
    pg.text(40, 60, "CHAPTER 3. TROUBLESHOOTING", BOLD, 11)
    yt = pg.para(40, 80, W - 80, C.CH3_TEXT) + 8
    b = pg.box(110, yt, W - 220, [(FONT, C.CH3_WARNING)], heading="WARNING", heading_center=True, lw=1.4)
    yt = b[3] + 16
    pg.text(40, yt, "Table 3-0. Symptom index", BOLD, 8)
    yt = table(pg, 40, yt + 6, [200, 150, 80], [C.SYMPTOM_HEAD] + C.SYMPTOMS) + 18
    pg.text(40, yt, "Table 3-3. Displayed fault codes", BOLD, 8)
    # fill the page so the code table breaks after two rows
    table(pg, 40, H - 170, [110, 250, 172], [C.CODE_HEAD] + C.CODES[:2])
    c.showPage()


def p32(c):
    pg = Page2(c, "3-2")
    pg.text(40, 52, "Table 3-3. Displayed fault codes (Continued)", BOLD, 8)
    table(pg, 40, 60, [110, 250, 172], [C.CODE_HEAD] + C.CODES[2:])
    c.showPage()


def p33(c):
    """Tree 1, sheet 1: as variant 1, with the off-page box naming page 3-5."""
    saved = (C.GO3, C.T1_TITLE)
    C.GO3 = GO3
    try:
        pg_label = V1.Page
        V1.Page = lambda cc, label, change=False: Page2(cc, "3-3", change)
        V1.page_32(c)
    finally:
        V1.Page = pg_label
        C.GO3 = saved[0]


def p34(c):
    pg_label = V1.Page
    V1.Page = lambda cc, label, change=False: Page2(cc, "3-4", change)
    try:
        V1.page_33(c)
    finally:
        V1.Page = pg_label


def p35(c):
    pg = Page2(c, "3-5", change=True)
    pg.text(40, 52, f"Table 3-1. {C.T1_TITLE}. (CONT)", BOLD, 10)
    fx, fw, qx, qw, ax, aw = 40, 165, 220, 160, 445, 127
    frm = pg.box(qx + 20, 72, qw - 60, [(BOLD, FROM2)])
    q3 = pg.box(qx, frm[3] + 24, qw, [(BOLD, "3. " + C.Q3)])
    pg.arrow([mid_bottom(frm), mid_top(q3)])
    pg.bar(q3[1], q3[3])
    facet_column(pg, fx, q3[1], fw, C.Q3_FACETS)
    e3 = pg.box(ax, q3[1], aw, [(FONT, C.E3)])
    ym = (q3[1] + q3[3]) / 2
    pg.arrow([(q3[2], ym), (e3[0], ym)], "NO", (q3[2] + 8, ym - 3))
    xq = (q3[0] + q3[2]) / 2
    circ = pg.circle(xq, 700, 11, "A")
    pg.arrow([(xq, q3[3]), (xq, circ[1])], "YES", (xq + 4, q3[3] + 18))
    c.showPage()


def p36(c):
    pg = Page2(c, "3-6")
    pg.text(40, 52, f"Table 3-1. {C.T1_TITLE}. (CONT)", BOLD, 10)
    pg.figure(60, 100, W - 120, 120, [(10, 30, "Battery"), (90, 30, "Battery switch"), (170, 30, "Fuse F2"),
                                      (250, 30, "Key switch"), (330, 60, "Relay K1"), (410, 60, "Starter")], C.FIG31)
    c.showPage()


def p37(c):
    pg = Page2(c, "3-7", change=True)
    pg.text(40, 52, f"Table 3-1. {C.T1_TITLE}. (CONT)", BOLD, 10)
    fx, fw, qx, qw, ax, aw = 40, 165, 220, 160, 445, 127
    xq = qx + qw / 2
    circ = pg.circle(xq, 90, 11, "A")
    q4 = pg.box(qx, 130, qw, [(BOLD, "4. " + C.Q4)])
    pg.arrow([(xq, circ[3]), (xq, q4[1])])
    pg.bar(q4[1], q4[3])
    facet_column(pg, fx, q4[1], fw, C.Q4_FACETS)
    e4 = pg.box(ax, q4[1], aw, [(FONT, C.E4P)])
    ym = (q4[1] + q4[3]) / 2
    pg.arrow([(q4[2], ym), (e4[0], ym)], "PASS", (q4[2] + 8, ym - 3))
    a4 = pg.box(qx + 20, q4[3] + 40, qw - 40, [(FONT, C.A4F)])
    pg.arrow([(xq, q4[3]), (xq, a4[1])], "FAIL", (xq + 4, q4[3] + 20))
    c.showPage()


def p38(c):
    """Test procedure for question 4: steps in the left column, the CAUTION floating beside step 2."""
    pg = Page2(c, "3-8")
    pg.text(40, 52, f"TEST PROCEDURE FOR QUESTION 4. {C.TP4_TITLE}.", BOLD, 10)
    pg.text(60, 72, "Tools: " + C.TP4_TOOLS)
    yt = 96
    tops = []
    for n, s in enumerate(C.TP4_STEPS, 1):
        tops.append(yt)
        yt = pg.para(60, yt, 250, f"{n}. {s}") + 26
    pg.box(340, tops[1] + 3, 220, [(FONT, C.TP4_CAUTION)], heading="CAUTION", heading_center=True, lw=1.4)
    c.showPage()


def p39(c):
    pg_label = V1.Page
    V1.Page = lambda cc, label, change=False: Page2(cc, "3-9", change)
    try:
        V1.page_36(c)
    finally:
        V1.Page = pg_label


def p310(c):
    pg_label = V1.Page
    V1.Page = lambda cc, label, change=False: Page2(cc, "3-10", change)
    try:
        V1.page_37(c)
    finally:
        V1.Page = pg_label


def p41(c):
    pg = Page2(c, "4-1")
    pg.text(40, 52, "CHAPTER 4. MAINTENANCE TASKS", BOLD, 11)
    yt = pg.para(40, 68, W - 80, C.CH4_TEXT) + 10
    pg.text(40, yt + 8, f"Task 4-3. {C.T43_TITLE}.", BOLD, 10)
    pg.text(40, yt + 20, C.T43_APPLIES, FONT, 8)
    s = setup_box(pg, 40, yt + 28, W - 80, C.T43_SETUP)
    step_list(pg, 60, s[3] + 16, W - 120, [("step", C.T43_STEPS[0]), ("caution", C.T43_CAUTION),
                                          ("step", C.T43_STEPS[1]), ("warning", C.T43_WARNING), ("step", C.T43_STEPS[2])])
    c.showPage()


def p42(c):
    pg = Page2(c, "4-2", change=True)
    pg.text(40, 52, f"Task 4-3. {C.T43_TITLE}. (Continued)", BOLD, 10)
    yt = 76
    for n, s in T43_STEPS[3:]:
        x = 60 if n.isdigit() else 80
        yt = pg.para(x, yt, W - 140, f"{n}. {s}", size=9, lead=11) + 8
    c.showPage()


PAGES = [V1.page_ch1, p31, p32, p33, p34, p35, p36, p37, p38, p39, p310, p41, p42]
SCANNED = {12}


def _draw(path_or_buf, scans: dict[int, bytes]) -> None:
    c = canvas.Canvas(path_or_buf, pagesize=letter, invariant=1, pageCompression=1)
    c.setTitle(C.TITLE + " (variant 2)")
    c.setAuthor("Harvest proof (fictional)")
    for k, fn in enumerate(PAGES):
        if k in scans:
            c.drawImage(ImageReader(io.BytesIO(scans[k])), 0, 0, W, H)
            c.showPage()
        else:
            fn(c)
    c.save()


def make_pdf(path: Path) -> None:
    import pypdfium2 as pdfium
    buf = io.BytesIO()
    _draw(buf, {})
    pdf = pdfium.PdfDocument(buf.getvalue())
    scans = {}
    for k in SCANNED:
        img = pdf[k].render(scale=200 / 72).to_pil().convert("L")
        b = io.BytesIO()
        img.save(b, "PNG", optimize=True)
        scans[k] = b.getvalue()
    pdf.close()
    _draw(str(path), scans)


def expected() -> dict:
    x = copy.deepcopy(C.expected())
    for p in x["procedures"]:
        if p["title"] == C.T43_TITLE:
            p["steps"] = [s for _, s in T43_STEPS]
    x["variant"] = 2
    return x


def main(argv=None) -> int:
    out = Path((argv or sys.argv[1:] or [Path(__file__).resolve().parent])[0])
    out.mkdir(parents=True, exist_ok=True)
    make_pdf(out / "pump40v2-manual.pdf")
    (out / "pump40v2-expected.json").write_text(json.dumps(expected(), indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {out}/pump40v2-manual.pdf, pump40v2-expected.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
