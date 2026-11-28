"""Pack schema: read from the core's own DDL files, never kept as a second copy here.

`harvest/core/src/schema_v1.sql` is the schema every pack has; `schema_maint.sql` holds the
optional maintenance tables (fault trees, requirements, page locations, assets, symptoms, signal
maps, variant identification). The core compiles the same files in (`include_str!`), so the
pipeline and the core cannot drift. `HARVEST_CORE_SRC` points elsewhere when the pipeline runs
outside a checkout (it must hold both files).
"""

from __future__ import annotations

import os
import re
import sqlite3
from functools import lru_cache
from pathlib import Path


def core_src() -> Path:
    env = os.environ.get("HARVEST_CORE_SRC")
    d = Path(env) if env else Path(__file__).resolve().parents[2] / "core" / "src"
    if not (d / "schema_v1.sql").is_file():
        raise SystemExit(f"pack schema not found: {d / 'schema_v1.sql'} (set HARVEST_CORE_SRC to harvest/core/src)")
    return d


@lru_cache(maxsize=None)
def _read(name: str) -> str:
    return (core_src() / name).read_text()


def ddl_v1() -> str:
    return _read("schema_v1.sql")


def ddl_maint() -> str:
    return _read("schema_maint.sql")


def tables_in(ddl: str) -> list[str]:
    """Table names a DDL creates (virtual tables included), in order."""
    return re.findall(r"CREATE\s+(?:VIRTUAL\s+)?TABLE\s+(\w+)", ddl, re.I)


def maint_tables() -> list[str]:
    return tables_in(ddl_maint())


# Tables whose rows are generated and carry prov_id; a release pack keeps only verdict = 'pass'.
GENERATED = ("term", "fact", "explanation", "lesson", "diagram", "question", "answer", "procedure", "proc_step",
             "course_node")
# Child tables without prov_id, filtered through their parent.
CHILD_FILTERS = {
    "answer_alias": "answer_id IN (SELECT answer_id FROM answer)",
    "applies_to": None,  # filtered by the writer via the applicability provenance side table
}

# Rows that belong to the pipeline but not to the contract schema live in tables prefixed `_`;
# the release writer drops them. `_text_loc`: where on the page each verified text field was
# found (page, normalized box, layout region), until the core's section_loc carries boxes.
STAGE_DDL = """
CREATE TABLE _row_prov (tbl TEXT NOT NULL, row_key TEXT NOT NULL, prov_id TEXT NOT NULL,
                        PRIMARY KEY (tbl, row_key, prov_id));
CREATE TABLE _presentation (symptom_id TEXT PRIMARY KEY, shows TEXT NOT NULL, model TEXT NOT NULL);
CREATE TABLE _text_loc (ref_kind TEXT NOT NULL, ref_id TEXT NOT NULL, field TEXT NOT NULL,
                        source_id TEXT NOT NULL, page_index INTEGER NOT NULL, page_label TEXT,
                        region_id TEXT NOT NULL, bbox TEXT NOT NULL,
                        PRIMARY KEY (ref_kind, ref_id, field));
"""


def create(conn: sqlite3.Connection, stage: bool = False, maint: bool | None = None) -> None:
    """v1 tables; the maintenance tables in a stage always, in a pack when `maint` is true."""
    conn.executescript(ddl_v1())
    if maint or (maint is None and stage):
        conn.executescript(ddl_maint())
    if stage:
        conn.executescript(STAGE_DDL)


def has_table(conn: sqlite3.Connection, table: str) -> bool:
    return conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone() is not None


def table_columns(conn: sqlite3.Connection, table: str) -> list[str]:
    return [r[1] for r in conn.execute(f"PRAGMA table_info({table})")]
