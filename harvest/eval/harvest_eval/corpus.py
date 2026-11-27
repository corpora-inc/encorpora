"""Section text and chunk-to-section mapping, from a pack or a reference file.

The pack (CONTRACT schema v1) is the authority for what a harvest answer may
quote. A reference sections file (JSON lines with ``section_id`` and ``text``)
stands in when no pack exists, e.g. for no-retrieval baselines.
"""
from __future__ import annotations

import json
import re
import sqlite3
from pathlib import Path


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s or "").strip()


class Corpus:
    def __init__(self) -> None:
        self.text: dict[str, str] = {}
        self.parent: dict[str, str | None] = {}
        self.children: dict[str, list[str]] = {}
        self._db: sqlite3.Connection | None = None
        self.version: str | None = None

    # -- loading ---------------------------------------------------------
    @classmethod
    def from_pack(cls, pack: Path) -> "Corpus":
        c = cls()
        db = pack
        if pack.is_dir():
            dbs = sorted(pack.glob("*.sqlite"))
            if not dbs:
                raise FileNotFoundError(f"no .sqlite in {pack}")
            db = dbs[0]
        con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
        c._db = con
        for sid, parent, text in con.execute("SELECT section_id, parent_id, text FROM section"):
            c._add(sid, parent, text)
        try:
            row = con.execute("SELECT value FROM pack_meta WHERE key='version'").fetchone()
            c.version = row[0] if row else None
        except sqlite3.Error:
            pass
        return c

    @classmethod
    def from_jsonl(cls, path: Path) -> "Corpus":
        c = cls()
        with path.open() as f:
            for line in f:
                r = json.loads(line)
                c._add(r["section_id"], r.get("parent_id"), r["text"])
        return c

    def close(self) -> None:
        if self._db is not None:
            self._db.close()
            self._db = None

    def _add(self, sid: str, parent: str | None, text: str) -> None:
        self.text[sid] = norm(text)
        self.parent[sid] = parent
        if parent:
            self.children.setdefault(parent, []).append(sid)

    # -- queries ---------------------------------------------------------
    def subtree(self, sid: str, limit: int = 12000) -> str:
        parts: list[str] = []
        stack = [sid]
        size = 0
        while stack and size < limit:
            s = stack.pop(0)
            t = self.text.get(s, "")
            if t:
                parts.append(f"[{s}] {t}")
                size += len(t)
            stack[0:0] = self.children.get(s, [])
        return "\n".join(parts)[:limit]

    def quote_ok(self, sid: str, quote: str) -> bool:
        """CONTRACT: a quote is an exact substring of the section text after
        whitespace normalization. A quote of a child paragraph cited at its
        parent also passes (the parent's text includes it in reading order)."""
        q = norm(quote)
        if not q or sid not in self.text:
            return False
        if q in self.text[sid]:
            return True
        stack = list(self.children.get(sid, []))
        while stack:
            s = stack.pop()
            if q in self.text.get(s, ""):
                return True
            stack.extend(self.children.get(s, []))
        return False

    def sections_for_ref(self, ref_kind: str | None, ref_id: str) -> list[str]:
        """Sections a retrieved chunk stands for, in the order the pack lists them."""
        if ref_id in self.text:
            return [ref_id]
        if self._db is None:
            return [ref_id]  # no pack: assume the ref is a section id
        con = self._db
        single = {"fact": ("fact", "fact_id"), "term": ("term", "term_id")}
        multi = {"answer": ("answer", "answer_id"), "question": ("question", "q_id"),
                 "diagram": ("diagram", "diagram_id")}
        try:
            if ref_kind in single:
                t, k = single[ref_kind]
                row = con.execute(f"SELECT section_id FROM {t} WHERE {k}=?", (ref_id,)).fetchone()
                return [row[0]] if row else []
            if ref_kind in multi:
                t, k = multi[ref_kind]
                row = con.execute(f"SELECT section_ids FROM {t} WHERE {k}=?", (ref_id,)).fetchone()
                return json.loads(row[0]) if row else []
            if ref_kind == "proc_step":
                proc, _, ordv = ref_id.rpartition(":")
                row = con.execute("SELECT section_ids FROM proc_step WHERE proc_id=? AND ord=?",
                                  (proc, int(ordv) if ordv.isdigit() else -1)).fetchone()
                return json.loads(row[0]) if row else []
            if ref_kind == "explanation":
                return [ref_id.split(":")[0]] if ref_id.split(":")[0] in self.text else []
        except (sqlite3.Error, ValueError, json.JSONDecodeError):
            return []
        return []

    def chunk_kind(self, chunk_id: str) -> str | None:
        if self._db is None:
            return None
        try:
            row = self._db.execute("SELECT ref_kind FROM chunk WHERE chunk_id=?", (chunk_id,)).fetchone()
        except sqlite3.Error:
            return None
        return row[0] if row else None
