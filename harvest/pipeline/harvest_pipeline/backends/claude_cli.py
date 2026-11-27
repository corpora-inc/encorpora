"""Headless Claude Code with minimal overhead (about 1.1k tokens per call).

Runs from an empty directory with no settings, MCP, slash commands, tools or session files, and
asks for structured output against the task's JSON schema. The usage guard reads the seven-day
usage percentage the statusline writes and stops the run above a threshold.
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

from .base import Backend, BackendError, Request, Response, UsageLimitReached


class ClaudeCliBackend(Backend):
    name = "claude-cli"

    def __init__(self, model: str = "sonnet", binary: str = "claude", workdir: str = "/tmp/harvest-empty",
                 timeout: int = 900, max_week_pct: float | None = 60.0,
                 rate_limits_file: str | None = None, effort: str | None = None, **options):
        super().__init__(model, **options)
        self.binary = binary
        self.workdir = Path(workdir)
        self.timeout = timeout
        self.max_week_pct = max_week_pct
        cfg = os.environ.get("CLAUDE_CONFIG_DIR", str(Path.home() / ".claude"))
        self.rate_limits_file = Path(rate_limits_file or Path(cfg) / "rate-limits.json")
        self.effort = effort

    def check_guard(self) -> None:
        if self.max_week_pct is None or not self.rate_limits_file.exists():
            return
        try:
            pct = json.loads(self.rate_limits_file.read_text())["seven_day"]["used_percentage"]
        except (ValueError, KeyError, TypeError):
            return
        if pct is not None and float(pct) > self.max_week_pct:
            raise UsageLimitReached(f"seven-day usage {pct}% > {self.max_week_pct}%; stopping bulk generation")

    def command(self, req: Request) -> list[str]:
        cmd = [self.binary, "-p", "--setting-sources", "", "--strict-mcp-config", "--disable-slash-commands",
               "--tools", "", "--no-session-persistence", "--model", self.model,
               "--system-prompt", req.system, "--json-schema", json.dumps(req.schema),
               "--output-format", "json"]
        if self.effort:
            cmd += ["--effort", self.effort]
        return cmd

    def complete(self, req: Request) -> Response:
        self.workdir.mkdir(parents=True, exist_ok=True)
        try:
            proc = subprocess.run(self.command(req), input=req.prompt, capture_output=True, text=True,
                                  cwd=self.workdir, timeout=self.timeout)
        except subprocess.TimeoutExpired:
            raise BackendError(f"claude timed out after {self.timeout}s")
        except FileNotFoundError:
            raise BackendError(f"{self.binary} not found", retryable=False)
        try:
            data = json.loads(proc.stdout)
        except json.JSONDecodeError:
            raise BackendError(f"claude exit {proc.returncode}: {proc.stderr.strip()[:400] or proc.stdout[:400]}")
        if data.get("is_error"):
            raise BackendError(f"claude error: {str(data.get('result'))[:400]}")
        out = data.get("structured_output")
        if not isinstance(out, dict):
            raise BackendError("claude returned no structured_output")
        mu = data.get("modelUsage") or {}
        model_id = max(mu, key=lambda k: mu[k].get("outputTokens", 0)) if mu else self.model
        usage = {
            "input_tokens": sum(v.get("inputTokens", 0) + v.get("cacheReadInputTokens", 0)
                                + v.get("cacheCreationInputTokens", 0) for v in mu.values()),
            "output_tokens": sum(v.get("outputTokens", 0) for v in mu.values()),
            "cost_usd": float(data.get("total_cost_usd") or 0.0),
        }
        return Response(output=out, model_id=model_id, usage=usage)
