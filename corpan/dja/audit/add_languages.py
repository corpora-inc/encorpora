#!/usr/bin/env python3
"""Insert the 9 new Language rows into db.sqlite3.

Idempotent — uses INSERT OR IGNORE on the unique `code` column.
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DJA_ROOT = HERE.parent
DB_PATH = DJA_ROOT / "db.sqlite3"


NEW_LANGUAGES = [
    ("he", "Hebrew"),
    ("sv", "Swedish"),
    ("fi", "Finnish"),
    ("nl", "Dutch"),
    ("sw", "Swahili"),
    ("no", "Norwegian"),
    ("da", "Danish"),
    ("el", "Greek"),
    ("ms", "Malay"),
]


def main():
    db = sys.argv[1] if len(sys.argv) > 1 else str(DB_PATH)
    con = sqlite3.connect(db)
    cur = con.cursor()
    inserted = 0
    skipped = 0
    for code, name in NEW_LANGUAGES:
        cur.execute(
            "INSERT OR IGNORE INTO cor_language (code, name) VALUES (?, ?)",
            (code, name),
        )
        if cur.rowcount:
            inserted += 1
            print(f"  inserted {code} ({name})")
        else:
            skipped += 1
            print(f"  skipped {code} (already present)")
    con.commit()
    cur.execute("SELECT COUNT(*) FROM cor_language")
    total = cur.fetchone()[0]
    con.close()
    print(f"\nDone. inserted={inserted} skipped={skipped} total_languages={total}")


if __name__ == "__main__":
    main()
