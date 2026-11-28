"""One seeded split per task into a small development set and a larger held-out set.

Items the gold review marked bad are dropped (or replaced by their fixed version) before the split,
so no scoring ever sees them. Re-running the split is idempotent for the same raw file and review.
"""
from __future__ import annotations

import random

from . import sets


def apply_review(task: str, items: list[dict]) -> list[dict]:
    rev = {r["id"]: r for r in sets.load(sets.path(task, "review"))}
    out = []
    for i in items:
        r = rev.get(i["id"])
        if r is None or r.get("action") == "keep":
            out.append(i)
        elif r.get("action") == "fix" and r.get("fixed"):
            out.append({**i, **r["fixed"], "reviewed": "fixed"})
        # action == drop: left out
    return out


def split_task(task: str):
    items = apply_review(task, sets.load(sets.path(task, "raw")))
    if task == "t1":
        from .gen_t1 import split
        dev, held = split(items, sets.SPLIT_SEED)
    else:
        # T2/T3 items are grouped by their job context (`group`), so one context never straddles the split.
        rng = random.Random(sets.SPLIT_SEED)
        groups = sorted({i.get("group", i["id"]) for i in items})
        dev_groups = set(rng.sample(groups, max(1, round(len(groups) * 0.2))))
        dev = [i for i in items if i.get("group", i["id"]) in dev_groups]
        held = [i for i in items if i.get("group", i["id"]) not in dev_groups]
    sets.save(sets.path(task, "dev"), dev)
    sets.save(sets.path(task, "heldout"), held)
    return dev, held
