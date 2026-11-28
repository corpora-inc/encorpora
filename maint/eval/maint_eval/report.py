"""Collect the held-out results per system into one aggregate table (no items, no texts).

    python -m maint_eval.report > maint/eval/results/<date>.json
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from . import analysis as A
from . import run_t2
from .paths import RUNS
from .stats import agreement, lat

T1_CFG = "syn,strict,scores-k12-thinkoff-t0.0-s0-dense"
T2_CFG = "v2-k5-thinkoff-t0.0-s0-dense"
T3_CFG = "tmpl-k5-thinkoff-t0.0-s0-dense"


def _p(x):
    return {"p": x["p"], "ci95": x["ci95"], "n": x["n"]} if isinstance(x, dict) and "p" in x else x


def _find(prefix: str) -> Path | None:
    p = RUNS / prefix
    return p if (p / "summary.json").exists() else None


def _dec(r):
    d = r["dec"]
    if d.get("decision") == "pick":
        return "pick:" + (r.get("picked") or "")
    if d.get("decision") == "clarify":
        return "clarify:" + ",".join(r.get("between") or [])
    return d.get("decision", "error")


def agree(sysname: str) -> dict:
    out = {}
    for temp in ("0.0", "0.8"):
        runs = []
        for seed in (1, 2, 3):
            d = RUNS / f"t1-heldout-{sysname}-syn,strict,scores-k12-thinkoff-t{temp}-s{seed}-dense-subt1-heldout-agree150"
            if (d / "items.jsonl").exists():
                runs.append(sorted(A.load(d), key=lambda r: r["id"]))
        if len(runs) >= 2:
            out[temp] = {**agreement([[_dec(r) for r in rs] for rs in runs]),
                         "accuracy_per_run": [round(sum(r["correct"] for r in rs) / len(rs), 3) for rs in runs]}
        if runs and temp == "0.0":
            if True:
                rs = runs[0]  # sequential run: its latency is the reported one
                out["latency_sequential"] = {"total_s": lat([r.get("seconds") for r in rs]), "ttft_s": lat([r.get("ttft") for r in rs]),
                                             "tok_per_s": lat([r.get("tps") for r in rs]), "in_tok": lat([r.get("in_tok") for r in rs]),
                                             "out_tok": lat([r.get("out_tok") for r in rs])}
    return out


def system(sysname: str, eng_rows: list[dict]) -> dict:
    res: dict = {"system": sysname}
    d1 = _find(f"t1-heldout-{sysname}-{T1_CFG}") or _find(f"t1-heldout300-{sysname.replace('claude_', 'claude_')}-syn,strict,scores-k12-dense")
    if d1:
        m = A.load(d1)
        ids = {r["id"] for r in m}
        eng = [e for e in eng_rows if e["id"] in ids]
        e = A.end_to_end(eng, m, None)
        s = json.loads((d1 / "summary.json").read_text())
        res["t1"] = {"run": d1.name, "n": len(m),
                     "end_to_end_single": {k: _p(e["single"][k]) for k in ("right", "wrong", "clarify_ok", "clarify_bad", "list")},
                     "not_autorouted_single": {k: _p(v) if isinstance(v, dict) else v for k, v in e["single_not_autorouted"].items()},
                     "by_register": e["single_by_register"],
                     "decline": {k: _p(e["decline"][k]) for k in ("wrong", "list", "clarify_ok", "clarify_bad")},
                     "ambiguous": {k: _p(e["ambiguous"][k]) for k in ("right", "wrong", "clarify_ok", "list")},
                     "wrong_entry_all_items": _p(e["all"]["wrong"]),
                     "suggestions": {k: _p(v) for k, v in A.suggestions(eng, m).items()},
                     "model_only": {"decline_precision": _p(s["decline"]["precision"]), "decline_recall": _p(s["decline"]["recall"]),
                                    "clarify_separates_ambiguous": _p(s["clarify_separates_ambiguous"]), "errors": s["errors"]},
                     "latency_parallel_s": s["latency_s"], "tokens": s["tokens"], "packs": s["meta"]["packs"]}
    d2 = _find(f"t2-heldout-{sysname}-{T2_CFG}")
    if d2:
        rows = A.load(d2)
        s = run_t2.summarize(rows)
        res["t2"] = {"run": d2.name, **{k: _p(s[k]) for k in ("all_accuracy", "cause_accuracy", "action_accuracy", "parts_accuracy", "minutes_accuracy")},
                     "unknown_cause_kept_unknown": _p(s["unknown_kept_unknown"]["cause"]),
                     "wrong_prefill": {k: _p(v) for k, v in s["wrong_prefill"].items()},
                     "record_with_any_wrong_prefill": _p(s["record_with_any_wrong_prefill"]), "latency_s": s["latency_s"]}
    d3 = _find(f"t3-heldout-{sysname}-{T3_CFG}")
    if d3:
        s = json.loads((d3 / "summary.json").read_text())
        res["t3"] = {"run": d3.name, **{k: _p(s[k]) for k in ("accuracy_all", "accuracy_vs_item", "answer_when_available",
                                                              "unanswerable_declined", "retrieval_required_in_pool",
                                                              "connector_own_content")},
                     "decline_precision": _p(s["decline"]["precision"]), "decline_recall": _p(s["decline"]["recall"]),
                     "selected_precision_mean": s["selected_precision_mean"], "latency_s": s["latency_s"]}
    ag = agree(sysname)
    if ag:
        res["agreement"] = ag
    return res


def main() -> None:
    eng_dir = [x for x in os.listdir(RUNS) if x.startswith("t1-heldout-engine-default-k5-thinkoff-t0.0-s0-dense-g")][0]
    eng = A.load(RUNS / eng_dir)
    systems = sorted({d.split("-syn,strict")[0][len("t1-heldout-"):] for d in os.listdir(RUNS)
                      if d.startswith("t1-heldout-local_") and d.endswith(T1_CFG)}) + ["claude_sonnet"]
    out = {"engine": {"run": eng_dir, "end_to_end_single": {k: _p(v) for k, v in A.end_to_end(eng, None, None)["single"].items()
                                                            if isinstance(v, dict)}},
           "systems": [system(s, eng) for s in systems]}
    json.dump(out, sys.stdout, indent=1)


if __name__ == "__main__":
    main()
