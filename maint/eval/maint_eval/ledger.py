"""Response cache and call ledger.

Every model call goes through `cached()`: a response is keyed by sha256 over
(kind, model, payload), so a re-run costs nothing for unchanged inputs. Each
call actually made appends one line to the ledger (model, tokens, seconds,
cost at list price for Claude calls). Cache hits are not calls and are not
counted again.
"""
from __future__ import annotations

import fcntl
import hashlib
import json
import os
import threading
import time
from pathlib import Path
from typing import Callable

from .paths import CACHE, LEDGER

_lock = threading.Lock()


def key(kind: str, model: str, payload) -> str:
    blob = json.dumps({"kind": kind, "model": model, "payload": payload}, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(blob.encode()).hexdigest()


def _path(h: str) -> Path:
    return CACHE / h[:2] / f"{h}.json"


def get(h: str) -> dict | None:
    p = _path(h)
    if p.exists():
        try:
            return json.loads(p.read_text())
        except json.JSONDecodeError:
            return None
    return None


def put(h: str, v: dict) -> None:
    p = _path(h)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(f".{os.getpid()}.{threading.get_ident()}.tmp")
    tmp.write_text(json.dumps(v, ensure_ascii=False))
    os.replace(tmp, p)


def record(entry: dict) -> None:
    entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"), **entry}
    line = json.dumps(entry, ensure_ascii=False) + "\n"
    with _lock, open(LEDGER, "a") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        f.write(line)
        fcntl.flock(f, fcntl.LOCK_UN)


def cached(kind: str, model: str, payload, call: Callable[[], dict], tag: str = "") -> dict:
    """Return the cached response for (kind, model, payload), or make the call, cache and ledger it.

    `call()` returns {"output": ..., "usage": {input_tokens, output_tokens, cost_usd?}, "seconds": s, ...}."""
    h = key(kind, model, payload)
    hit = get(h)
    if hit is not None:
        return {**hit, "cached": True}
    out = call()
    u = out.get("usage") or {}
    record({"kind": kind, "tag": tag, "model": model, "model_id": out.get("model_id"), "key": h,
            "input_tokens": u.get("input_tokens", 0), "output_tokens": u.get("output_tokens", 0),
            "reasoning_tokens": u.get("reasoning_tokens", 0),
            "seconds": round(out.get("seconds", 0.0), 3), "cost_usd": u.get("cost_usd", 0.0),
            "ok": out.get("ok", True)})
    if out.get("ok", True):
        put(h, out)
    return {**out, "cached": False}


def totals(path: Path = LEDGER) -> dict:
    """Sum the ledger per model family."""
    agg: dict = {}
    if not path.exists():
        return agg
    for line in path.read_text().splitlines():
        e = json.loads(line)
        m = e.get("model", "?")
        a = agg.setdefault(m, {"calls": 0, "input_tokens": 0, "output_tokens": 0, "seconds": 0.0, "cost_usd": 0.0})
        a["calls"] += 1
        a["input_tokens"] += e.get("input_tokens") or 0
        a["output_tokens"] += e.get("output_tokens") or 0
        a["seconds"] += e.get("seconds") or 0.0
        a["cost_usd"] += e.get("cost_usd") or 0.0
    return agg


def claude_tokens(path: Path = LEDGER) -> int:
    t = totals(path)
    return sum(v["input_tokens"] + v["output_tokens"] for k, v in t.items() if k.startswith("claude:"))
