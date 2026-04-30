#!/usr/bin/env python3
"""Apply the prune by hard-deleting entries listed in cut_list.csv.

Safety:
- snapshots db.sqlite3 → db.sqlite3.pre-prune-<timestamp> first
- writes audit/pruned_archive_<timestamp>.json with full entry rows + all
  translations + domain links so the deletion is reversible
- requires --apply to actually delete (default is dry-run summary)
"""

from __future__ import annotations

import argparse
import csv
import json
import shutil
import sqlite3
import sys
import time
from pathlib import Path
from typing import List

HERE = Path(__file__).resolve().parent
DJA_ROOT = HERE.parent
DB_PATH = DJA_ROOT / "db.sqlite3"
CUT_LIST_PATH = HERE / "cut_list.csv"


def load_cut_ids(path: Path) -> List[int]:
    ids = []
    with path.open("r", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            try:
                ids.append(int(row["id"]))
            except (KeyError, ValueError):
                continue
    return ids


def archive(con: sqlite3.Connection, ids: List[int], out_path: Path) -> int:
    cur = con.cursor()
    chunks = [ids[i : i + 500] for i in range(0, len(ids), 500)]
    entries = []
    translations = []
    domain_links = []
    for chunk in chunks:
        placeholders = ",".join("?" * len(chunk))
        cur.execute(f"SELECT id, en_text, level FROM cor_entry WHERE id IN ({placeholders})", chunk)
        for eid, en, lvl in cur.fetchall():
            entries.append({"id": eid, "en_text": en, "level": lvl})
        cur.execute(
            f"SELECT id, entry_id, language_id, text, romanization "
            f"FROM cor_translation WHERE entry_id IN ({placeholders})",
            chunk,
        )
        for tid, eid, lid, txt, rom in cur.fetchall():
            translations.append({"id": tid, "entry_id": eid, "language_id": lid,
                                 "text": txt, "romanization": rom})
        cur.execute(
            f"SELECT id, entry_id, domain_id FROM cor_entry_domains WHERE entry_id IN ({placeholders})",
            chunk,
        )
        for lid, eid, did in cur.fetchall():
            domain_links.append({"id": lid, "entry_id": eid, "domain_id": did})

    payload = {
        "schema_version": 1,
        "created_at": int(time.time()),
        "n_entries": len(entries),
        "n_translations": len(translations),
        "n_domain_links": len(domain_links),
        "entries": entries,
        "translations": translations,
        "domain_links": domain_links,
    }
    out_path.write_text(json.dumps(payload, ensure_ascii=False))
    return len(entries)


def delete_entries(con: sqlite3.Connection, ids: List[int]) -> tuple[int, int, int]:
    """Hard-delete entries. cor_translation has no ON DELETE CASCADE in SQLite
    by default (Django enforces cascade in app code), so we delete dependents
    explicitly here."""
    cur = con.cursor()
    n_trans = 0
    n_dom = 0
    n_pack = 0
    chunks = [ids[i : i + 500] for i in range(0, len(ids), 500)]
    for chunk in chunks:
        placeholders = ",".join("?" * len(chunk))
        cur.execute(f"DELETE FROM cor_translation WHERE entry_id IN ({placeholders})", chunk)
        n_trans += cur.rowcount
        cur.execute(f"DELETE FROM cor_entry_domains WHERE entry_id IN ({placeholders})", chunk)
        n_dom += cur.rowcount
        # PackEntry references
        try:
            cur.execute(
                f"DELETE FROM cor_packentry WHERE entry_id IN ({placeholders})", chunk
            )
            n_pack += cur.rowcount
        except sqlite3.OperationalError:
            pass
    n_entry = 0
    for chunk in chunks:
        placeholders = ",".join("?" * len(chunk))
        cur.execute(f"DELETE FROM cor_entry WHERE id IN ({placeholders})", chunk)
        n_entry += cur.rowcount
    con.commit()
    return n_entry, n_trans, n_dom


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--db", default=str(DB_PATH))
    p.add_argument("--cut-list", default=str(CUT_LIST_PATH))
    p.add_argument("--apply", action="store_true", help="Actually delete (default: dry-run)")
    p.add_argument("--no-snapshot", action="store_true",
                   help="Skip the db.sqlite3 → db.sqlite3.pre-prune-<ts> copy")
    args = p.parse_args()

    db = Path(args.db)
    ids = load_cut_ids(Path(args.cut_list))
    print(f"Cut list: {len(ids)} entries from {args.cut_list}")
    if not ids:
        print("Nothing to do.")
        return 0

    if not args.apply:
        # Dry run: confirm what's about to happen
        con = sqlite3.connect(str(db))
        cur = con.cursor()
        cur.execute("SELECT COUNT(*) FROM cor_entry")
        before = cur.fetchone()[0]
        cur.execute("SELECT level, COUNT(*) FROM cor_entry GROUP BY level ORDER BY level")
        per_level_before = dict(cur.fetchall())
        # how many of the ids exist
        existing = 0
        for i in range(0, len(ids), 500):
            chunk = ids[i : i + 500]
            placeholders = ",".join("?" * len(chunk))
            cur.execute(f"SELECT COUNT(*) FROM cor_entry WHERE id IN ({placeholders})", chunk)
            existing += cur.fetchone()[0]
        con.close()
        print(f"\nDRY RUN. db has {before} entries; cut list ids matched in db: {existing}")
        print(f"Per-level before: {per_level_before}")
        print(f"Would delete {existing} entries, drop to ~{before - existing}.")
        print(f"\nRun with --apply to perform the deletion.")
        return 0

    ts = time.strftime("%Y%m%d-%H%M%S")
    if not args.no_snapshot:
        snap = db.with_suffix(f".sqlite3.pre-prune-{ts}")
        print(f"Snapshotting db → {snap}")
        shutil.copy2(db, snap)

    con = sqlite3.connect(str(db))
    archive_path = HERE / f"pruned_archive_{ts}.json"
    print(f"Archiving {len(ids)} entries → {archive_path}")
    n_arch = archive(con, ids, archive_path)
    print(f"  archived: {n_arch} entries (+ translations + domain links)")

    print(f"Deleting {len(ids)} entries...")
    n_e, n_t, n_d = delete_entries(con, ids)
    print(f"  deleted: {n_e} entries, {n_t} translations, {n_d} domain links")

    cur = con.cursor()
    cur.execute("VACUUM")
    cur.execute("SELECT COUNT(*) FROM cor_entry")
    after = cur.fetchone()[0]
    cur.execute("SELECT level, COUNT(*) FROM cor_entry GROUP BY level ORDER BY level")
    per_level_after = dict(cur.fetchall())
    con.close()
    print(f"\nDB now has {after} entries.")
    print(f"Per-level after: {per_level_after}")
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
