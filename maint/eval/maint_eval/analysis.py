"""T1 analyses that combine runs: auto-route calibration (dev only) and end-to-end outcomes.

Auto-route rule (what the engine does before, or instead of, any model):
    route to hit 1 when  cov1 >= C and words1 >= W and (score1 - score2) >= M
                    or   cos1 >= D (dense, when present) and (score1 - score2) >= M
                    or   a signal matched
C, W, D as in pack_meta `symptom_confident_coverage`, the "at least two words" rule and
`symptom_confident_dense`; M (margin over the runner-up) is the new term. Calibrated on dev only:
maximise correct auto-routes subject to wrong auto-routes <= 1% of all items, then applied once
to held-out.

End-to-end outcome per item, for a system "engine rule, then the model on what the rule did not route":
    right      -- the right entry reached in one step
    wrong      -- a wrong entry (a wrong tree: the costly error)
    clarify_ok -- a clarifying question whose options include the right entry
    clarify_bad-- a clarifying question without it
    list       -- the list is shown (model said none, or model off and the rule did not fire)
"""
from __future__ import annotations

import itertools
import json
from collections import Counter
from pathlib import Path

from .stats import prop


def load(run_dir: Path) -> list[dict]:
    return [json.loads(x) for x in (Path(run_dir) / "items.jsonl").read_text().splitlines() if x.strip()]


def routes(row: dict, C: float, W: int, M: float, D: float | None, A: float | None = None) -> bool:
    h = row.get("hits") or []
    if not h:
        return False
    a = h[0]
    s1 = a.get("fused", a["score"])
    margin = s1 - (h[1].get("fused", h[1]["score"]) if len(h) > 1 else 0.0)
    if a.get("signal"):
        return True
    if margin < M:
        return False
    if a["cov"] is not None and a["cov"] >= C and a["lex_words"] >= W:
        return True
    if D is not None and a.get("cos") is not None and a["cos"] >= D and a["lex_words"] >= 1:
        return True
    return A is not None and a.get("cos") is not None and a["cos"] >= A


def rule_outcome(row: dict, routed: bool) -> str:
    if not routed:
        return "list"
    top = row["hits"][0]["id"]
    return "right" if top in row["gold"] else "wrong"


def evaluate_rule(rows: list[dict], C, W, M, D, A=None) -> dict:
    out = Counter()
    for r in rows:
        o = rule_outcome(r, routes(r, C, W, M, D, A))
        if r["kind"] == "single":
            out[f"single_{o}"] += 1
        elif r["kind"] == "ambiguous":
            # Routing an ambiguous report to one of its fitting entries is not a wrong tree, but it
            # skips the question; routing elsewhere is wrong.
            out[f"amb_{'wrong' if o == 'wrong' else ('routed_fit' if o == 'right' else 'list')}"] += 1
        else:
            out[f"decline_{'wrong' if o != 'list' else 'list'}"] += 1
    n = len(rows)
    wrong = out["single_wrong"] + out["amb_wrong"] + out["decline_wrong"]
    ns = sum(1 for r in rows if r["kind"] == "single")
    return {"C": C, "W": W, "M": M, "D": D, "A": A, "right_single": out["single_right"], "n_single": ns,
            "right_single_rate": round(out["single_right"] / ns, 4) if ns else None,
            "wrong": wrong, "wrong_rate": round(wrong / n, 4) if n else None, "counts": dict(out)}


def calibrate(dev_rows: list[dict], max_wrong_rate: float = 0.01, dense: bool = False) -> dict:
    Cs = [0.3, 0.4, 0.5, 0.6, 0.67, 0.75, 0.8, 0.9, 1.0]
    Ws = [1, 2, 3]
    Ms = [0.0, 0.02, 0.05, 0.08, 0.1, 0.15, 0.2, 0.25, 0.3]
    Ds = [None] + ([0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9] if dense else [])
    As = [None] + ([0.75, 0.8, 0.85, 0.9] if dense else [])
    if dense:
        Cs = [0.3, 0.4, 0.5, 0.67, 0.8, 1.0, 9.0]  # 9.0: never route on lexical coverage alone
        Ms = [0.0, 0.01, 0.02, 0.03, 0.05, 0.08, 0.1, 0.15]
    best = None
    grid = []
    for C, W, M, D, A in itertools.product(Cs, Ws, Ms, Ds, As):
        e = evaluate_rule(dev_rows, C, W, M, D, A)
        grid.append(e)
        if e["wrong_rate"] <= max_wrong_rate:
            # Prefer more right routes; on a tie, fewer wrong, then the more conservative rule.
            key = (e["right_single"], -e["wrong"], C, M)
            if best is None or key > best[0]:
                best = (key, e)
    return {"best": best[1] if best else None, "current_rule": evaluate_rule(dev_rows, 0.5, 2, 0.0, 0.85 if dense else None, 0.5 if False else None),
            "grid_size": len(grid)}


def end_to_end(engine_rows: list[dict], model_rows: list[dict] | None, rule: dict | None) -> dict:
    """rule None: the engine's own `confident` flag decides auto-routing."""
    mrows = {r["id"]: r for r in (model_rows or [])}
    per = []
    for e in engine_rows:
        routed = (e["search_conf"] == "confident") if rule is None else routes(e, rule["C"], rule["W"], rule["M"], rule["D"], rule.get("A"))
        if routed:
            o = rule_outcome(e, True)
            src = "engine"
        elif model_rows is None:
            o, src = "list", "engine"
        else:
            m = mrows.get(e["id"])
            if m is None:
                continue
            d = m["decision"]
            if d == "pick":
                o = "right" if m["picked"] in e["gold"] else "wrong"
            elif d == "clarify":
                o = "clarify_ok" if m["clarify_has_gold"] else "clarify_bad"
            else:
                o = "list"
            src = "model"
        per.append({"id": e["id"], "kind": e["kind"], "register": e["register"], "outcome": o, "by": src,
                    "gold_in_top5": e["rank"] is not None and e["rank"] <= 5})
    res = {}
    for kind in ("single", "ambiguous", "decline"):
        xs = [p for p in per if p["kind"] == kind]
        c = Counter(p["outcome"] for p in xs)
        res[kind] = {"n": len(xs), **{k: prop([p["outcome"] == k for p in xs]) for k in
                                      ("right", "wrong", "clarify_ok", "clarify_bad", "list")},
                     "routed_by_engine": sum(p["by"] == "engine" and p["outcome"] in ("right", "wrong") for p in xs)}
        # Of the singles the engine did not auto-route: what the model did with them.
        if kind == "single":
            rest = [p for p in xs if p["by"] == "model"]
            res["single_not_autorouted"] = {"n": len(rest), **{k: prop([p["outcome"] == k for p in rest]) for k in
                                                              ("right", "wrong", "clarify_ok", "clarify_bad", "list")}}
            reg = {}
            for g in sorted({p["register"] for p in xs}):
                ys = [p for p in xs if p["register"] == g]
                reg[g] = {k: prop([p["outcome"] == k for p in ys])["p"] for k in ("right", "wrong", "list")}
            res["single_by_register"] = reg
    allx = per
    res["all"] = {"n": len(allx), "wrong": prop([p["outcome"] == "wrong" for p in allx])}
    return res


# -- ranking study ------------------------------------------------------------------

RANK_SPECS = (["engine", "lex", "cos"] + [f"lin:{w/10:.1f}" for w in range(1, 10)]
              + [f"strong:{w/10:.1f}" for w in range(1, 10)] + [f"rrf:{k}" for k in (1, 5, 10, 20, 30, 60)]
              + [f"z:{w/10:.1f}" for w in range(1, 10)] + [f"zs:{w/10:.1f}" for w in range(1, 10)])


def rank_study(rows: list[dict], specs=RANK_SPECS, kinds=("single",)) -> dict:
    from .rank import rerank
    out = {}
    xs = [r for r in rows if r["kind"] in kinds and r.get("all")]
    for spec in specs:
        ranks = []
        for r in xs:
            order = [h["id"] for h in rerank(r["all"], spec)]
            rk = next((i for i, sid in enumerate(order, 1) if sid in r["gold"]), None)
            ranks.append((r["register"], rk))
        res = {f"top{n}": round(sum(1 for _, k in ranks if k and k <= n) / len(ranks), 4) for n in (1, 3, 5, 10)}
        res["by_register_top1"] = {g: round(sum(1 for gg, k in ranks if gg == g and k == 1) /
                                          max(1, sum(1 for gg, _ in ranks if gg == g)), 3)
                                   for g in sorted({g for g, _ in ranks})}
        res["n"] = len(ranks)
        out[spec] = res
    return out


def with_rank(rows: list[dict], spec: str) -> list[dict]:
    """Rows as if the engine ranked with `spec`: `hits` (first 5) and `rank` recomputed from `all`."""
    from .rank import rerank
    out = []
    for r in rows:
        order = rerank(r["all"], spec)
        ids = [h["id"] for h in order]
        rk = next((i for i, sid in enumerate(ids, 1) if sid in r["gold"]), None)
        out.append({**r, "hits": [{**h, "lex_words": h.get("sh") or 0} for h in order[:5]], "rank": rk})
    return out


def suggestions(engine_rows: list[dict], model_rows: list[dict]) -> dict:
    """Product rule: a model pick is a suggestion the technician confirms, never a route. For the singles
    the engine did not auto-route: how often the suggestion is right, and how often the right entry is
    in a short list of up to three (the model's clarify options, or its pick plus the engine's next two)."""
    m = {r["id"]: r for r in model_rows}
    rows = []
    for e in engine_rows:
        if e["kind"] != "single" or e["search_conf"] == "confident" or e["id"] not in m:
            continue
        r = m[e["id"]]
        gold = set(e["gold"])
        own = ({r["picked"]} if r["decision"] == "pick" else set(r.get("between") or []))
        if r["decision"] == "pick":
            rest = [c for c in r["cand_ids"] if c != r["picked"]][:2]
            three = {r["picked"], *rest}
        elif r["decision"] == "clarify":
            three = set(r.get("between") or [])
        else:
            three = set()
        rows.append({"suggested": r["decision"] in ("pick", "clarify"), "pick": r["decision"] == "pick",
                     "pick_right": r["decision"] == "pick" and r["picked"] in gold,
                     "own_has": bool(own & gold), "three_has": bool(three & gold), "register": e["register"]})
    picks = [x for x in rows if x["pick"]]
    return {"n": len(rows),
            "suggestion_accuracy": prop([x["pick_right"] for x in picks]),
            "suggested_rate": prop([x["suggested"] for x in rows]),
            "right_is_suggestion_or_in_own_list": prop([x["own_has"] for x in rows]),
            "right_in_list_of_three": prop([x["three_has"] for x in rows]),
            "observed_right_in_list_of_three": prop([x["three_has"] for x in rows if x["register"] == "observed"])}
