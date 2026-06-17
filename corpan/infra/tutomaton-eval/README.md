# tutomaton-eval — qwen3-4B parameter bake-off

Decides, with evidence, **which languages Tutomaton can honestly claim to
support** on the shipped on-device model, and **what parameters** to ship.

## What it measures

The pack runs **Qwen3-4B (Q4_K_M GGUF)** via `tauri-plugin-corpan-llm`
(llama.cpp). This harness reproduces that runtime **faithfully** and scores tutor
replies:

- **Faithful inference.** We drive `llama-server`'s **raw `/completion`** (not
  `/v1/chat/completions`) with our own ChatML string, because the plugin
  hand-rolls ChatML and does *not* apply the GGUF chat template (`state.rs`
  `format_chatml`). The sampler chain is reproduced in the plugin's exact order
  — `penalties(last_n=64) → top_k → top_p → min_p → temp → dist`
  (`server.py:SAMPLER_ORDER`). Qwen3 has `add_bos_token=false`, so tokens match.
- **Scored on the scrubbed reply** — what the user actually sees, after the
  `textScrub.ts` passes (ported in `metrics.py`, incl. the orphaned-combining-
  mark "dotted-circle" strip).
- **Gross-failure metrics (programmatic, reproducible):** Unicode **script
  coverage**, **fasttext lid.176** language-ID (same-script disambiguation),
  Latin-leak, repetition-loop, refusal, template-leak, length floor → a per-reply
  **pass**. A config's score is the **pass-rate** over battery × seeds with a
  Wilson 95% CI.
- **Fluency (Claude judge):** finalists' sample replies (`*.json` `samples`) are
  handed to a Claude judge for grammar/naturalness — the part heuristics can't see.

## Setup

Assumes `llama-server` (Homebrew `llama.cpp`) and the GGUF are present:
`~/Library/Application Support/com.corpora.corpan/corpan-packs/llm-base-qwen3-4b-v1/model/base.gguf`

```bash
infra/tutomaton-eval/setup.sh        # venv + fasttext + lid.176.ftz
source infra/tutomaton-eval/.venv/bin/activate
python3 test_harness.py              # logic self-test (no model)
```

## Run

```bash
# 1. Triage all 55 langs (default + conservative configs) → classify
python3 run.py triage
# (or a subset)            python3 run.py triage te ta hi en es

# 2. Rigorously tune EN → new global defaults
python3 run.py tune en

# 3. Rescue borderline langs from the EN-optimal start (+ target prompt variant
#    in results/prompts_<code>.txt if present)
python3 run.py rescue te ur --start "$(python3 -c 'import json;print(json.dumps(__import__("json").load(open("results/tune-en.json"))["best_params"]))')"

# 4. Build the owner-facing report + machine-readable recommendations
python3 report.py
```

Everything streams to `results/rows.jsonl` and is **resumable** — re-running
skips cached generations. Long runs: launch in the background.

## Outputs (`results/`)

- `rows.jsonl` — every generation + its metrics (audit trail; git-ignored).
- `triage.json`, `tune-en.json`, `rescue-<code>.json` — per-stage summaries.
- `REPORT.md` — per-language verdict, baseline vs best, best params.
- `recommendations.json` — `{global_defaults, keep, drop, overrides}` → drives
  the edits to `packs/tutomaton/`.

## Caveats

Results are specific to **this GGUF + this llama.cpp build + Metal on this Mac**;
the report records versions. The strict support bar is ≥90% per-reply pass on the
held-out battery **and** a passing Claude fluency judgement.
