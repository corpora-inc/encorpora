# Evaluation report

Set: `../../crane/eval/heldout-v2.jsonl` (73 items, sha256 `fce4576b732d8cd9…`). Run 2026-11-27T18:54:42+00:00 → 2026-11-27T18:54:42+00:00. Harness commit `8226c4eb3d`. Host: Darwin arm64, Python 3.14.9.

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
| Fully correct (answerable) | 0.203 (0.102–0.305) | 0.305 (0.186–0.424) | 0.305 (0.186–0.424) |
| Mean score /1 (answerable) | 0.246 | 0.441 | 0.441 |
| Must-decline handled | 0.929 | 1.000 | 1.000 |
| Decline precision | 0.406 | 0.481 | 0.500 |
| Decline recall | 0.929 | 0.929 | 0.929 |
| False-decline rate (answerable) | 0.322 | 0.237 | 0.220 |
| Unsupported-claim rate | 0.047 | 0.000 | 0.000 |
| Answers with ≥1 unsupported claim | 0.122 | 0.000 | 0.000 |
| Citation precision (matches gold) | 0.355 | 0.473 | 0.477 |
| Citation precision (supports a claim) | 0.571 | 0.170 | 0.165 |
| Citations that exist in the corpus | 1.000 | 1.000 | 1.000 |
| Quotes verbatim | 1.000 (64/64) | 1.000 (116/116) | 1.000 (113/113) |
| Retrieval R@5 (lineage) | 0.617 (0.508–0.725) | 0.770 (0.678–0.856) | 0.770 (0.678–0.856) |
| Bake hit rate | 0.000 | 0.000 | 0.000 |
| Equipment-specific fully correct | 0.214 (n=28) | 0.393 (n=28) | 0.393 (n=28) |
| Latency p50 / p95 ms (reported) | 4 / 17 | 18 / 28 | 4432 / 6431 |
| Latency p50 / p95 ms (wall) | 70 / 85 | 646 / 668 | 5110 / 7137 |
| Judge agreement (exact / κ) | 1.000 / 1.000 (n=5) | 1.000 / 1.000 (n=6) | 1.000 / 1.000 (n=6) |

## Retrieval: harvest-model-off

| Level | P@1 | P@3 | P@5 | P@10 | R@1 | R@3 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|---|---|---|---|---|
| strict | 0.424 | 0.254 | 0.193 | 0.107 | 0.297 | 0.465 | 0.517 | 0.568 | 0.548 |
| lineage | 0.475 | 0.299 | 0.261 | 0.147 | 0.347 | 0.534 | 0.617 | 0.665 | 0.582 |
| section | 0.559 | 0.435 | 0.407 | 0.253 | 0.551 | 0.771 | 0.805 | 0.822 | 0.663 |

## Retrieval: harvest-model-off-dense-gate

| Level | P@1 | P@3 | P@5 | P@10 | R@1 | R@3 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|---|---|---|---|---|
| strict | 0.661 | 0.367 | 0.271 | 0.163 | 0.425 | 0.627 | 0.699 | 0.771 | 0.755 |
| lineage | 0.678 | 0.407 | 0.319 | 0.195 | 0.442 | 0.692 | 0.770 | 0.846 | 0.772 |
| section | 0.729 | 0.582 | 0.525 | 0.356 | 0.712 | 0.907 | 0.924 | 0.975 | 0.817 |

## Retrieval: harvest-gpt-oss-20b-dense-gate

| Level | P@1 | P@3 | P@5 | P@10 | R@1 | R@3 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|---|---|---|---|---|
| strict | 0.644 | 0.367 | 0.271 | 0.163 | 0.419 | 0.627 | 0.699 | 0.771 | 0.744 |
| lineage | 0.678 | 0.407 | 0.319 | 0.193 | 0.453 | 0.692 | 0.770 | 0.846 | 0.772 |
| section | 0.729 | 0.582 | 0.522 | 0.353 | 0.712 | 0.907 | 0.924 | 0.975 | 0.817 |

## Fully correct by category

| Category | n | harvest-model-off | harvest-model-off-dense-gate | harvest-gpt-oss-20b-dense-gate |
|---|---|---|---|---|
| assembly-disassembly | 6 | 0.167 | 0.333 | 0.333 |
| crawler-truck-locomotive | 3 | 0.000 | 0.333 | 0.333 |
| derricks | 2 | 0.000 | 0.500 | 0.500 |
| fall-protection | 1 | 0.000 | 0.000 | 0.000 |
| floating-cranes | 2 | 0.500 | 1.000 | 1.000 |
| inspections | 1 | 0.000 | 0.000 | 0.000 |
| operational-aids | 4 | 0.000 | 0.000 | 0.000 |
| operator-duties | 4 | 0.000 | 0.000 | 0.000 |
| operator-qualification | 4 | 0.250 | 0.500 | 0.500 |
| overhead-gantry | 3 | 1.000 | 1.000 | 1.000 |
| personnel-lifts | 3 | 0.000 | 0.333 | 0.333 |
| power-lines | 10 | 0.300 | 0.200 | 0.200 |
| rigging-slings | 4 | 0.000 | 0.000 | 0.000 |
| safety-devices | 1 | 1.000 | 1.000 | 1.000 |
| scope-definitions | 3 | 0.000 | 0.000 | 0.000 |
| sideboom-pile-small | 1 | 0.000 | 0.000 | 0.000 |
| tower-cranes | 2 | 0.000 | 0.500 | 0.500 |
| wire-rope | 4 | 0.500 | 0.500 | 0.500 |
| work-area-control | 1 | 0.000 | 0.000 | 0.000 |

## Item-by-item comparisons

| A vs B | n | A better | B better | ties | sign-test p | only A fully correct | only B fully correct | McNemar p |
|---|---|---|---|---|---|---|---|---|
| harvest-model-off vs harvest-model-off-dense-gate | 73 | 1 | 19 | 53 | 0.000 | 1 | 8 | 0.039 |
| harvest-model-off vs harvest-gpt-oss-20b-dense-gate | 73 | 1 | 19 | 53 | 0.000 | 1 | 8 | 0.039 |
| harvest-model-off-dense-gate vs harvest-gpt-oss-20b-dense-gate | 73 | 0 | 0 | 73 | – | 0 | 0 | – |

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
