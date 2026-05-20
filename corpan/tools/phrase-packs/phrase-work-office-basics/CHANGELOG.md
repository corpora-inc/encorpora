# Changelog — Office Basics phrase pack

`phrase-work-office-basics`. 100 phrases on Office, translated into the full 51-language
ALL_LANGUAGES set.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.2.0] - 2026-05-20
### Added
- v0.2.0 expansion: +403 new phrases authored across 5 facets
  (meetings & calendars, email & written communication, colleagues, managers, & teams, projects, deadlines, & deliverables, the rest of work: lunch, breaks, hybrid life). New-phrase distribution: A0:4, A1:74, A2:161, B1:42, B2:39, C1:59, C2:24.
- Authored via codex CLI with Gemini Vertex fallback. Voice anchored
  on the existing pack's first 20 phrases.

## [0.1.1] - 2026-05-20
### Added
- Ladder-completion pass: ensure at least one phrase at every CEFR
  level (A0..C2). Added 2 phrase(s) at level(s) A0, C2.
  - A0: "I work all day."
  - C2: "An office is the small daily theater in which a culture rehearses its most cherished disagreements about time, attention, hierarchy, and the long compromise between what we are paid to do and what we suspect we were meant to do instead."

## [0.1.0]
### Added
- Initial release. 100 English phrases on Office.
- Translations into all 51 ALL_LANGUAGES codes via Gemini 2.5 Flash on
  Vertex AI (corpora1) — parallel via `tools/phrase-packs/gemini_translate.py --vertex`.
- Authored under the `phrase-<domain>-<subject>-<modifier>` namespacing
  convention; listed in the appropriate group of `curation.json`.
