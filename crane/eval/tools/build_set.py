#!/usr/bin/env python3
"""Assemble, verify and dedupe the held-out set from authored batches.

    python3 crane/eval/tools/build_set.py --sections sections.jsonl --raw raw/ \
        [--review review.json] --out crane/eval/heldout-v1.jsonl --log verify-log.json

Every check here is deterministic against sections.jsonl (the eCFR text):
  * every gold section id exists;
  * every key quote is an exact substring (whitespace-normalized) of its
    section's own text, or of a descendant's, in which case the quote is
    re-pointed to the most specific paragraph that contains it; table quotes may
    be split on the cell separator " | " and each cell must appear in the table;
  * the quote's section is one of the gold sections or their relatives, else it
    is added to them;
  * near-duplicate questions are dropped: token Jaccard >= 0.6, or the same
    gold sections and Jaccard >= 0.15 (the same ask, reworded).
Items whose quote fails are kept without the quote only if the gold sections
still verify, and the failure is logged; items with no valid gold section are
dropped. --review applies an independent judge's verdicts (drop / flag).
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def tokens(s: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", s.lower())) - {"the", "a", "an", "to", "of", "is", "do", "i", "we", "it", "and", "or", "for", "on", "in"}


def related(a: str, b: str) -> bool:
    return a == b or a.startswith(b + "(") or b.startswith(a + "(") or a.startswith(b + "-") or b.startswith(a + "-")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sections", type=Path, required=True)
    ap.add_argument("--raw", type=Path, required=True)
    ap.add_argument("--review", type=Path)
    ap.add_argument("--overrides", type=Path)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--log", type=Path, required=True)
    ap.add_argument("--authored-at", default="2026-11-27")
    ap.add_argument("--id-prefix", default="crane-v1")
    ap.add_argument("--avoid", type=Path, help="an existing set: drop near-duplicates of its questions too")
    a = ap.parse_args()

    secs = {json.loads(l)["section_id"]: json.loads(l) for l in a.sections.open()}
    children: dict[str, list[str]] = {}
    for s in secs.values():
        if s["parent_id"]:
            children.setdefault(s["parent_id"], []).append(s["section_id"])

    def descendants(sid: str) -> list[str]:
        out = []
        for c in children.get(sid, []):
            out.append(c)
            out.extend(descendants(c))
        return out

    log = {"batches": {}, "dropped": [], "repaired": [], "quote_dropped": [], "dedupe": [], "review": []}
    items: list[dict] = []
    for f in sorted(a.raw.glob("*.json")):
        res = json.loads(f.read_text())
        batch_id = res["batch"]
        log["batches"][batch_id] = {"items": len(res["output"]["items"]), "models": res["models"], "cost_usd": res["cost_usd"]}
        for n, it in enumerate(res["output"]["items"], 1):
            decline = it["category"].startswith("decline-")
            src = f"{batch_id}-{n:02d}"
            item = {
                "question": norm(it["question"]),
                "style": it["style"],
                "category": it["category"],
                "gold_answer": norm(it["gold_answer"]),
                "section_ids": [] if decline else list(dict.fromkeys(it["section_ids"])),
                "nearest_section_ids": [s for s in it.get("nearest_section_ids", []) if s in secs] if decline else [],
                "key_quote": None if decline else it.get("key_quote"),
                "must_decline": decline,
                "equipment": it.get("equipment"),
                "variant": it.get("variant") or None,
                "difficulty": it["difficulty"],
                "expert_review": {"needed": bool(it.get("expert_review_needed", False)),
                                  "why": it.get("expert_review_why") or None},
                "_src": src,
            }
            if decline:
                bad = [s for s in it.get("nearest_section_ids", []) if s not in secs]
                if bad:
                    log["repaired"].append({"src": src, "removed_nearest": bad})
                items.append(item)
                continue
            bad = [s for s in item["section_ids"] if s not in secs]
            if bad:
                item["section_ids"] = [s for s in item["section_ids"] if s in secs]
                log["repaired"].append({"src": src, "removed_unknown_ids": bad})
            if not item["section_ids"]:
                log["dropped"].append({"src": src, "why": "no gold section exists", "ids": bad})
                continue
            kq = item["key_quote"]
            if kq:
                kq["text"] = norm(kq["text"]).strip(" ;")
                found, how = locate(kq, item["section_ids"], secs, descendants)
                if found is None:
                    log["quote_dropped"].append({"src": src, "quote": kq})
                    item["key_quote"] = None
                else:
                    if found != kq["section_id"]:
                        log["repaired"].append({"src": src, "quote_moved": [kq["section_id"], found]})
                    kq["section_id"] = found
                    kq["match"] = how
                    if not any(related(found, s) for s in item["section_ids"]):
                        item["section_ids"].append(found)
                        log["repaired"].append({"src": src, "added_quote_section": found})
            items.append(item)

    if a.review and a.review.exists():
        verdicts = json.loads(a.review.read_text())
        kept = []
        for it in items:
            v = verdicts.get(it["_src"])
            if v and v["verdict"] == "drop":
                log["review"].append({"src": it["_src"], "verdict": "drop", "why": v["why"]})
                continue
            if v and v["verdict"] == "flag" and not it["expert_review"]["needed"]:
                it["expert_review"] = {"needed": True, "why": f"independent check: {v['why']}"}
                log["review"].append({"src": it["_src"], "verdict": "flag", "why": v["why"]})
            if v and v.get("corrected_answer"):
                it["gold_answer"] = norm(v["corrected_answer"])
                log["review"].append({"src": it["_src"], "verdict": "corrected", "why": v["why"]})
            kept.append(it)
        items = kept

    if a.overrides and a.overrides.exists():
        ov = {k: v for k, v in json.loads(a.overrides.read_text()).items() if not k.startswith("_")}
        log["overrides"] = []
        for it in items:
            o = ov.get(it["_src"])
            if not o:
                continue
            if o.get("drop"):
                it["_drop"] = True
                log["overrides"].append({"src": it["_src"], "dropped": True, "note": o.get("note")})
                continue
            for k in ("question", "gold_answer"):
                if k in o:
                    it[k] = norm(o[k])
            if "section_ids" in o:
                bad = [s for s in o["section_ids"] if s not in secs]
                if bad:
                    raise SystemExit(f"override {it['_src']}: unknown section ids {bad}")
                it["section_ids"] = o["section_ids"]
                kq = it.get("key_quote")
                if kq and not any(related(kq["section_id"], s) for s in it["section_ids"]):
                    it["section_ids"].append(kq["section_id"])
            if "expert_review" in o:
                it["expert_review"] = o["expert_review"]
            elif o.get("clear_review_flag") and it["expert_review"]["why"] and \
                    it["expert_review"]["why"].startswith("independent check:"):
                it["expert_review"] = {"needed": False, "why": None}
            log["overrides"].append({"src": it["_src"], "note": o.get("note")})
        missing = set(ov) - {it["_src"] for it in items}
        if missing:
            raise SystemExit(f"overrides for unknown items: {sorted(missing)}")
        items = [it for it in items if not it.get("_drop")]

    kept = []
    prior = [{"_src": f"avoid:{x['id']}", "question": x["question"], "section_ids": x.get("section_ids") or []}
             for x in map(json.loads, a.avoid.open())] if a.avoid else []
    for it in items:
        t = tokens(it["question"])
        dup = None
        for k in prior + kept:
            u = tokens(k["question"])
            j = len(t & u) / len(t | u) if t and u else 0.0
            same_gold = bool(it["section_ids"]) and set(it["section_ids"]) == set(k["section_ids"])
            if j >= 0.6 or (same_gold and j >= 0.15):
                dup = k
                break
        if dup:
            log["dedupe"].append({"dropped": it["_src"], "kept": dup["_src"], "q": it["question"]})
            continue
        kept.append(it)

    a.out.parent.mkdir(parents=True, exist_ok=True)
    with a.out.open("w") as f:
        for i, it in enumerate(kept, 1):
            src = it.pop("_src")
            row = {"id": f"{a.id_prefix}-{i:04d}", **it,
                   "provenance": {"author": "claude-opus-5-5", "batch": src, "authored_at": a.authored_at}}
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    log["final"] = len(kept)
    a.log.write_text(json.dumps(log, indent=1, ensure_ascii=False))
    print(json.dumps({k: (len(v) if isinstance(v, list) else v) for k, v in log.items() if k != "batches"}))


def locate(kq: dict, gold: list[str], secs: dict, descendants) -> tuple[str | None, str | None]:
    """Most specific section whose own text contains the quote."""
    q = kq["text"]
    starts = [kq["section_id"]] + gold if kq["section_id"] in secs else list(gold)
    for start in starts:
        cand = [start] + descendants(start)
        hits = [c for c in cand if q in secs[c]["text"]]
        if hits:
            return max(hits, key=lambda c: secs[c]["depth"]), "exact"
    for start in starts:
        if secs[start]["kind"] == "table":
            cells = [c.strip() for c in q.split("|") if c.strip()]
            if cells and all(c in secs[start]["text"] for c in cells):
                return start, "table-cells"
    # anywhere in the same top-level section
    tops = {s.split("(")[0].split("-table")[0] for s in starts}
    for sid, s in secs.items():
        if sid.split("(")[0].split("-table")[0] in tops and q in s["text"]:
            return sid, "exact-elsewhere-in-section"
    return None, None


if __name__ == "__main__":
    main()
