#!/usr/bin/env python3
"""Phase-0 ASR bake-off runner.

Drives Qwen3-ASR-0.6B vs Whisper-large-v3 vs Parakeet-v3 vs SenseVoice across
our languages on FLEURS, measuring WER/CER + latency + peak RAM. Writes one
JSONL row per (language, engine) to results/, which build_report.py turns
into the ranked decision table that answers the north-star question:

    Does Qwen3-ASR-0.6B transcribe >50 languages well enough to be Corpán's
    default download tier?

Designed to be RESUMABLE and PARTIAL: it skips (lang, engine) pairs already in
the results file, runs only the engines installed (a missing dep is recorded
as an error row, not a crash), and only the languages with a FLEURS config.
The desktop run is the accuracy decision-maker; the device leg
(device/RUNBOOK.md) re-measures latency/RAM on real Android + iOS hardware.

Usage:
    python run_bakeoff.py --engines qwen3,whisper --samples 20
    python run_bakeoff.py --langs en,es,hi,ja,yue-Hant-HK --engines all
    python run_bakeoff.py --list           # print the language plan and exit

Never run with system python — use the project venv (see README.md).
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import time
from dataclasses import asdict, dataclass

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import langs as L  # noqa: E402
import metrics as M  # noqa: E402
from adapters import make_adapter  # noqa: E402
import corpora as C  # noqa: E402


@dataclass
class ResultRow:
    lang: str
    lang_name: str
    engine: str
    metric: str            # "wer" | "cer"
    error_rate: float      # mean across samples (lower better)
    median_latency_s: float
    peak_rss_mb: float
    n_samples: int
    n_failed: int          # transcribe() calls that errored
    script: str
    # The corpus this row was scored on: tier "fleurs" (cross-lang ranking) vs
    # "domain" (our-shape validation), and the specific source within the tier.
    tier: str = "fleurs"
    source: str = "fleurs"
    note: str = ""


def _model_opts(engine: str, args) -> dict:
    """Per-engine construction options from CLI + the models/ dir."""
    models = args.models_dir
    if engine == "whisper":
        return {"model": args.whisper_model, "compute_type": args.whisper_compute,
                "device": args.device}
    if engine == "qwen3":
        return {"model": args.qwen_model, "device": args.device}
    if engine == "parakeet":
        return {"model_dir": os.path.join(models, "parakeet-tdt-v3-int8")}
    if engine == "sensevoice":
        return {"model_dir": os.path.join(models, "sensevoice-small")}
    return {}


def _load_done(results_path: str) -> set[tuple[str, str, str]]:
    # A pair is uniquely (language, engine, SOURCE) now — the same engine is
    # scored on FLEURS AND each domain source, so source is part of the key.
    done: set[tuple[str, str, str]] = set()
    if os.path.exists(results_path):
        for line in open(results_path, encoding="utf-8"):
            try:
                r = json.loads(line)
                done.add((r["lang"], r["engine"], r.get("source", "fleurs")))
            except Exception:
                continue
    return done


def _source_opts(source: str, args) -> dict:
    """Per-source loader kwargs (db path for corpan_tts, CV dataset, etc.)."""
    if source == "corpan_tts":
        return {"db_path": args.db_path, "tts": args.tts}
    if source == "common_voice":
        return {"cv_dataset": args.cv_dataset, "prefer_accented": True}
    return {}


def run(args) -> None:
    plan = _plan(args)
    results_path = os.path.join(args.results_dir, "rows.jsonl")
    os.makedirs(args.results_dir, exist_ok=True)
    done = set() if args.fresh else _load_done(results_path)

    # Cache one adapter per engine across languages + sources.
    adapters: dict[str, object] = {}
    # Memoize loaded corpora per (source, lang) — engine-major revisits each.
    corpus_cache: dict[tuple[str, str], list] = {}

    def samples_for(source, lang):
        key = (source, lang.code)
        if key in corpus_cache:
            return corpus_cache[key]
        try:
            loader = C.get_loader(source)
            s = loader(lang.code, lang.fleurs, n=args.samples,
                       corpus_dir=args.corpus_dir, **_source_opts(source, args))
        except Exception as exc:
            print(f"  !! [{source}] corpus load failed {lang.code}: {exc}", flush=True)
            s = []
        corpus_cache[key] = s
        return s

    out = open(results_path, "a", encoding="utf-8")

    def run_one(source, lang, engine):
        if engine not in args.engines or engine not in lang.engines():
            return
        if (lang.code, engine, source) in done:
            print(f"  skip {lang.code}/{engine}/{source} (done)", flush=True)
            return
        samples = samples_for(source, lang)
        if not samples:
            return  # no corpus for this (source, lang) → coverage gap, no row
        row = _bench(lang, engine, samples, adapters, args)
        out.write(json.dumps(asdict(row), ensure_ascii=False) + "\n")
        out.flush()
        print(
            f"  {row.tier[:3]}/{source:<12} {lang.code:>12}/{engine:<10} "
            f"{row.metric}={row.error_rate:.3f} lat={row.median_latency_s:.2f}s "
            f"rss={row.peak_rss_mb:.0f}MB fail={row.n_failed}/{row.n_samples}",
            flush=True,
        )

    # Sources expand from the requested tiers (fleurs first = the gate). Within
    # a source, engine-major + Qwen3-first so the north-star table lands first.
    for source in _sources_run_order(args):
        print(f"\n##### SOURCE: {source} (tier={_tier_of(source)}) #####", flush=True)
        if args.order == "engine":
            for engine in _engine_run_order(args):
                print(f"  --- engine: {engine} ---", flush=True)
                for lang in plan:
                    run_one(source, lang, engine)
        else:
            for lang in plan:
                for engine in lang.engines():
                    run_one(source, lang, engine)

    out.close()
    print(f"\nDone. Rows → {results_path}", flush=True)
    print("Build the table with: python build_report.py", flush=True)


def _tier_of(source: str) -> str:
    for tier, sources in C.TIERS.items():
        if source in sources:
            return tier
    return "fleurs"


def _sources_run_order(args) -> list[str]:
    """Expand requested tiers → sources, FLEURS first (the decision gate),
    then the domain sources. Honors an explicit `--sources` list if given."""
    if args.sources:
        return [s for s in args.sources.split(",") if s]
    ordered: list[str] = []
    for tier in args.tiers:                 # tiers already FLEURS-first
        for source in C.TIERS.get(tier, []):
            if source not in ordered:
                ordered.append(source)
    return ordered


def _engine_run_order(args) -> list[str]:
    """Engine order for engine-major runs. Honors the `--engines` CLI order
    when given as a list (so `--engines qwen3,whisper,...` runs Qwen3 first);
    falls back to a Qwen3-first default for `all`."""
    default = ["qwen3", "whisper", "parakeet", "sensevoice"]
    if args.engines_ordered:
        seen = [e for e in args.engines_ordered if e in args.engines]
        # append any remaining selected engines not explicitly ordered
        return seen + [e for e in default if e in args.engines and e not in seen]
    return [e for e in default if e in args.engines]


def _bench(lang, engine, samples, adapters, args) -> ResultRow:
    note = ""
    # All samples in one call share tier/source (one source per call).
    tier = samples[0].tier if samples else "fleurs"
    source = samples[0].source if samples else "fleurs"
    if engine not in adapters:
        try:
            adapters[engine] = make_adapter(engine, **_model_opts(engine, args))
        except Exception as exc:
            return ResultRow(lang.code, lang.name, engine, "n/a", float("nan"),
                             float("nan"), float("nan"), 0, 0, lang.script,
                             tier=tier, source=source,
                             note=f"adapter init failed: {exc}")
    adapter = adapters[engine]
    try:
        adapter.load(lang.code)
    except Exception as exc:
        # A missing engine dep / model file is recorded, not fatal.
        return ResultRow(lang.code, lang.name, engine, "n/a", float("nan"),
                         float("nan"), float("nan"), len(samples), len(samples),
                         lang.script, tier=tier, source=source,
                         note=f"load failed: {exc}")

    rates: list[float] = []
    lats: list[float] = []
    peak = 0.0
    failed = 0
    metric_name = "wer"
    for s in samples:
        out = adapter.transcribe(s.wav_path, lang.code)
        peak = max(peak, out.peak_rss_mb)
        lats.append(out.latency_s)
        if out.error:
            failed += 1
            note = note or out.error
            continue
        metric_name, rate = M.score(s.reference, out.text, lang.script)
        rates.append(rate)

    mean_rate = statistics.fmean(rates) if rates else float("nan")
    med_lat = statistics.median(lats) if lats else float("nan")
    return ResultRow(
        lang.code, lang.name, engine, metric_name, mean_rate, med_lat, peak,
        len(samples), failed, lang.script, tier=tier, source=source, note=note,
    )


def _plan(args) -> list:
    langs = L.with_corpus()
    if args.langs:
        wanted = set(args.langs.split(","))
        langs = [x for x in langs if x.code in wanted]
    return langs


def _print_plan(args) -> None:
    print("Language plan (FLEURS-backed):")
    for lang in L.with_corpus():
        print(f"  {lang.code:14} {lang.name:22} fleurs={lang.fleurs:14} "
              f"script={lang.script:7} engines={','.join(lang.engines())}")
    gaps = L.coverage_gaps()
    if gaps:
        print("\nNo-FLEURS coverage gaps (other-corpus or keyboard-floor):")
        for lang in gaps:
            print(f"  {lang.code:14} {lang.name}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--engines", default="qwen3,whisper",
                   help="comma list or 'all' (qwen3,whisper,parakeet,sensevoice)")
    p.add_argument("--langs", default="", help="comma list of our codes; default all")
    p.add_argument("--samples", type=int, default=20, help="utterances per language")
    p.add_argument("--device", default="cpu", help="cpu|cuda|mps|auto")
    p.add_argument("--whisper-model", default="large-v3")
    p.add_argument("--whisper-compute", default="int8")
    p.add_argument("--qwen-model", default="Qwen/Qwen3-ASR-0.6B")
    p.add_argument("--models-dir", default=os.path.join(HERE, "models"))
    p.add_argument("--corpus-dir", default=os.path.join(HERE, "corpus"))
    p.add_argument("--results-dir", default=os.path.join(HERE, "results"))
    p.add_argument("--fresh", action="store_true", help="ignore prior rows")
    p.add_argument("--list", action="store_true", help="print the plan and exit")
    p.add_argument(
        "--order", choices=["engine", "lang"], default="engine",
        help="engine-major (default): finish one engine across ALL langs "
             "before the next — Qwen3 first emits the north-star table without "
             "waiting for the full matrix. lang-major: all engines per lang.",
    )
    # --- eval tiers (the owner's methodology: FLEURS ranks, domain validates) ---
    p.add_argument(
        "--tiers", default="fleurs",
        help="comma list of eval tiers, FLEURS-first. 'fleurs' = cross-language "
             "ranking (the gate). 'domain' = our-shape validation (corpan_tts + "
             "common_voice + gold). 'fleurs,domain' = both.",
    )
    p.add_argument(
        "--sources", default="",
        help="explicit comma list of corpus sources (overrides --tiers): "
             "fleurs,corpan_tts,common_voice,gold",
    )
    p.add_argument("--tts", default="mms", help="TTS engine for corpan_tts (mms)")
    p.add_argument(
        "--db-path",
        default=os.path.normpath(os.path.join(HERE, "..", "..", "dja", "release.sqlite3")),
        help="Corpán phrase DB for the corpan_tts source",
    )
    p.add_argument("--cv-dataset", default="mozilla-foundation/common_voice_17_0",
                   help="HF dataset id for the common_voice source")
    args = p.parse_args()

    args.tiers = [t for t in args.tiers.split(",") if t]

    # Preserve the CLI engine ORDER (for engine-major Qwen3-first runs) before
    # collapsing to a set for membership checks.
    if args.engines == "all":
        args.engines_ordered = list(L.ALL_ENGINES)
        args.engines = set(L.ALL_ENGINES)
    else:
        args.engines_ordered = args.engines.split(",")
        args.engines = set(args.engines_ordered)

    if args.list:
        _print_plan(args)
        return
    t0 = time.time()
    run(args)
    print(f"Wall: {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
