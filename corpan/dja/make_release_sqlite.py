#!/usr/bin/env python3
from __future__ import annotations
import argparse
import sqlite3
import gzip
import shutil
import sys
from pathlib import Path

SCHEMA_SQL = """
CREATE TABLE cor_entry(
  id INTEGER PRIMARY KEY,
  en_text TEXT NOT NULL,
  level TEXT NOT NULL
);
CREATE TABLE cor_domain(
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL
);
CREATE TABLE cor_entry_domains(
  entry_id INTEGER NOT NULL,
  domain_id INTEGER NOT NULL
);
CREATE TABLE cor_language(
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL
);
CREATE TABLE cor_translation(
  entry_id INTEGER NOT NULL,
  language_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  romanization TEXT NOT NULL
);

-- Minimal helpful indexes
CREATE INDEX cor_translation_entry_id    ON cor_translation(entry_id);
CREATE INDEX cor_entry_domains_entry_id  ON cor_entry_domains(entry_id);
CREATE INDEX cor_entry_domains_domain_id ON cor_entry_domains(domain_id);
CREATE INDEX cor_domain_code             ON cor_domain(code);
"""

COPY_SQL = """
INSERT INTO cor_entry(id, en_text, level)
SELECT id, en_text, COALESCE(level, '')
FROM src.cor_entry;
INSERT INTO cor_domain(id, code)
SELECT id, code
FROM src.cor_domain;
INSERT INTO cor_entry_domains(entry_id, domain_id)
SELECT entry_id, domain_id
FROM src.cor_entry_domains;
INSERT INTO cor_language(id, code)
SELECT id, code
FROM src.cor_language;
INSERT INTO cor_translation(entry_id, language_id, text, romanization)
SELECT entry_id,
       language_id,
       COALESCE(text, ''),
       COALESCE(romanization, '')
FROM src.cor_translation;
"""


def fmt_bytes(n: int) -> str:
    for u in ("B", "KB", "MB", "GB"):
        if n < 1024 or u == "GB":
            return f"{n} {u}" if u == "B" else f"{n:.1f} {u}"
        n /= 1024


def gz_size(p: Path) -> int | None:
    try:
        gz = p.with_suffix(p.suffix + ".gz")
        with open(p, "rb") as src, gzip.open(gz, "wb", compresslevel=9) as dst:
            shutil.copyfileobj(src, dst)
        return gz.stat().st_size
    except Exception:
        return None


def assert_cols(conn: sqlite3.Connection, t: str, cols: list[str]) -> None:
    got = {r[1] for r in conn.execute(f"PRAGMA src.table_info('{t}')")}
    missing = [c for c in cols if c not in got]
    if missing:
        raise RuntimeError(f"Source table {t} missing columns: {missing}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="src", type=Path, default=Path("db.sqlite3"))
    ap.add_argument("--out", dest="dst", type=Path, default=Path("release.sqlite3"))
    ap.add_argument("--page-size", type=int, default=4096)
    args = ap.parse_args()

    src = args.src.resolve()
    dst = args.dst.resolve()
    if not src.exists():
        print(f"Source DB not found: {src}", file=sys.stderr)
        sys.exit(1)
    if dst.exists():
        dst.unlink()

    conn = sqlite3.connect(str(dst))
    conn.isolation_level = None  # autocommit

    # Pack settings BEFORE schema
    conn.execute(f"PRAGMA page_size={args.page_size};")
    conn.execute("PRAGMA journal_mode=OFF;")
    conn.execute("PRAGMA synchronous=OFF;")
    conn.execute("PRAGMA temp_store=MEMORY;")
    conn.execute("PRAGMA foreign_keys=OFF;")

    # Attach source read-only
    src_esc = str(src).replace("'", "''")
    conn.execute(f"ATTACH DATABASE 'file:{src_esc}?mode=ro&immutable=1' AS src;")

    # Fail-fast on required columns
    assert_cols(conn, "cor_entry", ["id", "en_text", "level"])
    assert_cols(conn, "cor_domain", ["id", "code"])
    assert_cols(conn, "cor_entry_domains", ["entry_id", "domain_id"])
    assert_cols(conn, "cor_language", ["id", "code"])
    assert_cols(
        conn, "cor_translation", ["entry_id", "language_id", "text", "romanization"]
    )

    # Build and copy (autocommit)
    conn.executescript(SCHEMA_SQL)
    conn.executescript(COPY_SQL)

    # Detach src BEFORE ANALYZE (src is read-only)
    conn.execute("DETACH DATABASE src;")

    # Stats & repack for main only
    conn.execute("ANALYZE;")  # or "ANALYZE main;"
    conn.execute("PRAGMA optimize;")
    conn.execute("VACUUM;")
    conn.close()

    # Report sizes
    orig = src.stat().st_size
    new = dst.stat().st_size
    gz = gz_size(dst)
    print("== Built release DB ==")
    print(f"Source:  {src}   size={fmt_bytes(orig)}")
    print(f"Output:  {dst}   size={fmt_bytes(new)}")
    if gz:
        print(f"Output (.gz): {fmt_bytes(gz)}")

    # Optional breakdown
    try:
        c2 = sqlite3.connect(str(dst))
        rows = c2.execute("""
          SELECT name, SUM(pgsize) AS bytes
          FROM dbstat
          GROUP BY name
          ORDER BY bytes DESC
        """).fetchall()
        print("\n== release.sqlite layout (dbstat) ==")
        for n, b in rows:
            print(f"{n:<40} {fmt_bytes(b)}")
        c2.close()
    except sqlite3.OperationalError:
        pass


if __name__ == "__main__":
    main()
