# Evaluation report

Set: `../../crane/eval/heldout-v2.jsonl` (73 items, sha256 `f19bd6fe86d33a85…`). Run 2026-11-28T00:52:05+00:00 → 2026-11-28T01:10:40+00:00. Harness commit `e113660ed4`. Host: Darwin arm64, Python 3.14.9.

Judge: claude-opus-5-5, claude-sonnet-5-5; agreement check with sonnet on a 15% sample. Judge calls this run: 50 (cached calls are free and not counted).

## Systems

| System | Kind | Pack / model | Notes |
|---|---|---|---|
| frontier-alone | claude | sonnet · claude-sonnet-5-5 |  |
| opus-alone | claude | opus · claude-opus-5-5 |  |

## Headline

| Metric | frontier-alone | opus-alone |
|---|---|---|
| Items / errors | 73 / 0 | 73 / 0 |
| Answerable graded / expected | 59 / 59 | 59 / 59 |
| Fully correct (answerable) | 0.847 (0.746–0.932) | 0.797 (0.678–0.898) |
| Mean score /1 (answerable) | 0.907 | 0.881 |
| Must-decline handled | 1.000 | 1.000 |
| Decline precision | 0.933 | 1.000 |
| Decline recall | 1.000 | 1.000 |
| False-decline rate (answerable) | 0.017 | 0.000 |
| Unsupported-claim rate | 0.214 | 0.357 |
| Answers with ≥1 unsupported claim | 0.862 | 1.000 |
| Citation precision (matches gold) | 0.340 | 0.229 |
| Citation precision (supports a claim) | 0.741 | 0.586 |
| Citations that exist in the corpus | 0.960 | 0.896 |
| Quotes verbatim | – (0/0) | – (0/0) |
| Retrieval R@5 (lineage) | – | – |
| Bake hit rate | – | – |
| Equipment-specific fully correct | 0.786 (n=28) | 0.679 (n=28) |
| Latency p50 / p95 ms (reported) | 10551 / 17516 | 15420 / 26995 |
| Latency p50 / p95 ms (wall) | 10551 / 17516 | 15420 / 26995 |
| Judge agreement (exact / κ) | 1.000 / 1.000 (n=10) | 0.900 / 0.706 (n=10) |

## Fully correct by category

| Category | n | frontier-alone | opus-alone |
|---|---|---|---|
| assembly-disassembly | 6 | 1.000 | 0.667 |
| crawler-truck-locomotive | 3 | 1.000 | 0.333 |
| derricks | 2 | 0.500 | 1.000 |
| fall-protection | 1 | 1.000 | 1.000 |
| floating-cranes | 2 | 0.000 | 1.000 |
| inspections | 1 | 1.000 | 1.000 |
| operational-aids | 4 | 1.000 | 0.500 |
| operator-duties | 4 | 0.750 | 1.000 |
| operator-qualification | 4 | 1.000 | 1.000 |
| overhead-gantry | 3 | 1.000 | 1.000 |
| personnel-lifts | 3 | 0.667 | 0.667 |
| power-lines | 10 | 0.900 | 0.800 |
| rigging-slings | 4 | 1.000 | 1.000 |
| safety-devices | 1 | 1.000 | 1.000 |
| scope-definitions | 3 | 1.000 | 1.000 |
| sideboom-pile-small | 1 | 0.000 | 0.000 |
| tower-cranes | 2 | 1.000 | 0.500 |
| wire-rope | 4 | 0.500 | 0.750 |
| work-area-control | 1 | 1.000 | 1.000 |

## Item-by-item comparisons

| A vs B | n | A better | B better | ties | sign-test p | only A fully correct | only B fully correct | McNemar p |
|---|---|---|---|---|---|---|---|---|
| frontier-alone vs opus-alone | 73 | 9 | 5 | 59 | 0.424 | 8 | 5 | 0.581 |

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
