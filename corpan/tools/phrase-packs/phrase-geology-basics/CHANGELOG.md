# Changelog - Geology Basics phrase pack

`phrase-geology-basics`. A 100-phrase Corpán pack about rocks, minerals,
fossils, volcanoes, earthquakes, rivers, maps, caves, fieldwork, and deep
time.

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
- v0.2.0 expansion: +403 new phrases authored across 5 facets
  (rocks & minerals, plate tectonics & earthquakes, the work of water & ice, fossils & deep time, mountains, deserts, & landscapes). New-phrase distribution: A0:4, A1:70, A2:158, B1:42, B2:49, C1:56, C2:24.
- Authored via codex CLI with Gemini Vertex fallback. Voice anchored
  on the existing pack's first 20 phrases.

## [0.1.1] - 2026-05-20
### Added
- Ladder-completion pass: ensure at least one phrase at every CEFR
  level (A0..C2). Added 2 phrase(s) at level(s) A0, C2.
  - A0: "There is a rock."
  - C2: "A continent is a slow argument the planet has been having with itself for several billion years, in a vocabulary of pressure, heat, and the patient rearrangement of stone."

## [0.1.0]
### Added
- Initial release with 100 English phrases about geology and adjacent
  fieldwork vocabulary.
- Translations into all 51 ALL_LANGUAGES codes via the local Codex
  translation orchestrator.
