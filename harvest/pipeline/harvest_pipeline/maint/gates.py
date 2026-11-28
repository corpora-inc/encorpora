"""Keyless gates on every build, whatever the reader: rows a reading got wrong in ways span checks cannot
see are held for review instead of shipping.

1. Printed numbering. A step printed "5." right after "3.", or a lettered substep out of its run, is
   held, and its procedure with it; a list that starts again at 1 is a second list, not a fault. A procedure whose first printed number is not the
   list's first (1, or a) is flagged in its provenance notes, not held: a manual may continue a list
   after a heading.
2. Orphans and repeats.
   - A test procedure no question references is held when it reads as a piece of a tree: its title is a
     numbered or lettered step ("STEP 3. ...", "C. Procedure"), another procedure has the same title,
     or it holds a single step. A named test that stands alone in a workshop manual ships.
   - A procedure repeated with the same title and the same steps is held after its first copy.
   - A free-standing procedure whose steps sit on a troubleshooting page (one that prints question
     boxes) is held: such steps belong to a tree.
3. Coverage gates. On a unit's pages, when question boxes are printed but few reached a tree, or
   warnings and cautions are printed but few are attached, every row of the unit is held.
   Thresholds are configuration (`maint.gates`).

Held rows get verdict `needs_review` with the gate's reason; the release filter ships only `pass`.
"""

from __future__ import annotations

import json
import re

from .coverage import WARNING_CLASSES, guard_blocks, question_boxes

DEFAULTS = {
    "numbering": True,
    "orphans": True,
    # a unit is held when at least `min_present` are printed on its pages and fewer than `min_rate` attached
    "question_boxes": {"min_present": 3, "min_rate": 0.5},
    "warnings": {"min_present": 3, "min_rate": 0.25},
}
_LEAD = re.compile(r"^\(?(\d{1,3}|[a-z])[.)]\s")
_MARK = re.compile(r"^\(?(\d{1,3}|[a-z])[.)]$")
_STEP_TITLE = re.compile(r"^(?:step\s+)?\(?(?:\d{1,3}|[a-z])[.)]\s", re.I)


def config(o: dict | None) -> dict:
    g = {**DEFAULTS, **(o or {})}
    for k in ("question_boxes", "warnings"):
        g[k] = {**DEFAULTS[k], **((o or {}).get(k) or {})}
    return g


def printed_marker(pm, loc) -> str | None:
    """The number or letter printed before a step: at the start of its words, or just before them on
    the same line ("3." "(b)")."""
    m = _LEAD.match(loc.text + " ")
    if m:
        return m.group(1)
    reg = pm.region(loc.region)
    for ln in reg.lines or [reg.words]:
        if loc.words and loc.words[0] in ln:
            k = ln.index(loc.words[0])
            if k > 0:
                m = _MARK.match(pm.words[ln[k - 1]].text)
                if m:
                    return m.group(1)
            break
    return None


def numbering_faults(markers: list[str | None]) -> tuple[list[int], bool]:
    """Positions (0-based) whose printed marker disagrees with its place among its siblings, and whether
    the list does not start at its first number. Numbers count 1, 2, 3 ...; a run of letters after a
    number counts a, b, c ... and restarts at each number. A number back at 1 starts a new list (a manual
    prints a second list in one procedure); a skip or a step out of order is a fault."""
    bad, prev_n, prev_l, first_bad, seen = [], None, None, False, False
    for k, m in enumerate(markers):
        if m is None:
            continue
        if m.isdigit():
            n = int(m)
            if prev_n is None:
                first_bad = first_bad or (not seen and n != 1)
            elif n != prev_n + 1 and n != 1:
                bad.append(k)
            prev_n, prev_l = n, None
        else:
            i = ord(m) - ord("a") + 1
            exp = 1 if prev_l is None else prev_l + 1
            if i != exp:
                if not seen and prev_n is None:
                    first_bad = True
                else:
                    bad.append(k)
            prev_l = i
        seen = True
    return bad, first_bad


def run(asm) -> dict:
    """Apply the gates to an assembled source; returns what each held."""
    g = config(asm.o.get("gates"))
    rep = {"numbering_steps": 0, "numbering_procedures": 0, "numbering_start_flagged": 0, "orphan_tests": 0, "repeats": 0,
           "troubleshooting_procedures": 0, "units_held": {}, "units": {}}
    asm.report["gates"] = rep
    done = [r for r in asm.procs if r.get("proc_id") and r.get("pid")]

    def hold_proc(rec, why):
        asm.review(rec["pid"], why)
        for sp in rec["steps"]:
            asm.review(sp, why)

    def step_locs(rec):
        return [asm.items.get(f"proc_step:{rec['proc_id']}#{k}") for k in range(1, len(rec["steps"]) + 1)]

    if g["numbering"]:
        for rec in done:
            its = step_locs(rec)
            markers = [printed_marker(asm.models[it["loc"].page], it["loc"]) if it else None for it in its]
            bad, first_bad = numbering_faults(markers)
            for k in bad:
                asm.review(rec["steps"][k], f"gate: printed {markers[k]!r} disagrees with its place among its steps")
            if bad:
                rep["numbering_steps"] += len(bad)
                rep["numbering_procedures"] += 1
                hold_proc(rec, "gate: its steps' printed numbers disagree with their order")
            if first_bad:
                rep["numbering_start_flagged"] += 1
                n = json.loads(asm.provs[rec["pid"]]["notes"])
                n.setdefault("notes", []).append("its steps do not start at the list's first number")
                asm.provs[rec["pid"]]["notes"] = json.dumps(n, ensure_ascii=False)
    if g["orphans"]:
        trouble_pages = {pm.index for pm in asm.models.values() if question_boxes(pm)}
        titles: dict = {}
        for rec in done:
            t = " ".join(((rec["tloc"].text if rec["tloc"] else "") or "").lower().split())
            titles[t] = titles.get(t, 0) + 1
        seen: dict = {}
        for rec in done:
            free = not rec.get("used")
            its = [it for it in step_locs(rec) if it]
            title = " ".join(((rec["tloc"].text if rec["tloc"] else "") or "").lower().split())
            fragment = bool(_STEP_TITLE.match(title)) or titles.get(title, 0) > 1 or len(rec["steps"]) == 1
            if free and rec["kind"] == "test" and fragment:
                rep["orphan_tests"] += 1
                hold_proc(rec, "gate: a test procedure no question references, read as a piece of a tree")
            key = (title,
                   tuple(" ".join(it["loc"].text.lower().split()) for it in its))
            if key in seen and its:
                rep["repeats"] += 1
                hold_proc(rec, "gate: a repeat of a procedure with the same title and steps")
            seen.setdefault(key, rec)
            if free and rec["kind"] != "test" and its and any(it["loc"].page in trouble_pages for it in its):
                rep["troubleshooting_procedures"] += 1
                hold_proc(rec, "gate: free-standing steps on a troubleshooting page hang from no tree")
    _coverage_gate(asm, g, rep)
    return rep


def _coverage_gate(asm, g: dict, rep: dict) -> None:
    passing = lambda pid: asm.provs[pid]["verdict"] == "pass"  # noqa: E731
    guarded = {}            # region -> passing guard sections in it (the region's own, or spans inside it)
    for i in asm.guard_info:
        if passing(i["pid"]):
            guarded.setdefault(i["region"], []).append(i)
    node_regions = {r["sec"]["rid"] for r, _ in asm.node_recs
                    if r.get("sec") and r.get("pid") and passing(r["pid"])}
    units: dict[str, list[int]] = {}
    for pg, (ctx, pages) in getattr(asm, "_ctx_pages", {}).items():
        units.setdefault(ctx.unit_key, sorted(pages))
    for unit, pages in sorted(units.items()):
        qp = qa = wp = wa = 0
        for pg in pages:
            pm = asm.models.get(pg)
            if pm is None:
                continue
            for r in question_boxes(pm):
                qp += 1
                qa += r.id in node_regions
            inner_seen: dict = {}
            for kind, r, k, _ in guard_blocks(pm):
                if kind not in WARNING_CLASSES:
                    continue
                wp += 1
                gs = guarded.get(r.id, [])
                if k is None:
                    wa += bool(gs)
                else:
                    inner_seen[r.id] = inner_seen.get(r.id, 0) + 1
                    wa += inner_seen[r.id] <= len(gs)
        rep["units"][unit] = {"question_boxes": [qa, qp], "warnings": [wa, wp]}
        why = None
        q, w = g["question_boxes"], g["warnings"]
        if qp >= q["min_present"] and qa / qp < q["min_rate"]:
            why = f"gate: {qa} of {qp} question boxes on its pages reached a tree"
        elif wp >= w["min_present"] and wa / wp < w["min_rate"]:
            why = f"gate: {wa} of {wp} warnings and cautions on its pages are attached"
        if why:
            rep["units_held"][unit] = why
            for pid, pr in asm.provs.items():
                if json.loads(pr["notes"]).get("unit") == unit:
                    asm.review(pid, why)
