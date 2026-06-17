"""Re-score rows.jsonl from the stored RAW text using the CURRENT metrics.

This decouples the expensive generation cache (raw replies in rows.jsonl) from
the cheap, evolving scoring logic — improving a metric never costs a re-run.
This is the source of truth for triage classification and for the report; the
`passed` field cached in rows.jsonl (written at generation time) is ignored.

Usage:
  python3 analyze.py                 # classify every language with both configs
  python3 analyze.py --fails de pl   # show failure reasons + sample bad replies
"""

from __future__ import annotations

import argparse
import collections
import json
import os

import metrics
from langs import CODES, by_code

ROWS = os.path.join(os.path.dirname(__file__), "results", "rows.jsonl")

DEAD_MAX = 0.34
WORKS_MIN = 0.90


def load_scored() -> list[dict]:
    out = []
    if not os.path.exists(ROWS):
        return out
    for line in open(ROWS, encoding="utf-8"):
        try:
            r = json.loads(line)
        except Exception:
            continue
        lang = by_code(r["lang"])
        if not lang:
            continue
        sc = metrics.score_reply(r.get("raw", ""), lang)
        r["_sc"] = sc
        out.append(r)
    return out


def _fail_reasons(sc) -> list[str]:
    why = []
    if sc.too_short:
        why.append("short")
    if sc.refusal:
        why.append("refusal")
    if sc.template_leak:
        why.append("tmpl")
    if not sc.target_present:
        why.append(f"no-target-script(in={sc.in_script})")
    if sc.repeat > metrics.MAX_REPEAT:
        why.append("repeat")
    return why


def rate(rows: list[dict], code: str, tag: str) -> tuple[float, int]:
    sub = [r for r in rows if r["lang"] == code and r["prompt_tag"] == tag]
    if not sub:
        return 0.0, 0
    k = sum(1 for r in sub if r["_sc"].passed)
    return k / len(sub), len(sub)


def classify(default_rate: float, cons_rate: float) -> str:
    best = max(default_rate, cons_rate)
    if best < DEAD_MAX:
        return "dead"
    if default_rate >= WORKS_MIN:
        return "works"
    return "borderline"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fails", nargs="*", help="show failure detail for these codes")
    ap.add_argument("--tag", default="ship")
    args = ap.parse_args()
    rows = load_scored()

    if args.fails is not None:
        codes = args.fails or CODES
        for code in codes:
            sub = [r for r in rows if r["lang"] == code and r["prompt_tag"] == args.tag]
            fails = [r for r in sub if not r["_sc"].passed]
            print(f"\n===== {code}: {len(fails)}/{len(sub)} fail ({args.tag}) =====")
            reasons = collections.Counter()
            for r in fails:
                reasons[",".join(_fail_reasons(r["_sc"])) or "?"] += 1
            for k, v in reasons.most_common():
                print(f"  {v:3d}x  {k}")
            for r in fails[:4]:
                print(f"   [u{r['user_idx']} s{r['seed']}] {r['_sc'].scrubbed[:140]!r}")
        return

    print(f"{'lang':14s} {'default':>8s} {'cons':>6s} {'in_scr':>7s} {'n':>4s}  verdict")
    by_v = collections.defaultdict(list)
    table = []
    for code in CODES:
        d, nd = rate(rows, code, "ship")
        c, nc = rate(rows, code, "ship-cons")
        if nd == 0 and nc == 0:
            continue
        sub = [r for r in rows if r["lang"] == code and r["prompt_tag"] == "ship"]
        isc = sum(r["_sc"].in_script for r in sub) / max(1, len(sub))
        v = classify(d, c)
        by_v[v].append(code)
        table.append((code, d, c, isc, nd, v))
        print(f"{code:14s} {d:8.2f} {c:6.2f} {isc:7.2f} {nd:4d}  {v}")
    print(f"\n{len(table)} langs complete")
    for v in ("works", "borderline", "dead"):
        ls = by_v.get(v, [])
        print(f"  {v} ({len(ls)}): {' '.join(ls)}")


if __name__ == "__main__":
    main()
