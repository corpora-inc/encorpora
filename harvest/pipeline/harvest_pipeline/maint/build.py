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

LAYOUT_VERSION = "2"
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
        if spec.parser not in ("maint-pdf", "maint-s1000d"):
            continue
        if spec.optional and spec.id not in lock:
            if log:
                print(f"[maint] {spec.id}: not fetched (optional); skipped", file=log)
            continue
        rec, data = read_raw(corpus, spec.id)
        opts = dict(spec.parser_options)
        if spec.parser == "maint-s1000d":
            from .s1000d import page_model
            pm, ctx = page_model(data, spec.id, 0, opts.get("label") or spec.id)
            opts["_s1000d"] = ctx
            out.append((rec, [pm], opts))
            continue
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
        if "_s1000d" in opts:       # a data module is structured already: mapped by the schema, no arm, no model
            from .s1000d import derive
            from .extract import Unit
            u = Unit(f"{rec['source_id']}@dm", [0])
            out_ = derive(opts["_s1000d"], corpus.equipment)
            outs[rec["source_id"]] = ({u.key: {"output": out_, "backend": "deterministic", "model_id": "s1000d-map:v1",
                                               "input_sha256": rec["sha256"], "prompt_version": "s1000d-1",
                                               "created_at": ""}}, [u])
            reps[rec["source_id"]] = {"arm": "s1000d", "units": 1, "missing": 0}
            continue
        us = units(models, {**(m.get("units") or {}), **opts})
        if only_units:
            us = [u for u in us if u.key in only_units]
        o, rep = run(us, pages, a, cache_dir(corpus, a), offline, ledger(corpus),
                     concurrency=int(m.get("concurrency", 2)), log=log)
        outs[rec["source_id"]] = (o, us)
        reps[rec["source_id"]] = asdict(rep)
    return outs, reps, srcs


def assemble(corpus: Corpus, a: Arm, outs: dict, srcs: list, stage_path: Path,
             forced: dict | None = None, review: dict | None = None) -> tuple[Stage, list[Assembly], list[tuple[str, Path]]]:
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
                       {**m, "forced": forced or {}, "review": review or {},
                        "plausibility": "_s1000d" not in opts})     # no page geometry in a data module
        asm.forced = forced or {}
        for e in corpus.equipment:           # declared variants: applicability statements resolve against them
            asm.equipment.setdefault(e["id"], {"equip_id": e["id"], "name": e["name"], "parent": e.get("parent"),
                                               "idents": [(k, v) for k, vs in (e.get("ident") or {}).items() for v in vs],
                                               "attrs": [], "ctx": None, "prov": None})
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
        asm.plausibility()
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
    """`harvest verify --json` on the built pack, trusting `pubkey` (default: the signing key's own half)."""
    if pubkey is None:
        import base64
        import tempfile
        from ..sign import load_private_key, public_raw
        k = load_private_key()
        if k is None:
            raise SystemExit("maint build signs the pack and verifies it with the core: set HARVEST_SIGNING_KEY(_FILE)")
        tmp = Path(tempfile.mkdtemp(prefix="harvest-pub-")) / "pack.pub"
        tmp.write_text(base64.b64encode(public_raw(k.public_key())).decode() + "\n")
        pubkey = str(tmp)
    cmd = [harvest, "verify", str(pack_dir), "--json", "--pubkey", pubkey]
    r = subprocess.run(cmd, capture_output=True, text=True)
    try:
        out = json.loads(r.stdout)
    except json.JSONDecodeError:
        out = None
    if not isinstance(out, dict) or "graph" not in out:
        raise SystemExit(f"harvest verify failed ({r.returncode}): {r.stderr.strip()[:600] or r.stdout[:600]}")
    return out


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


def agreement_review(stage: Stage, other_pack: Path, other_name: str) -> dict:
    """Rows of this arm that a second, independent arm's pack does not also hold -> needs_review,
    with the other arm's version beside it. Equipment rows carry no provenance and are not judged."""
    from .score import _title_match, db_items, pack_items
    other = pack_items(other_pack)
    refs: dict = {}
    mine = db_items(stage.conn, refs)
    stage.conn.row_factory = __import__("sqlite3").Row
    review: dict = {}
    for cat, items in mine.items():
        if cat in ("equipment", "idents", "applies", "procedures"):
            continue
        theirs = other.get(cat, set())
        for it in items:
            if any(_title_match(it, o) or _title_match(o, it) for o in theirs):
                continue
            ref = refs.get((cat, it))
            if ref is None:
                continue
            alt = [o for o in theirs if isinstance(o, tuple) and isinstance(it, tuple) and o[:1] == it[:1]][:2]
            reason = f"cross-arm: {other_name} disagrees on {cat} {it!s:.160}" + (f"; it has {alt!s:.200}" if alt else
                                                                                f"; it has no such {cat[:-1]}")
            review.setdefault(ref, reason)
    return review


def build(corpus: Corpus, arm_name: str | None, out_dir: Path | None, harvest: str, pubkey: str | None = None,
          embedder_cfg: dict | None = None, max_rounds: int = 4, log=sys.stderr, agree_with: str | None = None) -> dict:
    """Deterministic from the raw sources and the committed cache: no model is called. With
    `agree_with`, rows the second arm's pack does not also hold become needs_review."""
    m = cfg(corpus)
    a = arm(corpus, arm_name)
    outs, reps, srcs = extract(corpus, a.name, offline=True, log=log)
    missing = {s: r["missing"] for s, r in reps.items() if r["missing"]}
    out_dir = out_dir or harvest_home() / "packs" / corpus.pack_id / a.name
    forced: dict = {}
    review: dict = {}
    rounds = []
    if agree_with:
        other_dir = harvest_home() / "packs" / corpus.pack_id / f"{agree_with}.agree"
        build(corpus, agree_with, other_dir, harvest, pubkey, embedder_cfg, max_rounds, log=None)
        stage0, _, _ = assemble(corpus, a, outs, srcs, work(corpus) / f"stage-{a.name}.sqlite")
        review = agreement_review(stage0, other_dir, agree_with)
        stage0.conn.close()
    emb = make_embedder(embedder_cfg if embedder_cfg is not None else corpus.raw.get("embedder") or {"kind": "hash"})
    try:
        for rnd in range(1, max_rounds + 1):
            stage, asms, files = assemble(corpus, a, outs, srcs, work(corpus) / f"stage-{a.name}.sqlite", forced, review)
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
    hist = None
    if m.get("history"):
        # the fleet's maintenance logs, read against this very pack: history and failure modes ship with it
        from .logs import run_logs
        h = m["history"]
        lr = run_logs((corpus.dir / h["config"]).resolve(), h.get("arm", "rules"), call=False, harvest=harvest,
                      log=log, pack_db=str(next(out_dir.glob("*.sqlite"))))
        for row in lr["_out"]["history"]:
            stage.conn.execute("INSERT OR REPLACE INTO history VALUES (:event_id,:equip_id,:system,:date,:text,"
                               ":source_id,:attrs)", row)
        for row in lr["_out"]["failure_modes"]:
            stage.conn.execute("INSERT OR REPLACE INTO failure_mode VALUES (:mode_id,:equip_id,:system,:title,:count,"
                               ":share,:tree_id,:examples)", row)
        stage.commit()
        emb = make_embedder(embedder_cfg if embedder_cfg is not None else corpus.raw.get("embedder") or {"kind": "hash"})
        try:
            res = write_pack(stage, out_dir, corpus.pack_id, corpus.version, corpus.corpus_id, emb, release=True,
                             bake_backends={"author": a.spec, "judge": None, "history": h.get("arm", "rules")},
                             lang=corpus.lang, extra_meta=meta, files=files)
        finally:
            emb.close()
        rep = verify_graph(harvest, out_dir, pubkey)
        (out_dir.parent / f"{out_dir.name}.registry.json").write_text(json.dumps(lr["_out"]["registry"], indent=1))
        hist = {"arm": h.get("arm", "rules"), "history": len(lr["_out"]["history"]),
                "failure_modes": len(lr["_out"]["failure_modes"]), "repeats": len(lr["_out"]["repeats"]),
                "registry": str(out_dir.parent / f"{out_dir.name}.registry.json"),
                "field_accuracy": (lr.get("score") or {}).get("field_accuracy")}
    verdicts = dict(stage.conn.execute("SELECT verdict, COUNT(*) FROM provenance GROUP BY verdict").fetchall())
    regions = {r[0]: {"source": r[1], "page": r[2], "region": r[3]} for r in stage.conn.execute(
        "SELECT ref_id, source_id, page_index, region_id FROM _text_loc WHERE ref_kind='section'")}
    (out_dir.parent / f"{out_dir.name}.regions.json").write_text(json.dumps(regions, indent=0, sort_keys=True))
    summary = {"pack": res, "arm": a.name, "spec": a.spec, "extract": reps, "cache_misses": missing,
               "rounds": rounds, "forced_fail": {f"{k[0]}:{k[1]}": v for k, v in forced.items()},
               "agree_with": agree_with, "history": hist, "review": {f"{k[0]}:{k[1]}": v for k, v in review.items()},
               "verdicts": verdicts, "graph": rep.get("graph", {}).get("counts"),
               "references": [a.report.get("references") for a in asms],
               "plausibility": [a.report.get("plausibility") for a in asms],
               "stage": str(work(corpus) / f"stage-{a.name}.sqlite")}
    (work(corpus) / f"build-{a.name}.json").write_text(json.dumps(summary, indent=2, default=str))
    return summary


# ---- troubleshooting-table corpora (message | cause | solution) ---------------------------------
def table_sources(corpus: Corpus) -> list[tuple[dict, bytes, dict]]:
    lock = load_lock(corpus)["sources"]
    out = []
    for spec in corpus.sources:
        if spec.parser != "maint-table-html":
            continue
        if spec.optional and spec.id not in lock:
            continue
        rec, data = read_raw(corpus, spec.id)
        out.append((rec, data, dict(spec.parser_options)))
    return out


def synonyms(corpus: Corpus, offline: bool, log=sys.stderr) -> tuple[dict, dict]:
    from .tables import run_synonyms
    m = cfg(corpus)
    by, reps = {}, {}
    for rec, data, opts in table_sources(corpus):
        cols = opts.get("columns") or {"message": 0, "cause": 1, "solution": 2}
        cdir = (corpus.dir / m.get("cache_dir", "cache") / "synonyms").resolve()
        by[rec["source_id"]], reps[rec["source_id"]] = run_synonyms(
            data, cols, (m.get("synonyms") or {}).get("author"), cdir, offline, ledger(corpus), log)
    return by, reps


def build_table(corpus: Corpus, out_dir: Path | None, harvest: str, pubkey: str | None = None,
                embedder_cfg: dict | None = None, log=sys.stderr) -> dict:
    """A table corpus -> stage -> signed pack -> `harvest verify`. No model call (synonyms from the cache)."""
    from .tables import build_table_pack
    m = cfg(corpus)
    syn, syn_rep = synonyms(corpus, offline=True, log=log)
    out_dir = out_dir or harvest_home() / "packs" / corpus.pack_id / "table"
    stage = Stage(work(corpus) / "stage-table.sqlite")
    reports = {}
    for rec, data, opts in table_sources(corpus):
        stage.add_source(rec)
        reports[rec["source_id"]] = build_table_pack(stage, rec, data, opts, syn.get(rec["source_id"]))
    stage.add_equipment(corpus.equipment)
    stage.commit()
    meta = {"facets": json.dumps([{"id": "possible", "label": m.get("cause_label", "Cause")}]),
            "levels": json.dumps(m.get("levels") or DEFAULT_LEVELS), "open_facet": "possible"}
    if m.get("signal_kinds"):
        meta["signal_kinds"] = json.dumps(m["signal_kinds"])
    basis = [r.get("pattern_basis") for r in reports.values() if r.get("pattern_basis")]
    if basis:   # the app may say a match rests on documentation that was never checked against the firmware
        meta["signal_pattern_basis"] = json.dumps({"derived_from": "documentation", "verified_against_firmware": False})
    for k in ("attribution", "license", "license_url"):
        if m.get(k):
            meta[k] = str(m[k])
    emb = make_embedder(embedder_cfg if embedder_cfg is not None else corpus.raw.get("embedder") or {"kind": "hash"})
    try:
        res = write_pack(stage, out_dir, corpus.pack_id, corpus.version, corpus.corpus_id, emb, release=True,
                         bake_backends={"author": "rules", "synonyms": (m.get("synonyms") or {}).get("author")},
                         lang=corpus.lang, extra_meta=meta)
    finally:
        emb.close()
    rep = verify_graph(harvest, out_dir, pubkey)
    pc = __import__("sqlite3").connect(res["path"])
    shipped = {r[0] for r in pc.execute("SELECT tree_id FROM fault_tree")}
    treeless = pc.execute("SELECT COUNT(*) FROM signal_map WHERE tree_id IS NULL").fetchone()[0]
    rows = sum(r["rows"] for r in reports.values())
    summary = {"pack": res, "tables": reports, "synonyms": syn_rep, "graph": rep.get("graph"), "ok": rep.get("ok"),
               "signal_patterns": [{"examples": r.get("pattern_examples"), "misses": len(r["pattern_misses"]),
                                    "collisions": len(r["pattern_collisions"]), **(r.get("pattern_basis") or {})}
                                   for r in reports.values()],
               "coverage": {"rows_in_source": rows, "trees_shipped": len(shipped),
                            "rows_signal_only": treeless,
                            "rows_in_pack": len(shipped) + treeless,
                            "rows_unfit": sum(len(r["unfit"]) for r in reports.values()),
                            "rate": round((len(shipped) + treeless) / rows, 4) if rows else 1.0},
               "verdicts": dict(stage.conn.execute("SELECT verdict, COUNT(*) FROM provenance GROUP BY verdict").fetchall())}
    (work(corpus) / "build-table.json").write_text(json.dumps(summary, indent=2, default=str))
    return summary


def signals_check(corpus: Corpus, pack_dir: Path, harvest: str, pubkey: str | None = None) -> dict:
    """Recorded machine inputs (`maint.signal_samples`) through the core's own decoders (`harvest
    decode`) and matcher (`signal.match` on `harvest serve`), against what the manual says they mean."""
    import socket
    import tempfile
    import time as _t
    import urllib.request
    samples = cfg(corpus).get("signal_samples") or []
    if not samples:
        return {"samples": 0}
    if pubkey is None:
        import base64
        from ..sign import load_private_key, public_raw
        k = load_private_key()
        tmpk = Path(tempfile.mkdtemp(prefix="harvest-pub-")) / "pack.pub"
        tmpk.write_text(base64.b64encode(public_raw(k.public_key())).decode() + "\n")
        pubkey = str(tmpk)
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    td = Path(tempfile.mkdtemp(prefix="harvest-signals-"))
    proc = subprocess.Popen([harvest, "serve", str(pack_dir), "--records", str(td / "records.db"), "--pubkey", pubkey,
                             "--bind", f"127.0.0.1:{port}"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    out = {"samples": 0, "observations": 0, "right": 0, "wrong": []}
    try:
        for _ in range(50):
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{port}/api", timeout=1)
                break
            except OSError:
                _t.sleep(0.2)
        import sqlite3
        db = sqlite3.connect(str(next(pack_dir.glob("*.sqlite"))))
        trees = dict(db.execute("SELECT tree_id, title FROM fault_tree"))
        nodes = dict(db.execute("SELECT node_id, text FROM fault_node"))
        for smp in samples:
            out["samples"] += 1
            cmd = [harvest, "decode", smp["format"], str((corpus.dir / smp["file"]).resolve())]
            if smp.get("kind"):
                cmd += ["--kind", smp["kind"]]
            dec = json.loads(subprocess.run(cmd, capture_output=True, text=True).stdout or "{}")
            for obs, want in zip(dec.get("observations", []), smp["expect"]):
                out["observations"] += 1
                body = json.dumps({"observations": [obs]}).encode()
                req = urllib.request.Request(f"http://127.0.0.1:{port}/api/signal.match", data=body,
                                             headers={"content-type": "application/json"}, method="POST")
                res = json.loads(urllib.request.urlopen(req).read()).get("result") or {}
                sug = res.get("suggested") or {}
                got_tree = trees.get(sug.get("tree_id"))
                got_node = nodes.get(sug.get("node_id")) if sug.get("node_id") else None
                ok = (got_tree or "").lower().startswith(want["tree"].lower()) and \
                    (want.get("node") is None or (got_node or "").startswith(want["node"]))
                out["right"] += ok
                if not ok:
                    out["wrong"].append({"observation": obs, "want": want, "got": {"tree": got_tree, "node": got_node}})
    finally:
        proc.terminate()
        proc.wait(timeout=10)
    return out
