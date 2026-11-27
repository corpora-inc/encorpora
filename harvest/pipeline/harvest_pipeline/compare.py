"""Item-by-item comparison of two bakes of the same corpus (e.g. frontier vs open-weight backend).

Both stages are rebuilt offline from their committed caches. Items are matched per task:
  terms          normalized term + section
  facts          same section and quote token overlap (Jaccard >= 0.6), else unmatched
  explanations   section + level
  applicability  section + equipment id
For each matched or unmatched item the output row carries both sides' verdict, whether the quote
was verbatim, whether the deterministic checks passed, and the judge's verdict and reason.
"""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from .corpus import Corpus
from .pipeline import build_stage, enrich

TASK_TABLE = {"harvest.terms": "term", "harvest.facts": "fact", "harvest.explanations": "explanation",
              "harvest.applicability": "applies_to"}


def _tokens(s: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", (s or "").lower()))


def _items(stage) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = defaultdict(list)
    for p in stage.conn.execute("SELECT * FROM provenance").fetchall():
        table = TASK_TABLE.get(p["prompt_id"])
        if not table:
            continue
        notes = json.loads(p["notes"] or "{}")
        if table == "applies_to":
            keys = [json.loads(r[0]) for r in stage.conn.execute(
                "SELECT row_key FROM _row_prov WHERE prov_id=?", (p["prov_id"],))]
            rows = [{"ref_kind": k[0], "ref_id": k[1], "equip_id": k[2]} for k in keys]
        else:
            rows = [dict(r) for r in stage.conn.execute(f"SELECT * FROM {table} WHERE prov_id=?", (p["prov_id"],))]
        problems = notes.get("notes") or ""
        by = notes.get("decided_by")
        det_fail = p["verdict"] == "fail" and by == "deterministic"
        for r in rows or [{}]:
            out[p["prompt_id"]].append({
                "key": notes.get("key"), "index": notes.get("index"), "verdict": p["verdict"], "model": p["model"],
                "quote_ok": "not verbatim" not in problems, "deterministic_ok": not det_fail,
                "judge": {"verdict": p["verdict"], "reason": problems or None} if by == "judge" else None,
                "notes": problems or None, "row": {k: v for k, v in r.items() if k not in ("prov_id", "lang")},
            })
    return out


def _match(task: str, a: list[dict], b: list[dict]) -> list[tuple[dict | None, dict | None]]:
    def k(it):
        r = it["row"]
        if task == "harvest.terms":
            return (re.sub(r"\W+", " ", (r.get("term") or "").lower()).strip(), r.get("section_id"))
        if task == "harvest.explanations":
            return (r.get("section_id"), r.get("level"))
        if task == "harvest.applicability":
            return (r.get("ref_id"), r.get("equip_id"))
        return None

    pairs: list[tuple[dict | None, dict | None]] = []
    if task != "harvest.facts":
        bk = defaultdict(list)
        for it in b:
            bk[k(it)].append(it)
        for it in a:
            m = bk.get(k(it))
            pairs.append((it, m.pop(0) if m else None))
        pairs += [(None, it) for v in bk.values() for it in v]
        return pairs
    used = set()
    for it in a:
        ta, sa = _tokens(it["row"].get("quote")), it["row"].get("section_id")
        best, score = None, 0.0
        for j, other in enumerate(b):
            if j in used or other["row"].get("section_id") != sa:
                continue
            tb = _tokens(other["row"].get("quote"))
            s = len(ta & tb) / max(1, len(ta | tb))
            if s > score:
                best, score = j, s
        if best is not None and score >= 0.6:
            used.add(best)
            pairs.append((it, b[best]))
        else:
            pairs.append((it, None))
    pairs += [(None, it) for j, it in enumerate(b) if j not in used]
    return pairs


def compare(corpus: Corpus, a_name: str, b_name: str, out: Path) -> dict:
    stages = {}
    for name in (a_name, b_name):
        prof = corpus.profile(name)
        stage, _ = build_stage(corpus, log=None)
        enrich(corpus, prof, stage, offline=True, log=None)
        stages[name] = _items(stage)
    out.parent.mkdir(parents=True, exist_ok=True)
    summary: dict = {"a": a_name, "b": b_name, "tasks": {}}
    with out.open("w") as fh:
        for task in sorted(set(stages[a_name]) | set(stages[b_name])):
            A, B = stages[a_name].get(task, []), stages[b_name].get(task, [])
            c = Counter()
            for x, y in _match(task, A, B):
                row = {"task": task.split(".", 1)[1], a_name: x, b_name: y,
                       "matched": x is not None and y is not None,
                       "verdict_agree": (x or {}).get("verdict") == (y or {}).get("verdict") if x and y else None}
                fh.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")
                c["matched"] += row["matched"]
                c["agree"] += bool(row["verdict_agree"])
            def side(items):
                n = len(items)
                return {"items": n, "pass": sum(i["verdict"] == "pass" for i in items),
                        "quote_ok": sum(i["quote_ok"] for i in items),
                        "deterministic_ok": sum(i["deterministic_ok"] for i in items),
                        "inputs": len({i["key"] for i in items})}
            summary["tasks"][task] = {a_name: side(A), b_name: side(B), "matched": c["matched"],
                                      "matched_verdict_agree": c["agree"]}
    summary["file"] = str(out)
    out.with_suffix(".summary.json").write_text(json.dumps(summary, indent=2))
    return summary
