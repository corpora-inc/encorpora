#!/usr/bin/env python3
"""Stand-in for `harvest ask --json` (CONTRACT.md) until harvest-core lands.

Lexical retrieval over the pack's chunk table; answers by quoting the best
section, declines below a score threshold. Deterministic. Only for tests.
"""
import json
import re
import sqlite3
import sys
import time
from pathlib import Path


def main() -> int:
    args = sys.argv[1:]
    if not args or args[0] != "ask":
        print("stub supports only: ask <pack> <question> --json", file=sys.stderr)
        return 2
    pack, question = Path(args[1]), args[2]
    t0 = time.perf_counter()
    db = pack if pack.is_file() else sorted(pack.glob("*.sqlite"))[0]
    con = sqlite3.connect(db)
    q = set(re.findall(r"[a-z0-9]+", question.lower()))
    scored = []
    for cid, kind, ref, text in con.execute("SELECT chunk_id, ref_kind, ref_id, text FROM chunk"):
        t = set(re.findall(r"[a-z0-9]+", text.lower()))
        s = len(q & t) / (len(q) or 1)
        scored.append((s, cid, kind, ref, text))
    scored.sort(key=lambda x: (-x[0], x[1]))
    top = scored[:10]
    version = con.execute("SELECT value FROM pack_meta WHERE key='version'").fetchone()[0]
    retrieved = [{"chunk_id": c, "ref_id": r, "lexical": s, "dense": 0.0, "score": s} for s, c, k, r, _ in top]
    best = top[0] if top else None
    baked = con.execute("SELECT answer_id, section_ids FROM answer WHERE lower(question)=lower(?)",
                        (question,)).fetchone()
    if baked:
        sec = "29cfr9999.10(a)"
        best = (1.0, "c-baked", "section", sec, "")
    if best is None or best[0] < 0.34:
        out = {"mode": "declined", "answer_id": None, "body": [], "citations": [], "retrieved": retrieved,
               "check": {"quotes_ok": True, "cites_ok": True, "dropped": 0},
               "nearest": [r for _, _, _, r, _ in top[:3]]}
    else:
        sec = best[3] if best[2] == "section" else con.execute(
            "SELECT section_id FROM fact WHERE fact_id=?", (best[3],)).fetchone()[0]
        text = con.execute("SELECT text FROM section WHERE section_id=?", (sec,)).fetchone()[0]
        first = re.split(r"(?<=\.)\s", text)[0]
        out = {"mode": "baked" if baked else "composed", "answer_id": baked[0] if baked else None,
               "body": [{"t": "text", "text": f"The rule in {sec} applies."},
                        {"t": "quote", "section_id": sec, "text": first},
                        {"t": "cite", "section_id": sec}],
               "citations": [sec], "retrieved": retrieved,
               "check": {"quotes_ok": True, "cites_ok": True, "dropped": 0}, "nearest": []}
    out.update({"pack_version": version, "model": None, "elapsed_ms": round((time.perf_counter() - t0) * 1000, 2)})
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
