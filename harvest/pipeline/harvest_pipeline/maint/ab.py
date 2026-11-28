"""A/B: the same pages through two arms (backend + model, with or without page images), item by item.

Both packs are built from the committed cache (no model call; run `maint extract --arm` first).
Reported per arm: verification (rows that passed, failed, and why, by rule), coverage, tokens,
seconds and cost from the ledger, and precision/recall when an answer key is given. Between
the arms: agreement on tree shape (trees, nodes, node kinds, edges with their outcome and
target, facets, test procedures) and on text (guards with what they guard, steps, setup,
symptoms, signals), as |A and B| / |A or B| with the items only one arm has.
Writes one JSON result (`--out`) and prints a short summary.
"""

from __future__ import annotations

import json
import sqlite3
from collections import Counter
from pathlib import Path

from ..corpus import Corpus, harvest_home
from .build import arm, build, ledger
from .coverage import coverage
from .score import compare, expected_items, pack_items

SHAPE = ("trees", "nodes", "node_kinds", "edges", "facets", "test_procedures", "targets")
TEXT = ("guards", "steps", "procedures", "setup", "symptoms", "signals", "equipment", "idents", "applies")


def _verification(stage_path: str) -> dict:
    c = sqlite3.connect(stage_path)
    by = Counter()
    reasons = Counter()
    for verdict, notes in c.execute("SELECT verdict, notes FROM provenance"):
        by[verdict] += 1
        if verdict != "pass":
            try:
                for p in json.loads(notes).get("problems", []):
                    reasons[p.split(":")[0][:60]] += 1
            except ValueError:
                reasons["unreadable notes"] += 1
    total = sum(by.values())
    return {"rows": total, **by, "pass_rate": round(by["pass"] / total, 4) if total else None,
            "fail_reasons": dict(reasons.most_common(15))}


def _usage(corpus: Corpus, name: str) -> dict:
    t = {"calls": 0, "errors": 0, "input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0, "seconds": 0.0}
    for r in ledger(corpus).rows():
        if r.get("arm") != name:
            continue
        if r.get("error"):
            t["errors"] += 1
            continue
        t["calls"] += 1
        for k in ("input_tokens", "output_tokens", "seconds"):
            t[k] += r.get(k) or 0
        t["cost_usd"] += r.get("cost_usd") or 0.0
    t["cost_usd"] = round(t["cost_usd"], 4)
    t["seconds"] = round(t["seconds"], 1)
    return t


def ab(corpus: Corpus, a_name: str, b_name: str, harvest: str, expected: Path | None = None,
       out: Path | None = None) -> dict:
    res: dict = {"format": "maint-ab/1", "corpus": corpus.corpus_id, "arms": {}}
    items = {}
    want = expected_items(json.loads(expected.read_text())) if expected else None
    for name in (a_name, b_name):
        a = arm(corpus, name)
        pack_dir = harvest_home() / "packs" / corpus.pack_id / a.name
        summary = build(corpus, a.name, pack_dir, harvest, log=None)
        items[name] = pack_items(pack_dir)
        cov = coverage(corpus, pack_dir)
        entry = {"spec": a.spec, "images": a.images, "pack": str(pack_dir),
                 "cache_misses": summary["cache_misses"], "graph_rounds": summary["rounds"],
                 "graph_failed": summary["forced_fail"], "verification": _verification(summary["stage"]),
                 "coverage": {"warnings_cautions": cov["warnings_cautions"], "all_guards": cov["all_guards"],
                              "questions": {k: v for k, v in cov["questions"].items() if k != "missing"}},
                 "usage": _usage(corpus, a.name),
                 "counts": {k: len(v) for k, v in items[name].items()}}
        if want is not None:
            entry["score"] = {k: {x: v[x] for x in ("expected", "got", "tp", "precision", "recall")}
                              for k, v in compare(items[name], want).items()}
        res["arms"][name] = entry
    agree = {}
    for k in SHAPE + TEXT:
        A, B = items[a_name].get(k, set()), items[b_name].get(k, set())
        union = A | B
        agree[k] = {"both": len(A & B), "only_a": sorted(map(str, A - B))[:25], "only_b": sorted(map(str, B - A))[:25],
                    "agreement": round(len(A & B) / len(union), 4) if union else 1.0}
    res["agreement"] = agree
    res["summary_text"] = _summary(res, a_name, b_name)
    if out:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(res, indent=1, ensure_ascii=False))
    return res


def _summary(res: dict, a: str, b: str) -> str:
    A, B = res["arms"][a], res["arms"][b]
    L = [f"A = {a} ({A['spec']})   B = {b} ({B['spec']})", ""]
    L.append(f"{'':28}{'A':>12}{'B':>12}")

    def row(label, fa, fb):
        L.append(f"{label:28}{fa:>12}{fb:>12}")

    row("rows passed / all", f"{A['verification'].get('pass', 0)}/{A['verification']['rows']}",
        f"{B['verification'].get('pass', 0)}/{B['verification']['rows']}")
    row("graph-failed rows", str(len(A["graph_failed"])), str(len(B["graph_failed"])))
    wa, wb = A["coverage"]["warnings_cautions"], B["coverage"]["warnings_cautions"]
    row("warnings+cautions attached", f"{wa['attached']}/{wa['present']}", f"{wb['attached']}/{wb['present']}")
    qa, qb = A["coverage"]["questions"], B["coverage"]["questions"]
    row("question boxes attached", f"{qa['attached']}/{qa['present']}", f"{qb['attached']}/{qb['present']}")
    for k in ("input_tokens", "output_tokens", "seconds", "cost_usd"):
        row(k, str(A["usage"][k]), str(B["usage"][k]))
    if "score" in A:
        L.append("")
        L.append(f"{'precision / recall':28}{'A':>12}{'B':>12}")
        for k in A["score"]:
            sa, sb = A["score"][k], B["score"][k]
            row(k, f"{sa['precision']:.2f}/{sa['recall']:.2f}", f"{sb['precision']:.2f}/{sb['recall']:.2f}")
    L.append("")
    L.append("agreement A vs B (|A and B| / |A or B|)")
    for k, v in res["agreement"].items():
        L.append(f"  {k:18} {v['agreement']:.2f}  both {v['both']}, only A {len(v['only_a'])}, only B {len(v['only_b'])}")
    if A["verification"]["fail_reasons"] or B["verification"]["fail_reasons"]:
        L.append("")
        L.append("why rows failed")
        for name, X in ((a, A), (b, B)):
            for r, n in X["verification"]["fail_reasons"].items():
                L.append(f"  {name}: {n} x {r}")
    return "\n".join(L)
