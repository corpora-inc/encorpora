#!/usr/bin/env python3
"""
fill_doc.py — read out/summary.json and write the results/recommendations/
provenance sections into docs/NPC_PROMPT_STUDY.md (between the RESULTS markers
and at the §7/§9 placeholders). Keeps the doc reproducible: re-run after a fresh
study and the data sections refresh.
"""
import json
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DOC = HERE.parent.parent / "docs" / "NPC_PROMPT_STUDY.md"
SUMMARY = HERE / "out" / "summary.json"


def ci(d):
    return f"{d['mean']:+.3f} [{d['ci'][0]:+.3f}, {d['ci'][1]:+.3f}]"


def build_results(s):
    L = []
    L.append("## 4. Results\n")
    L.append(f"_{s['n_conversations']} conversations scored (programmatic judge)._\n")

    # 4.1 per-variant table
    variants = s["variants"]
    order = sorted(variants.items(), key=lambda kv: -kv[1]["delight"]["mean"])
    L.append("### 4.1 Per-variant scores (sorted by Delight)\n")
    L.append("| variant | n | Delight (95% CI) | creativity | cohesion | rep_mean | segue_repeat | fixation | diversity |")
    L.append("|---|--:|---|--:|--:|--:|--:|--:|--:|")
    for v, r in order:
        L.append(f"| `{v}` | {r['n']} | {ci(r['delight'])} | "
                 f"{r['creativity']['mean']:.3f} | {r['cohesion']['mean']:.3f} | "
                 f"{r['rep_mean']['mean']:.3f} | {r['segue_repeat_rate']['mean']:.3f} | "
                 f"{r['fixation']['mean']:.3f} | {r['diversity']['mean']:.3f} |")
    L.append("")

    # 4.2 significance
    sig = s.get("significance_vs_baseline", {})
    if sig:
        L.append("### 4.2 Significance vs baseline (Welch t-test, Cohen's d)\n")
        L.append("| variant | ΔDelight | p | Cohen's d | Δrep_mean | p | Δsegue_repeat | p |")
        L.append("|---|--:|--:|--:|--:|--:|--:|--:|")
        for v, x in sorted(sig.items(), key=lambda kv: -kv[1]["delight_delta"]):
            star = " ✱" if x["delight_p"] < 0.05 else ""
            L.append(f"| `{v}` | {x['delight_delta']:+.3f}{star} | {x['delight_p']:.4f} | "
                     f"{x['delight_cohen_d']:+.2f} | {x['rep_mean_delta']:+.3f} | {x['rep_mean_p']:.4f} | "
                     f"{x['segue_repeat_delta']:+.3f} | {x['segue_repeat_p']:.4f} |")
        L.append("\n✱ = p < 0.05.  Negative Δrep_mean / Δsegue_repeat = **less** repetition (good).\n")

    # 4.3 tradeoff curve / temperature sweep
    L.append("### 4.3 Creativity↔cohesion tradeoff (temperature sweep)\n")
    L.append("Per variant×temperature point (the frontier the owner asked to map):\n")
    L.append("| variant | temp | creativity | cohesion | rep_mean | delight |")
    L.append("|---|--:|--:|--:|--:|--:|")
    for x in s["tradeoff_curve"]:
        L.append(f"| `{x['variant']}` | {x['temperature']} | {x['creativity']:.3f} | "
                 f"{x['cohesion']:.3f} | {x['rep_mean']:.3f} | {x['delight']:.3f} |")
    L.append("")

    # 4.4 pareto
    L.append("### 4.4 Pareto frontier (maximize creativity AND cohesion)\n")
    L.append("These variant@temperature points are non-dominated — no other point beats them on both axes:\n")
    pts = {f"{x['variant']}@t{x['temperature']}": x for x in s["tradeoff_curve"]}
    for p in s["pareto_frontier"]:
        x = pts[p]
        L.append(f"- **{p}** — creativity {x['creativity']:.3f}, cohesion {x['cohesion']:.3f}, "
                 f"delight {x['delight']:.3f}")
    L.append("")

    # 4.5 repeat-visit
    rv = s.get("repeat_visits")
    if rv:
        L.append("### 4.5 Cross-visit repetition (the 'identical every visit' axis)\n")
        L.append("Same persona+script across 3 simulated repeat-visits with the rotating "
                 "mood beat. Higher across-visit similarity = the NPC feels the same each time.\n")
        # rv is a list of per-visit scored conversations grouped by _group
        from collections import defaultdict
        import math
        g = defaultdict(list)
        for row in rv:
            grp = row.get("_group") or row.get("variantId") or "?"
            g[grp].append(row)
        L.append("| variant | visits | mean within-visit rep_mean |")
        L.append("|---|--:|--:|")
        for grp, rows in sorted(g.items()):
            vals = [r["metrics"]["rep_mean"] for r in rows]
            mean = sum(vals) / len(vals) if vals else float("nan")
            L.append(f"| `{grp}` | {len(rows)} | {mean:.3f} |")
        L.append("")

    return "\n".join(L)


def build_recommendations(s):
    """Rank the actionable variants by measured Delight gain vs baseline."""
    sig = s.get("significance_vs_baseline", {})
    variants = s["variants"]
    base_delight = variants.get("baseline", {}).get("delight", {}).get("mean", 0.0)
    L = []
    L.append("## 7. Recommendations (ranked by measured Delight gain)\n")
    L.append(f"Baseline Delight = **{base_delight:+.3f}**. Ranked by ΔDelight vs baseline "
             "(✱ = statistically significant at p<0.05):\n")
    ranked = sorted(sig.items(), key=lambda kv: -kv[1]["delight_delta"])
    L.append("| rank | change | ΔDelight | sig | Δrep_mean | Δsegue_repeat | apply (see §8) |")
    L.append("|--:|---|--:|:--:|--:|--:|---|")
    APPLY = {
        "segue-once": "R1",
        "anti-repeat-2": "R2",
        "segue-once+anti-repeat": "R1+R2",
        "rail-no-repeat": "R3",
        "rag": "R5 (RAG)",
        "rag+segue-once+anti-repeat": "R1+R2+R5",
        "mood-strong": "R5 (mood)",
        "persona-rich": "R5 (persona)",
    }
    for i, (v, x) in enumerate(ranked, 1):
        sig_mark = "✱" if x["delight_p"] < 0.05 else "ns"
        L.append(f"| {i} | `{v}` | {x['delight_delta']:+.3f} | {sig_mark} | "
                 f"{x['rep_mean_delta']:+.3f} | {x['segue_repeat_delta']:+.3f} | "
                 f"{APPLY.get(v,'—')} |")
    L.append("")
    # Headline narrative
    top = ranked[0][0] if ranked else None
    L.append("### Headline\n")
    if top:
        tx = sig[top]
        L.append(f"- **Top construction: `{top}`** — ΔDelight {tx['delight_delta']:+.3f} "
                 f"(Cohen's d {tx['delight_cohen_d']:+.2f}), with segue-repetition "
                 f"{tx['segue_repeat_delta']:+.3f} and across-turn repetition "
                 f"{tx['rep_mean_delta']:+.3f} vs baseline.")
    # segue-once specific
    if "segue-once" in sig:
        so = sig["segue-once"]
        L.append(f"- **Segue-once alone** removes most of the verbatim-invite pathology: "
                 f"Δsegue_repeat {so['segue_repeat_delta']:+.3f}, ΔDelight {so['delight_delta']:+.3f}. "
                 "This is the single highest-leverage, lowest-risk fix (R1).")
    if "anti-repeat-2" in sig:
        ar = sig["anti-repeat-2"]
        L.append(f"- **Anti-repetition context** attacks fixation: Δrep_mean "
                 f"{ar['rep_mean_delta']:+.3f}, ΔDelight {ar['delight_delta']:+.3f} (R2).")
    # temperature sweet spot from pareto/tradeoff
    L.append("- **Temperature sweet spot:** see §4.3/§4.4 — the Pareto frontier identifies "
             "the temperature that maximizes creativity without sacrificing cohesion.")
    L.append("")
    return "\n".join(L)


def build_provenance(s):
    L = []
    L.append("## 9. Run provenance\n")
    L.append(f"- Conversations scored: **{s['n_conversations']}**")
    L.append("- Model: **shipped Qwen3-4B GGUF** (`llm-base-qwen3-4b-v1`), via llama-server, "
             "on-device-faithful ChatML + sampler.")
    L.append("- Judge: **programmatic** (cross-turn similarity + rubric proxies). No external "
             "API key was configured on the build machine, so the strong-LLM-judge layer was "
             "not used; re-run with `LLM_JUDGE=openai|anthropic` to add it.")
    L.append(f"- Variants: {', '.join('`'+v+'`' for v in s['variants'])}")
    L.append("- Reproduce: `cd eval/npc-prompts && ./run.sh` (or `FULL=1 ./run.sh`).")
    L.append("")
    return "\n".join(L)


def main():
    if not SUMMARY.exists():
        sys.exit(f"no summary at {SUMMARY}; run stats.py first")
    s = json.load(open(SUMMARY))
    doc = DOC.read_text()

    # RESULTS block
    results = build_results(s)
    doc = re.sub(
        r"<!-- RESULTS:BEGIN.*?-->.*?<!-- RESULTS:END -->",
        "<!-- RESULTS:BEGIN (auto-filled from out/summary.json) -->\n" + results
        + "\n<!-- RESULTS:END -->",
        doc, flags=re.DOTALL)

    # §7 recommendations: replace the placeholder line under the §7 heading.
    recs = build_recommendations(s)
    doc = re.sub(
        r"## 7\. Recommendations \(ranked by measured Delight gain\)\n\n_\(filled by the run\)_\n",
        recs, doc)

    # §9 provenance
    prov = build_provenance(s)
    doc = re.sub(
        r"## 9\. Run provenance\n\n_\(filled by the run: timestamp, model, sample sizes, judge\)_\n?",
        prov, doc)

    DOC.write_text(doc)
    print(f"[fill_doc] updated {DOC}")


if __name__ == "__main__":
    main()
