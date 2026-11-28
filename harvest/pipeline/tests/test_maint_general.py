"""General behaviours: each would help an unseen manual or log."""

from __future__ import annotations

import pytest

from harvest_pipeline.maint.layout import PageModel, Region, Word


def _page(lines: list[tuple[str, str, tuple]], ocr: bool = False) -> PageModel:
    """lines: (region id, text, bbox) -> one region per entry, one line each."""
    pm = PageModel("s", 0, 612, 792, label="1", ocr=ocr)
    for rid, text, bbox in lines:
        ids = []
        for w in text.split():
            k = len(pm.words)
            pm.words.append(Word(k, w, bbox[0], bbox[1], bbox[2], bbox[3]))
            ids.append(k)
        pm.regions.append(Region(rid, "text", bbox, ids, lines=[ids]))
    return pm


def test_heading_split_from_its_body_is_still_that_block():
    from harvest_pipeline.maint.assemble import Assembly
    pm = _page([("p0.r1", "NOTE", (290, 200, 320, 210)),
                ("p0.r2", "Do the daily checks before beginning this task.", (60, 215, 530, 236))])
    assert Assembly._heading_above(pm, pm.region("p0.r2")) == "NOTE"
    far = _page([("p0.r1", "NOTE", (290, 100, 320, 110)),
                 ("p0.r2", "Do the daily checks before beginning this task.", (60, 215, 530, 236))])
    assert Assembly._heading_above(far, far.region("p0.r2")) is None


def test_engine_value_gap_becomes_a_choice_before_the_tree_fails():
    """Closed ranges and named readings are value nodes (contract); only a gap the printed ranges leave
    falls back to a choice of printed labels, and the tree fails if that does not pass."""
    from harvest_pipeline.maint.build import _forced_from
    forced: dict = {}
    rep = {"graph": {"violations": [
        {"rule": "edge.coverage", "tree_id": "t-a", "node_id": "t-a.q1", "detail": "no edge takes values above 30"},
        {"rule": "edge.coverage", "tree_id": "t-a", "node_id": "t-a.q1", "detail": "no edge takes values from 1 up to 2"},
        {"rule": "edge.coverage", "tree_id": "t-b", "node_id": "t-b.q2", "detail": 'no branch for "no"'},
        {"rule": "node.target", "tree_id": "t-c", "node_id": "t-c.go1", "detail": 'no tree "t-x"'}]}}
    assert _forced_from(rep, forced) == 3
    assert ("as_choice", "t-a.q1") in forced and ("fault_tree", "t-a") not in forced   # second waits a round
    assert ("fault_tree", "t-b") in forced                      # a missing yes/no branch is a real defect
    assert ("as_text", "t-c.go1") in forced and ("fault_tree", "t-c") not in forced
    _forced_from({"graph": {"violations": [{"rule": "edge.coverage", "tree_id": "t-a", "node_id": "t-a.q1",
                                            "detail": "no edge takes values above 30"}]}}, forced)
    assert ("fault_tree", "t-a") in forced                      # the fallback did not pass: the tree fails


def test_unresolvable_violation_holds_its_unit_not_the_build():
    import json
    import sqlite3
    from harvest_pipeline.maint.build import _forced_from
    c = sqlite3.connect(":memory:")
    c.execute("CREATE TABLE provenance (notes TEXT)")
    c.execute("INSERT INTO provenance VALUES (?)", (json.dumps({"unit": "mc@3-1", "row": "xref:guard:mc:fci/note->mc:fci"}),))
    c.execute("INSERT INTO provenance VALUES (?)", (json.dumps({"unit": "mc@3-4", "row": "fault_tree:t-1"}),))
    forced: dict = {}
    v = {"rule": "guard.resolve", "tree_id": None, "node_id": None, "detail": "guard mc:fci/note: no such section"}
    assert _forced_from({"graph": {"violations": [v]}}, forced, c) == 1
    assert ("unit", "mc@3-1") in forced and ("unit", "mc@3-4") not in forced
    with pytest.raises(SystemExit):                             # names no row of the build: still loud
        _forced_from({"graph": {"violations": [{**v, "detail": "something unnamed"}]}}, {}, c)


def test_ocr_span_verifies_by_similarity_only_on_ocr_pages():
    from harvest_pipeline.maint.spans import locate
    lines = [("p0.r1", "Check the coolnat level in the tank.", (80, 100, 400, 112))]
    ok, prob = locate({0: _page(lines, ocr=True)}, 0, "p0.r1", "Check the coolant level in the tank.")
    assert ok and ok.ocr_similarity and ok.text == "Check the coolant level in the tank."
    no, prob = locate({0: _page(lines, ocr=False)}, 0, "p0.r1", "Check the coolant level in the tank.")
    assert no is None and "not on page" in prob
    bad, _ = locate({0: _page(lines, ocr=True)}, 0, "p0.r1", "Replace the drive belt and the idler pulley.")
    assert bad is None


def test_skew_angle_levels_a_rotated_scan():
    from PIL import Image, ImageDraw
    from harvest_pipeline.maint.layout import skew_angle
    img = Image.new("L", (800, 600), 255)
    d = ImageDraw.Draw(img)
    for y in range(60, 560, 40):
        d.rectangle((60, y, 740, y + 12), fill=0)
    assert abs(skew_angle(img)) < 0.3
    tilted = img.rotate(-1.2, fillcolor=255)
    assert abs(skew_angle(tilted) - 1.2) <= 0.3


def test_fragment_guard_is_rejected_whole_block_passes():
    from harvest_pipeline.maint.assemble import Assembly
    from harvest_pipeline.maint.spans import locate
    pm = _page([("p0.r1", "WARNING Keep hands clear of the arm when the unit is operating. The arm",
                 (96, 554, 516, 566)),
                ("p0.r2", "can crush or pinch. Death or serious injury may result.", (96, 568, 516, 580))])
    first, _ = locate({0: pm}, 0, "p0.r1", "Keep hands clear of the arm when the unit is operating. The arm")
    assert "stops mid-sentence" in Assembly._fragment(pm, pm.region("p0.r1"), first)
    second, _ = locate({0: pm}, 0, "p0.r2", "can crush or pinch. Death or serious injury may result.")
    assert "starts mid-sentence" in Assembly._fragment(pm, pm.region("p0.r2"), second)
    whole = _page([("p0.r1", "WARNING Batteries give off a flammable gas. Do not smoke near them.", (72, 100, 558, 112))])
    loc, _ = locate({0: whole}, 0, "p0.r1", "Batteries give off a flammable gas. Do not smoke near them.")
    assert Assembly._fragment(whole, whole.region("p0.r1"), loc) is None


def test_ocr_paragraphs_regrouped_by_geometry():
    from harvest_pipeline.maint.layout import regroup_paragraphs
    pm = _page([("p0.r1", "WARNING", (290, 370, 330, 380)),
                ("p0.r2", "Support the raised arm with blocks before working under it. Do not rely on the",
                 (96, 384, 516, 394)),
                ("p0.r3", "lift system to hold the arm.", (96, 396, 248, 406)),
                ("p0.r4", "Step 2. Check flow control valve for blockage.", (90, 424, 439, 434))], ocr=True)
    regroup_paragraphs(pm)
    texts = [pm.region_text(r) for r in pm.regions if r.words]
    assert texts[0].startswith("WARNING Support") and texts[0].endswith("hold the arm.")
    assert texts[1].startswith("Step 2.")


def test_sub_procedures_under_printed_headings_and_their_guards():
    from harvest_pipeline.maint.subproc import is_heading, split_by_heading
    assert is_heading("FILTER REPLACEMENT", False) and is_heading("Installation and adjustment", True)
    assert not is_heading("1. Remove the filter.", False) and not is_heading("WARNING", False)
    pm = _page([("p0.r1", "4-3. ENGINE OIL AND FILTER SERVICE", (54, 100, 300, 110)),
                ("p0.r2", "DRAINING", (54, 130, 110, 140)),
                ("p0.r3", "CAUTION Hot oil burns.", (72, 145, 300, 155)),
                ("p0.r4", "1. Remove drain plug.", (72, 160, 300, 170)),
                ("p0.r5", "2. Install drain plug.", (72, 175, 300, 185)),
                ("p0.r6", "FILTER REPLACEMENT", (54, 195, 200, 205)),
                ("p0.r7", "1. Remove oil filter.", (72, 210, 300, 220))])
    sp = lambda rid, t: {"region": rid, "text": t}  # noqa: E731
    pr = {"key": "4-3", "ref": "4-3", "kind": "maintenance", "title": sp("p0.r1", "ENGINE OIL AND FILTER SERVICE"),
          "applies": [{"region": "x", "text": "y"}], "setup": [], "guards": [],
          "steps": [{"text": sp("p0.r4", "Remove drain plug."), "guards": [{"kind": "caution", "text": sp("p0.r3", "Hot oil burns.")}]},
                    {"text": sp("p0.r5", "Install drain plug."), "guards": []},
                    {"text": sp("p0.r7", "Remove oil filter."), "guards": []}]}
    out = split_by_heading([pr], {0: pm})
    assert [o["title"]["text"] for o in out] == ["ENGINE OIL AND FILTER SERVICE", "DRAINING", "FILTER REPLACEMENT"]
    assert [len(o["steps"]) for o in out] == [0, 2, 1]
    assert [g["text"]["text"] for g in out[1]["guards"]] == ["Hot oil burns."]     # guards the sub-procedure
    assert out[1]["steps"][0]["guards"] == [] and out[1]["applies"] == []


def test_applicability_statements_variants_and_serials():
    from harvest_pipeline.maint.applic import Variants, prefix_statement, statement
    v = Variants([{"equip_id": "a", "name": "RK-5"}, {"equip_id": "b", "name": "RK-5A1"},
                  {"equip_id": "c", "name": "RK-5A2"}])
    v.effectivity(["RK-5 serial numbers 1001 through 1400, RK-5A1 serial numbers 2001 through 2999, "
                   "RK-5A2 serial numbers 3001 and subsequent."])
    assert statement("RK-5 ONLY", v)["named"] == ["a"]                       # not every name starting so
    assert statement("A1, A2", v)["named"] == ["b", "c"]
    assert statement("On RK-5A2 the indication is on the display", v) is None   # a mention is not a statement
    st = statement("SERIAL NUMBERS 1250 AND SUBSEQUENT", v)
    assert dict(v.by_serial(st["serial"])) == {"a": (1250, 1400), "b": None, "c": None}
    assert prefix_statement("2. RK-5A1 and RK-5A2: check the hose clamp.", v)[0]["named"] == ["b", "c"]


def test_one_tree_per_printed_symptom():
    from harvest_pipeline.maint.assemble import split_by_symptom
    t = {"ref": "Table 3-2", "title": {"region": "r", "text": "Troubleshooting"}, "nodes": [
        {"id": "m3", "kind": "symptom", "text": {"text": "RAISES SLOWLY"}, "branches": [{"to": "s1"}]},
        {"id": "s1", "kind": "check", "text": {"text": "Check battery."}, "branches": [{"to": "a1"}]},
        {"id": "a1", "kind": "action", "text": {"text": "charge it"}, "branches": []},
        {"id": "m4", "kind": "symptom", "text": {"text": "WILL NOT LOWER"}, "branches": [{"to": "s2"}]},
        {"id": "s2", "kind": "check", "text": {"text": "Press DOWN."}, "branches": []}]}
    out = split_by_symptom([t])
    assert [o["title"]["text"] for o in out] == ["RAISES SLOWLY", "WILL NOT LOWER"]
    assert [[n["id"] for n in o["nodes"]] for o in out] == [["m3", "s1", "a1"], ["m4", "s2"]]
    assert out[0]["ref"] != out[1]["ref"]


def test_block_class_word_found_by_evidence_not_layout():
    from harvest_pipeline.maint.blocks import class_of_block, manual_classes
    lead = _page([("p0.r1", "Caution Hot surfaces can burn the skin.", (72, 100, 500, 112))])
    assert class_of_block(lead, lead.region("p0.r1"))["how"] == "lead-in"
    boxed = _page([("p0.r1", "Never run the engine indoors.", (45, 279, 290, 333)),
                   ("p0.r2", "DANGER", (45, 279, 290, 294))])
    boxed.region("p0.r2").parent = "p0.r1"
    cw = class_of_block(boxed, boxed.region("p0.r1"))
    assert cw["word"] == "DANGER" and cw["how"] == "label inside"
    prose = _page([("p0.r1", "B. Test Procedure NOTE: A supply that falls below 18 V is weak and must be replaced.",
                    (90, 546, 554, 700))])
    words = prose.region("p0.r1").words
    body = words[4:]                                       # the reading's span starts after "NOTE:"
    cw = class_of_block(prose, prose.region("p0.r1"), body)
    assert cw["word"] == "NOTE" and cw.get("before_span")
    plain = _page([("p0.r1", "Remove the four bolts.", (72, 100, 300, 112))])
    assert class_of_block(plain, plain.region("p0.r1")) is None
    defs = _page([("p0.r1", "DANGER: Indicates a hazard that will cause death or serious injury.",
                   (45, 155, 285, 165)),
                  ("p0.r2", "NOTICE: Indicates a risk of damage to the equipment.",
                   (45, 170, 285, 180))])
    cls = manual_classes({0: defs})
    assert [c["id"] for c in cls] == ["danger", "notice"] and cls[0]["rank"] == 1 and cls[0]["must_show"]


def test_reference_tables_from_column_text_with_lists_and_values():
    from harvest_pipeline.maint.reftables import cell_value, from_columns, kind_of
    pm = _page([("p0.r1", "Message Cause Resolution", (54, 144, 558, 166)),
                ("p0.r2", "E101 CTRL_RESTART", (59, 173, 161, 183)),
                ("p0.r3", "• The software restarted.", (194, 173, 337, 183)),
                ("p0.r4", "• The 12 V supply fell.", (194, 186, 337, 196)),
                ("p0.r5", "1. Download the log bundle.", (357, 173, 546, 183)),
                ("p0.r6", "2. Check the 12 V supply.", (357, 186, 546, 196)),
                ("p0.r7", "E110 SENSOR_NOT_SET", (59, 215, 161, 225)),
                ("p0.r8", "The sensor data is missing.", (194, 215, 337, 225)),
                ("p0.r9", "Run the calibration.", (357, 215, 546, 225))])
    # one header line whose word groups sit in three columns
    for w, x in zip(pm.region("p0.r1").words, (54, 194, 357)):
        pm.words[w].x0, pm.words[w].x1 = x, x + 40
    for r in pm.regions:          # each region's words spread left to right from its own start
        for k, w in enumerate(r.words):
            if r.id != "p0.r1":
                pm.words[w].x0, pm.words[w].x1 = r.bbox[0] + 8 * k, r.bbox[0] + 8 * k + 6
    t = from_columns(pm, [], set())[0]
    assert [c["role"] for c in t.columns] == ["key", "cause", "remedy"] and len(t.rows) == 2
    assert cell_value(t.rows[0]["cause"], "cause") == ["The software restarted.", "The 12 V supply fell."]
    assert cell_value(t.rows[0]["resolution"], "remedy") == ["Download the log bundle.", "Check the 12 V supply."]
    assert cell_value(["0.15 - 0.25 mm"], "value") == {"text": "0.15 - 0.25 mm", "min": 0.15, "max": 0.25,
                                                       "min_inclusive": True, "max_inclusive": True, "unit": "mm"}
    assert kind_of([{"role": "code", "label": "Code"}, {"role": "remedy", "label": "Fix"}]) == "message"


def test_printed_statements_as_conditions_over_attributes():
    from harvest_pipeline.maint.applic import Variants, parse_conditions
    v = Variants([{"equip_id": "a", "name": "RX-6"}, {"equip_id": "b", "name": "RX-8"}])
    cond, used = parse_conditions("RX-6 ALL; RX-8 POST SB 31-007", v)
    assert cond == {"any": [{"attr": "model", "op": "eq", "value": "RX-6"},
                            {"all": [{"attr": "model", "op": "eq", "value": "RX-8"},
                                     {"attr": "sb_31_007", "op": "eq", "value": "post"}]}]}
    assert used == {"model", "sb_31_007"}
    assert parse_conditions("RX-6 ALL; RX-8 ALL", v) == (None, set())      # models only: applies_to
    assert parse_conditions("K6-100001 and up", v)[0] == {"attr": "serial", "op": "range", "min": "K6-100001"}
    assert parse_conditions("Applies to firmware 2.4 and later.", v)[0] == {"attr": "firmware", "op": "ge", "value": "2.4"}
    assert parse_conditions("Hardware revision B only", v)[0] == {"attr": "hardware_revision", "op": "eq", "value": "B"}
