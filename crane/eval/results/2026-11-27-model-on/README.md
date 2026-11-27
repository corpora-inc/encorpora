# Model on, 2026-11-27

Held-out set v1 (342 items: 291 answerable, 51 must-decline) run through the
core engine's model loop (#2542) with three on-device-class US open-weight
models, and with the model off, all over the pack built from `main` at
`8a62f3fd6`. That pack is the first with baked content: the frontier cache of
#2539 adds facts, terms, explanations and applicability rows to the section
text. The no-retrieval baselines and the section-only pack are in
`../2026-11-27-baseline/`.

`report.md`, `results.json` and `items.csv` are the harness outputs;
`responses/` holds every answer; `config.yaml` is the exact configuration.

## What ran

| System | What it is |
|---|---|
| `harvest-model-off` | `harvest ask --json --llm off --role operator` |
| `harvest-gemma4-e4b` | the same with `--llm` on Gemma 4 E4B instruct (Google QAT Q4_0 GGUF) |
| `harvest-granite42-3b` | the same with Granite 4.2 3B instruct (Q4_K_M GGUF) |
| `harvest-gpt-oss-20b` | the same with gpt-oss 20B (MXFP4 GGUF) |

With a model, `ask` runs expand → retrieve (fused over the expansions) →
select → compose → strict check. The model's text is kept only when the check
passes. Otherwise the deterministic answer is returned. The model may also ask
a clarifying question (`mode = clarify`). Retrieval is lexical in every system:
the CLI cannot load the EmbeddingGemma 2 query embedder on its pinned llama.cpp.

Each model ran under llama-server on the lab machine, next to the `harvest`
binary, three questions in flight, with `--reasoning-budget 0` (see
*Findings 5*).

## Headline

Fully correct is the share of the 291 answerable items the judge scored 2.
95% bootstrap interval in parentheses.

| | Model off | + Gemma 4 E4B | + Granite 4.2 3B | + gpt-oss 20B |
|---|---|---|---|---|
| Fully correct, answerable | 28.2% (23.0–33.3) | 30.6% (25.4–35.7) | 29.6% (24.4–34.7) | **32.3%** (27.1–37.8) |
| Fully correct when it composed an answer | 82 / 192 (43%) | 89 / 191 (47%) | 86 / 211 (41%) | 94 / 195 (48%) |
| Answerable items declined | 34.0% | **9.3%** | 24.1% | 21.3% |
| Answerable items answered with a clarifying question | 0 | 73 (25%) | 10 (3%) | 34 (12%) |
| Must-decline items declined | **74.5%** | 41.2% | 66.7% | 64.7% |
| Model text kept after the check | – | 194 / 342 | 80 / 342 | 83 / 342 |
| Unsupported-claim rate | 3.9% | **3.6%** | 4.5% | 4.1% |
| Answers with any unsupported claim | 11.7% | **5.1%** | 9.4% | 9.0% |
| Citations on the gold section's lineage | 45.7% | **57.1%** | 49.7% | 52.8% |
| Citations that exist in the corpus | 100% | 100% | 100% | 100% |
| Quotes verbatim | 100% (406) | 100% (405) | 100% (416) | 100% (401) |
| Retrieval R@5, lineage / section | 0.637 / 0.826 | 0.641 / 0.829 | 0.634 / 0.823 | 0.640 / 0.831 |
| Equipment-specific items fully correct (n=122) | 35.2% | 41.0% | 34.4% | 36.9% |
| Judge agreement, exact / κ | 0.84 / 0.76 (n=38) | 0.88 / 0.81 (n=51) | 0.98 / 0.96 (n=41) | 0.91 / 0.85 (n=43) |

Against the same set, for reference (`../2026-11-27-baseline/`): the model-off
engine over the section-only pack was 19.2% fully correct, and Sonnet alone,
with no retrieval, 80.1% with 25.3% of its claims unsupported. Item by item against
the model-off engine on this pack: Gemma 32–32 (sign test p = 1.0), Granite
24–17 (p = 0.35), gpt-oss 23–8 (p = 0.011, still below 0.05 after a
three-comparison correction; on fully-correct disagreements 15–8, McNemar
p = 0.21).

## Findings

1. **Baked content moved the model-off engine from 19% to 28% fully
   correct.** Facts, terms and explanations give the job-site phrasing more to
   match, so false declines fall from 57% to 34% with the same answer gate. The
   price is decline discipline: must-decline items declined fall from 92% to
   75%. 13 of them now get a composed answer, 9 of those with a baked
   explanation in it.
2. **The model loop adds a little on top so far: 30–32% with a model against
   28% without.** gpt-oss is better than the model-off engine on the per-item
   score (23 items better, 8 worse, p = 0.011) but not significantly on fully
   correct (15–8, p = 0.21). Gemma and Granite are not distinguishable from it.
   The model's text survives the strict check in 23–57% of answers; the rest
   fall back to the deterministic answer.
3. **Grounding holds with the model on.** Every quote is verbatim and every
   citation exists in all four systems. 4% of claims are unsupported by the
   cited text, against 25% for Sonnet alone. With Gemma, 5% of answers carry an
   unsupported claim; Sonnet alone, 82%. The most frequent unsupported claims
   come from a few baked explanations that compress the rule (the §1926.1401
   definitions overview, the §1926.1437 floating-crane summary), and the
   model-off engine, which has no model text, carries them too (11.7% of its
   answers). Part of that count was judged on excerpts (cited text over 40,000
   characters), so treat the per-claim attribution as indicative.
4. **Clarifying questions mostly replace declines.** Gemma asks a clarifying
   question on 73 answerable items (25%), and each scores 0. The engine offers
   one only when something is relevant but no section answers, and the
   model-off engine declined 56 of those 73 (it fully answered 3). So Gemma's
   low 9% false-decline rate is largely clarifies in place of declines, not
   more answers. gpt-oss asks on 34 (model-off declined 31 of them). Of the
   answers Gemma does compose, 47% are fully correct.
5. **Reasoning models need the reasoning switched off at the server.** The
   core sends `chat_template_kwargs.enable_thinking = false`, but with a JSON
   schema in `response_format`, Gemma 4 E4B and gpt-oss 20B on llama.cpp v1.1.0
   still opened their reasoning channel and spent the whole budget there (the
   core's expand step allows 200 tokens), and the model call fell back to the
   deterministic answer. The
   runs here used `llama-server --reasoning-budget 0`. Without it, the model
   loop silently does nothing.
6. **Gemma declines least; the model-off engine declines best.** With Gemma,
   only 9% of answerable items are declined, but only 41% of must-decline items
   are. Of the 51 must-decline items, Gemma composes an answer to 19
   and asks a clarifying question on 11. Query expansion shows no measurable
   effect on retrieval: R@5 is 0.634–0.641 with a model against 0.637 without,
   all inside each other's intervals.
7. **Next measurements that would move the number.** The answer cache (bake
   hit rate is 0%: no answer rows yet), the dense half of retrieval (needs a
   query-side EmbeddingGemma 2 in the CLI), passing equipment now that
   applicability rows exist, and a clarify gate that answers when retrieval is
   strong.

## Configuration and provenance

| | |
|---|---|
| Set | `heldout-v1.jsonl` (same bytes as the baseline) |
| Code | `main` at `8a62f3fd6` (#2543), exported with `git archive`; `harvest` CLI built with `cargo build --release` on the lab machine; harness as in this change (`results.json` records the harness commit as `main` at the time of the run, `e1086068e`; the code that scored it is this change's `harvest/eval`) |
| Pack | `crane-us` 2026.11.27-1, sqlite sha256 `ab8ab619f3dfdee4…`, manifest sha256 `f461f0804c7bfa21…`, signed with a throwaway lab key made for this run (not a release key) |
| Pack contents | 4 sources, 2,258 sections, 565 cross-references, 33 equipment rows, 18 topics, 213 skills, 287 terms, 2,467 facts, 137 explanations, 165 applicability rows, 3,061 provenance rows, 5,139 chunks with int8 EmbeddingGemma 2 vectors; 0 answers, questions, lessons, procedures |
| Bake verdicts (pipeline) | terms 287 pass / 7 fail / 2 review; facts 2,467 / 85 / 9; explanations 137 / 4 / 0; applicability 170 / 1 / 0 |
| Lab machine | NVIDIA DGX Spark (GB10, 128 GB unified memory, Linux aarch64); llama.cpp v1.1.0 CUDA build, `-ngl 99 -fa on`, 3 slots of 4,096 tokens, `--reasoning-budget 0` |
| Model files | as in the baseline |
| Harness and judge host | Mac (Apple silicon); Claude Code headless; Opus judge, Sonnet re-grade on a 15% sample |
| Claude usage | Opus judge + Sonnet re-grade $36.22: first judging $18.63 (model off 8.66, Gemma 3.82, Granite 1.82, gpt-oss 4.33), re-judging support after the two window fixes $7.83 and $9.76. One more combined pass, run on a stale tree during a rebase, was discarded and its cost not recorded. Dollar figures are what headless Claude reports per call |

## Latency

Engine-reported time per question (`elapsed_ms`) on the lab machine, with the
model server on the same machine and three questions in flight. These are lab
numbers, not device numbers.

| | p50 | p95 |
|---|---|---|
| Model off | 5 ms | 20 ms |
| Gemma 4 E4B | 5.5 s | 11.0 s |
| Granite 4.2 3B | 4.1 s | 8.3 s |
| gpt-oss 20B | 4.5 s | 10.8 s |

## Limits

- Lexical retrieval only (see above), and no answer cache in the pack, so the
  bake hit rate is 0%.
- Equipment is not passed to `ask`, though the pack now has applicability rows.
- One run per model at temperature 0. The model servers ran three requests at
  once; llama.cpp batching can make outputs differ slightly from a single-request
  run.
- The judge is a model; agreement with the Sonnet re-grade is in the table. When
  the cited text is over 40,000 characters, the support judge sees excerpts (see
  *Harness fixes*). Whole-section cites reach that: §1910.179 is about 45,000
  characters. An answer that cites a section and one of its own paragraphs
  counts that paragraph twice toward the window, so excerpts start somewhat
  earlier than they need to.

## Reproduce

As in `../2026-11-27-baseline/README.md`, with the CLI and pack from
`8a62f3fd6`, each model served by `../2026-11-27-baseline/lab/serve.sh … --reasoning-budget 0`,
and this directory's `config.yaml`.

## Harness fixes in this change

- **Retrieved fact and term chunks were dropped from retrieval scoring.** The
  harness opened the pack's SQLite connection in the main thread and used it in
  the collector thread. The thread error was caught as "no sections", so every
  fact or term chunk mapped to nothing. The first pass on this pack reported R@5
  of 0.53; the right number is 0.64. The baseline pack had section chunks only,
  so it was not affected. The connection is now shared under a lock, lookup
  errors are printed, and a test asks from worker threads.
- **The support judge's window.** The judge now sees the full cited text up to
  40,000 characters and excerpts beyond that (see the baseline README). The
  first excerpt version could not split §1926.1401, a 21,000-character section
  with no labeled paragraphs, and marked its definitions unsupported. Long
  paragraphs are now split into sentence windows, and a test covers it.
