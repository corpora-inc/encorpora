"""harvest-bake: corpus YAML in, verified signed SQLite pack out.

  harvest-bake fetch  CORPUS.yaml [--only ID,...]        download, hash, record sources (lock file)
  harvest-bake parse  CORPUS.yaml                        deterministic parse into the stage; counts
  harvest-bake enrich CORPUS.yaml [--tasks a,b] [--limit N] [--profile P] [--no-judge]
  harvest-bake build  CORPUS.yaml [--profile P] [--out DIR] [--embedder KIND] [--all-verdicts]
  harvest-bake all    CORPUS.yaml [...]                  fetch + enrich + build
  harvest-bake stats  CORPUS.yaml [--profile P]          row counts, verdicts per task, cost
  harvest-bake review CORPUS.yaml --task NAME [--n 20] [--verdict fail]
  harvest-bake diff   OLD.sqlite NEW.sqlite [--json]     edition diff of sections
  harvest-bake verify PACK_DIR [--pubkey FILE]           manifest hashes (+ signature)
  harvest-bake keygen KEY.pem                            new ed25519 signing key (keep out of git)
  harvest-bake tasks  [CORPUS.yaml]                      registered tasks
"""

from __future__ import annotations

import argparse
import base64
import json
import sys
from pathlib import Path

from .corpus import load_corpus


def _csv(s: str | None) -> list[str] | None:
    return [x.strip() for x in s.split(",") if x.strip()] if s else None


def cmd_fetch(a):
    from .fetch import fetch
    c = load_corpus(a.corpus)
    for f in fetch(c, set(_csv(a.only) or []) or None):
        r = f.record
        print(f"{f.status:13} {r['source_id']:28} {r['edition']:36} {r['sha256'][:16]} {r['bytes']:>9} B")
    print(f"lock: {c.lock_path}")


def cmd_parse(a):
    from .pipeline import build_stage, work_dir
    c = load_corpus(a.corpus)
    p = c.profile(a.profile)
    stage, info = build_stage(c, work_dir(c, p) / "stage.sqlite")
    kinds = dict(stage.conn.execute("SELECT kind, COUNT(*) FROM section GROUP BY kind").fetchall())
    xk = dict(stage.conn.execute("SELECT kind, COUNT(*) FROM xref GROUP BY kind").fetchall())
    print(json.dumps({"sections": kinds, "xrefs": xk, "sources": info}, indent=2))


def cmd_enrich(a):
    from .pipeline import build_stage, enrich, save_report, work_dir
    c = load_corpus(a.corpus)
    p = c.profile(a.profile)
    stage, _ = build_stage(c, work_dir(c, p) / "stage.sqlite")
    reps = enrich(c, p, stage, offline=False, task_names=_csv(a.tasks), limit=a.limit,
                  keys=set(_csv(a.keys) or []) or None, no_judge=a.no_judge)
    path = save_report(c, p, reps)
    print(f"report: {path}")
    stopped = [r for r in reps if r.stopped]
    if stopped:
        print(f"STOPPED: {stopped[0].stopped}", file=sys.stderr)
        return 3
    return 0


def _embedder_cfg(a, corpus):
    if a.embedder:
        return {"kind": a.embedder}
    return corpus.raw.get("embedder")


def cmd_build(a):
    from .pipeline import build
    c = load_corpus(a.corpus)
    p = c.profile(a.profile)
    res = build(c, p, Path(a.out) if a.out else None, release=not a.all_verdicts, embedder_cfg=_embedder_cfg(a, c))
    print(json.dumps(res, indent=2))
    if res["cache_misses"]:
        print(f"note: inputs with no cached output (not in the pack): {res['cache_misses']}", file=sys.stderr)


def cmd_all(a):
    cmd_fetch(a)
    rc = cmd_enrich(a)
    cmd_build(a)
    return rc


def cmd_stats(a):
    from .pipeline import default_out_dir, work_dir
    from .stats import cache_cost, pack_stats, stage_verdicts
    c = load_corpus(a.corpus)
    p = c.profile(a.profile)
    out = {"profile": p.name, "cache": cache_cost(p)}
    out["cost_usd_total"] = round(sum(v["cost_usd"] for v in out["cache"].values()), 4)
    stage = work_dir(c, p) / "stage.sqlite"
    if stage.exists():
        out["verdicts"] = stage_verdicts(str(stage))
    pack = default_out_dir(c, p) / f"{c.pack_id}-{c.version}.sqlite"
    if pack.exists():
        out["pack"] = {"path": str(pack), **pack_stats(str(pack))}
    print(json.dumps(out, indent=2))


def cmd_review(a):
    from .pipeline import work_dir
    from .stats import review_items
    from .tasks import get_task
    c = load_corpus(a.corpus)
    p = c.profile(a.profile)
    t = get_task(a.task)
    items = review_items(str(work_dir(c, p) / "stage.sqlite"), t.pid, a.n, a.verdict)
    if a.json:
        print(json.dumps(items, indent=2, ensure_ascii=False))
        return
    for it in items:
        print(f"--- {it['key']} [{it['index']}] {it['verdict']}  {it['notes'] or ''}")
        for r in it["rows"]:
            r = {k: v for k, v in r.items() if k not in ("prov_id", "lang")}
            print("   ", json.dumps(r, ensure_ascii=False)[:600])


def cmd_diff(a):
    from .diff import diff_packs, format_diff
    d = diff_packs(a.old, a.new)
    print(json.dumps(d, indent=2) if a.json else format_diff(d))


def cmd_verify(a):
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    from .sign import verify_pack_dir
    pub = None
    if a.pubkey:
        pub = Ed25519PublicKey.from_public_bytes(base64.b64decode(Path(a.pubkey).read_text().strip()))
    problems = verify_pack_dir(Path(a.pack_dir), pub)
    print("ok" if not problems else "\n".join(problems))
    return 1 if problems else 0


def cmd_keygen(a):
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from .sign import key_id, write_public_key
    p = Path(a.path)
    if p.exists():
        raise SystemExit(f"{p} exists; refusing to overwrite a key")
    k = Ed25519PrivateKey.generate()
    p.write_bytes(k.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                  serialization.NoEncryption()))
    p.chmod(0o600)
    write_public_key(k, p.with_suffix(".pub"))
    print(f"private: {p}\npublic: {p.with_suffix('.pub')}\nkey_id: {key_id(k.public_key())}")


def cmd_tasks(a):
    from .tasks import load_task_module, task_names
    if a.corpus:
        for m in load_corpus(a.corpus).task_modules:
            load_task_module(m)
    print("\n".join(task_names()))


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="harvest-bake", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    def corpus_cmd(name, fn):
        s = sub.add_parser(name)
        s.add_argument("corpus")
        s.add_argument("--profile")
        s.set_defaults(fn=fn)
        return s

    s = corpus_cmd("fetch", cmd_fetch)
    s.add_argument("--only")
    corpus_cmd("parse", cmd_parse)
    for name, fn in (("enrich", cmd_enrich), ("all", cmd_all)):
        s = corpus_cmd(name, fn)
        s.add_argument("--tasks")
        s.add_argument("--limit", type=int)
        s.add_argument("--keys", help="only these input keys (comma-separated)")
        s.add_argument("--no-judge", action="store_true")
        if name == "all":
            s.add_argument("--only")
            s.add_argument("--out")
            s.add_argument("--embedder")
            s.add_argument("--all-verdicts", action="store_true")
    s = corpus_cmd("build", cmd_build)
    s.add_argument("--out")
    s.add_argument("--embedder", help="hash | embeddinggemma-2 | llama-server (overrides the corpus YAML)")
    s.add_argument("--all-verdicts", action="store_true", help="debug pack: keep fail/needs_review rows")
    corpus_cmd("stats", cmd_stats)
    s = corpus_cmd("review", cmd_review)
    s.add_argument("--task", required=True)
    s.add_argument("--n", type=int, default=20)
    s.add_argument("--verdict")
    s.add_argument("--json", action="store_true")
    s = sub.add_parser("diff")
    s.add_argument("old")
    s.add_argument("new")
    s.add_argument("--json", action="store_true")
    s.set_defaults(fn=cmd_diff)
    s = sub.add_parser("verify")
    s.add_argument("pack_dir")
    s.add_argument("--pubkey")
    s.set_defaults(fn=cmd_verify)
    s = sub.add_parser("keygen")
    s.add_argument("path")
    s.set_defaults(fn=cmd_keygen)
    s = sub.add_parser("tasks")
    s.add_argument("corpus", nargs="?")
    s.set_defaults(fn=cmd_tasks)
    a = ap.parse_args(argv)
    return int(a.fn(a) or 0)


if __name__ == "__main__":
    sys.exit(main())
