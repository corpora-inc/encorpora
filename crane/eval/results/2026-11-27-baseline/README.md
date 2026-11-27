# Baseline, 2026-11-27

The first full run of the held-out set (`heldout-v1.jsonl`, 342 items: 291
answerable, 51 must-decline) against the crane pack as `main` built it at `8a8eccc16`,
with the model off, and against general-purpose models with no retrieval.

`report.md`, `results.json` and `items.csv` are the harness outputs;
`responses/` holds every answer; `config.yaml` is the exact configuration.

## What ran

| System | What it is | Where |
|---|---|---|
| `harvest-model-off` | `harvest ask --json --llm off --role operator` (core CLI, lexical BM25; see *Limits*) over the pack built from `main` at `8a8eccc16` | Lab machine |
| `frontier-alone` | Claude Sonnet (`claude-sonnet-5-5`), headless, no tools, no retrieval | Anthropic API via `claude -p` |
| `gemma4-e4b-alone` | Gemma 4 E4B instruct, Google QAT Q4_0 GGUF, thinking off, no retrieval | Lab machine, llama-server |
| `granite42-3b-alone` | Granite 4.2 3B instruct, Q4_K_M GGUF, thinking off, no retrieval | Lab machine, llama-server |
| `gpt-oss-20b-alone` | gpt-oss 20B, MXFP4 GGUF, reasoning effort low, no retrieval | Lab machine, llama-server |

The baselines share one system prompt that names the four regulations and asks
for citations and for a decline when the regulations do not cover a question
(`config.yaml`). All baselines ran at temperature 0.

Judge: Claude Opus (`claude-opus-5-5`) grades correctness 0/1/2 against the gold
answer, and separately checks each claim against only the text of the sections
the answer cited. A seeded 15% sample is re-graded by Sonnet for agreement.

## Headline

Fully correct is the share of the 291 answerable items the judge scored 2 (every
key fact right, nothing contradicting the gold). 95% bootstrap interval in
parentheses.

| | Model-off engine | Sonnet alone | Gemma 4 E4B alone | Granite 4.2 3B alone | gpt-oss 20B alone |
|---|---|---|---|---|---|
| Fully correct, answerable | **19.2%** (14.8–24.1) | **80.1%** (75.6–84.5) | 1.4% (0.3–2.7) | 2.7% (1.0–4.8) | 3.4% (1.4–5.5) |
| Must-decline items declined | 92.2% | 98.0% | 100% | 92.2% | 78.4% |
| Must-decline items handled (judge score 2) | 92.2% | 96.1% | 96.1% | 76.5% | 76.5% |
| Answerable items declined | 57.4% | 2.4% | 73.9% | 51.5% | 8.6% |
| Unsupported-claim rate | **0.0%** | 25.3% | 99.5% | 98.4% | 99.6% |
| Answers with any unsupported claim | **0.0%** | 81.8% | 100% | 100% | 100% |
| Citations on the gold section's lineage | 49.8% | 31.5% | 0.0% | 2.7% | 0.6% |
| Citations that exist in the corpus | **100%** | 96.1% | 84.0% | 89.6% | 55.7% |
| Quotes verbatim | **100%** (307/307) | no quotes | no quotes | no quotes | no quotes |
| Retrieval R@5, lineage / section | 0.601 / 0.824 | – | – | – | – |
| Bake hit rate | 0% (no answer rows in the pack) | – | – | – | – |
| Equipment-specific items fully correct (n=122) | 29.5% | 69.7% | 1.6% | 3.3% | 4.1% |
| Latency p50 / p95 | 2 / 5 ms in the engine | 10.1 / 17.6 s | 1.7 / 4.0 s | 2.9 / 10.0 s | 6.6 / 34.0 s |
| Judge agreement, exact / κ (Sonnet re-grade) | 0.95 / 0.92 (n=20) | 0.95 / 0.87 (n=60) | 0.97 / 0.91 (n=60) | 0.97 / 0.92 (n=60) | 0.93 / 0.85 (n=60) |

Item by item over all 342 items, Sonnet alone beats the model-off engine on 212
items and loses on 16 (sign test p < 1e-44). The model-off engine beats each
on-device-class model alone: Gemma 89–30 (p = 6e-8), Granite 96–54 (p = 8e-4),
gpt-oss 93–75 (p = 0.19 on the score; on fully-correct disagreements 67–13,
McNemar p = 6e-10). Full tables: `report.md`.

## Findings

1. **The model-off engine never says anything the text does not say, but it
   answers too rarely.** Every one of its 307 quotes is verbatim, every citation
   exists, and the support judge found no unsupported claim. It declines 57% of
   answerable questions, so only 19% are fully correct. When it does answer,
   45% of answers are fully correct (56 of 124).
2. **Most of those declines are the answer gate, not retrieval.** Of 167
   declined answerable items, 105 had a gold section in the top 5 retrieved
   (112 in the top 10). The model-off engine declines when fewer than half of
   the question's content concepts appear in one section
   (`AskOptions::support_threshold = 0.5`). Job-site phrasing ("stick", "hot
   line", "the book") rarely shares half its words with the rule text.
   `tools/decline_analysis.py` reproduces the split.
3. **Retrieval finds the right section more often than the right paragraph.**
   Lineage R@5 is 0.60; section-level R@5 is 0.82. The pack at `8a8eccc16` has
   section text only (no facts, explanations, terms, answer cache or
   applicability rows), and the CLI searches it lexically.
4. **Sonnet alone knows the rules well but cannot show its work.** It is fully
   correct on 80% of answerable items and declines must-decline items as well as
   the engine does. But 25% of its claims are not supported by the sections it
   cites, 82% of its answers carry at least one such claim, only 31% of its
   citations sit on the gold section's lineage, and 4% cite paragraphs that do
   not exist. It answers from memory, and its citations are often approximate.
5. **On-device-class models alone are not usable for this.** Gemma 4 E4B is
   fully correct on 1% of answerable items: without the text it declines 74% of
   them, and nearly every claim it does make is unsupported by what it cites.
   Granite 4.2 3B (2.7%) and gpt-oss 20B (3.4%) are no better. gpt-oss
   answers nearly everything and declines only 78% of must-decline items, and
   44% of its citations name paragraphs that do not exist. A decline is not
   always clean: eight of Granite's 47 declines come with made-up or
   misattributed citations, so the judge counts only 39 as handled. A small model without
   the text either refuses or invents.
6. **The gap to close is clear.** The engine already has the grounding (0%
   unsupported, 100% verbatim) that no baseline has; the model-off composer and
   gate are what hold it back. The on-device model's job in the plan is exactly
   that gap: expand job-site phrasing into retrieval queries, choose among
   retrieved passages, and compose from them under the support check. The
   answer cache in the bake is the other lever: the bake hit rate is 0% on this
   pack because it has no answer rows.

## Configuration and provenance

| | |
|---|---|
| Set | `heldout-v1.jsonl`, sha256 `21f018c2ce5a65ba…` (in `results.json`), 342 items |
| Source edition | eCFR Title 29, up to date as of 2026-11-24 (same bytes as the set's `sources/registry.json`; `harvest-bake fetch` reported all four sources unchanged) |
| Code | `main` at `8a8eccc16` (#2538): `harvest/core`, `harvest/pipeline`, `harvest/eval`, `crane/content` exported with `git archive`. The Granite re-run used this change's `harvest_eval/backends.py` fix on top of that commit, so `results.json` records the harness as `8a8eccc16` |
| Pack | `crane-us` 2026.11.27-1, sqlite sha256 `d36fbdad33e72e4f…`, manifest sha256 `e34a0b12617deab5…`, signed with a throwaway lab key made for this run (not a release key) |
| Pack contents | 4 sources, 2,258 sections, 565 cross-references, 33 equipment rows, 18 topics, 213 skills, 2,248 chunks with int8 EmbeddingGemma 2 vectors; 0 terms, facts, explanations, answers, procedures, applicability rows (the frontier cache reached `main` later, in #2539; content imports are not on `main` yet) |
| Embedder (bake) | `ggml-org/embeddinggemma-2-GGUF` Q8_0, sha256 `2188ac1deca4b77d…` |
| Core CLI | `cargo build --release` of `harvest/core` on the lab machine |
| Lab machine | NVIDIA DGX Spark: GB10 (Grace, 10 Cortex-X925 + 10 Cortex-A725; Blackwell GPU), 128 GB unified memory, Linux 7.0 aarch64, driver 580 |
| llama.cpp | v1.1.0 (`17152752261`), CUDA build, `-ngl 99 -fa on`, 3 slots of 4,096 tokens (`lab/serve.sh`) |
| Model files | Gemma 4 E4B: `google/gemma-4-E4B-it-qat-q4_0-gguf`; Granite 4.2 3B: `ibm-granite/granite-4.2-3b-GGUF` Q4_K_M; gpt-oss 20B: `ggml-org/gpt-oss-20b-GGUF` MXFP4 |
| Harness and judge host | Mac (Apple silicon), Python 3.14; Claude Code headless |
| Claude usage | Sonnet answers $5.55; Opus judge + Sonnet re-grade $38.30 (model-off 2.50, Sonnet 18.68, Gemma 3.23, Granite 7.14, gpt-oss 6.75), plus $1.72 on the discarded Granite run and $30.33 re-judging support after the fixes below; dollar figures are what headless Claude reports per call |

## Latency

`harvest-model-off` reports 2 ms p50 / 5 ms p95 inside the engine (`elapsed_ms`).
Run on the lab machine directly, wall time per question including process start
and pack verification was 23 ms p50 / 27 ms p95; through the ssh wrapper used for
the judged run it is 45 / 56 ms. The answers are identical either way (all 342
compared). The baselines' latencies are wall time through
an ssh tunnel with three questions in flight, so they are not device numbers; the
device benchmark matrix (time to first token, tokens per second, memory) is a
separate measurement.

## Limits

- **Lexical only.** The pack carries EmbeddingGemma 2 vectors, but the `harvest`
  CLI on `main` has no EmbeddingGemma query embedder, so dense retrieval is
  refused on the id check and the run is BM25 alone. The hybrid number waits for
  a query-side embedder in the CLI.
- **No equipment filter.** The pack has no `applies_to` rows yet, so passing the
  item's equipment would change nothing; the run does not pass it.
- **Two table quotes do not validate against the pack.** Items 0212 and 0252
  quote table rows (`match: table-cells`); the pack's table text separates cells
  differently from the set's reference split. Retrieval and correctness are not
  affected; only `check-ids` reports them.
- **Id spelling.** The pipeline writes appendix ids as `29cfr1926.cc.appC` and
  tables as `-table-A`; the set uses `29cfr1926-subpartCC-appC` and `-tableA`.
  `config.yaml` maps them (`match.aliases`). With the aliases, all 505 gold ids
  exist in the pack.
- When the cited text is over 40,000 characters, the support judge sees
  excerpts. A paragraph that shares no words with a claim (an exception
  elsewhere in the section, say) is left out, which can make the judge slightly
  lenient. For the engine, "citation precision (supports a claim)" counts only
  text claims. Its answers are mostly verbatim quotes, which are checked
  deterministically, so that row (6%) says little about them.
- The judge is a model. Agreement with the second judge is reported per backend
  (exact agreement 0.93–0.97, Cohen's κ 0.85–0.92).
- No credentialed crane expert has reviewed the set yet (see `../../README.md`).

## Reproduce

On the lab machine, from a `git archive` of the commit above (`lab/` has the
scripts; set `LAB`, `LLAMA_SERVER`):

```sh
harvest-bake keygen $LAB/keys/eval.pem                    # once, outside git
harvest-bake fetch crane/content/corpus.yaml
lab/build_pack.sh <tree> main-8a8eccc16                   # under the shared job guard
(cd harvest/core && cargo build --release)
lab/serve.sh gemma4-e4b <gguf> 18101 10800                # one model at a time
```

On the Mac (the judge needs Claude Code), with the lab's ports tunnelled and
`HARVEST_LOCAL_PACKS`, `HARVEST_REMOTE_PACKS`, `HARVEST_REMOTE_BIN` and
`HARVEST_REMOTE_PUBKEY` set for `lab/harvest-remote.sh`:

```sh
cd harvest/eval
.venv/bin/python -m harvest_eval run --config ../../crane/eval/results/2026-11-27-baseline/config.yaml \
    --pack <local mirror of the pack> --binary ../../crane/eval/results/2026-11-27-baseline/lab/harvest-remote.sh \
    --out ../../crane/eval/results/2026-11-27-baseline
python3 ../../crane/eval/tools/decline_analysis.py ../../crane/eval/results/2026-11-27-baseline/items.csv \
    --backend harvest-model-off
```

Responses resume from `responses/` and judge calls from the judge cache, so a
re-run pays only for what changed.

## Harness fixes in this change

The first Granite run returned an empty `content` on every item: Granite 4.2
thinks by default and spent the whole 800-token budget in `reasoning_content`.
The harness graded those empty strings as answers. `OpenAIBackend` now records
an empty answer as a failed call with its `finish_reason` and reasoning length,
and a test covers it. The Granite run in this directory is the re-run with
thinking off; the invalid run is not included. During the re-run the shared job
guard stopped the Granite server once at its 95 °C limit; the run resumed from
the saved responses after the machine cooled.

**The support judge saw truncated text.** It got each cited section cut at
6,000 characters (16,000 in all). Baselines cite whole sections (§1926.1408,
§1926.1401), so for 240 of 341 Sonnet answers the paragraph a claim rested on
could be cut off. The judge now sees the full cited text up to 40,000
characters (§1926.1401, the longest section, is about 21,000). Beyond that it
sees the cited paragraphs, and sentence windows of long paragraphs, that
contain the claims' words. Every support verdict in this directory comes from
the fixed harness. Sonnet's unsupported-claim rate moved from 28.7% to 25.3%.
The fix landed in two steps (#2545 used excerpts above 6,000 characters; the
follow-up raised the full-text window), and the numbers here are from the
second.

**Section labels were counted as claims.** A composed answer labels each quote
with a text segment such as "§1926.1437(m)(1) Load charts". These are now
headings, not claims. Resumed harvest responses are re-parsed from the CLI's raw
output, so a parser fix reaches stored runs. Tests cover both fixes.
