"""Every format parser on small fixtures generated here (all text is written for these tests)."""

import io
import shutil

import pytest

from harvest_pipeline.model import subtree_text
from harvest_pipeline.parsers import parse

OPTS = {"id_prefix": "man", "citation_prefix": "MAN"}


def kinds(doc):
    return [n.kind for n, _ in doc.walk()]


def by_heading(doc):
    return {n.heading: n for n, _ in doc.walk() if n.heading}


MD = """# 1 Widget Hoist Manual

Intro paragraph for the manual.

## 1.1 Inspection

Inspect the hoist before each shift.

- Check the hook latch.
  - Latch spring returns fully.
- Check the rope for broken wires.

> CAUTION: Never inspect a loaded hoist.

Table 1 Inspection intervals

| Item | Interval |
|------|----------|
| Hook | daily |
| Rope | monthly |

![Hook diagram](img/hook.png)

## 1.2 Operation

Operate from the control station only.
"""


def test_markdown():
    d = parse("markdown", MD.encode(), "md", OPTS)
    ids = d.by_id()
    assert "man:1" in ids and ids["man:1.1"].parent_id == "man:1"
    assert ids["man:1.1"].citation == "MAN 1.1" and ids["man:1.1"].heading == "Inspection"
    para = ids["man:1.1-p1"]
    assert para.own_text == "Inspect the hoist before each shift."
    items = [c for c in para.children]
    assert [c.own_text for c in items] == ["Check the hook latch.", "Check the rope for broken wires."]
    assert items[0].children[0].own_text == "Latch spring returns fully."
    note = ids["man:1.1-note-1"]
    assert note.kind == "note" and note.heading == "CAUTION"
    t = ids["man:1.1-table-1"]
    assert t.heading == "Table 1 Inspection intervals" and "Rope | monthly" in t.own_text
    assert ids["man:1.1-fig-1"].meta["src"] == "img/hook.png"
    assert "Check the hook latch." in subtree_text(ids["man:1.1"])


def test_plain_text():
    src = "GENERAL REQUIREMENTS\n\nAll hoists shall be inspected.\nRecords shall be kept.\n\n2.1 Rope\n\nRope shall be replaced when worn.\n"
    d = parse("text", src.encode(), "txt", OPTS)
    hs = [n.own_text for n, _ in d.walk() if n.kind == "section"]
    assert hs == ["GENERAL REQUIREMENTS", "2.1 Rope"]
    assert d.by_id()["man:2.1-p1"].own_text == "Rope shall be replaced when worn."


HTML = """<html><head><title>x</title><style>p{}</style></head><body>
<nav>Home | About</nav>
<h1>Section 4 Rigging</h1>
<p>Rigging must be <b>inspected</b> before use.</p>
<ul><li>Slings<ul><li>Tag legible</li></ul></li><li>Shackles</li></ul>
<div class="note">NOTE: Remove damaged slings from service.</div>
<table><caption>Table 4-1 Sling angles</caption><tr><th>Angle</th><th>Factor</th></tr>
<tr><td>60</td><td>1.155</td></tr></table>
<figure><img src="sling.png" alt="sling"><figcaption>Figure 4-1 Sling angle</figcaption></figure>
<h2>4.1 Slings</h2><p>Slings must carry a tag.</p>
<script>var x = 1;</script>
</body></html>"""


def test_html():
    d = parse("html", HTML.encode(), "h", OPTS)
    ids = d.by_id()
    assert "man:4" in ids and ids["man:4.1"].parent_id == "man:4"
    p = ids["man:4-p1"]
    assert p.own_text == "Rigging must be inspected before use."
    assert [c.own_text for c in p.children] == ["Slings", "Shackles"]
    assert p.children[0].children[0].own_text == "Tag legible"
    assert ids["man:4-note-1"].kind == "note"
    assert "60 | 1.155" in ids["man:4-table-4-1"].own_text
    assert ids["man:4-fig-1"].heading == "Figure 4-1 Sling angle"
    alltext = " ".join(n.own_text for n, _ in d.walk())
    assert "Home" not in alltext and "var x" not in alltext


def test_docx():
    docx = pytest.importorskip("docx")
    doc = docx.Document()
    doc.add_heading("3 Load Charts", level=1)
    doc.add_paragraph("Use the chart for the configuration in use.")
    doc.add_paragraph("Read the radius first.", style="List Bullet")
    doc.add_heading("3.1 Deductions", level=2)
    doc.add_paragraph("Table 3-1 Deductions")
    t = doc.add_table(rows=2, cols=2)
    t.cell(0, 0).text, t.cell(0, 1).text = "Item", "Weight"
    t.cell(1, 0).text, t.cell(1, 1).text = "Hook block", "500 lb"
    doc.add_paragraph("WARNING: Deduct every attachment.")
    buf = io.BytesIO()
    doc.save(buf)
    d = parse("docx", buf.getvalue(), "d", OPTS)
    ids = d.by_id()
    assert ids["man:3.1"].parent_id == "man:3"
    assert ids["man:3-p1"].children[0].own_text == "Read the radius first."
    assert "Hook block | 500 lb" in ids["man:3.1-table-3-1"].own_text
    assert ids["man:3.1-note-1"].heading == "WARNING"


def _pdf(path, with_table=True):
    rl = pytest.importorskip("reportlab")  # noqa: F841
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    h1 = ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=16, leading=20)
    h2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=13, leading=16)
    body = ParagraphStyle("b", fontName="Helvetica", fontSize=10, leading=13)
    story = [Paragraph("5 Crane Inspection", h1), Spacer(1, 6),
             Paragraph("The inspector checks the crane before the first lift of the shift and records "
                       "every deficiency in the log for the supervisor.", body), Spacer(1, 8),
             Paragraph("5.1 Wire Rope", h2), Spacer(1, 4),
             Paragraph("Remove the rope from service when broken wires exceed the limit.", body), Spacer(1, 8)]
    if with_table:
        t = Table([["Rope class", "Broken wires"], ["6x19", "6"], ["6x37", "12"]])
        t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.5, colors.black)]))
        story += [t, Spacer(1, 8)]
    story += [Paragraph("Record the result in the inspection log.", body)]
    SimpleDocTemplate(str(path), pagesize=letter).build(story)
    return path.read_bytes()


def test_pdf_text_headings_tables(tmp_path):
    pytest.importorskip("pdfplumber")
    data = _pdf(tmp_path / "t.pdf")
    d = parse("pdf", data, "p", OPTS)
    ids = d.by_id()
    assert ids["man:5"].heading == "Crane Inspection"
    assert ids["man:5.1"].parent_id == "man:5"
    assert ids["man:5-p1"].own_text.startswith("The inspector checks the crane before the first lift")
    assert ids["man:5-p1"].own_text.endswith("for the supervisor.")       # wrapped lines joined
    t = ids["man:5.1-table-1"]
    assert "6x37 | 12" in t.own_text
    # table text is not duplicated into paragraphs
    assert not any("6x37" in n.own_text for n, _ in d.walk() if n.kind == "paragraph")
    assert ids["man:5.1-p2"].own_text == "Record the result in the inspection log."


@pytest.mark.skipif(shutil.which("tesseract") is None, reason="tesseract not installed")
def test_ocr_scanned_pdf(tmp_path):
    pytest.importorskip("pypdfium2")
    from PIL import Image, ImageDraw, ImageFont
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas

    img = Image.new("L", (1700, 700), 255)
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 44)
    except OSError:
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 44)
        except OSError:
            font = ImageFont.load_default(size=44)
    draw.text((80, 80), "HOIST INSPECTION", fill=0, font=font)
    draw.text((80, 220), "Inspect the hook latch before every shift.", fill=0, font=font)
    png = tmp_path / "scan.png"
    img.save(png)
    pdf = tmp_path / "scan.pdf"
    c = canvas.Canvas(str(pdf), pagesize=letter)
    c.drawImage(str(png), 20, 400, width=570, height=235)
    c.save()
    d = parse("pdf", pdf.read_bytes(), "s", OPTS)            # no text layer -> OCR automatically
    texts = [n.own_text for n, _ in d.walk()]
    assert "HOIST INSPECTION" in texts
    assert any("hook latch before every shift" in t for t in texts)
    d2 = parse("ocr", png.read_bytes(), "s", OPTS)           # a bare image
    assert any("hook latch" in n.own_text for n, _ in d2.walk())


XML = """<?xml version="1.0"?>
<manual xmlns="urn:test"><chapter num="7"><title>Hoisting Personnel</title>
<para>Personnel platforms must be <emphasis>proof tested</emphasis>.<indexterm>proof</indexterm></para>
<section num="7.1"><title>Platforms</title>
<itemizedlist><listitem><para>Rated for the load.</para></listitem><listitem><para>Guardrails installed.</para></listitem></itemizedlist>
<warning><para>Do not ride the hook.</para></warning>
<table><title>Table 7-1 Limits</title><tgroup><tbody><row><entry>Speed</entry><entry>100 fpm</entry></row></tbody></tgroup></table>
<figure><title>Figure 7-1 Platform</title><graphic fileref="plat.cgm"/></figure>
</section></chapter></manual>"""

SGML = """<!DOCTYPE manual PUBLIC "-//TEST//DTD Manual//EN" [ <!ENTITY sym SYSTEM "x"> ]>
<MANUAL><CHAPTER NUM="8"><TITLE>Rigging &sym; Gear
<PARA>Inspect slings before use.
<PARA>Discard damaged slings.
<STEP>Lower the load.
<STEP>Remove the sling.
</CHAPTER></MANUAL>"""


def test_xml_element_map():
    d = parse("xml", XML.encode(), "x", OPTS)
    ids = d.by_id()
    assert ids["man:7"].heading == "Hoisting Personnel"
    assert ids["man:7-p1"].own_text == "Personnel platforms must be proof tested."
    assert ids["man:7.1"].parent_id == "man:7"
    assert ids["man:7.1-note-1"].own_text == "WARNING: Do not ride the hook."
    assert "Speed | 100 fpm" in ids["man:7.1-table-7-1"].own_text
    assert ids["man:7.1-fig-1"].meta["src"] == "plat.cgm"


def test_sgml_tolerant():
    d = parse("sgml", SGML.encode(), "s", {**OPTS, "element_map": {"item": ["step"]}})
    ids = d.by_id()
    assert ids["man:8"].heading.startswith("Rigging")
    paras = [n.own_text for n, _ in d.walk() if n.kind == "paragraph"]
    assert "Inspect slings before use." in paras and "Discard damaged slings." in paras
    assert "Remove the sling." in paras


def test_custom_paragraph_numbers():
    src = "# 16 Cranes\n\n16.A.01 Cranes shall be inspected daily.\n\n16.A.02 Operators shall be qualified.\n"
    d = parse("markdown", src.encode(), "em", {"id_prefix": "em", "citation_prefix": "EM",
                                               "para_number_regex": r"^(\d+\.[A-Z]\.\d+)\b"})
    ids = d.by_id()
    assert ids["em:16.A.02"].citation == "EM 16.A.02" and ids["em:16.A.02"].parent_id == "em:16"
