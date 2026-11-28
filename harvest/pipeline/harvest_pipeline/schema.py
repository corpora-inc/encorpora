"""Pack schema v1, verbatim from harvest/CONTRACT.md. Change both together."""

from __future__ import annotations

import sqlite3

DDL = """
CREATE TABLE pack_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE source (
  source_id   TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  publisher   TEXT NOT NULL,
  url         TEXT NOT NULL,
  edition     TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  sha256      TEXT NOT NULL,
  media_type  TEXT NOT NULL,
  license     TEXT NOT NULL
);

CREATE TABLE section (
  section_id  TEXT PRIMARY KEY,
  source_id   TEXT NOT NULL REFERENCES source,
  parent_id   TEXT REFERENCES section,
  ord         INTEGER NOT NULL,
  depth       INTEGER NOT NULL,
  kind        TEXT NOT NULL,
  citation    TEXT NOT NULL,
  heading     TEXT,
  text        TEXT NOT NULL,
  text_sha256 TEXT NOT NULL,
  lang        TEXT NOT NULL
);
CREATE TABLE xref (from_id TEXT NOT NULL, to_id TEXT NOT NULL, kind TEXT NOT NULL,
                   PRIMARY KEY (from_id, to_id, kind));

CREATE TABLE equipment (
  equip_id TEXT PRIMARY KEY, parent_id TEXT, name TEXT NOT NULL, aliases TEXT NOT NULL
);
CREATE TABLE applies_to (ref_kind TEXT NOT NULL, ref_id TEXT NOT NULL, equip_id TEXT NOT NULL,
                         PRIMARY KEY (ref_kind, ref_id, equip_id));

CREATE TABLE term (term_id TEXT PRIMARY KEY, term TEXT NOT NULL, definition TEXT NOT NULL,
                   section_id TEXT NOT NULL, quote TEXT, lang TEXT NOT NULL, prov_id TEXT NOT NULL);

CREATE TABLE fact (
  fact_id TEXT PRIMARY KEY, section_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  statement TEXT NOT NULL,
  quote TEXT NOT NULL,
  value TEXT, unit TEXT, lang TEXT NOT NULL, prov_id TEXT NOT NULL
);

CREATE TABLE explanation (section_id TEXT NOT NULL, level TEXT NOT NULL,
  body TEXT NOT NULL, lang TEXT NOT NULL, prov_id TEXT NOT NULL, PRIMARY KEY (section_id, level, lang));

CREATE TABLE topic (topic_id TEXT PRIMARY KEY, parent_id TEXT, ord INTEGER NOT NULL,
                    title TEXT NOT NULL, summary TEXT NOT NULL, lang TEXT NOT NULL);
CREATE TABLE skill (skill_id TEXT PRIMARY KEY, topic_id TEXT NOT NULL, title TEXT NOT NULL,
                    lang TEXT NOT NULL);
CREATE TABLE lesson (lesson_id TEXT PRIMARY KEY, topic_id TEXT NOT NULL, ord INTEGER NOT NULL,
  title TEXT NOT NULL, body TEXT NOT NULL,
  lang TEXT NOT NULL, prov_id TEXT NOT NULL);
CREATE TABLE diagram (diagram_id TEXT PRIMARY KEY, svg TEXT NOT NULL, caption TEXT NOT NULL,
  alt TEXT NOT NULL, section_ids TEXT NOT NULL, lang TEXT NOT NULL, prov_id TEXT NOT NULL);

CREATE TABLE question (
  q_id TEXT PRIMARY KEY, skill_id TEXT NOT NULL, variant_of TEXT,
  kind TEXT NOT NULL,
  stem TEXT NOT NULL,
  choices TEXT,
  answer TEXT NOT NULL,
  rationales TEXT,
  section_ids TEXT NOT NULL,
  difficulty REAL NOT NULL,
  lang TEXT NOT NULL, prov_id TEXT NOT NULL,
  note TEXT
);

CREATE TABLE answer (
  answer_id TEXT PRIMARY KEY, question TEXT NOT NULL,
  body TEXT NOT NULL,
  section_ids TEXT NOT NULL, level TEXT, lang TEXT NOT NULL, prov_id TEXT NOT NULL
);
CREATE TABLE answer_alias (alias TEXT NOT NULL, answer_id TEXT NOT NULL, lang TEXT NOT NULL,
                           PRIMARY KEY (alias, answer_id));

CREATE TABLE procedure (proc_id TEXT PRIMARY KEY, title TEXT NOT NULL, kind TEXT NOT NULL,
  summary TEXT NOT NULL, roles TEXT NOT NULL, lang TEXT NOT NULL, prov_id TEXT NOT NULL);
CREATE TABLE proc_step (proc_id TEXT NOT NULL, ord INTEGER NOT NULL,
  text TEXT NOT NULL, detail TEXT NOT NULL,
  check_kind TEXT NOT NULL,
  section_ids TEXT NOT NULL,
  deficiency TEXT,
  lang TEXT NOT NULL, prov_id TEXT NOT NULL, PRIMARY KEY (proc_id, ord));

CREATE TABLE chunk (chunk_id TEXT PRIMARY KEY, ref_kind TEXT NOT NULL, ref_id TEXT NOT NULL,
                    text TEXT NOT NULL, lang TEXT NOT NULL);
CREATE VIRTUAL TABLE chunk_fts USING fts5(text, content='chunk', content_rowid='rowid',
                                          tokenize='porter unicode61');
CREATE VIRTUAL TABLE alias_fts USING fts5(alias, content='answer_alias', content_rowid='rowid',
                                          tokenize='porter unicode61');
CREATE TABLE chunk_vec (chunk_id TEXT PRIMARY KEY, vec BLOB NOT NULL, scale REAL NOT NULL);

CREATE TABLE course_node (
  node_id TEXT PRIMARY KEY, parent_id TEXT, ord INTEGER NOT NULL,
  level TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  hard TEXT NOT NULL,
  mistakes TEXT NOT NULL,
  exam TEXT NOT NULL,
  links TEXT NOT NULL,
  section_ids TEXT NOT NULL,
  quotes TEXT NOT NULL,
  lang TEXT NOT NULL, prov_id TEXT NOT NULL);
CREATE TABLE course_node_vec (node_id TEXT PRIMARY KEY, vec BLOB NOT NULL, scale REAL NOT NULL);

CREATE TABLE provenance (
  prov_id TEXT PRIMARY KEY,
  backend TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_id TEXT NOT NULL, prompt_version TEXT NOT NULL, prompt_sha256 TEXT NOT NULL,
  input_sha256 TEXT NOT NULL,
  output_sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  verifier TEXT NOT NULL,
  verdict TEXT NOT NULL,
  notes TEXT
);
"""

# Tables whose rows are generated and carry prov_id; a release pack keeps only verdict = 'pass'.
GENERATED = ("term", "fact", "explanation", "lesson", "diagram", "question", "answer", "procedure", "proc_step",
             "course_node")
# Child tables without prov_id, filtered through their parent.
CHILD_FILTERS = {
    "answer_alias": "answer_id IN (SELECT answer_id FROM answer)",
    "applies_to": None,  # filtered by the writer via the applicability provenance side table
}

# Rows that belong to the pipeline but not to the contract schema live in tables prefixed `_`;
# the release writer drops them.
STAGE_DDL = """
CREATE TABLE _row_prov (tbl TEXT NOT NULL, row_key TEXT NOT NULL, prov_id TEXT NOT NULL,
                        PRIMARY KEY (tbl, row_key, prov_id));
"""


def create(conn: sqlite3.Connection, stage: bool = False) -> None:
    conn.executescript(DDL)
    if stage:
        conn.executescript(STAGE_DDL)


def table_columns(conn: sqlite3.Connection, table: str) -> list[str]:
    return [r[1] for r in conn.execute(f"PRAGMA table_info({table})")]
