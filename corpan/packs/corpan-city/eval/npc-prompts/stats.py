#!/usr/bin/env python3
"""
stats.py — aggregate out/scores.jsonl into per-variant statistics with rigor:
means + bootstrap 95% CIs, Welch t-test + Cohen's d vs the baseline, the
creativity↔cohesion tradeoff curve, and the Pareto frontier on
(creativity, cohesion). Also analyses the repeat-visit study. Writes
out/summary.json and prints a human report to stdout.

No SciPy dependency — bootstrap CIs + a normal-approx p-value (and the exact
statistics needed) are implemented directly so the harness stays light.
"""
import argparse
import json
import math
import sys
from collections import defaultdict

import numpy as np

PRIMARY = "delight"
METRIC_KEYS = [
    "rep_max", "rep_mean", "rep_consec_mean", "exact_repeat_rate",
    "segue_repeat_rate", "fixation", "diversity", "brevity_ok", "lang_ok",
    "native_leak_mean", "nondegen",
]
SCORE_KEYS = ["cohesion", "creativity", "incoherence", "delight"]


def bootstrap_ci(x, iters=5000, alpha=0.05, seed=7):
    x = np.asarray(x, dtype=float)
    if len(x) == 0:
        return (float("nan"), float("nan"), float("nan"))
    if len(x) == 1:
        return (x[0], x[0], x[0])
    rng = np.random.default_rng(seed)
    means = rng.choice(x, size=(iters, len(x)), replace=True).mean(axis=1)
    lo = np.percentile(means, 100 * alpha / 2)
    hi = np.percentile(means, 100 * (1 - alpha / 2))
    return (float(x.mean()), float(lo), float(hi))


def welch_t(a, b):
    """Welch's t-test → (t, df, two-sided p via normal/t approx) + Cohen's d."""
    a = np.asarray(a, float); b = np.asarray(b, float)
    na, nb = len(a), len(b)
    if na < 2 or nb < 2:
        return (float("nan"), float("nan"), float("nan"), float("nan"))
    ma, mb = a.mean(), b.mean()
    va, vb = a.var(ddof=1), b.var(ddof=1)
    se = math.sqrt(va / na + vb / nb)
    if se == 0:
        return (0.0, float(na + nb - 2), 1.0, 0.0)
    t = (ma - mb) / se
    df = (va / na + vb / nb) ** 2 / (
        (va / na) ** 2 / (na - 1) + (vb / nb) ** 2 / (nb - 1))
    # two-sided p via survival of |t| under a t-dist, approximated with the
    # regularized incomplete beta (no SciPy).
    p = 2 * _t_sf(abs(t), df)
    # Pooled-SD Cohen's d.
    sp = math.sqrt(((na - 1) * va + (nb - 1) * vb) / (na + nb - 2))
    d = (ma - mb) / sp if sp > 0 else 0.0
    return (t, df, min(1.0, p), d)


def _t_sf(t, df):
    """Survival function of Student-t via incomplete beta. P(T>t)."""
    x = df / (df + t * t)
    ib = _betainc(df / 2.0, 0.5, x)
    return 0.5 * ib


def _betainc(a, b, x):
    """Regularized incomplete beta I_x(a,b) via continued fraction (Numerical
    Recipes style). Sufficient precision for p-values here."""
    if x <= 0:
        return 0.0
    if x >= 1:
        return 1.0
    lbeta = math.lgamma(a) + math.lgamma(b) - math.lgamma(a + b)
    front = math.exp(a * math.log(x) + b * math.log(1 - x) - lbeta) / a
    # Lentz's continued fraction
    f, c, d = 1.0, 1.0, 0.0
    for i in range(0, 200):
        m = i // 2
        if i == 0:
            num = 1.0
        elif i % 2 == 0:
            num = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m))
        else:
            num = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1))
        d = 1.0 + num * d
        if abs(d) < 1e-30:
            d = 1e-30
        d = 1.0 / d
        c = 1.0 + num / c
        if abs(c) < 1e-30:
            c = 1e-30
        cd = c * d
        f *= cd
        if abs(1.0 - cd) < 1e-10:
            break
    val = front * (f - 1.0)
    # I_x(a,b); use symmetry for stability when x large
    if x < (a + 1) / (a + b + 2):
        return val
    return 1.0 - _betainc(b, a, 1 - x)


def pareto_frontier(points):
    """points: list of (id, creativity, cohesion). Return ids on the upper-right
    Pareto frontier (maximize both)."""
    front = []
    for i, (idi, ci, hi) in enumerate(points):
        dominated = False
        for j, (idj, cj, hj) in enumerate(points):
            if j == i:
                continue
            if cj >= ci and hj >= hi and (cj > ci or hj > hi):
                dominated = True
                break
        if not dominated:
            front.append(idi)
    return front


def load(path):
    rows = []
    for line in open(path):
        rows.append(json.loads(line))
    return rows


def agg(rows, group_key):
    groups = defaultdict(list)
    for r in rows:
        groups[group_key(r)].append(r)
    out = {}
    for g, rs in groups.items():
        rec = {"n": len(rs)}
        for k in METRIC_KEYS:
            vals = [r["metrics"][k] for r in rs]
            mean, lo, hi = bootstrap_ci(vals)
            rec[k] = {"mean": round(mean, 4), "ci": [round(lo, 4), round(hi, 4)]}
        for k in SCORE_KEYS:
            vals = [r["scores"][k] for r in rs]
            mean, lo, hi = bootstrap_ci(vals)
            rec[k] = {"mean": round(mean, 4), "ci": [round(lo, 4), round(hi, 4)]}
        # keep raw delight vector for significance testing
        rec["_delight_vec"] = [r["scores"]["delight"] for r in rs]
        rec["_creativity_vec"] = [r["scores"]["creativity"] for r in rs]
        rec["_cohesion_vec"] = [r["scores"]["cohesion"] for r in rs]
        rec["_repmean_vec"] = [r["metrics"]["rep_mean"] for r in rs]
        rec["_seguerep_vec"] = [r["metrics"]["segue_repeat_rate"] for r in rs]
        out[g] = rec
    return out


def fmt_ci(d):
    return f"{d['mean']:+.3f} [{d['ci'][0]:+.3f},{d['ci'][1]:+.3f}]"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scores", default="out/scores.jsonl")
    ap.add_argument("--out", default="out/summary.json")
    ap.add_argument("--baseline", default="baseline")
    ap.add_argument("--repeat-visits-scores", default="")
    args = ap.parse_args()

    rows = load(args.scores)
    by_variant = agg(rows, lambda r: r["variantId"])

    base = by_variant.get(args.baseline)
    if base is None:
        print(f"[stats] baseline '{args.baseline}' not in data", file=sys.stderr)

    # Significance vs baseline on delight, creativity, cohesion, rep_mean.
    sig = {}
    if base:
        for v, rec in by_variant.items():
            if v == args.baseline:
                continue
            t_d, df_d, p_d, cohend_d = welch_t(rec["_delight_vec"], base["_delight_vec"])
            t_r, _, p_r, cohend_r = welch_t(rec["_repmean_vec"], base["_repmean_vec"])
            t_s, _, p_s, cohend_s = welch_t(rec["_seguerep_vec"], base["_seguerep_vec"])
            sig[v] = {
                "delight_delta": round(rec["delight"]["mean"] - base["delight"]["mean"], 4),
                "delight_p": round(p_d, 5),
                "delight_cohen_d": round(cohend_d, 3),
                "rep_mean_delta": round(rec["rep_mean"]["mean"] - base["rep_mean"]["mean"], 4),
                "rep_mean_p": round(p_r, 5),
                "segue_repeat_delta": round(
                    rec["segue_repeat_rate"]["mean"] - base["segue_repeat_rate"]["mean"], 4),
                "segue_repeat_p": round(p_s, 5),
            }

    # Tradeoff curve: temperature sweep (per variant) → (creativity, cohesion).
    by_vt = agg(rows, lambda r: (r["variantId"], r["temperature"]))
    tradeoff = []
    for (v, t), rec in by_vt.items():
        tradeoff.append({
            "variant": v, "temperature": t, "n": rec["n"],
            "creativity": rec["creativity"]["mean"],
            "cohesion": rec["cohesion"]["mean"],
            "delight": rec["delight"]["mean"],
            "rep_mean": rec["rep_mean"]["mean"],
        })

    # Pareto frontier on (creativity, cohesion) across all variant×temp points.
    pts = [(f"{x['variant']}@t{x['temperature']}", x["creativity"], x["cohesion"])
           for x in tradeoff]
    frontier = pareto_frontier(pts)

    # Strip internal vectors before writing.
    def clean(rec):
        return {k: v for k, v in rec.items() if not k.startswith("_")}

    summary = {
        "n_conversations": len(rows),
        "variants": {v: clean(rec) for v, rec in by_variant.items()},
        "significance_vs_baseline": sig,
        "tradeoff_curve": sorted(tradeoff, key=lambda x: (x["variant"], x["temperature"])),
        "pareto_frontier": frontier,
    }

    # Optional repeat-visit analysis.
    if args.repeat_visits_scores:
        try:
            rv = load(args.repeat_visits_scores)
            summary["repeat_visits"] = rv
        except Exception as e:
            print(f"[stats] repeat-visit scores unavailable: {e}", file=sys.stderr)

    json.dump(summary, open(args.out, "w"), indent=2, ensure_ascii=False)

    # ----------------------------------------------------------- human report --
    print("=" * 78)
    print("WORLD PLAZA — NPC PROMPT STUDY  (programmatic judge)")
    print("=" * 78)
    print(f"Conversations scored: {len(rows)}")
    print()
    print("PER-VARIANT (mean [95% bootstrap CI]) — sorted by Delight:")
    order = sorted(by_variant.items(), key=lambda kv: -kv[1]["delight"]["mean"])
    hdr = f"{'variant':<28}{'n':>4}  {'delight':>22} {'creat':>7} {'cohes':>7} {'repμ':>7} {'segRep':>7}"
    print(hdr)
    print("-" * len(hdr))
    for v, rec in order:
        print(f"{v:<28}{rec['n']:>4}  {fmt_ci(rec['delight']):>22} "
              f"{rec['creativity']['mean']:>7.3f} {rec['cohesion']['mean']:>7.3f} "
              f"{rec['rep_mean']['mean']:>7.3f} {rec['segue_repeat_rate']['mean']:>7.3f}")
    print()
    if sig:
        print("SIGNIFICANCE vs baseline (Welch t-test, Cohen's d):")
        print(f"{'variant':<28}{'Δdelight':>9}{'p':>8}{'d':>7}{'Δrepμ':>9}{'p':>8}{'ΔsegRep':>9}{'p':>8}")
        for v, s in sorted(sig.items(), key=lambda kv: kv[1]["delight_delta"], reverse=True):
            star = "*" if s["delight_p"] < 0.05 else " "
            print(f"{v:<28}{s['delight_delta']:>+9.3f}{s['delight_p']:>8.4f}{star}"
                  f"{s['delight_cohen_d']:>6.2f}"
                  f"{s['rep_mean_delta']:>+9.3f}{s['rep_mean_p']:>8.4f}"
                  f"{s['segue_repeat_delta']:>+9.3f}{s['segue_repeat_p']:>8.4f}")
        print()
    print("PARETO FRONTIER (maximize creativity AND cohesion):")
    for p in frontier:
        row = next(x for x in tradeoff if f"{x['variant']}@t{x['temperature']}" == p)
        print(f"  {p:<34} creativity={row['creativity']:.3f} cohesion={row['cohesion']:.3f} "
              f"delight={row['delight']:.3f}")
    print()
    print("TEMPERATURE SWEEP (creativity↔cohesion tradeoff, baseline + top variant):")
    tops = {order[0][0], args.baseline}
    for v in tops:
        pts_v = sorted([x for x in tradeoff if x["variant"] == v], key=lambda x: x["temperature"])
        print(f"  {v}:")
        for x in pts_v:
            print(f"    t={x['temperature']}: creativity={x['creativity']:.3f} "
                  f"cohesion={x['cohesion']:.3f} rep_mean={x['rep_mean']:.3f} "
                  f"delight={x['delight']:.3f}")
    print()
    print(f"[stats] full summary → {args.out}")


if __name__ == "__main__":
    main()
