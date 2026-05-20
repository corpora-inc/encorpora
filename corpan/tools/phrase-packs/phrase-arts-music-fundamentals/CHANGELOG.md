# Changelog — Music Fundamentals phrase pack

`phrase-arts-music-fundamentals`. 100 phrases on Music, translated into the full 51-language
ALL_LANGUAGES set.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

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
