"""The pack schema has one source: the core's .sql files. These tests fail on any second copy or drift."""

from __future__ import annotations

import re
import sqlite3
from pathlib import Path

from harvest_pipeline import schema
from harvest_pipeline.stage import Stage

HARVEST = Path(__file__).resolve().parents[2]


def _shape(conn: sqlite3.Connection) -> dict[str, list[tuple]]:
    names = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
    return {t: [tuple(r[1:]) for r in conn.execute(f"PRAGMA table_info({t})")] for t in names}


def _from(ddl: str) -> dict[str, list[tuple]]:
    c = sqlite3.connect(":memory:")
    c.executescript(ddl)
    return _shape(c)


def test_reads_the_core_files():
    assert schema.ddl_v1() == (HARVEST / "core/src/schema_v1.sql").read_text()
    assert schema.ddl_maint() == (HARVEST / "core/src/schema_maint.sql").read_text()


def test_no_second_copy_in_the_pipeline():
    """No pipeline module creates a contract table by hand (stage-only `_` tables are allowed)."""
    contract = set(schema.tables_in(schema.ddl_v1())) | set(schema.maint_tables())
    for py in (HARVEST / "pipeline/harvest_pipeline").rglob("*.py"):
        for name in re.findall(r"CREATE\s+(?:VIRTUAL\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)", py.read_text(), re.I):
            assert name not in contract, f"{py.name} defines contract table {name}; read it from the core's .sql"


def test_contract_md_matches_schema_v1():
    """CONTRACT.md's schema block is the same tables and columns as the core file."""
    text = (HARVEST / "CONTRACT.md").read_text()
    block = re.search(r"## Schema v1.*?```sql\n(.*?)```", text, re.S).group(1)
    assert _from(block) == _from(schema.ddl_v1())


def test_stage_and_pack_tables_are_the_core_tables():
    st = Stage()
    shape = _shape(st.conn)
    want = {**_from(schema.ddl_v1()), **_from(schema.ddl_maint())}
    for t, cols in want.items():
        assert shape.get(t) == cols, t
    assert {t for t in shape if not t.startswith("_") and not t.startswith(("chunk_fts", "alias_fts"))} \
        == {t for t in want if not t.startswith(("chunk_fts", "alias_fts"))}
    v1 = sqlite3.connect(":memory:")
    schema.create(v1)
    assert not schema.has_table(v1, "fault_tree"), "a pack without maintenance rows gets no maintenance tables"
