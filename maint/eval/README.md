# maint/eval

Measures the on-device model's three narrow jobs in the offline maintenance assistant, against the
real engine over HTTP (`harvest serve`), with held-out sets kept outside the repository.

- **T1, symptom mapping.** The engine's `symptom.search` ranks the pack's symptom index; the model
  picks a candidate, says none fits, or asks one clarifying question between two or three candidates.
- **T2, close-out structuring.** The technician's note plus the job's own context (steps, the
  manual's causes, actions and parts) in; the lesson record's fields out.
- **T3, a question at a step.** The model selects the manual's sentences (by handle) that answer the
  question, with one heading from a closed list, or declines.

Every model output is schema-constrained (llama-server `json_schema`, Claude `--json-schema`).
Nothing here is specific to one pack.

## Setup

```sh
VENV=<a directory outside the repository>
python3.12 -m venv "$VENV"
"$VENV/bin/pip" install pyyaml
# put harvest/eval and maint/eval on the path (the harness reuses harvest_eval's Claude flags and metrics)
echo "$PWD/harvest/eval" > "$VENV"/lib/python3.12/site-packages/harvest_eval_src.pth
echo "$PWD/maint/eval"   > "$VENV"/lib/python3.12/site-packages/maint_eval_src.pth
export MAINT_EVAL_STATE=<outside the repo>    # response cache, ledger, runs, pinned pack snapshots
export MAINT_EVAL_HELDOUT=<outside the repo>  # item files; never in the repository
```

Engine: build `harvest` from the integration branch, copy the binary out of the shared target dir,
pin a snapshot of the packs (`MAINT_EVAL_LIVE_PACKS=<packs root> python -c 'from maint_eval import
packs; packs.snapshot()'`), then serve it twice: with the pack's embedder (dense) and with
`--embedder none` (lexical-only). Both are real device configurations; `--dense on|off` makes a run
refuse to start if the engine's `pack.list` reports otherwise.

Lab models: `lab.sh` and `lab-serve.sh` serve one GGUF at a time on a GPU machine through its shared
job runner; every host, port and directory comes from the `MAINT_LAB_*` variables listed in `lab.sh`.

## Commands (`python -m maint_eval ...`)

| command | what it does |
|---|---|
| `gen-t1`, `gen-t2`, `gen-t3` | write items with Opus from the pack's own text (T1 from each symptom's source row only, never its baked synonyms); T2 and T3 from jobs driven through the engine API |
| `review <task>` | a second model (Sonnet, different prompt) checks a sample of the gold; T1 blind. Flagged items are then read by hand and kept, fixed or dropped in `<task>-review-v1.jsonl` |
| `split <task>` | one seeded split (seed 20261128) into dev and held-out; T1 grouped by symptom, T2/T3 by tree |
| `overlap` | lexical overlap between T1 phrasings and the pack's baked synonyms (leakage) |
| `run <task> --part dev|heldout --system engine|local:<model>|claude:sonnet` | one configuration; `--k`, `--variant`, `--think`, `--temp`, `--seed`, `--ranking '<json>'`, `--rank <spec>` (offline re-rank emulation) |
| `ledger` | every model call made, tokens, seconds, Claude cost at list price |

`maint_eval.plan` serves one lab model at a time through `lab.sh` (the lab machine's shared job
runner, with its workload lock and heat guard) and runs a list of configurations. `maint_eval.analysis` holds the
auto-route calibration, the ranking study and the end-to-end T1 outcome (right entry in one step,
wrong entry, clarifying question, list). `maint_eval.alone` is the no-engine Claude baseline and its
judge.

## Hygiene

- Held-out files live in `$MAINT_EVAL_HELDOUT`; `heldout-manifest.json` records their SHA-256 and counts.
- Prompt, k and interface choices are made on dev (dev plus the dev-symptom calibration set for T1);
  held-out is read once per final configuration.
- Every result records the engine URL, the dense state and the pack versions it ran on.
- Every model call is cached by input hash and ledgered; a token cap stops Claude spend.

## Tests

```sh
PYTHONPATH=harvest/eval:maint/eval python3 -m unittest discover -s maint/eval/tests -v   # no model calls; CI runs this
```
