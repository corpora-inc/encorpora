"""Keyless gates: printed numbering, orphans and repeats, coverage of what the pages print."""

from __future__ import annotations

from harvest_pipeline.maint import gates
from harvest_pipeline.maint.assemble import Assembly, Ctx
from harvest_pipeline.maint.layout import PageModel, Region, Word
from harvest_pipeline.stage import Stage


def test_numbering_follows_the_printed_list():
    f = gates.numbering_faults
    assert f(["1", "2", "3"]) == ([], False)
    assert f(["1", "a", "b", "2", "a"]) == ([], False)          # lettered runs restart under each number
    assert f(["1", "2", "1", "2"]) == ([], False)               # a second list in one procedure
    assert f(["1", "2", "4"]) == ([2], False)                   # a skipped number
    assert f(["1", "3", "2"]) == ([1, 2], False)                # out of order
    assert f(["1", "a", "c"]) == ([2], False)
    assert f(["3", "4"]) == ([], True)                          # does not start at the list's first number
    assert f([None, "1", "2"]) == ([], False)                    # unnumbered lines are not judged
    assert f([]) == ([], False)


def _page(rows) -> PageModel:
    pm = PageModel("s", 0, 612, 792, label="1")
    for rid, text, top, kind in rows:
        ids = []
        for x, w in enumerate(text.split()):
            i = len(pm.words)
            pm.words.append(Word(i, w, 50 + 30 * x, top, 78 + 30 * x, top + 10))
            ids.append(i)
        pm.regions.append(Region(rid, kind, (50, top, 560, top + 10), ids, lines=[ids]))
    return pm


def _assemble(tmp_path, pm, procedures, opts=None, second_unit=None):
    stage = Stage(tmp_path / "stage.sqlite")
    stage.add_source({"source_id": "s", "title": "t", "publisher": "p", "url": "x", "edition": "1",
                      "retrieved_at": "2026-01-01", "sha256": "0", "media_type": "application/pdf", "license": "test"})
    asm = Assembly(stage, "s", [pm], "s", "", opts or {})
    for unit, procs in [("s@1-1", procedures)] + ([("s@1-2", second_unit)] if second_unit else []):
        ctx = Ctx(stage, {}, "s", "s", "scripted:x", {"backend": "scripted", "model_id": "x", "input_sha256": "i",
                                                       "prompt_version": "1", "created_at": ""}, unit, "p")
        asm.add_unit(ctx, [0], {"headings": [], "trees": [], "symptoms": [], "codes": [], "equipment": [],
                                "procedures": procs})
    asm.finish_trees()
    asm.standalone_procedures()
    asm.resolve_targets()
    return asm


def _proc(key, title_rid, title, steps, kind="maintenance"):
    return {"key": key, "ref": None, "kind": kind, "title": {"region": title_rid, "text": title}, "applies": [],
            "setup": [], "guards": [],
            "steps": [{"text": {"region": r, "text": t}, "check_kind": "pass_fail", "guards": []} for r, t in steps]}


def _verdict(asm, pid):
    return asm.provs[pid]["verdict"]


def test_a_skipped_number_holds_the_procedure(tmp_path):
    pm = _page([("p0.r1", "1-1. SERVICE THE FILTER", 50, "text"), ("p0.r2", "1. Drain the bowl.", 70, "text"),
                ("p0.r3", "2. Close the valve.", 90, "text"), ("p0.r4", "4. Remove the element.", 110, "text"),
                ("p0.r5", "1-2. CHECK THE BELT", 140, "text"), ("p0.r6", "1. Look at the belt.", 160, "text")])
    asm = _assemble(tmp_path, pm, [
        _proc("a", "p0.r1", "1-1. SERVICE THE FILTER", [("p0.r2", "1. Drain the bowl."), ("p0.r3", "2. Close the valve."),
                                                         ("p0.r4", "4. Remove the element.")]),
        _proc("b", "p0.r5", "1-2. CHECK THE BELT", [("p0.r6", "1. Look at the belt.")])])
    rep = gates.run(asm)
    a, b = asm.procs
    assert rep["numbering_steps"] == 1 and rep["numbering_procedures"] == 1
    assert _verdict(asm, a["pid"]) == "needs_review" and all(_verdict(asm, s) == "needs_review" for s in a["steps"])
    assert _verdict(asm, b["pid"]) == "pass"


def test_orphan_tests_repeats_and_troubleshooting_steps_are_held(tmp_path):
    pm = _page([("p0.r1", "STEP 1. CHECK THE FUSE", 50, "text"), ("p0.r2", "1. Remove the fuse.", 70, "text"),
                ("p0.r3", "1-3. REPLACE THE LAMP", 100, "text"), ("p0.r4", "1. Unscrew the lamp.", 120, "text")])
    asm = _assemble(tmp_path, pm, [
        _proc("t", "p0.r1", "STEP 1. CHECK THE FUSE", [("p0.r2", "1. Remove the fuse.")], kind="test"),
        _proc("m", "p0.r3", "1-3. REPLACE THE LAMP", [("p0.r4", "1. Unscrew the lamp.")])],
        # the reading of an overlapping unit prints the same procedure again
        second_unit=[_proc("m", "p0.r3", "1-3. REPLACE THE LAMP", [("p0.r4", "1. Unscrew the lamp.")])])
    rep = gates.run(asm)
    t, m, m2 = asm.procs
    assert rep["orphan_tests"] == 1 and _verdict(asm, t["pid"]) == "needs_review"
    assert rep["repeats"] == 1 and _verdict(asm, m["pid"]) == "pass" and _verdict(asm, m2["pid"]) == "needs_review"
    assert rep["troubleshooting_procedures"] == 0          # no question box printed on this page


def test_unattached_question_boxes_hold_the_unit(tmp_path):
    pm = _page([("p0.r1", "1-1. SERVICE THE FILTER", 50, "text"), ("p0.r2", "1. Drain the bowl.", 70, "text")]
               + [(f"p0.r{k}", f"{k - 2}. Is the lamp lit?", 100 + 20 * k, "box") for k in range(3, 7)])
    proc = [_proc("a", "p0.r1", "1-1. SERVICE THE FILTER", [("p0.r2", "1. Drain the bowl.")])]
    asm = _assemble(tmp_path, pm, proc)
    rep = gates.run(asm)
    # four question boxes, none in a tree: the unit is held, and the free-standing steps on that page too
    assert rep["units"]["s@1-1"]["question_boxes"] == [0, 4]
    assert "s@1-1" in rep["units_held"] and rep["troubleshooting_procedures"] == 1
    assert _verdict(asm, asm.procs[0]["pid"]) == "needs_review"
    # thresholds are configuration: with the gate off for question boxes the unit is not held
    (tmp_path / "b").mkdir()
    asm2 = _assemble(tmp_path / "b", pm, proc, {"gates": {"question_boxes": {"min_present": 99}, "orphans": False}})
    assert gates.run(asm2)["units_held"] == {} and _verdict(asm2, asm2.procs[0]["pid"]) == "pass"
