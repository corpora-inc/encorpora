"""Drive real jobs through the engine API to get real contexts for T2 and T3.

`paths(tree)` enumerates every way through a tree from its entry to a node with no branches (retry
loops taken once). `drive()` starts a job and answers each node with the outcome or value that
takes the path's next edge, collecting the engine's own step view at every node.
"""
from __future__ import annotations

from .engine import Engine


def paths(tree: dict, limit: int = 64) -> list[list[dict]]:
    """Each path is a list of edges [{from_node, label, to_node, cond, retry}] ending at a leaf."""
    out_edges: dict[str, list[dict]] = {}
    for e in sorted(tree.get("edges") or [], key=lambda e: (e["from_node"], e["ord"])):
        out_edges.setdefault(e["from_node"], []).append(e)
    res: list[list[dict]] = []

    def dfs(node: str, acc: list[dict], seen: set[str]) -> None:
        if len(res) >= limit:
            return
        es = [e for e in out_edges.get(node, []) if not (e.get("retry") and e["to_node"] in seen)]
        es = [e for e in es if e["to_node"] not in seen or e.get("retry")]
        if not es:
            res.append(acc)
            return
        for e in es:
            if e["to_node"] in seen:  # a retry edge already taken once: end the path here
                res.append(acc + [e])
                continue
            dfs(e["to_node"], acc + [e], seen | {e["to_node"]})

    entry = tree["tree"]["entry_node"]
    dfs(entry, [], {entry})
    return res


def value_for(cond: dict | None) -> float | None:
    if not cond:
        return None
    op = cond.get("op")
    if op == "between":
        return round((cond["min"] + cond["max"]) / 2, 2)
    v = cond.get("value")
    return {"<": v - 0.5, "<=": v, ">": v + 0.5, ">=": v + 0.5, "==": v}.get(op)


def drive(eng: Engine, pack_id: str, tree_id: str, path: list[dict], level: str = "apprentice") -> dict:
    """Run one job along `path`. Returns {"job_id", "views": [step view per node], "report"}."""
    jv = eng.call("job.start", {"pack_id": pack_id, "tree_id": tree_id, "level": level})
    job_id = jv["job"]["job_id"]
    views = [jv["step"]]
    for e in path:
        step = jv["step"]
        if step is None or step["node"]["node_id"] != e["from_node"]:
            break
        br = [b for b in step["record"]["branches"] if b["to_node"] == e["to_node"] and b["label"] == e["label"]]
        b = br[0] if br else None
        params = {"job_id": job_id, "node_id": e["from_node"]}
        kind = (step["record"].get("expect") or {}).get("kind")
        if kind == "value":
            params["value"] = value_for((b or {}).get("cond") or e.get("cond"))
            params["unit"] = (step["record"]["expect"] or {}).get("unit")
        else:
            params["outcome"] = (b or {}).get("outcome") or e["label"]
        jv = eng.call("job.answer", params)
        if jv.get("step") is not None:
            views.append(jv["step"])
    report = eng.call("job.report", {"job_id": job_id})
    return {"job_id": job_id, "views": views, "report": report}
