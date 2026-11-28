"""Headless Claude through the `claude` CLI (print mode), the way harvest/eval and the pipeline call it.

Reuses `harvest_eval.backends.CLAUDE_FLAGS`: no tools, no settings, no MCP, no session files, run
from an empty directory. Only Opus (writing held-out items) and Sonnet (bulk) are allowed.
Every call is cached and ledgered; a token cap stops the run before it passes the agreed budget.
"""
from __future__ import annotations

import json
import os
import subprocess
import time

from harvest_eval.backends import CLAUDE_FLAGS

from . import ledger
from .paths import EMPTY_DIR

ALLOWED = {"opus", "sonnet"}
CAP = int(os.environ.get("MAINT_EVAL_CLAUDE_CAP", "3500000"))


class BudgetStop(RuntimeError):
    pass


def _usage(out: dict) -> dict:
    mu = out.get("modelUsage") or {}
    return {
        "input_tokens": sum(v.get("inputTokens", 0) + v.get("cacheReadInputTokens", 0)
                            + v.get("cacheCreationInputTokens", 0) for v in mu.values()),
        "output_tokens": sum(v.get("outputTokens", 0) for v in mu.values()),
        "reasoning_tokens": sum(v.get("thinkingTokens", 0) for v in mu.values()),
        "cost_usd": float(out.get("total_cost_usd") or 0.0),
    }


def call(system: str, prompt: str, model: str = "sonnet", schema: dict | None = None, tag: str = "",
         timeout: int = 900, effort: str | None = None, retries: int = 2) -> dict:
    """One cached call. Returns {"output": structured dict or text, "usage", "seconds", "model_id"}."""
    if model not in ALLOWED:
        raise ValueError(f"model {model!r} is not allowed here (opus or sonnet only)")
    payload = {"system": system, "prompt": prompt, "schema": schema, "effort": effort}

    def run() -> dict:
        used = ledger.claude_tokens()
        if used > CAP:
            raise BudgetStop(f"Claude tokens so far {used:,} exceed the cap {CAP:,}; stopping before the next call")
        cmd = ["claude", "-p", *CLAUDE_FLAGS, "--model", model, "--system-prompt", system,
               "--output-format", "json"]
        if schema is not None:
            cmd += ["--json-schema", json.dumps(schema)]
        if effort:
            cmd += ["--effort", effort]
        EMPTY_DIR.mkdir(parents=True, exist_ok=True)
        err = ""
        for attempt in range(retries + 1):
            t0 = time.perf_counter()
            try:
                p = subprocess.run(cmd, input=prompt, capture_output=True, text=True, cwd=EMPTY_DIR,
                                   timeout=timeout)
            except subprocess.TimeoutExpired:
                err = f"timeout after {timeout}s"
                continue
            secs = time.perf_counter() - t0
            try:
                out = json.loads(p.stdout)
            except json.JSONDecodeError:
                err = f"exit {p.returncode}: {p.stderr[-300:]} {p.stdout[-300:]}"
                time.sleep(3 * (attempt + 1))
                continue
            if out.get("is_error"):
                err = str(out.get("result"))[:400]
                time.sleep(3 * (attempt + 1))
                continue
            res = out.get("structured_output") if schema is not None else out.get("result", "")
            if schema is not None and not isinstance(res, dict):
                err = "no structured_output"
                continue
            mu = out.get("modelUsage") or {}
            mid = max(mu, key=lambda k: mu[k].get("outputTokens", 0)) if mu else model
            return {"ok": True, "output": res, "usage": _usage(out), "seconds": secs, "model_id": mid}
        raise RuntimeError(f"claude {model} failed: {err}")

    return ledger.cached("claude", f"claude:{model}", payload, run, tag=tag)
