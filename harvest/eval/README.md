# harvest/eval

Measures a harvest pack the way the app uses it: every question goes through
`harvest ask --json` (the core CLI in `../CONTRACT.md`), and the same questions
go to general-purpose models with no retrieval as baselines. Corpus-agnostic:
the set, the reference text and the baseline prompt come from a config next to
the corpus (for the crane pack: `crane/eval/eval.yaml`).

## Run

Python 3.11+, standard library only (PyYAML only if the config is `.yaml`).

```sh
cd harvest/eval
python3 -m venv .venv && .venv/bin/pip install pyyaml      # once; never system pip
.venv/bin/python -m harvest_eval run --config ../../crane/eval/eval.yaml \
    --pack <pack dir or .sqlite> --binary <path to harvest> --out <dir>
```

Options: `--set <jsonl>` overrides the config's set, `--llm <endpoint|off>` the
core's model, `--backends a b` runs a subset, `--limit N` / `--only id…` a
slice, `--no-judge` only the deterministic metrics. Runs resume: responses
already in `<out>/responses/*.jsonl` are reused, and judge calls are cached by
input hash, so a re-run after a crash, or with one more backend, pays only for
what is new.

Compare two finished runs (two packs, or a frontier bake against an
open-weight bake) item by item:

```sh
.venv/bin/python -m harvest_eval compare runA[:backend] runB[:backend] --out <dir>
```

Check that a pack carries every gold section id and key quote of a set:

```sh
.venv/bin/python -m harvest_eval check-ids --set <jsonl> --pack <pack or sections.jsonl>
```

## Tests

```sh
cd harvest/eval && python3 -m unittest discover -s tests -v
```

Offline: a toy pack built in the test, `tests/stub_harvest.py` standing in for
`harvest ask --json`, `tests/stub_claude.py` for the judge and the Claude
baseline, and a local HTTP server for the OpenAI-compatible baseline.

## Backends

| kind | what it runs |
|---|---|
| `harvest` | `<binary> ask <pack> "<q>" --json [--llm X] [--role R] [--equip E]`. `pass_equip: true` sends the item's equipment (mapped through `equip_map`). |
| `openai` | any OpenAI-compatible `/v1/chat/completions` endpoint (llama.cpp server, vLLM, Ollama), temperature 0, no retrieval. |
| `claude` | headless `claude -p` with no tools, no settings, no MCP, from an empty directory; no retrieval. |

Baselines get one system prompt (from the config) that names the sources and
asks them to cite and to decline what the sources do not cover, the same
instruction the core works under. Their citations are parsed from the prose.

## Outputs

`<out>/report.md` (tables and definitions), `<out>/results.json` (every
aggregate, run metadata: set hash, pack hash and version, models, host,
judge calls), `<out>/items.csv` (one row per item and backend, with the
answer, citations, retrieved sections and the judge's reason).

## What each number means

- **Retrieval precision/recall@k** (k = 1, 3, 5, 10), harvest backends, answerable
  items. The ranked list is the distinct sections behind `retrieved` chunks
  (a chunk whose `ref_kind` is a fact, answer, question, term, diagram or
  procedure step maps to that row's sections). Matching levels:
  `strict` (retrieved is the gold paragraph or inside it), `lineage` (one
  contains the other; the headline), `section` (same base section). P@k
  divides by k.
- **Citation precision**: two numbers. *Matches gold*: cited sections on a
  gold section's lineage over all citations (a lower bound, since a correct
  extra citation counts against it). *Supports a claim*: citations the support
  judge used for at least one claim.
- **Unsupported-claim rate**: each sentence of an answer's text is a claim. The
  support judge sees only the claims and the text of the sections the answer
  cited, never the gold answer. Unsupported over supported + unsupported. A
  claim with nothing cited is unsupported. Quote segments are checked
  deterministically: exact substring of the pack's section text after
  whitespace normalization (CONTRACT), a child paragraph's text counting for
  its parent.
- **Decline precision/recall**: positive class = `must_decline` items. Harvest
  declines when `mode = declined`; a baseline declines when the correctness
  judge says so.
- **Answer correctness**: the correctness judge (Opus by default) grades each
  answer 0/1/2 against the gold answer with the rubric in `judge.py`. A
  declined answerable item scores 0; an error scores 0. Reported as fully
  correct (score 2), mean score, and a 95% bootstrap interval.
- **Judge agreement**: a seeded sample (15% by default) is re-graded by a
  second model (Sonnet) with the same rubric; exact agreement, within-one and
  Cohen's κ, with the disagreeing item ids.
- **Bake hit rate**: share of answers with `mode = baked`.
- **Latency p50/p95**: the core's own `elapsed_ms`, and wall time including
  process start.
- **Item-by-item comparison**: wins/losses/ties on the 0–2 score with an exact
  sign test, and fully-correct disagreements with McNemar's exact test.

## Config

```yaml
set: heldout-v1.jsonl                 # paths are relative to the config file
reference_sections: sections.jsonl    # text for baselines' citations (JSON lines: section_id, parent_id, text)
match:
  aliases:                            # map a pack's id spelling onto the set's
    - {pattern: "-appendix-([A-Z])", replace: "-app\\1"}
backends:
  - {name: harvest, kind: harvest, binary: harvest, pack: path/to/pack, llm: "off", role: operator}
  - {name: open-alone, kind: openai, endpoint: "http://host:8080/v1", model: "<id>", system_prompt: "…"}
  - {name: frontier-alone, kind: claude, model: sonnet, system_prompt: "…"}
compare: [[harvest, open-alone], [harvest, frontier-alone]]
judge: {model: opus, agreement_model: sonnet, agreement_sample: 0.15, cache: .judge-cache, per_call: 6, jobs: 3}
```

At most three judge or Claude calls run at once. A harvest backend runs one
question at a time unless `jobs` says otherwise.
