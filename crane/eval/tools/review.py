#!/usr/bin/env python3
"""Independent check of authored items by a different model (Sonnet) against the text.

    python3 crane/eval/tools/review.py --sections sections.jsonl --raw raw/ --out review.json [--jobs 3]

For answerable items the reviewer sees the question, the gold answer and the
full text of every gold section (with descendants). For must-decline items it
sees the question and the ten sections that share the most words with it, so it
can say whether the sources actually answer it. Verdicts: keep, flag (needs an
expert), drop (wrong, unanswerable, or answerable when it should decline), with
an optional corrected gold answer. Results are cached per item in review.json.
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import json
import math
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from author import call  # noqa: E402

SYSTEM = """You are checking a test set for a crane-regulation question-answering tool. Its only sources are 29 CFR 1926 Subpart CC and 29 CFR 1910.179, .180, .184. For each item you get the question, the expected (gold) answer and the regulation text. Be strict and literal.

For an ANSWERABLE item: verdict "keep" if the gold answer is correct, complete enough for the question, and supported by the given text; "flag" if it is defensible but depends on interpretation or the question is ambiguous enough that an expert should look; "drop" if the gold answer is wrong, contradicts the text, or the question cannot be answered from the text. If a small fix makes the gold answer right, give corrected_answer (1-3 sentences) and verdict "keep".
For a MUST-DECLINE item: verdict "keep" if the core of the question is NOT answered by the sources; "drop" if the given text (or what you know these regulations contain) answers it; "flag" if it is borderline.
why: one short line."""

SCHEMA = {"type": "object", "properties": {"verdicts": {"type": "array", "items": {"type": "object", "properties": {
    "key": {"type": "string"}, "verdict": {"type": "string", "enum": ["keep", "flag", "drop"]},
    "why": {"type": "string"}, "corrected_answer": {"anyOf": [{"type": "null"}, {"type": "string"}]}},
    "required": ["key", "verdict", "why", "corrected_answer"]}}}, "required": ["verdicts"]}


def toks(s: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", s.lower())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sections", type=Path, required=True)
    ap.add_argument("--raw", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--jobs", type=int, default=3)
    ap.add_argument("--model", default="sonnet")
    ap.add_argument("--per-call", type=int, default=10)
    a = ap.parse_args()
    secs = {json.loads(l)["section_id"]: json.loads(l) for l in a.sections.open()}
    if any("subtree_text" not in s for s in secs.values()):  # the committed file keeps own text only
        kids: dict[str, list[str]] = {}
        for s in secs.values():
            if s["parent_id"]:
                kids.setdefault(s["parent_id"], []).append(s["section_id"])

        def sub(sid: str) -> str:
            return " ".join(t for t in [secs[sid]["text"]] + [sub(c) for c in kids.get(sid, [])] if t)
        for sid in secs:
            secs[sid]["subtree_text"] = sub(sid)
    done = json.loads(a.out.read_text()) if a.out.exists() else {}

    df = Counter()
    for s in secs.values():
        df.update(set(toks(s["text"])))
    N = len(secs)

    def nearest(q: str, k: int = 10) -> list[str]:
        qt = set(toks(q))
        scored = []
        for sid, s in secs.items():
            st = Counter(toks(s["text"]))
            score = sum(math.log(N / (1 + df[t])) * (1 + math.log(st[t])) for t in qt if st[t])
            if score:
                scored.append((score, sid))
        return [sid for _, sid in sorted(scored, reverse=True)[:k]]

    blocks = []
    for f in sorted(a.raw.glob("*.json")):
        res = json.loads(f.read_text())
        for n, it in enumerate(res["output"]["items"], 1):
            key = f"{res['batch']}-{n:02d}"
            if key in done:
                continue
            if it["category"].startswith("decline-"):
                ctx = "\n".join(f"[{s}] {secs[s]['subtree_text'][:1200]}" for s in nearest(it["question"]))
                blocks.append((key, f"KEY {key}\nTYPE MUST-DECLINE\nQUESTION {it['question']}\n"
                                    f"WHY IT SHOULD DECLINE {it['gold_answer']}\nCLOSEST TEXT\n{ctx}\n"))
            else:
                ids = [s for s in it["section_ids"] if s in secs]
                ctx = "\n".join(f"[{s}] {secs[s]['subtree_text'][:4000]}" for s in ids) or "(no valid section)"
                blocks.append((key, f"KEY {key}\nTYPE ANSWERABLE\nQUESTION {it['question']}\n"
                                    f"GOLD ANSWER {it['gold_answer']}\nTEXT\n{ctx}\n"))
    groups = [blocks[i:i + a.per_call] for i in range(0, len(blocks), a.per_call)]

    def run(g):
        prompt = "Check each item. Return one verdict per KEY.\n\n" + "\n---\n".join(b for _, b in g)
        res = call(SYSTEM, SCHEMA, prompt, a.model)
        return {v["key"]: {**v, "model": res["models"]} for v in res["output"]["verdicts"]}

    with cf.ThreadPoolExecutor(max_workers=min(a.jobs, 3)) as ex:
        for fut in cf.as_completed([ex.submit(run, g) for g in groups]):
            try:
                done.update(fut.result())
                a.out.write_text(json.dumps(done, indent=1, ensure_ascii=False))
                print(len(done), flush=True)
            except Exception as e:  # noqa: BLE001
                print(f"ERROR {e}", file=sys.stderr, flush=True)
    c = Counter(v["verdict"] for v in done.values())
    print(dict(c), sum(1 for v in done.values() if v.get("corrected_answer")), "corrected")


if __name__ == "__main__":
    main()
