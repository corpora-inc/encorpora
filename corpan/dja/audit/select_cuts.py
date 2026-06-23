#!/usr/bin/env python3
"""Build the prune cut list from pass2_scores.jsonl, hitting per-level quotas
without skewing domain distribution.

Composite score (higher = more keep-worthy):
    score = 0.4 * naturalness + 0.4 * utility + 0.2 * translatability
            - 0.5 * dup_penalty
where dup_penalty = 1 if suspected_dup_of is set, else 0.

Defaults aim for a ~10k corpus from 27,353 with A1-B2 emphasis.

Output: audit/cut_list.csv with columns
    id,level,domain,score,cut_flag_from_llm,reason,en_text
"""

from __future__ import annotations

import argparse
import csv
import json
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Tuple

HERE = Path(__file__).resolve().parent
DJA_ROOT = HERE.parent
DB_PATH = DJA_ROOT / "db.sqlite3"
SCORES_PATH = HERE / "pass2_scores.jsonl"
CUT_LIST_PATH = HERE / "cut_list.csv"
KEEP_LIST_PATH = HERE / "keep_list.csv"


# Default per-level cut targets (from-current → keep-target → cuts)
DEFAULT_TARGETS = {
    # level: (current_count, keep_target)
    "A0": (441, 380),
    "A1": (5891, 2500),
    "A2": (6444, 2800),
    "B1": (10780, 3400),
    "B2": (3389, 800),
    "C1": (385, 100),
    "C2": (23, 20),
}


def load_scores(path: Path) -> Dict[int, dict]:
    out: Dict[int, dict] = {}
    if not path.exists():
        return out
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            try:
                rid = int(row["id"])
            except (KeyError, ValueError, TypeError):
                continue
            out[rid] = row
    return out


def composite(score: dict) -> float:
    n = float(score.get("naturalness") or 3)
    u = float(score.get("utility") or 3)
    t = float(score.get("translatability") or 3)
    dup = 1.0 if score.get("suspected_dup_of") else 0.0
    return 0.4 * n + 0.4 * u + 0.2 * t - 0.5 * dup


def fetch_entries(db: Path) -> Dict[int, dict]:
    con = sqlite3.connect(str(db))
    cur = con.cursor()
    cur.execute(
        """
        SELECT e.id, e.en_text, e.level, COALESCE(MIN(d.code), '_none') AS domain
        FROM cor_entry e
        LEFT JOIN cor_entry_domains ed ON ed.entry_id = e.id
        LEFT JOIN cor_domain d ON d.id = ed.domain_id
        GROUP BY e.id
        """
    )
    out = {
        eid: {"id": eid, "en_text": en, "level": lvl, "domain": dom}
        for eid, en, lvl, dom in cur.fetchall()
    }
    con.close()
    return out


def select(
    entries: Dict[int, dict],
    scores: Dict[int, dict],
    targets: Dict[str, Tuple[int, int]],
) -> Tuple[List[dict], List[dict]]:
    """Return (cut_rows, keep_rows). Each row is the entry dict + score fields."""
    # Group by (level, domain)
    by_level_dom: Dict[Tuple[str, str], List[dict]] = defaultdict(list)
    for eid, ent in entries.items():
        s = scores.get(eid)
        if s is None:
            # un-scored — assume keep, neutral score
            row = {**ent, "_score": 3.0, "_llm_cut": False, "_reason": "(unscored)",
                   "_naturalness": None, "_utility": None, "_translatability": None,
                   "_suspected_dup_of": None}
        else:
            row = {
                **ent,
                "_score": composite(s),
                "_llm_cut": bool(s.get("cut")),
                "_reason": str(s.get("reason") or ""),
                "_naturalness": s.get("naturalness"),
                "_utility": s.get("utility"),
                "_translatability": s.get("translatability"),
                "_suspected_dup_of": s.get("suspected_dup_of"),
            }
        by_level_dom[(ent["level"], ent["domain"])].append(row)

    # Per-level: distribute cut budget across domains proportionally to count
    cut_rows: List[dict] = []
    keep_rows: List[dict] = []
    for level, (current, keep_target) in targets.items():
        # All entries at this level, grouped by domain
        domains = {dom: rows for (lv, dom), rows in by_level_dom.items() if lv == level}
        present = sum(len(v) for v in domains.values())
        if present == 0:
            continue
        cuts_needed_total = max(0, present - keep_target)

        # Proportional cut budget per domain
        budgets: Dict[str, int] = {}
        running = 0
        # sort domains by size desc for stable rounding
        sorted_doms = sorted(domains.items(), key=lambda kv: -len(kv[1]))
        for dom, rows in sorted_doms:
            share = cuts_needed_total * len(rows) / present
            budgets[dom] = int(round(share))
            running += budgets[dom]
        # adjust for rounding
        diff = cuts_needed_total - running
        if diff != 0 and sorted_doms:
            # add/subtract from the largest bucket
            biggest = sorted_doms[0][0]
            budgets[biggest] = max(0, budgets[biggest] + diff)

        for dom, rows in domains.items():
            budget = min(budgets.get(dom, 0), len(rows))
            # sort ascending by score (lowest first → cut first)
            # tie-breakers: LLM cut flag first, suspected_dup_of, length asc
            rows.sort(key=lambda r: (
                r["_score"],
                0 if r["_llm_cut"] else 1,
                0 if r["_suspected_dup_of"] else 1,
                len(r["en_text"]),
                r["id"],
            ))
            cuts_here = rows[:budget]
            keeps_here = rows[budget:]
            cut_rows.extend(cuts_here)
            keep_rows.extend(keeps_here)

    return cut_rows, keep_rows


def write_csv(path: Path, rows: List[dict]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow([
            "id", "level", "domain", "score",
            "naturalness", "utility", "translatability",
            "suspected_dup_of", "llm_cut", "reason", "en_text",
        ])
        for r in rows:
            w.writerow([
                r["id"], r["level"], r["domain"], f"{r['_score']:.3f}",
                r["_naturalness"], r["_utility"], r["_translatability"],
                r["_suspected_dup_of"], int(r["_llm_cut"]), r["_reason"],
                r["en_text"],
            ])


def parse_targets(spec: str) -> Dict[str, Tuple[int, int]]:
    """Parse 'A0:380,A1:2500,...' into a level→keep_target map (current pulled later)."""
    if not spec:
        return DEFAULT_TARGETS
    out = dict(DEFAULT_TARGETS)
    for chunk in spec.split(","):
        if not chunk.strip():
            continue
        level, target = chunk.split(":")
        level = level.strip()
        keep = int(target)
        cur = out.get(level, (0, keep))[0]
        out[level] = (cur, keep)
    return out


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--db", default=str(DB_PATH))
    p.add_argument("--scores", default=str(SCORES_PATH))
    p.add_argument("--targets", default="",
                   help="Override: A0:380,A1:2500,A2:2800,B1:3400,B2:800,C1:100,C2:20")
    p.add_argument("--out", default=str(CUT_LIST_PATH))
    p.add_argument("--keep-out", default=str(KEEP_LIST_PATH))
    args = p.parse_args()

    targets = parse_targets(args.targets)
    entries = fetch_entries(Path(args.db))
    scores = load_scores(Path(args.scores))

    print(f"Entries: {len(entries)} | Scores: {len(scores)}")

    cut_rows, keep_rows = select(entries, scores, targets)

    print("\nPer-level summary:")
    print(f"{'level':<5} {'cur':>5} {'target':>6} {'keep':>5} {'cut':>5}")
    by_level_keep = defaultdict(int)
    by_level_cut = defaultdict(int)
    for r in keep_rows:
        by_level_keep[r["level"]] += 1
    for r in cut_rows:
        by_level_cut[r["level"]] += 1
    total_keep = total_cut = 0
    for lvl in ["A0", "A1", "A2", "B1", "B2", "C1", "C2"]:
        cur, target = targets.get(lvl, (0, 0))
        kept = by_level_keep[lvl]
        cut = by_level_cut[lvl]
        total_keep += kept
        total_cut += cut
        print(f"{lvl:<5} {cur:>5} {target:>6} {kept:>5} {cut:>5}")
    print(f"{'TOTAL':<5} {sum(c for c,_ in targets.values()):>5} "
          f"{sum(t for _,t in targets.values()):>6} {total_keep:>5} {total_cut:>5}")

    write_csv(Path(args.out), cut_rows)
    write_csv(Path(args.keep_out), keep_rows)
    print(f"\nWrote {len(cut_rows)} cut rows → {args.out}")
    print(f"Wrote {len(keep_rows)} keep rows → {args.keep_out}")


if __name__ == "__main__":
    sys.exit(main() or 0)
