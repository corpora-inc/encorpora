# Evaluation report

Set: `../../crane/eval/results/2026-11-27-dense-gate/../../heldout-v1.jsonl` (342 items, sha256 `21f018c2ce5a65ba…`). Run 2026-11-27T18:54:40+00:00 → 2026-11-27T18:54:41+00:00. Harness commit `8226c4eb3d`. Host: Darwin arm64, Python 3.14.9.

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
| Items / errors | 342 / 0 | 342 / 0 | 342 / 0 |
| Answerable graded / expected | 291 / 291 | 291 / 291 | 291 / 291 |
| Fully correct (answerable) | 0.282 (0.230–0.333) | 0.405 (0.347–0.460) | 0.426 (0.371–0.485) |
| Mean score /1 (answerable) | 0.338 | 0.497 | 0.510 |
| Must-decline handled | 0.745 | 0.745 | 0.745 |
| Decline precision | 0.277 | 0.342 | 0.342 |
| Decline recall | 0.745 | 0.745 | 0.745 |
| False-decline rate (answerable) | 0.340 | 0.251 | 0.251 |
| Unsupported-claim rate | 0.039 | 0.047 | 0.045 |
| Answers with ≥1 unsupported claim | 0.117 | 0.056 | 0.048 |
| Citation precision (matches gold) | 0.457 | 0.463 | 0.485 |
| Citation precision (supports a claim) | 0.476 | 0.221 | 0.204 |
| Citations that exist in the corpus | 1.000 | 1.000 | 1.000 |
| Quotes verbatim | 1.000 (406/406) | 1.000 (626/626) | 1.000 (608/608) |
| Retrieval R@5 (lineage) | 0.637 (0.589–0.689) | 0.751 (0.708–0.793) | 0.760 (0.718–0.802) |
| Bake hit rate | 0.000 | 0.000 | 0.000 |
| Equipment-specific fully correct | 0.352 (n=122) | 0.459 (n=122) | 0.467 (n=122) |
| Latency p50 / p95 ms (reported) | 4 / 18 | 18 / 30 | 4166 / 7961 |
| Latency p50 / p95 ms (wall) | 71 / 86 | 646 / 668 | 4853 / 8653 |
| Judge agreement (exact / κ) | 0.842 / 0.757 (n=38) | 0.902 / 0.836 (n=41) | 0.902 / 0.836 (n=41) |

## Retrieval: harvest-model-off

| Level | P@1 | P@3 | P@5 | P@10 | R@1 | R@3 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|---|---|---|---|---|
| strict | 0.447 | 0.261 | 0.206 | 0.118 | 0.313 | 0.475 | 0.567 | 0.612 | 0.550 |
| lineage | 0.474 | 0.320 | 0.258 | 0.153 | 0.347 | 0.544 | 0.637 | 0.679 | 0.578 |
| section | 0.581 | 0.472 | 0.438 | 0.288 | 0.570 | 0.745 | 0.826 | 0.862 | 0.682 |

## Retrieval: harvest-model-off-dense-gate

| Level | P@1 | P@3 | P@5 | P@10 | R@1 | R@3 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|---|---|---|---|---|
| strict | 0.560 | 0.360 | 0.269 | 0.163 | 0.390 | 0.622 | 0.692 | 0.767 | 0.674 |
| lineage | 0.612 | 0.411 | 0.322 | 0.201 | 0.449 | 0.686 | 0.751 | 0.821 | 0.713 |
| section | 0.704 | 0.620 | 0.544 | 0.374 | 0.693 | 0.862 | 0.912 | 0.951 | 0.796 |

## Retrieval: harvest-gpt-oss-20b-dense-gate

| Level | P@1 | P@3 | P@5 | P@10 | R@1 | R@3 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|---|---|---|---|---|
| strict | 0.546 | 0.362 | 0.274 | 0.165 | 0.381 | 0.625 | 0.702 | 0.774 | 0.671 |
| lineage | 0.598 | 0.415 | 0.325 | 0.201 | 0.440 | 0.689 | 0.760 | 0.829 | 0.710 |
| section | 0.694 | 0.621 | 0.546 | 0.375 | 0.683 | 0.862 | 0.912 | 0.954 | 0.791 |

## Fully correct by category

| Category | n | harvest-model-off | harvest-model-off-dense-gate | harvest-gpt-oss-20b-dense-gate |
|---|---|---|---|---|
| assembly-disassembly | 21 | 0.238 | 0.524 | 0.524 |
| crawler-truck-locomotive | 7 | 0.286 | 0.286 | 0.286 |
| derricks | 5 | 0.200 | 0.600 | 0.600 |
| design-modification | 6 | 0.000 | 0.167 | 0.167 |
| fall-protection | 5 | 0.200 | 0.400 | 0.400 |
| floating-cranes | 9 | 0.444 | 0.444 | 0.444 |
| ground-conditions | 7 | 0.714 | 0.571 | 0.571 |
| inspections | 29 | 0.138 | 0.276 | 0.276 |
| load-charts | 9 | 0.222 | 0.222 | 0.222 |
| multiple-crane-lifts | 6 | 0.333 | 0.333 | 0.333 |
| operational-aids | 11 | 0.182 | 0.182 | 0.182 |
| operator-duties | 11 | 0.273 | 0.455 | 0.545 |
| operator-qualification | 15 | 0.267 | 0.467 | 0.533 |
| overhead-gantry | 17 | 0.529 | 0.647 | 0.647 |
| personnel-lifts | 13 | 0.077 | 0.231 | 0.308 |
| power-lines | 26 | 0.192 | 0.231 | 0.269 |
| rigging-slings | 14 | 0.357 | 0.643 | 0.643 |
| safety-devices | 5 | 0.200 | 0.400 | 0.400 |
| scope-definitions | 14 | 0.286 | 0.429 | 0.429 |
| sideboom-pile-small | 4 | 0.500 | 0.500 | 0.500 |
| signals | 15 | 0.333 | 0.467 | 0.467 |
| tower-cranes | 6 | 0.500 | 0.333 | 0.500 |
| training | 8 | 0.000 | 0.375 | 0.375 |
| wind-weather | 5 | 0.200 | 0.800 | 0.800 |
| wire-rope | 19 | 0.526 | 0.421 | 0.474 |
| work-area-control | 4 | 0.250 | 0.500 | 0.500 |

## Item-by-item comparisons

| A vs B | n | A better | B better | ties | sign-test p | only A fully correct | only B fully correct | McNemar p |
|---|---|---|---|---|---|---|---|---|
| harvest-model-off vs harvest-model-off-dense-gate | 342 | 30 | 82 | 230 | 0.000 | 23 | 59 | 0.000 |
| harvest-model-off vs harvest-gpt-oss-20b-dense-gate | 342 | 29 | 87 | 226 | 0.000 | 22 | 64 | 0.000 |
| harvest-model-off-dense-gate vs harvest-gpt-oss-20b-dense-gate | 342 | 1 | 8 | 333 | 0.039 | 1 | 7 | 0.070 |

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
