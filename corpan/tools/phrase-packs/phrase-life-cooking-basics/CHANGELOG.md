# Changelog — Cooking Basics phrase pack

`phrase-life-cooking-basics`. 100 phrases on Cooking, translated into the full 51-language
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
- v0.2.0 expansion: +706 new phrases authored across 8 facets
  (knives, pots, & the working kitchen, eggs, rice, & the daily staples, vegetables, fruits, & the farmer's market, meat, fish, & protein, baking, bread, & sweets, spices, herbs, & global flavors, hosting, feasts, & meals shared, food, memory, & the cook's voice). New-phrase distribution: A0:7, A1:117, A2:262, B1:101, B2:88, C1:92, C2:39.
- Authored via codex CLI with Gemini Vertex fallback. Voice anchored
  on the existing pack's first 20 phrases.

## [0.1.1] - 2026-05-20
### Added
- Ladder-completion pass: ensure at least one phrase at every CEFR
  level (A0..C2). Added 2 phrase(s) at level(s) A0, C2.
  - A0: "I like food."
  - C2: "A kitchen is a long, generous conversation between a cook and the ingredients on the counter, and the meal is the polite agreement they finally reach about how to feed the people in the next room."

## [0.1.0]
### Added
- Initial release. 100 English phrases on Cooking.
- Translations into all 51 ALL_LANGUAGES codes via Gemini 2.5 Flash on
  Vertex AI (corpora1) — parallel via `tools/phrase-packs/gemini_translate.py --vertex`.
- Authored under the `phrase-<domain>-<subject>-<modifier>` namespacing
  convention; listed in the appropriate group of `curation.json`.
