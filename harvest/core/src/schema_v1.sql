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
  deficiency TEXT,                                 -- json {guidance, action, section_id, quote}: see below
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
