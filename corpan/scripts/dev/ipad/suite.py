#!/usr/bin/env python3
"""
Corpán scenario SUITE runner — discover every `scenarios/*.json`, run each via
the existing scenario runner (`scenario.run`), and emit ONE combined
`runs/suite-<ts>/report.md` with a per-scenario pass/fail/warn roll-up plus a
link to each scenario's own report + run directory.

This is the autonomous-coverage entry point: one command walks the whole persona
library on the device and surfaces, in a single report, the issues a human would
flag — hard failures (missing asserts, off-screen primary buttons) and soft
warnings (untranslated screens, dead CTAs).

Usage:
  python3 suite.py                 # run every scenarios/*.json
  python3 suite.py --video         # honor pause_video reflection holds
  python3 suite.py --ts 20260530   # pin the suite timestamp (else strftime now)
  python3 suite.py --only id_english_beginner foo   # run a subset by name/stem

Same device prerequisites as scenario.py (Web Inspector + tunnel; see
ipad-debug-pipeline). Stdlib only — it just imports and calls scenario.run.
"""
from __future__ import annotations

import argparse
import sys
import time
import traceback
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import scenario  # noqa: E402  (local module, same dir)

SCN_DIR = HERE / "scenarios"


def discover(only: list[str] | None) -> list[Path]:
    paths = sorted(SCN_DIR.glob("*.json"))
    if only:
        wanted = set(only)
        paths = [p for p in paths if p.stem in wanted or p.name in wanted]
    return paths


def _rel(target: str, base: Path) -> str:
    """Best-effort relative link from the suite report to a scenario artifact."""
    try:
        return str(Path(target).resolve().relative_to(base.resolve()))
    except ValueError:
        return target


def run_suite(video: bool, ts: str, only: list[str] | None) -> int:
    paths = discover(only)
    suite_dir = HERE / "runs" / f"suite-{ts}"
    suite_dir.mkdir(parents=True, exist_ok=True)

    if not paths:
        msg = f"No scenarios matched in {SCN_DIR}"
        print(msg)
        (suite_dir / "report.md").write_text(f"# Suite run {ts}\n\n{msg}\n")
        return 1

    print(f"▶ suite {ts}  →  {suite_dir}  ({len(paths)} scenario(s))")
    results: list[dict] = []
    for p in paths:
        print(f"\n=== {p.stem} ===")
        try:
            res = scenario.run(p.resolve(), video)
        except Exception as exc:  # noisy, not silent — record + keep going
            traceback.print_exc()
            res = {
                "name": p.stem,
                "title": p.stem,
                "ui_lang": "?",
                "failures": 1,
                "warnings": 0,
                "passed": False,
                "report": "",
                "run_dir": "",
                "error": f"{type(exc).__name__}: {exc}",
            }
        results.append(res)

    n_pass = sum(1 for r in results if r["passed"])
    n_fail = len(results) - n_pass
    n_warn = sum(r["warnings"] for r in results)
    suite_ok = n_fail == 0

    lines: list[str] = [
        f"# Suite run {ts}",
        "",
        f"**{n_pass}/{len(results)} scenarios passed** · "
        f"{n_fail} failed · {n_warn} warning(s) total",
        "",
        f"Overall: {'✅ PASS' if suite_ok else '❌ FAIL'}",
        "",
        "| scenario | UI | result | failures | warnings | report |",
        "|----------|----|--------|----------|----------|--------|",
    ]
    for r in results:
        if r.get("error"):
            mark = "💥 ERROR"
        elif r["passed"]:
            mark = "✅ PASS"
        else:
            mark = "❌ FAIL"
        link = "—"
        if r.get("report"):
            link = f"[report.md]({_rel(r['report'], suite_dir)})"
        lines.append(
            f"| {r['name']} | `{r['ui_lang']}` | {mark} | "
            f"{r['failures']} | {r['warnings']} | {link} |"
        )

    # Per-scenario detail (errors + the run-dir path for screenshots).
    lines.append("")
    lines.append("## Details")
    for r in results:
        lines.append("")
        lines.append(f"### {r['title']}  (`{r['name']}`)")
        if r.get("error"):
            lines.append(f"- 💥 runner error: `{r['error']}`")
        lines.append(f"- failures: {r['failures']} · warnings: {r['warnings']}")
        if r.get("run_dir"):
            lines.append(f"- artifacts: `{r['run_dir']}`")
        if r.get("report"):
            lines.append(f"- report: [{_rel(r['report'], suite_dir)}]({_rel(r['report'], suite_dir)})")

    (suite_dir / "report.md").write_text("\n".join(lines) + "\n")
    summary = f"✅ suite PASS" if suite_ok else f"❌ suite FAIL ({n_fail} failed)"
    if n_warn:
        summary += f"  (⚠️ {n_warn} warning(s))"
    print(f"\n{summary}  →  {suite_dir / 'report.md'}")
    return 0 if suite_ok else 1


def main() -> None:
    ap = argparse.ArgumentParser(description="Run every scenarios/*.json and roll up one report.")
    ap.add_argument("--video", action="store_true", help="honor pause_video (reflection holds)")
    ap.add_argument("--ts", default=None, help="suite timestamp tag (default: strftime now)")
    ap.add_argument("--only", nargs="*", default=None, help="run only these scenario names/stems")
    args = ap.parse_args()
    ts = args.ts or time.strftime("%Y%m%d-%H%M%S")
    sys.exit(run_suite(args.video, ts, args.only))


if __name__ == "__main__":
    main()
