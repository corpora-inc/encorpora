-- Universal Tutomaton language-module schema.
--
-- Every language module's build_corpus.py loads this first, then optionally
-- adds language-specific tables (e.g. English: phrasal_verbs + modal_verbs +
-- l1_errors; Mandarin: classifiers + aspect_markers + chengyu;
-- Japanese: kanji + particles; Arabic: roots; German: noun_cases).
--
-- Schema versioned via PRAGMA user_version. Bump when adding columns;
-- module.json schemaVersion must match.

PRAGMA user_version = 1;

-- ============================================================
-- words — lemma + pronunciation + glosses + example
-- ============================================================
-- Universal across all languages. Top-N most-frequent lemmas (typically
-- 5k–10k). Powers the "what does X mean" / "how do you say X" path.
DROP TABLE IF EXISTS words;
CREATE TABLE words (
  lemma           TEXT NOT NULL PRIMARY KEY,   -- canonical written form
  pos             TEXT,                        -- noun / verb / adj / adv / prep / ...
  ipa             TEXT,                        -- primary IPA (region-neutral or general)
  ipa_alt         TEXT,                        -- secondary IPA (e.g. UK variant for English)
  glosses_en      TEXT,                        -- "; "-joined English glosses
  example_target  TEXT,                        -- one canonical example in target language
  example_en      TEXT,                        -- English translation of the example
  frequency_rank  INTEGER,                     -- 1 = most common; NULL = unranked
  register        TEXT                         -- formal / informal / slang / archaic / neutral
);
CREATE INDEX words_pos       ON words(pos);
CREATE INDEX words_freq      ON words(frequency_rank);
CREATE INDEX words_glosses   ON words(glosses_en);

-- ============================================================
-- lessons — hand-authored grammar / topic explanations
-- ============================================================
-- The retriever returns these as grounding for the LLM. Body is markdown.
-- l1_notes_json: per-L1 footnotes surfaced when user's L1 matches.
DROP TABLE IF EXISTS lessons;
CREATE TABLE lessons (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  topic           TEXT UNIQUE NOT NULL,        -- snake_case slug
  title           TEXT NOT NULL,
  level           TEXT,                        -- CEFR (A1/A2/B1/B2/C1/C2) or HSK (1-6)
  body_markdown   TEXT NOT NULL,
  related_topics  TEXT,                        -- "," joined topic slugs for cross-linking
  l1_notes_json   TEXT                         -- {"es":"...", "zh":"...", ...}
);
DROP TABLE IF EXISTS lessons_fts;
CREATE VIRTUAL TABLE lessons_fts USING fts5(
  topic, title, body_markdown,
  content='lessons', content_rowid='id'
);

-- ============================================================
-- vocabulary_themes — themed canonical wordlists
-- ============================================================
-- Returned DIRECTLY by the retriever (theme bypass — no LLM call).
-- The LLM hallucinates lists; we have the canonical one.
-- target_word: word in target language (with diacritics / hanzi / script)
-- l1_translations_json: {"es":"comida","fr":"nourriture","zh":"食物",...}
DROP TABLE IF EXISTS vocabulary_themes;
CREATE TABLE vocabulary_themes (
  theme                  TEXT NOT NULL,
  position               INTEGER NOT NULL,
  target_word            TEXT NOT NULL,
  ipa                    TEXT,
  l1_translations_json   TEXT,
  notes                  TEXT,
  PRIMARY KEY (theme, position)
);
CREATE INDEX themes_theme ON vocabulary_themes(theme);

-- ============================================================
-- l1_errors — L1-aware mistake patterns (optional, language-specific
-- to populate but the schema is universal)
-- ============================================================
-- One row per known L1-interference pattern. The retriever scans these
-- WHERE l1_code = user's L1 and returns a targeted correction.
-- error_pattern is a JS-flavored regex (case-insensitive at retrieve time).
DROP TABLE IF EXISTS l1_errors;
CREATE TABLE l1_errors (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  l1_code          TEXT NOT NULL,
  error_pattern    TEXT NOT NULL,
  correct_form     TEXT NOT NULL,
  l1_name          TEXT,
  l1_explanation   TEXT,
  en_explanation   TEXT NOT NULL,
  example_wrong    TEXT,
  example_right    TEXT,
  severity         TEXT,                      -- high / med / low
  lesson_topic     TEXT
);
CREATE INDEX l1_errors_lang ON l1_errors(l1_code);

-- ============================================================
-- idioms — fixed expressions (optional but universal)
-- ============================================================
DROP TABLE IF EXISTS idioms;
CREATE TABLE idioms (
  phrase          TEXT NOT NULL PRIMARY KEY,
  meaning         TEXT NOT NULL,
  literal_en      TEXT,
  example_target  TEXT,
  example_en      TEXT,
  register        TEXT
);
