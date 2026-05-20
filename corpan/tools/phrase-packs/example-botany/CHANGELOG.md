# Changelog — Botany Basics phrase pack

`phrase-botany-basics`. The reference example phrase pack — also a real,
shippable pack. 80 phrases on everyday plant-life (flowers, leaves,
photosynthesis, gardens), translated into the full 51-language
ALL_LANGUAGES set.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.1.1] - 2026-05-20
### Added
- Ladder-completion pass: ensure at least one phrase at every CEFR
  level (A0..C2). Added 2 phrase(s) at level(s) A0, C2.
  - A0: "I like flowers."
  - C2: "A garden is a small experiment in patience, a long correspondence between a gardener and the slow opinions of the soil."

## [0.1.0]
### Added
- Initial release. 80 English phrases on botany.
- Translations into all 51 ALL_LANGUAGES codes via parallel Gemini 2.5
  Flash on Vertex AI (corpora1). 200s wall time, ~$0.70 total cost.
