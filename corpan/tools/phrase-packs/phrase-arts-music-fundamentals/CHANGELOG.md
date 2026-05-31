# Changelog — Music Fundamentals phrase pack

`phrase-arts-music-fundamentals`. 100 phrases on Music, translated into the full 51-language
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
- v0.2.0 expansion: +705 new phrases authored across 8 facets
  (notes, scales, & the basics of theory, rhythm, meter, & feel, instruments of the orchestra & beyond, composers & the classical tradition, jazz, blues, & American music, rock, pop, & popular music, world music & non-Western traditions, the practice of music: lessons, performance, listening). New-phrase distribution: A0:7, A1:119, A2:267, B1:108, B2:75, C1:90, C2:39.
- Authored via codex CLI with Gemini Vertex fallback. Voice anchored
  on the existing pack's first 20 phrases.

## [0.1.1] - 2026-05-20
### Added
- Ladder-completion pass: ensure at least one phrase at every CEFR
  level (A0..C2). Added 2 phrase(s) at level(s) A0, C2.
  - A0: "I love music."
  - C2: "Music is the public form of an inner argument the species has been having with itself since long before it had words for the argument."

## [0.1.0]
### Added
- Initial release. 100 English phrases on Music.
- Translations into all 51 ALL_LANGUAGES codes via Gemini 2.5 Flash on
  Vertex AI (corpora1) — parallel via `tools/phrase-packs/gemini_translate.py --vertex`.
- Authored under the `phrase-<domain>-<subject>-<modifier>` namespacing
  convention; listed in the appropriate group of `curation.json`.
