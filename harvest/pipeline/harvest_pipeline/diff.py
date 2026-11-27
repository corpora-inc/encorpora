"""Edition diff between two packs (or stages): sections added, removed, changed."""

from __future__ import annotations

import difflib
import sqlite3


def _sections(path: str) -> dict[str, tuple]:
    conn = sqlite3.connect(path)
    rows = conn.execute("SELECT section_id, citation, kind, text_sha256, text, source_id FROM section").fetchall()
    conn.close()
    return {r[0]: r[1:] for r in rows}


def diff_packs(old: str, new: str, kinds: set[str] | None = None) -> dict:
    a, b = _sections(old), _sections(new)
    keep = (lambda sid, row: not kinds or row[1] in kinds)
    added = sorted(s for s in b.keys() - a.keys() if keep(s, b[s]))
    removed = sorted(s for s in a.keys() - b.keys() if keep(s, a[s]))
    changed = []
    for s in sorted(a.keys() & b.keys()):
        if a[s][2] != b[s][2] and keep(s, b[s]):
            ud = list(difflib.unified_diff(a[s][3].split("\n"), b[s][3].split("\n"), lineterm="", n=0))
            changed.append({"section_id": s, "citation": b[s][0], "kind": b[s][1], "diff": ud[2:]})
    return {"added": [{"section_id": s, "citation": b[s][0], "kind": b[s][1]} for s in added],
            "removed": [{"section_id": s, "citation": a[s][0], "kind": a[s][1]} for s in removed],
            "changed": changed}


def format_diff(d: dict, leaves_only: bool = False) -> str:
    lines = [f"added {len(d['added'])}, removed {len(d['removed'])}, changed {len(d['changed'])}"]
    for r in d["added"]:
        lines.append(f"+ {r['citation']}  ({r['section_id']})")
    for r in d["removed"]:
        lines.append(f"- {r['citation']}  ({r['section_id']})")
    for r in d["changed"]:
        lines.append(f"~ {r['citation']}  ({r['section_id']})")
        lines.extend(f"    {x}" for x in r["diff"][:12])
    return "\n".join(lines)
