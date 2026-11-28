"""How a problem shows up: plain phrasings of what a technician sees, hears or reads, per symptom.

A technician often describes a problem in none of the entry's words ("the light by the ignition
stays on and nothing happens" for "Engine will not crank"). For each symptom the pack ships, a
model writes a few such phrasings from the entry's own source text only (its title, printed
cause, first question, possible problems and corrective text), cached and ledgered. Code drops any
phrasing that uses one of the title's key words (that is the synonyms' job), or names a number, a
parameter name or a part number the source does not print. They are kept apart from `synonyms`
(stage table `_presentation`, pack_meta `symptom_presentations`) so their effect can be measured
on its own; they go into the symptom's embedded chunk text, not into the lexical symptom match.
"""

from __future__ import annotations

import json
import re
import sqlite3
import sys
import time
from pathlib import Path

from ..textutil import sha256_json

SYSTEM = ("For each problem entry of a maintenance manual you get only that entry's own text. Write 3 to 6 short "
          "phrasings of how the problem shows up: what a technician would see, hear, smell or read on a display "
          "when this is the problem, in plain words, the way they would describe it to a colleague. Do not use the "
          "entry's own key words, do not name its cause or fix, and never add a number, unit, code, parameter "
          "name or part that the entry's text does not print.")
SCHEMA_ITEM = {"type": "object", "additionalProperties": False, "required": ["id", "shows"],
               "properties": {"id": {"type": "string"}, "shows": {"type": "array", "items": {"type": "string"}}}}
SCHEMA = {"type": "object", "additionalProperties": False, "required": ["rows"],
          "properties": {"rows": {"type": "array", "items": SCHEMA_ITEM}}}
_PARAM = re.compile(r"\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b")
_PART = re.compile(r"\b[A-Z]{1,4}\d{0,3}-\d{2,}\b")
STOP = {"the", "and", "not", "for", "has", "too", "with", "when", "will", "does", "this", "that", "from"}


def sources(pack_db: str) -> list[tuple[str, str, str]]:
    """(symptom_id, title, source text) for every shipped symptom."""
    c = sqlite3.connect(pack_db)
    c.row_factory = sqlite3.Row
    out = []
    for s in c.execute("SELECT symptom_id, tree_id, title FROM symptom ORDER BY symptom_id"):
        parts = [f"Problem: {s['title']}"]
        t = c.execute("SELECT entry_node FROM fault_tree WHERE tree_id=?", (s["tree_id"],)).fetchone()
        if t:
            e = c.execute("SELECT node_id, kind, text FROM fault_node WHERE node_id=?", (t[0],)).fetchone()
            seen = set()
            node = e
            for _ in range(3):              # the entry, the first question or action after it, one more
                if node is None or node["node_id"] in seen:
                    break
                seen.add(node["node_id"])
                parts.append(node["text"])
                for (f,) in c.execute("SELECT text FROM fault_facet WHERE node_id=? AND facet IN ('possible','reason') "
                                      "ORDER BY facet, ord", (node["node_id"],)):
                    parts.append(f)
                nx = c.execute("SELECT to_node FROM fault_edge WHERE from_node=? ORDER BY ord LIMIT 1",
                               (node["node_id"],)).fetchone()
                node = c.execute("SELECT node_id, kind, text FROM fault_node WHERE node_id=?", (nx[0],)).fetchone() \
                    if nx else None
        out.append((s["symptom_id"], s["title"], " | ".join(dict.fromkeys(parts))))
    return out


def _stems(s: str) -> set[str]:
    return {w[:5] for w in re.findall(r"[a-z0-9]+", s.lower()) if len(w) >= 4 and w not in STOP}


def problem(text: str, title: str, source: str) -> str | None:
    if not isinstance(text, str) or not text.strip() or len(text) > 120:
        return "empty or too long"
    if _stems(text) & _stems(title):
        return "uses the entry's own key words"
    if any(n not in source for n in re.findall(r"\d+(?:\.\d+)?", text)):
        return "a number the source does not print"
    if any(x not in source for x in _PARAM.findall(text) + _PART.findall(text)):
        return "a parameter or part the source does not print"
    return None


def run(rows: list[tuple[str, str, str]], author: dict, cache_dir: Path, call: bool, ledger=None, batch: int = 20,
        log=sys.stderr) -> tuple[dict[str, dict], dict]:
    from ..backends import BackendError, Request, Runner, UsageLimitReached, make_backend
    from ..cache import ResponseCache
    from .extract import Arm, _now
    spec = Arm("presentations", author, images=False).spec
    cache = ResponseCache(cache_dir)
    backend = make_backend(author) if call else None
    runner = Runner(backend, 1) if backend else None
    out: dict[str, dict] = {}
    rep = {"symptoms": len(rows), "calls": 0, "cached": 0, "missing": 0, "kept": 0, "dropped": 0, "drop_reasons": {}}
    try:
        for i in range(0, len(rows), batch):
            b = rows[i:i + batch]
            prompt = "\n".join(f"[y{k}] {src}" for k, (_, _, src) in enumerate(b)) + \
                "\n\nReturn phrasings for every entry id."
            req = Request(system=SYSTEM, prompt=prompt, schema=SCHEMA, name="presentations", max_tokens=6000)
            isha = sha256_json({"system": SYSTEM, "schema": SCHEMA, "prompt": prompt})
            hit = cache.get("maint.presentations", "1", isha, spec)
            entry = hit
            if hit is not None:
                rep["cached"] += 1
            elif runner is None:
                rep["missing"] += 1
                continue
            else:
                t0 = time.monotonic()
                try:
                    resp = runner.call(req)
                except (BackendError, UsageLimitReached) as e:
                    print(f"[presentations] batch {i}: {e}", file=log)
                    continue
                secs = round(time.monotonic() - t0, 2)
                entry = {"task": "maint.presentations", "prompt_version": "1", "input_sha256": isha, "model": spec,
                         "key": f"batch {i}", "backend": backend.name, "model_id": resp.model_id, "created_at": _now(),
                         "output": resp.output, "usage": {**resp.usage, "seconds": secs}}
                cache.put(entry)
                rep["calls"] += 1
                if ledger:
                    ledger.add({"at": entry["created_at"], "arm": "presentations", "backend": backend.name,
                                "model": resp.model_id, "unit": entry["key"], "questions": len(b),
                                "input_tokens": resp.usage.get("input_tokens", 0),
                                "output_tokens": resp.usage.get("output_tokens", 0),
                                "cost_usd": round(float(resp.usage.get("cost_usd", 0.0)), 6), "seconds": secs})
            for r in entry["output"].get("rows", []):
                m = re.fullmatch(r"y(\d+)", r.get("id", ""))
                if not m or int(m.group(1)) >= len(b):
                    continue
                sid, title, src = b[int(m.group(1))]
                kept = []
                for t in r.get("shows") or []:
                    why = problem(t, title, src)
                    if why:
                        rep["dropped"] += 1
                        rep["drop_reasons"][why] = rep["drop_reasons"].get(why, 0) + 1
                    elif t not in kept:
                        kept.append(" ".join(t.split()))
                rep["kept"] += len(kept)
                out[sid] = {"shows": kept, "model_id": entry["model_id"]}
    finally:
        cache.close()
    return out, rep
