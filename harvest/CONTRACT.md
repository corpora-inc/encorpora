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

The core refuses a pack whose signature or file hash fails.

A delta pack turns the installed version into the next one byte for byte. Its
signed `manifest.json` carries `"base_version"`, `"base_sha256"` (the base
database file it patches) and lists two files:
`<target database path>.bsdiff` (a BSDIFF40 patch from the base SQLite file to
the target's) and `target.manifest.json` (the target's own signed full
manifest, unchanged). The core patches the installed base and then accepts
the result only as that full pack: signature, every file hash, no downgrade.
Other files must be unchanged from the base. `harvest delta` writes one from
two full pack directories (signed with `HARVEST_SIGNING_KEY`, the bake's
key, when set). Without the base installed, the host installs the full pack.

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
  answer TEXT NOT NULL,             -- mc: index as text; numeric: value or value±tolerance; free_text: rubric json (below)
  rationales TEXT,                  -- json array, one per choice: why right / why wrong
  section_ids TEXT NOT NULL,        -- json array
  difficulty REAL NOT NULL,         -- 0..1 prior
  lang TEXT NOT NULL, prov_id TEXT NOT NULL,
  note TEXT                         -- optional: one line past the answer (why it matters, the edge case, the related rule)
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
  deficiency TEXT,                                 -- json {guidance, action, section_id, quote}: see below
  lang TEXT NOT NULL, prov_id TEXT NOT NULL, PRIMARY KEY (proc_id, ord));

CREATE TABLE chunk (chunk_id TEXT PRIMARY KEY, ref_kind TEXT NOT NULL, ref_id TEXT NOT NULL,
                    text TEXT NOT NULL, lang TEXT NOT NULL);  -- retrieval units
CREATE VIRTUAL TABLE chunk_fts USING fts5(text, content='chunk', content_rowid='rowid',
                                          tokenize='porter unicode61');
CREATE VIRTUAL TABLE alias_fts USING fts5(alias, content='answer_alias', content_rowid='rowid',
                                          tokenize='porter unicode61');
CREATE TABLE chunk_vec (chunk_id TEXT PRIMARY KEY, vec BLOB NOT NULL, scale REAL NOT NULL); -- int8

CREATE TABLE course_node (          -- the course knowledge tree (empty in packs without one)
  node_id TEXT PRIMARY KEY,         -- course | exam:<id> | domain:<id> | topic:<id> | skill:<id>
  parent_id TEXT, ord INTEGER NOT NULL,
  level TEXT NOT NULL,              -- course|exam|domain|topic|skill
  title TEXT NOT NULL,
  summary TEXT NOT NULL,            -- what this part is, in a few sentences
  hard TEXT NOT NULL,               -- what is hard here ('' when not written)
  mistakes TEXT NOT NULL,           -- what people get wrong
  exam TEXT NOT NULL,               -- what the exam asks about it
  links TEXT NOT NULL,              -- json {node_ids, lesson_ids, q_ids, diagram_ids, film_ids}
  section_ids TEXT NOT NULL,        -- json array: the rule paragraphs at this node
  quotes TEXT NOT NULL,             -- json [{section_id, quote}]: the rule text behind any rule the node states
  lang TEXT NOT NULL, prov_id TEXT NOT NULL);
CREATE TABLE course_node_vec (node_id TEXT PRIMARY KEY, vec BLOB NOT NULL, scale REAL NOT NULL); -- int8

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

Only rows with `verdict = 'pass'` ship in a release pack. Each generated row has its own
provenance row: rows from one generation call can earn different verdicts.

### Free-text rubric

`question.answer` for `kind = free_text`. One shape for every reader: the core
(`grade::Rubric`), `harvest/practice` (`parseRubric`) and the bake (`contract.py`). Unknown
keys are refused.

```json
{ "points": [ { "id": "dist", "point": "Says the minimum clearance is 20 feet",
                "any": ["20 feet", "twenty feet"] } ],
  "pass": 1,
  "sample_answer": "At least 20 feet unless Table A allows less.",
  "misconceptions": ["10 feet is always enough."] }
```

- `points`: at least one; `id` unique; `point` is the criterion in plain words (shown
  when missed, and what a model judges); `any` lists alternative phrases, and any one of them
  meets the point.
- `pass`: how many points are needed, 1 to the number of points; all of them when absent.
- `sample_answer`, `misconceptions`: optional feedback text.

A `numeric` answer is a plain decimal (`25`, `1,200`, `-3.5`) or one with a tolerance
(`25±0.5`, `25 +/- 0.5`).

### Procedure step deficiency

`proc_step.deficiency` is null (a step with no failure state) or
`{"guidance", "action", "basis", "section_id", "quote"}`, one of two kinds:

- **`basis: "rule"`**: a rule says so. `section_id` must exist and `quote` must be a verbatim
  substring of its text. This holds even when the step itself is a practice method, such as a
  calculation or a briefing, whose failure breaks a rule.
- **`basis: "practice"`**: field practice with no rule behind it. `section_id` and `quote` are
  null. The app shows the guidance and action as practice guidance, never as a rule and never with
  a citation.

`action` may be null. The bake writes `basis` on every deficiency. It marks one practice only when
it cites nothing and its source marks it so (`basis: practice`, or a `practice_only` step), and
it fails any other uncited deficiency. The core reads a row without `basis` as a rule when it
cites a section, and as practice otherwise. It always returns `basis`, and it refuses a row whose
basis and citation disagree (a rule with no section or quote, or practice that cites one).

## Core CLI (what eval and the bake verifier call)

```
harvest verify  <pack-dir>                      # signature + hashes + schema
harvest search  <pack> "<query>" [--k 10] [--json]
harvest ask     <pack> "<question>" [--role operator] [--equip <id>] [--llm <endpoint|off>] [--audit <records-db>] [--json]
harvest audit   <records-db> [--json]
harvest outbox  <records-db> [--to <dir>] [--json]
harvest show    <pack> info|sections|topics|skills|lessons|terms|diagrams|questions|procedures|answers|exams|prereqs|starters [--id ID] [--role R]
harvest fixture <dir> --maint [--samples DIR]     # the fictional pump manual, a field bundle, an asset registry
```

`harvest verify` also validates the fault trees of a pack that has them
(below) and exits 1 on any violation, listing each.

`ask --json` prints:

```json
{ "mode": "baked|composed|declined|clarify",   // clarify: model on only; body = one question
  "answer_id": "…|null",
  "body": [ /* answer segments */ ],
  "citations": ["29cfr1926.1408(a)(2)"],
  "retrieved": [{ "chunk_id": "…", "ref_id": "…", "lexical": 0.0, "dense": 0.0, "score": 0.0 }],
  "check": { "quotes_ok": true, "cites_ok": true, "dropped": 0 },
  "nearest": ["…"],            // when declined
  "pack_version": "…", "model": "…|null", "elapsed_ms": 0,
  "tool": "range_table:<section_id>",   // present when a table lookup answered first
  "support": { "score": 0.0, "threshold": 0.4, "window": 0.25, "max_sections": 3, "depth": 12,
               "concepts": ["…"], "cache_similarity": 0.0, "cache_threshold": 0.75,
               "top_dense": 0.0, "min_dense": null,
               "candidates": [{ "section_id": "…", "rank": 1, "retrieval": 0.0,
                                "coverage": 0.0, "covered": ["…"] }] } }
```

`support` is the deterministic answer gate's view of the question, in every
mode, so a threshold can be tuned offline: candidates are the sections of
the first `depth` retrieved chunks (`retrieved` lists the first `k` of them),
in retrieval order; a candidate is composed when `coverage >=
threshold` and `coverage >= score - window`, the first `max_sections` of them;
none means decline; with `min_dense` set (the dense gate, in force only when
dense retrieval ran), the engine also declines when `top_dense < min_dense`,
with the model on as well, and `threshold` is the gate's coverage bar.
The cache answers first when `cache_similarity >= cache_threshold`.

Composed answers open with the answer: the clearly most relevant verified
line (a baked fact's statement whose quote is in the shown passage, or a
sentence of the role's explanation, covering at least 30% of the question),
then the rule's own words and the explanation. When the question states a
number in the unit of a range table the gate chose (a `table` section
with `x | y` rows such as `over 50 to 200 | 15`), the row is looked up and the
answer states it, quoting the header and the row (and the table's note when
the number is a band's bound); `tool` names the table. A cache hit with
similarity below `cache_confirm` (0.85) is served only when the embedder's
cosine between the question and the alias reaches `cache_intent_min` (0.9);
without an embedder it goes to retrieval. A pack may override both in
`pack_meta` (`cache_confirm_similarity`, `cache_intent_min`).

A pack states its calibrated dense gate in `pack_meta`:
`gate_dense_support_threshold` and `gate_dense_min` (both numbers as text;
they belong to the pack's embedder, whose cosine scale they assume). Without
them, or without dense vectors, the coverage-only threshold (0.4) applies.

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

- `run`: a finished or abandoned run as a run report (below). It is the
  authoritative record of the run.
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

### Run report (`harvest-run/1`)

One format for the queued `run` upload and for the app's export of a run
(`Records::report`):

```json
{ "format": "harvest-run/1", "pack_id": "…", "pack_version": "…",
  "run_id": "run-…", "proc_id": "…", "title": "…|null", "role": "operator",
  "equip_id": "…|null", "asset": "…|null", "status": "open|complete|abandoned", "steps_known": true,
  "started_at": "…Z", "finished_at": "…Z|null",
  "steps": [{ "ord": 1, "text": "…|null", "section_ids": ["…"], "check_kind": "pass_fail|value|note|photo|null",
              "outcome": "pass|fail|na|value|note|photo|null", "value": null, "note": null,
              "photos": [{ "path": "…", "sha256": "…" }], "structured": null,
              "deficiency": false, "recorded_at": "…Z|null" }] }
```

Every step of the procedure is listed, recorded or not (`outcome: null`).
`text`, `section_ids`, `check_kind` and `title` come from the pack; when the
procedure changed since the run began, `steps_known` is false and only the
recorded steps are listed, without them.

## Content read API

The app renders only what the core reads from a pack it verified on open; it
never opens the SQLite file. The core (`harvest_core::content`, and
`harvest show <pack> <what>` for the same JSON) returns:

| Call | Rows |
|---|---|
| `info()` | pack id, version, schema, `built_at`, `corpus_id`, sources, row counts |
| `sources()`, `sections()`, `section(id)`, `children(id)`, `section_lineage(id)`, `xrefs_from(id)`, `xrefs_to(id)` | the corpus |
| `explanation(section, level, lang)` | plain-language explanation |
| `topics()`, `skills()`, `lessons()`, `lesson(id)` | the course; lesson bodies checked |
| `terms()`, `diagrams()`, `diagram(id)` | glossary and figures (`svg` is rendered as an image, never as inline markup) |
| `questions()`, `questions_for_skill(id)`, `question(id)` | the bank; JSON columns parsed, an `mc` answer outside its choices is a pack error |
| `procedures()`, `procedure(id)`, `proc_steps(id)` | Do |
| `answers()`, `answer_for(id, role)` | the answer cache; the role's variant (same `question`, `level` = role) when there is one; body checked |
| `equipment()` | variants |
| `exams()`, `prereqs()`, `starters(role)` | app data from `pack_meta` |
| `course_nodes()`; `CourseTree::from_pack(pack, exams)` → `node(id)`, `root()`, `children(id)`, `path(id)`, `search(retriever, query, k)` | the course knowledge tree (below) |

Generated rows (term, lesson, diagram, question, answer, procedure, proc_step)
are returned only when their `provenance.verdict` is `pass`; a procedure
appears only when it and every one of its steps passed. A term's quote that
is not verbatim is dropped; a lesson the checker empties is left out; a
question whose answer does not fit its kind is a pack error. Answer-segment
bodies go through the structural checker, so a quote that is not verbatim is
dropped, with the paragraph it supported.

App data lives in optional `pack_meta` keys, JSON as text:
`exam_blueprints` (array of exam blueprints, as `crane/content/exams.json`),
`skill_prereqs` (`{skill_id: [skill_id]}`), `starter_answers`
(`{role: [answer_id]}`; ids that do not exist or did not pass are skipped). The bake writes
them from the corpus YAML's `pack_meta:` map and refuses unknown skill or answer ids, unknown
roles and prerequisite cycles.

**Read-back check.** `harvest-bake showcheck <pack-dir> --harvest <bin> --pubkey <key>`
calls every `harvest show` list, every lesson, diagram, question and procedure by id, and
every answer in every role. It fails on any error, or when the core returns fewer rows than
the pack holds. CI runs it on the crane pack built from `main` (`crane-pack` job). `--out`
writes everything it read as one JSON file (`"format": "harvest-show/1"`, keys: the `show`
names, plus `starters` by role and `answer_bodies[answer_id][role]`). A browser build cannot
open the signed SQLite file, so it reads this copy.

### Course knowledge tree

`course_node` holds the course as a tree a conversation can move through,
from the overview down to the rule text:

```
course
├── exam:<exam_id>          the written exams
│   └── domain:<domain_id>  links.node_ids: the skills the domain tests
└── topic:<topic_id>        (topics may nest)
    └── skill:<skill_id>    section_ids: the rule paragraphs at the leaf
```

Every node has `title` and four short texts the content lane writes and
verifies: `summary` (what this part is), `hard` (what is hard here),
`mistakes` (what people get wrong) and `exam` (what the exam asks about it);
`''` when not written. A node that states a rule carries the rule text in
`quotes` (`[{section_id, quote}]`, verbatim, checked at import and again on
read). `links` points down to `node_ids` (beyond its children), `lesson_ids`,
`q_ids`, `diagram_ids` and `film_ids` (films the host resolves from its media
catalog). Lesson, question and diagram links to rows the stage does not
have are dropped at import and reported (import `course_node` after the
tables it links to), and a link to a row that did not ship is dropped on
read. A row's provenance covers its text: the skeleton passes
structure alone, and text without provenance of its own waits for review.

`harvest-bake course-skeleton <blueprint.yaml> [--existing tree.jsonl] --out
course/tree.jsonl` writes the structure from the blueprint and content files,
keeping any node text, quotes and films already written, and reports
blueprint titles a YAML flow mapping cut at a comma.

`course_node_vec` embeds each node (title and texts) with the pack's
embedder. The tree is its own index: answer retrieval (`chunk`, `ask`) never
sees it, and older engines ignore both tables. `CourseTree::search` scores
nodes with BM25 in memory, fused by RRF with cosine over `course_node_vec`
when the host's embedder matches the pack's. A pack without a tree (or an
older one) gets the same structure derived from its topics, skills, lessons,
questions, diagrams and the exam blueprints, with empty node text
(`derived: true`).

`harvest show <pack> tree [--id NODE] [--exams exams.json]` prints the tree,
or one node with its path and children; `harvest search <pack> "<q>" --in
tree` searches it.

## Instructor turns

The Instructor is a conversation over the course tree
(`harvest_core::instructor`, `harvest converse` for scripted runs). The app
owns the conversation and renders it; the core answers one turn at a time and
keeps no state.

```
Conversation {conv_id, title, created_at, pack_version, turns: Turn[]}     -- the app's, on the device
Turn {turn_id, who: "learner"|"instructor", status: "streaming"|"done"|"error",
      blocks: Block[], follow_ups: FollowUp[], model: string|null,
      at?: node_id, trace?: Trace}
FollowUp {label, ask?: string, to?: route, input?: Input}                  -- exactly one of ask / to / input
Input {kind:"open", node_id, fields?: ["summary"|"hard"|"mistakes"|"exam"]}
    | {kind:"rules", node_id} | {kind:"practice", skill_id} | {kind:"focus"}
```

A request is `{history: [{who, text}], learner, at?, ask? | input?}`: the
conversation so far as plain text, the learner (`role`, `mastery`
`{skill_id: 0..1}` from the practice engine, `exam_id`, `exam_date`, `recent`
`[{q_id, chosen}]`, newest last), the node the conversation is at (the last
turn's `at`), and either the learner's words (`ask`) or a tapped tree move
(`input`). An `input` is answered from the tree with no model call; `ask`
goes through the model when one is loaded and through tree search when not.
The core emits whole turns (`status: "done"`); `turn_id` and `created_at` are
the app's.

Blocks (`t`); a block is immutable once emitted, and every non-text block
names what the app needs to reserve its height:

| `t` | Fields | What it is |
|---|---|---|
| `text` | `text` | prose; no markdown tables |
| `quote` | `section_id`, `text` | rule text, copied from the pack by the engine and checked verbatim; never model output |
| `cite` | `section_id` | the citation for the quotes before it |
| `node` | `node_id`, `level`, `title`, `path [{node_id, level, title}]`, `texts [{field, text}]` | course-tree text: the named fields, else `summary` and `hard` (follow-ups offer the rest); a text the conversation already showed is not shown again; with at most three of the node's quotes, unshown first. A sentence whose number states a requirement (a distance, a percent of capacity, a deadline, an interval) stands only with a quote in the turn that states it: the engine adds that quote from the node's quotes or its rule sections, or leaves the sentence out. Exam-format numbers come only from the exam blueprints. Arithmetic, unit conversions and physics need no quote. `mistakes` are misconceptions (wrong ideas on purpose, then what is right): the app shows them labelled as such |
| `exam` | `exam_id` | the exam's domains, weights and counts, from the blueprint |
| `lesson` | `lesson_id` | a lesson card |
| `film` | `film_id`, `node_id` | a lesson film; the app fills aspect, duration and poster from its media catalog |
| `diagram` | `diagram_id` | a diagram |
| `question` | `q_id`, `chosen?` | inline practice (recorded in practice state); with `chosen`, the learner's answer under review with the rationales |
| `focus` | `items [{node_id, title, domain, weight, mastery\|null}]` | study priorities: the skill's share of each domain that tests it (weight / √skills), summed, × (1 − mastery); an unpractised skill at 0.5 |
| `tool` | `tool` (`clearance`\|`load-chart`\|`signals`), `input?` | the app's tool; `clearance` with `input {kv, traveling}` is followed by the table row as text, quote and cite |
| `search` | `query` | the grouped rule results for a query (the rules index the app shows) |

What the model may write: the model chooses the intent, the node and which
of its texts, the linked blocks, the rule sentences (by handle, never by
text) and a tool, and writes one short `say`. The engine shows `say` as the
turn's first `text` block, sentence by sentence. A sentence that states a
requirement (must, shall, required, prohibited, at least, minimum, only …
may, assume / presumed / responsible for; never, cannot, have to, should
beside a duty word; an order about the work such as "keep the boom clear of
the line"), or measures with
a rule's unit (feet, kV, pounds, degrees, days…), stands only when the rule
sentences quoted in this turn support it on their own: every number in
them, its content words in them, the same negation. A number in any other
sentence must come from the exam blueprint, the course counts or the node
text shown in the turn. Anything else is dropped and listed in
`trace.dropped`. Named rule sentences are quoted in `rule`, `tool` and
`review` turns (at most four named runs, each with its list's lead-in); in other turns only when they back a
claim the line makes. A table's rows are its sentences. A quoted list item
("(v) The load is over a cofferdam.") is preceded by the quoted sentence
that introduces its list, and its parent list's, when not already shown. A
sentence that points at a block the turn does not show ("the rule quoted
below" with no quote) is dropped. The model is offered only the intents the
turn can serve (`review` only with an answer to review); study talk with
nothing to review shows the `focus` block. When sentences are
dropped, the model sees them once with the reason and writes the line
again; the rewrite is kept unless it loses more. A `rule` turn with no rule
sentence shown states no rule and shows a `search` block for the question.
When the turn shows a table row for the learner's value, the engine's line
for that row leads and the model's line follows. Tool numbers come from the
learner's words, never the model's: `clearance` carries the voltage the
learner said, and a value in a range table's unit leads with that row.
`trace` (`intent`, `node_hits`, `rule_hits`, `dropped`, `model_error`,
`elapsed_ms`) is for the audit log, never rendered.

The welcome is `pack_meta.instructor_welcome`: one instructor Turn (what the
course and exam are, the hard parts, follow-ups), checked on read like any
turn: a quote that is not verbatim, a cite not right after a kept quote of
its section, a link to a row that did not ship and a `focus` block are
dropped; `node` blocks are rebuilt from the tree; `text` goes through the
sentence check with no rule sentences shown. A pack without one opens on the course node's text, the `exam`
block and follow-ups to the exam's domains.

## Bake hit rate

`mode = baked` answers, plus every screen that renders only pack rows (lessons,
questions, procedures, tools), count as baked. The app records the mode of every
answer in the audit log; the evaluation report states the rate.

## Maintenance tables

Optional tables for maintenance manuals. A pack without them (crane) reads
as before; the core detects each table, and each optional column, on its
own. Generated rows carry `prov_id` and ship only when it passed.

```sql
-- Maintenance tables (optional; CONTRACT "Maintenance tables"). A pack without
-- them reads as before; the core detects each table on its own.
CREATE TABLE section_loc (section_id TEXT PRIMARY KEY, page_label TEXT, page_index INTEGER,
                          figure_label TEXT,
                          boxes TEXT);                   -- json [{x0,y0,x1,y1}], 0..1 on the page image
CREATE TABLE asset (asset_id TEXT PRIMARY KEY, path TEXT NOT NULL, sha256 TEXT NOT NULL,
                    media_type TEXT NOT NULL, bytes INTEGER NOT NULL, width INTEGER, height INTEGER);
CREATE TABLE section_asset (section_id TEXT NOT NULL, asset_id TEXT NOT NULL,
                            role TEXT NOT NULL,          -- figure|page
                            PRIMARY KEY (section_id, asset_id, role));
CREATE TABLE requirement (ref_kind TEXT NOT NULL,        -- procedure|fault_tree|fault_node
  ref_id TEXT NOT NULL, ord INTEGER NOT NULL,
  kind TEXT NOT NULL,                                    -- tool|part|consumable|personnel|condition|reference
  text TEXT NOT NULL, ident TEXT, qty TEXT, section_id TEXT, prov_id TEXT NOT NULL,
  PRIMARY KEY (ref_kind, ref_id, ord));
CREATE TABLE fault_tree (tree_id TEXT PRIMARY KEY, title TEXT NOT NULL, system TEXT,
  entry_node TEXT NOT NULL, section_ids TEXT NOT NULL, lang TEXT NOT NULL, prov_id TEXT NOT NULL);
CREATE TABLE fault_node (node_id TEXT PRIMARY KEY, tree_id TEXT NOT NULL,
  kind TEXT NOT NULL,                                    -- symptom|check|action|goto|escalate|end
  text TEXT NOT NULL,                                    -- verbatim: a substring of the section's text
  section_id TEXT NOT NULL,
  expect TEXT,                                           -- json: how a result is recorded
  target TEXT,                                           -- tree:<id> | procedure:<id> (goto; optional on action)
  proc_id TEXT,                                          -- the test procedure that answers the question
  lang TEXT NOT NULL, prov_id TEXT NOT NULL);
CREATE TABLE fault_edge (from_node TEXT NOT NULL, ord INTEGER NOT NULL, label TEXT NOT NULL,
  cond TEXT,                                             -- json numeric predicate; null: label equality
  to_node TEXT NOT NULL, retry INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (from_node, ord));
CREATE TABLE fault_facet (node_id TEXT NOT NULL, facet TEXT NOT NULL, ord INTEGER NOT NULL,
  text TEXT NOT NULL, section_id TEXT NOT NULL, PRIMARY KEY (node_id, facet, ord));
CREATE TABLE symptom (symptom_id TEXT PRIMARY KEY, tree_id TEXT NOT NULL, title TEXT NOT NULL,
  system TEXT, synonyms TEXT NOT NULL, lang TEXT NOT NULL, prov_id TEXT NOT NULL);
CREATE TABLE signal_map (signal_kind TEXT NOT NULL, pattern TEXT NOT NULL, title TEXT NOT NULL,
  tree_id TEXT NOT NULL, node_id TEXT, section_id TEXT, quote TEXT, prov_id TEXT NOT NULL,
  PRIMARY KEY (signal_kind, pattern, tree_id));
CREATE TABLE equip_attr (equip_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
                         PRIMARY KEY (equip_id, key));
CREATE TABLE equip_ident (equip_id TEXT NOT NULL,
                          kind TEXT NOT NULL,            -- serial_range|model|firmware|param|text
                          pattern TEXT NOT NULL, PRIMARY KEY (equip_id, kind, pattern));
CREATE TABLE history (event_id TEXT PRIMARY KEY, equip_id TEXT NOT NULL, system TEXT,
  date TEXT NOT NULL, text TEXT NOT NULL, source_id TEXT, attrs TEXT NOT NULL);
CREATE TABLE failure_mode (mode_id TEXT PRIMARY KEY, equip_id TEXT NOT NULL, system TEXT,
  title TEXT NOT NULL, count INTEGER NOT NULL, share REAL, tree_id TEXT, examples TEXT NOT NULL);
```

- **Typed blocks are sections.** `section.kind` also takes `step`,
  `warning`, `caution` and `note`. A warning, caution or note guards a step
  with `xref(from=<block>, to=<step or task section>, kind='guards')`; it
  guards that section and everything under it. Block text is verbatim.
- **Verbatim on read.** `fault_node.text` and `fault_facet.text` must be
  substrings of their section's text (whitespace-normalized). A tree with
  one node that fails this, or did not pass, is refused whole. A
  requirement or signal quote that is not verbatim is flagged
  (`verbatim: false`, `quote_verified: false`) and fails validation.
- **`expect`** (how a result is recorded): `{"kind":"yes_no"}`,
  `{"kind":"pass_fail"}`, `{"kind":"choice","options":[…]}`,
  `{"kind":"value","unit":"V","min":0,"max":30}` (`min`/`max` optional: the
  range the node accepts), `{"kind":"ack"}` (outcome `done`, one branch).
  A node with no branches has none.
- **`cond`** on an edge: null matches by label (case and spacing folded:
  `Yes` takes `yes`); a value node's edges carry
  `{"op":"<"|"<="|">"|">="|"==","value":x}` or
  `{"op":"between","min":a,"max":b}` (`a <= v < b`). No unit conversion:
  a value in another unit is refused. `retry = 1` marks a loop the manual
  makes on purpose (re-test after an adjustment).
- **`target`**: `tree:<id>` or `procedure:<id>`; a `goto` must have one, an
  `action` may (the task to do). **`proc_id`**: the procedure whose steps
  answer the node's question (its steps carry their own guards).
- **Facets** (`fault_facet.facet`) are the pack's names (`reason`, `known`,
  `possible`, `test_option`, …); the core returns them grouped, in the
  order and with the headings of `pack_meta.facets`
  (`[{"id","label"}]`). `pack_meta.open_facet` (default `possible`) names
  the facet whose texts are the candidate causes still open: the node's
  own, else the nearest earlier node's on the path.
- **Levels** come from `pack_meta.levels`, ordered, most guidance first:
  `[{"id","label","facets":[…]|null,"test_steps":"expanded"|"collapsed"}]`.
  `facets` lists the facets shown expanded (`null`: all). Without it a pack
  has `trainee`, `operator`, `inspector`. **Warnings, cautions and notes
  are shown at every level**; a level never hides one (tested in the core).
- **Variants.** Every read that takes an `equip_id` filters with
  `applies_to` (`ref_kind` `section`, `procedure`, `proc_step`,
  `fault_tree`, `fault_node`, `symptom`, `requirement` with ref id
  `<ref_kind>:<ref_id>#<ord>`): a row with none applies to all; a row for
  an ancestor applies to its variants; a row for a more specific variant
  than the one known is kept and labelled. A section inherits its nearest
  ancestor's. `equip_ident` resolves an observed plate: `model` (case,
  spaces and dashes ignored), `serial_range` (`P40D-1000..P40D-4999`: same
  prefix, number in range), `firmware` (glob), `param` (`key=glob`),
  `text` (substring). The most specific variant whose own rules the
  observation meets wins; a variant with a rule of a kind the observation
  gives and none of that kind matching is rejected. Two unrelated
  candidates give the deepest common ancestor and `ambiguous: true`.
  `equip_attr` inherits, nearest wins.
- **Signals.** `signal_map.pattern` is exact (case and spacing folded),
  `prefix:…`, `glob:…` (`*`, `?`) or `re:…`. Hits rank exact, glob,
  prefix, regex, then observation order; the first suggests the entry
  (its `node_id`, else the tree's entry). An observation with no kind
  matches every kind. `pack_meta.signal_kinds` (`[{"kind","label","example"}]`)
  labels them for the app.
- **Symptom search** is lexical over the title and synonyms (Dice over
  content stems, pack synonyms applied), plus cosine over the symptom's
  `chunk` (`ref_kind = 'symptom'`) when the host's embedder matches the
  pack's, plus 1 for a matched signal. Words in
  `pack_meta.symptom_weak_words` (default: run, work, keep, …) never make
  a match alone. A hit is `confident` when a signal matched, or its best
  phrase covers at least `symptom_confident_coverage` (default 0.5) of
  the query's other words and at least two of them (or all, when fewer),
  or the cosine reaches `symptom_confident_dense` (default 0.85) beside a
  lexical match; else `closest`. Each hit says why it matched.
- **Locations and assets.** `section_loc.boxes` is optional (older packs
  have no such column). A citation carries the source, edition, the
  section path from the root, page label and index (inherited from the
  nearest ancestor when the section has none), figure label, the page
  image's asset id and the boxes. An asset is served only when the signed
  manifest lists its `path` with the same SHA-256.
- **Repeat window**: `pack_meta.repeat_window_days` (default 30).

**Validation** (`maint::graph::validate`, `harvest verify`, the bake):
every tree's entry is a node of it; every node is reachable from it; no
cycle except through retry edges; a node with no branches is an `action`,
`goto`, `escalate` or `end` and records nothing; `goto`, `escalate` and
`end` have no branches; a node with branches has `expect` and branches that
cover it exactly (each outcome once; numeric conditions that partition the
accepted range, no overlap, no gap); edges stay in their tree; targets and
`proc_id` resolve; node and facet text is verbatim; every facet has a
heading; every guard is a warning, caution or note and its target exists;
requirements, symptoms, signals, assets and boxes resolve. The report
lists every violation with a stable rule code (`edge.coverage`,
`tree.cycle`, `node.verbatim`, …) and counts.

## Maintenance records

`records.db` adds (all `CREATE TABLE IF NOT EXISTS`, so an older store
upgrades in place):

- `asset`: a physical unit (`asset_id`, `equip_id`, `serial`, `name`,
  `attrs`, `hours`, `miles`); `asset_event`: its registry history. A fleet
  is preloaded from a registry file `{"format":"harvest-assets/1","assets":[{asset_id, equip_id, serial, name, attrs, hours, miles, events:[{date, system, symptom_id, tree_id, text}]}]}`
  (upsert by id; an asset's registry events are replaced).
- `job`: one troubleshooting session (tree, entry node, entered by
  `symptom` | `signals` | `chosen`, level, status `open` | `closed`,
  resolution `fixed` | `escalated` | `redirected` | `unresolved` |
  `abandoned`) and `job_step` (seq, node, outcome or value and unit, the
  branch label taken, note, photos, next node, time, `superseded_at`).
  The next node is chosen by code from the recorded result; an answer
  names the node it answers and is refused unless that is the job's
  current node. Going back marks the last step superseded (kept) and
  returns to its node. A job is recorded against its tree as it was when
  it began (SHA-256 of tree, nodes and edges): a pack that changed it
  refuses further answers.
- Every job event (`job.start`, `job.answer`, `job.back`, `job.close`) and
  `lesson.create`, `asset.import`, `field.install` appends to the audit
  chain in the same transaction: an event entry `{ts, event, pack_id,
  pack_version, subject, node_id, asked (the node's text), result,
  next_node, detail}`. `verify_chain` counts them under `events`; the
  bake hit rate counts answers only.
- `lesson`: the close-out (cause, corrective action, parts, minutes, note,
  photos, level, status `local` | `queued` | `uploaded` (its upload was
  acknowledged) | `approved` | `edited` | `rejected`).
- Outbox kinds `job` (payload `harvest-job/1`: the job, every step
  including superseded ones, node texts when the tree is unchanged) and
  `lesson` (`harvest-lesson/1`: the lesson).
- **Repeat discrepancy**: an earlier job or registry event on the same
  asset with the same symptom, or else the same system, within the pack's
  window.
- **Field notes** arrive as a signed bundle
  `{"format":"harvest-field/1","stream","pack_id","seq","issued_at","notes":[{note_id, scope:{equip_id?,tree_id?,node_id?,symptom_id?}, text, counts:{units,resolved,attempts}, approver, approved_at, supersedes?}],"revoke":[note_id],"reviews":[{lesson_id,status,note}],"signature":{…}}`,
  signed like a manifest (ed25519 over the canonical JSON without
  `signature`, a trusted key). The device refuses a bad or untrusted
  signature and a `seq` not above the stream's installed one. A note shows
  where every scope field it gives matches; the API returns notes apart
  from manual text (`field_notes`, `source: "field"`).
- People's entries (job query and signals, step notes and photos,
  resolutions, lesson texts) are sealed at rest like run records.

