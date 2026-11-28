#!/usr/bin/env python3
"""Deterministic typo and misspelling variants of a held-out set, for search robustness.

    python3 crane/eval/tools/perturb.py --set heldout-v1.jsonl --mode typo1|typo10|misspell --out <jsonl>

Modes (every edit is seeded by the item id, so a set always perturbs the same way):
  typo1     one keyboard typo per question (adjacent swap, dropped, doubled or neighbour key)
            in a word of 4+ letters
  typo10    the same edits in about 10% of the words of 4+ letters (at least one)
  misspell  phonetic misspellings of crane vocabulary people get wrong (outrigger -> outriger,
            "two-blocking" -> "too blocking", ...); questions with none of these words get one typo1
            edit instead, and the item records which kind it got
Never edited: words under 4 letters, anything containing a digit, all-caps words (acronyms such as
NCCCO), and "Subpart", "Appendix", "Table" or "Part" with the word after them. Every typo changes the word.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import random
import re
from pathlib import Path

ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"]
NEIGH: dict[str, str] = {}
for r, row in enumerate(ROWS):
    for c, ch in enumerate(row):
        near = [row[c - 1] if c > 0 else "", row[c + 1] if c + 1 < len(row) else ""]
        for rr in (r - 1, r + 1):
            if 0 <= rr < len(ROWS) and c < len(ROWS[rr]):
                near.append(ROWS[rr][c])
        NEIGH[ch] = "".join(x for x in near if x)

MISSPELL = {
    "outrigger": "outriger", "outriggers": "outrigers", "rigging": "riging", "rigger": "riger",
    "hoist": "hoyst", "hoisting": "hoysting", "derrick": "derick", "derricks": "dericks",
    "personnel": "personel", "barricade": "baracade", "barricades": "baracades",
    "inspection": "inspecshun", "inspections": "inspecshuns", "qualified": "qualifyed",
    "certification": "certifacation", "certified": "certifyed", "clearance": "clearence",
    "voltage": "voltige", "energized": "enerjized", "deenergized": "de-enerjized",
    "counterweight": "counter wieght", "counterweights": "counter wieghts", "capacity": "capasity",
    "radius": "raidius", "boom": "boome", "sheave": "sheeve", "sheaves": "sheeves",
    "shackle": "shackel", "shackles": "shackels", "sling": "slinge", "slings": "slinges",
    "two-blocking": "too blocking", "two-block": "too block", "anti-two-block": "anti too block",
    "assembly": "assembley", "disassembly": "dissasembly", "dismantling": "dismanteling",
    "signal": "signel", "signals": "signels", "operator": "operater", "operators": "operaters",
    "maintenance": "maintainance", "equipment": "equiptment", "foreseeable": "forseeable",
    "crawler": "crawller", "cribbing": "cribing", "pendant": "pendint", "pendants": "pendints",
    "telescoping": "telescopeing", "articulating": "articulateing", "wire": "wyre",
}
WORD = re.compile(r"[A-Za-z][A-Za-z'-]*")
PROTECT_NEXT = {"subpart", "appendix", "table", "part"}


def editable(q: str) -> list[re.Match]:
    """Words a typo may touch: 4+ letters, not an acronym, not the label after Subpart/Appendix/..."""
    out, prev = [], ""
    for m in WORD.finditer(q):
        w = m.group()
        if (len(w) >= 4 and not w.isupper() and w.lower() not in PROTECT_NEXT
                and prev.lower() not in PROTECT_NEXT):
            out.append(m)
        prev = w
    return out


def rng(item_id: str, mode: str) -> random.Random:
    return random.Random(int(hashlib.sha256(f"{mode}:{item_id}".encode()).hexdigest()[:12], 16))


def typo(word: str, r: random.Random) -> str:
    """One edit at a letter inside the word; retried until the word actually changes."""
    for _ in range(20):
        out = _typo_once(word, r)
        if out != word:
            return out
    return word[:-1]  # every edit was a no-op (a word like "booo"): drop the last letter


def _typo_once(word: str, r: random.Random) -> str:
    letters = [k for k in range(1, len(word) - 1) if word[k].isalpha()]
    i = r.choice(letters) if letters else 1
    op = r.choice(["swap", "drop", "double", "neighbour"])
    if op == "swap":
        return word[:i] + word[i + 1] + word[i] + word[i + 2:]
    if op == "drop":
        return word[:i] + word[i + 1:]
    if op == "double":
        return word[:i] + word[i] + word[i:]
    ch = word[i].lower()
    rep = r.choice(NEIGH.get(ch, ch) or ch)
    return word[:i] + (rep.upper() if word[i].isupper() else rep) + word[i + 1:]


def edit(q: str, item_id: str, mode: str) -> tuple[str, str]:
    r = rng(item_id, mode)
    spans = editable(q)
    if mode == "misspell":
        hits = [m for m in WORD.finditer(q) if m.group().lower() in MISSPELL]
        if hits:
            out, last = [], 0
            for m in hits:
                w = m.group()
                rep = MISSPELL[w.lower()]
                out += [q[last:m.start()], rep.capitalize() if w[0].isupper() else rep]
                last = m.end()
            return "".join(out) + q[last:], "misspell"
        mode = "typo1"
    if not spans:
        return q, "none"
    n = 1 if mode == "typo1" else max(1, round(0.1 * len(spans)))
    chosen = sorted(r.sample(spans, min(n, len(spans))), key=lambda m: m.start())
    out, last = [], 0
    for m in chosen:
        out += [q[last:m.start()], typo(m.group(), r)]
        last = m.end()
    return "".join(out) + q[last:], mode


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", type=Path, required=True)
    ap.add_argument("--mode", choices=["typo1", "typo10", "misspell"], required=True)
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args()
    a.out.parent.mkdir(parents=True, exist_ok=True)
    with a.out.open("w") as f:
        for line in a.set.open():
            if not line.strip():
                continue
            it = json.loads(line)
            q, kind = edit(it["question"], it["id"], a.mode)
            it["question_original"], it["question"], it["perturbation"] = it["question"], q, kind
            f.write(json.dumps(it, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
