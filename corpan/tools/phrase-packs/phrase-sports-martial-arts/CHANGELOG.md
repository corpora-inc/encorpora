# Changelog — Martial Arts phrase pack

`phrase-sports-martial-arts`. 100 English phrases about karate, judo, jiu-jitsu, kung fu, sparring, dojos, belts, and the long disciplines of moving the body well. Translated into the full
51-language ALL_LANGUAGES set.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.2.0] - 2026-05-20
### Added
- v0.2.0 expansion: +404 new phrases authored across 5 facets
  (karate & striking arts, judo, BJJ & grappling, kung fu & internal arts, the dojo & the way, competition & sparring). New-phrase distribution: A0:4, A1:60, A2:140, B1:72, B2:60, C1:48, C2:20.
- Authored via codex CLI with Gemini Vertex fallback. Voice anchored
  on the existing pack's first 20 phrases.

## [0.1.1] - 2026-05-20
### Added
- Ladder-completion pass: ensure at least one phrase at every CEFR
  level (A0..C2). Added 1 phrase(s) at level(s) A0.
  - A0: "I want to learn."

## [0.1.0]
### Added
- Initial release. 100 phrases authored in a single LLM context for
  vocabulary + grammar coherence, distributed A1 15 / A2 35 / B1 18 /
  B2 15 / C1 12 / C2 5 across the CEFR ladder.
- Translations into all 51 ALL_LANGUAGES codes via Gemini 2.5 Flash on
  Vertex AI with per-language self-system-prompt and script/romanization
  guidance.
