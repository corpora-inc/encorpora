# Answer cache, 2026-11-27

The first pack with the content lane's answer cache (#2540: 87 baked answers
with 586 aliases, 1,004 questions, 10 procedures), judged on held-out v1 and the
fresh v2 with the same three systems as `../2026-11-27-dense-gate/`:

| System | What it is |
|---|---|
| `harvest-model-off` | lexical retrieval, default gate |
| `harvest-model-off-dense-gate` | EmbeddingGemma 2 dense retrieval, `--dense-gate 0.2:0.77`, model off |
| `harvest-gpt-oss-20b-dense-gate` | the same with gpt-oss 20B |

Pack built from `main` at `2392575b2` with the pipeline at that commit.
`harvest/core` and `harvest/pipeline` are unchanged since `8226c4eb3`, so the
only difference from the dense-gate run is the pack content.

## Headline

Fully correct = share of answerable items the judge scored 2; 95% bootstrap
interval in parentheses.

| | Lexical | Dense + gate, model off | Dense + gate, gpt-oss 20B |
|---|---|---|---|
| **Bake hit rate, v1 / v2** | **0.9% (3) / 0%** | 0.9% / 0% | 0.9% / 0% |
| **v1 fully correct (291)** | 27.8% (22.7–33.3) | **43.6%** (37.8–49.5) | **46.7%** (40.9–52.2) |
| v1 must-decline declined (51) | 76.5% | 74.5% | 74.5% |
| v1 answerable declined | 33.3% | 19.6% | 19.6% |
| v1 unsupported-claim rate | 3.0% | 3.2% | 3.5% |
| v1 retrieval R@5, lineage | 0.630 | 0.750 | 0.760 |
| **v2 fully correct (59)** | 18.6% (10.2–28.8) | **37.3%** (25.4–49.2) | **40.7%** (28.8–54.2) |
| v2 must-decline declined (14) | 100% | 92.9% | 92.9% |
| v2 answerable declined | 42.4% | 20.3% | 20.3% |
| v2 unsupported-claim rate | 1.8% | 0.0% | 0.0% |
| v2 retrieval R@5, lineage | 0.588 | 0.761 | 0.761 |

Every quote is verbatim and every citation exists in all six runs. Engine time:
4 ms (lexical), 19 ms (dense), 4.6 s (gpt-oss), on the lab machine.

On the previous pack (`../2026-11-27-dense-gate/`), dense + gate was 40.5% (v1)
and 30.5% (v2) with the model off, and 42.6% / 30.5% with gpt-oss.

Item by item on answerable items (exact two-sided sign tests):

| | v1 score better / worse | v1 fully correct gained / lost | v2 score better / worse | v2 fully correct gained / lost |
|---|---|---|---|---|
| Lexical → dense + gate, model off | 82 / 17 (p = 2e-11) | 57 / 11 (p = 1e-8) | 24 / 0 (p = 1e-7) | 11 / 0 (p = 0.001) |
| Lexical → dense + gate, gpt-oss | 88 / 14 (p = 3e-14) | 63 / 8 (p = 1e-11) | 27 / 1 (p = 2e-7) | 14 / 1 (p = 0.001) |
| Dense model off → dense gpt-oss | 11 / 2 (p = 0.022) | 11 / 2 (p = 0.022) | 3 / 1 (p = 0.62) | 3 / 1 (p = 0.62) |
| Previous pack → this pack, dense model off | 20 / 7 (p = 0.019) | 14 / 5 (p = 0.064) | 7 / 1 (p = 0.07) | 5 / 1 (p = 0.22) |
| Previous pack → this pack, dense gpt-oss | 27 / 12 (p = 0.024) | 21 / 9 (p = 0.043) | 10 / 2 (p = 0.039) | 8 / 2 (p = 0.11) |

## Findings

1. **The bake hit rate is 0.9% on v1 and 0% on v2, and the cache is right on
   one of its three hits.** All three v1 hits score exactly at the 0.75
   threshold. crane-v1-0048 (how long the utility has to give the voltage) is
   correct. crane-v1-0097 (does a barge crane need a level indicator: no, it is
   exempt) got the shift-inspection answer on when to check level.
   crane-v1-0129 (the order of voice-signal parts, and whether a substitute
   signal person means meeting again) got the answer on who must meet. Both are
   the wrong question, scored 0. Only 7 v1 items reach a cache similarity of 0.6
   and 12 reach 0.5, so lowering the threshold would add few hits and more
   wrong ones. With 87 answers over five topics, coverage is the limit. Hits at
   the threshold need an intent check before the cache is trusted.
2. **The content helps through retrieval, not the cache.** With the model off
   and the dense gate, v1 goes from 40.5% to 43.6% and v2 from 30.5% to 37.3%.
   Of the 14 v1 items newly fully correct, 13 are composed answers (10 of them
   with a baked-answer or procedure chunk in the top 5 retrieved) and one is the
   correct cache hit.
3. **Dense + gate is now clearly better than lexical on the fresh set:** v2 24
   items better and 0 worse, fully correct 11 gained and 0 lost (p = 0.001). The
   dense-gate run on the previous pack could not show this (7 / 1, p = 0.07).
   Must-decline declines hold at 13 of 14 on v2 and 38 of 51 on v1.
4. **gpt-oss now adds a little.** On v1 it is 46.7% against 43.6% (11 better, 2
   worse, p = 0.022). Its text survives the check in 40 of 342 answers (22 on
   the previous pack). On v2 the difference is 3 / 1 and not significant. It
   runs at the client's temperature 0.2, so its runs are not exactly repeatable.
5. **The lexical engine moved slightly down** (v1 28.2% → 27.8%, v2 20.3% →
   18.6%): the added chunks crowd its top results (R@5 0.637 → 0.630). It
   remains the reference, not a candidate.

## Configuration and provenance

| | |
|---|---|
| Sets | `heldout-v1.jsonl`, `heldout-v2.jsonl` (with the crane-v2-0031 fix from #2560) |
| Code | `main` at `2392575b2`, exported with `git archive`; CLI built on the lab machine; pack built with `../2026-11-27-baseline/lab/build_pack.sh` |
| Pack | `crane-us` 2026.11.27-1, sqlite sha256 `3773c0757835fb0c…`, manifest sha256 `b40cf4089e362bd6…`, signed with a throwaway lab key made for this run (not a release key) |
| Pack contents | 2,258 sections, 287 terms, 2,467 facts, 137 explanations, 165 applicability rows, 1,004 questions, 87 answers with 673 alias rows (586 aliases plus each answer's canonical question), 10 procedures, 5,582 chunks with int8 EmbeddingGemma 2 vectors |
| Import verdicts (pipeline) | questions 1,002 pass / 2 fail; answers 87 / 0; procedures 10 / 0 |
| Servers | `../2026-11-27-dense-gate/lab/serve_pair.sh`: EmbeddingGemma 2 Q8_0 and gpt-oss 20B MXFP4 under llama-server (llama.cpp v1.1.0 CUDA), one guarded GPU job on the lab machine (NVIDIA DGX Spark) |
| Claude usage | Judging $6.60 (v1: lexical 2.71, dense 2.66, gpt-oss 0.24; v2: 0.48, 0.44, 0.07), from the per-run results before the combined pass. Every answer identical to an earlier run came from the judge cache |

## Limits

- v1 tuned the dense gate, so v1 dense numbers are optimistic. v2 is small
  (intervals about ±12 points).
- The cache threshold (0.75) was not tuned here. The two wrong hits suggest
  that tuning it on v1 alone would overfit; it needs more answers and an
  intent check.
- Wall time per question includes process start and hashing the embedder GGUF
  (about 0.65 s); the engine times above exclude it.
