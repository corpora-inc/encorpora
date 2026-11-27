# Harvest contract

Harvest turns a corpus into a verified knowledge pack (one SQLite file) and
answers from it on the device. This file is the interface between its parts:
the ingest pipeline writes packs, the core reads them, apps and the evaluation
harness call the core. Change it only together with every reader and writer.

Method: enumerate the content, generate it once with strong models grounded in
the sources, verify every row, ship static data. A small on-device model is only
the conversation layer, and every product feature works with it off.

## Layout

| Path | Language | What it is |
|---|---|---|
| `harvest/pipeline/` | Python 3.12+ | Ingest: source registry, fetch, parse, enrich (pluggable model backends), verify, write pack, edition diff. CLI `harvest-bake`. |
| `harvest/core/` | Rust crate `harvest-core` + bin `harvest` | Pack open and signature check, hybrid retrieval, answer engine, support checker, decline, audit log, record store, sync queue. |
| `harvest/practice/` | TypeScript, no runtime deps | Practice and assessment: item selection, spaced review, evidence model per skill, exam simulator scoring. |
| `crane/content/` | YAML/Markdown + Python tasks | Crane corpus registry, topic and skill blueprint, procedure specs, task prompts. |
| `crane/app/` | Tauri 2 + React | The crane app (iOS, Android, macOS, Windows). |
| `crane/eval/` | data + config | Held-out evaluation set for the crane pack. |

Everything under `harvest/` is corpus-agnostic. Nothing crane-specific goes there.

## Pack file

One SQLite database, `<pack_id>-<version>.sqlite`, plus `manifest.json`:

```json
{ "pack_id": "crane-us", "version": "2026.11.27-1", "schema_version": 1,
  "files": [{ "path": "crane-us.sqlite", "sha256": "…", "bytes": 0 }],
  "signature": { "alg": "ed25519", "key_id": "…", "sig": "<base64 over canonical manifest without signature>" } }
```

The core refuses a pack whose signature or file hash fails. Delta packs carry
`"base_version"` and a list of row upserts/deletes per table.

## Schema v1

Every generated row has `prov_id`. Every text row has `lang` (BCP 47, `en` for v1).
Section ids are stable citation paths so a re-bake keeps references valid.

```sql
CREATE TABLE pack_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
-- pack_id, version, schema_version, built_at, corpus_id, embedder_id, embed_dim,
-- bake_backends (json), source_count, row_counts (json)

CREATE TABLE source (               -- source registry
  source_id   TEXT PRIMARY KEY,     -- 'ecfr-29-1926-cc'
  title       TEXT NOT NULL,
  publisher   TEXT NOT NULL,
  url         TEXT NOT NULL,
  edition     TEXT NOT NULL,        -- edition / amendment / "up to date as of" date
  retrieved_at TEXT NOT NULL,
  sha256      TEXT NOT NULL,        -- of the retrieved bytes
  media_type  TEXT NOT NULL,
  license     TEXT NOT NULL         -- 'public-domain-us-gov', …
);

CREATE TABLE section (
  section_id  TEXT PRIMARY KEY,     -- '29cfr1926.1408(a)(2)'
  source_id   TEXT NOT NULL REFERENCES source,
  parent_id   TEXT REFERENCES section,
  ord         INTEGER NOT NULL,     -- document order
  depth       INTEGER NOT NULL,
  kind        TEXT NOT NULL,        -- part|subpart|section|paragraph|table|figure|appendix|note
  citation    TEXT NOT NULL,        -- display: '§1926.1408(a)(2)'
  heading     TEXT,
  text        TEXT NOT NULL,        -- exact source text, whitespace-normalized only
  text_sha256 TEXT NOT NULL,
  lang        TEXT NOT NULL
);
CREATE TABLE xref (from_id TEXT NOT NULL, to_id TEXT NOT NULL, kind TEXT NOT NULL,
                   PRIMARY KEY (from_id, to_id, kind));

CREATE TABLE equipment (            -- variant awareness
  equip_id TEXT PRIMARY KEY, parent_id TEXT, name TEXT NOT NULL, aliases TEXT NOT NULL -- json array
);
CREATE TABLE applies_to (ref_kind TEXT NOT NULL, ref_id TEXT NOT NULL, equip_id TEXT NOT NULL,
                         PRIMARY KEY (ref_kind, ref_id, equip_id));

CREATE TABLE term (term_id TEXT PRIMARY KEY, term TEXT NOT NULL, definition TEXT NOT NULL,
                   section_id TEXT NOT NULL, quote TEXT, lang TEXT NOT NULL, prov_id TEXT NOT NULL);

CREATE TABLE fact (                 -- limits, clearances, capacities, intervals, duties
  fact_id TEXT PRIMARY KEY, section_id TEXT NOT NULL,
  kind TEXT NOT NULL,               -- limit|clearance|interval|capacity|requirement|prohibition|definition
  statement TEXT NOT NULL,          -- plain language
  quote TEXT NOT NULL,              -- verbatim substring of section.text
  value TEXT, unit TEXT, lang TEXT NOT NULL, prov_id TEXT NOT NULL
);

CREATE TABLE explanation (section_id TEXT NOT NULL, level TEXT NOT NULL, -- trainee|operator|inspector
  body TEXT NOT NULL, lang TEXT NOT NULL, prov_id TEXT NOT NULL, PRIMARY KEY (section_id, level, lang));

CREATE TABLE topic (topic_id TEXT PRIMARY KEY, parent_id TEXT, ord INTEGER NOT NULL,
                    title TEXT NOT NULL, summary TEXT NOT NULL, lang TEXT NOT NULL);
CREATE TABLE skill (skill_id TEXT PRIMARY KEY, topic_id TEXT NOT NULL, title TEXT NOT NULL,
                    lang TEXT NOT NULL);
CREATE TABLE lesson (lesson_id TEXT PRIMARY KEY, topic_id TEXT NOT NULL, ord INTEGER NOT NULL,
  title TEXT NOT NULL, body TEXT NOT NULL,          -- answer-segment JSON (below)
  lang TEXT NOT NULL, prov_id TEXT NOT NULL);
CREATE TABLE diagram (diagram_id TEXT PRIMARY KEY, svg TEXT NOT NULL, caption TEXT NOT NULL,
  alt TEXT NOT NULL, section_ids TEXT NOT NULL, lang TEXT NOT NULL, prov_id TEXT NOT NULL);

CREATE TABLE question (
  q_id TEXT PRIMARY KEY, skill_id TEXT NOT NULL, variant_of TEXT,
  kind TEXT NOT NULL,               -- mc|free_text|numeric
  stem TEXT NOT NULL,
  choices TEXT,                     -- json array of strings (mc)
  answer TEXT NOT NULL,             -- mc: index as text; numeric: value; free_text: rubric json
  rationales TEXT,                  -- json array, one per choice: why right / why wrong
  section_ids TEXT NOT NULL,        -- json array
  difficulty REAL NOT NULL,         -- 0..1 prior
  lang TEXT NOT NULL, prov_id TEXT NOT NULL
);

CREATE TABLE answer (               -- the answer cache
  answer_id TEXT PRIMARY KEY, question TEXT NOT NULL,
  body TEXT NOT NULL,               -- answer-segment JSON
  section_ids TEXT NOT NULL, level TEXT, lang TEXT NOT NULL, prov_id TEXT NOT NULL
);
CREATE TABLE answer_alias (alias TEXT NOT NULL, answer_id TEXT NOT NULL, lang TEXT NOT NULL,
                           PRIMARY KEY (alias, answer_id));

CREATE TABLE procedure (proc_id TEXT PRIMARY KEY, title TEXT NOT NULL, kind TEXT NOT NULL,
  summary TEXT NOT NULL, roles TEXT NOT NULL, lang TEXT NOT NULL, prov_id TEXT NOT NULL);
CREATE TABLE proc_step (proc_id TEXT NOT NULL, ord INTEGER NOT NULL,
  text TEXT NOT NULL, detail TEXT NOT NULL,        -- json {trainee, operator, inspector}
  check_kind TEXT NOT NULL,                        -- pass_fail|value|note|photo
  section_ids TEXT NOT NULL,
  deficiency TEXT,                                 -- json {guidance, action, section_id, quote}
  lang TEXT NOT NULL, prov_id TEXT NOT NULL, PRIMARY KEY (proc_id, ord));

CREATE TABLE chunk (chunk_id TEXT PRIMARY KEY, ref_kind TEXT NOT NULL, ref_id TEXT NOT NULL,
                    text TEXT NOT NULL, lang TEXT NOT NULL);  -- retrieval units
CREATE VIRTUAL TABLE chunk_fts USING fts5(text, content='chunk', content_rowid='rowid',
                                          tokenize='porter unicode61');
CREATE VIRTUAL TABLE alias_fts USING fts5(alias, content='answer_alias', content_rowid='rowid',
                                          tokenize='porter unicode61');
CREATE TABLE chunk_vec (chunk_id TEXT PRIMARY KEY, vec BLOB NOT NULL, scale REAL NOT NULL); -- int8

CREATE TABLE provenance (
  prov_id TEXT PRIMARY KEY,
  backend TEXT NOT NULL,            -- claude-cli|anthropic|openai-compatible|codex|deterministic|human
  model TEXT NOT NULL,              -- exact model id
  prompt_id TEXT NOT NULL, prompt_version TEXT NOT NULL, prompt_sha256 TEXT NOT NULL,
  input_sha256 TEXT NOT NULL,       -- hash of the exact source text + params
  output_sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  verifier TEXT NOT NULL,           -- what checked it
  verdict TEXT NOT NULL,            -- pass|fail|needs_review
  notes TEXT
);
```

Only rows with `verdict = 'pass'` ship in a release pack.

### Answer-segment JSON

Used by `answer.body` and `lesson.body`. The app renders it; the support checker
validates it.

```json
[ { "t": "text",  "text": "There are three clearances to know." },
  { "t": "quote", "section_id": "29cfr1926.1408(a)(2)", "text": "<verbatim substring of section.text>" },
  { "t": "cite",  "section_id": "29cfr1926.1408(a)(2)" },
  { "t": "diagram", "diagram_id": "…" } ]
```

A `quote` must be an exact substring of the section's `text` (after whitespace
normalization). A `cite` must name an existing section. The checker drops any
claim segment that has no supporting quote or cite in the same paragraph.

## Core CLI (what eval and the bake verifier call)

```
harvest verify  <pack-dir>                      # signature + hashes + schema
harvest search  <pack> "<query>" [--k 10] [--json]
harvest ask     <pack> "<question>" [--role operator] [--equip <id>] [--llm <endpoint|off>] [--audit <records-db>] [--json]
harvest audit   <records-db> [--json]
harvest outbox  <records-db> [--to <dir>] [--json]
```

`ask --json` prints:

```json
{ "mode": "baked|composed|declined|clarify",   // clarify: model on only; body = one question
  "answer_id": "…|null",
  "body": [ /* answer segments */ ],
  "citations": ["29cfr1926.1408(a)(2)"],
  "retrieved": [{ "chunk_id": "…", "ref_id": "…", "lexical": 0.0, "dense": 0.0, "score": 0.0 }],
  "check": { "quotes_ok": true, "cites_ok": true, "dropped": 0 },
  "nearest": ["…"],            // when declined
  "pack_version": "…", "model": "…|null", "elapsed_ms": 0 }
```

The Tauri app calls the same functions in-process; the CLI exists so evaluation
measures exactly the code the app runs.

## Records and uploads

The device keeps one records database (`records.db`, never inside a pack):
procedure runs and step results, the audit log, and an outbox. Every outbox
item goes up as:

```json
{ "item_id": "run-…", "kind": "run|deficiency|deficiency_cleared|miss",
  "created_at": "…Z",
  "payload": "<the payload's JSON, as a string>",
  "payload_sha256": "<hex SHA-256 of the payload string's UTF-8 bytes>" }
```

- `run`: a finished or abandoned run with its steps (`run_id`, `pack_id`,
  `pack_version`, `proc_id`, `equip_id`, `asset`, `role`, `status`, `steps`).
  It is the authoritative record of the run.
- `deficiency`: early notice, queued the moment a `pass_fail` step fails
  (run, step, its `section_ids`, the record). A correction before upload
  withdraws it; a correction after upload queues `deficiency_cleared`
  (`run_id`, `step`, the new record). The latest item for a step wins.
- `miss`: a declined question (`question`, `nearest`, pack version), for the
  next bake.

A run is recorded against the procedure's steps as they were when it began;
a pack update that changes those steps refuses further results for that run.

On the device, people's entries in `records.db` (step values, notes, photo
references, outbox payloads, audit entries) are encrypted at rest with a key
from the platform keystore; uploads leave the device in the clear over the
transport's own encryption (TLS, or the folder the operator chose).

The receiver stores items idempotently by `item_id` and answers each with
`{ "item_id", "payload_sha256", "server_id", "received_at" }`. An item is done
only when its receipt echoes its hash; anything else stays queued.

## Bake hit rate

`mode = baked` answers, plus every screen that renders only pack rows (lessons,
questions, procedures, tools), count as baked. The app records the mode of every
answer in the audit log; the evaluation report states the rate.
