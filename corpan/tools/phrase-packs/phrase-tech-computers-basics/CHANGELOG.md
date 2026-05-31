# Changelog — Computer Basics phrase pack

`phrase-tech-computers-basics`. 100 phrases on Computers, translated into the full 51-language
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
- v0.2.0 expansion: +400 new phrases authored across 5 facets
  (the device itself, files & the file system, the internet & the browser, apps, accounts, & passwords, everyday troubleshooting). New-phrase distribution: A0:4, A1:73, A2:156, B1:40, B2:44, C1:59, C2:24.
- Authored via codex CLI with Gemini Vertex fallback. Voice anchored
  on the existing pack's first 20 phrases.

## [0.1.1] - 2026-05-20
### Added
- Ladder-completion pass: ensure at least one phrase at every CEFR
  level (A0..C2). Added 4 phrase(s) at level(s) A0, A1, C1, C2.
  - A0: "I use a computer."
  - A1: "The screen is on."
  - C1: "A great engineer keeps a small library of mistakes carefully labeled by year."
  - C2: "A computer is a stack of polite agreements between physics, mathematics, and human impatience, held together by the small daily faith that the next layer will keep its promises to the one above it."

## [0.1.0]
### Added
- Initial release. 100 English phrases on Computers.
- Translations into all 51 ALL_LANGUAGES codes via Gemini 2.5 Flash on
  Vertex AI (corpora1) — parallel via `tools/phrase-packs/gemini_translate.py --vertex`.
- Authored under the `phrase-<domain>-<subject>-<modifier>` namespacing
  convention; listed in the appropriate group of `curation.json`.
