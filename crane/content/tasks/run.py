"""Generate, verify and write crane content.

    python tasks/run.py <task> [--limit N] [--only id1,id2] [--concurrency 4] [--write-only]

Tasks: procedures, questions, answers, lessons, glossary. Each run:
  1. builds the inputs (grounded prompts) from blueprint.yaml and the eCFR index;
  2. generates what is not cached (stops cleanly at the weekly-usage ceiling);
  3. verifies every quote and citation deterministically (with typography repair);
  4. writes the verified output under crane/content/ with provenance per row.

Re-running is idempotent: cached outputs are reused, files are rewritten.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import common  # noqa: E402
import builders  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("task")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--only")
    ap.add_argument("--concurrency", type=int, default=4)
    ap.add_argument("--write-only", action="store_true", help="skip generation; write from cache")
    ap.add_argument("--model")
    a = ap.parse_args()
    task = common.Task(HERE / a.task)
    if a.model:
        task.model = a.model
    items = builders.INPUTS[a.task]()
    if a.only:
        keep = set(a.only.split(","))
        items = [i for i in items if i["input_id"] in keep]
    if a.limit:
        items = items[: a.limit]
    if not a.write_only:
        res = task.run(items, concurrency=min(a.concurrency, 4))
        print(json.dumps({k: v for k, v in res.items() if k != "failed"} | {"failed": len(res["failed"])}))
    stats = builders.WRITERS[a.task](task, builders.INPUTS[a.task]())
    print(json.dumps(stats, indent=1))


if __name__ == "__main__":
    main()
