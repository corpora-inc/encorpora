"""Enumerate what a pack holds, for building items. Nothing here is specific to one pack.

Item enumeration reads the signed pack's SQLite read-only (the engine has no symptom list method);
every text a generator sees comes from the engine API (`manual.section`), verbatim. The pack's baked
search synonyms are read only by `baked_synonyms()`, for the leakage measure, and never reach a
generation prompt.
"""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path

import os

from .engine import Engine
from .paths import PACKS

# Item enumeration reads a pinned snapshot of the packs root (`snapshot()`), never the live root that
# a pack build rewrites in place: a rebuild mid-run must not change what a run enumerates.
# MAINT_EVAL_PACKS overrides the snapshot; MAINT_EVAL_LIVE_PACKS names the root to snapshot from.
DEFAULT_ROOT = Path(os.environ.get("MAINT_EVAL_PACKS") or PACKS / "current")


def snapshot(live: Path | None = None) -> Path:
    """Copy the live root's current versions into $MAINT_EVAL_STATE/packs/<versions>/ and point `current` at it."""
    import shutil
    if live is None:
        v = os.environ.get("MAINT_EVAL_LIVE_PACKS")
        if not v:
            raise SystemExit("MAINT_EVAL_LIVE_PACKS is not set: the packs root to snapshot")
        live = Path(v).expanduser()
    vers = []
    for d in sorted(live.iterdir()):
        if (d / "current").is_file():
            vers.append(f"{d.name}@{(d / 'current').read_text().strip()}")
    tag = "+".join(vers)
    dst = PACKS / tag
    if not dst.exists():
        shutil.copytree(live, dst, symlinks=True)
    cur = dst.parent / "current"
    if cur.is_symlink() or cur.exists():
        cur.unlink()
    cur.symlink_to(dst.name)
    return dst


@dataclass
class SymptomRow:
    pack_id: str
    symptom_id: str
    tree_id: str
    title: str
    system: str | None


def pack_dirs(root: Path = DEFAULT_ROOT) -> dict[str, Path]:
    out = {}
    for d in sorted(root.iterdir()):
        cur = d / "current"
        if cur.is_file():
            v = d / cur.read_text().strip()
            dbs = list(v.glob("*.sqlite"))
            if dbs:
                out[d.name] = dbs[0]
    return out


def _db(path: Path) -> sqlite3.Connection:
    return sqlite3.connect(f"file:{path}?mode=ro", uri=True)


def symptoms(db: Path, pack_id: str) -> list[SymptomRow]:
    with _db(db) as c:
        rows = c.execute("SELECT symptom_id, tree_id, title, system FROM symptom ORDER BY symptom_id").fetchall()
    return [SymptomRow(pack_id, *r) for r in rows]


def baked_synonyms(db: Path) -> dict[str, list[str]]:
    """Leakage measure only. Never pass these to a generator."""
    import json
    with _db(db) as c:
        rows = c.execute("SELECT symptom_id, synonyms FROM symptom").fetchall()
    return {sid: json.loads(s or "[]") for sid, s in rows}


def equipment_label(eng: Engine, pack_id: str) -> str:
    info = eng.pack_info(pack_id)
    roots = [e["name"] for e in info.get("equipment") or [] if not e.get("parent_id")]
    src = [s.get("title") for s in info.get("sources") or [] if s.get("title")]
    label = ", ".join(roots) or pack_id
    return f"{label} ({src[0]})" if src else label


def source_row(eng: Engine, pack_id: str, tree_id: str, limit: int = 2500) -> str:
    """The manual's own text for a symptom: its tree's sections, verbatim."""
    t = eng.tree(pack_id, tree_id)["tree"]
    parts = [eng.section_text(pack_id, sid, depth=3, limit=limit) for sid in t["section_ids"]]
    return "\n".join(parts)[:limit]
