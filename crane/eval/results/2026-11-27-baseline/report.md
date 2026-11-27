# Evaluation report

Set: `../../crane/eval/results/2026-11-27-baseline/../../heldout-v1.jsonl` (342 items, sha256 `21f018c2ce5a65ba…`). Run 2026-11-27T15:12:14+00:00 → 2026-11-27T15:12:31+00:00. Harness commit `8a8eccc169`. Host: Darwin arm64, Python 3.14.9.

Judge: opus; agreement check with sonnet on a 15% sample. Judge calls this run: 0 (cached calls are free and not counted).

## Systems

| System | Kind | Pack / model | Notes |
|---|---|---|---|
| harvest-model-off | harvest | 2026.11.27-1  | llm=off |
| frontier-alone | claude | sonnet · claude-sonnet-5-5 |  |
| gemma4-e4b-alone | openai | gemma-4-E4B_q4_0-it.gguf · <lab>/crane-lab/models/google__gemma-4-E4B-it-qat-q4_0-gguf/gemma-4-E4B_q4_0-it.gguf | http://127.0.0.1:18101/v1 |
| granite42-3b-alone | openai | granite-4.2-3b-Q4_K_M.gguf · <lab>/crane-lab/models/ibm-granite__granite-4.2-3b-GGUF/granite-4.2-3b-Q4_K_M.gguf | http://127.0.0.1:18102/v1 |
| gpt-oss-20b-alone | openai | gpt-oss-20b-MXFP4.gguf · <lab>/crane-lab/models/ggml-org__gpt-oss-20b-GGUF/gpt-oss-20b-MXFP4.gguf | http://127.0.0.1:18103/v1 |

## Headline

| Metric | harvest-model-off | frontier-alone | gemma4-e4b-alone | granite42-3b-alone | gpt-oss-20b-alone |
|---|---|---|---|---|---|
| Items / errors | 342 / 0 | 342 / 0 | 342 / 0 | 342 / 0 | 342 / 0 |
| Answerable graded / expected | 291 / 291 | 291 / 291 | 291 / 291 | 291 / 291 | 291 / 291 |
| Fully correct (answerable) | 0.192 (0.148–0.241) | 0.801 (0.756–0.845) | 0.014 (0.003–0.027) | 0.027 (0.010–0.048) | 0.034 (0.014–0.055) |
| Mean score /1 (answerable) | 0.247 | 0.859 | 0.055 | 0.120 | 0.172 |
| Must-decline handled | 0.922 | 0.961 | 0.961 | 0.765 | 0.765 |
| Decline precision | 0.220 | 0.877 | 0.192 | 0.239 | 0.615 |
| Decline recall | 0.922 | 0.980 | 1.000 | 0.922 | 0.784 |
| False-decline rate (answerable) | 0.574 | 0.024 | 0.739 | 0.515 | 0.086 |
| Unsupported-claim rate | 0.000 | 0.287 | 0.997 | 0.995 | 0.997 |
| Answers with ≥1 unsupported claim | 0.000 | 0.856 | 1.000 | 1.000 | 1.000 |
| Citation precision (matches gold) | 0.498 | 0.315 | 0.000 | 0.027 | 0.006 |
| Citation precision (supports a claim) | 0.526 | 0.718 | 0.012 | 0.008 | 0.006 |
| Citations that exist in the corpus | 1.000 | 0.961 | 0.840 | 0.896 | 0.557 |
| Quotes verbatim | 1.000 (307/307) | – (0/0) | – (0/0) | – (0/0) | – (0/0) |
| Retrieval R@5 (lineage) | 0.601 (0.551–0.652) | – | – | – | – |
| Bake hit rate | 0.000 | – | – | – | – |
| Equipment-specific fully correct | 0.295 (n=122) | 0.697 (n=122) | 0.016 (n=122) | 0.033 (n=122) | 0.041 (n=122) |
| Latency p50 / p95 ms (reported) | 2 / 5 | 10073 / 17604 | 1653 / 4047 | 2906 / 9962 | 6614 / 33974 |
| Latency p50 / p95 ms (wall) | 45 / 56 | 10073 / 17604 | 1653 / 4047 | 2906 / 9962 | 6614 / 33974 |
| Judge agreement (exact / κ) | 0.950 / 0.918 (n=20) | 0.950 / 0.866 (n=60) | 0.967 / 0.907 (n=60) | 0.967 / 0.920 (n=60) | 0.933 / 0.851 (n=60) |

## Retrieval: harvest-model-off

| Level | P@1 | P@3 | P@5 | P@10 | R@1 | R@3 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|---|---|---|---|---|
| strict | 0.464 | 0.281 | 0.213 | 0.141 | 0.321 | 0.487 | 0.559 | 0.637 | 0.559 |
| lineage | 0.474 | 0.316 | 0.249 | 0.172 | 0.338 | 0.531 | 0.601 | 0.659 | 0.571 |
| section | 0.588 | 0.501 | 0.469 | 0.403 | 0.576 | 0.750 | 0.824 | 0.860 | 0.688 |

## Fully correct by category

| Category | n | harvest-model-off | frontier-alone | gemma4-e4b-alone | granite42-3b-alone | gpt-oss-20b-alone |
|---|---|---|---|---|---|---|
| assembly-disassembly | 21 | 0.095 | 0.905 | 0.000 | 0.000 | 0.000 |
| crawler-truck-locomotive | 7 | 0.143 | 0.286 | 0.000 | 0.000 | 0.000 |
| derricks | 5 | 0.200 | 0.600 | 0.000 | 0.000 | 0.000 |
| design-modification | 6 | 0.000 | 0.500 | 0.000 | 0.000 | 0.000 |
| fall-protection | 5 | 0.400 | 0.800 | 0.000 | 0.000 | 0.000 |
| floating-cranes | 9 | 0.222 | 0.667 | 0.000 | 0.000 | 0.000 |
| ground-conditions | 7 | 0.286 | 0.857 | 0.000 | 0.000 | 0.000 |
| inspections | 29 | 0.172 | 0.793 | 0.034 | 0.034 | 0.000 |
| load-charts | 9 | 0.111 | 0.556 | 0.000 | 0.000 | 0.000 |
| multiple-crane-lifts | 6 | 0.167 | 1.000 | 0.000 | 0.000 | 0.000 |
| operational-aids | 11 | 0.182 | 0.636 | 0.000 | 0.000 | 0.000 |
| operator-duties | 11 | 0.091 | 0.818 | 0.000 | 0.000 | 0.000 |
| operator-qualification | 15 | 0.200 | 0.800 | 0.000 | 0.000 | 0.133 |
| overhead-gantry | 17 | 0.412 | 0.882 | 0.000 | 0.000 | 0.000 |
| personnel-lifts | 13 | 0.077 | 0.615 | 0.000 | 0.077 | 0.154 |
| power-lines | 26 | 0.154 | 0.846 | 0.000 | 0.000 | 0.000 |
| rigging-slings | 14 | 0.286 | 1.000 | 0.000 | 0.000 | 0.000 |
| safety-devices | 5 | 0.200 | 0.800 | 0.200 | 0.200 | 0.200 |
| scope-definitions | 14 | 0.071 | 0.929 | 0.000 | 0.143 | 0.143 |
| sideboom-pile-small | 4 | 0.500 | 0.500 | 0.000 | 0.000 | 0.000 |
| signals | 15 | 0.200 | 1.000 | 0.133 | 0.200 | 0.133 |
| tower-cranes | 6 | 0.500 | 0.667 | 0.000 | 0.000 | 0.000 |
| training | 8 | 0.000 | 0.875 | 0.000 | 0.000 | 0.125 |
| wind-weather | 5 | 0.400 | 1.000 | 0.000 | 0.000 | 0.000 |
| wire-rope | 19 | 0.263 | 0.842 | 0.000 | 0.000 | 0.000 |
| work-area-control | 4 | 0.000 | 0.750 | 0.000 | 0.000 | 0.000 |

## Item-by-item comparisons

| A vs B | n | A better | B better | ties | sign-test p | only A fully correct | only B fully correct | McNemar p |
|---|---|---|---|---|---|---|---|---|
| harvest-model-off vs frontier-alone | 342 | 16 | 212 | 114 | 0.000 | 12 | 191 | 0.000 |
| harvest-model-off vs gemma4-e4b-alone | 342 | 89 | 30 | 223 | 0.000 | 58 | 8 | 0.000 |
| harvest-model-off vs granite42-3b-alone | 342 | 96 | 54 | 192 | 0.001 | 68 | 12 | 0.000 |
| harvest-model-off vs gpt-oss-20b-alone | 342 | 93 | 75 | 174 | 0.190 | 67 | 13 | 0.000 |

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
