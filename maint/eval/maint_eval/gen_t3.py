"""T3 items: questions a technician asks at a step, with gold supporting sentences, and questions
the job's manual text cannot answer.

Contexts are real step views from jobs driven through the engine. Opus sees the step and every
sentence of the job's scope (the step view plus all sections of the tree), numbered, and writes
questions; for an answerable one it names the sentences that answer it (required) and others that
would also be fine to show (acceptable). Gold is stored as sentence text, so it survives a different
retrieval at evaluation time.
"""
from __future__ import annotations

import json
import random
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from . import claude, jobs, packs, sets, t3
from .engine import Engine

PROMPT_VERSION = "t3-gen-2026-11-28.1"

REGISTERS = ["novice", "expert", "typo", "asr"]

SYSTEM = """You write test inputs for an offline maintenance assistant. A technician is on one step of a troubleshooting procedure and asks a question about it ("why am I checking this?", "what does X stand for?", "where is Y?", "what reading should I get?", "what do I need for this?"). The assistant may answer ONLY with sentences from the manual text of this job, chosen by number.

You see the current step and every sentence of the job's manual text, numbered. Write questions in the registers asked for:
- ANSWERABLE questions: the numbered sentences answer them. Give "required": the fewest sentence numbers that together answer the question fully; and "acceptable": other numbers that would also be fine to show (closely relevant). Ask as a technician would, in their own words; do not copy the sentence's wording.
- UNANSWERABLE questions: natural questions at this step that the numbered sentences do NOT answer (a value, a location, a meaning, a reason or a tool the text never gives). Not trick questions; things a real technician would ask. "required" and "acceptable" are empty.
Registers: novice (plain words), expert (terse shorthand), typo (fast phone typing with misspellings), asr (speech-to-text transcript with misheard words, lowercase).
No names of people, companies, units or places."""

SCHEMA = {"type": "object", "properties": {"questions": {"type": "array", "items": {"type": "object", "properties": {
    "register": {"type": "string", "enum": REGISTERS}, "answerable": {"type": "boolean"}, "question": {"type": "string"},
    "required": {"type": "array", "items": {"type": "integer"}}, "acceptable": {"type": "array", "items": {"type": "integer"}}},
    "required": ["register", "answerable", "question", "required", "acceptable"]}}}, "required": ["questions"]}


def scope_pool(eng: Engine, pack_id: str, view: dict) -> list[dict]:
    blocks = t3.step_passages(view)
    t = eng.tree(pack_id, view["node"]["tree_id"])
    for sid in t["tree"]["section_ids"]:
        blocks.append((sid, eng.section_text(pack_id, sid, depth=4, limit=8000)))
    pool = t3.build_pool(blocks)
    return pool


def contexts(eng: Engine, root: Path, max_trees: int = 20, seed: int = 13) -> list[tuple[str, dict]]:
    """Unique (pack, node) step views from driven jobs; for big packs a seeded sample of trees, and in
    each tree one node of each kind reached (so symptom, check and action steps all appear)."""
    rng = random.Random(seed)
    out, seen = [], set()
    for pack_id, _ in packs.pack_dirs(root).items():
        trees = eng.trees(pack_id)
        big = len(trees) > max_trees
        if big:
            trees = rng.sample(trees, max_trees)
        for tr in trees:
            t = eng.tree(pack_id, tr["tree_id"])
            for p in jobs.paths(t):
                d = jobs.drive(eng, pack_id, tr["tree_id"], p)
                views = d["views"]
                if big:
                    kinds: dict = {}
                    for v in views:
                        kinds.setdefault(v["node"]["kind"], []).append(v)
                    views = [rng.choice(vs) for vs in kinds.values()][:2]
                for v in views:
                    key = (pack_id, v["node"]["node_id"])
                    if key in seen or v["node"]["kind"] in ("end",):
                        continue
                    seen.add(key)
                    out.append((pack_id, v))
    return out


def generate(eng: Engine, root: Path, out: Path, jobs_n: int = 3) -> list[dict]:
    ctxs = contexts(eng, root)
    eq = {p: packs.equipment_label(eng, p) for p in {c[0] for c in ctxs}}

    def one(ix_ctx):
        ix, (pack_id, view) = ix_ctx
        pool = scope_pool(eng, pack_id, view)
        rng = random.Random(ix)
        regs = rng.sample(REGISTERS, 3)
        listing = "\n".join(f"{n}. [{p['label']}] {p['text']}" for n, p in enumerate(pool, 1))
        prompt = (f"EQUIPMENT: {eq[pack_id]}\nTROUBLESHOOTING: {view['tree']['title']}\n"
                  f"CURRENT STEP: {view['node']['text']}\n\nMANUAL TEXT OF THIS JOB:\n{listing}\n\n"
                  f"Write 3 questions: two answerable ({regs[0]}, {regs[1]}) and one unanswerable ({regs[2]}).")
        res = claude.call(SYSTEM, prompt, model="opus", schema=SCHEMA, tag=f"gen-t3:{pack_id}")
        items = []
        for n, q in enumerate(res["output"]["questions"]):
            req = [pool[i - 1]["text"] for i in q["required"] if 1 <= i <= len(pool)]
            acc = [pool[i - 1]["text"] for i in q["acceptable"] if 1 <= i <= len(pool)]
            answerable = bool(q["answerable"]) and bool(req)
            if q["answerable"] and not req:
                continue
            items.append({"task": "t3", "kind": "answerable" if answerable else "unanswerable", "pack_id": pack_id,
                          "register": q["register"], "text": q["question"].strip(),
                          "group": f"{pack_id}:{view['node']['tree_id']}",
                          "node_id": view["node"]["node_id"], "tree_id": view["node"]["tree_id"],
                          "gold": {"required": req, "acceptable": acc},
                          "gen": {"model": res.get("model_id"), "prompt": PROMPT_VERSION}})
        return items

    items: list[dict] = []
    with ThreadPoolExecutor(max_workers=jobs_n) as ex:
        for f in ex.map(one, list(enumerate(ctxs))):
            items.extend(f)
    for n, i in enumerate(items):
        i["id"] = f"t3:{i['pack_id']}:{i['node_id']}:{n:04d}"
    out.write_text("".join(json.dumps(i, ensure_ascii=False) + "\n" for i in items))
    return items


REVIEW_SYSTEM = """You audit a test set. Each case: a technician's question at a maintenance step, the manual sentences of the job (numbered), and the expected answer: either the sentence numbers that answer it, or "cannot be answered from these sentences".
Verdict "ok" if the expectation is right and fair: for an answerable case, the expected sentences really answer the question and no essential sentence is missing; for an unanswerable case, no sentence actually answers it. Otherwise "wrong", with why."""

REVIEW_SCHEMA = {"type": "object", "properties": {"cases": {"type": "array", "items": {"type": "object", "properties": {
    "key": {"type": "string"}, "verdict": {"type": "string", "enum": ["ok", "wrong"]}, "why": {"type": "string"}},
    "required": ["key", "verdict", "why"]}}}, "required": ["cases"]}


def review(eng: Engine, n: int, jobs_n: int = 3) -> dict:
    from .review import summary
    items = sets.load(sets.path("t3", "raw"))
    rng = random.Random(sets.SPLIT_SEED + 3)
    sample = items if len(items) <= n else rng.sample(items, n)
    views: dict = {}

    def view_for(i):
        k = (i["pack_id"], i["node_id"])
        if k not in views:
            jv = eng.call("job.start", {"pack_id": i["pack_id"], "tree_id": i["tree_id"], "node_id": i["node_id"],
                                        "level": "apprentice"})
            views[k] = jv["step"]
        return views[k]

    prepared = []
    for i in sample:
        v = view_for(i)
        pool = scope_pool(eng, i["pack_id"], v)
        prepared.append((i, v, pool))
    groups = [prepared[j:j + 5] for j in range(0, len(prepared), 5)]

    def one(group):
        parts = []
        for c, (i, v, pool) in enumerate(group):
            listing = "\n".join(f"{n}. {p['text']}" for n, p in enumerate(pool, 1))
            req = [n for n, p in enumerate(pool, 1) if any(t3._match(g, p["text"]) for g in i["gold"]["required"])]
            exp = f"sentences {req}" if i["kind"] == "answerable" else "cannot be answered from these sentences"
            parts.append(f"CASE K{c}\nSTEP: {v['node']['text']}\nQUESTION: {i['text']}\nSENTENCES:\n{listing}\nEXPECTED: {exp}")
        res = claude.call(REVIEW_SYSTEM, "\n\n".join(parts), model="sonnet", schema=REVIEW_SCHEMA, tag="review-t3")
        got = {x["key"]: x for x in res["output"]["cases"]}
        out = []
        for c, (i, v, pool) in enumerate(group):
            x = got.get(f"K{c}")
            if x:
                bad = x["verdict"] != "ok"
                out.append({"id": i["id"], "kind": i["kind"], "text": i["text"], "gold": i["gold"], "reviewer": x,
                            "flagged": bad, "flag": "wrong" if bad else "agree", "action": "pending" if bad else "keep"})
        return out

    rows = []
    with ThreadPoolExecutor(max_workers=jobs_n) as ex:
        for r in ex.map(one, groups):
            rows.extend(r)
    old = {r["id"]: r for r in sets.load(sets.path("t3", "review"))}
    for r in rows:
        if r["id"] in old and old[r["id"]].get("action") not in (None, "pending"):
            r.update({k: old[r["id"]][k] for k in ("action", "fixed", "hand") if k in old[r["id"]]})
    sets.save(sets.path("t3", "review"), rows)
    return summary("t3")
