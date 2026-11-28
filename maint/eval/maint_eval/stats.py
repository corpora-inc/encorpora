"""Proportions with intervals, percentiles, agreement. Reuses harvest/eval's metrics where they fit."""
from __future__ import annotations

import math
from collections import Counter

from harvest_eval.metrics import bootstrap_ci, pct, sign_test  # noqa: F401  (re-exported)


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float] | None:
    if n == 0:
        return None
    p = k / n
    d = 1 + z * z / n
    c = p + z * z / (2 * n)
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return round((c - h) / d, 4), round((c + h) / d, 4)


def prop(flags: list[bool]) -> dict:
    flags = [bool(f) for f in flags if f is not None]
    n, k = len(flags), sum(flags)
    return {"k": k, "n": n, "p": round(k / n, 4) if n else None, "ci95": wilson(k, n)}


def lat(values: list[float | None]) -> dict:
    v = [x for x in values if x is not None]
    if not v:
        return {}
    return {"p50": round(pct(v, 0.5), 3), "p90": round(pct(v, 0.9), 3), "mean": round(sum(v) / len(v), 3), "n": len(v)}


def mcnemar(a: list[bool], b: list[bool]) -> dict:
    only_a = sum(1 for x, y in zip(a, b) if x and not y)
    only_b = sum(1 for x, y in zip(a, b) if y and not x)
    return {"only_a": only_a, "only_b": only_b, "p": sign_test(only_a, only_b)}


def agreement(runs: list[list[str]]) -> dict:
    """Share of items whose decision is identical in every run; mean pairwise agreement; Fleiss' kappa."""
    n = min(len(r) for r in runs)
    if n == 0 or len(runs) < 2:
        return {}
    same = sum(1 for i in range(n) if len({r[i] for r in runs}) == 1)
    pairs, agree = 0, 0
    for a in range(len(runs)):
        for b in range(a + 1, len(runs)):
            pairs += n
            agree += sum(1 for i in range(n) if runs[a][i] == runs[b][i])
    m = len(runs)
    cats = Counter(x for r in runs for x in r[:n])
    pe = sum((c / (n * m)) ** 2 for c in cats.values())
    pi = []
    for i in range(n):
        c = Counter(r[i] for r in runs)
        pi.append((sum(v * v for v in c.values()) - m) / (m * (m - 1)))
    po = sum(pi) / n
    kappa = (po - pe) / (1 - pe) if pe < 1 else 1.0
    return {"items": n, "runs": m, "all_identical": round(same / n, 4), "pairwise": round(agree / pairs, 4),
            "fleiss_kappa": round(kappa, 4)}
