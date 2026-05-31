# Changelog — Learning phrase pack

`phrase-learning`. The first Corpán phrase pack. 200 phrases about
curiosity, practice, mentors, discovery, and the real grit of learning
something new. Translated into the full 51-language ALL_LANGUAGES set.

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
- v0.2.0 expansion: +605 new phrases authored across 8 facets
  (curiosity & beginnings, practice & deliberate work, mentors, teachers, & traditions, childhood & how children learn, self-teaching & autodidacts, language learning, memory, attention, & the inner work, the long arc & lifelong learning). New-phrase distribution: A0:7, A1:118, A2:258, B1:58, B2:42, C1:83, C2:39.
- Authored via codex CLI with Gemini Vertex fallback. Voice anchored
  on the existing pack's first 20 phrases.

## [0.1.1] - 2026-05-20
### Added
- Ladder-completion pass: ensure at least one phrase at every CEFR
  level (A0..C2). Added 2 phrase(s) at level(s) A0, C2.
  - A0: "I want to learn."
  - C2: "To learn well is to remain a student of one's own attention, and to forgive the mind its long, uneven pilgrimage from confusion to clarity to deeper confusion of a finer grain."

## [0.1.0]
### Added
- Initial release. 200 English phrases across curiosity, practice,
  skills, mentors, discovery, reading, self-teaching, children, doing,
  language learning, and realistic struggle.
- Translations into all 51 ALL_LANGUAGES codes via parallel codex
  agents with target-language system prompts.
