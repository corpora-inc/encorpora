# Dense gate, 2026-11-27

The core lane's dense retrieval (#2549) and dense answer gate (#2553), at the
setting it proposed, `--dense-gate 0.2:0.77`, judged on two sets:

- `heldout-v1/`: the 342-item set the setting was tuned on;
- `heldout-v2/`: a fresh 73-item set written after the tuning (59 answerable,
  14 must-decline), so the setting is also scored on items it never saw.

Same pack as `../2026-11-27-model-on/` (built from `main` at `8a62f3fd6`; no
pipeline input has changed since). CLI: `main` at `8226c4eb3`.

| System | What it is |
|---|---|
| `harvest-model-off` | lexical retrieval, default gate: the reference |
| `harvest-model-off-dense-gate` | EmbeddingGemma 2 dense retrieval fused with lexical, `--dense-gate 0.2:0.77`, model off |
| `harvest-gpt-oss-20b-dense-gate` | the same with gpt-oss 20B as the model (llama-server, no server-side reasoning budget, per #2550) |

The query embedder is the bake's own GGUF (EmbeddingGemma 2 Q8_0) behind
llama-server on the lab machine (`lab/serve_embed.sh`; `lab/serve_pair.sh` runs it
next to the LLM in one guarded GPU job).

## Headline

Fully correct = share of answerable items the judge scored 2; 95% bootstrap
interval in parentheses. "Declined" for must-decline items is `mode = declined`.

| | Lexical, default gate | Dense + gate, model off | Dense + gate, gpt-oss 20B |
|---|---|---|---|
| **v1 (tuned on)**, fully correct of 291 | 28.2% (23.0–33.3) | **40.5%** (34.7–46.0) | **42.6%** (37.1–48.5) |
| v1 must-decline declined, of 51 | 74.5% | 74.5% | 74.5% |
| v1 answerable declined | 34.0% | 25.1% | 25.1% |
| v1 unsupported-claim rate | 3.9% | 4.7% | 4.5% |
| v1 retrieval R@5, lineage | 0.637 | 0.751 | 0.760 |
| **v2 (fresh)**, fully correct of 59 | 20.3% (10.2–30.5) | **30.5%** (18.6–42.4) | **30.5%** (18.6–42.4) |
| v2 must-decline declined, of 14 | 92.9% | 92.9% | 92.9% |
| v2 answerable declined | 32.2% | 23.7% | 22.0% |
| v2 unsupported-claim rate | 4.7% | 0.0% | 0.0% |
| v2 retrieval R@5, lineage | 0.617 | 0.770 | 0.770 |

Every quote is verbatim and every citation exists in all six runs. Engine time
is 18 ms p50 with the model off and 4.2 s p50 with gpt-oss (lab machine, not a
device). Judge agreement with the Sonnet re-grade: 0.90 exact, κ 0.84 on v1.

Item by item against the lexical reference:

| | v1 better / worse (sign test) | v1 fully-correct only-b / only-a (McNemar) | v2 better / worse | v2 fully-correct |
|---|---|---|---|---|
| Dense + gate, model off | 82 / 30 (p = 9e-7) | 59 / 23 (p = 9e-5) | 19 / 1 (p = 4e-5) | 8 / 1 (p = 0.039) |
| Dense + gate, gpt-oss | 87 / 29 (p = 6e-8) | 64 / 22 (p = 7e-6) | 19 / 1 (p = 4e-5) | 8 / 1 (p = 0.039) |

## Findings

1. **The core lane's estimate holds when judged.** On v1 the setting is 40.5%
   fully correct with the model off (estimate about 41.8%), and must-decline
   items are declined at exactly the estimated 74.5% (38 of 51).
2. **The gain survives on items the gate never saw.** On v2 it is +10.2 points
   (20.3% → 30.5%), against +12.3 on v1. 19 v2 items get better and 1 gets worse,
   and must-decline declines stay at 13 of 14. v2 is small (the interval is about
   ±12 points) and its items score lower than v1's overall, so compare within a
   set, not across.
3. **gpt-oss adds almost nothing on top.** On v1 it is 42.6% against 40.5%
   (8 items better and 1 worse, p = 0.039; fully correct 7 / 1, p = 0.07). On v2
   it ties the model-off engine on every item. Its text survives the strict check
   in only 22 of 342 v1 answers (6%) and 4 of 73 v2 answers. Earlier, with the
   server-side `--reasoning-budget 0`, it survived in 83 of 342. In a sample of
   fallbacks, the compose step returned an empty segment list or a bare cite,
   which the check rejects. The small v1 gain comes from its query expansion
   (R@5 0.760 against 0.751), not from its prose.
4. **Grounding is unchanged.** Unsupported-claim rates stay at 0–5% of claims.
   Dense retrieval brings in more baked explanations (626 verbatim quotes on v1,
   against 406 lexical).

## The fresh set (heldout-v2)

Written with the v1 process and checks (`../../README.md`), after the gate was
tuned, by `tools/author.py --set v2 --avoid heldout-v1.jsonl`:

| Check | Result |
|---|---|
| Authored | 74 items in 7 batches (six section groups covering the whole corpus, one must-decline batch), `claude-opus-5-5`. Each batch was shown the v1 questions on its sections and told not to repeat them |
| Independent check (`claude-sonnet-5-5`, `tools/review.py`) | 74 keep, 0 flag, 0 drop; 6 gold answers corrected |
| Near-duplicates dropped (against v1 and each other) | 1, a near-repeat of a v1 item. The most similar remaining question shares 45% of its tokens with any v1 question (the drop line is 60%) |
| Gold section ids that exist in the split | 115 / 115 |
| Key quotes that are exact substrings | 57 / 57 |
| Spot check by the eval lane | 10 random items (7 answerable, 3 must-decline) read against their section text; all correct |
| Items in v2 | **73**: 59 answerable, 14 must-decline (19%); 5 marked for expert review |

## Configuration and provenance

| | |
|---|---|
| Sets | `heldout-v1.jsonl` (unchanged), `heldout-v2.jsonl` (new; sha256 in `heldout-v2/results.json`) |
| CLI | `main` at `8226c4eb3`, `cargo build --release` on the lab machine |
| Pack | as `../2026-11-27-model-on/` (sqlite sha256 `ab8ab619f3dfdee4…`) |
| Embedder | `ggml-org/embeddinggemma-2-GGUF` Q8_0, sha256 `2188ac1deca4b77d…`, `--embedder http://127.0.0.1:18096 --embedder-gguf <file>` |
| gpt-oss | `ggml-org/gpt-oss-20b-GGUF` MXFP4, llama-server (llama.cpp v1.1.0 CUDA build), 3 slots; the core sends `reasoning_budget_tokens: 0` and temperature 0.2 per request |
| Lab machine | NVIDIA DGX Spark (GB10, 128 GB unified memory, Linux aarch64) |
| Claude usage | Authoring v2 $2.23 (Opus). Review: 8 Sonnet calls (cost not recorded by the tool, under $1). Judging: $7.84 (v1 dense model off 5.58, v1 gpt-oss 0.11, v2 lexical 1.25, v2 dense 0.88, v2 gpt-oss 0.02). The v1 lexical reference and every answer identical to an earlier run came from the judge cache at no cost |

## Limits

- The gate setting was tuned on v1, so v1 numbers are optimistic by
  construction. v2 is the honest estimate, but it is small.
- gpt-oss ran at the client's temperature 0.2, so its runs are not exactly
  repeatable.
- Wall time per question (about 0.65 s with the model off) is mostly process
  start plus hashing the 300 MB embedder GGUF that `--embedder-gguf` names;
  the engine itself takes 18 ms.
- Still no answer cache in the pack (bake hit rate 0%); #2540 is open.
