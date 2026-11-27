# Evaluation report

Set: `../../crane/eval/heldout-v2.jsonl` (73 items, sha256 `f19bd6fe86d33a85…`). Run 2026-11-27T19:44:11+00:00 → 2026-11-27T19:44:11+00:00. Harness commit `2392575b21`. Host: Darwin arm64, Python 3.14.9.

Judge: opus; agreement check with sonnet on a 15% sample. Judge calls this run: 0 (cached calls are free and not counted).

## Systems

| System | Kind | Pack / model | Notes |
|---|---|---|---|
| harvest-model-off | harvest | 2026.11.27-1  | llm=off |
| harvest-model-off-dense-gate | harvest | 2026.11.27-1  | llm=off |
| harvest-gpt-oss-20b-dense-gate | harvest | 2026.11.27-1 · gpt-oss-20b-MXFP4.gguf | llm=http://127.0.0.1:18103/v1 |

## Headline

| Metric | harvest-model-off | harvest-model-off-dense-gate | harvest-gpt-oss-20b-dense-gate |
|---|---|---|---|
| Items / errors | 73 / 0 | 73 / 0 | 73 / 0 |
| Answerable graded / expected | 59 / 59 | 59 / 59 | 59 / 59 |
| Fully correct (answerable) | 0.186 (0.102–0.288) | 0.373 (0.254–0.492) | 0.407 (0.288–0.542) |
| Mean score /1 (answerable) | 0.229 | 0.508 | 0.542 |
| Must-decline handled | 1.000 | 1.000 | 1.000 |
| Decline precision | 0.359 | 0.520 | 0.520 |
| Decline recall | 1.000 | 0.929 | 0.929 |
| False-decline rate (answerable) | 0.424 | 0.203 | 0.203 |
| Unsupported-claim rate | 0.018 | 0.000 | 0.000 |
| Answers with ≥1 unsupported claim | 0.059 | 0.000 | 0.000 |
| Citation precision (matches gold) | 0.390 | 0.476 | 0.522 |
| Citation precision (supports a claim) | 0.492 | 0.161 | 0.157 |
| Citations that exist in the corpus | 1.000 | 1.000 | 1.000 |
| Quotes verbatim | 1.000 (60/60) | 1.000 (128/128) | 1.000 (121/121) |
| Retrieval R@5 (lineage) | 0.588 (0.486–0.695) | 0.761 (0.669–0.850) | 0.761 (0.669–0.853) |
| Bake hit rate | 0.000 | 0.000 | 0.000 |
| Equipment-specific fully correct | 0.179 (n=28) | 0.393 (n=28) | 0.429 (n=28) |
| Latency p50 / p95 ms (reported) | 4 / 15 | 20 / 29 | 4527 / 10973 |
| Latency p50 / p95 ms (wall) | 76 / 90 | 657 / 671 | 5223 / 11694 |
| Judge agreement (exact / κ) | 0.750 / 0.500 (n=4) | 0.833 / 0.667 (n=6) | 0.833 / 0.667 (n=6) |

## Retrieval: harvest-model-off

| Level | P@1 | P@3 | P@5 | P@10 | R@1 | R@3 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|---|---|---|---|---|
| strict | 0.441 | 0.260 | 0.190 | 0.100 | 0.301 | 0.463 | 0.504 | 0.524 | 0.555 |
| lineage | 0.475 | 0.311 | 0.251 | 0.137 | 0.335 | 0.516 | 0.588 | 0.605 | 0.576 |
| section | 0.559 | 0.452 | 0.390 | 0.237 | 0.538 | 0.758 | 0.775 | 0.775 | 0.653 |

## Retrieval: harvest-model-off-dense-gate

| Level | P@1 | P@3 | P@5 | P@10 | R@1 | R@3 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|---|---|---|---|---|
| strict | 0.627 | 0.362 | 0.254 | 0.151 | 0.398 | 0.617 | 0.681 | 0.733 | 0.726 |
| lineage | 0.627 | 0.418 | 0.312 | 0.185 | 0.398 | 0.695 | 0.761 | 0.809 | 0.734 |
| section | 0.678 | 0.588 | 0.508 | 0.331 | 0.648 | 0.856 | 0.890 | 0.958 | 0.780 |

## Retrieval: harvest-gpt-oss-20b-dense-gate

| Level | P@1 | P@3 | P@5 | P@10 | R@1 | R@3 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|---|---|---|---|---|
| strict | 0.610 | 0.356 | 0.254 | 0.156 | 0.381 | 0.600 | 0.681 | 0.750 | 0.717 |
| lineage | 0.610 | 0.418 | 0.312 | 0.190 | 0.381 | 0.678 | 0.761 | 0.814 | 0.725 |
| section | 0.678 | 0.571 | 0.495 | 0.322 | 0.648 | 0.856 | 0.890 | 0.958 | 0.783 |

## Fully correct by category

| Category | n | harvest-model-off | harvest-model-off-dense-gate | harvest-gpt-oss-20b-dense-gate |
|---|---|---|---|---|
| assembly-disassembly | 6 | 0.167 | 0.333 | 0.333 |
| crawler-truck-locomotive | 3 | 0.000 | 0.333 | 0.667 |
| derricks | 2 | 0.000 | 0.500 | 0.500 |
| fall-protection | 1 | 0.000 | 0.000 | 0.000 |
| floating-cranes | 2 | 0.500 | 1.000 | 1.000 |
| inspections | 1 | 0.000 | 1.000 | 1.000 |
| operational-aids | 4 | 0.000 | 0.000 | 0.000 |
| operator-duties | 4 | 0.000 | 0.250 | 0.500 |
| operator-qualification | 4 | 0.250 | 0.500 | 0.500 |
| overhead-gantry | 3 | 1.000 | 1.000 | 0.667 |
| personnel-lifts | 3 | 0.000 | 0.333 | 0.333 |
| power-lines | 10 | 0.200 | 0.400 | 0.400 |
| rigging-slings | 4 | 0.000 | 0.000 | 0.250 |
| safety-devices | 1 | 1.000 | 1.000 | 1.000 |
| scope-definitions | 3 | 0.000 | 0.000 | 0.000 |
| sideboom-pile-small | 1 | 0.000 | 0.000 | 0.000 |
| tower-cranes | 2 | 0.000 | 0.500 | 0.500 |
| wire-rope | 4 | 0.500 | 0.500 | 0.500 |
| work-area-control | 1 | 0.000 | 0.000 | 0.000 |

## Item-by-item comparisons

| A vs B | n | A better | B better | ties | sign-test p | only A fully correct | only B fully correct | McNemar p |
|---|---|---|---|---|---|---|---|---|
| harvest-model-off vs harvest-model-off-dense-gate | 73 | 0 | 24 | 49 | 0.000 | 0 | 11 | 0.001 |
| harvest-model-off vs harvest-gpt-oss-20b-dense-gate | 73 | 1 | 27 | 45 | 0.000 | 1 | 14 | 0.001 |
| harvest-model-off-dense-gate vs harvest-gpt-oss-20b-dense-gate | 73 | 1 | 3 | 69 | 0.625 | 1 | 3 | 0.625 |

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
