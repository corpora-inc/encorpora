"""Maintenance manuals: page model, span checks, assembly and the pack's release filters.

A tiny flowchart page is drawn here with reportlab (two question boxes, YES/NO arrows, an action
box, a facet box, a WARNING box, a numbered step), and a scripted extraction output stands in
for the model. No network, no model, no Rust binary.
"""

from __future__ import annotations

import json
import sqlite3

import pytest

pytest.importorskip("reportlab")
pytest.importorskip("pdfplumber")

from reportlab.lib.pagesizes import letter  # noqa: E402
from reportlab.pdfgen import canvas  # noqa: E402

from harvest_pipeline.maint.assemble import Assembly, Ctx  # noqa: E402
from harvest_pipeline.maint.build import _forced_from  # noqa: E402
from harvest_pipeline.maint.extract import SCHEMA, units  # noqa: E402
from harvest_pipeline.maint.layout import page_models  # noqa: E402
from harvest_pipeline.maint.render import page_text  # noqa: E402
from harvest_pipeline.maint.spans import locate  # noqa: E402
from harvest_pipeline.pack import write_pack  # noqa: E402
from harvest_pipeline.stage import Stage  # noqa: E402

W, H = letter


def _box(c, x, top, w, h, lines, bold_first=False):
    c.rect(x, H - top - h, w, h)
    for i, ln in enumerate(lines):
        c.setFont("Helvetica-Bold" if bold_first and i == 0 else "Helvetica", 8)
        c.drawString(x + 4, H - top - 11 - i * 10, ln)


def _arrow(c, pts, label=None, at=None):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        c.line(x0, H - y0, x1, H - y1)
    (xa, ya), (xb, yb) = pts[-2], pts[-1]
    p = c.beginPath()
    if xb > xa:   # pointing right
        p.moveTo(xb, H - yb); p.lineTo(xb - 5, H - yb + 2.5); p.lineTo(xb - 5, H - yb - 2.5)
    else:         # pointing down
        p.moveTo(xb, H - yb); p.lineTo(xb - 2.5, H - yb + 5); p.lineTo(xb + 2.5, H - yb + 5)
    p.close()
    c.drawPath(p, stroke=0, fill=1)
    if label:
        c.setFont("Helvetica-Bold", 7)
        c.drawString(at[0], H - at[1], label)


@pytest.fixture(scope="module")
def pdf_bytes(tmp_path_factory) -> bytes:
    path = tmp_path_factory.mktemp("maint") / "m.pdf"
    c = canvas.Canvas(str(path), pagesize=letter, invariant=1)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(40, H - 50, "Table 2-1. Lamp does not light.")
    _box(c, 110, 70, 400, 30, ["WARNING", "Switch the supply off before you open the lamp housing."], True)
    _box(c, 40, 120, 150, 40, ["POSSIBLE PROBLEMS", "1. Lamp failed.", "2. Fuse open."], True)
    _box(c, 220, 120, 160, 24, ["1. Is the fuse good?"])
    _box(c, 430, 120, 130, 24, ["Replace the fuse."])
    _arrow(c, [(380, 132), (430, 132)], "NO", (392, 128))
    _box(c, 220, 190, 160, 24, ["2. Does the lamp light with a new lamp?"])
    _arrow(c, [(300, 144), (300, 190)], "YES", (304, 170))
    _box(c, 430, 190, 130, 24, ["The fault is corrected."])
    _arrow(c, [(380, 202), (430, 202)], "YES", (392, 198))
    _box(c, 220, 250, 160, 24, ["Refer to field maintenance."])
    _arrow(c, [(300, 214), (300, 250)], "NO", (304, 236))
    c.setFont("Helvetica", 8)
    c.drawString(60, H - 300, "1. Remove the lamp cover.")
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(W / 2, 28, "2-7")
    c.showPage()
    c.save()
    return path.read_bytes()


@pytest.fixture(scope="module")
def models(pdf_bytes):
    return page_models(pdf_bytes, "lamp")


def _rid(pm, startswith: str) -> str:
    return next(r.id for r in pm.regions if r.words and pm.region_text(r).startswith(startswith))


def test_page_model(models):
    pm = models[0]
    assert pm.label == "2-7"
    q1, fuse, q2 = _rid(pm, "1. Is the fuse"), _rid(pm, "Replace the fuse"), _rid(pm, "2. Does the lamp")
    end, esc = _rid(pm, "The fault is corrected"), _rid(pm, "Refer to field")
    arrows = {(c.tail, c.head, pm.region_text(pm.region(c.label)) if c.label else None) for c in pm.connectors}
    assert (q1, fuse, "NO") in arrows
    assert (q1, q2, "YES") in arrows
    assert (q2, end, "YES") in arrows
    assert (q2, esc, "NO") in arrows
    text = page_text(pm)
    assert "connectors" in text and q1 in text
    assert [u.pages for u in units(models)] == [[0]]


def test_spans(models):
    pm = models[0]
    pages = {0: pm}
    rid = _rid(pm, "1. Is the fuse")
    loc, prob = locate(pages, 0, rid, "Is the fuse good?")
    assert prob is None and loc.text == "Is the fuse good?" and loc.region == rid
    loc, prob = locate(pages, 0, rid, "Is the fuse good")      # ends before trailing punctuation: allowed
    assert prob is None
    loc, prob = locate(pages, 0, rid, "s the fuse good?")      # starts inside a word: refused
    assert loc is None
    warn = _rid(pm, "WARNING")
    loc, prob = locate(pages, 0, rid, "Switch the supply off before you open the lamp housing.")
    assert loc is not None and loc.region == warn and loc.moved_from == rid
    loc, prob = locate(pages, 0, warn, "lamp housing. 1. Remove")  # across two regions
    assert loc is None and prob
    loc, prob = locate(pages, 0, rid, "Is the fuse bad?")
    assert loc is None and "not on page" in prob


def _output(pm, bad_text: bool = False) -> dict:
    r = lambda s: _rid(pm, s)  # noqa: E731
    sp = lambda s, t: {"region": r(s), "text": t}  # noqa: E731
    lab = lambda t, near: {"region": next(c.label for c in pm.connectors if c.label and pm.region_text(  # noqa: E731
        pm.region(c.label)) == t and c.tail == r(near)), "text": t}
    return {
        "headings": [],
        "trees": [{
            "ref": "Table 2-1", "title": sp("Table 2-1", "Lamp does not light."), "applies": [], "setup": [],
            "guards": [{"kind": "warning", "text": sp("WARNING", "Switch the supply off before you open the lamp housing."),
                        "applies": []}],
            "nodes": [
                {"id": "q1", "kind": "check", "number": "1",
                 "text": sp("1. Is the fuse", "Is the fuse good? NOT PRINTED" if bad_text else "Is the fuse good?"),
                 "expect": {"kind": "yes_no", "unit": None, "options": []},
                 "facets": [{"facet": "possible", "text": sp("POSSIBLE", "Lamp failed.")},
                            {"facet": "possible", "text": sp("POSSIBLE", "Fuse open.")}],
                 "branches": [{"label": lab("YES", "1. Is the fuse"), "outcome": "yes", "cond": None, "to": "q2", "retry": False},
                              {"label": lab("NO", "1. Is the fuse"), "outcome": "no", "cond": None, "to": "a1", "retry": False}],
                 "test_procedure": "tp1", "target": None, "guards": []},
                {"id": "a1", "kind": "action", "number": None, "text": sp("Replace the fuse", "Replace the fuse."),
                 "expect": None, "facets": [], "branches": [], "test_procedure": None, "target": None, "guards": []},
                {"id": "q2", "kind": "check", "number": "2", "text": sp("2. Does", "Does the lamp light with a new lamp?"),
                 "expect": {"kind": "yes_no", "unit": None, "options": []}, "facets": [],
                 "branches": [{"label": lab("YES", "2. Does"), "outcome": "yes", "cond": None, "to": "e1", "retry": False},
                              {"label": lab("NO", "2. Does"), "outcome": "no", "cond": None, "to": "x1", "retry": False}],
                 "test_procedure": None, "target": None, "guards": []},
                {"id": "e1", "kind": "end", "number": None, "text": sp("The fault", "The fault is corrected."),
                 "expect": None, "facets": [], "branches": [], "test_procedure": None, "target": None, "guards": []},
                {"id": "x1", "kind": "escalate", "number": None, "text": sp("Refer to", "Refer to field maintenance."),
                 "expect": None, "facets": [], "branches": [], "test_procedure": None, "target": None, "guards": []},
            ]}],
        "procedures": [{"key": "tp1", "ref": None, "kind": "test", "title": sp("Table 2-1", "Lamp does not light."),
                        "applies": [], "setup": [], "guards": [],
                        "steps": [{"text": sp("1. Remove", "Remove the lamp cover."), "check_kind": "pass_fail",
                                   "guards": []}]}],
        "symptoms": [], "codes": [], "equipment": [],
    }


def _assemble(models, out, tmp_path, forced=None):
    stage = Stage(tmp_path / "stage.sqlite")
    stage.add_source({"source_id": "lamp", "title": "Lamp manual", "publisher": "test", "url": "x", "edition": "1",
                      "retrieved_at": "2026-01-01", "sha256": "0", "media_type": "application/pdf", "license": "test"})
    asm = Assembly(stage, "lamp", models, "lamp", "", {"forced": forced or {}})
    ctx = Ctx(stage, {}, "lamp", "lamp", "scripted:x", {"backend": "scripted", "model_id": "x", "input_sha256": "i",
                                                         "prompt_version": "1", "created_at": ""}, "lamp@2-7", "p")
    asm.add_unit(ctx, [0], out)
    asm.finish_trees()
    asm.standalone_procedures()
    asm.resolve_targets()
    asm.index_rows()
    asm.resolve_applies()
    asm.leftovers()
    asm.write()
    return stage


def _pack(stage, tmp_path) -> sqlite3.Connection:
    res = write_pack(stage, tmp_path / "pack", "lamp", "1", "lamp", None)
    return sqlite3.connect(res["path"])


def test_assembly_ships_a_verified_tree(models, tmp_path):
    import jsonschema
    out = _output(models[0])
    jsonschema.validate(out, SCHEMA)
    stage = _assemble(models, out, tmp_path)
    verdicts = dict(stage.conn.execute("SELECT verdict, COUNT(*) FROM provenance GROUP BY verdict").fetchall())
    assert verdicts == {"pass": verdicts.get("pass")}, verdicts
    db = _pack(stage, tmp_path)
    nodes = dict(db.execute("SELECT node_id, text FROM fault_node").fetchall())
    assert sorted(nodes.values()) == sorted(["Is the fuse good?", "Replace the fuse.", "Does the lamp light with a new lamp?",
                                             "The fault is corrected.", "Refer to field maintenance."])
    # every node text is in its section's text (the core's verbatim rule)
    for text, sec in db.execute("SELECT n.text, s.text FROM fault_node n JOIN section s USING (section_id)"):
        assert " ".join(text.split()) in " ".join(sec.split())
    edges = {(a, b, lab) for a, b, lab in db.execute(
        "SELECT f.text, t.text, e.label FROM fault_edge e JOIN fault_node f ON f.node_id=e.from_node "
        "JOIN fault_node t ON t.node_id=e.to_node")}
    assert ("Is the fuse good?", "Replace the fuse.", "NO") in edges
    assert db.execute("SELECT COUNT(*) FROM fault_facet").fetchone()[0] == 2
    guard = db.execute("SELECT s.kind, s.heading, s.text FROM xref x JOIN section s ON s.section_id=x.from_id "
                       "WHERE x.kind='guards'").fetchone()
    assert guard == ("warning", "WARNING", "Switch the supply off before you open the lamp housing.")
    boxes = json.loads(db.execute("SELECT boxes FROM section_loc LIMIT 1").fetchone()[0])
    assert all(0 <= b[k] <= 1 for b in boxes for k in ("x0", "y0", "x1", "y1"))
    assert db.execute("SELECT page_label FROM section_loc LIMIT 1").fetchone()[0] == "2-7"
    assert db.execute("SELECT proc_id FROM fault_node WHERE text='Is the fuse good?'").fetchone()[0]


def test_a_span_not_in_the_text_layer_fails_its_node_and_the_whole_tree(models, tmp_path):
    stage = _assemble(models, _output(models[0], bad_text=True), tmp_path)
    notes = [json.loads(n) for (n,) in stage.conn.execute("SELECT notes FROM provenance WHERE verdict='fail'")]
    rows = {n["row"] for n in notes}
    assert any(r.startswith("fault_node:") for r in rows) and any(r.startswith("fault_tree:") for r in rows)
    db = _pack(stage, tmp_path)
    assert db.execute("SELECT COUNT(*) FROM fault_tree").fetchone()[0] == 0
    assert db.execute("SELECT COUNT(*) FROM fault_node").fetchone()[0] == 0     # no orphans of a failed tree
    assert db.execute("SELECT COUNT(*) FROM fault_edge").fetchone()[0] == 0
    # the source text still ships as sections, so it stays searchable
    assert db.execute("SELECT COUNT(*) FROM section WHERE text LIKE '%Is the fuse good?%'").fetchone()[0] >= 1


def test_a_branch_the_drawing_contradicts_fails(models, tmp_path):
    out = _output(models[0])
    q1 = out["trees"][0]["nodes"][0]
    q1["branches"][0]["to"], q1["branches"][1]["to"] = "a1", "q2"      # YES and NO swapped
    q1["branches"][0]["outcome"], q1["branches"][1]["outcome"] = "yes", "no"
    stage = _assemble(models, out, tmp_path)
    (notes,) = stage.conn.execute("SELECT notes FROM provenance WHERE notes LIKE '%fault_node:%q1%'").fetchone()
    assert any("drawn arrow" in p for p in json.loads(notes)["problems"])


def test_graph_violations_fail_their_rows(models, tmp_path):
    forced = {}
    report = {"ok": False, "graph": {"violations": [
        {"rule": "edge.coverage", "tree_id": "t-table-2-1", "node_id": "t-table-2-1.q1", "detail": "no branch for \"no\""},
        {"rule": "requirement.ref", "tree_id": None, "node_id": None, "detail": "requirement procedure:p-x#2: no such procedure"},
    ]}}
    assert _forced_from(report, forced) == 2
    assert ("fault_tree", "t-table-2-1") in forced and ("requirement", "procedure:p-x#2") in forced
    stage = _assemble(models, _output(models[0]), tmp_path, forced)
    v = stage.conn.execute("SELECT p.verdict FROM fault_tree t JOIN provenance p USING (prov_id)").fetchone()[0]
    assert v == "fail"


def test_crane_shaped_pack_has_no_maintenance_tables(tmp_path):
    stage = Stage(tmp_path / "s.sqlite")
    stage.add_source({"source_id": "s", "title": "t", "publisher": "p", "url": "u", "edition": "e",
                      "retrieved_at": "r", "sha256": "0", "media_type": "text/plain", "license": "l"})
    db = _pack(stage, tmp_path)
    assert db.execute("SELECT 1 FROM sqlite_master WHERE name='fault_tree'").fetchone() is None


def test_span_across_a_hyphenated_line_break():
    from harvest_pipeline.maint.layout import PageModel, Region, Word
    pm = PageModel("s", 0, 600, 800)
    words = ["Refer", "to", "field", "mainte-", "nance", "for", "repair."]
    for k, w in enumerate(words):
        pm.words.append(Word(k, w, 10 + 40 * (k % 4), 10 if k < 4 else 22, 40 + 40 * (k % 4), 18 if k < 4 else 30, 8))
    pm.regions.append(Region("p0.r1", "box", (0, 0, 300, 40), words=list(range(7)), lines=[[0, 1, 2, 3], [4, 5, 6]]))
    loc, prob = locate({0: pm}, 0, "p0.r1", "Refer to field maintenance for repair.")
    assert prob is None and loc.text == "Refer to field mainte- nance for repair."


def test_chart_printed_as_a_table(tmp_path):
    """STEP | SEQUENCE | RESULT | WHAT TO DO NEXT: one check per step, a branch per result row."""
    from harvest_pipeline.maint.rules import derive
    path = tmp_path / "chart.pdf"
    c = canvas.Canvas(str(path), pagesize=letter, invariant=1)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(40, H - 50, "Chart 14. Coolant temperature circuit failed high.")
    rows = [["STEP", "SEQUENCE", "RESULT", "WHAT TO DO NEXT"],
            ["14-1", "Read the fault code with the reader.", "PID 110 FMI 3", "Go to step 14-2."],
            ["", "", "No code", "Fault is intermittent. Refer to field maintenance."],
            ["14-2", "Is the sensor connector clean and tight?", "YES", "Replace the coolant temperature sensor."],
            ["", "", "NO", "Clean and reconnect the sensor connector."]]
    widths = [50, 200, 110, 180]
    y = 70
    for r in rows:
        x = 40
        for w, cell in zip(widths, r):
            c.rect(x, H - y - 18, w, 18)
            c.setFont("Helvetica", 7)
            c.drawString(x + 3, H - y - 12, cell)
            x += w
        y += 18
    c.drawCentredString(W / 2, 28, "H-121")
    c.showPage()
    c.save()
    pm = page_models(path.read_bytes(), "chart")[0]
    out, qs = derive([0], {0: pm})
    t = out["trees"][0]
    assert t["ref"] == "Chart 14" and t["title"]["text"].startswith("Coolant temperature circuit")
    checks = [n for n in t["nodes"] if n["kind"] == "check"]
    assert [n["number"] for n in checks] == ["14-1", "14-2"]
    s1 = checks[0]
    assert s1["expect"] == {"kind": "choice", "unit": None, "options": ["PID 110 FMI 3", "No code"]}
    assert s1["branches"][0]["to"] == checks[1]["id"]
    assert checks[1]["expect"]["kind"] == "yes_no"
    kinds = sorted(n["kind"] for n in t["nodes"] if n["kind"] != "check")
    assert kinds == ["action", "action", "escalate"]


def test_practice_items_from_structure(models, tmp_path):
    from harvest_pipeline.contract import question_problems
    from harvest_pipeline.maint.learn import build_items, load, verdicts
    stage = _assemble(models, _output(models[0]), tmp_path)
    res = write_pack(stage, tmp_path / "pack", "lamp", "1", "lamp", None)
    p = load(res["path"])
    items, topics, skills = build_items(p)
    nxt = [i for i in items if i["_type"] == "next"]
    assert nxt, items
    texts = {" ".join(n["text"].split()) for n in p.nodes.values()}
    for it in nxt:
        assert not question_problems(it)
        assert all(c in texts for c in it["choices"])            # every option is the manual's own words
        assert len(set(it["choices"])) == len(it["choices"]) >= 3
    q1 = next(i for i in nxt if "Is the fuse good?" in i["stem"] and "result is NO" in i["stem"])
    assert q1["choices"][int(q1["answer"])] == "Replace the fuse."
    assert {s["skill_id"] for s in skills} >= {i["skill_id"] for i in items}
    readers = {"solver": ("with_source", {}), "opt-sonnet": ("options_only", {}), "nos-sonnet": ("no_source", {})}
    ans = {"solver": {i["q_id"]: int(i["answer"]) for i in items},
           "opt-sonnet": {i["q_id"]: int(i["answer"]) for i in items},
           "nos-sonnet": {i["q_id"]: (int(i["answer"]) + 1) % len(i["choices"]) for i in items}}
    v, table = verdicts(items, ans, readers)
    assert all(x["pass"] for x in v.values())                   # one blind reader right is not enough to fail
    ans["nos-sonnet"] = ans["opt-sonnet"]
    v, _ = verdicts(items, ans, readers)
    assert not any(x["pass"] for x in v.values())               # both blind readers right: too guessable
