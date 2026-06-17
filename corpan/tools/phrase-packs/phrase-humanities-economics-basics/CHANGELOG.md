# Changelog — Economics Basics phrase pack

`phrase-humanities-economics-basics`. 100 phrases on Economics, translated into the full 51-language
ALL_LANGUAGES set.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.3.1] - 2026-06-15
### Added
- Added Tagalog (`tl`), Javanese (`jv`), and Sundanese (`su`) phrase translations, bringing the pack to the current 54-language ALL_LANGUAGES set.


## [0.3.0] - 2026-05-31
### Added
- **FTS5 over `entries.english`** (`SCHEMA_VERSION = 2`). Adds a contentless
  `entries_fts` virtual table with BM25 ranking so the Tutomaton phrase-bridge
  (and any future per-phrase-pack search UI) can do fast keyword search instead
  of `LIKE`. Backwards-compatible: schema_version 1 readers see the same
  `entries` + `translations` tables; FTS table sits alongside for v2 readers.

## [0.2.0] - 2026-05-20
### Added
- v0.2.0 expansion: +401 new phrases authored across 5 facets
  (money & personal finance, work, wages, & jobs, markets, prices, & trade, business & entrepreneurship, the big picture: GDP, growth, recession). New-phrase distribution: A0:4, A1:73, A2:174, B1:84, B2:3, C1:39, C2:24.
- Authored via codex CLI with Gemini Vertex fallback. Voice anchored
  on the existing pack's first 20 phrases.

## [0.1.1] - 2026-05-20
### Added
- Ladder-completion pass: ensure at least one phrase at every CEFR
  level (A0..C2). Added 3 phrase(s) at level(s) A0, A1, C2.
  - A0: "I have a job."
  - A1: "Money is useful."
  - C2: "An economy is the long, mostly invisible conversation a society has with itself about what its people most want, most fear, and are most willing to trade for one another."

## [0.1.0]
### Added
- Initial release. 100 English phrases on Economics.
- Translations into all 51 ALL_LANGUAGES codes via Gemini 2.5 Flash on
  Vertex AI (corpora1) — parallel via `tools/phrase-packs/gemini_translate.py --vertex`.
- Authored under the `phrase-<domain>-<subject>-<modifier>` namespacing
  convention; listed in the appropriate group of `curation.json`.
