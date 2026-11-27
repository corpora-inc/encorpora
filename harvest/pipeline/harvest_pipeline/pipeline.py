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
from .fetch import read_raw
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
    for spec in corpus.sources:
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
           no_judge: bool = False, log=sys.stderr) -> list[TaskReport]:
    cache = ResponseCache(profile.cache_dir)
    eng = Engine(stage=stage, cache=cache, author_cfg=profile.author, judge_cfg=None if no_judge else profile.judge,
                 offline=offline, concurrency=profile.concurrency, author=author, judge=judge, log=log)
    reports = []
    try:
        for task in load_tasks(corpus, task_names):
            rep = eng.run(task, limit=limit, keys=keys)
            reports.append(rep)
            if rep.stopped:
                break
    finally:
        cache.close()
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
    emb_cfg = embedder_cfg if embedder_cfg is not None else corpus.raw.get("embedder")
    embedder = make_embedder(emb_cfg)
    try:
        res = write_pack(stage, out_dir or default_out_dir(corpus, profile), corpus.pack_id, corpus.version,
                         corpus.corpus_id, embedder, release=release,
                         bake_backends={"author": spec_of(profile.author), "judge": spec_of(profile.judge)},
                         lang=corpus.lang)
    finally:
        embedder.close()
    res["cache_misses"] = missing
    res["report"] = str(save_report(corpus, profile, reports, {"parse": info, "pack": res}))
    return res
