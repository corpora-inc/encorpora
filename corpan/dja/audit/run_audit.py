#!/usr/bin/env python3
"""Score every English entry in db.sqlite3 with codex CLI for the prune audit.

Standalone: uses raw sqlite3 + the codex CLI. No Django/venv needed.

Output: append-only JSONL at audit/pass2_scores.jsonl, one row per entry.
Resumable: re-running skips entries already scored.

Smart batching: sorts within each CEFR level by a normalized lexical
signature (first 4 words) so near-duplicates cluster and the LLM can
flag suspected_dup_of cross-references inside a batch.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import sqlite3
import sys
import threading
import time
from pathlib import Path

# Allow importing cor.utils.codex / prune_prompts without Django.
HERE = Path(__file__).resolve().parent
DJA_ROOT = HERE.parent
sys.path.insert(0, str(DJA_ROOT))

from cor.utils import codex  # noqa: E402
from cor.utils.prune_prompts import PRUNE_SYSTEM_PROMPT, PRUNE_USER_TEMPLATE  # noqa: E402

DB_PATH = DJA_ROOT / "db.sqlite3"
SCORES_PATH = HERE / "pass2_scores.jsonl"
ERRORS_PATH = HERE / "pass2_errors.jsonl"

_word_re = re.compile(r"[a-z0-9]+")
_WRITE_LOCK = threading.Lock()


def lex_signature(text: str, n_words: int = 4) -> str:
    return " ".join(_word_re.findall(text.lower())[:n_words])


def load_existing_scored_ids(path: Path) -> set[int]:
    if not path.exists():
        return set()
    ids: set[int] = set()
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            ids.add(int(row["id"]))
    return ids


def fetch_entries(con: sqlite3.Connection, skip_ids: set[int]) -> list[dict]:
    """Return list of {id, en_text, level, domain} for un-scored entries."""
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
    rows = []
    for eid, en_text, level, domain in cur.fetchall():
        if eid in skip_ids:
            continue
        rows.append(
            {"id": eid, "en_text": en_text, "level": level, "domain": domain}
        )
    return rows


def make_batches(rows: list[dict], batch_size: int) -> list[list[dict]]:
    rows_sorted = sorted(
        rows,
        key=lambda r: (r["level"], lex_signature(r["en_text"]), r["id"]),
    )
    return [rows_sorted[i : i + batch_size] for i in range(0, len(rows_sorted), batch_size)]


def score_batch(batch: list[dict], reasoning: str, timeout: float) -> tuple[list[dict], str | None]:
    items = [{"id": r["id"], "text": r["en_text"], "level": r["level"]} for r in batch]
    user_msg = PRUNE_USER_TEMPLATE.format(items_json=json.dumps(items, ensure_ascii=False))
    full_prompt = PRUNE_SYSTEM_PROMPT + "\n\n" + user_msg
    try:
        parsed = codex.run_json(full_prompt, reasoning=reasoning, timeout=timeout)
    except Exception as exc:
        return [], f"{type(exc).__name__}: {exc}"
    if not isinstance(parsed, dict) or "scores" not in parsed:
        return [], f"unexpected shape: {str(parsed)[:200]}"
    return parsed["scores"], None


def append_jsonl(path: Path, rows) -> None:
    with _WRITE_LOCK:
        with path.open("a", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--batch-size", type=int, default=50)
    p.add_argument("--reasoning", default="low",
                   choices=["minimal", "low", "medium", "high", "xhigh"])
    p.add_argument("--workers", type=int, default=8)
    p.add_argument("--timeout", type=float, default=300.0)
    p.add_argument("--limit", type=int, default=0,
                   help="Cap number of batches (0 = all). For smoke testing.")
    p.add_argument("--levels", default="",
                   help="Comma-separated CEFR levels (default: all).")
    p.add_argument("--db", default=str(DB_PATH))
    args = p.parse_args()

    levels_filter = {x.strip() for x in args.levels.split(",") if x.strip()}

    HERE.mkdir(parents=True, exist_ok=True)

    already = load_existing_scored_ids(SCORES_PATH)
    print(f"Already scored: {len(already)}")

    con = sqlite3.connect(args.db)
    rows = fetch_entries(con, already)
    con.close()

    if levels_filter:
        rows = [r for r in rows if r["level"] in levels_filter]
    print(f"To score: {len(rows)}")
    if not rows:
        return 0

    batches = make_batches(rows, args.batch_size)
    if args.limit:
        batches = batches[: args.limit]
    print(
        f"{len(batches)} batches × ≤{args.batch_size} = ≤{len(batches)*args.batch_size} entries; "
        f"workers={args.workers}, reasoning={args.reasoning}"
    )

    n_done = 0
    n_failed = 0
    n_scored = 0
    t0 = time.monotonic()

    def _work(batch):
        scores, err = score_batch(batch, reasoning=args.reasoning, timeout=args.timeout)
        return batch, scores, err

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = [ex.submit(_work, b) for b in batches]
        for fut in concurrent.futures.as_completed(futures):
            batch, scores, err = fut.result()
            if err:
                n_failed += 1
                sys.stderr.write(f"BATCH ERROR n={len(batch)}: {err}\n")
                append_jsonl(ERRORS_PATH, [{"ids": [r["id"] for r in batch], "error": err}])
            else:
                sent_ids = {r["id"] for r in batch}
                valid = [s for s in scores if s.get("id") in sent_ids]
                append_jsonl(SCORES_PATH, valid)
                n_scored += len(valid)
            n_done += 1
            if n_done % 5 == 0 or n_done == len(batches):
                elapsed = time.monotonic() - t0
                rate = n_scored / max(elapsed, 0.01)
                eta = (len(batches) - n_done) * (elapsed / max(n_done, 1))
                print(
                    f"[{n_done}/{len(batches)}] scored={n_scored} failed={n_failed} "
                    f"elapsed={elapsed:.0f}s rate={rate:.1f}/s eta={eta:.0f}s",
                    flush=True,
                )

    elapsed = time.monotonic() - t0
    print(
        f"DONE in {elapsed:.0f}s. batches: ok={n_done-n_failed} failed={n_failed} "
        f"rows scored: {n_scored}"
    )
    return 0 if n_failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
