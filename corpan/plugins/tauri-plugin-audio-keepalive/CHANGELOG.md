# Changelog — `tauri-plugin-audio-keepalive`

Keeps an audio session alive on iOS so reader narration survives the
lock screen and lets MediaSession controls work from Control Center.
See `memory/webkit-mediasession-anchor.md` for the architecture.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.1.0] - 2026-01 (Corpán 0.10.0 #214)

### Added
- Initial release. Native audio session priming so WebKit MediaSession
  works under lock screen / background.

## [0.0.x] - 2025-12 (#197 / #202)

### Added
- Native audio control plumbing prototyped over multiple iterations.

## Older

See `git log corpan/plugins/tauri-plugin-audio-keepalive/`.
