"""Thin wrapper around `codex exec` for batch JSON-mode completions.

Codex CLI is a code-modifying agent, but it works fine as a chat-completion
backend if we tell it to output JSON only and pipe a single non-interactive
prompt in. We use minimal/low reasoning effort and read-only sandbox to
keep latency down and prevent any filesystem changes.
"""

from __future__ import annotations

import json
import re
import subprocess
import time
from dataclasses import dataclass
from typing import Optional


CODEX_BIN = "codex"


class CodexError(RuntimeError):
    pass


@dataclass
class CodexResult:
    text: str
    elapsed_s: float
    raw_stdout: str


def run(prompt: str, *, reasoning: str = "low", timeout: float = 240.0,
        cwd: Optional[str] = None, model: Optional[str] = None) -> CodexResult:
    """Run `codex exec` non-interactively. Returns the assistant's last text block.

    The codex stdout interleaves headers, mcp warnings, the user prompt echo,
    a `codex` tag line, the assistant text, then `tokens used`. We strip
    everything except the assistant block.
    """
    args = [
        CODEX_BIN, "exec",
        "--sandbox", "read-only",
        "--skip-git-repo-check",
        "-c", f"model_reasoning_effort={reasoning}",
    ]
    if model:
        args += ["-c", f"model={json.dumps(model)}"]
    args.append(prompt)

    t0 = time.monotonic()
    proc = subprocess.run(
        args,
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=timeout,
        # CRITICAL: `codex exec` blocks on "Reading additional input from
        # stdin..." unless stdin is closed. Without this it hangs forever in
        # any non-interactive or threaded context.
        stdin=subprocess.DEVNULL,
    )
    elapsed = time.monotonic() - t0
    if proc.returncode != 0:
        raise CodexError(f"codex exited {proc.returncode}: {proc.stderr[-500:]}")

    text = _extract_assistant_text(proc.stdout)
    return CodexResult(text=text, elapsed_s=elapsed, raw_stdout=proc.stdout)


_ASSISTANT_RE = re.compile(
    r"\ncodex\n(?P<body>.*?)(?=\n(?:tokens used|user|codex)\n|\Z)",
    re.DOTALL,
)


def _extract_assistant_text(stdout: str) -> str:
    matches = list(_ASSISTANT_RE.finditer(stdout))
    if not matches:
        # Fall back: try stripping the tail printed twice by codex.
        return stdout.strip()
    return matches[-1].group("body").strip()


def run_json(prompt: str, **kwargs) -> object:
    """Run codex and parse the assistant's reply as JSON.

    Strips ```json ... ``` fences if present, and only takes the first
    JSON object/array seen.
    """
    result = run(prompt, **kwargs)
    return parse_json_relaxed(result.text)


def parse_json_relaxed(text: str) -> object:
    """Parse the FIRST JSON value in text. Tolerates code fences and trailing junk."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```\s*$", "", text)
        text = text.strip()
    # Find the first {...} or [...] block at the top level using a balanced scan.
    start = -1
    opener = None
    for i, ch in enumerate(text):
        if ch in "{[":
            start = i
            opener = ch
            break
    if start == -1:
        raise json.JSONDecodeError("no JSON object/array found", text, 0)
    closer = "}" if opener == "{" else "]"
    decoder = json.JSONDecoder()
    obj, end = decoder.raw_decode(text[start:])
    return obj
