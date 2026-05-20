# Changelog — Camping Basics phrase pack

`phrase-life-camping-basics`. 100 phrases on Camping, translated into the full 51-language
ALL_LANGUAGES set.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.1.1] - 2026-05-20
### Added
- Ladder-completion pass: ensure at least one phrase at every CEFR
  level (A0..C2). Added 3 phrase(s) at level(s) A0, A1, C2.
  - A0: "I love the woods."
  - A1: "The fire is warm."
  - C2: "A night in the woods returns the body to a rhythm the city has spent a century quietly persuading it to forget; the stars are unchanged and only our attention has narrowed."

## [0.1.0]
### Added
- Initial release. 100 English phrases on Camping.
- Translations into all 51 ALL_LANGUAGES codes via Gemini 2.5 Flash on
  Vertex AI (corpora1) — parallel via `tools/phrase-packs/gemini_translate.py --vertex`.
- Authored under the `phrase-<domain>-<subject>-<modifier>` namespacing
  convention; listed in the appropriate group of `curation.json`.
