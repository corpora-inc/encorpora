"""Run every backend over the set, judge, score, and write the outputs."""
from __future__ import annotations

import csv
import datetime as dt
import hashlib
import json
import platform
import random
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from . import metrics
from .backends import HarvestBackend, Response, make_backend
from .corpus import Corpus
from .judge import Judge
from .report import write_report
from .sections import Normalizer

REQUIRED = ("id", "question", "gold_answer", "section_ids", "must_decline")


def load_config(path: Path | None) -> dict:
    if path is None:
        return {}
    text = path.read_text()
    if path.suffix in (".yaml", ".yml"):
        try:
            import yaml  # type: ignore
        except ImportError as e:
            raise SystemExit("PyYAML is needed for a .yaml config (pip install pyyaml in a venv), "
                             "or pass the same config as .json") from e
        return yaml.safe_load(text) or {}
    return json.loads(text)


def load_set(path: Path) -> list[dict]:
    items = []
    seen = set()
    with path.open() as f:
        for n, line in enumerate(f, 1):
            if not line.strip():
                continue
            it = json.loads(line)
            missing = [k for k in REQUIRED if k not in it]
            if missing:
                raise SystemExit(f"{path}:{n}: item missing {missing}")
            if it["id"] in seen:
                raise SystemExit(f"{path}:{n}: duplicate id {it['id']}")
            seen.add(it["id"])
            items.append(it)
    return items


def sha256_file(p: Path) -> str | None:
    if not p.exists() or p.is_dir():
        return None
    h = hashlib.sha256()
    with p.open("rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def resolve(base: Path, p: str | None) -> Path | None:
    if p is None:
        return None
    q = Path(p).expanduser()
    return q if q.is_absolute() else (base / q)


def git_head(path: Path) -> str | None:
    try:
        return subprocess.run(["git", "-C", str(path), "rev-parse", "HEAD"], capture_output=True, text=True,
                              timeout=10).stdout.strip() or None
    except (OSError, subprocess.TimeoutExpired):
        return None


def run(args) -> int:
    cfg_path = Path(args.config) if args.config else None
    cfg = load_config(cfg_path)
    base = cfg_path.parent if cfg_path else Path.cwd()
    set_path = Path(args.set) if args.set else resolve(base, cfg.get("set"))
    if set_path is None:
        raise SystemExit("no --set and no 'set' in the config")
    items = load_set(set_path)
    if args.only:
        items = [it for it in items if it["id"] in set(args.only)]
    if args.limit:
        items = items[: args.limit]
    out = Path(args.out)
    (out / "responses").mkdir(parents=True, exist_ok=True)

    normalize = Normalizer([(a["pattern"], a["replace"]) for a in (cfg.get("match") or {}).get("aliases", [])])
    ref_path = resolve(base, cfg.get("reference_sections"))
    ref_corpus = Corpus.from_jsonl(ref_path) if ref_path and ref_path.exists() else None

    backends_cfg = list(cfg.get("backends") or [])
    if args.pack:
        found = False
        for b in backends_cfg:
            if b["kind"] == "harvest":
                b["pack"] = args.pack
                found = True
        if not found:
            backends_cfg.insert(0, {"name": "harvest", "kind": "harvest", "pack": args.pack})
    if args.binary:
        for b in backends_cfg:
            if b["kind"] == "harvest":
                b["binary"] = args.binary
    if args.llm:
        for b in backends_cfg:
            if b["kind"] == "harvest":
                b["llm"] = args.llm
    if args.backends:
        backends_cfg = [b for b in backends_cfg if b["name"] in args.backends]
    if not backends_cfg:
        raise SystemExit("no backends: give --pack or list backends in the config")

    jcfg = cfg.get("judge") or {}
    judge = None
    if not args.no_judge:
        cache = resolve(base, jcfg.get("cache")) if jcfg.get("cache") else out / "judge-cache"
        judge = Judge(cache, model=jcfg.get("model", "opus"), binary=jcfg.get("binary", "claude"),
                      per_call=jcfg.get("per_call", 6), jobs=jcfg.get("jobs", 3))

    meta = {
        "started_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "set": {"path": str(set_path), "sha256": sha256_file(set_path), "items": len(items)},
        "reference_sections": {"path": str(ref_path), "sha256": sha256_file(ref_path)} if ref_path else None,
        "harness_commit": git_head(Path(__file__).parent),
        "host": {"machine": platform.machine(), "system": platform.system(), "release": platform.release(),
                 "processor": platform.processor(), "python": platform.python_version()},
        "judge": {"model": jcfg.get("model", "opus"), "agreement_model": jcfg.get("agreement_model", "sonnet"),
                  "agreement_sample": jcfg.get("agreement_sample", 0.15)} if judge else None,
        "backends": {},
    }
    results = {"meta": meta, "backends": {}, "comparisons": {}}
    all_rows: dict[str, list[dict]] = {}

    for bcfg in backends_cfg:
        name = bcfg["name"]
        corpus = None
        if bcfg["kind"] == "harvest":
            pack = resolve(base, str(bcfg["pack"]))
            bcfg["pack"] = str(pack)
            try:
                corpus = Corpus.from_pack(pack)
            except Exception as e:  # noqa: BLE001 - a stub run may have no pack db
                print(f"[{name}] pack not readable as sqlite ({e}); using reference sections", file=sys.stderr)
                corpus = ref_corpus
            bmeta = {"kind": "harvest", "pack": str(pack), "pack_sha256": sha256_file(pack)
                     if pack.is_file() else {p.name: sha256_file(p) for p in sorted(pack.glob('*.sqlite'))}
                     if pack.is_dir() else None,
                     "pack_version": corpus.version if corpus is not None else None,
                     "binary": bcfg.get("binary", "harvest"), "llm": bcfg.get("llm"), "role": bcfg.get("role")}
        else:
            corpus = ref_corpus
            bmeta = {k: v for k, v in bcfg.items() if k not in ("system_prompt", "api_key_env")}
            bmeta["system_prompt_sha256"] = hashlib.sha256(
                (bcfg.get("system_prompt") or "").encode()).hexdigest() if bcfg.get("system_prompt") else "default"
        backend = make_backend(bcfg, corpus, normalize)
        responses = collect(backend, items, out / "responses" / f"{name}.jsonl",
                            jobs=bcfg.get("jobs", 1 if bcfg["kind"] == "harvest" else 3))
        is_h = isinstance(backend, HarvestBackend)
        versions = {r.pack_version for r in responses.values() if r.pack_version}
        models = {r.model for r in responses.values() if r.model}
        bmeta["reported_pack_versions"] = sorted(versions)
        bmeta["reported_models"] = sorted(models)
        meta["backends"][name] = bmeta

        grades, supports = judge_all(judge, items, responses, corpus, is_h) if judge else ({}, {})
        rows = []
        for it in items:
            r = responses[it["id"]]
            rows.append(metrics.score_item(it, r.to_json(), grades.get(it["id"]), supports.get(it["id"]),
                                           corpus, is_h))
        all_rows[name] = rows
        agg = metrics.aggregate(rows, is_h)
        if judge:
            agg["judge_agreement"] = agreement_check(judge, jcfg, items, responses, grades, is_h)
        results["backends"][name] = agg
        print(f"[{name}] done: {summary_line(agg)}", file=sys.stderr, flush=True)

    names = list(all_rows)
    pairs = cfg.get("compare") or [[names[0], n] for n in names[1:]]
    for a, b in pairs:
        if a in all_rows and b in all_rows:
            results["comparisons"][f"{a} vs {b}"] = metrics.compare(all_rows[a], all_rows[b])
    if judge:
        meta["judge"]["calls"] = judge.calls
        meta["judge"]["cost_usd"] = round(judge.cost_usd, 4)
        meta["judge"]["models_seen"] = sorted(judge.models)
    meta["finished_at"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")

    (out / "results.json").write_text(json.dumps(results, indent=1, ensure_ascii=False))
    write_csv(out / "items.csv", items, all_rows, out / "responses")
    write_report(out / "report.md", results, items, all_rows)
    print(f"wrote {out/'report.md'}, {out/'results.json'}, {out/'items.csv'}", file=sys.stderr)
    return 0


def summary_line(agg: dict) -> str:
    c = agg["correctness"]
    parts = [f"n={agg['n']}", f"errors={agg['errors']}"]
    if c.get("fully_correct") is not None:
        parts.append(f"fully_correct={c['fully_correct']:.3f}")
    if agg.get("retrieval"):
        parts.append(f"r@5={agg['retrieval']['lineage']['r@5']:.3f}")
    return " ".join(parts)


def collect(backend, items: list[dict], path: Path, jobs: int) -> dict[str, Response]:
    """Ask every item once; resume from an existing responses file."""
    done: dict[str, Response] = {}
    if path.exists():
        with path.open() as fh:
            for line in fh:
                d = json.loads(line)
                if d["response"]["ok"]:
                    done[d["id"]] = Response.from_json(d["response"])
    todo = [it for it in items if it["id"] not in done]
    lock = threading.Lock()
    with path.open("a") as f, ThreadPoolExecutor(max_workers=max(1, jobs)) as ex:
        def one(it):
            r = backend.ask(it)
            with lock:
                f.write(json.dumps({"id": it["id"], "response": r.to_json()}, ensure_ascii=False) + "\n")
                f.flush()
                done[it["id"]] = r
                if not r.ok:
                    print(f"[{backend.name}] {it['id']}: {r.error}", file=sys.stderr, flush=True)
        list(ex.map(one, todo))
    return done


def cited_text(corpus: Corpus | None, cites: list[str], limit: int = 16000) -> str:
    if corpus is None:
        return ""
    parts, size = [], 0
    for c in cites:
        if c in corpus.text:
            t = corpus.subtree(c, limit=6000)
            parts.append(t)
            size += len(t)
            if size > limit:
                break
    return "\n".join(parts)[:limit]


def judge_all(judge: Judge, items, responses, corpus, is_harvest: bool):
    grades: dict[str, dict] = {}
    to_grade, ids = [], []
    for it in items:
        r = responses[it["id"]]
        if not r.ok:
            grades[it["id"]] = {"score": 0, "declined": False, "why": f"error: {r.error}", "judge_model": None}
            continue
        if is_harvest and r.mode == "declined":
            # A declined harvest answer needs no judge: right on a must-decline item, wrong otherwise.
            grades[it["id"]] = {"score": 2 if it["must_decline"] else 0, "declined": True,
                                "why": "declined (mode=declined)", "judge_model": "deterministic"}
            continue
        kq = it.get("key_quote") or {}
        to_grade.append({"question": it["question"], "must_decline": bool(it["must_decline"]),
                         "gold_answer": it["gold_answer"], "gold_quote": kq.get("text"), "answer": r.text})
        ids.append(it["id"])
    for i, g in zip(ids, judge.correctness(to_grade)):
        if g:
            grades[i] = g

    supports: dict[str, dict] = {}
    payloads, sids = [], []
    for it in items:
        r = responses[it["id"]]
        g = grades.get(it["id"])
        if not r.ok or (g and g.get("declined")):
            continue
        if not r.claims:
            supports[it["id"]] = {"claims": []}
            continue
        payloads.append({"claims": r.claims, "cited_text": cited_text(corpus, r.citations)})
        sids.append(it["id"])
    for i, s in zip(sids, judge.support(payloads)):
        if s:
            supports[i] = s
    return grades, supports


def agreement_check(judge: Judge, jcfg: dict, items, responses, grades, is_harvest: bool) -> dict:
    frac = jcfg.get("agreement_sample", 0.15)
    model = jcfg.get("agreement_model", "sonnet")
    rng = random.Random(jcfg.get("agreement_seed", 13))
    cands = [it for it in items if grades.get(it["id"], {}).get("judge_model") not in (None, "deterministic")]
    sample = [it for it in cands if rng.random() < frac]
    if not sample:
        return {"n": 0}
    payloads = []
    for it in sample:
        kq = it.get("key_quote") or {}
        payloads.append({"question": it["question"], "must_decline": bool(it["must_decline"]),
                         "gold_answer": it["gold_answer"], "gold_quote": kq.get("text"),
                         "answer": responses[it["id"]].text})
    second = judge.correctness(payloads, model=model)
    first = [grades.get(it["id"]) for it in sample]
    res = metrics.agreement(first, second)
    res["second_model"] = model
    res["disagreements"] = [{"id": it["id"], "primary": a["score"], "second": b["score"]}
                            for it, a, b in zip(sample, first, second) if a and b and a["score"] != b["score"]]
    return res


def write_csv(path: Path, items, all_rows: dict[str, list[dict]], resp_dir: Path) -> None:
    by_id = {it["id"]: it for it in items}
    cols = ["backend", "id", "category", "equipment", "difficulty", "must_decline", "ok", "mode", "declined",
            "score", "baked", "r@1.lineage", "r@5.lineage", "r@10.lineage", "rank.lineage", "n_cites", "cites_gold",
            "cites_supporting", "n_quotes", "quotes_ok", "claims_supported", "claims_unsupported", "elapsed_ms",
            "wall_ms", "error", "judge_why", "question", "gold_sections", "cited", "retrieved_top5", "answer"]
    with path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for name, rows in all_rows.items():
            resp = {}
            rp = resp_dir / f"{name}.jsonl"
            if rp.exists():
                with rp.open() as fh:
                    for line in fh:
                        d = json.loads(line)
                        resp[d["id"]] = d["response"]
            for r in rows:
                it = by_id[r["id"]]
                x = resp.get(r["id"], {})
                w.writerow({**r, "backend": name, "question": it["question"],
                            "gold_sections": " ".join(it.get("section_ids") or []),
                            "cited": " ".join(x.get("citations") or []),
                            "retrieved_top5": " ".join((x.get("retrieved") or [])[:5]),
                            "answer": (x.get("text") or "")[:2000]})
