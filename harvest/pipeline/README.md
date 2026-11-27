# harvest-pipeline

Any corpus in, a verified, signed SQLite knowledge pack out. The pack format is
[`harvest/CONTRACT.md`](../CONTRACT.md). Corpus-agnostic: nothing here knows about any
particular domain; a corpus is one YAML file plus optional task modules.

```
corpus.yaml ─ fetch ─▶ raw bytes (hashed, cached outside git) + <corpus>.sources.lock.json (committed)
            ─ parse ─▶ stage: source, section (exact text, stable citation ids), xref, equipment
            ─ enrich ▶ tasks → backends (through the committed JSONL response cache)
                       → deterministic verifiers → judge (different model) → provenance per item
            ─ build ─▶ <pack_id>-<version>.sqlite + manifest.json (ed25519-signed): pass rows only,
                       chunks + FTS5 + int8 embeddings
```

## Run it

```sh
cd harvest/pipeline
python3.12 -m venv ~/.cache/harvest/venv            # any venv outside the repo; never system pip
~/.cache/harvest/venv/bin/pip install -e '.[all]'
~/.cache/harvest/venv/bin/python -m pytest          # every test, no network, no model
```

| Command | What it does |
|---|---|
| `harvest-bake all CORPUS.yaml` | fetch + enrich + build in one go |
| `harvest-bake fetch CORPUS.yaml` | download, SHA-256, record edition; reports `new / unchanged / changed / edition-only` per source |
| `harvest-bake parse CORPUS.yaml` | deterministic parse; prints section and xref counts |
| `harvest-bake enrich CORPUS.yaml [--tasks facts] [--limit 20] [--keys ID,..] [--profile P] [--no-judge]` | run tasks; only cache misses call a model |
| `harvest-bake build CORPUS.yaml [--embedder embeddinggemma-2] [--all-verdicts]` | write the pack from raw sources + cache, no model calls |
| `harvest-bake review CORPUS.yaml --task facts --n 20 [--verdict fail]` | read the first N items with verdicts and notes |
| `harvest-bake stats CORPUS.yaml` | row counts, verdicts per task, tokens and cost from the cache |
| `harvest-bake diff OLD.sqlite NEW.sqlite [--json]` | sections added / removed / changed between editions |
| `harvest-bake verify PACK_DIR [--pubkey KEY.pub]` | file hashes and signature |
| `harvest-bake keygen KEY.pem` | new ed25519 key; keep it out of git |

Raw downloads, the stage, reports and packs live under `$HARVEST_HOME` (default
`~/.cache/harvest`). The committed artifacts are the corpus YAML, its sources lock and the
response cache.

## Corpus YAML

See the docstring of [`harvest_pipeline/corpus.py`](harvest_pipeline/corpus.py). A source has an
id, title, publisher, URL, license, parser and a fetch rule (`ecfr`, `http` or `file`). Profiles
pick the backends:

```yaml
profiles:
  frontier:
    author: {backend: claude-cli, model: sonnet}
    judge:  {backend: claude-cli, model: opus}
    cache_dir: cache/frontier
    concurrency: 6
  open-weight:
    author: {backend: openai-compatible, model: gpt-oss-120b, base_url: "http://HOST:PORT/v1"}
    judge:  {backend: claude-cli, model: opus}
    cache_dir: cache/open-weight
```

## Parsers

Deterministic only; none calls a model. `ecfr` (eCFR versioner XML): part, subpart, section,
paragraph `(a)(1)(i)(A)` and italic levels, inline heading chains, tables, notes, figures,
appendices; ids are citation paths (`29cfr1926.1408(a)(2)`, `29cfr1926.1408-table-A`); xrefs from
`§`, `paragraph (b)(3) of this section`, `Table A of this section`, ranges, and consensus standards
by number only (`asme:B30.5-2004`, never ingested). A row's `text` is its exact source text,
whitespace-normalized, including its descendants, so any quote inside a paragraph validates
against that paragraph and every ancestor.

## Backends

One interface (`backends/base.py`): `complete(Request) -> Response` with a JSON schema. The
`Runner` adds retries with backoff, schema validation, a concurrency cap, pacing, a usage guard
and token/cost accounting.

| backend | notes |
|---|---|
| `claude-cli` | headless `claude -p` from an empty directory, no settings/MCP/tools/session, `--json-schema`; stops the run above 60% seven-day usage (`max_week_pct`) |
| `anthropic` | official SDK, `output_config.format` JSON schema; needs a credential |
| `openai-compatible` | llama-server / vLLM; `mode: json_schema` (response_format) or `mode: tools` (forced function call) |
| `codex` | `codex exec --output-schema … -o …`, read-only sandbox |
| `deterministic` | the task's own `deterministic()` output, no model |

## Response cache

`<cache_dir>/<task>.jsonl` and `<task>.judge.jsonl`, keyed by
`(task, prompt_version, input_sha256, model)` where `input_sha256` hashes system prompt, schema
and rendered prompt, and `model` is the requested spec (`claude-cli:sonnet`). The exact model id
the backend reported is stored in the entry and becomes `provenance.model`. A re-bake calls models
only for changed inputs; `build` needs no model at all.

## Verification and verdicts

Per item: the task's deterministic verifiers (quote is an exact substring of the cited section
after whitespace normalization, cited section exists and is in the input, schema valid, numbers
and units of a fact appear in its quote, no consensus-standard content the source does not cite,
no invented numbers or quotes in prose), then the judge on items that passed. The judge must be a
different model from the author. `pass` ships; `fail` and `needs_review` stay in the stage for
`review` and `stats`. Every item gets a provenance row.

## How to add a task

A task is a class with five parts. Put it in a file next to the corpus YAML, list the file under
`task_modules:` and its name under `tasks:`. Working example:
[`tests/fixtures/regex_terms.py`](tests/fixtures/regex_terms.py); model-backed examples:
[`harvest_pipeline/tasks/builtin.py`](harvest_pipeline/tasks/builtin.py).

```python
from harvest_pipeline.tasks import Task, TaskInput, register_task, section_units
from harvest_pipeline.verify import check_quote

@register_task
class QuestionBank(Task):
    name = "question_bank"
    prompt_version = "1"                 # bump when the template or schema changes meaningfully
    after = ("facts",)                   # run after these tasks; read their passing rows
    system = "You write exam questions grounded only in the given facts ..."
    schema = {...}                       # strict JSON schema; output is {"items": [...]}
    judge_rubric = "Pass only if the keyed answer is the only correct choice ..."

    def select(self, stage):             # 1. inputs over stage rows
        for f in stage.rows("fact"):     #    only rows with a pass verdict
            yield TaskInput(key=f["fact_id"], material=..., data={"fact": dict(f)})

    def prompt(self, inp):               # 2. the template (material is hashed into the cache key)
        return "Write three questions ...\n\n" + inp.material

    def check(self, item, inp, stage):   # 3. deterministic verifiers -> list of problems
        return check_quote(item, stage, None)

    def rows(self, item, inp, stage):    # 4. table writer; the engine adds prov_id
        return {"question": [{"q_id": ..., "skill_id": ..., ...}]}
```

The engine supplies hashing, caching, backends, retries, the judge, provenance, verdicts and the
release filter. Helpers: `section_units(stage)` (sections as id-labelled lines, long ones split),
`stage.text(id)`, `stage.rows(table)`, `stage.descendants(id)`, and the verifiers in
`harvest_pipeline/verify.py`. Test a task with the `scripted` backend (see `tests/test_engine.py`).

## Embeddings

`embedder:` in the corpus YAML (or `build --embedder`): `hash` (no model; tests) or
`embeddinggemma-2` (the GGUF `ggml-org/embeddinggemma-2-GGUF` Q8_0 through `llama-server
--embedding`, the same model build the device runs for queries). Vectors are L2-normalized and
stored as int8 with one scale per vector (`float = int8 * scale`). `pack_meta` records
`embedder_id`, `embed_dim`, `embed_query_template` and `embed_doc_template`; queries must use the
same model, dimension and query template.

## Signing

`HARVEST_SIGNING_KEY` (base64 32-byte seed) or `HARVEST_SIGNING_KEY_FILE` (PEM). The signature
covers the canonical manifest without `signature`: `json.dumps(m, sort_keys=True,
separators=(",", ":"), ensure_ascii=False)` as UTF-8. `key_id` = first 16 hex of SHA-256 of the
raw public key. Without a key the manifest is written unsigned.
