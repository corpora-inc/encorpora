# Evaluation report

Set: `../../crane/eval/results/2026-11-27-model-on/../../heldout-v1.jsonl` (342 items, sha256 `21f018c2ce5a65ba…`). Run 2026-11-27T16:09:36+00:00 → 2026-11-27T16:14:20+00:00. Harness commit `e1086068e2`. Host: Darwin arm64, Python 3.14.9.

Judge: claude-opus-5-5; agreement check with sonnet on a 15% sample. Judge calls this run: 20 (cached calls are free and not counted).

## Systems

| System | Kind | Pack / model | Notes |
|---|---|---|---|
| harvest-model-off | harvest | 2026.11.27-1  | llm=off |
| harvest-gemma4-e4b | harvest | 2026.11.27-1 · gemma-4-E4B_q4_0-it.gguf | llm=http://127.0.0.1:18101/v1 |
| harvest-granite42-3b | harvest | 2026.11.27-1 · granite-4.2-3b-Q4_K_M.gguf | llm=http://127.0.0.1:18102/v1 |
| harvest-gpt-oss-20b | harvest | 2026.11.27-1 · gpt-oss-20b-MXFP4.gguf | llm=http://127.0.0.1:18103/v1 |

## Headline

| Metric | harvest-model-off | harvest-gemma4-e4b | harvest-granite42-3b | harvest-gpt-oss-20b |
|---|---|---|---|---|
| Items / errors | 342 / 0 | 342 / 0 | 342 / 0 | 342 / 0 |
| Answerable graded / expected | 291 / 291 | 291 / 291 | 291 / 291 | 291 / 291 |
| Fully correct (answerable) | 0.282 (0.230–0.333) | 0.306 (0.254–0.357) | 0.296 (0.244–0.347) | 0.323 (0.271–0.378) |
| Mean score /1 (answerable) | 0.338 | 0.388 | 0.380 | 0.390 |
| Must-decline handled | 0.745 | 0.490 | 0.667 | 0.647 |
| Decline precision | 0.277 | 0.438 | 0.327 | 0.347 |
| Decline recall | 0.745 | 0.412 | 0.667 | 0.647 |
| False-decline rate (answerable) | 0.340 | 0.093 | 0.241 | 0.213 |
| Unsupported-claim rate | 0.039 | 0.036 | 0.045 | 0.041 |
| Answers with ≥1 unsupported claim | 0.117 | 0.051 | 0.094 | 0.090 |
| Citation precision (matches gold) | 0.457 | 0.571 | 0.497 | 0.528 |
| Citation precision (supports a claim) | 0.476 | 0.268 | 0.381 | 0.410 |
| Citations that exist in the corpus | 1.000 | 1.000 | 1.000 | 1.000 |
| Quotes verbatim | 1.000 (406/406) | 1.000 (405/405) | 1.000 (416/416) | 1.000 (401/401) |
| Retrieval R@5 (lineage) | 0.637 (0.589–0.689) | 0.641 (0.592–0.691) | 0.634 (0.583–0.683) | 0.640 (0.590–0.691) |
| Bake hit rate | 0.000 | 0.000 | 0.000 | 0.000 |
| Equipment-specific fully correct | 0.352 (n=122) | 0.410 (n=122) | 0.344 (n=122) | 0.369 (n=122) |
| Latency p50 / p95 ms (reported) | 5 / 20 | 5466 / 10983 | 4148 / 8263 | 4510 / 10788 |
| Latency p50 / p95 ms (wall) | 69 / 88 | 5538 / 11058 | 4210 / 8318 | 4589 / 10869 |
| Judge agreement (exact / κ) | 0.842 / 0.757 (n=38) | 0.882 / 0.812 (n=51) | 0.976 / 0.961 (n=41) | 0.907 / 0.851 (n=43) |

## Retrieval: harvest-model-off

| Level | P@1 | P@3 | P@5 | P@10 | R@1 | R@3 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|---|---|---|---|---|
| strict | 0.447 | 0.261 | 0.206 | 0.118 | 0.313 | 0.475 | 0.567 | 0.612 | 0.550 |
| lineage | 0.474 | 0.320 | 0.258 | 0.153 | 0.347 | 0.544 | 0.637 | 0.679 | 0.578 |
| section | 0.581 | 0.472 | 0.438 | 0.288 | 0.570 | 0.745 | 0.826 | 0.862 | 0.682 |

## Retrieval: harvest-gemma4-e4b

| Level | P@1 | P@3 | P@5 | P@10 | R@1 | R@3 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|---|---|---|---|---|
| strict | 0.450 | 0.262 | 0.212 | 0.124 | 0.312 | 0.470 | 0.568 | 0.619 | 0.552 |
| lineage | 0.485 | 0.324 | 0.265 | 0.166 | 0.357 | 0.534 | 0.641 | 0.690 | 0.582 |
| section | 0.608 | 0.499 | 0.465 | 0.319 | 0.597 | 0.748 | 0.829 | 0.869 | 0.699 |

## Retrieval: harvest-granite42-3b

| Level | P@1 | P@3 | P@5 | P@10 | R@1 | R@3 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|---|---|---|---|---|
| strict | 0.440 | 0.270 | 0.210 | 0.123 | 0.312 | 0.480 | 0.564 | 0.616 | 0.549 |
| lineage | 0.481 | 0.333 | 0.266 | 0.163 | 0.359 | 0.557 | 0.634 | 0.692 | 0.586 |
| section | 0.588 | 0.480 | 0.440 | 0.297 | 0.575 | 0.759 | 0.823 | 0.870 | 0.690 |

## Retrieval: harvest-gpt-oss-20b

| Level | P@1 | P@3 | P@5 | P@10 | R@1 | R@3 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|---|---|---|---|---|
| strict | 0.440 | 0.270 | 0.206 | 0.120 | 0.312 | 0.491 | 0.570 | 0.624 | 0.550 |
| lineage | 0.474 | 0.331 | 0.260 | 0.157 | 0.353 | 0.556 | 0.640 | 0.698 | 0.581 |
| section | 0.588 | 0.491 | 0.446 | 0.296 | 0.576 | 0.757 | 0.831 | 0.873 | 0.691 |

## Fully correct by category

| Category | n | harvest-model-off | harvest-gemma4-e4b | harvest-granite42-3b | harvest-gpt-oss-20b |
|---|---|---|---|---|---|
| assembly-disassembly | 21 | 0.238 | 0.333 | 0.333 | 0.286 |
| crawler-truck-locomotive | 7 | 0.286 | 0.571 | 0.286 | 0.286 |
| derricks | 5 | 0.200 | 0.200 | 0.400 | 0.200 |
| design-modification | 6 | 0.000 | 0.000 | 0.167 | 0.000 |
| fall-protection | 5 | 0.200 | 0.200 | 0.000 | 0.400 |
| floating-cranes | 9 | 0.444 | 0.556 | 0.444 | 0.444 |
| ground-conditions | 7 | 0.714 | 0.286 | 0.714 | 0.714 |
| inspections | 29 | 0.138 | 0.138 | 0.172 | 0.172 |
| load-charts | 9 | 0.222 | 0.333 | 0.222 | 0.333 |
| multiple-crane-lifts | 6 | 0.333 | 0.500 | 0.333 | 0.333 |
| operational-aids | 11 | 0.182 | 0.182 | 0.182 | 0.182 |
| operator-duties | 11 | 0.273 | 0.273 | 0.182 | 0.273 |
| operator-qualification | 15 | 0.267 | 0.333 | 0.133 | 0.400 |
| overhead-gantry | 17 | 0.529 | 0.529 | 0.529 | 0.529 |
| personnel-lifts | 13 | 0.077 | 0.077 | 0.077 | 0.077 |
| power-lines | 26 | 0.192 | 0.269 | 0.269 | 0.269 |
| rigging-slings | 14 | 0.357 | 0.286 | 0.357 | 0.357 |
| safety-devices | 5 | 0.200 | 0.200 | 0.200 | 0.200 |
| scope-definitions | 14 | 0.286 | 0.286 | 0.214 | 0.286 |
| sideboom-pile-small | 4 | 0.500 | 0.250 | 0.500 | 0.500 |
| signals | 15 | 0.333 | 0.333 | 0.333 | 0.400 |
| tower-cranes | 6 | 0.500 | 0.500 | 0.500 | 0.500 |
| training | 8 | 0.000 | 0.000 | 0.125 | 0.125 |
| wind-weather | 5 | 0.200 | 0.400 | 0.400 | 0.400 |
| wire-rope | 19 | 0.526 | 0.526 | 0.526 | 0.579 |
| work-area-control | 4 | 0.250 | 0.500 | 0.250 | 0.250 |

## Item-by-item comparisons

| A vs B | n | A better | B better | ties | sign-test p | only A fully correct | only B fully correct | McNemar p |
|---|---|---|---|---|---|---|---|---|
| harvest-model-off vs harvest-gemma4-e4b | 342 | 32 | 32 | 278 | 1.000 | 27 | 21 | 0.471 |
| harvest-model-off vs harvest-granite42-3b | 342 | 17 | 24 | 301 | 0.349 | 16 | 16 | 1.000 |
| harvest-model-off vs harvest-gpt-oss-20b | 342 | 8 | 23 | 311 | 0.011 | 8 | 15 | 0.210 |

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
