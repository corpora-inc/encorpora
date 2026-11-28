"""Orchestration: corpus YAML -> stage -> tasks -> pack. The CLI is a thin layer over this."""

from __future__ import annotations

import json
import sys
from dataclasses import asdict
from pathlib import Path

from . import parsers
from .cache import ResponseCache
from .corpus import Corpus, Profile, harvest_home
from .embed import make_embedder
from .enrich import Engine, TaskReport, order_tasks, spec_of
from .fetch import load_lock, read_raw
from .pack import write_pack
from .stage import Stage
from .tasks import get_task, load_task_module


def work_dir(corpus: Corpus, profile: Profile) -> Path:
    d = harvest_home() / "work" / corpus.corpus_id / profile.name
    d.mkdir(parents=True, exist_ok=True)
    return d


def build_stage(corpus: Corpus, path: Path | str = ":memory:", log=sys.stderr) -> tuple[Stage, dict]:
    stage = Stage(path)
    info = {}
    lock = load_lock(corpus)["sources"]
    for spec in corpus.sources:
        if spec.optional and spec.id not in lock:
            if log:
                print(f"[parse] {spec.id}: not fetched (optional); skipped", file=log)
            info[spec.id] = {"skipped": "not fetched"}
            continue
        rec, data = read_raw(corpus, spec.id)
        doc = parsers.parse(spec.parser, data, spec.id, spec.parser_options)
        stage.add_source(rec)
        n = stage.add_doc(doc, spec.lang)
        info[spec.id] = {"sections": n, "xrefs": len(doc.xrefs), "warnings": doc.warnings}
        if log:
            print(f"[parse] {spec.id}: {n} sections, {len(doc.xrefs)} xrefs, {len(doc.warnings)} warnings",
                  file=log, flush=True)
            for w in doc.warnings[:5]:
                print(f"[parse]   warning: {w}", file=log)
    stage.finalize_xrefs()
    stage.add_equipment(corpus.equipment)
    stage.commit()
    return stage, info


def load_tasks(corpus: Corpus, names: list[str] | None = None):
    for m in corpus.task_modules:
        load_task_module(m)
    wanted = names or corpus.tasks
    return order_tasks([get_task(n, corpus.task_options.get(n)) for n in wanted])


def enrich(corpus: Corpus, profile: Profile, stage: Stage, offline: bool, task_names: list[str] | None = None,
           limit: int | None = None, keys: set[str] | None = None, author=None, judge=None,
           no_judge: bool = False, prune: bool = False, log=sys.stderr) -> list[TaskReport]:
    cache = ResponseCache(profile.cache_dir)
    eng = Engine(stage=stage, cache=cache, author_cfg=profile.author, judge_cfg=None if no_judge else profile.judge,
                 offline=offline, concurrency=profile.concurrency, author=author, judge=judge, log=log)
    reports = []
    finished = False
    try:
        for task in load_tasks(corpus, task_names):
            rep = eng.run(task, limit=limit, keys=keys)
            reports.append(rep)
            if rep.stopped:
                break
        finished = True
    finally:
        # prune only after a complete run (loop ran to the end without an exception or Ctrl-C, no
        # limit/keys filter, nothing stopped or failed), so no live entry is dropped
        complete = finished and limit is None and not keys and not any(r.stopped or r.author_failed for r in reports)
        cache.close(prune=prune and complete)
    if corpus.raw.get("imports"):
        from .importer import import_rows
        for ir in import_rows(stage, corpus.dir, corpus.raw["imports"]):
            if log:
                print(f"[import] {ir.table}: {ir.rows} rows from {ir.files} files {ir.verdicts}", file=log, flush=True)
                for p in ir.problems[:5]:
                    print(f"[import]   {p}", file=log)
            rep = TaskReport(task=f"import:{ir.table}", inputs=ir.files, items=ir.rows, verdicts=ir.verdicts,
                             errors=ir.problems[:50])
            reports.append(rep)
    return reports


def save_report(corpus: Corpus, profile: Profile, reports: list[TaskReport], extra: dict | None = None) -> Path:
    p = work_dir(corpus, profile) / "report.json"
    p.write_text(json.dumps({"corpus": corpus.corpus_id, "profile": profile.name,
                             "tasks": [asdict(r) for r in reports], **(extra or {})}, indent=2))
    return p


def default_out_dir(corpus: Corpus, profile: Profile) -> Path:
    return harvest_home() / "packs" / corpus.pack_id / profile.name


def build(corpus: Corpus, profile: Profile, out_dir: Path | None = None, release: bool = True,
          embedder_cfg: dict | None = None, log=sys.stderr) -> dict:
    """Deterministic from raw sources + committed cache: no model is called."""
    stage, info = build_stage(corpus, work_dir(corpus, profile) / "stage.sqlite", log=log)
    reports = enrich(corpus, profile, stage, offline=True, log=log)
    missing = {r.task: r.author_missing + r.judge_missing for r in reports if r.author_missing + r.judge_missing}
    from .contract import app_meta
    extra_meta, meta_problems = app_meta(corpus.dir, corpus.raw.get("pack_meta"), stage)
    if meta_problems:
        raise SystemExit("pack_meta: " + "; ".join(meta_problems[:20]))
    emb_cfg = embedder_cfg if embedder_cfg is not None else corpus.raw.get("embedder")
    embedder = make_embedder(emb_cfg)
    try:
        res = write_pack(stage, out_dir or default_out_dir(corpus, profile), corpus.pack_id, corpus.version,
                         corpus.corpus_id, embedder, release=release,
                         bake_backends={"author": spec_of(profile.author), "judge": spec_of(profile.judge)},
                         lang=corpus.lang, extra_meta=extra_meta)
    finally:
        embedder.close()
    res["cache_misses"] = missing
    res["report"] = str(save_report(corpus, profile, reports, {"parse": info, "pack": res}))
    return res
