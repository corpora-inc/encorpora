"""T2, close-out structuring: the technician's note in, the lesson record's fields out.

The job's own context, all from the engine: the path walked (node text and recorded result), the
candidate causes (the pack's open-cause facet across the tree), the actions (reached ones first), and
the parts and consumables the tree and the tasks it reached list. The model chooses causes, actions
and parts from those lists by number, or says "other" with a short text, or "unknown". Minutes are a
number or null. Unknown stays unknown.
"""
from __future__ import annotations

from .engine import Engine

PROMPT_VERSION = "t2-2026-11-28.1"


def context(eng: Engine, pack_id: str, drive_result: dict) -> dict:
    views = drive_result["views"]
    rep = drive_result["report"]
    tree_id = rep["tree_id"]
    t = eng.tree(pack_id, tree_id)
    info = eng.pack_info(pack_id)
    of = info.get("open_facet") or "possible"
    order = [n["node_id"] for n in t["nodes"]]
    nodes = {n["node_id"]: n for n in t["nodes"]}
    causes: list[str] = []
    for f in sorted(t.get("facets") or [], key=lambda f: (order.index(f["node_id"]) if f["node_id"] in order else 0, f["ord"])):
        if f["facet"] == of and f["text"] not in causes:
            causes.append(f["text"])
    reached = [v["node"]["node_id"] for v in views]
    acts_reached = [n for n in reached if nodes.get(n, {}).get("kind") in ("action", "escalate")]
    acts_other = [n for n in order if nodes[n]["kind"] in ("action", "escalate") and n not in acts_reached]
    actions = [{"node_id": n, "text": nodes[n]["text"], "reached": n in acts_reached} for n in acts_reached + acts_other]
    parts: list[dict] = []

    def add_parts(reqs):
        for r in reqs or []:
            if r.get("kind") in ("part", "consumable"):
                key = (r["text"], r.get("ident"))
                if key not in {(p["text"], p.get("ident")) for p in parts}:
                    parts.append({"text": r["text"], "ident": r.get("ident"), "qty": r.get("qty"), "kind": r["kind"]})

    for v in views:
        add_parts(v.get("setup"))
        add_parts(v.get("requirements"))
        if v.get("test_procedure"):
            add_parts(v["test_procedure"].get("requirements"))
        tgt = (v["node"].get("target") or "")
        if tgt.startswith("procedure:"):
            try:
                add_parts(eng.call("task.get", {"pack_id": pack_id, "proc_id": tgt.split(":", 1)[1]}).get("requirements"))
            except Exception as e:  # noqa: BLE001 - a missing task only means no parts from it
                print(f"task.get {tgt}: {e}")
    steps = []
    for s in rep["steps"]:
        if s.get("superseded_at"):
            continue
        res = s.get("label") or s.get("outcome")
        if s.get("value") is not None:
            res = f"{s['value']} {s.get('unit') or ''}".strip()
        steps.append({"node_id": s["node_id"], "text": s.get("text"), "result": res})
    last = views[-1]["node"] if views else None
    return {"pack_id": pack_id, "tree_id": tree_id, "tree_title": rep.get("tree_title"), "job_id": rep["job_id"],
            "symptom_id": rep.get("symptom_id"), "steps": steps,
            "last": {"node_id": last["node_id"], "kind": last["kind"], "text": last["text"]} if last else None,
            "causes": causes, "actions": actions, "parts": parts}


def render_context(ctx: dict, equipment: str) -> str:
    lines = [f"Equipment: {equipment}", f"Troubleshooting: {ctx['tree_title']}", "Steps recorded:"]
    for i, s in enumerate(ctx["steps"], 1):
        lines.append(f"  {i}. {s['text']} -> {s['result']}")
    if ctx["last"]:
        lines.append(f"Ended at: {ctx['last']['text']}")
    lines.append("Causes listed by the manual:" if ctx["causes"] else "Causes listed by the manual: (none)")
    lines += [f"  C{i}. {c}" for i, c in enumerate(ctx["causes"], 1)]
    lines.append("Actions in this troubleshooting (reached ones first):")
    lines += [f"  A{i}. {a['text']}{' [reached]' if a['reached'] else ''}" for i, a in enumerate(ctx["actions"], 1)]
    lines.append("Parts and consumables the manual lists for this job:" if ctx["parts"] else
                 "Parts and consumables the manual lists for this job: (none)")
    lines += [f"  P{i}. {p['text']}{' (' + p['ident'] + ')' if p.get('ident') else ''}" for i, p in enumerate(ctx["parts"], 1)]
    return "\n".join(lines)


SYSTEM = """You fill in the close-out record of a maintenance job from the technician's own note (typed or dictated, possibly with errors). You see the job's context: the steps recorded, the causes and actions the manual lists, and the parts it lists.
- cause: the verified cause. If the note states or clearly implies one of the listed causes, give its number. If it states a different cause, use "other" with a short text in the note's own words. If the note does not say what the cause was, use "unknown". Never guess a cause the note does not support.
- action: the corrective action actually taken, the same way (listed number, "other", or "unknown").
- parts: each part or consumable the note says was used: a listed number, or "other" with a short name. Quantity when stated, else null. Empty when none.
- minutes: the time spent if the note states it (convert hours to minutes), else null.
- note: anything else worth keeping, short, in the technician's words; empty if nothing.
Answer with JSON only."""


def _choice(n: int, text_len: int) -> dict:
    alts = [{"type": "object", "properties": {"kind": {"const": "other"}, "text": {"type": "string", "maxLength": text_len}},
             "required": ["kind", "text"], "additionalProperties": False},
            {"type": "object", "properties": {"kind": {"const": "unknown"}}, "required": ["kind"], "additionalProperties": False}]
    if n:
        alts.insert(0, {"type": "object", "properties": {"kind": {"const": "listed"},
                                                         "number": {"type": "integer", "enum": list(range(1, n + 1))}},
                        "required": ["kind", "number"], "additionalProperties": False})
    return {"anyOf": alts}


def schema(ctx: dict) -> dict:
    np_ = len(ctx["parts"])
    part_alts = [{"type": "object", "properties": {"kind": {"const": "other"}, "text": {"type": "string", "maxLength": 60},
                                                   "qty": {"type": ["integer", "null"]}},
                  "required": ["kind", "text", "qty"], "additionalProperties": False}]
    if np_:
        part_alts.insert(0, {"type": "object", "properties": {"kind": {"const": "listed"},
                                                              "number": {"type": "integer", "enum": list(range(1, np_ + 1))},
                                                              "qty": {"type": ["integer", "null"]}},
                             "required": ["kind", "number", "qty"], "additionalProperties": False})
    return {"type": "object", "properties": {
        "cause": _choice(len(ctx["causes"]), 100),
        "action": _choice(len(ctx["actions"]), 100),
        "parts": {"type": "array", "items": {"anyOf": part_alts}, "maxItems": 6},
        "minutes": {"type": ["integer", "null"]},
        "note": {"type": "string", "maxLength": 200}},
        "required": ["cause", "action", "parts", "minutes", "note"], "additionalProperties": False}


def norm_choice(c) -> tuple:
    if not isinstance(c, dict):
        return ("error",)
    k = c.get("kind")
    if k == "listed":
        return ("listed", c.get("number"))
    if k == "other":
        return ("other",)
    if k == "unknown":
        return ("unknown",)
    return ("error",)


def norm_parts(ps) -> list[tuple]:
    out = []
    for p in ps or []:
        if not isinstance(p, dict):
            continue
        if p.get("kind") == "listed":
            out.append(("listed", p.get("number")))
        elif p.get("kind") == "other":
            out.append(("other",))
    return out


def score(gold: dict, pred: dict | None) -> dict:
    if not isinstance(pred, dict):
        return {"error": True, "cause": False, "action": False, "parts": False, "minutes": False, "all": False}
    gc, pc = norm_choice(gold["cause"]), norm_choice(pred.get("cause"))
    ga, pa = norm_choice(gold["action"]), norm_choice(pred.get("action"))
    gp, pp = sorted(norm_parts(gold["parts"]), key=str), sorted(norm_parts(pred.get("parts")), key=str)
    gm, pm = gold.get("minutes"), pred.get("minutes")
    # Gold review found notes where two readings are both fair (a listed cause that restates the
    # message vs "unknown"; a replaced part the list lacks vs none). `alt` holds the other fair
    # answers; a prediction matching one counts as right. The primary gold is kept for the record.
    alt = gold.get("alt") or {}
    alt_c = [norm_choice(c) for c in alt.get("cause", [])]
    alt_a = [norm_choice(c) for c in alt.get("action", [])]
    alt_p = [sorted(norm_parts(p), key=str) for p in alt.get("parts", [])]
    if pc in alt_c:
        gc = pc
    if pa in alt_a:
        ga = pa
    if pp in alt_p:
        gp = pp
    tp = sum(min(gp.count(x), pp.count(x)) for x in set(gp))
    prec = tp / len(pp) if pp else (1.0 if not gp else 0.0)
    rec = tp / len(gp) if gp else (1.0 if not pp else 0.0)
    r = {"error": False, "cause": gc == pc, "action": ga == pa, "parts": gp == pp,
         "parts_f1": 2 * prec * rec / (prec + rec) if prec + rec else 0.0,
         "minutes": gm == pm,
         # Unknown stays unknown: the gold says the note gives no value, the model gave one anyway.
         "invented_cause": gc == ("unknown",) and pc[0] == "listed",
         "invented_action": ga == ("unknown",) and pa[0] == "listed",
         "invented_minutes": gm is None and pm is not None,
         "invented_parts": len(pp) > len(gp) and not gp,
         "gold_cause_unknown": gc == ("unknown",), "gold_minutes_null": gm is None}
    r["all"] = r["cause"] and r["action"] and r["parts"] and r["minutes"]
    return r


# -- v2 interface: labels that match the rendering (C1, A2, P1), free text only beside "other" ---------

SYSTEM_V2 = """You fill in the close-out record of a maintenance job from the technician's own note (typed or dictated, possibly with errors). You see the job's context: the steps recorded, the causes (C1, C2, ...) and actions (A1, A2, ...) the manual lists, and the parts it lists (P1, P2, ...).
- cause: the verified cause. If what the note says the cause was matches a listed cause in meaning (even in other words, or as a more specific instance of it), give that label. Use "other" only for a cause that no listed cause covers, and put its short text in cause_text. Use "unknown" when the note does not say or imply what the cause was. Never guess.
- action: the corrective action actually taken, the same way (a listed label when it matches in meaning, else "other" with action_text, or "unknown").
- parts: the labels of listed parts or consumables the note says were used; for a part the list lacks, add "other" and its short name in parts_other. Empty when none were used.
- minutes: the time spent if the note states it (hours to minutes), else null.
- note: anything else worth keeping, short; empty if nothing.
cause_text and action_text are empty unless the choice is "other". Answer with JSON only."""


def schema_v2(ctx: dict) -> dict:
    cs = [f"C{i}" for i in range(1, len(ctx["causes"]) + 1)] + ["other", "unknown"]
    as_ = [f"A{i}" for i in range(1, len(ctx["actions"]) + 1)] + ["other", "unknown"]
    ps = [f"P{i}" for i in range(1, len(ctx["parts"]) + 1)] + ["other"]
    return {"type": "object", "properties": {
        "cause": {"type": "string", "enum": cs}, "cause_text": {"type": "string", "maxLength": 100},
        "action": {"type": "string", "enum": as_}, "action_text": {"type": "string", "maxLength": 100},
        "parts": {"type": "array", "items": {"type": "string", "enum": ps}, "maxItems": 6},
        "parts_other": {"type": "array", "items": {"type": "string", "maxLength": 60}, "maxItems": 3},
        "minutes": {"type": ["integer", "null"]},
        "note": {"type": "string", "maxLength": 200}},
        "required": ["cause", "cause_text", "action", "action_text", "parts", "parts_other", "minutes", "note"],
        "additionalProperties": False}


def from_v2(out) -> dict | None:
    """Map a v2 record onto the v1 shape the scorer reads."""
    if not isinstance(out, dict):
        return None

    def ch(v, text):
        if isinstance(v, str) and v[:1] in "CA" and v[1:].isdigit():
            return {"kind": "listed", "number": int(v[1:])}
        if v == "other":
            return {"kind": "other", "text": text or ""}
        if v == "unknown":
            return {"kind": "unknown"}
        return {"kind": "error"}

    parts = []
    for p in out.get("parts") or []:
        if isinstance(p, str) and p.startswith("P") and p[1:].isdigit():
            parts.append({"kind": "listed", "number": int(p[1:]), "qty": None})
    others = [t for t in (out.get("parts_other") or []) if t]
    n_other = max(len(others), sum(1 for p in out.get("parts") or [] if p == "other"))
    parts += [{"kind": "other", "text": (others[i] if i < len(others) else ""), "qty": None} for i in range(n_other)]
    return {"cause": ch(out.get("cause"), out.get("cause_text")), "action": ch(out.get("action"), out.get("action_text")),
            "parts": parts, "minutes": out.get("minutes"), "note": out.get("note") or ""}
