# Changelog — World Radio pack

Distributed as a Corpán pack via the `encorpora.io` catalog.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.3.1] - 2026-04-30
### Fixed
- Drop stations the current platform can't decode before they reach the list:
  AAC+/AACP on Android Chromium WebView, OGG/Vorbis on Apple, and plain-HTTP
  streams on iOS / iPadOS (ATS).

## [0.3.0] - 2026-04-30
### Changed
- Radio next follow-up (#235): version bump for the post-Narrators polish.

## [0.2.2] - 2026-04
### Changed
- Bundled with the readers + radio polish pass.

## [0.2.x] - 2026-04 — Safe area (#234)
### Fixed
- Safe-area insets on iOS / iPadOS.

## [0.2.x] - 2026-04 (#233 — Narrators in catalog)
### Added
- Initial pack catalog entry alongside the Narrators rollout.

## Older

See `git log corpan/packs/world-radio/` for the pack's origin.
