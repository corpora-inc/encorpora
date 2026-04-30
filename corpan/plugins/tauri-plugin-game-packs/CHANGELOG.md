# Changelog — `tauri-plugin-game-packs`

Native install path for downloadable Corpán packs. Handles zip download,
extraction, manifest parsing, and registration with the app's game
store.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.1.x] - 2025-12 — Stargate reader fix (#190)

### Fixed
- Install regression that broke Stargate Reader unpacking.

## [0.1.0] - 2025-09 — Fully offline packs (Corpán 0.8.8 #130)

### Added
- Initial native install pipeline: download zip, verify, extract,
  register.

## Older

See `git log corpan/plugins/tauri-plugin-game-packs/`. Note: the parent
`CLAUDE.md` describes this as a "legacy plugin" — the MVP install path
goes through it but newer flows can bypass via app-managed installs.
