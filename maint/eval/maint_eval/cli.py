"""maint-eval command line: `python -m maint_eval <cmd>` from the project virtual environment (see README)."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import ledger, packs, sets
from .engine import DEFAULT_URL, Engine


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="maint_eval")
    ap.add_argument("--engine", default=DEFAULT_URL)
    ap.add_argument("--root", type=Path, default=packs.DEFAULT_ROOT)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("gen-t1")
    sub.add_parser("gen-t2")
    sub.add_parser("gen-t3")
    s = sub.add_parser("split")
    s.add_argument("task")
    r = sub.add_parser("review")
    r.add_argument("task")
    r.add_argument("--n", type=int, default=240)
    sub.add_parser("overlap")
    sub.add_parser("ledger")
    m = sub.add_parser("manifest")
    m.add_argument("task")
    run = sub.add_parser("run")
    run.add_argument("task")
    run.add_argument("--part", default="dev")
    run.add_argument("--system", required=True, help="engine | claude:sonnet | local:<name> | alone:<sonnet|opus>")
    run.add_argument("--endpoint", default="http://127.0.0.1:8090/v1")
    run.add_argument("--think", default="off")
    run.add_argument("--temp", type=float, default=0.0)
    run.add_argument("--seed", type=int, default=0)
    run.add_argument("--k", type=int, default=5)
    run.add_argument("--limit", type=int, default=0)
    run.add_argument("--subset", default="", help="file of item ids")
    run.add_argument("--variant", default="default")
    run.add_argument("--jobs", type=int, default=1)
    run.add_argument("--rank", default="engine", help="engine | a rank.py spec (offline emulation)")
    run.add_argument("--ranking", default="", help="JSON: symptom.search ranking overrides for every call")
    run.add_argument("--dense", default="any", choices=["on", "off", "any"], help="assert the engine's dense state")
    run.add_argument("--out", type=Path, default=None)
    a = ap.parse_args(argv)
    eng = Engine(a.engine)

    if a.cmd == "gen-t1":
        from . import gen_t1
        items = gen_t1.generate(eng, a.root, sets.path("t1", "raw"))
        print(f"{len(items)} items -> {sets.path('t1', 'raw')}")
    elif a.cmd == "gen-t2":
        from . import gen_t2
        items = gen_t2.generate(eng, a.root, sets.path("t2", "raw"))
        print(f"{len(items)} items -> {sets.path('t2', 'raw')}")
    elif a.cmd == "gen-t3":
        from . import gen_t3
        items = gen_t3.generate(eng, a.root, sets.path("t3", "raw"))
        print(f"{len(items)} items -> {sets.path('t3', 'raw')}")
    elif a.cmd == "split":
        from .split import split_task
        dev, held = split_task(a.task)
        print(json.dumps({"dev": sets.manifest(sets.path(a.task, "dev")),
                          "heldout": sets.manifest(sets.path(a.task, "heldout"))}, indent=1))
    elif a.cmd == "review":
        from . import review
        print(json.dumps(review.run(eng, a.root, a.task, a.n), indent=1))
    elif a.cmd == "overlap":
        from . import overlap
        print(json.dumps(overlap.report(a.root), indent=1))
    elif a.cmd == "manifest":
        print(json.dumps({p: sets.manifest(sets.path(a.task, p)) for p in ("dev", "heldout")}, indent=1))
    elif a.cmd == "ledger":
        print(json.dumps(ledger.totals(), indent=1))
        print("claude tokens:", ledger.claude_tokens())
    elif a.cmd == "run":
        from . import runner
        res = runner.run(eng, a)
        print(json.dumps(res["summary"], indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
