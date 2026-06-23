"""Orchestrator for the qwen3-4B tutor bake-off.

Subcommands:
  triage [codes...]   Screen langs at default + conservative configs → classify
                      dead / borderline / works. Writes results/triage.json.
  tune   <code>       Coordinate-descent search on one language (default en).
                      Writes results/tune-<code>.json (the EN winner = new
                      global defaults).
  rescue <codes...>   Search borderline langs from the EN-optimal start, trying
                      BOTH the shipped (English-template) prompt and a target-
                      language prompt variant from results/prompts_<code>.txt if
                      present. Writes results/rescue-<code>.json.

All generations stream to results/rows.jsonl (resumable). Designed to run in the
background; re-running skips cached generations.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

import battery as B
import prompts
from evaluate import RESULTS_DIR, RowLog, eval_config
from langs import CODES, by_code
from search import coordinate_descent
from server import Params, Server

CONSERVATIVE = Params(temperature=0.3, top_k=20, min_p=0.05, repeat_penalty=1.1)

# Triage classification thresholds (pass-rate on the triage battery).
DEAD_MAX = 0.34     # below this at BOTH configs → can't produce the language
WORKS_MIN = 0.90    # at/above this at the default config → keep as-is


def _save(name: str, obj: dict) -> None:
    os.makedirs(RESULTS_DIR, exist_ok=True)
    with open(os.path.join(RESULTS_DIR, name), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


def _classify(default_rate: float, cons_rate: float) -> str:
    best = max(default_rate, cons_rate)
    if best < DEAD_MAX:
        return "dead"
    if default_rate >= WORKS_MIN:
        return "works"
    return "borderline"


def cmd_triage(args) -> None:
    codes = args.codes or CODES
    log = RowLog()
    rows: list[dict] = []
    with Server() as srv:
        for code in codes:
            lang = by_code(code)
            if not lang:
                print(f"  ?? unknown code {code}", file=sys.stderr)
                continue
            sp = prompts.pack_system_prompt(lang)
            bat = B.triage_battery()
            d = eval_config(srv, log, lang, sp, "ship", Params(), bat)
            c = eval_config(srv, log, lang, sp, "ship-cons", CONSERVATIVE, bat)
            verdict = _classify(d.pass_rate, c.pass_rate)
            rows.append({
                "lang": code, "verdict": verdict,
                "default": d.summary(), "conservative": c.summary(),
                "samples": d.samples,
            })
            print(f"  {code:14s} {verdict:10s} "
                  f"default={d.pass_rate:.2f} cons={c.pass_rate:.2f} "
                  f"in_script={d.mean_in_script:.2f}")
    log.close()
    rows.sort(key=lambda r: (r["verdict"], r["lang"]))
    _save("triage.json", {"thresholds": {"dead_max": DEAD_MAX, "works_min": WORKS_MIN},
                          "rows": rows})
    by_v: dict[str, list[str]] = {}
    for r in rows:
        by_v.setdefault(r["verdict"], []).append(r["lang"])
    print("\n=== TRIAGE SUMMARY ===")
    for v in ("works", "borderline", "dead"):
        langs = by_v.get(v, [])
        print(f"{v} ({len(langs)}): {' '.join(langs)}")


def cmd_tune(args) -> None:
    code = args.code
    lang = by_code(code)
    if not lang:
        sys.exit(f"unknown code {code}")
    log = RowLog()
    sp = prompts.pack_system_prompt(lang)
    bat = B.full_battery()
    seeds = [11, 23, 37, 53, 71, 97, 131]
    n = [0]

    def progress(r):
        n[0] += 1
        print(f"  [{n[0]:3d}] {r.params.key():55s} pass={r.pass_rate:.3f} "
              f"in_script={r.mean_in_script:.2f}")

    print(f"=== TUNE {code} (start = current defaults) ===")
    with Server() as srv:
        best_p, best_r, hist = coordinate_descent(
            srv, log, lang, sp, "tune", bat, seeds, Params(), on_eval=progress)
    log.close()
    out = {
        "lang": code,
        "n_configs": len(hist),
        "best": best_r.summary(),
        "best_params": best_p.__dict__,
        "baseline": hist[0].summary(),
        "samples": best_r.samples,
        "history": [h.summary() for h in hist],
    }
    _save(f"tune-{code}.json", out)
    print(f"\nBEST {code}: {best_p.__dict__}\n  pass={best_r.pass_rate:.3f} "
          f"(baseline {hist[0].pass_rate:.3f})")


def cmd_rescue(args) -> None:
    start = Params(**json.loads(args.start)) if args.start else Params()
    log = RowLog()
    bat = B.full_battery()
    seeds = [11, 23, 37, 53, 71]
    results = []
    with Server() as srv:
        for code in args.codes:
            lang = by_code(code)
            if not lang:
                continue
            variants = {"ship": prompts.pack_system_prompt(lang)}
            tgt_path = os.path.join(RESULTS_DIR, f"prompts_{code}.txt")
            if os.path.exists(tgt_path):
                with open(tgt_path, encoding="utf-8") as f:
                    variants["target"] = f.read().strip()
            best_overall = None
            for tag, sp in variants.items():
                print(f"=== RESCUE {code} / prompt={tag} ===")
                bp, br, hist = coordinate_descent(
                    srv, log, lang, sp, f"rescue-{tag}", bat, seeds, start,
                    on_eval=lambda r: print(
                        f"  {r.params.key():55s} pass={r.pass_rate:.3f}"))
                cand = {"prompt_tag": tag, "best_params": bp.__dict__,
                        "best": br.summary(), "samples": br.samples}
                if not best_overall or br.pass_rate > best_overall["best"]["pass_rate"]:
                    best_overall = cand
            results.append({"lang": code, "winner": best_overall})
            _save(f"rescue-{code}.json", {"lang": code, "winner": best_overall})
    log.close()
    print(json.dumps(results, ensure_ascii=False, indent=2))


def cmd_regen(args) -> None:
    """Regenerate the FULL battery for given langs at an explicit Params set and
    a custom prompt_tag — used to A/B a parameter change (e.g. low temperature)
    against the shipped defaults, and to feed fresh samples to the judge."""
    params = Params(**json.loads(args.params)) if args.params else Params()
    seeds = [int(s) for s in args.seeds.split(",")] if args.seeds else [11, 23, 37]
    log = RowLog()
    bat = B.full_battery()
    with Server() as srv:
        for code in args.codes:
            lang = by_code(code)
            if not lang:
                continue
            sp = prompts.pack_system_prompt(lang)
            r = eval_config(srv, log, lang, sp, args.tag, params, bat, seeds)
            print(f"  {code:14s} pass={r.pass_rate:.2f} in_script={r.mean_in_script:.2f}")
    log.close()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)
    rg = sub.add_parser("regen")
    rg.add_argument("tag")
    rg.add_argument("codes", nargs="+")
    rg.add_argument("--params", help="JSON Params dict")
    rg.add_argument("--seeds", help="comma seeds, default 11,23,37")
    rg.set_defaults(func=cmd_regen)
    t = sub.add_parser("triage")
    t.add_argument("codes", nargs="*")
    t.set_defaults(func=cmd_triage)
    tu = sub.add_parser("tune")
    tu.add_argument("code", nargs="?", default="en")
    tu.set_defaults(func=cmd_tune)
    r = sub.add_parser("rescue")
    r.add_argument("codes", nargs="+")
    r.add_argument("--start", help="JSON Params dict to start from (EN-optimal)")
    r.set_defaults(func=cmd_rescue)
    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
