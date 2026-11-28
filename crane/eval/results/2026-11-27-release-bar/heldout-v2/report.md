# Evaluation report

Set: `../../crane/eval/results/2026-11-27-release-bar/../../heldout-v2.jsonl` (73 items, sha256 `f19bd6fe86d33a85…`). Run 2026-11-28T01:11:00+00:00 → 2026-11-28T01:11:00+00:00. Harness commit `e113660ed4`. Host: Darwin arm64, Python 3.14.9.

Judge: opus; agreement check with sonnet on a 15% sample. Judge calls this run: 0 (cached calls are free and not counted).

## Systems

| System | Kind | Pack / model | Notes |
|---|---|---|---|
| harvest-model-off-dense-gate | harvest | 2026.11.27-1  | llm=off |
| harvest-gpt-oss-20b-dense-gate | harvest | 2026.11.27-1 · gpt-oss-20b-MXFP4.gguf | llm=http://127.0.0.1:18103/v1 |

## Headline

| Metric | harvest-model-off-dense-gate | harvest-gpt-oss-20b-dense-gate |
|---|---|---|
| Items / errors | 73 / 0 | 73 / 0 |
| Answerable graded / expected | 59 / 59 | 59 / 59 |
| Fully correct (answerable) | 0.373 (0.254–0.508) | 0.475 (0.356–0.610) |
| Mean score /1 (answerable) | 0.525 | 0.593 |
| Must-decline handled | 0.929 | 0.929 |
| Decline precision | 0.520 | 0.542 |
| Decline recall | 0.929 | 0.929 |
| False-decline rate (answerable) | 0.203 | 0.186 |
| Unsupported-claim rate | 0.035 | 0.027 |
| Answers with ≥1 unsupported claim | 0.062 | 0.102 |
| Citation precision (matches gold) | 0.477 | 0.480 |
| Citation precision (supports a claim) | 0.351 | 0.397 |
| Citations that exist in the corpus | 1.000 | 1.000 |
| Quotes verbatim | 1.000 (133/133) | 1.000 (177/177) |
| Retrieval R@5 (lineage) | 0.756 (0.658–0.846) | 0.692 (0.590–0.791) |
| Bake hit rate | 0.000 | 0.000 |
| Equipment-specific fully correct | 0.357 (n=28) | 0.429 (n=28) |
| Latency p50 / p95 ms (reported) | 23 / 41 | 6394 / 9025 |
| Latency p50 / p95 ms (wall) | 669 / 695 | 7102 / 9731 |
| Judge agreement (exact / κ) | 0.833 / 0.667 (n=6) | 0.667 / -0.200 (n=6) |

## Retrieval: harvest-model-off-dense-gate

| Level | P@1 | P@3 | P@5 | P@10 | R@1 | R@3 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|---|---|---|---|---|
| strict | 0.593 | 0.356 | 0.251 | 0.147 | 0.384 | 0.612 | 0.675 | 0.722 | 0.698 |
| lineage | 0.593 | 0.412 | 0.308 | 0.181 | 0.384 | 0.689 | 0.756 | 0.804 | 0.703 |
| section | 0.644 | 0.582 | 0.505 | 0.319 | 0.614 | 0.839 | 0.873 | 0.941 | 0.752 |

## Retrieval: harvest-gpt-oss-20b-dense-gate

| Level | P@1 | P@3 | P@5 | P@10 | R@1 | R@3 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|---|---|---|---|---|
| strict | 0.475 | 0.322 | 0.244 | 0.144 | 0.302 | 0.568 | 0.637 | 0.713 | 0.636 |
| lineage | 0.508 | 0.373 | 0.295 | 0.175 | 0.328 | 0.619 | 0.692 | 0.754 | 0.653 |
| section | 0.610 | 0.531 | 0.488 | 0.322 | 0.581 | 0.843 | 0.856 | 0.890 | 0.734 |

## Fully correct by category

| Category | n | harvest-model-off-dense-gate | harvest-gpt-oss-20b-dense-gate |
|---|---|---|---|
| assembly-disassembly | 6 | 0.500 | 0.500 |
| crawler-truck-locomotive | 3 | 0.667 | 0.333 |
| derricks | 2 | 0.500 | 1.000 |
| fall-protection | 1 | 1.000 | 1.000 |
| floating-cranes | 2 | 0.500 | 0.500 |
| inspections | 1 | 1.000 | 1.000 |
| operational-aids | 4 | 0.000 | 0.000 |
| operator-duties | 4 | 0.250 | 0.250 |
| operator-qualification | 4 | 0.500 | 0.500 |
| overhead-gantry | 3 | 0.667 | 1.000 |
| personnel-lifts | 3 | 0.333 | 0.667 |
| power-lines | 10 | 0.400 | 0.300 |
| rigging-slings | 4 | 0.000 | 0.500 |
| safety-devices | 1 | 1.000 | 1.000 |
| scope-definitions | 3 | 0.000 | 0.667 |
| sideboom-pile-small | 1 | 0.000 | 0.000 |
| tower-cranes | 2 | 0.500 | 0.500 |
| wire-rope | 4 | 0.250 | 0.250 |
| work-area-control | 1 | 0.000 | 1.000 |

## Item-by-item comparisons

| A vs B | n | A better | B better | ties | sign-test p | only A fully correct | only B fully correct | McNemar p |
|---|---|---|---|---|---|---|---|---|
| harvest-model-off-dense-gate vs harvest-gpt-oss-20b-dense-gate | 73 | 4 | 10 | 59 | 0.180 | 3 | 9 | 0.146 |

## Definitions

- **Fully correct**: the judge scored 2 (every key fact the question asks for is right, nothing contradicts the gold answer). Errors count as 0. A declined answerable item scores 0. 95% bootstrap interval in parentheses.
- **Must-decline handled**: share of must-decline items the system declined or answered only with "the sources do not cover this".
- **Decline precision / recall**: positive class = must-decline items; a harvest answer is declined when `mode = declined`, a baseline answer when the judge says it declined.
- **Unsupported-claim rate**: claims (sentences of the answer's text segments) the support judge found unsupported by the text of the sections the answer cited, over all supported + unsupported claims. It sees only the cited text, never the gold. A claim with nothing cited is unsupported. Quote segments are checked separately and deterministically.
- **Citation precision (matches gold)**: cited sections on the same lineage as a gold section (one contains the other), over all citations, on answered answerable items. A lower bound: a correct extra citation counts against it.
- **Citation precision (supports a claim)**: cited sections that the support judge used to support at least one claim, over all citations.
- **Retrieval P/R@k**: on answerable items; the ranked distinct sections behind the retrieved chunks. `strict`: retrieved section is the gold paragraph or inside it; `lineage`: one contains the other; `section`: same base section. P@k divides by k.
- **Bake hit rate**: share of answers with `mode = baked`.
- **Latency**: `reported` is the system's own `elapsed_ms`; `wall` includes process start.
- **Judge agreement**: the same correctness rubric re-run by a second model on a seeded sample; exact score agreement and Cohen's κ.
