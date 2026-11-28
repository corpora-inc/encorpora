"""What a guard guards: positional candidates, the questions position leaves open, and a guard on one
step of a region that prints several."""

from __future__ import annotations

import json

from harvest_pipeline.maint.assemble import Assembly, Ctx
from harvest_pipeline.maint.layout import PageModel, Region, Word
from harvest_pipeline.maint import targets
from harvest_pipeline.stage import Stage


def _page() -> PageModel:
    """A task title, a WARNING, two steps printed in one region, a CAUTION, a third step."""
    pm = PageModel("s", 0, 612, 792, label="1")
    rows = [("p0.r1", ["TASK 1. Replace the pump"], 50),
            ("p0.r2", ["WARNING Shut off power before you start."], 70),
            ("p0.r3", ["1. Remove the cover.", "2. Remove the pump."], 90),
            ("p0.r4", ["CAUTION The pump is heavy."], 120),
            ("p0.r5", ["3. Install the new pump."], 140)]
    for rid, lines, top in rows:
        ids, line_ids = [], []
        for k, text in enumerate(lines):
            ln = []
            for x, w in enumerate(text.split()):
                i = len(pm.words)
                pm.words.append(Word(i, w, 50 + 40 * x, top + 12 * k, 88 + 40 * x, top + 12 * k + 10))
                ln.append(i)
            ids += ln
            line_ids.append(ln)
        pm.regions.append(Region(rid, "text", (50, top, 400, top + 12 * len(lines)), ids, lines=line_ids))
    return pm


def _out(caution_on: int) -> dict:
    sp = lambda r, t: {"region": r, "text": t}  # noqa: E731
    steps = [{"text": sp("p0.r3", "1. Remove the cover."), "check_kind": "pass_fail", "guards": []},
             {"text": sp("p0.r3", "2. Remove the pump."), "check_kind": "pass_fail", "guards": []},
             {"text": sp("p0.r5", "3. Install the new pump."), "check_kind": "pass_fail", "guards": []}]
    steps[caution_on - 1]["guards"].append({"kind": "caution", "text": sp("p0.r4", "The pump is heavy."), "applies": []})
    return {"headings": [], "trees": [], "symptoms": [], "codes": [], "equipment": [],
            "procedures": [{"key": "p1", "ref": None, "kind": "procedure", "title": sp("p0.r1", "TASK 1. Replace the pump"),
                            "applies": [], "setup": [], "steps": steps,
                            "guards": [{"kind": "warning", "text": sp("p0.r2", "Shut off power before you start."),
                                        "applies": []}]}]}


def _assemble(tmp_path, out):
    stage = Stage(tmp_path / "stage.sqlite")
    stage.add_source({"source_id": "s", "title": "t", "publisher": "p", "url": "x", "edition": "1",
                      "retrieved_at": "2026-01-01", "sha256": "0", "media_type": "application/pdf", "license": "test"})
    asm = Assembly(stage, "s", [_page()], "s", "", {})
    ctx = Ctx(stage, {}, "s", "s", "scripted:x", {"backend": "scripted", "model_id": "x", "input_sha256": "i",
                                                   "prompt_version": "1", "created_at": ""}, "s@1-1", "p")
    asm.add_unit(ctx, [0], out)
    asm.finish_trees()
    asm.standalone_procedures()
    asm.resolve_targets()
    return asm


def _guard(asm, word):
    return next(i for i in asm.guard_info if (i["gsec"].get("text") or "").startswith(word))


def test_position_settles_what_the_reading_supports(tmp_path):
    # the WARNING sits under the task title and above its first step: the reading's "whole task" stands;
    # the CAUTION sits right above step 3, which the reading named: nothing to ask
    asm = _assemble(tmp_path, _out(caution_on=3))
    assert targets.questions(asm) == []
    st = asm.report["targets"]
    assert st["guards"] == 2 and st["settled"] == 2


def test_open_placement_is_asked_with_positional_candidates(tmp_path):
    # the reading put the CAUTION on step 2 (above it); position offers the next step and the task
    asm = _assemble(tmp_path, _out(caution_on=2))
    asks = targets.questions(asm)
    assert len(asks) == 1
    tags = [c.tag for c in asks[0].cands]
    assert tags[0] == "read" and "next" in tags and "task" in tags
    labels = asks[0].question.options
    assert any(o.startswith("the next step: 3. Install the new pump.") for o in labels)
    assert any(o.startswith("the step: 2. Remove the pump.") for o in labels)


def test_an_answer_that_moves_a_guard_sends_it_to_review(tmp_path):
    from harvest_pipeline.cache import ResponseCache
    from harvest_pipeline.textutil import sha256_json
    author = {"backend": "claude-cli", "model": "sonnet"}
    asm = _assemble(tmp_path, _out(caution_on=2))
    asks = targets.questions(asm)
    asm.report.pop("targets")
    # a cached answer naming the next step: no model call in a build
    (unit, group, req), = list(targets._requests(asm, asks))
    nxt = [c.tag for c in asks[0].cands].index("next")
    cache = ResponseCache(tmp_path / "cache")
    cache.put({"task": targets.TASK, "prompt_version": targets.VERSION, "model": "claude-cli:sonnet", "key": unit,
               "input_sha256": sha256_json({"system": req.system, "schema": req.schema, "prompt": req.prompt}),
               "backend": "claude-cli", "model_id": "m", "created_at": "", "usage": {},
               "output": {"answers": {asks[0].question.id: nxt}}})
    cache.close()
    st = targets.answer(asm, author, tmp_path / "cache")
    assert st["answered"] == 1 and st["moved"] == 1 and st["moved_to"] == {"next": 1}
    g = _guard(asm, "The pump")
    assert g["target"]["text"] == "3. Install the new pump."
    # the reading and the question disagree: the guard goes to review, never silently ships
    assert asm.provs[g["pid"]]["verdict"] == "needs_review"
    # no answer in the cache: the reading's choice stands, and nothing is called
    (tmp_path / "c").mkdir()
    asm3 = _assemble(tmp_path / "c", _out(caution_on=2))
    st3 = targets.answer(asm3, author, tmp_path / "empty")
    assert st3["missing"] == 1 and st3["moved"] == 0


def test_a_guard_on_one_step_of_a_shared_region_names_that_step(tmp_path):
    # step 2 shares its region with step 1: a guard on step 2 names step 2 alone
    asm2 = _assemble(tmp_path, _out(caution_on=2))
    targets.answer(asm2, None, None)
    g = _guard(asm2, "The pump")
    own = g["target"]
    assert own["kind"] == "step" and own["text"] == "2. Remove the pump." and own["parent_rid"] == "p0.r3"
    assert g["row"]["to_id"] == own["sid"]
    row = asm2.items[g["item"]]["row"]
    assert json.loads(row["section_ids"]) == [own["sid"]]
    assert asm2.report["targets"]["own_section"] == 1
    # step 1, unguarded, keeps the region's section
    s1 = next(it for k, it in asm2.items.items() if k.endswith("#1"))
    assert json.loads(s1["row"]["section_ids"]) == [s1["sec"]["sid"]]
