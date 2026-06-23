# Corpan City — NPC Prompt Study harness

A re-runnable, data-driven A/B/n evaluation of NPC system-prompt constructions
for the Corpan City pack. It composes prompts with the **real** prompt machinery
(`src/npc/promptProgram.ts`), drives the **shipped** on-device model (Qwen3-4B
GGUF) through multi-turn conversations reproducing the on-device inference path,
and scores each conversation on a rubric whose centrepiece is **quantified
repetition** — the screenshot pathology (a verbatim segue invite every turn + a
fixated NPC re-explaining one word). It finds the prompt construction that
maximizes a **Delight** score balanced between creativity and cohesion.

Read `../../docs/NPC_PROMPT_STUDY.md` for methodology, results, and the ranked
prompt-change recommendations.

## Pipeline

```
compose.ts ──esbuild──► out/compose.mjs ──node──► out/cells.json
   (REAL composeSystemPrompt × the variant grid + player scripts)
                                  │
                                  ▼
run_model.py  ── shipped Qwen3-4B via llama-server ──► out/transcripts.jsonl
   (faithful ChatML + on-device sampler; multi-turn; <<tool>>/​<think> split)
                                  │
                                  ▼
judge.py  ── programmatic metrics (+ optional strong LLM judge) ──► out/scores.jsonl
                                  │
                                  ▼
stats.py  ── means+bootstrap CIs, Welch t/Cohen's d, Pareto ──► out/summary.json + report.txt
```

## Run it

```bash
cd eval/npc-prompts
./run.sh                                 # balanced subset, 4 reps, programmatic judge
REPS=5 MAX_PER_VARIANT=30 ./run.sh       # bigger samples
FULL=1 ./run.sh                          # every cell in the matrix (slow)
LLM_JUDGE=openai LLM_SAMPLE=120 ./run.sh # add a strong LLM judge (needs OPENAI_API_KEY)
LLM_JUDGE=anthropic ./run.sh             # or Claude (needs ANTHROPIC_API_KEY)
```

`run.sh` auto-starts `llama-server` against the shipped GGUF at
`~/Library/Application Support/com.corpora.corpan/corpan-packs/llm-base-qwen3-4b-v1/model/base.gguf`
if one isn't already listening on `:8099`. Override with `MODEL=…` / `SERVER=…`.

## Faithfulness to the device

Verified against `plugins/tauri-plugin-corpan-llm/src/state.rs`:

| Aspect | Device | Harness |
|---|---|---|
| Prompt format | hand-built ChatML (`format_chatml`), no jinja | identical, via `/completion` raw prompt |
| BOS | `AddBos::Always` | llama-server adds BOS to `/completion` |
| Sampler | `penalties(last_n=64,rp) → top_k(40) → top_p(0.9,1) → temp → dist(seed)` | same knobs to `/completion` |
| Context | `n_ctx=4096` | `-c 4096` |
| Runtime call | `temp 0.6, topP 0.9, repeatPenalty 1.15, maxTokens 400` | matched (temp swept in the matrix) |
| History window | last `HISTORY_WINDOW*2 = 16` msgs after system | mirrored |
| `<<tool>>` split | `splitToolBlock` | ported |
| `<think>` | streamed by plugin; pack renders prose | stripped for scoring, leakage flagged |

The model is the **exact shipped GGUF**, so generation is on-distribution, not a
stand-in. (If the GGUF is ever absent, point `MODEL=` at any Qwen3-4B GGUF; label
the run accordingly.)

## What the judge measures (programmatic, no API)

- **rep_max / rep_mean / rep_consec_mean** — pairwise similarity across the NPC's
  turns (hybrid token-Jaccard + char-3gram cosine + edit-ratio). Verbatim repeat
  ≈ 1.0; paraphrase/fixation lights up content overlap.
- **exact_repeat_rate** — turns that exactly match an earlier turn.
- **segue_repeat_rate** — invite/segue phrase re-emitted on >1 turn (pathology #1).
- **fixation** — max share of one content lemma across turns (the "ferry×3" tell).
- **diversity** — distinct content words / total (creativity proxy).
- **brevity_ok / lang_ok / native_leak_mean** — ≤2 sentences; target-language
  discipline (parenthetical gloss allowed).
- **nondegen / empty_rate** — coherence floor (nonsense guard).
- **Delight** — weighted blend that penalizes BOTH repetition and incoherence so
  the optimum is a creativity×cohesion sweet spot (see `judge.py :: W`).

The optional strong LLM judge adds 1-5 rubric scores per conversation for
triangulation; it is skipped cleanly (clearly labeled) when no API key is set.

## The variant grid (independent variables)

`baseline` (shipping) · `segue-once` · `anti-repeat-2` · `segue-once+anti-repeat`
· `rail-no-repeat` · `mood-strong` · `rag` · `rag+segue-once+anti-repeat` ·
`persona-rich`, each crossed with **temperature** {0.3, 0.6, 0.9}, **context**
{generic-challenge, special-needs-item, immersion}, **persona** (6 archetype×demeanor),
and **player script** {probe-loop (screenshot repro), progressive, terse}.

Variants map 1:1 to applicable prompt changes; the recommendations in the study
doc are exactly these knobs.

## Files

- `compose.ts` — matrix + variants, imports the real composer. **Edit here to add
  a variant or persona.**
- `run_model.py` — device-faithful multi-turn runner.
- `judge.py` — programmatic + optional LLM rubric judge.
- `stats.py` — aggregation, CIs, significance, Pareto.
- `run.sh` — orchestrator.
- `out/` — all artifacts (gitignored).
