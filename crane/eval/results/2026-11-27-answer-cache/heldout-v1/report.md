# Evaluation report

Set: `../../crane/eval/results/2026-11-27-answer-cache/../../heldout-v1.jsonl` (342 items, sha256 `21f018c2ce5a65ba…`). Run 2026-11-27T19:44:09+00:00 → 2026-11-27T19:44:10+00:00. Harness commit `2392575b21`. Host: Darwin arm64, Python 3.14.9.

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
| Fully correct (answerable) | 0.278 (0.227–0.333) | 0.436 (0.378–0.495) | 0.467 (0.409–0.522) |
| Mean score /1 (answerable) | 0.342 | 0.533 | 0.553 |
| Must-decline handled | 0.765 | 0.745 | 0.745 |
| Decline precision | 0.287 | 0.400 | 0.400 |
| Decline recall | 0.765 | 0.745 | 0.745 |
| False-decline rate (answerable) | 0.333 | 0.196 | 0.196 |
| Unsupported-claim rate | 0.030 | 0.032 | 0.035 |
| Answers with ≥1 unsupported claim | 0.083 | 0.040 | 0.037 |
| Citation precision (matches gold) | 0.461 | 0.459 | 0.474 |
| Citation precision (supports a claim) | 0.433 | 0.197 | 0.173 |
| Citations that exist in the corpus | 1.000 | 1.000 | 1.000 |
| Quotes verbatim | 1.000 (405/405) | 1.000 (660/660) | 1.000 (645/645) |
| Retrieval R@5 (lineage) | 0.630 (0.580–0.682) | 0.750 (0.708–0.794) | 0.760 (0.718–0.802) |
| Bake hit rate | 0.009 | 0.009 | 0.009 |
| Equipment-specific fully correct | 0.344 (n=122) | 0.459 (n=122) | 0.492 (n=122) |
| Latency p50 / p95 ms (reported) | 4 / 16 | 19 / 30 | 4568 / 10436 |
| Latency p50 / p95 ms (wall) | 74 / 90 | 656 / 686 | 5278 / 11117 |
| Judge agreement (exact / κ) | 0.842 / 0.759 (n=38) | 0.884 / 0.819 (n=43) | 0.884 / 0.814 (n=43) |

## Retrieval: harvest-model-off

| Level | P@1 | P@3 | P@5 | P@10 | R@1 | R@3 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|---|---|---|---|---|
| strict | 0.454 | 0.266 | 0.202 | 0.114 | 0.319 | 0.478 | 0.563 | 0.595 | 0.551 |
| lineage | 0.481 | 0.323 | 0.253 | 0.146 | 0.350 | 0.550 | 0.630 | 0.664 | 0.581 |
| section | 0.588 | 0.480 | 0.431 | 0.269 | 0.575 | 0.750 | 0.817 | 0.840 | 0.682 |

## Retrieval: harvest-model-off-dense-gate

| Level | P@1 | P@3 | P@5 | P@10 | R@1 | R@3 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|---|---|---|---|---|
| strict | 0.570 | 0.363 | 0.268 | 0.154 | 0.396 | 0.627 | 0.691 | 0.747 | 0.679 |
| lineage | 0.625 | 0.419 | 0.320 | 0.189 | 0.456 | 0.691 | 0.750 | 0.804 | 0.722 |
| section | 0.725 | 0.622 | 0.539 | 0.351 | 0.714 | 0.869 | 0.907 | 0.943 | 0.807 |

## Retrieval: harvest-gpt-oss-20b-dense-gate

| Level | P@1 | P@3 | P@5 | P@10 | R@1 | R@3 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|---|---|---|---|---|
| strict | 0.557 | 0.360 | 0.272 | 0.156 | 0.388 | 0.626 | 0.700 | 0.750 | 0.672 |
| lineage | 0.612 | 0.418 | 0.325 | 0.193 | 0.447 | 0.694 | 0.760 | 0.807 | 0.716 |
| section | 0.718 | 0.625 | 0.545 | 0.356 | 0.707 | 0.862 | 0.902 | 0.938 | 0.800 |

## Fully correct by category

| Category | n | harvest-model-off | harvest-model-off-dense-gate | harvest-gpt-oss-20b-dense-gate |
|---|---|---|---|---|
| assembly-disassembly | 21 | 0.238 | 0.524 | 0.524 |
| crawler-truck-locomotive | 7 | 0.286 | 0.286 | 0.429 |
| derricks | 5 | 0.200 | 0.600 | 0.800 |
| design-modification | 6 | 0.000 | 0.167 | 0.167 |
| fall-protection | 5 | 0.200 | 0.400 | 0.400 |
| floating-cranes | 9 | 0.333 | 0.444 | 0.444 |
| ground-conditions | 7 | 0.714 | 0.571 | 0.571 |
| inspections | 29 | 0.207 | 0.345 | 0.310 |
| load-charts | 9 | 0.111 | 0.333 | 0.333 |
| multiple-crane-lifts | 6 | 0.333 | 0.500 | 0.500 |
| operational-aids | 11 | 0.182 | 0.182 | 0.182 |
| operator-duties | 11 | 0.273 | 0.364 | 0.364 |
| operator-qualification | 15 | 0.200 | 0.467 | 0.600 |
| overhead-gantry | 17 | 0.529 | 0.647 | 0.647 |
| personnel-lifts | 13 | 0.077 | 0.231 | 0.231 |
| power-lines | 26 | 0.231 | 0.346 | 0.462 |
| rigging-slings | 14 | 0.357 | 0.714 | 0.786 |
| safety-devices | 5 | 0.000 | 0.200 | 0.200 |
| scope-definitions | 14 | 0.286 | 0.429 | 0.429 |
| sideboom-pile-small | 4 | 0.500 | 0.750 | 0.750 |
| signals | 15 | 0.333 | 0.467 | 0.467 |
| tower-cranes | 6 | 0.500 | 0.333 | 0.500 |
| training | 8 | 0.000 | 0.375 | 0.375 |
| wind-weather | 5 | 0.200 | 0.800 | 0.800 |
| wire-rope | 19 | 0.526 | 0.526 | 0.579 |
| work-area-control | 4 | 0.250 | 0.500 | 0.500 |

## Item-by-item comparisons

| A vs B | n | A better | B better | ties | sign-test p | only A fully correct | only B fully correct | McNemar p |
|---|---|---|---|---|---|---|---|---|
| harvest-model-off vs harvest-model-off-dense-gate | 342 | 25 | 89 | 228 | 0.000 | 19 | 64 | 0.000 |
| harvest-model-off vs harvest-gpt-oss-20b-dense-gate | 342 | 22 | 95 | 225 | 0.000 | 16 | 70 | 0.000 |
| harvest-model-off-dense-gate vs harvest-gpt-oss-20b-dense-gate | 342 | 2 | 11 | 329 | 0.022 | 2 | 11 | 0.022 |

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
