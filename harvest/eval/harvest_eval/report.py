"""report.md from results.json."""
from __future__ import annotations

from pathlib import Path


def f(x, digits: int = 3) -> str:
    if x is None:
        return "–"
    if isinstance(x, float):
        return f"{x:.{digits}f}"
    return str(x)


def ci(c) -> str:
    return f" ({c[0]:.3f}–{c[1]:.3f})" if c else ""


def write_report(path: Path, results: dict, items: list[dict], all_rows: dict[str, list[dict]]) -> None:
    m = results["meta"]
    names = list(results["backends"])
    L = []
    L.append("# Evaluation report\n")
    L.append(f"Set: `{m['set']['path']}` ({m['set']['items']} items, sha256 `{(m['set']['sha256'] or '')[:16]}…`). "
             f"Run {m['started_at']} → {m.get('finished_at')}. Harness commit `{(m.get('harness_commit') or '–')[:10]}`. "
             f"Host: {m['host']['system']} {m['host']['machine']}, Python {m['host']['python']}.\n")
    if m.get("judge"):
        j = m["judge"]
        L.append(f"Judge: {', '.join(j.get('models_seen') or [j['model']])}; agreement check with {j['agreement_model']} "
                 f"on a {int(j['agreement_sample'] * 100)}% sample. Judge calls this run: {j.get('calls', 0)} "
                 f"(cached calls are free and not counted).\n")
    L.append("## Systems\n")
    L.append("| System | Kind | Pack / model | Notes |\n|---|---|---|---|")
    for n in names:
        b = m["backends"][n]
        what = b.get("pack_version") or ", ".join(b.get("reported_pack_versions") or []) or b.get("model") or ""
        models = ", ".join(b.get("reported_models") or [])
        note = f"llm={b.get('llm')}" if b.get("kind") == "harvest" else (b.get("endpoint") or "")
        L.append(f"| {n} | {b.get('kind')} | {what} {('· ' + models) if models else ''} | {note} |")
    L.append("")

    L.append("## Headline\n")
    hdr = "| Metric | " + " | ".join(names) + " |"
    L.append(hdr + "\n|---|" + "---|" * len(names))

    def row(label, fn):
        L.append(f"| {label} | " + " | ".join(fn(results["backends"][n]) for n in names) + " |")

    row("Items / errors", lambda a: f"{a['n']} / {a['errors']}")
    row("Answerable graded / expected", lambda a: f"{a['correctness']['graded']} / {a['correctness']['expected']}")
    row("Fully correct (answerable)", lambda a: f(a["correctness"]["fully_correct"]) + ci(a["correctness"].get("fully_correct_ci95")))
    row("Mean score /1 (answerable)", lambda a: f(a["correctness"]["mean_score"]))
    row("Must-decline handled", lambda a: f(a["correctness"]["must_decline_handled"]))
    row("Decline precision", lambda a: f(a["decline"]["precision"]))
    row("Decline recall", lambda a: f(a["decline"]["recall"]))
    row("False-decline rate (answerable)", lambda a: f(a["decline"]["false_decline_rate"]))
    row("Unsupported-claim rate", lambda a: f(a["unsupported_claim_rate"]))
    row("Answers with ≥1 unsupported claim", lambda a: f(a["answers_with_unsupported_claim"]))
    row("Citation precision (matches gold)", lambda a: f(a["citation_precision_gold"]))
    row("Citation precision (supports a claim)", lambda a: f(a["citation_precision_supported"]))
    row("Citations that exist in the corpus", lambda a: f(a["cites_exist_rate"]))
    row("Quotes verbatim", lambda a: f"{f(a['quote_verbatim_rate'])} ({a['quotes']['verbatim_ok']}/{a['quotes']['total']})")
    row("Retrieval R@5 (lineage)", lambda a: f(a["retrieval"]["lineage"]["r@5"]) + ci(a.get("retrieval_r@5_ci95")) if a.get("retrieval") else "–")
    row("Bake hit rate", lambda a: f(a.get("bake_hit_rate")))
    row("Equipment-specific fully correct", lambda a: f"{f(a['equipment_specific']['fully_correct'])} (n={a['equipment_specific']['n']})")
    row("Latency p50 / p95 ms (reported)", lambda a: f"{f(a['latency_ms']['reported_p50'], 0)} / {f(a['latency_ms']['reported_p95'], 0)}")
    row("Latency p50 / p95 ms (wall)", lambda a: f"{f(a['latency_ms']['wall_p50'], 0)} / {f(a['latency_ms']['wall_p95'], 0)}")
    row("Judge agreement (exact / κ)", lambda a: f"{f(a.get('judge_agreement', {}).get('exact_agreement'))} / {f(a.get('judge_agreement', {}).get('cohen_kappa'))} (n={a.get('judge_agreement', {}).get('n', 0)})")
    L.append("")

    for n in names:
        a = results["backends"][n]
        if not a.get("retrieval"):
            continue
        L.append(f"## Retrieval: {n}\n")
        L.append("| Level | P@1 | P@3 | P@5 | P@10 | R@1 | R@3 | R@5 | R@10 | MRR@10 |\n|---|---|---|---|---|---|---|---|---|---|")
        for level, v in a["retrieval"].items():
            L.append(f"| {level} | " + " | ".join(f(v[f'p@{k}']) for k in (1, 3, 5, 10)) + " | "
                     + " | ".join(f(v[f'r@{k}']) for k in (1, 3, 5, 10)) + f" | {f(v['mrr@10'])} |")
        L.append("")

    L.append("## Fully correct by category\n")
    cats = sorted({c for n in names for c in results["backends"][n]["by_category"]})
    L.append("| Category | n | " + " | ".join(names) + " |\n|---|---|" + "---|" * len(names))
    for c in cats:
        nn = max(results["backends"][n]["by_category"].get(c, {}).get("n", 0) for n in names)
        L.append(f"| {c} | {nn} | " + " | ".join(f(results["backends"][n]["by_category"].get(c, {}).get("fully_correct")) for n in names) + " |")
    L.append("")

    if results.get("comparisons"):
        L.append("## Item-by-item comparisons\n")
        L.append("| A vs B | n | A better | B better | ties | sign-test p | only A fully correct | only B fully correct | McNemar p |\n|---|---|---|---|---|---|---|---|---|")
        for k, c in results["comparisons"].items():
            L.append(f"| {k} | {c['n']} | {c['a_better']} | {c['b_better']} | {c['ties']} | {f(c['sign_test_p'])} | "
                     f"{c['only_a_fully_correct']} | {c['only_b_fully_correct']} | {f(c['mcnemar_p'])} |")
        L.append("")

    L.append("## Definitions\n")
    L.append("""- **Fully correct**: the judge scored 2 (every key fact the question asks for is right, nothing contradicts the gold answer). Errors count as 0. A declined answerable item scores 0. 95% bootstrap interval in parentheses.
- **Must-decline handled**: share of must-decline items the system declined or answered only with "the sources do not cover this".
- **Decline precision / recall**: positive class = must-decline items; a harvest answer is declined when `mode = declined`, a baseline answer when the judge says it declined.
- **Unsupported-claim rate**: claims (sentences of the answer's text segments) the support judge found unsupported by the text of the sections the answer cited, over all supported + unsupported claims. It sees only the cited text, never the gold. A claim with nothing cited is unsupported. Quote segments are checked separately and deterministically.
- **Citation precision (matches gold)**: cited sections on the same lineage as a gold section (one contains the other), over all citations, on answered answerable items. A lower bound: a correct extra citation counts against it.
- **Citation precision (supports a claim)**: cited sections that the support judge used to support at least one claim, over all citations.
- **Retrieval P/R@k**: on answerable items; the ranked distinct sections behind the retrieved chunks. `strict`: retrieved section is the gold paragraph or inside it; `lineage`: one contains the other; `section`: same base section. P@k divides by k.
- **Bake hit rate**: share of answers with `mode = baked`.
- **Latency**: `reported` is the system's own `elapsed_ms`; `wall` includes process start.
- **Judge agreement**: the same correctness rubric re-run by a second model on a seeded sample; exact score agreement and Cohen's κ.
""")
    path.write_text("\n".join(L))
