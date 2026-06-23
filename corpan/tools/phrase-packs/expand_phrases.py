#!/usr/bin/env python3
"""
Facet-aware authoring orchestrator for the v0.2.0 expansion.

For each requested pack:
  1. Compute per-pack canonical target shape (WIDE=505 / DEEP=808)
     minus existing-phrases shape  →  per-pack delta dict.
  2. Divide the delta across the pack's hand-written facets
     (from facets.py), proportional to the canonical level shape.
  3. For each facet: build a codex prompt with
       - voice anchor (from voice_anchors.py)
       - first 20 existing phrases as reference
       - full existing-english + already-queued-this-pack exclusion list
       - facet name + facet brief
       - per-facet delta target
       - house rules + quality bar
     Call codex CLI (read-only sandbox, parsed via codex.run_json).
     On 429 / timeout / repeated validation failure → fall back to
     Gemini 2.5 Flash on Vertex AI.
  4. Validate each facet's output against 7 gates; retry ≤2 times on
     fail with the failure annotated in the next prompt.
  5. After all facets land and pass: append to phrases.json, bump
     pack.json to 0.2.0, prepend a [0.2.0] CHANGELOG section.

Idempotent: re-running short-circuits if pack.json is already 0.2.0.

Usage:
  python expand_phrases.py --pack <pack-id>            # one pack
  python expand_phrases.py --tier WIDE                 # all 14 WIDE
  python expand_phrases.py --tier DEEP                 # all 10 DEEP
  python expand_phrases.py --all                       # all 24
  python expand_phrases.py --pack <id> --dry-run       # show prompts, no calls
  python expand_phrases.py --pack <id> --no-vertex-fallback
  python expand_phrases.py --pack <id> --workers 12    # parallel facets

Each pack runs its facets in parallel (default 8 in flight). Multiple
packs run sequentially at the top level (to avoid blowing past codex
Pro rate limits and Vertex quotas).
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import subprocess
import sys
import time
from collections import Counter
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Iterable

# Local modules
HERE = Path(__file__).parent.resolve()
sys.path.insert(0, str(HERE))

from voice_anchors import VOICE_ANCHORS
from facets import FACETS, TIER, CANONICAL_SHAPE, get_tier, get_facets, get_target_total

# Reuse Gemini/Vertex client + parser machinery
from gemini_translate import make_client as make_vertex_client

from google.genai import types as gtypes


# --------------------------------------------------------------------------
# Paths

def pack_dir_for(pack_id: str) -> Path:
    if pack_id == "phrase-botany-basics":
        return HERE / "example-botany"
    return HERE / pack_id


def pack_meta(pack_id: str) -> dict:
    return json.loads((pack_dir_for(pack_id) / "pack.json").read_text())


def pack_phrases(pack_id: str) -> list[dict]:
    return json.loads((pack_dir_for(pack_id) / "phrases.json").read_text())


# --------------------------------------------------------------------------
# Delta computation

LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"]


def compute_pack_delta(pack_id: str) -> dict[str, int]:
    """Per-pack delta dict {level: count_to_add}, floored at 0."""
    existing = Counter(p["level"] for p in pack_phrases(pack_id))
    canonical = CANONICAL_SHAPE[get_tier(pack_id)]
    return {L: max(0, canonical[L] - existing.get(L, 0)) for L in LEVELS}


def divide_delta_across_facets(pack_delta: dict[str, int],
                               n_facets: int) -> list[dict[str, int]]:
    """Split the pack-level delta across N facets as evenly as possible.
    Each facet gets ceil(delta[L]/N) for each level, then we trim the
    last facet to absorb rounding."""
    per = [{L: pack_delta[L] // n_facets for L in LEVELS} for _ in range(n_facets)]
    # Distribute the remainder round-robin
    for L in LEVELS:
        rem = pack_delta[L] - per[0][L] * n_facets
        for i in range(rem):
            per[i][L] += 1
    return per


# --------------------------------------------------------------------------
# Prompt construction

HOUSE_RULES = """\
HOUSE RULES (non-negotiable):
- NO em-dashes (—) or en-dashes (–). They sound like long pauses in TTS.
  Use commas, semicolons, periods, or rephrase.
- Each entry is a single complete English sentence with terminal
  punctuation (.!?).
- A0 = 3-6 words, simple present, very common vocab. ("I see a bird.")
- A1 = simple, present/past tense, everyday vocab, ≤10 words.
- A2 = compound sentences, some past/future, ~8-15 words.
- B1 = idiomatic, comfortable conversation, ~10-20 words.
- B2 = reflective, layered, ~12-25 words.
- C1 = essayistic, careful nuance, ~15-30 words.
- C2 = literary, multi-clause, can be 25-50+ words but must be earned.
- Stay 100% on the facet AND on the overall pack topic.
- No proper-noun-only entries; no song-lyric quotes; no recipes.
- Never write "I am Claude" / "as an AI" / any meta-reference.
"""

QUALITY_BAR = """\
QUALITY BAR:
A learner should read each phrase and think, "what a great phrase, wow."
- Specific over generic ("The mechanic charged me $40 less than the dealership"
  beats "Cars are expensive to fix").
- Concrete imagery preferred over abstract claims.
- Earned reflection at higher levels; never preachy or self-helpy.
- Avoid clichés ("at the end of the day", "moving forward", "literally" etc.).
- Pull from world-knowledge: real cuisines, real cities, real composers,
  real species — wherever it sharpens the phrase.
"""


def build_prompt(pack_id: str, meta: dict, voice: str, facet_name: str,
                 facet_brief: str, facet_delta: dict[str, int],
                 first20: list[str], exclusion: list[str],
                 retry_feedback: str | None = None) -> str:
    n_needed = sum(facet_delta.values())
    delta_str = ", ".join(f'"{L}": {n}' for L, n in facet_delta.items() if n > 0)

    first20_block = "\n".join(f"  - {p}" for p in first20)

    # Truncate exclusion list if huge — we only need to prevent obvious dupes.
    # Keep up to 400 entries with priority to most recent (typically the facet
    # outputs already queued for this pack).
    excl_sample = exclusion[-400:] if len(exclusion) > 400 else exclusion
    excl_block = "\n".join(f"  - {p}" for p in excl_sample)

    retry_block = ""
    if retry_feedback:
        retry_block = f"\nPRIOR ATTEMPT FAILED VALIDATION:\n{retry_feedback}\nFix these issues this time.\n"

    return f"""You are a professional language-learning content author. Generate phrases for a CEFR-leveled English phrase pack used by a multilingual learning app.

PACK: {meta['id']} ({meta.get('name', '?')})
PACK DESCRIPTION: {meta.get('description', '?')}
PACK TOPIC: {meta.get('topic', meta.get('name', '?'))}

PACK VOICE ANCHOR:
{voice}

FIRST 20 PHRASES OF THE PACK (this is the voice you must match):
{first20_block}

THIS BATCH IS FOCUSED ON ONE FACET OF THE TOPIC.
FACET: {facet_name}
FACET BRIEF: {facet_brief}

TARGET COUNT BY CEFR LEVEL (must hit each level closely):
{{{delta_str}}}
TOTAL NEEDED FOR THIS FACET: {n_needed}

{HOUSE_RULES}

{QUALITY_BAR}

DO NOT REPEAT OR PARAPHRASE ANY OF THESE EXISTING PHRASES
(the pack already contains these, and earlier facet batches added these):
{excl_block}
{retry_block}
OUTPUT FORMAT: a single JSON array of objects with `english` and `level` keys.
No prose, no markdown, no code fences — JUST the JSON array. Example:

[
  {{"english": "I see a bird.", "level": "A0"}},
  {{"english": "The garden birds visit our feeder every morning.", "level": "A2"}},
  ...
]

Output the JSON array now. Make it count.
"""


# --------------------------------------------------------------------------
# Validation

EM_DASH_RE = re.compile(r"[—–]")
TOKEN_RE = re.compile(r"\w+")
LENGTH_BOUNDS = {  # (min_words, max_words)
    "A0": (2, 7),
    "A1": (2, 12),
    "A2": (3, 18),
    "B1": (4, 25),
    "B2": (5, 30),
    "C1": (6, 45),
    "C2": (6, 80),
}


def tokens(s: str) -> set[str]:
    return {t.lower() for t in TOKEN_RE.findall(s)}


def jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b: return 0.0
    return len(a & b) / len(a | b)


@dataclass
class ValidationResult:
    ok: bool
    accepted: list[dict] = field(default_factory=list)
    rejected: list[tuple[dict, str]] = field(default_factory=list)
    fail_reasons: list[str] = field(default_factory=list)

    def feedback(self) -> str:
        bits = []
        bits.append(f"accepted {len(self.accepted)}, rejected {len(self.rejected)}")
        for reason in self.fail_reasons[:6]:
            bits.append(f"- {reason}")
        if self.rejected[:5]:
            bits.append("rejected examples:")
            for entry, why in self.rejected[:5]:
                bits.append(f"  · {entry.get('level')}: {entry.get('english')!r} — {why}")
        return "\n".join(bits)


def validate_batch(batch: list[dict], facet_delta: dict[str, int],
                   exclusion_tokens: list[set[str]],
                   exclusion_english: set[str]) -> ValidationResult:
    res = ValidationResult(ok=True)

    accepted_tokens: list[set[str]] = []
    accepted_english: set[str] = set()
    counts: Counter[str] = Counter()

    for entry in batch:
        if not isinstance(entry, dict) or "english" not in entry or "level" not in entry:
            res.rejected.append((entry, "BAD_SHAPE")); continue
        eng = str(entry["english"]).strip()
        lvl = str(entry["level"]).strip()
        if lvl not in LEVELS:
            res.rejected.append((entry, f"BAD_LEVEL:{lvl}")); continue
        if EM_DASH_RE.search(eng):
            res.rejected.append((entry, "EM_DASH")); continue
        if not eng.endswith((".", "!", "?")):
            res.rejected.append((entry, "NO_TERMINAL_PUNCT")); continue
        n_words = len(eng.split())
        lo, hi = LENGTH_BOUNDS[lvl]
        if n_words < lo or n_words > hi:
            res.rejected.append((entry, f"LENGTH_{n_words}w_not_in_{lo}-{hi}")); continue
        if eng in exclusion_english or eng in accepted_english:
            res.rejected.append((entry, "EXACT_DUPE")); continue
        toks = tokens(eng)
        is_near = False
        for ex_toks in exclusion_tokens[-1000:]:
            if jaccard(toks, ex_toks) > 0.75:
                is_near = True; break
        if not is_near:
            for ex_toks in accepted_tokens:
                if jaccard(toks, ex_toks) > 0.75:
                    is_near = True; break
        if is_near:
            res.rejected.append((entry, "NEAR_DUPE_JACCARD>0.75")); continue

        res.accepted.append({"english": eng, "level": lvl})
        accepted_english.add(eng)
        accepted_tokens.append(toks)
        counts[lvl] += 1

    # Histogram check: accept ≥80% of each level target (within ±25% tolerance)
    short = []
    for L, target in facet_delta.items():
        if target == 0: continue
        got = counts.get(L, 0)
        floor = max(1, int(target * 0.75))
        if got < floor:
            short.append(f"{L}: got {got}, need ≥{floor} (target {target})")
    if short:
        res.ok = False
        res.fail_reasons.append("LEVEL_HISTOGRAM_SHORT: " + "; ".join(short))

    total_target = sum(facet_delta.values())
    if len(res.accepted) < int(total_target * 0.8):
        res.ok = False
        res.fail_reasons.append(
            f"TOTAL_SHORT: accepted {len(res.accepted)}, need ≥{int(total_target*0.8)} of {total_target}"
        )

    return res


# --------------------------------------------------------------------------
# Backends

@dataclass
class BackendResult:
    text: str
    elapsed_s: float
    backend: str
    error: str | None = None


def call_codex(prompt: str, timeout: float = 600.0) -> BackendResult:
    args = [
        "codex", "exec",
        "--sandbox", "read-only",
        "--skip-git-repo-check",
        "-c", "model_reasoning_effort=medium",
        prompt,
    ]
    t0 = time.monotonic()
    try:
        proc = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return BackendResult(text="", elapsed_s=timeout, backend="codex", error="TIMEOUT")

    elapsed = time.monotonic() - t0
    if proc.returncode != 0:
        return BackendResult(text="", elapsed_s=elapsed, backend="codex",
                             error=f"codex rc={proc.returncode}: {proc.stderr[-300:]}")

    # Extract assistant body
    m = list(re.finditer(r"\ncodex\n(?P<body>.*?)(?=\n(?:tokens used|user|codex)\n|\Z)",
                          proc.stdout, re.DOTALL))
    text = m[-1].group("body").strip() if m else proc.stdout.strip()

    if not text:
        return BackendResult(text="", elapsed_s=elapsed, backend="codex", error="EMPTY")
    if "rate limit" in proc.stdout.lower() or "rate_limit" in proc.stdout.lower():
        return BackendResult(text=text, elapsed_s=elapsed, backend="codex", error="RATE_LIMIT")

    return BackendResult(text=text, elapsed_s=elapsed, backend="codex")


_vertex_client = None


def call_vertex(prompt: str, timeout: float = 300.0) -> BackendResult:
    global _vertex_client
    if _vertex_client is None:
        _vertex_client = make_vertex_client(vertex=True)
    t0 = time.monotonic()
    try:
        resp = _vertex_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=gtypes.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=16384,
                response_mime_type="application/json",
            ),
        )
    except Exception as e:
        return BackendResult(text="", elapsed_s=time.monotonic()-t0,
                             backend="vertex", error=f"VERTEX_ERR:{type(e).__name__}:{str(e)[:200]}")
    elapsed = time.monotonic() - t0
    text = (resp.text or "").strip()
    return BackendResult(text=text, elapsed_s=elapsed, backend="vertex",
                         error=None if text else "EMPTY")


def parse_json_relaxed(text: str):
    """Find the first JSON object/array in text and parse it."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```\s*$", "", text)
        text = text.strip()
    start = -1
    opener = None
    for i, ch in enumerate(text):
        if ch in "{[":
            start = i; opener = ch; break
    if start == -1:
        raise ValueError("no JSON found in response")
    decoder = json.JSONDecoder()
    obj, _ = decoder.raw_decode(text[start:])
    return obj


# --------------------------------------------------------------------------
# Per-facet orchestration

@dataclass
class FacetResult:
    pack_id: str
    facet_name: str
    delta: dict[str, int]
    accepted: list[dict]
    rejected: list[tuple[dict, str]]
    rounds: list[str]  # per-attempt notes
    final_backend: str
    final_status: str


def run_facet(pack_id: str, meta: dict, voice: str,
              facet_name: str, facet_brief: str, facet_delta: dict[str, int],
              first20: list[str], exclusion: list[str],
              max_retries: int = 2, allow_vertex: bool = True) -> FacetResult:
    """Run one facet end-to-end with retries + backend fallback."""
    exclusion_tokens = [tokens(e) for e in exclusion]
    exclusion_english = set(exclusion)

    rounds = []
    last_feedback = None

    for attempt in range(max_retries + 1):
        backend_label = "codex"
        prompt = build_prompt(pack_id, meta, voice, facet_name, facet_brief,
                              facet_delta, first20, exclusion, last_feedback)
        result = call_codex(prompt, timeout=600)
        rounds.append(f"attempt{attempt+1}/codex: elapsed={result.elapsed_s:.1f}s err={result.error}")

        if result.error in ("RATE_LIMIT", "TIMEOUT", "EMPTY") and allow_vertex:
            backend_label = "vertex"
            result = call_vertex(prompt, timeout=300)
            rounds.append(f"  fallback/vertex: elapsed={result.elapsed_s:.1f}s err={result.error}")

        if not result.text:
            last_feedback = f"backend failed: {result.error}"
            continue

        try:
            batch = parse_json_relaxed(result.text)
        except Exception as e:
            last_feedback = f"JSON parse failed: {e}"
            continue

        if not isinstance(batch, list):
            last_feedback = f"expected list, got {type(batch).__name__}"
            continue

        validation = validate_batch(batch, facet_delta, exclusion_tokens, exclusion_english)
        if validation.ok:
            return FacetResult(pack_id, facet_name, facet_delta,
                               validation.accepted, validation.rejected,
                               rounds, backend_label, "OK")
        last_feedback = validation.feedback()
        rounds.append(f"  validation FAILED: {validation.fail_reasons[:3]}")

    # All retries exhausted
    return FacetResult(pack_id, facet_name, facet_delta,
                       validation.accepted if 'validation' in locals() else [],
                       validation.rejected if 'validation' in locals() else [],
                       rounds, backend_label,
                       f"FAILED after {max_retries+1} attempts: {last_feedback}")


# --------------------------------------------------------------------------
# Per-pack orchestration

def expand_pack(pack_id: str, workers: int = 8, allow_vertex: bool = True,
                dry_run: bool = False) -> dict:
    """Author all facets for a pack, validate, append, bump version."""
    pdir = pack_dir_for(pack_id)
    meta = pack_meta(pack_id)

    # Idempotency
    if meta.get("version") == "0.2.0":
        existing = pack_phrases(pack_id)
        target = get_target_total(pack_id)
        if len(existing) >= int(target * 0.8):
            print(f"  [SKIP] {pack_id} already at v0.2.0 with {len(existing)} phrases")
            return {"pack_id": pack_id, "status": "SKIP_IDEMPOTENT",
                    "n_existing": len(existing), "n_new": 0}

    existing_phrases = pack_phrases(pack_id)
    existing_english = [p["english"] for p in existing_phrases]
    first20 = existing_english[:20]
    voice = VOICE_ANCHORS.get(pack_id, "Practical, on-topic, learner-friendly.")
    facets = get_facets(pack_id)
    pack_delta = compute_pack_delta(pack_id)
    facet_deltas = divide_delta_across_facets(pack_delta, len(facets))

    print(f"\n==> EXPANDING {pack_id}")
    print(f"    tier={get_tier(pack_id)}  existing={len(existing_phrases)}  "
          f"target={get_target_total(pack_id)}  pack_delta={pack_delta}")
    print(f"    facets={len(facets)}; each ~= {facet_deltas[0]}")

    if dry_run:
        print("    [DRY RUN] not calling backends.")
        return {"pack_id": pack_id, "status": "DRY", "n_existing": len(existing_phrases), "n_new": 0}

    # Run facets in parallel.
    # Each facet sees: original existing + all queued so far. Because facets
    # run concurrently we use a snapshot exclusion; the within-pack dedup
    # gate at append time catches any cross-facet collisions.
    snapshot_exclusion = list(existing_english)
    facet_results: list[FacetResult] = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=min(workers, len(facets))) as ex:
        futs = {
            ex.submit(run_facet, pack_id, meta, voice,
                      facet_name, facet_brief, facet_deltas[i],
                      first20, snapshot_exclusion,
                      max_retries=2, allow_vertex=allow_vertex): facet_name
            for i, (facet_name, facet_brief) in enumerate(facets)
        }
        for fut in concurrent.futures.as_completed(futs):
            fr = fut.result()
            facet_results.append(fr)
            ok_n = len(fr.accepted)
            marker = "✓" if fr.final_status == "OK" else "✗"
            print(f"    {marker} facet {fr.facet_name:<35} {ok_n:>3} accepted  ({fr.final_backend}, {fr.final_status[:60]})")

    # Stitch: dedupe across facets (same Jaccard rule)
    queued_english: set[str] = set(existing_english)
    queued_tokens: list[set[str]] = [tokens(e) for e in existing_english]
    final_new: list[dict] = []

    for fr in facet_results:
        for entry in fr.accepted:
            eng = entry["english"]
            if eng in queued_english:
                continue
            toks = tokens(eng)
            if any(jaccard(toks, ex) > 0.75 for ex in queued_tokens[-1000:]):
                continue
            final_new.append(entry)
            queued_english.add(eng)
            queued_tokens.append(toks)

    if not final_new:
        print(f"    [FAIL] no phrases survived across all facets — pack not modified")
        return {"pack_id": pack_id, "status": "ALL_FAILED", "n_existing": len(existing_phrases), "n_new": 0}

    # Apply: append, bump version, update CHANGELOG
    new_phrases = existing_phrases + final_new
    (pdir / "phrases.json").write_text(json.dumps(new_phrases, ensure_ascii=False, indent=2) + "\n")

    meta["version"] = "0.2.0"
    (pdir / "pack.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n")

    update_changelog(pdir, len(final_new), Counter(p["level"] for p in final_new), facets)

    new_dist = Counter(p["level"] for p in new_phrases)
    print(f"    [OK] {pack_id}: {len(existing_phrases)} → {len(new_phrases)}  "
          f"(+{len(final_new)})  dist={dict(sorted(new_dist.items()))}")

    return {"pack_id": pack_id, "status": "OK",
            "n_existing": len(existing_phrases), "n_new": len(final_new),
            "n_total": len(new_phrases), "dist": dict(new_dist),
            "facets": [{"name": fr.facet_name, "accepted": len(fr.accepted),
                        "status": fr.final_status, "backend": fr.final_backend}
                       for fr in facet_results]}


def update_changelog(pdir: Path, n_new: int, dist: Counter,
                     facets: list[tuple[str, str]]) -> None:
    cl_path = pdir / "CHANGELOG.md"
    cl_text = cl_path.read_text() if cl_path.is_file() else ""
    if "## [0.2.0]" in cl_text:
        return  # idempotent

    facet_list = ", ".join(f"{name}" for name, _ in facets)
    dist_str = ", ".join(f"{L}:{n}" for L, n in sorted(dist.items()))
    today = date.today().isoformat()
    new_section = (
        f"## [0.2.0] - {today}\n"
        f"### Added\n"
        f"- v0.2.0 expansion: +{n_new} new phrases authored across {len(facets)} facets\n"
        f"  ({facet_list}). New-phrase distribution: {dist_str}.\n"
        f"- Authored via codex CLI with Gemini Vertex fallback. Voice anchored\n"
        f"  on the existing pack's first 20 phrases.\n\n"
    )

    if "## [Unreleased]" in cl_text:
        idx = cl_text.find("## [Unreleased]")
        next_section = cl_text.find("\n## [", idx + 1)
        if next_section == -1:
            cl_text = cl_text.rstrip() + "\n\n" + new_section
        else:
            cl_text = cl_text[:next_section + 1] + new_section + cl_text[next_section + 1:]
    else:
        cl_text = cl_text.rstrip() + "\n\n" + new_section
    cl_path.write_text(cl_text)


# --------------------------------------------------------------------------
# CLI

def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--pack", help="A single pack id to expand")
    g.add_argument("--tier", choices=["WIDE", "DEEP"],
                   help="Expand all packs in this tier")
    g.add_argument("--all", action="store_true", help="Expand all 24 packs")
    ap.add_argument("--workers", type=int, default=8,
                    help="Facet calls in flight per pack (default 8)")
    ap.add_argument("--dry-run", action="store_true",
                    help="Print prompts and deltas, do not call backends")
    ap.add_argument("--no-vertex-fallback", action="store_true",
                    help="Disable Gemini Vertex fallback on codex failure")
    ap.add_argument("--summary-out", default=None,
                    help="Write per-pack JSON summary to this file")
    ns = ap.parse_args(argv)

    if ns.pack:
        pack_ids = [ns.pack]
    elif ns.tier:
        pack_ids = [pid for pid, t in TIER.items() if t == ns.tier]
    else:
        pack_ids = list(TIER.keys())

    print(f"[expand] running {len(pack_ids)} pack(s); workers/pack={ns.workers}; "
          f"vertex_fallback={'no' if ns.no_vertex_fallback else 'yes'}; dry={ns.dry_run}")

    summaries = []
    for pid in pack_ids:
        try:
            summary = expand_pack(pid, workers=ns.workers,
                                  allow_vertex=not ns.no_vertex_fallback,
                                  dry_run=ns.dry_run)
            summaries.append(summary)
        except Exception as e:
            import traceback; traceback.print_exc()
            summaries.append({"pack_id": pid, "status": f"EXCEPTION:{e}"})

    if ns.summary_out:
        Path(ns.summary_out).write_text(json.dumps(summaries, indent=2))
        print(f"\n[expand] summary written to {ns.summary_out}")

    print(f"\n[expand] DONE: {sum(1 for s in summaries if s.get('status') == 'OK')}/{len(summaries)} OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
