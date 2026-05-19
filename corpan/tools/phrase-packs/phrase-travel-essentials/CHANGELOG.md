# Changelog — Travel Essentials phrase pack

`phrase-travel-essentials`. 80 phrases on travel logistics (airports,
hotels, taxis, asking for help, money, food on the road), translated
into the full 51-language ALL_LANGUAGES set.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.1.0]
### Added
- Initial release. 80 English phrases on practical travel.
- Translations into all 51 ALL_LANGUAGES codes via parallel codex CLI
  (`tools/phrase-packs/codex_translate.py`, gpt-5.4 default,
  `--effort low`, read-only sandbox). 342s wall time end-to-end.
- Listed alongside Learning as an onboarding starter pack in
  `tools/phrase-packs/curation.json` (Essentials group).
