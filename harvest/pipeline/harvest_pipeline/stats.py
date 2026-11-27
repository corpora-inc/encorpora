"""`stats`: row counts, verdicts per task, cost from the committed cache. `review`: sample items."""

from __future__ import annotations

import json
import sqlite3
from collections import Counter, defaultdict

from .cache import ResponseCache
from .corpus import Profile


def cache_cost(profile: Profile) -> dict:
    cache = ResponseCache(profile.cache_dir)
    out = {}
    for task in cache.tasks_on_disk():
        entries = cache.entries(task)
        cost = sum(float((e.get("usage") or {}).get("cost_usd") or 0) for e in entries)
        tin = sum(int((e.get("usage") or {}).get("input_tokens") or 0) for e in entries)
        tout = sum(int((e.get("usage") or {}).get("output_tokens") or 0) for e in entries)
        models = Counter(e.get("model_id") for e in entries)
        out[task] = {"entries": len(entries), "cost_usd": round(cost, 4), "input_tokens": tin,
                     "output_tokens": tout, "models": dict(models)}
    return out


def pack_stats(pack_path: str) -> dict:
    conn = sqlite3.connect(pack_path)
    tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table' "
                                         "AND name NOT LIKE '%fts%' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
    counts = {t: conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in tables}
    meta = dict(conn.execute("SELECT key, value FROM pack_meta"))
    conn.close()
    return {"counts": counts, "meta": meta}


def stage_verdicts(stage_path: str) -> dict:
    conn = sqlite3.connect(stage_path)
    out: dict = defaultdict(lambda: {"pass": 0, "fail": 0, "needs_review": 0})
    for pid, verdict in conn.execute("SELECT prompt_id, verdict FROM provenance"):
        out[pid][verdict] += 1
    conn.close()
    return dict(out)


def review_items(stage_path: str, prompt_id: str, n: int = 20, verdict: str | None = None) -> list[dict]:
    """The first n items of a task in input order, with their verdict and notes, joined to their rows."""
    conn = sqlite3.connect(stage_path)
    conn.row_factory = sqlite3.Row
    q = "SELECT * FROM provenance WHERE prompt_id=?" + (" AND verdict=?" if verdict else "")
    provs = conn.execute(q, (prompt_id, verdict) if verdict else (prompt_id,)).fetchall()
    provs = sorted(provs, key=lambda p: (json.loads(p["notes"] or "{}").get("key", ""),
                                         json.loads(p["notes"] or "{}").get("index", 0)))
    tables = ["term", "fact", "explanation", "question", "answer", "lesson", "procedure", "proc_step", "diagram"]
    out = []
    for p in provs[:n]:
        rows = []
        for t in tables:
            rows += [dict(r) | {"_table": t} for r in conn.execute(f"SELECT * FROM {t} WHERE prov_id=?", (p["prov_id"],))]
        rows += [{"_table": "applies_to", "row_key": r[0]} for r in
                 conn.execute("SELECT row_key FROM _row_prov WHERE prov_id=?", (p["prov_id"],))]
        notes = json.loads(p["notes"] or "{}")
        out.append({"key": notes.get("key"), "index": notes.get("index"), "verdict": p["verdict"],
                    "notes": notes.get("notes"), "model": p["model"], "rows": rows})
    conn.close()
    return out
