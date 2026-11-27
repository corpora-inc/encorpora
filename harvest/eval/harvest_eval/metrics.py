"""Per-item scoring and aggregate metrics. Pure functions; no I/O, no model calls."""
from __future__ import annotations

import math
import random
from collections import Counter, defaultdict

from .sections import LEVELS, match

KS = (1, 3, 5, 10)


def retrieval_at_k(retrieved: list[str], gold: list[str], k: int, level: str) -> tuple[float, float]:
    """Precision@k: share of the top-k distinct retrieved sections that match any gold
    section. Recall@k: share of gold sections matched by something in the top k.
    Precision divides by k even when fewer than k sections came back."""
    top = retrieved[:k]
    if not gold:
        return 0.0, 0.0
    rel = sum(1 for r in top if any(match(r, g, level) for g in gold))
    found = sum(1 for g in gold if any(match(r, g, level) for r in top))
    return rel / k, found / len(gold)


def first_hit_rank(retrieved: list[str], gold: list[str], level: str) -> int | None:
    for i, r in enumerate(retrieved, 1):
        if any(match(r, g, level) for g in gold):
            return i
    return None


def pct(values: list[float], p: float) -> float | None:
    v = sorted(x for x in values if x is not None)
    if not v:
        return None
    i = (len(v) - 1) * p
    lo, hi = math.floor(i), math.ceil(i)
    return v[lo] + (v[hi] - v[lo]) * (i - lo)


def ratio(n: float, d: float) -> float | None:
    return n / d if d else None


def bootstrap_ci(values: list[float], iters: int = 2000, seed: int = 7) -> tuple[float, float] | None:
    if len(values) < 2:
        return None
    rng = random.Random(seed)
    n = len(values)
    means = sorted(sum(values[rng.randrange(n)] for _ in range(n)) / n for _ in range(iters))
    return means[int(0.025 * iters)], means[int(0.975 * iters) - 1]


def score_item(item: dict, resp: dict, grade: dict | None, support: dict | None, corpus,
               is_harvest: bool) -> dict:
    gold = item.get("section_ids") or []
    row: dict = {
        "id": item["id"], "category": item.get("category"), "must_decline": bool(item.get("must_decline")),
        "equipment": item.get("equipment"), "difficulty": item.get("difficulty"),
        "ok": resp["ok"], "error": resp.get("error"), "mode": resp.get("mode"),
    }
    if is_harvest:
        declined = resp.get("mode") == "declined"
    else:
        declined = bool(grade and grade.get("declined"))
    row["declined"] = declined if resp["ok"] else None
    row["baked"] = resp.get("mode") == "baked"
    row["score"] = grade.get("score") if grade else None
    row["judge_why"] = grade.get("why") if grade else None
    row["elapsed_ms"] = resp.get("elapsed_ms")
    row["wall_ms"] = resp.get("wall_ms")

    if is_harvest and gold and not item.get("must_decline"):
        for level in LEVELS:
            for k in KS:
                p, r = retrieval_at_k(resp.get("retrieved") or [], gold, k, level)
                row[f"p@{k}.{level}"] = p
                row[f"r@{k}.{level}"] = r
            row[f"rank.{level}"] = first_hit_rank(resp.get("retrieved") or [], gold, level)

    cites = resp.get("citations") or []
    row["n_cites"] = len(cites)
    if gold and not item.get("must_decline"):
        row["cites_gold"] = sum(1 for c in cites if any(match(c, g, "lineage") for g in gold))
    row["cites_exist"] = sum(1 for c in cites if corpus is not None and c in corpus.text) if corpus else None

    quotes = resp.get("quotes") or []
    row["n_quotes"] = len(quotes)
    row["quotes_ok"] = sum(1 for q in quotes if corpus is not None and corpus.quote_ok(q["section_id"], q["text"])) \
        if corpus else None

    if support is not None:
        verdicts = [c["verdict"] for c in support.get("claims", [])]
        row["claims_supported"] = verdicts.count("supported")
        row["claims_unsupported"] = verdicts.count("unsupported")
        used = {c.get("section_id") for c in support.get("claims", []) if c["verdict"] == "supported"}
        used.discard(None)
        row["cites_supporting"] = sum(1 for c in cites if any(match(u, c, "lineage") for u in used))
    return row


def aggregate(rows: list[dict], is_harvest: bool) -> dict:
    out: dict = {"n": len(rows), "errors": sum(1 for r in rows if not r["ok"])}
    ans = [r for r in rows if not r["must_decline"]]
    dec = [r for r in rows if r["must_decline"]]
    out["n_answerable"], out["n_must_decline"] = len(ans), len(dec)

    if is_harvest:
        ret = {}
        for level in LEVELS:
            for k in KS:
                ps = [r.get(f"p@{k}.{level}", 0.0) for r in ans]
                rs = [r.get(f"r@{k}.{level}", 0.0) for r in ans]
                ret[f"{level}"] = ret.get(level, {})
                ret[level][f"p@{k}"] = ratio(sum(ps), len(ps))
                ret[level][f"r@{k}"] = ratio(sum(rs), len(rs))
            ranks = [r.get(f"rank.{level}") for r in ans]
            ret[level]["mrr@10"] = ratio(sum(1 / x for x in ranks if x and x <= 10), len(ranks))
        out["retrieval"] = ret
        out["retrieval_r@5_ci95"] = bootstrap_ci([r.get("r@5.lineage", 0.0) for r in ans])

    answered = [r for r in rows if r["ok"] and r["declined"] is False]
    ans_answered = [r for r in answered if not r["must_decline"]]
    out["citation_precision_gold"] = ratio(sum(r.get("cites_gold", 0) for r in ans_answered),
                                           sum(r["n_cites"] for r in ans_answered))
    sup = [r for r in answered if "claims_supported" in r]
    out["citation_precision_supported"] = ratio(sum(r["cites_supporting"] for r in sup),
                                                sum(r["n_cites"] for r in sup))
    out["cites_exist_rate"] = ratio(sum(r["cites_exist"] or 0 for r in answered),
                                    sum(r["n_cites"] for r in answered))
    s = sum(r["claims_supported"] for r in sup)
    u = sum(r["claims_unsupported"] for r in sup)
    out["claims"] = {"supported": s, "unsupported": u, "answers_judged": len(sup)}
    out["unsupported_claim_rate"] = ratio(u, s + u)
    out["answers_with_unsupported_claim"] = ratio(sum(1 for r in sup if r["claims_unsupported"]), len(sup))
    nq = sum(r["n_quotes"] for r in answered)
    out["quotes"] = {"total": nq, "verbatim_ok": sum(r["quotes_ok"] or 0 for r in answered)}
    out["quote_verbatim_rate"] = ratio(out["quotes"]["verbatim_ok"], nq)

    tp = sum(1 for r in dec if r["declined"])
    fn = sum(1 for r in dec if r["declined"] is False)
    fp = sum(1 for r in ans if r["declined"])
    out["decline"] = {"tp": tp, "fp": fp, "fn": fn, "precision": ratio(tp, tp + fp), "recall": ratio(tp, tp + fn),
                      "false_decline_rate": ratio(fp, len(ans))}

    graded = [r for r in ans if r["score"] is not None]
    out["correctness"] = {
        "graded": len(graded),
        "mean_score": ratio(sum(r["score"] for r in graded) / 2, len(graded)),
        "fully_correct": ratio(sum(1 for r in graded if r["score"] == 2), len(graded)),
        "at_least_partly": ratio(sum(1 for r in graded if r["score"] >= 1), len(graded)),
        "fully_correct_ci95": bootstrap_ci([1.0 if r["score"] == 2 else 0.0 for r in graded]),
    }
    gd = [r for r in dec if r["score"] is not None]
    out["correctness"]["must_decline_handled"] = ratio(sum(1 for r in gd if r["score"] == 2), len(gd))

    by_cat: dict[str, list[int]] = defaultdict(list)
    for r in graded:
        by_cat[r["category"]].append(r["score"])
    out["by_category"] = {c: {"n": len(v), "fully_correct": sum(1 for x in v if x == 2) / len(v)}
                          for c, v in sorted(by_cat.items())}
    eq = [r for r in graded if r["equipment"]]
    out["equipment_specific"] = {"n": len(eq), "fully_correct": ratio(sum(1 for r in eq if r["score"] == 2), len(eq))}
    by_diff: dict[str, list[int]] = defaultdict(list)
    for r in graded:
        by_diff[r["difficulty"] or "?"].append(r["score"])
    out["by_difficulty"] = {d: {"n": len(v), "fully_correct": sum(1 for x in v if x == 2) / len(v)}
                            for d, v in sorted(by_diff.items())}

    ok = [r for r in rows if r["ok"]]
    out["modes"] = dict(Counter(r["mode"] for r in ok))
    out["bake_hit_rate"] = ratio(sum(1 for r in ok if r["baked"]), len(ok)) if is_harvest else None
    out["bake_hit_rate_of_answered"] = ratio(sum(1 for r in answered if r["baked"]), len(answered)) \
        if is_harvest else None
    out["latency_ms"] = {
        "reported_p50": pct([r["elapsed_ms"] for r in ok], 0.5),
        "reported_p95": pct([r["elapsed_ms"] for r in ok], 0.95),
        "wall_p50": pct([r["wall_ms"] for r in ok], 0.5),
        "wall_p95": pct([r["wall_ms"] for r in ok], 0.95),
    }
    return out


def agreement(a: list[dict | None], b: list[dict | None]) -> dict:
    pairs = [(x["score"], y["score"]) for x, y in zip(a, b) if x and y]
    dpairs = [(x["declined"], y["declined"]) for x, y in zip(a, b) if x and y]
    if not pairs:
        return {"n": 0}
    n = len(pairs)
    po = sum(1 for x, y in pairs if x == y) / n
    ca, cb = Counter(x for x, _ in pairs), Counter(y for _, y in pairs)
    pe = sum(ca[c] * cb[c] for c in (0, 1, 2)) / (n * n)
    kappa = (po - pe) / (1 - pe) if pe < 1 else 1.0
    within1 = sum(1 for x, y in pairs if abs(x - y) <= 1) / n
    return {"n": n, "exact_agreement": po, "cohen_kappa": kappa, "within_one": within1,
            "fully_correct_agreement": sum(1 for x, y in pairs if (x == 2) == (y == 2)) / n,
            "declined_agreement": sum(1 for x, y in dpairs if x == y) / len(dpairs)}


def sign_test(wins: int, losses: int) -> float | None:
    """Two-sided exact binomial p-value for wins vs losses (ties dropped)."""
    n = wins + losses
    if n == 0:
        return None
    k = min(wins, losses)
    p = sum(math.comb(n, i) for i in range(k + 1)) / 2 ** n
    return min(1.0, 2 * p)


def compare(rows_a: list[dict], rows_b: list[dict]) -> dict:
    b = {r["id"]: r for r in rows_b}
    pairs = [(r, b[r["id"]]) for r in rows_a if r["id"] in b and r["score"] is not None and b[r["id"]]["score"] is not None]
    wins = sum(1 for x, y in pairs if x["score"] > y["score"])
    losses = sum(1 for x, y in pairs if x["score"] < y["score"])
    ties = len(pairs) - wins - losses
    both = sum(1 for x, y in pairs if x["score"] == 2 and y["score"] == 2)
    only_a = sum(1 for x, y in pairs if x["score"] == 2 and y["score"] != 2)
    only_b = sum(1 for x, y in pairs if x["score"] != 2 and y["score"] == 2)
    return {"n": len(pairs), "a_better": wins, "b_better": losses, "ties": ties, "sign_test_p": sign_test(wins, losses),
            "both_fully_correct": both, "only_a_fully_correct": only_a, "only_b_fully_correct": only_b,
            "mcnemar_p": sign_test(only_a, only_b)}
