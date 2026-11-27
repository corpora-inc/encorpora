"""Fetch sources, hash and cache the raw bytes outside git, record `source` rows in a committed lock file.

The lock (`<corpus>.sources.lock.json`, next to the corpus YAML) is the source registry of
record: id, URL, edition, retrieval time, SHA-256 and media type of exactly the bytes parsed.
Raw bytes live in `$HARVEST_HOME/raw/<sha256>` and are never committed.
"""

from __future__ import annotations

import datetime as dt
import gzip
import json
import mimetypes
import urllib.parse
import urllib.request
import zlib
from dataclasses import dataclass
from pathlib import Path

from .corpus import Corpus, SourceSpec, harvest_home
from .textutil import sha256_bytes

USER_AGENT = "harvest-pipeline/0.1 (corpus-to-knowledge-pack engine)"
ECFR_API = "https://www.ecfr.gov/api/versioner/v1"


@dataclass
class Fetched:
    record: dict     # the `source` row plus lock extras (fetched_url)
    status: str      # new | unchanged | changed | edition-only
    previous: dict | None


def raw_dir() -> Path:
    d = harvest_home() / "raw"
    d.mkdir(parents=True, exist_ok=True)
    return d


def raw_path(sha256: str) -> Path:
    return raw_dir() / sha256


def http_get(url: str, accept: str = "*/*", timeout: int = 120) -> tuple[bytes, str]:
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT, "Accept": accept, "Accept-Encoding": "gzip, deflate",
    })
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read()
        enc = (resp.headers.get("Content-Encoding") or "").lower()
        ctype = (resp.headers.get("Content-Type") or "").split(";")[0].strip()
    if enc == "gzip":
        data = gzip.decompress(data)
    elif enc == "deflate":
        data = zlib.decompress(data)
    return data, ctype


def ecfr_latest_date(title: int) -> str:
    data, _ = http_get(f"{ECFR_API}/titles.json", "application/json")
    for t in json.loads(data)["titles"]:
        if int(t["number"]) == int(title):
            return t["up_to_date_as_of"]
    raise RuntimeError(f"eCFR title {title} not listed")


def ecfr_url(title: int, date: str, query: dict) -> str:
    q = urllib.parse.urlencode({k: str(v) for k, v in query.items()})
    return f"{ECFR_API}/full/{date}/title-{title}.xml?{q}"


def _retrieve(spec: SourceSpec, corpus_dir: Path) -> tuple[bytes, str, str, str]:
    """-> (bytes, media_type, fetched_url, edition)."""
    f = spec.fetch
    kind = f.get("kind", "http")
    if kind == "ecfr":
        date = f.get("date") or ecfr_latest_date(f["title"])
        url = ecfr_url(f["title"], date, f.get("query") or {})
        data, _ = http_get(url, "application/xml")
        return data, "application/xml", url, spec.edition or f"eCFR up to date as of {date}"
    if kind == "http":
        url = f.get("url") or spec.url
        data, ctype = http_get(url)
        mt = spec.media_type or ctype or mimetypes.guess_type(url)[0] or "application/octet-stream"
        return data, mt, url, spec.edition or "unversioned"
    if kind == "file":
        p = (corpus_dir / f["path"]).resolve()
        data = p.read_bytes()
        mt = spec.media_type or mimetypes.guess_type(p.name)[0] or "application/octet-stream"
        return data, mt, p.as_uri(), spec.edition or "unversioned"
    raise SystemExit(f"source {spec.id}: unknown fetch kind {kind!r}")


def load_lock(corpus: Corpus) -> dict:
    if corpus.lock_path.exists():
        return json.loads(corpus.lock_path.read_text())
    return {"sources": {}}


def save_lock(corpus: Corpus, lock: dict) -> None:
    corpus.lock_path.write_text(json.dumps(lock, indent=2, sort_keys=True, ensure_ascii=False) + "\n")


def fetch(corpus: Corpus, only: set[str] | None = None, now: str | None = None) -> list[Fetched]:
    lock = load_lock(corpus)
    out = []
    stamp = now or dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    for spec in corpus.sources:
        if only and spec.id not in only:
            continue
        data, media_type, fetched_url, edition = _retrieve(spec, corpus.dir)
        sha = sha256_bytes(data)
        p = raw_path(sha)
        if not p.exists():
            p.write_bytes(data)
        prev = lock["sources"].get(spec.id)
        if prev is None:
            status = "new"
        elif prev["sha256"] != sha:
            status = "changed"
        elif prev["edition"] != edition:
            status = "edition-only"
        else:
            status = "unchanged"
        rec = {
            "source_id": spec.id, "title": spec.title, "publisher": spec.publisher, "url": spec.url,
            "edition": edition, "sha256": sha, "media_type": media_type, "license": spec.license,
            "fetched_url": fetched_url, "bytes": len(data),
            # keep the original retrieval time while the bytes are unchanged, so the lock only
            # moves when the source does
            "retrieved_at": prev["retrieved_at"] if status in ("unchanged", "edition-only") and prev else stamp,
        }
        if status == "edition-only":
            rec["retrieved_at"] = stamp
        lock["sources"][spec.id] = rec
        out.append(Fetched(rec, status, prev))
    save_lock(corpus, lock)
    return out


def read_raw(corpus: Corpus, source_id: str) -> tuple[dict, bytes]:
    """Locked record and its raw bytes. Fetches on a cache miss and checks the hash."""
    lock = load_lock(corpus)
    rec = lock["sources"].get(source_id)
    if rec is None:
        raise SystemExit(f"source {source_id} has never been fetched; run `harvest-bake fetch {corpus.path}`")
    p = raw_path(rec["sha256"])
    if not p.exists():
        spec = next(s for s in corpus.sources if s.id == source_id)
        if spec.fetch.get("kind") == "ecfr" and "date" not in spec.fetch:
            # pin the locked date so the refetch returns the locked bytes
            spec = SourceSpec(**{**spec.__dict__, "fetch": {**spec.fetch, "date": _ecfr_date(rec)}})
        data, *_ = _retrieve(spec, corpus.dir)
        if sha256_bytes(data) != rec["sha256"]:
            raise SystemExit(f"source {source_id}: raw cache miss and the refetched bytes differ from the lock; "
                             f"run `harvest-bake fetch` to record the new edition")
        p.write_bytes(data)
    data = p.read_bytes()
    if sha256_bytes(data) != rec["sha256"]:
        raise SystemExit(f"raw cache corrupt for {source_id}: {p}")
    return rec, data


def _ecfr_date(rec: dict) -> str:
    url = rec.get("fetched_url", "")
    try:
        return url.split("/full/")[1].split("/")[0]
    except IndexError:
        raise SystemExit(f"cannot recover the eCFR date for {rec['source_id']}")
