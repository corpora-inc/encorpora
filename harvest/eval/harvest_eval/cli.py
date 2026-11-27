"""python -m harvest_eval {run,compare,check-ids} ..."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import metrics
from .corpus import Corpus
from .runner import load_set, run
from .sections import match


def compare_cmd(a) -> int:
    """Item-by-item comparison of two finished runs (two packs or two backends)."""
    import csv

    def rows(spec: str):
        d, _, name = spec.partition(":")
        path = Path(d) / "items.csv"
        with path.open() as f:
            rs = [r for r in csv.DictReader(f)]
        names = sorted({r["backend"] for r in rs})
        name = name or names[0]
        out = []
        for r in rs:
            if r["backend"] != name:
                continue
            r["score"] = int(r["score"]) if r["score"] not in ("", None) else None
            out.append(r)
        return name, out

    na, ra = rows(a.a)
    nb, rb = rows(a.b)
    res = metrics.compare(ra, rb)
    bmap = {r["id"]: r for r in rb}
    diffs = [(r, bmap[r["id"]]) for r in ra if r["id"] in bmap and r["score"] != bmap[r["id"]]["score"]]
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "compare.json").write_text(json.dumps({"a": f"{a.a}", "b": f"{a.b}", **res}, indent=1))
    with (out / "compare.csv").open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "category", f"score_{na}", f"score_{nb}", "question", f"answer_{na}", f"answer_{nb}"])
        for x, y in diffs:
            w.writerow([x["id"], x["category"], x["score"], y["score"], x["question"], x["answer"], y["answer"]])
    print(json.dumps(res, indent=1))
    return 0


def check_ids_cmd(a) -> int:
    """Which gold section ids does the pack (or a sections file) actually contain?"""
    items = load_set(Path(a.set))
    src = Path(a.pack)
    corpus = Corpus.from_jsonl(src) if src.suffix == ".jsonl" else Corpus.from_pack(src)
    gold = sorted({s for it in items for s in it.get("section_ids") or []})
    exact = [g for g in gold if g in corpus.text]
    near = [g for g in gold if g not in corpus.text and any(match(s, g, "lineage") for s in corpus.text)]
    missing = [g for g in gold if g not in exact and g not in near]
    quotes = [(it["id"], it["key_quote"]) for it in items if it.get("key_quote")]
    qok = [i for i, q in quotes if corpus.quote_ok(q["section_id"], q["text"])]
    print(json.dumps({"gold_ids": len(gold), "exact": len(exact), "lineage_only": len(near),
                      "missing": len(missing), "missing_ids": missing[:50],
                      "key_quotes": len(quotes), "key_quotes_ok": len(qok),
                      "key_quotes_failing": [i for i, _ in quotes if i not in set(qok)][:50]}, indent=1))
    return 0 if not missing else 1


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="harvest_eval")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run", help="run backends over a set, judge, write report.md/results.json/items.csv")
    r.add_argument("--config")
    r.add_argument("--set")
    r.add_argument("--pack", help="pack dir or .sqlite; overrides every harvest backend's pack")
    r.add_argument("--binary", help="harvest binary; overrides the config")
    r.add_argument("--llm", help="harvest --llm endpoint or 'off'; overrides the config")
    r.add_argument("--out", required=True)
    r.add_argument("--backends", nargs="*", help="run only these backend names")
    r.add_argument("--limit", type=int)
    r.add_argument("--only", nargs="*", help="item ids")
    r.add_argument("--no-judge", action="store_true", help="deterministic metrics only")
    c = sub.add_parser("compare", help="item-by-item comparison of two runs: DIR[:backend] DIR[:backend]")
    c.add_argument("a")
    c.add_argument("b")
    c.add_argument("--out", required=True)
    k = sub.add_parser("check-ids", help="gold section ids and key quotes present in a pack or sections file")
    k.add_argument("--set", required=True)
    k.add_argument("--pack", required=True)
    a = ap.parse_args(argv)
    if a.cmd == "run":
        return run(a)
    if a.cmd == "compare":
        return compare_cmd(a)
    return check_ids_cmd(a)


if __name__ == "__main__":
    sys.exit(main())
