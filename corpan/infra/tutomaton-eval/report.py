"""Build results/REPORT.md + results/recommendations.json — the deliverable.

Decision model (matches the owner's bar):
  - The programmatic triage proves the model CAN emit the script (necessary, not
    sufficient).
  - The keep/drop call is the CALIBRATED BINARY judge on LOW-TEMP output
    (results/judge_verdicts_lowtemp/): "real, usable language with errors" = KEEP
    vs "fundamentally broken / wrong language / fabrication" = DROP. This is the
    fair bar; the earlier strict 1-5 fluency judge (results/judge_verdicts/) is
    kept only as context — it ran ~1 point harsh and is NOT the decision source.
  - Languages never flagged by the strict judge (clearly fluent high-resource)
    are KEEP without a separate binary pass.
"""

from __future__ import annotations

import glob
import json
import os

from langs import CODES, by_code

R = os.path.join(os.path.dirname(__file__), "results")

GLOBAL_DEFAULTS = {
    "temperature": 0.3, "topP": 0.9, "topK": 20, "minP": 0.05,
    "repeatPenalty": 1.1, "presencePenalty": 0, "maxTokens": 700,
}


def _load(d):
    out = {}
    for p in glob.glob(os.path.join(R, d, "*.json")):
        if os.path.basename(p).startswith("_"):
            continue
        j = json.load(open(p, encoding="utf-8"))
        out[j["code"]] = j
    return out


def build():
    binv = _load("judge_verdicts_lowtemp")     # decision source
    flu = _load("judge_verdicts")               # strict 1-5 context
    keep, drop = [], []
    for c in CODES:
        if c in binv:
            (keep if binv[c]["decision"] == "keep" else drop).append(c)
        else:
            keep.append(c)

    lines = ["# Tutomaton × Qwen3-4B — language support & tuning report", ""]
    lines += [
        "On-device model: **Qwen3-4B Q4_K_M GGUF** via `tauri-plugin-corpan-llm` "
        "(llama.cpp, Metal). Eval reproduced the plugin's exact ChatML + sampler "
        "chain. Results are specific to THIS model build on this machine.", "",
        "## Verdict", "",
        f"- **KEEP {len(keep)} / 55** languages.",
        f"- **DROP {len(drop)} / 55**: " + ", ".join(drop) + ".", "",
        "## New global defaults (apply to every language)", "",
        "```json", json.dumps(GLOBAL_DEFAULTS, indent=2), "```",
        "Was: `temp 0.6, topP 0.95, topK 20, minP 0, repeatPenalty 1.0, "
        "maxTokens 700`. Lowering temperature to 0.3 and adding a light "
        "min_p / repeat penalty measurably reduced fabrication and repetition "
        "loops (e.g. Marathi flipped drop→keep; Swahili loops shrank) and was "
        "neutral-to-positive on strong languages. A single global default beats "
        "per-language numeric overrides here — the lever generalises.", "",
        "## Dropped languages (fundamentally broken at best params)", "",
        "| code | why |", "|------|-----|",
    ]
    for c in drop:
        why = binv[c]["summary"].replace("|", "/") if c in binv else ""
        lines.append(f"| {c} ({by_code(c).name}) | {why} |")

    lines += ["", "## Full table", "",
              "| code | name | decision | binary(low-temp) | strict 1-5 (context) |",
              "|------|------|----------|------------------|----------------------|"]
    for c in CODES:
        nm = by_code(c).name
        dec = "DROP" if c in drop else "keep"
        b = binv.get(c, {})
        bs = f"{b.get('decision','-')}/{b.get('confidence','-')}" if c in binv else "(not contested)"
        f = flu.get(c, {})
        fs = f"{f.get('verdict','-')} {f.get('fluency','-')}/{f.get('coherence','-')}" if c in flu else "-"
        lines.append(f"| {c} | {nm} | {dec} | {bs} | {fs} |")

    lines += ["", "## Method", "",
              "1. **Triage** (all 55): programmatic gate — script coverage, "
              "py3langid, repetition/refusal/template — proves the model can emit "
              "the script. Necessary, not sufficient.",
              "2. **Strict fluency judge** (all 55): per-language Claude judge, "
              "1-5. Useful for finding errors but ran ~1 pt harsh and had high "
              "variance at the weak/unsupported boundary (it wrongly failed "
              "German, Turkish, Finnish…), so NOT the decision source.",
              "3. **Low-temp regen + calibrated BINARY judge** (every contested "
              "language): real-language-with-errors = KEEP vs broken/"
              "wrong-language/fabrication = DROP. This is the decision.",
              "4. **A/B** confirmed temperature is a real lever (Marathi "
              "drop→keep at temp 0.3) while most of the strict-judge 'failures' "
              "were calibration, not capability.", "",
              "Raw generations: `results/rows.jsonl`. Per-language samples: "
              "`results/judge_lowtemp/`. Verdicts: `results/judge_verdicts_lowtemp/`."]

    open(os.path.join(R, "REPORT.md"), "w", encoding="utf-8").write("\n".join(lines))
    rec = {
        "model": "qwen3-4b-q4_k_m",
        "global_defaults": GLOBAL_DEFAULTS,
        "keep": keep, "drop": drop,
        "drop_reasons": {c: binv[c]["summary"] for c in drop if c in binv},
    }
    json.dump(rec, open(os.path.join(R, "recommendations.json"), "w"),
              ensure_ascii=False, indent=2)
    print(f"KEEP {len(keep)}  DROP {len(drop)}: {' '.join(drop)}")
    print("wrote REPORT.md + recommendations.json")


if __name__ == "__main__":
    build()
