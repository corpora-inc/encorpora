"""Gold check by a second model (Sonnet) with a different prompt from the one that wrote the items.

T1 is checked blind: the reviewer sees the report and a shuffled list of manual entries (the gold
entries plus the engine's nearest others) and says which entries the report describes, or none, and
whether it is realistic. It never sees the gold. A disagreement flags the item; flagged items are
then read by hand and fixed or dropped (`resolve`). T2 and T3 are checked with the gold shown, as a
fairness verdict, because their gold is a structured record that cannot be re-derived blind cheaply.

The review file (`<task>-review-v1.jsonl`, outside the repo) holds one line per reviewed item:
{id, verdict, reviewer, flagged, action: keep|fix|drop, fixed?, why}.
"""
from __future__ import annotations

import json
import random
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from . import claude, packs, sets
from .engine import Engine

T1_SYSTEM = """You audit a test set for a maintenance assistant. Each case is one thing a technician said, and a list of entries from the equipment manual's troubleshooting index (each with its verbatim manual text).

For each case decide which entries the technician's words describe:
- "one": exactly one entry clearly fits; give its letter.
- "several": two or three entries fit about equally well and a careful expert would need to ask a question to choose; give their letters.
- "none": no listed entry fits what was described.
Judge only from what the technician said and the manual text. Do not guess hidden intentions. Also flag a case as unrealistic if no real technician would say it (gibberish, contradictory, or it recites the manual)."""

T1_SCHEMA = {"type": "object", "properties": {"cases": {"type": "array", "items": {"type": "object", "properties": {
    "key": {"type": "string"}, "fit": {"type": "string", "enum": ["one", "several", "none"]},
    "letters": {"type": "array", "items": {"type": "string"}}, "realistic": {"type": "boolean"},
    "why": {"type": "string"}}, "required": ["key", "fit", "letters", "realistic", "why"]}}}, "required": ["cases"]}

LETTERS = "ABCDEFGH"


def _t1_sample(items: list[dict], n: int, rng: random.Random) -> list[dict]:
    """Every decline and ambiguous item (the error-prone kinds), plus a stratified sample of singles."""
    rest = [i for i in items if i["kind"] != "single"]
    singles = [i for i in items if i["kind"] == "single"]
    k = max(60, n - len(rest))
    by_reg: dict[str, list] = {}
    for i in singles:
        by_reg.setdefault(i["register"], []).append(i)
    pick = []
    for reg, xs in sorted(by_reg.items()):
        pick += rng.sample(xs, min(len(xs), round(k * len(xs) / len(singles))))
    return rest + pick


def _t1_judge(gold: set, fit: str, chosen: set, kind: str) -> tuple[bool, str]:
    if kind == "single":
        if fit == "one" and chosen == gold:
            return True, "agree"
        if fit == "several" and gold <= chosen:
            return False, "reviewer: several fit"
        if fit == "none":
            return False, "reviewer: none fit"
        return False, "reviewer: other entry"
    if kind == "decline":
        return (fit == "none", "agree" if fit == "none" else "reviewer: an entry fits")
    # ambiguous
    if fit == "several" and len(chosen & gold) >= 2:
        return True, "agree"
    if fit == "one":
        return False, "reviewer: only one fits"
    if fit == "none":
        return False, "reviewer: none fit"
    return False, "reviewer: different set"


def run_t1(eng: Engine, root: Path, n: int, jobs: int = 3) -> dict:
    items = sets.load(sets.path("t1", "raw"))
    rng = random.Random(sets.SPLIT_SEED + 1)
    sample = _t1_sample(items, n, rng)
    dbs = packs.pack_dirs(root)
    syms = {p: {s.symptom_id: s for s in packs.symptoms(db, p)} for p, db in dbs.items()}
    src: dict = {}

    def row(p, sid):
        if (p, sid) not in src:
            src[(p, sid)] = packs.source_row(eng, p, syms[p][sid].tree_id, limit=700)
        return src[(p, sid)]

    cases = []
    for i in sample:
        hits = [h["symptom"]["symptom_id"] for h in eng.symptom_search(i["pack_id"], i["text"], k=8)["hits"]]
        ents = list(dict.fromkeys(list(i["gold"]) + [h for h in hits if h not in i["gold"]]))[:6]
        # Fill to at least 4 with random entries so a list never gives the answer away by its size.
        pool = [s for s in syms[i["pack_id"]] if s not in ents]
        while len(ents) < min(4, len(syms[i["pack_id"]])) and pool:
            ents.append(pool.pop(rng.randrange(len(pool))))
        rng.shuffle(ents)
        cases.append((i, ents))

    groups = [cases[j:j + 10] for j in range(0, len(cases), 10)]

    def one(group):
        parts = []
        for c, (i, ents) in enumerate(group):
            lines = "\n".join(f"  {LETTERS[e]}. {row(i['pack_id'], sid)}".replace("\n", " | ") for e, sid in enumerate(ents))
            parts.append(f"CASE K{c}\nTECHNICIAN SAID: {i['text']}\nENTRIES:\n{lines}")
        res = claude.call(T1_SYSTEM, "\n\n".join(parts), model="sonnet", schema=T1_SCHEMA, tag="review-t1")
        got = {x["key"]: x for x in res["output"]["cases"]}
        out = []
        for c, (i, ents) in enumerate(group):
            x = got.get(f"K{c}")
            if not x:
                continue
            chosen = {ents[LETTERS.index(L)] for L in x["letters"] if L in LETTERS[:len(ents)]}
            ok, why = _t1_judge(set(i["gold"]), x["fit"], chosen, i["kind"])
            if not x["realistic"]:
                ok, why = False, "reviewer: unrealistic"
            out.append({"id": i["id"], "kind": i["kind"], "text": i["text"], "gold": i["gold"],
                        "reviewer": {"fit": x["fit"], "chosen": sorted(chosen), "realistic": x["realistic"],
                                     "why": x["why"]},
                        "flagged": not ok, "flag": why, "action": "keep" if ok else "pending"})
        return out

    reviewed = []
    with ThreadPoolExecutor(max_workers=jobs) as ex:
        for r in ex.map(one, groups):
            reviewed.extend(r)
    old = {r["id"]: r for r in sets.load(sets.path("t1", "review"))}
    for r in reviewed:  # keep hand decisions already made
        if r["id"] in old and old[r["id"]].get("action") not in (None, "pending"):
            r["action"] = old[r["id"]]["action"]
            r["fixed"] = old[r["id"]].get("fixed")
            r["hand"] = old[r["id"]].get("hand")
    sets.save(sets.path("t1", "review"), reviewed)
    return summary("t1")


def summary(task: str) -> dict:
    rs = sets.load(sets.path(task, "review"))
    by_kind: dict = {}
    for r in rs:
        k = by_kind.setdefault(r.get("kind", "?"), Counter())
        k["n"] += 1
        k["flagged"] += r["flagged"]
        k[f"action:{r['action']}"] += 1
    return {"reviewed": len(rs), "flagged": sum(r["flagged"] for r in rs),
            "flag_rate": round(sum(r["flagged"] for r in rs) / len(rs), 3) if rs else None,
            "dropped_or_fixed": sum(r["action"] in ("drop", "fix") for r in rs),
            "confirmed_bad_rate": round(sum(r["action"] in ("drop", "fix") for r in rs) / len(rs), 3) if rs else None,
            "by_kind": {k: dict(v) for k, v in by_kind.items()},
            "flags": dict(Counter(r.get("flag") for r in rs if r["flagged"]))}


def run(eng: Engine, root: Path, task: str, n: int) -> dict:
    if task == "t1":
        return run_t1(eng, root, n)
    if task == "t2":
        from .gen_t2 import review as r2
        return r2(eng, n)
    if task == "t3":
        from .gen_t3 import review as r3
        return r3(eng, n)
    raise ValueError(task)
