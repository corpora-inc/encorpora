"""Export representative tutor replies per language for the Claude fluency judge.

The programmatic gate only proves the model CAN produce the script. Whether the
output is fluent, correct, and coherent — the thing a small model fails at in
weak languages (Telugu using the wrong word for "good morning", Swahili looping
broken grammar) — needs a competent multilingual judge. Claude is that judge.

For each language we pull the scrubbed replies at the default ('ship') config
for one seed across the whole battery (varied intents), plus a couple of extra
seeds on the first prompt to show consistency. Writes results/judge/<code>.json
and a combined results/judge/_all.json the orchestrator hands to judge agents.
"""

from __future__ import annotations

import json
import os
import sys

from langs import CODES, by_code

ROWS = os.path.join(os.path.dirname(__file__), "results", "rows.jsonl")

PRIMARY_SEED = 11
EXTRA_SEEDS = [23, 37]


def build(tag: str = "ship", out_name: str = "judge") -> None:
    OUT = os.path.join(os.path.dirname(__file__), "results", out_name)
    os.makedirs(OUT, exist_ok=True)
    rows = [json.loads(l) for l in open(ROWS, encoding="utf-8")]
    combined = []
    for code in CODES:
        lang = by_code(code)
        sub = [r for r in rows if r["lang"] == code and r["prompt_tag"] == tag]
        if not sub:
            continue
        samples = []
        # One reply per battery prompt at the primary seed (varied intents).
        for ui in sorted({r["user_idx"] for r in sub}):
            pick = [r for r in sub if r["user_idx"] == ui and r["seed"] == PRIMARY_SEED]
            if pick:
                samples.append({"user": pick[0]["user"],
                                "reply": pick[0]["scrubbed"]})
        # Extra seeds on prompt 0 to reveal consistency / variance.
        for s in EXTRA_SEEDS:
            pick = [r for r in sub if r["user_idx"] == 0 and r["seed"] == s]
            if pick:
                samples.append({"user": pick[0]["user"] + f"  (seed {s})",
                                "reply": pick[0]["scrubbed"]})
        rec = {"code": code, "name": lang.name, "native": lang.native,
               "samples": samples}
        with open(os.path.join(OUT, f"{code}.json"), "w", encoding="utf-8") as f:
            json.dump(rec, f, ensure_ascii=False, indent=2)
        combined.append(rec)
    with open(os.path.join(OUT, "_all.json"), "w", encoding="utf-8") as f:
        json.dump(combined, f, ensure_ascii=False, indent=2)
    print(f"exported {len(combined)} languages ({tag}) to {OUT}")


if __name__ == "__main__":
    tag = sys.argv[1] if len(sys.argv) > 1 else "ship"
    out = sys.argv[2] if len(sys.argv) > 2 else ("judge" if tag == "ship" else f"judge_{tag}")
    build(tag, out)
