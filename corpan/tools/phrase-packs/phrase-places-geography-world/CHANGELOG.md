# Changelog — World Geography phrase pack

`phrase-places-geography-world`. 100 phrases on Geography, translated into the full 51-language
ALL_LANGUAGES set.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.2.0] - 2026-05-20
### Added
- v0.2.0 expansion: +707 new phrases authored across 8 facets
  (continents & the great landmasses, countries, capitals, & borders, cities & urban life, rivers, lakes, & freshwater, mountains, deserts, & landscapes, climate, biomes, & weather patterns, migration, language, & cultural geography, travel, exploration, & the maker's map). New-phrase distribution: A0:7, A1:119, A2:276, B1:119, B2:57, C1:90, C2:39.
- Authored via codex CLI with Gemini Vertex fallback. Voice anchored
  on the existing pack's first 20 phrases.

## [0.1.1] - 2026-05-20
### Added
- Ladder-completion pass: ensure at least one phrase at every CEFR
  level (A0..C2). Added 3 phrase(s) at level(s) A0, A1, C2.
  - A0: "Where is it?"
  - A1: "I am from here."
  - C2: "Geography is the slow, patient study of how the shape of the land has quietly negotiated, over centuries, with the people who agreed to call it home, and how each has rewritten the other in the bargain."

## [0.1.0]
### Added
- Initial release. 100 English phrases on Geography.
- Translations into all 51 ALL_LANGUAGES codes via Gemini 2.5 Flash on
  Vertex AI (corpora1) — parallel via `tools/phrase-packs/gemini_translate.py --vertex`.
- Authored under the `phrase-<domain>-<subject>-<modifier>` namespacing
  convention; listed in the appropriate group of `curation.json`.
