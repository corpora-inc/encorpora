"""T2 items: close-out notes for real completed jobs, with the record fields they convey (the gold).

Each job is run through the engine API (`jobs.drive`); Opus sees the same context the model will see
(steps, numbered causes, actions and parts) and writes several notes in distinct registers, choosing
for each note what really happened (a listed cause or action, another one, or unknown; parts; time)
and writing the note so that it conveys exactly that.
"""
from __future__ import annotations

import json
import random
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from . import claude, jobs, packs, sets, t2
from .engine import Engine

PROMPT_VERSION = "t2-gen-2026-11-28.1"

REGISTERS = {
    "novice": "a new technician, plain words, a little unsure, two or three sentences",
    "expert": "an experienced technician, terse shop shorthand, a fragment or two",
    "typo": "typed fast on a phone with gloves: misspellings, abbreviations, no punctuation",
    "asr": "dictated in a noisy shop and transcribed by speech recognition: lowercase, misheard technical words, "
           "filler words, numbers sometimes spelled out",
    "rambling": "a long spoken account with the facts buried among irrelevant detail",
}

SYSTEM = """You write test inputs for a maintenance app. After a job, the technician writes or dictates what fixed it; the app must turn that note into a close-out record: verified cause, corrective action, parts used, minutes spent, a short note.

You see the job as the app recorded it: the steps and results, and the numbered causes (C#), actions (A#) and parts (P#) the manual lists for this job. For each note:
1. First decide what really happened, consistent with the recorded steps. Vary it across notes:
   - cause: usually a listed cause (C#); sometimes a different real cause the list lacks ("other"); sometimes the technician never says what the cause was ("unknown").
   - action: usually a reached action (A#); sometimes a different action ("other"); rarely "unknown" (the note does not say what was done).
   - parts: only parts the note says were used; listed (P#) or other; with a quantity only when the note states it. Often no parts at all.
   - minutes: about half the notes state the time (in minutes, hours, or "half an hour"); the rest do not (null).
2. Then write the note so that a careful reader would extract exactly those fields and nothing else. Never mention a cause the record does not have; if the cause is unknown, the note must not imply one. Do not copy the manual's wording; real people paraphrase.
No names of people, companies, units or places. Serial numbers and part numbers only if listed."""

CHOICE = {"type": "object", "properties": {"kind": {"type": "string", "enum": ["listed", "other", "unknown"]},
                                           "number": {"type": ["integer", "null"]}, "text": {"type": ["string", "null"]}},
          "required": ["kind", "number", "text"]}
SCHEMA = {"type": "object", "properties": {"notes": {"type": "array", "items": {"type": "object", "properties": {
    "register": {"type": "string", "enum": list(REGISTERS)}, "note": {"type": "string"},
    "cause": CHOICE, "action": CHOICE,
    "parts": {"type": "array", "items": {"type": "object", "properties": {
        "kind": {"type": "string", "enum": ["listed", "other"]}, "number": {"type": ["integer", "null"]},
        "text": {"type": ["string", "null"]}, "qty": {"type": ["integer", "null"]}},
        "required": ["kind", "number", "text", "qty"]}},
    "minutes": {"type": ["integer", "null"]}},
    "required": ["register", "note", "cause", "action", "parts", "minutes"]}}}, "required": ["notes"]}


def _clean_choice(c: dict, n: int) -> dict | None:
    if c["kind"] == "listed":
        return {"kind": "listed", "number": c["number"]} if isinstance(c.get("number"), int) and 1 <= c["number"] <= n else None
    if c["kind"] == "other":
        return {"kind": "other", "text": c.get("text") or ""}
    return {"kind": "unknown"}


def contexts(eng: Engine, root: Path, max_trees: int = 36, max_paths: int = 4, seed: int = 11) -> list[dict]:
    rng = random.Random(seed)
    out = []
    for pack_id, db in packs.pack_dirs(root).items():
        trees = eng.trees(pack_id)
        if len(trees) > max_trees:
            trees = rng.sample(trees, max_trees)
        for tr in trees:
            t = eng.tree(pack_id, tr["tree_id"])
            ps = jobs.paths(t)
            if len(ps) > max_paths:
                ps = rng.sample(ps, max_paths)
            for p in ps:
                d = jobs.drive(eng, pack_id, tr["tree_id"], p)
                ctx = t2.context(eng, pack_id, d)
                if ctx["actions"]:
                    out.append(ctx)
    return out


def generate(eng: Engine, root: Path, out: Path, jobs_n: int = 3) -> list[dict]:
    ctxs = contexts(eng, root)
    eq = {p: packs.equipment_label(eng, p) for p in {c["pack_id"] for c in ctxs}}
    small = {p for p in eq if len(eng.trees(p)) < 10}

    def one(ix_ctx):
        ix, ctx = ix_ctx
        regs = list(REGISTERS) if ctx["pack_id"] in small else random.Random(ix).sample(list(REGISTERS), 3)
        prompt = (t2.render_context(ctx, eq[ctx["pack_id"]]) + "\n\nWrite one note per register, in this order: "
                  + ", ".join(f"{r} ({REGISTERS[r]})" for r in regs) + ".")
        # The job id differs on every run; keep it out of the prompt so the cache holds.
        res = claude.call(SYSTEM, prompt, model="opus", schema=SCHEMA, tag=f"gen-t2:{ctx['pack_id']}")
        items = []
        for n, it in enumerate(res["output"]["notes"]):
            cause = _clean_choice(it["cause"], len(ctx["causes"]))
            action = _clean_choice(it["action"], len(ctx["actions"]))
            parts = []
            for p in it["parts"]:
                if p["kind"] == "listed" and isinstance(p.get("number"), int) and 1 <= p["number"] <= len(ctx["parts"]):
                    parts.append({"kind": "listed", "number": p["number"], "qty": p.get("qty")})
                elif p["kind"] == "other":
                    parts.append({"kind": "other", "text": p.get("text") or "", "qty": p.get("qty")})
            if cause is None or action is None:
                continue
            path_key = "-".join(s["node_id"].split(".")[-1] + str(s["result"]) for s in ctx["steps"])
            items.append({"task": "t2", "kind": "closeout", "pack_id": ctx["pack_id"], "register": it["register"],
                          "id": f"t2:{ctx['pack_id']}:{ctx['tree_id']}:{abs(hash(path_key)) % 10**8}:{n}",
                          "group": f"{ctx['pack_id']}:{ctx['tree_id']}", "text": it["note"].strip(),
                          "context": {k: v for k, v in ctx.items() if k != "job_id"},
                          "gold": {"cause": cause, "action": action, "parts": parts, "minutes": it["minutes"]},
                          "gen": {"model": res.get("model_id"), "prompt": PROMPT_VERSION}})
        return items

    items: list[dict] = []
    with ThreadPoolExecutor(max_workers=jobs_n) as ex:
        for f in ex.map(one, list(enumerate(ctxs))):
            items.extend(f)
    # Stable ids: hash() is salted per process; re-key by order.
    for n, i in enumerate(items):
        i["id"] = f"t2:{i['pack_id']}:{i['context']['tree_id']}:{n:04d}"
    out.write_text("".join(json.dumps(i, ensure_ascii=False) + "\n" for i in items))
    return items


REVIEW_SYSTEM = """You audit a test set. Each case is a technician's close-out note, the job context (numbered causes C#, actions A#, parts P#), and the record a reader is expected to extract. Check each field of the expected record against the note ONLY:
- cause, action: is the expected choice what the note says (or "unknown" when the note does not say)? Would a careful reader pick something else?
- parts: exactly the parts the note says were used?
- minutes: the time the note states, in minutes, or null when it states none?
Verdict "ok" if every field is right and fair; "wrong" if any field is wrong or a careful reader could reasonably extract something different. Name the field and why."""

REVIEW_SCHEMA = {"type": "object", "properties": {"cases": {"type": "array", "items": {"type": "object", "properties": {
    "key": {"type": "string"}, "verdict": {"type": "string", "enum": ["ok", "wrong"]},
    "fields": {"type": "array", "items": {"type": "string", "enum": ["cause", "action", "parts", "minutes"]}},
    "why": {"type": "string"}}, "required": ["key", "verdict", "fields", "why"]}}}, "required": ["cases"]}


def _fmt_choice(c: dict, prefix: str) -> str:
    return f"{prefix}{c['number']}" if c["kind"] == "listed" else (f"other: {c.get('text')}" if c["kind"] == "other" else "unknown")


def review(eng: Engine, n: int, jobs_n: int = 3) -> dict:
    from .review import summary
    items = sets.load(sets.path("t2", "raw"))
    rng = random.Random(sets.SPLIT_SEED + 2)
    sample = items if len(items) <= n else rng.sample(items, n)
    eq = {p: packs.equipment_label(eng, p) for p in {i["pack_id"] for i in sample}}
    groups = [sample[j:j + 6] for j in range(0, len(sample), 6)]

    def one(group):
        parts = []
        for c, i in enumerate(group):
            g = i["gold"]
            gp = ", ".join((f"P{p['number']}" if p["kind"] == "listed" else f"other: {p['text']}") +
                           (f" x{p['qty']}" if p.get("qty") else "") for p in g["parts"]) or "none"
            parts.append(f"CASE K{c}\n{t2.render_context(i['context'], eq[i['pack_id']])}\nNOTE: {i['text']}\n"
                         f"EXPECTED: cause={_fmt_choice(g['cause'], 'C')}; action={_fmt_choice(g['action'], 'A')}; "
                         f"parts={gp}; minutes={g['minutes']}")
        res = claude.call(REVIEW_SYSTEM, "\n\n".join(parts), model="sonnet", schema=REVIEW_SCHEMA, tag="review-t2")
        got = {x["key"]: x for x in res["output"]["cases"]}
        out = []
        for c, i in enumerate(group):
            x = got.get(f"K{c}")
            if x:
                bad = x["verdict"] != "ok"
                out.append({"id": i["id"], "kind": i["kind"], "text": i["text"], "gold": i["gold"],
                            "reviewer": x, "flagged": bad, "flag": ",".join(x["fields"]) if bad else "agree",
                            "action": "pending" if bad else "keep"})
        return out

    rows = []
    with ThreadPoolExecutor(max_workers=jobs_n) as ex:
        for r in ex.map(one, groups):
            rows.extend(r)
    old = {r["id"]: r for r in sets.load(sets.path("t2", "review"))}
    for r in rows:
        if r["id"] in old and old[r["id"]].get("action") not in (None, "pending"):
            r.update({k: old[r["id"]][k] for k in ("action", "fixed", "hand") if k in old[r["id"]]})
    sets.save(sets.path("t2", "review"), rows)
    return summary("t2")
