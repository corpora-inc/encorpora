"""Where do a harvest backend's declines come from?

Reads a harvest_eval run's items.csv and splits the declined answerable items
by whether retrieval had already found a gold section: a decline with a gold
section in the top k is the answer gate throwing away a correct retrieval; one
without is a retrieval miss. Also lists declines and answers per category.

    python3 crane/eval/tools/decline_analysis.py <run>/items.csv [--backend NAME] [--k 5]
"""
from __future__ import annotations

import argparse
import collections
import csv
import json


def truthy(v: str) -> bool:
    return str(v).strip().lower() in ("true", "1", "yes")


def hit(v: str) -> bool:
    try:
        return float(v) > 0
    except ValueError:
        return False


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("items_csv")
    ap.add_argument("--backend")
    ap.add_argument("--k", type=int, default=5, choices=(1, 5, 10))
    a = ap.parse_args()
    rows = [r for r in csv.DictReader(open(a.items_csv, newline=""))
            if a.backend is None or r["backend"] == a.backend]
    failed = [r["id"] for r in rows if not r["mode"]]
    rows = [r for r in rows if r["mode"]]
    col = f"r@{a.k}.lineage"
    ans = [r for r in rows if not truthy(r["must_decline"])]
    must = [r for r in rows if truthy(r["must_decline"])]
    dec = [r for r in ans if r["mode"] == "declined"]
    answered = [r for r in ans if r["mode"] != "declined"]
    by_cat: dict[str, list[int]] = collections.defaultdict(lambda: [0, 0])
    for r in ans:
        by_cat[r["category"]][0 if r["mode"] == "declined" else 1] += 1
    out = {
        "failed_calls_excluded": len(failed),
        "answerable": len(ans),
        "answerable_declined": len(dec),
        f"declined_with_gold_in_top{a.k}": sum(hit(r[col]) for r in dec),
        f"declined_without_gold_in_top{a.k}": sum(not hit(r[col]) for r in dec),
        "answerable_answered": len(answered),
        f"answered_with_gold_in_top{a.k}": sum(hit(r[col]) for r in answered),
        "must_decline": len(must),
        "must_decline_declined": sum(r["mode"] == "declined" for r in must),
        "by_category_declined_answered": dict(sorted(by_cat.items())),
    }
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
