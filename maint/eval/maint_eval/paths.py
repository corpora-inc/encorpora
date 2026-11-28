"""Where the harness keeps state outside the repository. Both locations come only from the environment:

  MAINT_EVAL_STATE    model-response cache, call ledger, per-run outputs, pinned pack snapshots
  MAINT_EVAL_HELDOUT  item files (dev, held-out, reviews); they never enter the repository
"""
from __future__ import annotations

import os
from pathlib import Path


def _required(name: str) -> Path:
    v = os.environ.get(name)
    if not v:
        raise SystemExit(f"{name} is not set: point it at a directory outside the repository")
    return Path(v).expanduser()


STATE = _required("MAINT_EVAL_STATE")
HELDOUT = _required("MAINT_EVAL_HELDOUT")
CACHE = STATE / "cache"          # model responses, keyed by input hash
LEDGER = STATE / "ledger.jsonl"  # one line per model call actually made (cache hits are not calls)
RUNS = STATE / "runs"            # per-run outputs
PACKS = STATE / "packs"          # pinned pack snapshots (packs.snapshot)
# The working directory for the Claude CLI: empty, so no project settings or files are read.
EMPTY_DIR = Path(os.environ.get("HARVEST_EVAL_EMPTY_DIR", "/tmp/harvest-empty"))

for p in (STATE, CACHE, RUNS, HELDOUT):
    p.mkdir(parents=True, exist_ok=True)
