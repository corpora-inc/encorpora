"""Corpus -> page models -> extraction (one arm) -> assembly -> signed pack, then the core's graph
validation (`harvest verify --json`) on the built pack: every tree, requirement, symptom or signal
it reports gets verdict `fail` with the rule and detail in its provenance, and the pack is built
again without it, until the core reports nothing (at most `max_rounds`).

Corpus YAML (beside the usual keys):

```yaml
sources:
  - {id: m40, parser: maint-pdf, parser_options: {id_prefix: m40, citation_prefix: ""}, ...}
maint:
  arms:                       # ways to run the extraction; `release_arm` builds the pack
    sonnet-img:  {author: {backend: claude-cli, model: sonnet}, images: true}
    sonnet-text: {author: {backend: claude-cli, model: sonnet}, images: false}
  release_arm: sonnet-img
  cache_dir: cache            # <cache_dir>/<arm>/maint.extract.jsonl, committed
  ledger: cache/ledger.jsonl  # every model call
  image_px: 1400
  units: {unit_break_regex: ..., max_unit_pages: 8}
  levels: [...]               # pack_meta.levels
  signal_kinds: [{kind, label, example}]
  roles: [apprentice, technician, expert]
```
"""

from __future__ import annotations

import json
import subprocess
import sys
from dataclasses import asdict
from pathlib import Path

from ..corpus import Corpus, harvest_home
from ..embed import make_embedder
from ..fetch import load_lock, read_raw
from ..pack import write_pack
from ..stage import Stage
from ..textutil import sha256_json, sha256_text
from .assemble import Assembly, Ctx
from .assets import DEFAULT_PX, file_row, render_pages
from .extract import FACETS, PROMPT_VERSION, SCHEMA, SYSTEM, Arm, Ledger, run, units
from .layout import PageModel, load_models, page_models, save_models

LAYOUT_VERSION = "1"
DEFAULT_FACET_LABELS = {"test_option": "Test options", "reason": "Reason for question", "known": "Known info",
                        "possible": "Possible problems"}
DEFAULT_LEVELS = [
    {"id": "apprentice", "label": "Apprentice", "test_steps": "expanded"},
    {"id": "technician", "label": "Technician", "facets": ["possible", "test_option"], "test_steps": "collapsed"},
    {"id": "expert", "label": "Expert", "facets": [], "test_steps": "collapsed"},
]


def cfg(corpus: Corpus) -> dict:
    m = corpus.raw.get("maint")
    if not m:
        raise SystemExit(f"{corpus.path}: no `maint:` section")
    return m


def arm(corpus: Corpus, name: str | None) -> Arm:
    m = cfg(corpus)
    name = name or m.get("release_arm")
    arms = m.get("arms") or {}
    if name not in arms:
        raise SystemExit(f"unknown arm {name!r}; corpus has {sorted(arms)}")
    a = arms[name]
    extra = ""
    if m.get("prompt_file"):
        extra = (corpus.dir / m["prompt_file"]).read_text()
    return Arm(name, a["author"], images=bool(a.get("images", True)), coords=bool(a.get("coords", True)),
               system_extra=extra)


def work(corpus: Corpus) -> Path:
    d = harvest_home() / "work" / corpus.corpus_id / "maint"
    d.mkdir(parents=True, exist_ok=True)
    return d


def sources(corpus: Corpus, log=sys.stderr) -> list[tuple[dict, list[PageModel], dict]]:
    """(lock record, page models with images, source spec options) for every maint source fetched."""
    m = cfg(corpus)
    px = int(m.get("image_px", DEFAULT_PX))
    lock = load_lock(corpus)["sources"]
    out = []
    for spec in corpus.sources:
        if spec.parser != "maint-pdf":
            continue
        if spec.optional and spec.id not in lock:
            print(f"[maint] {spec.id}: not fetched (optional); skipped", file=log)
            continue
        rec, data = read_raw(corpus, spec.id)
        opts = dict(spec.parser_options)
        key = sha256_json({"v": LAYOUT_VERSION, "sha": rec["sha256"], "opts": opts})[:16]
        cache = work(corpus) / f"{spec.id}-{key}.pages.jsonl"
        models = load_models(cache) if cache.exists() else page_models(data, spec.id, opts, _pages(opts, data))
        render_pages(data, rec["sha256"], models, work(corpus) / "pages", px)
        save_models(models, cache)
        if log:
            print(f"[maint] {spec.id}: {len(models)} pages, {sum(len(p.regions) for p in models)} regions, "
              f"{sum(len(p.connectors) for p in models)} connectors", file=log)
        out.append((rec, models, opts))
    return out


def _pages(opts: dict, data: bytes) -> list[int] | None:
    if not opts.get("pages"):
        return None
    from ..parsers.pdf import parse_pages
    import pypdfium2 as pdfium
    n = len(pdfium.PdfDocument(data))
    return parse_pages(opts["pages"], n)


def cache_dir(corpus: Corpus, a: Arm) -> Path:
    return (corpus.dir / cfg(corpus).get("cache_dir", "cache") / a.name).resolve()


def ledger(corpus: Corpus) -> Ledger:
    return Ledger((corpus.dir / cfg(corpus).get("ledger", "cache/ledger.jsonl")).resolve())


def extract(corpus: Corpus, arm_name: str | None, offline: bool, only_units: set[str] | None = None,
            log=sys.stderr) -> tuple[dict, dict, list]:
    a = arm(corpus, arm_name)
    m = cfg(corpus)
    outs, reps, srcs = {}, {}, sources(corpus, log)
    for rec, models, opts in srcs:
        pages = {p.index: p for p in models}
        us = units(models, {**(m.get("units") or {}), **opts})
        if only_units:
            us = [u for u in us if u.key in only_units]
        o, rep = run(us, pages, a, cache_dir(corpus, a), offline, ledger(corpus),
                     concurrency=int(m.get("concurrency", 2)), log=log)
        outs[rec["source_id"]] = (o, us)
        reps[rec["source_id"]] = asdict(rep)
    return outs, reps, srcs


def assemble(corpus: Corpus, a: Arm, outs: dict, srcs: list, stage_path: Path,
             forced: dict | None = None) -> tuple[Stage, list[Assembly], list[tuple[str, Path]]]:
    m = cfg(corpus)
    stage = Stage(stage_path)
    files: list[tuple[str, Path]] = []
    assemblies = []
    prompt_sha = sha256_text(json.dumps({"system": SYSTEM, "extra": a.system_extra, "schema": SCHEMA,
                                         "v": PROMPT_VERSION}, sort_keys=True))
    for rec, models, opts in srcs:
        stage.add_source(rec)
        sid = rec["source_id"]
        asm = Assembly(stage, sid, models, opts.get("id_prefix", sid), opts.get("citation_prefix", ""),
                       {**m, "forced": forced or {}})
        asm.forced = forced or {}
        o, us = outs.get(sid, ({}, []))
        for u in us:
            entry = o.get(u.key)
            if entry is None:
                continue
            ctx = Ctx(stage, {}, sid, asm.prefix, a.spec, entry, u.key, prompt_sha)
            asm.add_unit(ctx, u.pages, entry["output"])
        asm.finish_trees()
        asm.standalone_procedures()
        asm.resolve_targets()
        asm.index_rows()
        asm.resolve_applies()
        asm.leftovers()
        page_assets = {}
        for pm in models:
            if pm.image:
                aid = f"page-{sid}-{pm.index + 1}"
                rel = f"assets/pages/{Path(pm.image).name}"
                row = file_row(aid, rel, Path(pm.image), pm.image_size)
                stage.conn.execute("INSERT OR REPLACE INTO asset VALUES (:asset_id,:path,:sha256,:media_type,:bytes,"
                                   ":width,:height)", row)
                files.append((rel, Path(pm.image)))
                page_assets[pm.index] = aid
        asm.write(page_assets)
        assemblies.append(asm)
    stage.add_equipment([e for e in corpus.equipment
                         if not stage.conn.execute("SELECT 1 FROM equipment WHERE equip_id=?", (e["id"],)).fetchone()])
    stage.commit()
    return stage, assemblies, files


def pack_meta(corpus: Corpus, assemblies: list[Assembly], stage: Stage) -> dict[str, str]:
    m = cfg(corpus)
    used = {r[0] for r in stage.conn.execute("SELECT DISTINCT facet FROM fault_facet")}
    labels = {}
    for asm in assemblies:
        for k, v in asm.facet_labels.items():
            labels.setdefault(k, v)
    facets = [{"id": f, "label": labels.get(f) or DEFAULT_FACET_LABELS.get(f, f)} for f in FACETS if f in used]
    facets += [{"id": f, "label": labels.get(f, f)} for f in sorted(used - set(FACETS))]
    kinds = {r[0] for r in stage.conn.execute("SELECT DISTINCT signal_kind FROM signal_map")}
    sk = [k for k in (m.get("signal_kinds") or []) if k.get("kind") in kinds]
    out = {"facets": json.dumps(facets), "levels": json.dumps(m.get("levels") or DEFAULT_LEVELS),
           "open_facet": "possible"}
    if sk:
        out["signal_kinds"] = json.dumps(sk)
    return out


def verify_graph(harvest: str, pack_dir: Path, pubkey: str | None) -> dict:
    cmd = [harvest, "verify", str(pack_dir), "--json"] + (["--pubkey", pubkey] if pubkey else [])
    r = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        raise SystemExit(f"harvest verify failed ({r.returncode}): {r.stderr.strip()[:600] or r.stdout[:600]}")


def _forced_from(report: dict, forced: dict) -> int:
    """Map the core's violations to the rows they condemn. Returns how many new rows failed."""
    import re
    n = 0
    for v in (report.get("graph") or {}).get("violations", []):
        reason = f"graph {v['rule']}: {v.get('node_id') or ''} {v['detail']}".strip()
        key = None
        if v.get("tree_id") and not v["rule"].startswith(("symptom.", "signal.")):
            key = ("fault_tree", v["tree_id"])
        elif v["rule"].startswith("requirement."):
            m = re.match(r"requirement (\w+):(\S+)#(\d+)", v["detail"])
            if m:
                key = ("requirement", f"{m.group(1)}:{m.group(2)}#{m.group(3)}")
        elif v["rule"].startswith("symptom."):
            m = re.match(r"symptom (\S+):", v["detail"])
            if m:
                key = ("symptom", m.group(1))
        elif v["rule"].startswith("signal."):
            m = re.match(r"signal (\S+) (\S+):", v["detail"])
            if m:
                key = ("signal_map", f"{m.group(1)}:{m.group(2)}")
        if key is None:
            raise SystemExit(f"graph violation the bake cannot attribute to a row (a pipeline bug): {v}")
        if key not in forced:
            forced[key] = reason
            n += 1
    return n


def build(corpus: Corpus, arm_name: str | None, out_dir: Path | None, harvest: str, pubkey: str | None = None,
          embedder_cfg: dict | None = None, max_rounds: int = 4, log=sys.stderr) -> dict:
    """Deterministic from the raw sources and the committed cache: no model is called."""
    a = arm(corpus, arm_name)
    outs, reps, srcs = extract(corpus, a.name, offline=True, log=log)
    missing = {s: r["missing"] for s, r in reps.items() if r["missing"]}
    out_dir = out_dir or harvest_home() / "packs" / corpus.pack_id / a.name
    forced: dict = {}
    rounds = []
    emb = make_embedder(embedder_cfg if embedder_cfg is not None else corpus.raw.get("embedder") or {"kind": "hash"})
    try:
        for rnd in range(1, max_rounds + 1):
            stage, asms, files = assemble(corpus, a, outs, srcs, work(corpus) / f"stage-{a.name}.sqlite", forced)
            meta = pack_meta(corpus, asms, stage)
            res = write_pack(stage, out_dir, corpus.pack_id, corpus.version, corpus.corpus_id, emb, release=True,
                             bake_backends={"author": a.spec, "judge": None}, lang=corpus.lang, extra_meta=meta,
                             files=files)
            rep = verify_graph(harvest, out_dir, pubkey)
            new = _forced_from(rep, forced)
            rounds.append({"round": rnd, "violations": len((rep.get("graph") or {}).get("violations", [])),
                           "newly_failed": new})
            if rep.get("ok") and new == 0:
                break
        else:
            raise SystemExit(f"graph validation still fails after {max_rounds} rounds: {rep.get('graph')}")
    finally:
        emb.close()
    verdicts = dict(stage.conn.execute("SELECT verdict, COUNT(*) FROM provenance GROUP BY verdict").fetchall())
    regions = {r[0]: {"source": r[1], "page": r[2], "region": r[3]} for r in stage.conn.execute(
        "SELECT ref_id, source_id, page_index, region_id FROM _text_loc WHERE ref_kind='section'")}
    (out_dir.parent / f"{out_dir.name}.regions.json").write_text(json.dumps(regions, indent=0, sort_keys=True))
    summary = {"pack": res, "arm": a.name, "spec": a.spec, "extract": reps, "cache_misses": missing,
               "rounds": rounds, "forced_fail": {f"{k[0]}:{k[1]}": v for k, v in forced.items()},
               "verdicts": verdicts, "graph": rep.get("graph", {}).get("counts"),
               "stage": str(work(corpus) / f"stage-{a.name}.sqlite")}
    (work(corpus) / f"build-{a.name}.json").write_text(json.dumps(summary, indent=2, default=str))
    return summary
