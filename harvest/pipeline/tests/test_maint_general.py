"""General behaviours added after the blind ingest test: each would help an unseen manual or log."""

from __future__ import annotations

import datetime as dt
from types import SimpleNamespace

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
                ("p0.r2", "Perform PMCS before beginning this task.", (60, 215, 530, 236))])
    assert Assembly._heading_above(pm, pm.region("p0.r2")) == "NOTE"
    far = _page([("p0.r1", "NOTE", (290, 100, 320, 110)),
                 ("p0.r2", "Perform PMCS before beginning this task.", (60, 215, 530, 236))])
    assert Assembly._heading_above(far, far.region("p0.r2")) is None


def test_engine_value_gap_becomes_a_choice_before_the_tree_fails():
    from harvest_pipeline.maint.build import _forced_from
    forced: dict = {}
    rep = {"graph": {"violations": [
        {"rule": "edge.coverage", "tree_id": "t-a", "node_id": "t-a.q1",
         "detail": 'edge "NO INDICATION" of a measured value has no numeric condition'},
        {"rule": "edge.coverage", "tree_id": "t-a", "node_id": "t-a.q1", "detail": "no edge takes values above 30"},
        {"rule": "edge.coverage", "tree_id": "t-b", "node_id": "t-b.q2", "detail": 'no branch for "no"'},
        {"rule": "node.target", "tree_id": "t-c", "node_id": "t-c.go1", "detail": 'no tree "t-x"'}]}}
    assert _forced_from(rep, forced) == 3
    assert ("as_choice", "t-a.q1") in forced and ("fault_tree", "t-a") not in forced   # second waits a round
    assert ("fault_tree", "t-b") in forced                      # a missing yes/no branch is a real defect
    assert ("as_text", "t-c.go1") in forced and ("fault_tree", "t-c") not in forced
    rep2 = {"graph": {"violations": [{"rule": "edge.coverage", "tree_id": "t-a", "node_id": "t-a.q1",
                                       "detail": "no edge takes values above 30"}]}}
    _forced_from(rep2, forced)
    assert ("fault_tree", "t-a") in forced                      # the fallback did not pass: the tree fails


def test_ocr_span_verifies_by_similarity_only_on_ocr_pages():
    from harvest_pipeline.maint.spans import locate
    lines = [("p0.r1", "Check hydralic fluid for foam or milky color.", (80, 100, 400, 112))]
    ok, prob = locate({0: _page(lines, ocr=True)}, 0, "p0.r1", "Check hydraulic fluid for foam or milky color.")
    assert ok and ok.ocr_similarity and ok.text == "Check hydraulic fluid for foam or milky color."
    no, prob = locate({0: _page(lines, ocr=False)}, 0, "p0.r1", "Check hydraulic fluid for foam or milky color.")
    assert no is None and "not on page" in prob
    bad, _ = locate({0: _page(lines, ocr=True)}, 0, "p0.r1", "Replace the pump motor and the reservoir cap.")
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


def test_log_columns_induced_and_refused():
    from harvest_pipeline.maint.logschema import SourceNotUnderstood, induce_columns
    fleet = SimpleNamespace(assets={"GS-101": {"serial": "1202"}, "GS-102": {"serial": "1023"}},
                            parts={"71-4021-7": "Filter"})
    rows = [{"Date": "7/2/24", "Bumper #": "101", "Write-up": "overheats", "Fix": "R/R thermostat",
             "Part #": "71-4021-7", "Hrs": "5,697"},
            {"Date": "7/13/24", "Bumper #": "gs102", "Write-up": "no crank", "Fix": "charged batt", "Part #": "",
             "Hrs": "5344"}]
    cmap, rep = induce_columns(list(rows[0]), rows, fleet)
    assert cmap["date"] == "Date" and cmap["date_format"] == "%m/%d/%y" and cmap["unit"] == "Bumper #"
    assert cmap["hours"] == "Hrs" and cmap["part"] == "Part #" and cmap["symptom"] == "Write-up"
    with pytest.raises(SourceNotUnderstood):
        induce_columns(["a", "b"], [{"a": "x", "b": "y"}], fleet)


def test_log_entries_dates_and_units_from_free_text():
    from harvest_pipeline.maint.logschema import entries, parse_date, unit_index, units_in
    idx = unit_index({"GS-107": {"serial": "1050"}, "GS-112": {"serial": "2001"}})
    aar = ("AFTER ACTION REVIEW\nEX TEST, 13APR26 - 22APR26\n\n2. Issues.\n"
           "   a. Day 2: GS-107 (relay clicks). Hour meter read 8116.\n   b. Day 6: gs 112 (batts dead).\n")
    e = entries(aar, idx)
    assert [parse_date(x[3]) for x in e] == [dt.date(2026, 4, 14), dt.date(2026, 4, 18)]
    shift = "== 10JUL24 NIGHT ==\n1810  GS-107 cranks no start. 5718 hrs. - JC\n2200  GS-112 oil leak\n"
    assert [x[3] for x in entries(shift, idx)] == ["10JUL24", "10JUL24"]
    assert units_in("UNIT ¢S-112 HRS 1050", idx) == [("¢S-112", "GS-112")]   # damaged prefix; 1050 is hours



def test_fragment_guard_is_rejected_whole_block_passes():
    from harvest_pipeline.maint.assemble import Assembly
    from harvest_pipeline.maint.spans import locate
    pm = _page([("p0.r1", "WARNING Keep hands clear of the platform when the liftgate is operating. The platform",
                 (96, 554, 516, 566)),
                ("p0.r2", "can crush or pinch. Death or serious injury may result.", (96, 568, 516, 580))])
    first, _ = locate({0: pm}, 0, "p0.r1", "Keep hands clear of the platform when the liftgate is operating. The platform")
    assert "stops mid-sentence" in Assembly._fragment(pm, pm.region("p0.r1"), first)
    second, _ = locate({0: pm}, 0, "p0.r2", "can crush or pinch. Death or serious injury may result.")
    assert "starts mid-sentence" in Assembly._fragment(pm, pm.region("p0.r2"), second)
    whole = _page([("p0.r1", "WARNING Batteries give off a flammable gas. Do not smoke near them.", (72, 100, 558, 112))])
    loc, _ = locate({0: whole}, 0, "p0.r1", "Batteries give off a flammable gas. Do not smoke near them.")
    assert Assembly._fragment(whole, whole.region("p0.r1"), loc) is None


def test_ocr_paragraphs_regrouped_by_geometry():
    from harvest_pipeline.maint.layout import regroup_paragraphs
    pm = _page([("p0.r1", "WARNING", (290, 370, 330, 380)),
                ("p0.r2", "Support the raised platform with safety blocks before working under it. Do not rely on the",
                 (96, 384, 516, 394)),
                ("p0.r3", "hydraulic system to hold the platform.", (96, 396, 248, 406)),
                ("p0.r4", "Step 2. Check flow control valve for blockage.", (90, 424, 439, 434))], ocr=True)
    regroup_paragraphs(pm)
    texts = [pm.region_text(r) for r in pm.regions if r.words]
    assert texts[0].startswith("WARNING Support") and texts[0].endswith("hold the platform.")
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
    v = Variants([{"equip_id": "a", "name": "DGT-30"}, {"equip_id": "b", "name": "DGT-30A1"},
                  {"equip_id": "c", "name": "DGT-30A2"}])
    v.effectivity(["DGT-30 serial numbers 1001 through 1400, DGT-30A1 serial numbers 2001 through 2999, "
                   "DGT-30A2 serial numbers 3001 and subsequent."])
    assert statement("DGT-30 ONLY", v)["named"] == ["a"]                       # not every name starting so
    assert statement("A1, A2", v)["named"] == ["b", "c"]
    assert statement("On DGT-30A2 the indication is on the display", v) is None   # a mention is not a statement
    st = statement("SERIAL NUMBERS 1250 AND SUBSEQUENT", v)
    assert dict(v.by_serial(st["serial"])) == {"a": (1250, 1400), "b": None, "c": None}
    assert prefix_statement("2. DGT-30A1 and DGT-30A2: check the hose clamp.", v)[0]["named"] == ["b", "c"]


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


def test_unit_typos_need_exactly_one_unit():
    from harvest_pipeline.maint.logschema import typo_candidates, unit_index
    idx = unit_index({"GS-107": {}, "GS-115": {}, "GS-130": {}, "GS-113": {}})
    assert typo_candidates("GS-1O7", idx) == ["GS-107"]          # O for 0
    assert typo_candidates("G5-115", idx) == ["GS-115"]          # 5 for S
    assert typo_candidates("GS 1300", idx) == ["GS-130"]         # a digit written twice
    assert typo_candidates("GS-208", idx) == []                  # not one slip from any unit
