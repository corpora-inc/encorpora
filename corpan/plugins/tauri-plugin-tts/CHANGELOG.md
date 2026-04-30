# Changelog — `tauri-plugin-tts`

Cross-platform TTS bridge for the Corpán Tauri app. Wraps native iOS
AVSpeechSynthesizer, Android TextToSpeech, and Web Speech API.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.2.0] - 2026-04 — Android TTS onboarding (Corpán 0.11.8 #230)

### Added
- Voice probing + diagnosis API surface for the onboarding flow.
- Engine bind/rebind with retry semantics.
- Engine status reporting (installed / enabled / default).

## [0.1.x] - 2025-12 (Corpán 0.9.7 #192)

### Added
- Keep-alive integration with `tauri-plugin-audio-keepalive` so iOS
  background audio survives the lock screen.

## [0.1.x] - 2025-11 (Corpán 0.9.6 #186)

### Changed
- DB-loading reform integration.

## [0.1.0] - 2025-10 (Corpán 0.9.0 #142)

### Added
- Initial cross-platform TTS plugin.

## Older

See `git log corpan/plugins/tauri-plugin-tts/`.
