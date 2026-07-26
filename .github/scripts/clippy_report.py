#!/usr/bin/env python3
"""Render `cargo --message-format=json` diagnostics and count the unique ones.

Why not parse cargo's own human summary: it prints

    warning: `corpan` (lib) generated 2 warnings (1 duplicate)
    warning: `corpan` (lib test) generated 2 warnings (1 duplicate)

for `--all-targets`, tagging BOTH lines as containing duplicates. Summing them
double-counts; dropping every line that says "duplicate" counts zero. Neither is
the number a human wants. So: read the structured stream, de-duplicate on the
diagnostic's own identity (lint code + span + text), and print that.

Usage:
    cargo clippy --message-format=json ... | clippy_report.py --count-file F

stdout of cargo is JSON; its stderr (progress, the final error summary) is left
alone and flows straight to the job log. This reads stdin to EOF — it must never
exit early, or cargo takes SIGPIPE and the pipeline returns 141.
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import IO


def diagnostic_key(message: dict) -> tuple:
    """Identity of a diagnostic, stable across the targets that re-emit it."""
    code = (message.get("code") or {}).get("code") or ""
    spans = message.get("spans") or []
    primary = next((s for s in spans if s.get("is_primary")), None)
    if primary is None:
        primary = spans[0] if spans else {}
    return (
        code,
        primary.get("file_name", ""),
        primary.get("line_start", 0),
        primary.get("column_start", 0),
        message.get("message", ""),
    )


def process(stream: IO[str], out: IO[str]) -> tuple[int, int]:
    """Print rendered diagnostics; return (unique warnings, unique errors)."""
    warnings: set[tuple] = set()
    errors: set[tuple] = set()
    printed: set[tuple] = set()

    for line in stream:
        line = line.strip()
        if not line or not line.startswith("{"):
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        if record.get("reason") != "compiler-message":
            continue
        message = record.get("message") or {}
        level = message.get("level")
        if level not in ("warning", "error"):
            continue

        key = diagnostic_key(message)
        (errors if level == "error" else warnings).add(key)

        if key not in printed:
            printed.add(key)
            rendered = message.get("rendered")
            if rendered:
                out.write(rendered if rendered.endswith("\n") else rendered + "\n")

    return len(warnings), len(errors)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--count-file",
        help="File to append the unique warning count to (one integer per line).",
    )
    parser.add_argument(
        "--label", default="", help="Prefix for the summary line, e.g. the crate path."
    )
    args = parser.parse_args(argv)

    warnings, errors = process(sys.stdin, sys.stdout)

    label = f"{args.label}: " if args.label else ""
    print(f"{label}{warnings} unique clippy warning(s), {errors} unique error(s)")

    if args.count_file:
        with open(args.count_file, "a", encoding="utf-8") as fh:
            fh.write(f"{warnings}\n")

    # Always 0: the compile verdict is cargo's exit code, which `pipefail`
    # propagates. Failing here too would report the same failure twice and
    # would make a lint warning look like a build break.
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
