# Evaluation report

Set: `<perturbed>/heldout-v2-misspell.jsonl` (73 items, sha256 `2f5e2e4f91e1174f…`). Run 2026-11-28T02:17:08+00:00 → 2026-11-28T02:17:14+00:00. Harness commit `f520106f9e`. Host: Darwin arm64, Python 3.14.9.

## Systems

| System | Kind | Pack / model | Notes |
|---|---|---|---|
| search-lexical | harvest-search | 2026.11.27-1  |  |

## Headline

| Metric | search-lexical |
|---|---|
| Items / errors | 73 / 0 |
| Answerable graded / expected | 0 / 59 |
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
| Retrieval R@5 (lineage) | 0.599 (0.490–0.710) |
| Bake hit rate | 0.000 |
| Equipment-specific fully correct | – (n=0) |
| Latency p50 / p95 ms (reported) | 4 / 6 |
| Latency p50 / p95 ms (wall) | 79 / 97 |
| Judge agreement (exact / κ) | – / – (n=0) |

## Retrieval: search-lexical

| Level | P@1 | P@3 | P@5 | P@10 | R@1 | R@3 | R@5 | R@10 | MRR@10 |
|---|---|---|---|---|---|---|---|---|---|
| strict | 0.390 | 0.260 | 0.190 | 0.120 | 0.274 | 0.444 | 0.504 | 0.590 | 0.522 |
| lineage | 0.441 | 0.305 | 0.251 | 0.171 | 0.325 | 0.518 | 0.599 | 0.677 | 0.566 |
| section | 0.542 | 0.435 | 0.386 | 0.339 | 0.534 | 0.725 | 0.775 | 0.860 | 0.656 |

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
