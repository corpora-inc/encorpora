"""Release gate: check finished runs against a release bar.

    python -m harvest_eval gate --bar <bar.yaml> --run <out dir> [--run <dir> ...] --system <backend>
        [--pack <pack dir or .sqlite>] [--out <dir>]

The bar is a corpus-side config (for the crane pack: crane/eval/release-bar.yaml). Every
criterion is computed from the runs' results.json and items.csv, so the gate never re-runs a
system or calls a judge. Exit code 0 when every criterion passes, 1 when any fails, 2 on a
usage error (missing system, runs on different sets).
"""
from __future__ import annotations

import csv
import json
import re
import sqlite3
from collections import defaultdict
from pathlib import Path

from .runner import load_config

WORD = re.compile(r"[a-z0-9]+")
STOP = {"the", "a", "an", "to", "of", "is", "do", "i", "we", "it", "and", "or", "for", "on", "in"}


def tokens(s: str) -> frozenset[str]:
    return frozenset(WORD.findall(s.lower())) - STOP


def load_run(d: Path) -> tuple[dict, dict[str, list[dict]]]:
    res = json.loads((d / "results.json").read_text())
    rows: dict[str, list[dict]] = defaultdict(list)
    with (d / "items.csv").open(newline="") as f:
        for r in csv.DictReader(f):
            rows[r["backend"]].append(r)
    return res, rows


def truthy(v) -> bool:
    return str(v).strip().lower() in ("true", "1", "yes")


def pack_db(p: Path) -> Path:
    if p.is_dir():
        dbs = sorted(p.glob("*.sqlite"))
        if not dbs:
            raise SystemExit(f"no .sqlite in {p}")
        return dbs[0]
    return p


def contamination(set_path: Path, pack: Path, near: float, leak: float) -> dict:
    """Pack text that is a copy of a held-out question: answer aliases, answer questions and
    question-bank stems, compared by token Jaccard (the set builder's own measure)."""
    items = [json.loads(l) for l in set_path.open() if l.strip()]
    con = sqlite3.connect(f"file:{pack_db(pack)}?mode=ro", uri=True)
    texts: list[tuple[str, str]] = []
    for table, col, key in (("answer_alias", "alias", "answer_id"), ("answer", "question", "answer_id"),
                            ("question", "stem", "q_id")):
        try:
            texts += [(f"{table}:{k}", t) for t, k in con.execute(f"SELECT {col}, {key} FROM {table}")]
        except sqlite3.Error:
            pass
    con.close()
    index: dict[str, list[int]] = defaultdict(list)
    toks = [tokens(t) for _, t in texts]
    for i, t in enumerate(toks):
        for w in t:
            index[w].append(i)
    worst = []
    for it in items:
        q = tokens(it["question"])
        if not q:
            continue
        cand = {i for w in q for i in index.get(w, ())}
        best, where = 0.0, None
        for i in cand:
            u = toks[i]
            j = len(q & u) / len(q | u)
            if j > best:
                best, where = j, i
        if best >= near:
            worst.append({"id": it["id"], "jaccard": round(best, 3), "pack_row": texts[where][0],
                          "question": it["question"], "pack_text": texts[where][1]})
    worst.sort(key=lambda x: -x["jaccard"])
    return {"pack_texts": len(texts), "near": [w for w in worst if w["jaccard"] < leak],
            "leaks": [w for w in worst if w["jaccard"] >= leak]}


def gate(bar: dict, runs: list[Path], system: str, pack: Path | None, set_path: Path | None = None) -> dict:
    loaded = [load_run(d) for d in runs]
    shas = {res["meta"]["set"]["sha256"] for res, _ in loaded}
    if len(shas) != 1:
        raise SystemExit(f"runs are on different sets: {sorted(shas)}")
    sha = shas.pop()
    meta_set = loaded[0][0]["meta"]["set"]
    backends: dict[str, tuple[dict, list[dict]]] = {}
    for res, rows in loaded:
        for name, agg in res["backends"].items():
            backends.setdefault(name, (agg, rows.get(name, [])))
    if system not in backends:
        raise SystemExit(f"system {system!r} not in the runs (have {sorted(backends)})")
    agg, rows = backends[system]
    t = bar["thresholds"]
    checks: list[dict] = []

    def check(name: str, ok: bool, value, need: str, why: str = "") -> None:
        checks.append({"criterion": name, "pass": bool(ok), "value": value, "bar": need, "why": why})

    fresh = {v: k for k, v in (bar.get("fresh_sets") or {}).items() if v}
    check("fresh held-out set", sha in fresh, fresh.get(sha, f"sha256 {sha[:16]}…"),
          "one of " + ", ".join(sorted(bar.get("fresh_sets") or {})),
          "" if sha in fresh else "the set is not a registered fresh set (v1 tuned the engine)")
    n_items = meta_set["items"]
    check("set size", n_items >= bar.get("min_items", 0), n_items, f">= {bar.get('min_items', 0)} items",
          "" if n_items >= bar.get("min_items", 0) else "too small to certify; reported as interim")
    check("no failed calls", agg["errors"] == 0 and not agg.get("grades_missing"),
          {"errors": agg["errors"], "grades_missing": len(agg.get("grades_missing") or [])}, "0 and 0")
    fc = agg["correctness"]["fully_correct"] or 0.0
    check("fully correct (answerable)", fc >= t["fully_correct"], round(fc, 4), f">= {t['fully_correct']}",
          f"{sum(1 for r in rows if not truthy(r['must_decline']) and r['score'] == '2')} of "
          f"{agg['n_answerable']}; 95% CI {agg['correctness'].get('fully_correct_ci95')}")
    rec = agg["decline"]["recall"] or 0.0
    check("correct declines (must-decline declined)", rec >= t["declines"], round(rec, 4), f">= {t['declines']}",
          f"{agg['decline']['tp']} of {agg['n_must_decline']}")
    u = agg["claims"]["unsupported"]
    check("unsupported claims in shipped answers", u <= t["unsupported_claims"], u,
          f"<= {t['unsupported_claims']}", f"rate {agg.get('unsupported_claim_rate')}; "
          f"{sum(1 for r in rows if r.get('claims_unsupported') not in ('', '0', None))} answers carry one")
    qv = agg.get("quote_verbatim_rate")
    check("every quote verbatim", qv is None or qv >= t["quote_verbatim"], qv, f">= {t['quote_verbatim']}",
          f"{agg['quotes']['verbatim_ok']} of {agg['quotes']['total']}")
    ce = agg.get("cites_exist_rate")
    check("every citation real", ce is None or ce >= t["cites_exist"], ce, f">= {t['cites_exist']}")
    for other in bar.get("must_beat") or []:
        if other not in backends:
            check(f"beats {other}", False, None, "present in the runs", "comparison not run on this set")
            continue
        ofc = backends[other][0]["correctness"]["fully_correct"] or 0.0
        check(f"beats {other} on fully correct", fc > ofc, {"system": round(fc, 4), other: round(ofc, 4)},
              "system > comparison, with 0 unsupported claims",
              f"{other} unsupported-claim rate {backends[other][0].get('unsupported_claim_rate')}")

    cats: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        cats[r["category"]].append(r)
    per_cat = []
    floor = bar.get("category_floor", t["fully_correct"])
    for c, rs in sorted(cats.items()):
        must = [r for r in rs if truthy(r["must_decline"])]
        ans = [r for r in rs if not truthy(r["must_decline"])]
        if ans:
            v = sum(1 for r in ans if r["score"] == "2") / len(ans)
            kind = "fully correct"
        else:
            v = sum(1 for r in must if truthy(r["declined"])) / len(must)
            kind = "declined"
        bad = sum(1 for r in rs if r.get("claims_unsupported") not in ("", "0", None))
        per_cat.append({"category": c, "n": len(rs), "metric": kind, "value": round(v, 4),
                        "below_floor": v < (floor if ans else t["declines"]), "answers_with_unsupported": bad})

    cont = None
    if pack is not None and bar.get("contamination"):
        cc = bar["contamination"]
        sp = set_path or Path(meta_set["path"])
        if not sp.exists():
            raise SystemExit(f"set file {sp} not found: pass --set")
        cont = contamination(sp, pack, cc.get("near", 0.6), cc.get("leak", 0.9))
        check("set not in the bake", not cont["leaks"], len(cont["leaks"]),
              f"no pack alias, answer or question with token Jaccard >= {cc.get('leak', 0.9)} to a set question",
              f"{len(cont['near'])} look-alikes in [{cc.get('near', 0.6)}, {cc.get('leak', 0.9)}) "
              f"over {cont['pack_texts']} pack texts (reported, not failing)")
    hidden = fresh.get(sha) in set(bar.get("hidden_sets") or [])
    if hidden:
        meta_set = {k: v for k, v in meta_set.items() if k != "path"}
        if cont:
            for w in cont["leaks"] + cont["near"]:
                w.pop("question", None)
                w.pop("pack_text", None)
    return {"system": system, "set": {**meta_set, "fresh_name": fresh.get(sha), "hidden": hidden},
            "pass": all(c["pass"] for c in checks),
            "checks": checks, "by_category": per_cat, "contamination": cont,
            "runs": [str(d) for d in runs]}


def write(out: dict, d: Path | None) -> str:
    lines = [f"# Release gate: {out['system']}", "",
             f"Set: {out['set'].get('fresh_name') or out['set'].get('path')} ({out['set']['items']} items"
             f"{', hidden: item text withheld' if out['set'].get('hidden') else ''}). "
             f"**{'PASS' if out['pass'] else 'FAIL'}**", "",
             "| Criterion | Pass | Value | Bar | Detail |", "|---|---|---|---|---|"]
    for c in out["checks"]:
        lines.append(f"| {c['criterion']} | {'yes' if c['pass'] else '**no**'} | {c['value']} | {c['bar']} | {c['why']} |")
    lines += ["", "## By category", "", "| Category | n | Metric | Value | Below floor | Answers with an unsupported claim |",
              "|---|---|---|---|---|---|"]
    for c in out["by_category"]:
        lines.append(f"| {c['category']} | {c['n']} | {c['metric']} | {c['value']:.3f} | "
                     f"{'**yes**' if c['below_floor'] else 'no'} | {c['answers_with_unsupported']} |")
    if out["contamination"]:
        cc = out["contamination"]
        lines += ["", f"## Set against the bake: {len(cc['leaks'])} copies, {len(cc['near'])} look-alikes", ""]
        for w in (cc["leaks"] + cc["near"])[:20]:
            text = f": {w['question'][:90]!r} / {w['pack_text'][:90]!r}" if "question" in w else ""
            lines.append(f"- {w['id']} ({w['jaccard']}) vs {w['pack_row']}{text}")
    md = "\n".join(lines) + "\n"
    if d is not None:
        d.mkdir(parents=True, exist_ok=True)
        (d / f"gate-{out['system']}.md").write_text(md)
        (d / f"gate-{out['system']}.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
    return md


def gate_cmd(a) -> int:
    bar = load_config(Path(a.bar))
    out = gate(bar, [Path(r) for r in a.run], a.system, Path(a.pack) if a.pack else None,
               Path(a.set) if a.set else None)
    print(write(out, Path(a.out) if a.out else None))
    return 0 if out["pass"] else 1
