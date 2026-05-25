# Changelog — Quest Ear pack

"Quest for the All-Hearing Ear" — narrative game pack. Currently
experimental, not yet featured in the discover panel.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]
### Added
- Full NPC corpus system: multilingual vendor encounters with offering + 3-choice
  response panel (accept / decline / arbitrary), proximity re-trigger, and TTS for
  both NPC dialog and player responses.
- Multi-language rotation across encounters driven by the active stack's languages,
  with a language HUD indicator.
- Riddle NPCs at milestone screens; player-growth mechanic and energy bar tracking
  acceptance progress.
- Exit button (top-right ✕) that stops speech and returns to Corpán.
- `scripts/pack.mjs` + `pack` / `pack:all` npm scripts for sideloadable zip builds.

## [0.1.0] - 2025-11 — NYC action scene + NPC interactions (#139)
### Added
- Initial NYC action scene.
- NPC interaction scaffolding.

## Older

See `git log corpan/packs/quest-ear/` for the prototype's origin.
