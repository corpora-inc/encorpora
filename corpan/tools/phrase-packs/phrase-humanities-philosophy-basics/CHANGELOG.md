# Changelog — Philosophy Basics phrase pack

`phrase-humanities-philosophy-basics`. 100 phrases on Philosophy, translated into the full 51-language
ALL_LANGUAGES set.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]


## [0.3.0] - 2026-05-31
### Added
- **FTS5 over `entries.english`** (`SCHEMA_VERSION = 2`). Adds a contentless
  `entries_fts` virtual table with BM25 ranking so the Tutomaton phrase-bridge
  (and any future per-phrase-pack search UI) can do fast keyword search instead
  of `LIKE`. Backwards-compatible: schema_version 1 readers see the same
  `entries` + `translations` tables; FTS table sits alongside for v2 readers.

## [0.2.0] - 2026-05-20
### Added
- v0.2.0 expansion: +704 new phrases authored across 8 facets
  (metaphysics & first questions, epistemology: knowledge & doubt, ethics & the good life, philosophy of mind & consciousness, political philosophy & justice, Eastern philosophy & non-Western traditions, 20th-century & modern philosophy, the philosophical life). New-phrase distribution: A0:7, A1:119, A2:279, B1:137, B2:54, C1:69, C2:39.
- Authored via codex CLI with Gemini Vertex fallback. Voice anchored
  on the existing pack's first 20 phrases.

## [0.1.1] - 2026-05-20
### Added
- Ladder-completion pass: ensure at least one phrase at every CEFR
  level (A0..C2). Added 4 phrase(s) at level(s) A0, A1, A2, C2.
  - A0: "I think a lot."
  - A1: "I have a question."
  - A2: "A good question takes time to answer."
  - C2: "Philosophy is the long, patient practice of asking the questions a culture has agreed to stop noticing, and of refusing the first easy answer until a more honest one becomes available."

## [0.1.0]
### Added
- Initial release. 100 English phrases on Philosophy.
- Translations into all 51 ALL_LANGUAGES codes via Gemini 2.5 Flash on
  Vertex AI (corpora1) — parallel via `tools/phrase-packs/gemini_translate.py --vertex`.
- Authored under the `phrase-<domain>-<subject>-<modifier>` namespacing
  convention; listed in the appropriate group of `curation.json`.
