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
