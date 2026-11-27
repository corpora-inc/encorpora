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
| v2 retrieval R@5, lineage | 0.605 | 0.770 | 0.770 |

Every quote is verbatim and every citation exists in all six runs. Engine time
is 18 ms p50 with the model off and 4.2 s p50 with gpt-oss (lab machine, not a
device). Judge agreement with the Sonnet re-grade on v1: 0.84 exact, κ 0.76
(lexical); 0.90, κ 0.84 (both dense runs).

Item by item on answerable items, against the lexical reference (exact
two-sided sign tests; `report.md` counts all items, must-decline included):

| | v1 score better / worse | v1 fully correct gained / lost | v2 score better / worse | v2 fully correct gained / lost |
|---|---|---|---|---|
| Dense + gate, model off | 73 / 21 (p = 7e-8) | 50 / 14 (p = 7e-6) | 18 / 1 (p = 8e-5) | 7 / 1 (p = 0.07) |
| Dense + gate, gpt-oss | 78 / 20 (p = 3e-9) | 55 / 13 (p = 3e-7) | 18 / 1 (p = 8e-5) | 7 / 1 (p = 0.07) |

## Findings

1. **The core lane's estimate holds when judged.** On v1 the setting is 40.5%
   fully correct with the model off (estimate about 41.8%), and must-decline
   items are declined at exactly the estimated 74.5% (38 of 51).
2. **The gain carries over to items the gate never saw, on a small set.** On
   v2 it is +10.2 points (20.3% → 30.5%), against +12.3 on v1, and must-decline
   declines stay at 13 of 14. On v2's 59 answerable items the per-item score
   improves on 18 and worsens on 1 (p = 8e-5), but the fully-correct count moves
   only 7 to 1 (p = 0.07). The direction holds; v2 is too small to confirm the
   size. Its items also score lower than v1's overall, so compare within a set,
   not across.
3. **gpt-oss adds almost nothing on top.** On v1 it is 42.6% against 40.5%
   (8 items better and 1 worse, p = 0.039; fully correct 7 / 1, p = 0.07). On v2
   it ties the model-off engine on every item. Its text survives the strict check
   in only 22 of 342 v1 answers (6%) and 4 of 73 v2 answers. Earlier, with the
   server-side `--reasoning-budget 0`, it survived in 83 of 342. In a sample of
   fallbacks, the compose step returned an empty segment list or a bare cite,
   which the check rejects (a 3-question diagnostic with the request log, not
   committed). The small v1 gain comes from the answers it did compose: all 9 v1
   items where it scores differently from the model-off dense run are answers
   whose model text was kept, and most have the same retrieval.
4. **Grounding holds.** Unsupported-claim rates stay at 0–5% of claims. Dense
   answers carry more verbatim quotes (626 on v1, against 406 lexical), and the
   share of citations backing a text claim falls (v1 0.48 → 0.22; v2 0.57 →
   0.17). The added citations come with quotes, which are checked
   deterministically, rather than with prose claims.

## Preview: bake hit rate with #2540's answer cache

#2540 (question bank, answer cache pilot) is not merged yet. To get the bake hit
rate as soon as it exists, I built a pack from `main` `8226c4eb3` merged with the
#2540 head `12f438686` (git tree `477221faac12`, no conflicts) with the same
pipeline. That pack has 87 answers with 673 aliases, 1,004 questions, 10
procedures and 5,582 chunks. Measured with the model off, lexical retrieval and
the default cache threshold (0.75), with deterministic metrics only and no judge:

| | v1 (342) | v2 (73) |
|---|---|---|
| Bake hit rate | 0.9% (3) | 0% |
| Items with cache similarity ≥ 0.6 / ≥ 0.5 | 7 / 12 | 1 / 1 |

Two of the three hits cite the gold section. The third (crane-v1-0097, a level
indicator on a barge crane) cites the shift-inspection item instead of
§1926.1415(a)(1)(iii). A lower threshold would add few hits, so coverage, not
the threshold, keeps the rate down: 87 answers over five topics, against a set
that spans the corpus. The judged re-run follows the merge of #2540.

## The fresh set (heldout-v2)

Written with the v1 process and checks (`../../README.md`), after the gate was
tuned, by `tools/author.py --set v2 --avoid heldout-v1.jsonl`:

| Check | Result |
|---|---|
| Authored | 74 items in 7 batches (six section groups over §§1926.1400–1926.1442 and 1910.179, .180, .184, one must-decline batch; §1926.1443 and the Subpart CC appendices are not covered), `claude-opus-5-5`. Each batch was shown the v1 questions on its sections and told not to repeat them |
| Independent check (`claude-sonnet-5-5`, `tools/review.py`) | 74 keep, 0 flag, 0 drop; 6 gold answers corrected |
| Eval-lane fix (`tools/overrides-v2.json`) | 1: the check's correction to crane-v2-0031 named §1926.1421 for the signal-device rules, which are §1926.1420(a)–(c); gold answer and sections fixed (found by the adversarial review) |
| Near-duplicates dropped (against v1 and each other) | 1, a near-repeat of a v1 item. The most similar remaining question has token Jaccard 0.40 with a v1 question (the drop line is 0.60). One v2 item (crane-v2-0030, two wraps on the drum under §1926.1417) asks a fact two v1 items ask under §1910.179; the avoid list only showed each batch the v1 questions on its own sections |
| Gold section ids that exist in the split | 118 / 118 |
| Key quotes that are exact substrings | 57 / 57 |
| Spot check | 10 random items by the eval lane (7 answerable, 3 must-decline) and 9 more by the adversarial review, read against the section text: one wrong (crane-v2-0031, fixed above); every must-decline item checked as not answerable from the sources |
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
| Claude usage | Authoring v2 $2.22 (Opus, per-batch costs in `authoring/verify-log-v2.json`). Review: 8 Sonnet calls (cost not recorded by the tool, under $1). Judging: $7.85, from the per-run results before the combined pass (v1 dense model off 5.58, v1 gpt-oss 0.11, v2 lexical 1.25, v2 dense 0.88, v2 gpt-oss 0.02, re-judging crane-v2-0031 0.01); the combined passes read everything from the judge cache. The v1 lexical reference and every answer identical to an earlier run came from the judge cache at no cost |

## Limits

- The gate setting was tuned on v1, so v1 numbers are optimistic by
  construction. v2 is the honest estimate, but it is small.
- gpt-oss ran at the client's temperature 0.2, so its runs are not exactly
  repeatable.
- Wall time per question (about 0.65 s with the model off) is mostly process
  start plus hashing the 300 MB embedder GGUF that `--embedder-gguf` names;
  the engine itself takes 18 ms.
- Still no answer cache in the pack (bake hit rate 0%); #2540 is open.
