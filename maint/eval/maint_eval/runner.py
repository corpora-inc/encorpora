"""Run one task on one part (dev | heldout) with one system, write per-item rows and a summary.

Systems:
  engine            -- model off: what the app does by itself
  local:<model>     -- an open-weight model behind llama-server (--endpoint), constrained decoding
  claude:sonnet     -- Sonnet on the same closed task (reference ceiling), structured output
  alone:<sonnet|opus> -- no engine at all: a general assistant answering in prose (T1, T3)
"""
from __future__ import annotations

import json
import re
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from . import claude, local, packs, sets
from .paths import RUNS


def run_dir(a) -> Path:
    sysname = re.sub(r"[^A-Za-z0-9.+-]+", "_", a.system)
    rk = "" if getattr(a, "rank", "engine") == "engine" else "-r" + re.sub(r"[^A-Za-z0-9.]+", "", a.rank)
    dn = {"on": "-dense", "off": "-lex"}.get(getattr(a, "dense", "any"), "")
    rg = ""
    if getattr(a, "ranking", ""):
        import hashlib
        rg = "-g" + hashlib.sha256(a.ranking.encode()).hexdigest()[:6]
    sb = f"-sub{Path(a.subset).stem}" if getattr(a, "subset", "") else ""
    lim = f"-lim{a.limit}" if getattr(a, "limit", 0) else ""
    name = f"{a.task}-{a.part}-{sysname}-{a.variant}-k{a.k}-think{a.think}-t{a.temp}-s{a.seed}{dn}{rk}{rg}{sb}{lim}"
    return a.out or (RUNS / name)


def load_items(a) -> list[dict]:
    items = sets.load(sets.path(a.task, a.part))
    if a.subset:
        ids = set(Path(a.subset).read_text().split())
        items = [i for i in items if i["id"] in ids]
    if a.limit:
        items = items[: a.limit]
    return items


def decide(a, system: str, user: str, schema: dict, tag: str) -> dict:
    """One closed decision from the configured model. Returns {output, seconds, ttft, usage, ok, error}."""
    if a.system.startswith("local:"):
        model = a.system.split(":", 1)[1]
        max_tok = 4096 if a.think != "off" else 400
        if "gpt-oss" in model:  # reasoning cannot be switched off ("off" is effort low); leave it room
            max_tok = max(max_tok, 2048)
        return local.chat(a.endpoint, model, system, user, schema, think=a.think, temperature=a.temp,
                          seed=a.seed, max_tokens=max_tok, tag=tag)
    if a.system.startswith("claude:"):
        model = a.system.split(":", 1)[1]
        wrapped = schema if schema.get("type") == "object" else {
            "type": "object", "properties": {"answer": schema}, "required": ["answer"]}
        r = claude.call(system, user, model=model, schema=wrapped, tag=tag)
        return {**r, "ttft": None}
    raise ValueError(a.system)


def check_dense(eng, a) -> None:
    """A silent fallback to lexical-only must never happen: assert the dense state the run expects."""
    if getattr(a, "dense", "any") == "any":
        return
    for p in eng.call("pack.list", {}):
        active = bool((p.get("dense") or {}).get("active"))
        if active != (a.dense == "on"):
            raise SystemExit(f"pack {p['pack_id']}: dense active={active}, run expects dense={a.dense}: "
                             f"{(p.get('dense') or {}).get('reason')}")


def run(eng, a) -> dict:
    check_dense(eng, a)
    if a.task == "t1":
        from .run_t1 import run_t1
        return run_t1(eng, a)
    if a.task == "t2":
        from .run_t2 import run_t2
        return run_t2(eng, a)
    if a.task == "t3":
        from .run_t3 import run_t3
        return run_t3(eng, a)
    raise ValueError(a.task)


def write(out: Path, rows: list[dict], summary: dict, a) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    (out / "items.jsonl").write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows))
    meta = {"task": a.task, "part": a.part, "system": a.system, "variant": a.variant, "k": a.k, "think": a.think,
            "temperature": a.temp, "seed": a.seed, "rank": getattr(a, "rank", "engine"), "ranking": getattr(a, "ranking", ""),
            "dense": getattr(a, "dense", "any"), "engine_url": getattr(a, "engine", None), "endpoint": a.endpoint if a.system.startswith("local:") else None,
            "set_sha256": sets.sha256(sets.path(a.task, a.part)), "n_items": len(rows),
            # A pack rebuild must never silently change a number: every result names the packs it ran on.
            "packs": pack_versions(a, rows),
            "finished": time.strftime("%Y-%m-%dT%H:%M:%S%z")}
    summary = {"meta": meta, **summary}
    (out / "summary.json").write_text(json.dumps(summary, indent=1, ensure_ascii=False))
    return {"rows": rows, "summary": summary}


def pack_versions(a, rows: list[dict]) -> dict:
    from .engine import DEFAULT_URL, Engine
    eng = Engine(getattr(a, "engine", None) or DEFAULT_URL)
    out = {}
    for p in sorted({r.get("pack_id") for r in rows if r.get("pack_id")}):
        info = eng.pack_info(p)
        out[p] = {"version": info.get("version"), "built_at": info.get("built_at")}
    return out


def pmap(fn, xs, jobs: int):
    if jobs <= 1:
        return [fn(x) for x in xs]
    with ThreadPoolExecutor(max_workers=jobs) as ex:
        return list(ex.map(fn, xs))


def equipment_labels(eng, items) -> dict:
    return {p: packs.equipment_label(eng, p) for p in sorted({i["pack_id"] for i in items})}
