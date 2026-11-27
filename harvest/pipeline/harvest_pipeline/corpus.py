"""Corpus registry: one YAML file per corpus.

```yaml
corpus_id: example
pack_id: example-pack
lang: en
version: 2026.11.27-1            # optional; default <today>-1
sources:
  - id: ecfr-29-1926-cc
    title: 29 CFR Part 1926 Subpart CC
    publisher: U.S. Department of Labor, OSHA (eCFR)
    url: https://www.ecfr.gov/current/title-29/part-1926/subpart-CC   # human-facing URL
    license: public-domain-us-gov
    parser: ecfr                   # ecfr | pdf | ocr | docx | html | markdown | xml | text
    parser_options: {part: "1926"}
    fetch: {kind: ecfr, title: 29, query: {part: "1926", subpart: CC}}   # or {kind: http, url: ...} / {kind: file, path: ...}
    edition: null                  # optional fixed edition label; eCFR fills its "up to date as of" date
equipment:                         # optional variant taxonomy -> equipment rows
  - {id: mobile, name: Mobile crane, aliases: [truck crane]}
  - {id: mobile.rough-terrain, parent: mobile, name: Rough-terrain crane}
task_modules: [tasks/my_task.py]  # extra task definitions, relative to this file
tasks: [terms, facts, explanations, applicability]
profiles:
  frontier:
    author: {backend: claude-cli, model: sonnet}
    judge:  {backend: claude-cli, model: opus}
    cache_dir: cache/frontier      # committed JSONL response cache, relative to this file
default_profile: frontier
```
"""

from __future__ import annotations

import datetime as dt
import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml


@dataclass
class SourceSpec:
    id: str
    title: str
    publisher: str
    url: str
    license: str
    parser: str
    fetch: dict
    parser_options: dict = field(default_factory=dict)
    edition: str | None = None
    media_type: str | None = None
    lang: str = "en"
    optional: bool = False     # a missing manual download skips the source instead of failing


@dataclass
class Profile:
    name: str
    author: dict
    judge: dict | None
    cache_dir: Path
    concurrency: int = 4
    options: dict = field(default_factory=dict)


@dataclass
class Corpus:
    path: Path
    corpus_id: str
    pack_id: str
    lang: str
    version: str
    sources: list[SourceSpec]
    equipment: list[dict]
    tasks: list[str]
    task_options: dict
    task_modules: list[Path]
    profiles: dict[str, Profile]
    default_profile: str
    raw: dict

    @property
    def dir(self) -> Path:
        return self.path.parent

    @property
    def lock_path(self) -> Path:
        return self.dir / f"{self.path.stem}.sources.lock.json"

    def profile(self, name: str | None = None) -> Profile:
        name = name or self.default_profile
        if name not in self.profiles:
            raise SystemExit(f"unknown profile {name!r}; corpus has {sorted(self.profiles)}")
        return self.profiles[name]


def harvest_home() -> Path:
    """Raw downloads, work files and packs live here, outside git. Override with HARVEST_HOME."""
    return Path(os.environ.get("HARVEST_HOME", Path.home() / ".cache" / "harvest"))


def load_corpus(path: str | Path) -> Corpus:
    path = Path(path).resolve()
    raw = yaml.safe_load(path.read_text()) or {}
    for key in ("corpus_id", "sources"):
        if key not in raw:
            raise SystemExit(f"{path}: missing {key!r}")
    sources = []
    seen = set()
    for s in raw["sources"]:
        if s["id"] in seen:
            raise SystemExit(f"{path}: duplicate source id {s['id']!r}")
        seen.add(s["id"])
        sources.append(SourceSpec(
            id=s["id"], title=s["title"], publisher=s["publisher"], url=s["url"], license=s["license"],
            parser=s["parser"], fetch=s.get("fetch") or {"kind": "http", "url": s["url"]},
            parser_options=s.get("parser_options") or {}, edition=s.get("edition"),
            media_type=s.get("media_type"), lang=s.get("lang", raw.get("lang", "en")),
            optional=bool(s.get("optional", False)),
        ))
    profiles = {}
    for name, p in (raw.get("profiles") or {}).items():
        profiles[name] = Profile(
            name=name, author=p["author"], judge=p.get("judge"),
            cache_dir=(path.parent / p.get("cache_dir", f"cache/{name}")).resolve(),
            concurrency=int(p.get("concurrency", 4)), options=p.get("options") or {},
        )
    if not profiles:
        profiles["deterministic"] = Profile("deterministic", {"backend": "deterministic", "model": "rules"}, None,
                                            (path.parent / "cache/deterministic").resolve())
    version = raw.get("version") or os.environ.get("HARVEST_PACK_VERSION") or f"{dt.date.today():%Y.%m.%d}-1"
    tasks_cfg = raw.get("tasks") or []
    task_names, task_options = [], {}
    for t in tasks_cfg:
        if isinstance(t, dict):
            (name, opts), = t.items()
            task_names.append(name)
            task_options[name] = opts or {}
        else:
            task_names.append(t)
    return Corpus(
        path=path, corpus_id=raw["corpus_id"], pack_id=raw.get("pack_id", raw["corpus_id"]),
        lang=raw.get("lang", "en"), version=str(version), sources=sources,
        equipment=raw.get("equipment") or [], tasks=task_names, task_options=task_options,
        task_modules=[(path.parent / m).resolve() for m in raw.get("task_modules") or []],
        profiles=profiles, default_profile=raw.get("default_profile") or next(iter(profiles)), raw=raw,
    )
