"""The stage: a pack-schema SQLite database holding everything parsed and generated so far.

Tasks read it (sections, and rows earlier tasks wrote) and write their rows into it. The
release writer copies it into a pack, keeping only rows whose provenance verdict is `pass`.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from . import schema
from .model import ParsedDoc, subtree_text
from .textutil import norm_lines, sha256_text


class Stage:
    def __init__(self, path: str | Path = ":memory:"):
        if path != ":memory:":
            p = Path(path)
            p.parent.mkdir(parents=True, exist_ok=True)
            if p.exists():
                p.unlink()
        self.conn = sqlite3.connect(str(path))
        self.conn.row_factory = sqlite3.Row
        schema.create(self.conn, stage=True)
        self._ord = 0
        self._text_cache: dict[str, str] = {}

    # ---- writing parsed material -------------------------------------------------------
    def add_source(self, rec: dict) -> None:
        cols = ["source_id", "title", "publisher", "url", "edition", "retrieved_at", "sha256", "media_type", "license"]
        self.conn.execute(f"INSERT INTO source ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})",
                          [rec[c] for c in cols])

    def add_doc(self, doc: ParsedDoc, lang: str = "en") -> int:
        n = 0
        for node, depth in doc.walk():
            text = norm_lines(subtree_text(node))
            self._ord += 1
            self.conn.execute(
                "INSERT INTO section (section_id, source_id, parent_id, ord, depth, kind, citation, heading, text,"
                " text_sha256, lang) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                (node.section_id, doc.source_id, node.parent_id, self._ord, depth, node.kind, node.citation,
                 node.heading, text, sha256_text(text), node.lang or lang))
            n += 1
        for x in doc.xrefs:
            self.conn.execute("INSERT OR IGNORE INTO xref (from_id, to_id, kind) VALUES (?,?,?)",
                              (x.from_id, x.to_id, x.kind))
        return n

    def add_equipment(self, items: list[dict]) -> None:
        for e in items:
            self.conn.execute("INSERT INTO equipment (equip_id, parent_id, name, aliases) VALUES (?,?,?,?)",
                              (e["id"], e.get("parent"), e["name"], json.dumps(e.get("aliases") or [])))

    def finalize_xrefs(self) -> None:
        """Cross-source references parsed as 'external' resolve to 'cites' once both sources are staged."""
        rows = self.conn.execute("SELECT from_id, to_id FROM xref WHERE kind='external'").fetchall()
        for r in rows:
            to = r["to_id"]
            while to:
                if self.exists(to):
                    self.conn.execute("DELETE FROM xref WHERE from_id=? AND to_id=? AND kind='external'",
                                      (r["from_id"], r["to_id"]))
                    self.conn.execute("INSERT OR IGNORE INTO xref VALUES (?,?,'cites')", (r["from_id"], to))
                    break
                if "(" not in to:
                    break
                to = to[: to.rfind("(")]

    # ---- reading -----------------------------------------------------------------------
    def exists(self, section_id: str) -> bool:
        return self.conn.execute("SELECT 1 FROM section WHERE section_id=?", (section_id,)).fetchone() is not None

    def section(self, section_id: str) -> sqlite3.Row | None:
        return self.conn.execute("SELECT * FROM section WHERE section_id=?", (section_id,)).fetchone()

    def text(self, section_id: str) -> str | None:
        if section_id not in self._text_cache:
            r = self.conn.execute("SELECT text FROM section WHERE section_id=?", (section_id,)).fetchone()
            if r is None:
                return None
            self._text_cache[section_id] = r[0]
        return self._text_cache[section_id]

    def sections(self, kinds: tuple[str, ...] | None = None, source_ids: set[str] | None = None) -> list[sqlite3.Row]:
        rows = self.conn.execute("SELECT * FROM section ORDER BY ord").fetchall()
        return [r for r in rows if (not kinds or r["kind"] in kinds) and (not source_ids or r["source_id"] in source_ids)]

    def children(self, section_id: str) -> list[sqlite3.Row]:
        return self.conn.execute("SELECT * FROM section WHERE parent_id=? ORDER BY ord", (section_id,)).fetchall()

    def descendants(self, section_id: str) -> list[sqlite3.Row]:
        out = []
        stack = [section_id]
        while stack:
            sid = stack.pop()
            kids = self.children(sid)
            out.extend(kids)
            stack.extend(k["section_id"] for k in reversed(kids))
        return sorted(out, key=lambda r: r["ord"])

    def equipment(self) -> list[sqlite3.Row]:
        return self.conn.execute("SELECT * FROM equipment ORDER BY equip_id").fetchall()

    def rows(self, table: str, only_pass: bool = True) -> list[sqlite3.Row]:
        """Rows of a generated table; by default only those whose provenance verdict is pass."""
        cols = schema.table_columns(self.conn, table)
        if only_pass and "prov_id" in cols:
            return self.conn.execute(
                f"SELECT t.* FROM {table} t JOIN provenance p ON p.prov_id = t.prov_id WHERE p.verdict='pass'"
            ).fetchall()
        return self.conn.execute(f"SELECT * FROM {table}").fetchall()

    # ---- writing generated rows ----------------------------------------------------------
    def insert(self, table: str, row: dict, prov_id: str | None = None, replace: bool = False) -> bool:
        cols = list(row)
        verb = "INSERT OR REPLACE" if replace else "INSERT OR IGNORE"
        cur = self.conn.execute(f"{verb} INTO {table} ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})",
                                [row[c] for c in cols])
        if prov_id and "prov_id" not in row:
            key = json.dumps([row[c] for c in cols[:3]], ensure_ascii=False, separators=(",", ":"))
            self.conn.execute("INSERT OR IGNORE INTO _row_prov VALUES (?,?,?)", (table, key, prov_id))
        return cur.rowcount > 0

    def add_provenance(self, prov: dict) -> None:
        cols = ["prov_id", "backend", "model", "prompt_id", "prompt_version", "prompt_sha256", "input_sha256",
                "output_sha256", "created_at", "verifier", "verdict", "notes"]
        self.conn.execute(f"INSERT OR REPLACE INTO provenance ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})",
                          [prov.get(c) for c in cols])

    def commit(self) -> None:
        self.conn.commit()
