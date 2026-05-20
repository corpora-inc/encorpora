# Changelog — Travel Essentials phrase pack

`phrase-travel-essentials`. 80 phrases on travel logistics (airports,
hotels, taxis, asking for help, money, food on the road), translated
into the full 51-language ALL_LANGUAGES set.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.1.1] - 2026-05-20
### Added
- Ladder-completion pass: ensure at least one phrase at every CEFR
  level (A0..C2). Added 3 phrase(s) at level(s) A0, C1, C2.
  - A0: "I want to go."
  - C1: "A long flight returns you to yourself in a slightly different country."
  - C2: "Travel is the rare practice in which the body is asked, with money and inconvenience, to confess what it already half-knew: that the place we live is only one of the many possible answers to the question of how to be a person."

## [0.1.0]
### Added
- Initial release. 80 English phrases on practical travel.
- Translations into all 51 ALL_LANGUAGES codes via parallel codex CLI
  (`tools/phrase-packs/codex_translate.py`, gpt-5.4 default,
  `--effort low`, read-only sandbox). 342s wall time end-to-end.
- Listed alongside Learning as an onboarding starter pack in
  `tools/phrase-packs/curation.json` (Essentials group).
