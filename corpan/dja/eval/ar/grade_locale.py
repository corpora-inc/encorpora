#!/usr/bin/env python3
"""Strong-model Arabic localization grader.

Grades a translated locale JSON against its English source, key by key, using
`codex exec` (GPT-5.x) as the judge — NOT weak string-similarity metrics.
See memory note `codex-cli-llm-judge`.

Rubric (each 1-5, plus a free-text fix when below threshold):
  - fluency        : reads as natural, idiomatic Arabic to a native speaker
  - accuracy       : faithfully conveys the English source meaning
  - register       : Modern Standard Arabic, polite/neutral, learner-appropriate
  - terminology    : consistent app vocabulary (one word per concept)
  - rtl_safety     : no Latin letters welded into Arabic words, {{placeholders}}
                     preserved verbatim, no direction-breaking punctuation

Usage:
  python grade_locale.py \
      --source ../../../corpan-app/public/locales/en/common.json \
      --target ../../../corpan-app/public/locales/ar/common.json \
      --lang ar --out report.ar.json [--batch 30] [--workers 3] [--limit N]

Also grades a flat pack strings file (no English source) with --no-source:
  python grade_locale.py --target some/ar.json --lang ar --no-source --out r.json

The report lists every key the judge scored <= --threshold (default 4) on any
dimension, or flagged for rtl_safety, with the judge's suggested fix.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# Reuse the project's codex wrapper (handles codex's noisy stdout + JSON parse).
_HERE = Path(__file__).resolve()
_DJA = _HERE.parents[2]  # .../corpan/dja
sys.path.insert(0, str(_DJA))
from cor.utils import codex  # noqa: E402

# Brand tokens that are intentionally left in Latin script — the judge should
# NOT flag these as untranslated. Keep in sync with the brand-token policy.
BRAND_TOKENS = [
    "Corpán", "Corpanista", "Corpanistas", "Corpán Plus", "GitHub", "YouTube",
    "Instagram", "Free2z", "encorpora.io", "Apple", "Google", "Play Store",
    "App Store", "Samsung", "Mac", "iOS", "Android", "Windows", "TTS",
    "Premium", "Enhanced", "@corpanapp", "Apple ID", "Google Play",
]


def flatten(obj, prefix=""):
    """Flatten nested dict to {dotted.key: leaf_string}. Skips non-strings."""
    out = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            out.update(flatten(v, f"{prefix}.{k}" if prefix else k))
    elif isinstance(obj, str):
        out[prefix] = obj
    return out


SYSTEM = """You are a senior Arabic (Modern Standard Arabic) localization \
reviewer for a language-learning mobile app called Corpán. You are a native \
Arabic speaker and a professional translator. You grade UI-string translations \
strictly and fairly.

For EACH item you are given an English source and its Arabic translation \
(or, when no source is given, just the Arabic string to judge on its own \
merits). Grade each dimension from 1 (broken/unintelligible) to 5 (perfect, \
publishable). Be exacting: a 5 means a native speaker would never blink.

Dimensions:
- fluency: natural, idiomatic Arabic; correct grammar and morphology.
- accuracy: conveys the English meaning faithfully (skip if no source).
- register: Modern Standard Arabic; polite, neutral, modern; suitable for an \
A1-B1 learner audience; not stiff, not slangy.
- terminology: app vocabulary is consistent and conventional (e.g. one word \
for "stack", one for "pack").
- rtl_safety: CRITICAL. Score 1 if Latin letters are welded inside an Arabic \
word (e.g. "بوكmål"), if a {{placeholder}} from the source is missing/renamed, \
or if punctuation/parentheses would render backwards in an RTL run. Score 5 if \
clean. Embedded brand tokens in Latin (Corpán, GitHub, iOS, TTS, Premium, …) \
are INTENTIONAL and must NOT lower any score.

Return ONLY a JSON array, one object per item, in the same order:
[{"key": "<key>", "fluency": n, "accuracy": n, "register": n, \
"terminology": n, "rtl_safety": n, "verdict": "ok"|"minor"|"bad", \
"issue": "<short problem, empty if ok>", "fix": "<corrected Arabic, empty if ok>"}]
No prose, no code fences."""


def build_prompt(batch, with_source):
    lines = [SYSTEM, "", f"Brand tokens (do not flag): {', '.join(BRAND_TOKENS)}",
             "", "Items:"]
    for key, en, ar in batch:
        if with_source:
            lines.append(json.dumps(
                {"key": key, "english": en, "arabic": ar}, ensure_ascii=False))
        else:
            lines.append(json.dumps(
                {"key": key, "arabic": ar}, ensure_ascii=False))
    return "\n".join(lines)


def grade_batch(batch, with_source, reasoning):
    prompt = build_prompt(batch, with_source)
    result = codex.run_json(prompt, reasoning=reasoning, timeout=600.0)
    if not isinstance(result, list):
        raise ValueError(f"expected list, got {type(result)}")
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", help="English source JSON (omit with --no-source)")
    ap.add_argument("--target", required=True, help="translated JSON to grade")
    ap.add_argument("--lang", default="ar")
    ap.add_argument("--out", required=True)
    ap.add_argument("--batch", type=int, default=30)
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--threshold", type=int, default=4,
                    help="flag any dimension <= this")
    ap.add_argument("--limit", type=int, default=0, help="grade only first N keys")
    ap.add_argument("--no-source", action="store_true")
    ap.add_argument("--reasoning", default="high")
    args = ap.parse_args()

    with_source = not args.no_source
    target = flatten(json.loads(Path(args.target).read_text(encoding="utf-8")))
    source = {}
    if with_source:
        source = flatten(json.loads(Path(args.source).read_text(encoding="utf-8")))

    # Skip the schema pointer; grade everything else.
    keys = [k for k in target if k != "$schema"]
    if args.limit:
        keys = keys[: args.limit]

    items = [(k, source.get(k, ""), target[k]) for k in keys]
    batches = [items[i:i + args.batch] for i in range(0, len(items), args.batch)]
    print(f"Grading {len(items)} keys in {len(batches)} batches "
          f"({args.workers} workers, reasoning={args.reasoning})…", flush=True)

    graded = {}
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(grade_batch, b, with_source, args.reasoning): bi
                for bi, b in enumerate(batches)}
        for fut in as_completed(futs):
            bi = futs[fut]
            try:
                for row in fut.result():
                    graded[row["key"]] = row
                print(f"  batch {bi+1}/{len(batches)} ✓", flush=True)
            except Exception as e:  # noisy, not silent
                print(f"  batch {bi+1}/{len(batches)} FAILED: {e}",
                      file=sys.stderr, flush=True)

    dims = ["fluency", "accuracy", "register", "terminology", "rtl_safety"]
    flagged = []
    for k in keys:
        row = graded.get(k)
        if not row:
            flagged.append({"key": k, "issue": "NOT GRADED (batch failed)",
                            "arabic": target[k]})
            continue
        low = [d for d in dims if isinstance(row.get(d), int)
               and row[d] <= args.threshold and (with_source or d != "accuracy")]
        if low or row.get("verdict") == "bad" or row.get("rtl_safety", 5) <= 2:
            flagged.append({
                "key": k, "english": source.get(k, ""), "arabic": target[k],
                "scores": {d: row.get(d) for d in dims},
                "verdict": row.get("verdict"), "issue": row.get("issue", ""),
                "fix": row.get("fix", ""),
            })

    # Aggregate medians for a quality headline.
    def median(vals):
        vals = sorted(v for v in vals if isinstance(v, int))
        return vals[len(vals) // 2] if vals else None

    medians = {d: median([graded[k].get(d) for k in graded]) for d in dims}
    report = {
        "lang": args.lang, "target": args.target, "graded": len(graded),
        "total": len(keys), "medians": medians,
        "flagged_count": len(flagged), "flagged": flagged,
    }
    Path(args.out).write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nMedians: {medians}")
    print(f"Flagged {len(flagged)}/{len(keys)} keys → {args.out}")


if __name__ == "__main__":
    main()
