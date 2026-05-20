# Changelog — Health & the Body phrase pack

`phrase-life-health-and-body`. 100 English phrases about doctors, exercise, sleep, recovery, nutrition, and the daily care of a body across a lifetime. Translated into the full
51-language ALL_LANGUAGES set.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.2.0] - 2026-05-20
### Added
- v0.2.0 expansion: +707 new phrases authored across 8 facets
  (the body & its systems, doctors, clinics, & medicine, exercise, fitness, & movement, food, nutrition, & eating, sleep, rest, & recovery, mental health & emotional wellbeing, chronic illness, aging, & long-term care, public health, prevention, & community). New-phrase distribution: A0:7, A1:105, A2:245, B1:127, B2:105, C1:83, C2:35.
- Authored via codex CLI with Gemini Vertex fallback. Voice anchored
  on the existing pack's first 20 phrases.

## [0.1.1] - 2026-05-20
### Added
- Ladder-completion pass: ensure at least one phrase at every CEFR
  level (A0..C2). Added 1 phrase(s) at level(s) A0.
  - A0: "I am tired."

## [0.1.0]
### Added
- Initial release. 100 phrases authored in a single LLM context for
  vocabulary + grammar coherence, distributed A1 15 / A2 35 / B1 18 /
  B2 15 / C1 12 / C2 5 across the CEFR ladder.
- Translations into all 51 ALL_LANGUAGES codes via Gemini 2.5 Flash on
  Vertex AI with per-language self-system-prompt and script/romanization
  guidance.
