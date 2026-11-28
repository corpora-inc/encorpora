"""harvest-bake maint: maintenance manuals.

  harvest-bake maint pages    CORPUS.yaml [--dump N]            page models + page images; counts (or one page as prompt text)
  harvest-bake maint extract  CORPUS.yaml --arm A [--units K,..] call the arm's model on cache misses (ledgered)
  harvest-bake maint build    CORPUS.yaml [--arm A] [--out DIR] [--harvest BIN] [--pubkey FILE] [--embedder KIND]
                                                                no model calls; graph-validated, signed pack
  harvest-bake maint coverage CORPUS.yaml [--arm A] [--pack DIR] warnings, cautions, notes and question boxes attached
  harvest-bake maint score    CORPUS.yaml --expected FILE [--arm A] [--pack DIR]   precision / recall vs a known pack
  harvest-bake maint ab       CORPUS.yaml --a A --b B [--expected FILE] [--out FILE]  two arms, item by item
  harvest-bake maint synonyms CORPUS.yaml                       table corpora: symptom phrasings (Sonnet, cached)
  harvest-bake maint table-build CORPUS.yaml [--out DIR] [--harvest BIN]   table corpora: no model call
  harvest-bake maint cost     CORPUS.yaml [--arm A] [--tokens-per-page N]  ledger totals; projection for the corpus
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from ..corpus import load_corpus, harvest_home


def _harvest(a) -> str:
    return a.harvest or os.environ.get("HARVEST_BIN") or "harvest"


def _pack_dir(c, a) -> Path:
    from .build import arm
    return Path(a.pack) if getattr(a, "pack", None) else harvest_home() / "packs" / c.pack_id / arm(c, a.arm).name


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(prog="harvest-bake maint", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("pages")
    s.add_argument("corpus")
    s.add_argument("--dump", type=int, help="print this page (0-based) as the model sees it")
    s = sub.add_parser("extract")
    s.add_argument("corpus")
    s.add_argument("--arm", required=True)
    s.add_argument("--units")
    s = sub.add_parser("build")
    s.add_argument("corpus")
    s.add_argument("--arm")
    s.add_argument("--out")
    s.add_argument("--harvest")
    s.add_argument("--pubkey")
    s.add_argument("--embedder")
    s.add_argument("--agree-with", help="a second arm: rows it does not also produce go to needs_review")
    for name in ("coverage", "score"):
        s = sub.add_parser(name)
        s.add_argument("corpus")
        s.add_argument("--arm")
        s.add_argument("--pack")
        s.add_argument("--json", action="store_true")
        if name == "score":
            s.add_argument("--expected", required=True)
    s = sub.add_parser("ab")
    s.add_argument("corpus")
    s.add_argument("--a", required=True)
    s.add_argument("--b", required=True)
    s.add_argument("--expected")
    s.add_argument("--out")
    s.add_argument("--harvest")
    s = sub.add_parser("synonyms", help="table corpora: plain-language symptom phrasings (the one model task)")
    s.add_argument("corpus")
    s = sub.add_parser("table-build", help="table corpora: message | cause | solution -> pack, no model call")
    s.add_argument("corpus")
    s.add_argument("--out")
    s.add_argument("--harvest")
    s.add_argument("--pubkey")
    s.add_argument("--embedder")
    s = sub.add_parser("cost")
    s.add_argument("corpus")
    s.add_argument("--arm")
    s.add_argument("--pages", type=int, help="project for this many pages")
    a = ap.parse_args(argv)
    c = load_corpus(a.corpus)

    if a.cmd == "pages":
        from .build import cfg, sources
        from .extract import units
        from .render import page_text
        srcs = sources(c)
        if a.dump is not None:
            for _, models, _ in srcs:
                for pm in models:
                    if pm.index == a.dump:
                        print(page_text(pm))
            return 0
        for rec, models, opts in srcs:
            us = units(models, {**(cfg(c).get("units") or {}), **opts})
            print(json.dumps({"source": rec["source_id"], "pages": len(models),
                              "labels": [m.label for m in models],
                              "regions": sum(len(m.regions) for m in models),
                              "connectors": sum(len(m.connectors) for m in models),
                              "ocr_pages": sum(1 for m in models if m.ocr),
                              "units": [{"key": u.key, "pages": [models[0].label and m.label for m in models
                                                                   if m.index in u.pages]} for u in us]}, indent=1))
        return 0
    if a.cmd == "extract":
        from .build import extract
        _, reps, _ = extract(c, a.arm, offline=False, only_units=set(a.units.split(",")) if a.units else None)
        print(json.dumps(reps, indent=1))
        return 3 if any(r.get("stopped") for r in reps.values()) else 0
    if a.cmd == "build":
        from .build import build
        emb = {"kind": a.embedder} if a.embedder else None
        res = build(c, a.arm, Path(a.out) if a.out else None, _harvest(a), a.pubkey, emb, agree_with=a.agree_with)
        print(json.dumps(res, indent=1, default=str))
        return 0
    if a.cmd == "coverage":
        from .coverage import coverage, format_coverage
        r = coverage(c, _pack_dir(c, a))
        print(json.dumps(r, indent=1) if a.json else format_coverage(r))
        return 0
    if a.cmd == "score":
        from .score import format_score, score_pack
        r = score_pack(_pack_dir(c, a), json.loads(Path(a.expected).read_text()))
        print(json.dumps(r, indent=1) if a.json else format_score(r))
        return 0
    if a.cmd == "ab":
        from .ab import ab
        r = ab(c, a.a, a.b, _harvest(a), Path(a.expected) if a.expected else None, Path(a.out) if a.out else None)
        print(r["summary_text"])
        return 0
    if a.cmd == "synonyms":
        from .build import synonyms
        _, reps = synonyms(c, offline=False)
        print(json.dumps(reps, indent=1))
        return 0
    if a.cmd == "table-build":
        from .build import build_table
        res = build_table(c, Path(a.out) if a.out else None, _harvest(a), a.pubkey,
                          {"kind": a.embedder} if a.embedder else None)
        print(json.dumps(res, indent=1, default=str))
        return 0 if res.get("ok") else 1
    if a.cmd == "cost":
        from .build import ledger
        rows = [r for r in ledger(c).rows() if not a.arm or r.get("arm") == a.arm]
        tot = {}
        for r in rows:
            t = tot.setdefault(r.get("arm"), {"calls": 0, "errors": 0, "pages": 0, "input_tokens": 0,
                                              "output_tokens": 0, "cost_usd": 0.0, "seconds": 0.0})
            if r.get("error"):
                t["errors"] += 1
                continue
            t["calls"] += 1
            for k in ("pages", "input_tokens", "output_tokens", "seconds"):
                t[k] += r.get(k) or 0
            t["cost_usd"] = round(t["cost_usd"] + (r.get("cost_usd") or 0.0), 4)
        if a.pages:
            for t in tot.values():
                if t["pages"]:
                    f = a.pages / t["pages"]
                    t["projected"] = {"pages": a.pages, "tokens": int((t["input_tokens"] + t["output_tokens"]) * f),
                                      "cost_usd": round(t["cost_usd"] * f, 2), "hours": round(t["seconds"] * f / 3600, 1)}
        print(json.dumps(tot, indent=1))
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
