"""Release writer: stage -> `<pack_id>-<version>.sqlite` + `manifest.json` (signed when a key is set).

Release rule: generated rows ship only with a `pass` provenance verdict; the provenance rows of
shipped items ship with them. Chunks (retrieval units), FTS5 indexes and int8 embeddings are
built here, from shipped rows only.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import sqlite3
from pathlib import Path

from . import SCHEMA_VERSION, schema
from .embed import Embedder, quantize
from .sign import load_private_key, sign_manifest
from .stage import Stage
from .tasks.units import own_lines
from .textutil import sha256_bytes

PLAIN = ("source", "section", "xref", "equipment", "topic", "skill")


def _copy(src: sqlite3.Connection, dst: sqlite3.Connection, table: str, where: str | None = None,
          order: str | None = None) -> int:
    cols = schema.table_columns(src, table)
    q = f"SELECT {','.join(cols)} FROM {table}" + (f" WHERE {where}" if where else "")
    q += f" ORDER BY {order or ','.join(cols[:3])}"
    rows = src.execute(q).fetchall()
    dst.executemany(f"INSERT INTO {table} ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})",
                    [tuple(r) for r in rows])
    return len(rows)


def _chunks(stage: Stage, dst: sqlite3.Connection) -> list[tuple[str, str, str, str, str | None]]:
    """(chunk_id, ref_kind, ref_id, text, title) for every retrieval unit, deterministic order."""
    out = []
    heads: dict[str, str | None] = {}
    rows = stage.conn.execute("SELECT * FROM section ORDER BY ord").fetchall()
    by_id = {r["section_id"]: r for r in rows}
    for r in rows:
        if r["kind"] in ("part", "subpart", "figure"):
            continue
        own = "\n".join(own_lines(stage, r["section_id"]))
        if not own:
            continue
        path, p = [], r
        while p is not None:
            if p["heading"] and p["kind"] not in ("part",):
                path.append(p["heading"])
            p = by_id.get(p["parent_id"]) if p["parent_id"] else None
        path.reverse()
        lead = ""
        parent = by_id.get(r["parent_id"]) if r["parent_id"] else None
        if parent is not None and parent["kind"] == "paragraph":
            lead = "\n".join(own_lines(stage, parent["section_id"]))[:300]
        title = f"{r['citation']} " + " > ".join(path) if path else r["citation"]
        text = "\n".join(x for x in (title, lead, own) if x)
        heads[r["section_id"]] = title
        out.append((f"s:{r['section_id']}", "section", r["section_id"], text, title))
    sec_title = lambda sid: (by_id[sid]["citation"] if sid in by_id else sid)  # noqa: E731
    for r in dst.execute("SELECT term_id, term, definition, section_id, quote FROM term ORDER BY term_id"):
        out.append((f"t:{r[0]}", "term", r[0], f"{r[1]}: {r[2]}\n{r[4] or ''}".strip(), sec_title(r[3])))
    for r in dst.execute("SELECT fact_id, statement, quote, section_id FROM fact ORDER BY fact_id"):
        out.append((f"f:{r[0]}", "fact", r[0], f"{r[1]}\n{r[2]}", sec_title(r[3])))
    for r in dst.execute("SELECT section_id, level, body FROM explanation ORDER BY section_id, level"):
        out.append((f"e:{r[0]}:{r[1]}", "explanation", f"{r[0]}:{r[1]}", r[2], sec_title(r[0])))
    for r in dst.execute("SELECT answer_id, question FROM answer ORDER BY answer_id"):
        out.append((f"a:{r[0]}", "answer", r[0], r[1], None))
    for r in dst.execute("SELECT s.proc_id, s.ord, s.text, s.detail, p.title FROM proc_step s "
                         "JOIN procedure p USING (proc_id) ORDER BY s.proc_id, s.ord"):
        try:
            detail = json.loads(r[3] or "{}")
        except ValueError:
            detail = {}
        op = detail.get("operator") if isinstance(detail, dict) else None
        out.append((f"p:{r[0]}#{r[1]}", "proc_step", f"{r[0]}#{r[1]}", "\n".join(x for x in (r[2], op) if x), r[4]))
    return out


def write_pack(stage: Stage, out_dir: Path, pack_id: str, version: str, corpus_id: str,
               embedder: Embedder | None, release: bool = True, bake_backends: dict | None = None,
               built_at: str | None = None, lang: str = "en", extra_meta: dict[str, str] | None = None) -> dict:
    """`extra_meta`: more pack_meta keys (app data, CONTRACT "Content read API"); they may not
    replace a key the pack itself sets."""
    out_dir.mkdir(parents=True, exist_ok=True)
    name = f"{pack_id}-{version}.sqlite"
    path = out_dir / name
    if path.exists():
        path.unlink()
    dst = sqlite3.connect(str(path))
    schema.create(dst)
    src = stage.conn
    counts: dict[str, int] = {}
    for t in PLAIN:
        counts[t] = _copy(src, dst, t, order="ord" if t == "section" else None)

    ok = "prov_id IN (SELECT prov_id FROM provenance WHERE verdict='pass')" if release else None
    for t in schema.GENERATED:
        counts[t] = _copy(src, dst, t, where=ok)
    counts["answer_alias"] = _copy(src, dst, "answer_alias",
                                   where="answer_id IN (SELECT answer_id FROM answer"
                                         + (f" WHERE {ok})" if ok else ")"))
    # applies_to has no prov_id column; its provenance is in the stage side table
    if release:
        where = ("EXISTS (SELECT 1 FROM _row_prov rp JOIN provenance p ON p.prov_id = rp.prov_id "
                 "WHERE rp.tbl='applies_to' AND p.verdict='pass' AND "
                 "rp.row_key = json_array(applies_to.ref_kind, applies_to.ref_id, applies_to.equip_id))")
    else:
        where = None
    counts["applies_to"] = _copy(src, dst, "applies_to", where=where)
    # provenance of what ships
    used = set()
    for t in schema.GENERATED:
        used.update(r[0] for r in dst.execute(f"SELECT prov_id FROM {t}"))
    if release:
        used.update(r[0] for r in src.execute(
            "SELECT rp.prov_id FROM _row_prov rp JOIN provenance p ON p.prov_id=rp.prov_id "
            "WHERE rp.tbl='applies_to' AND p.verdict='pass'"))
        prov_rows = [tuple(r) for r in src.execute("SELECT * FROM provenance ORDER BY prov_id") if r[0] in used]
    else:
        prov_rows = [tuple(r) for r in src.execute("SELECT * FROM provenance ORDER BY prov_id")]
    dst.executemany(f"INSERT INTO provenance VALUES ({','.join('?' * 12)})", prov_rows)
    counts["provenance"] = len(prov_rows)

    chunks = _chunks(stage, dst)
    dst.executemany("INSERT INTO chunk (chunk_id, ref_kind, ref_id, text, lang) VALUES (?,?,?,?,?)",
                    [(c[0], c[1], c[2], c[3], lang) for c in chunks])
    dst.execute("INSERT INTO chunk_fts(chunk_fts) VALUES('rebuild')")
    dst.execute("INSERT INTO alias_fts(alias_fts) VALUES('rebuild')")
    counts["chunk"] = len(chunks)

    meta_embed = {}
    if embedder is not None and chunks:
        vecs = embedder.embed_docs([(c[4], c[3]) for c in chunks])
        dst.executemany("INSERT INTO chunk_vec (chunk_id, vec, scale) VALUES (?,?,?)",
                        [(c[0], *quantize(v)) for c, v in zip(chunks, vecs)])
        counts["chunk_vec"] = len(chunks)
        meta_embed = embedder.meta()

    built = built_at or os.environ.get("HARVEST_BUILT_AT") or \
        dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    meta = {
        "pack_id": pack_id, "version": version, "schema_version": str(SCHEMA_VERSION), "built_at": built,
        "corpus_id": corpus_id, "embedder_id": meta_embed.get("embedder_id", "none"),
        "embed_dim": meta_embed.get("embed_dim", "0"), "bake_backends": json.dumps(bake_backends or {}, sort_keys=True),
        "source_count": str(counts["source"]), "row_counts": json.dumps(counts, sort_keys=True),
        "release": "1" if release else "0",
        **{k: v for k, v in meta_embed.items() if k not in ("embedder_id", "embed_dim")},
    }
    clash = sorted(set(extra_meta or {}) & set(meta))
    if clash:
        raise SystemExit(f"pack_meta keys {clash} are set by the pack itself")
    meta.update(extra_meta or {})
    dst.executemany("INSERT INTO pack_meta (key, value) VALUES (?,?)", sorted(meta.items()))
    dst.commit()
    dst.execute("VACUUM")
    dst.close()

    data = path.read_bytes()
    manifest = {"pack_id": pack_id, "version": version, "schema_version": SCHEMA_VERSION,
                "files": [{"path": name, "sha256": sha256_bytes(data), "bytes": len(data)}]}
    key = load_private_key()
    if key is not None:
        manifest = sign_manifest(manifest, key)
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    return {"path": str(path), "manifest": str(out_dir / "manifest.json"), "counts": counts,
            "signed": key is not None}
