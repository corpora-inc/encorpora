#!/usr/bin/env python3
"""Turn results/rows.jsonl into the ranked Phase-0 decision table + verdict.

Produces results/DECISION.md:
  1. Per-language winner table (lowest WER/CER among engines that ran, with
     a latency/RAM tiebreak nod and an Android NAR-preference note).
  2. Per-engine overall summary (mean error by script class, coverage count).
  3. THE NORTH-STAR ANSWER: of the languages tested, in how many does
     Qwen3-ASR-0.6B land within an acceptable margin of the best engine?
     A language "passes" for Qwen3 if its error rate ≤ PASS_ABS (absolute
     floor) OR ≤ best + PASS_MARGIN (close enough to the winner). If Qwen3
     passes >50 langs, it can be the default download tier.

This script reads ONLY the results file — it makes no model calls — so it's
safe to run repeatedly as the bake-off fills in.
"""

from __future__ import annotations

import json
import os
import statistics
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))

# A language "passes" for an engine if it's usable for known-target
# challenges + tolerable open dictation. These thresholds are deliberately
# conservative and DOCUMENTED so the verdict is auditable.
PASS_ABS = 0.25       # ≤25% WER/CER is independently usable
PASS_MARGIN = 0.05    # …or within 5 points of the best engine for that lang
# The north-star ("default download tier for >50 langs") is judged as a
# COVERAGE RATIO, not a raw count, because FLEURS only backs 50 of our 51/52
# (pa-Arab Shahmukhi has no corpus — keyboard-floor regardless). A raw ">50"
# gate could never pass on a 50-lang corpus. Qwen3 earns the default-tier
# title if it clears a strong MAJORITY of the langs it's tested on AND a
# healthy absolute floor — i.e. it really does cover "most of the gap."
PASS_RATIO = 0.90     # ≥90% of tested languages
PASS_FLOOR = 45       # …and at least this many in absolute terms


def _load_rows(path: str) -> list[dict]:
    if not os.path.exists(path):
        raise SystemExit(f"no results at {path} — run run_bakeoff.py first")
    rows = []
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def _valid(r: dict) -> bool:
    er = r.get("error_rate")
    return isinstance(er, (int, float)) and er == er  # not NaN


ENGINES = ["qwen3", "whisper", "parakeet", "sensevoice"]

# Human labels per tier/source for the report headings.
TIER_LABEL = {
    "fleurs": "Tier 1 — FLEURS (cross-language ranking — the decision gate)",
    "domain": "Tier 2 — Domain-matched (our real input shape)",
}
SOURCE_LABEL = {
    "fleurs": "FLEURS (native clean read-speech)",
    "corpan_tts": "Corpán phrases via TTS (domain-TEXT shape; clean, not accented)",
    "common_voice": "Common Voice (accented / L2-leaning natural speech)",
    "gold": "Gold — owner's real learner recordings (the truest signal)",
}


def _qwen_tally(rows: list[dict]) -> tuple[int, int]:
    """(passed, tested) for Qwen3 over a row subset, by the pass rule."""
    by_lang: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_lang[r["lang"]].append(r)
    passed = tested = 0
    for recs in by_lang.values():
        valid = {r["engine"]: r["error_rate"] for r in recs if _valid(r)}
        if "qwen3" not in valid:
            continue
        tested += 1
        best = min(valid.values())
        qv = valid["qwen3"]
        if qv <= PASS_ABS or qv <= best + PASS_MARGIN:
            passed += 1
    return passed, tested


def _per_lang_table(rows: list[dict]) -> list[str]:
    by_lang: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_lang[r["lang"]].append(r)
    out = ["| Lang | Name | Script | " + " | ".join(e.capitalize() for e in ENGINES)
           + " | Winner |", "|" + "---|" * (3 + len(ENGINES) + 1)]
    for code in sorted(by_lang):
        recs = by_lang[code]
        name, script = recs[0]["lang_name"], recs[0]["script"]
        valid = {r["engine"]: r["error_rate"] for r in recs if _valid(r)}
        best_engine = min(valid, key=valid.get) if valid else None
        cells = []
        for eng in ENGINES:
            if eng in valid:
                cells.append(f"{valid[eng]:.2f}{'*' if eng == best_engine else ''}")
            else:
                cells.append("✗" if any(r["engine"] == eng for r in recs) else "—")
        winner = f"**{best_engine}**" if best_engine else "—"
        out.append(f"| {code} | {name} | {script} | " + " | ".join(cells)
                   + f" | {winner} |")
    return out


def _per_engine_summary(rows: list[dict]) -> list[str]:
    def cell(vals, fmt, agg):
        return format(agg(vals), fmt) if vals else "—"
    by_eng: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        if _valid(r):
            by_eng[r["engine"]].append(r)
    out = ["| Engine | Langs | Mean err (spaced) | Mean err (CJK/Thai) | "
           "Median latency s | Peak RSS MB |", "|---|---|---|---|---|---|"]
    for eng in ENGINES:
        recs = by_eng.get(eng, [])
        if not recs:
            out.append(f"| {eng} | 0 | — | — | — | — |")
            continue
        spaced = [r["error_rate"] for r in recs if r["script"] in ("spaced", "rtl")]
        cjk = [r["error_rate"] for r in recs if r["script"] in ("cjk", "thai")]
        lats = [r["median_latency_s"] for r in recs
                if isinstance(r["median_latency_s"], (int, float))
                and r["median_latency_s"] == r["median_latency_s"]]
        rss = [r["peak_rss_mb"] for r in recs
               if isinstance(r["peak_rss_mb"], (int, float))
               and r["peak_rss_mb"] == r["peak_rss_mb"]]
        out.append(
            f"| {eng} | {len(recs)} | {cell(spaced, '.3f', statistics.fmean)} | "
            f"{cell(cjk, '.3f', statistics.fmean)} | "
            f"{cell(lats, '.2f', statistics.median)} | {cell(rss, '.0f', max)} |"
        )
    return out


def build(rows: list[dict]) -> str:
    lines: list[str] = []
    lines.append("# Phase-0 ASR Bake-off — Decision Table\n")
    lines.append("_From results/rows.jsonl. Desktop accuracy; device latency/RAM "
                 "+ co-resident-with-4B in device/RUNBOOK.md._\n")
    lines.append("Lower error is better — WER (spaced/RTL) or CER (CJK/Thai). "
                 "`*` = per-language winner. Methodology: FLEURS RANKS the "
                 "models; the domain tier VALIDATES the winner survives our real "
                 "input (a learner saying a short phrase on a phone mic). The "
                 "winner must clear BOTH.\n")

    tiers_present = [t for t in ("fleurs", "domain")
                     if any(r.get("tier", "fleurs") == t for r in rows)]
    sources_present = []
    for r in rows:
        s = r.get("source", "fleurs")
        if s not in sources_present:
            sources_present.append(s)

    # One section per source, grouped under its tier heading.
    for tier in tiers_present:
        lines.append(f"\n## {TIER_LABEL.get(tier, tier)}\n")
        tier_sources = [s for s in sources_present
                        if any(r.get("source") == s and r.get("tier", "fleurs") == tier
                               for r in rows)]
        for source in tier_sources:
            srows = [r for r in rows if r.get("source", "fleurs") == source]
            lines.append(f"\n### {SOURCE_LABEL.get(source, source)}\n")
            lines.extend(_per_lang_table(srows))
            lines.append("")
            lines.extend(_per_engine_summary(srows))

    # --- north-star verdict: Qwen3 must clear BOTH tiers ---
    lines.append("\n## North-star verdict\n")
    lines.append(
        "**Question:** does Qwen3-ASR-0.6B transcribe enough of our ~50 langs, "
        "ON OUR REAL INPUT, to be Corpán's default download tier?\n"
    )
    lines.append(
        f"Pass rule (per lang): Qwen3 error ≤ {PASS_ABS:.0%} OR within "
        f"{PASS_MARGIN:.0%} of the best engine. Default-tier title requires "
        f"≥{PASS_RATIO:.0%} AND ≥{PASS_FLOOR} langs — **in EVERY tier evaluated** "
        "(FLEURS ranks; domain must confirm it holds on our shape).\n"
    )
    fleurs_rows = [r for r in rows if r.get("tier", "fleurs") == "fleurs"]
    domain_rows = [r for r in rows if r.get("tier") == "domain"]
    tiers_checked = []
    overall_pass = True
    for label, trows in (("FLEURS", fleurs_rows), ("domain", domain_rows)):
        if not trows:
            continue
        p, t = _qwen_tally(trows)
        ratio = (p / t) if t else 0.0
        clears = t > 0 and ratio >= PASS_RATIO and p >= PASS_FLOOR
        overall_pass = overall_pass and clears
        tiers_checked.append((label, p, t, ratio, clears))
        lines.append(f"- **{label}**: Qwen3 passed **{p}/{t}** ({ratio:.0%}) — "
                     f"{'clears' if clears else 'BELOW'} the bar.\n")

    if not tiers_checked:
        verdict = "INCONCLUSIVE — no Qwen3 rows yet. Run the bake-off."
    elif len(tiers_checked) == 1:
        label, p, t, ratio, clears = tiers_checked[0]
        verdict = (
            (f"**PRELIMINARY {'PASS' if clears else 'FAIL'}** on the {label} tier "
             f"only ({p}/{t}, {ratio:.0%}). ")
            + ("Run the DOMAIN tier (--tiers fleurs,domain) before declaring Qwen3 "
               "the default — FLEURS alone doesn't prove it survives learner/phone "
               "input." if label == "FLEURS" else
               "Add the FLEURS tier for the cross-language ranking.")
        )
    elif overall_pass:
        verdict = ("**YES** — Qwen3-ASR-0.6B clears the bar on BOTH FLEURS and the "
                   "domain tier → default download tier. Whisper-q5 stays the "
                   "non-Latin/Indic safety net; Parakeet/SenseVoice optional in "
                   "their lanes.")
    else:
        weak = ", ".join(l for l, *_x, c in tiers_checked if not c)
        verdict = (f"**NOT YET / NO** — Qwen3 falls below the bar on: {weak}. "
                   "FLEURS ranking may flatter it; it must also hold on our real "
                   "input. Whisper-q5 stays the broad default; ship Qwen3 only "
                   "where it wins both tiers. Re-check close calls with more "
                   "--samples + the gold recordings.")
    lines.append(f"\n> {verdict}\n")
    return "\n".join(lines)


def main() -> None:
    rows = _load_rows(os.path.join(HERE, "results", "rows.jsonl"))
    md = build(rows)
    out = os.path.join(HERE, "results", "DECISION.md")
    with open(out, "w", encoding="utf-8") as f:
        f.write(md)
    print(md)
    print(f"\nWrote {out}")


if __name__ == "__main__":
    main()
