# Evaluation report

Set: `<perturbed>/heldout-v1-typo1.jsonl` (342 items, sha256 `4d743bee1908aa35…`). Run 2026-11-28T03:22:43+00:00 → 2026-11-28T03:23:11+00:00. Harness commit `dcdb0d91a8`. Host: Darwin arm64, Python 3.14.9.

## Systems

| System | Kind | Pack / model | Notes |
|---|---|---|---|
| search-lexical | harvest-search | 2026.11.27-1  |  |

## Headline

| Metric | search-lexical |
|---|---|
| Items / errors | 342 / 0 |
| Answerable graded / expected | 0 / 291 |
| Fully correct (answerable) | – |
| Mean score /1 (answerable) | – |
| Must-decline handled | – |
| Decline precision | – |
| Decline recall | 0.000 |
| False-decline rate (answerable) | 0.000 |
| Unsupported-claim rate | – |
| Answers with ≥1 unsupported claim | – |
| Citation precision (matches gold) | – |
| Citation precision (supports a claim) | – |
| Citations that exist in the corpus | – |
| Quotes verbatim | – (0/0) |
| Retrieval R@5 (lineage) | 0.619 (0.569–0.667) |
| Bake hit rate | 0.000 |
| Equipment-specific fully correct | – (n=0) |
| Latency p50 / p95 ms (reported) | 3 / 4 |
| Latency p50 / p95 ms (wall) | 80 / 95 |
| Judge agreement (exact / κ) | – / – (n=0) |

## Retrieval: search-lexical

| Level | P@1 | P@3 | P@5 | P@10 | R@1 | R@3 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|---|---|---|---|---|
| strict | 0.450 | 0.265 | 0.199 | 0.132 | 0.316 | 0.472 | 0.542 | 0.643 | 0.547 |
| lineage | 0.474 | 0.315 | 0.251 | 0.179 | 0.345 | 0.544 | 0.619 | 0.718 | 0.577 |
| section | 0.591 | 0.471 | 0.436 | 0.370 | 0.578 | 0.733 | 0.807 | 0.872 | 0.682 |

## Fully correct by category

| Category | n | search-lexical |
|---|---|---|

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
