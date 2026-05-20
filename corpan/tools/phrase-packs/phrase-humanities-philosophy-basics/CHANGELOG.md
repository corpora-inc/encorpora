# Changelog — Philosophy Basics phrase pack

`phrase-humanities-philosophy-basics`. 100 phrases on Philosophy, translated into the full 51-language
ALL_LANGUAGES set.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.1.1] - 2026-05-20
### Added
- Ladder-completion pass: ensure at least one phrase at every CEFR
  level (A0..C2). Added 4 phrase(s) at level(s) A0, A1, A2, C2.
  - A0: "I think a lot."
  - A1: "I have a question."
  - A2: "A good question takes time to answer."
  - C2: "Philosophy is the long, patient practice of asking the questions a culture has agreed to stop noticing, and of refusing the first easy answer until a more honest one becomes available."

## [0.1.0]
### Added
- Initial release. 100 English phrases on Philosophy.
- Translations into all 51 ALL_LANGUAGES codes via Gemini 2.5 Flash on
  Vertex AI (corpora1) — parallel via `tools/phrase-packs/gemini_translate.py --vertex`.
- Authored under the `phrase-<domain>-<subject>-<modifier>` namespacing
  convention; listed in the appropriate group of `curation.json`.
