# Changelog — Cars & Driving phrase pack

`phrase-vehicles-cars-and-driving`. 100 English phrases about engines, highways, mechanics, road trips, traffic, and the long modern romance with the automobile. Translated into the full
51-language ALL_LANGUAGES set.

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
- v0.2.0 expansion: +405 new phrases authored across 5 facets
  (the engine & mechanics, driving skills & city traffic, the road trip, car culture & ownership, electric, autonomous, & the future). New-phrase distribution: A0:4, A1:60, A2:141, B1:72, B2:60, C1:48, C2:20.
- Authored via codex CLI with Gemini Vertex fallback. Voice anchored
  on the existing pack's first 20 phrases.

## [0.1.1] - 2026-05-20
### Added
- Ladder-completion pass: ensure at least one phrase at every CEFR
  level (A0..C2). Added 1 phrase(s) at level(s) A0.
  - A0: "I drive a car."

## [0.1.0]
### Added
- Initial release. 100 phrases authored in a single LLM context for
  vocabulary + grammar coherence, distributed A1 15 / A2 35 / B1 18 /
  B2 15 / C1 12 / C2 5 across the CEFR ladder.
- Translations into all 51 ALL_LANGUAGES codes via Gemini 2.5 Flash on
  Vertex AI with per-language self-system-prompt and script/romanization
  guidance.
