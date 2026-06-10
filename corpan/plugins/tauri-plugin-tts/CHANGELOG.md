# Changelog — `tauri-plugin-tts`

Cross-platform TTS bridge for the Corpán Tauri app. Wraps native iOS
AVSpeechSynthesizer, Android TextToSpeech, and Web Speech API.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

### Added
- `synthesize_to_buffer` command: render TTS to a RAW AUDIO buffer WITHOUT
  speaker playback, so a music pack can play captured speech through its own
  Web Audio graph (OS `speak()` ducks other audio and never restores). Returns
  `{ pcmBase64, sampleRate, channels, durationMs, codec, voiceId }`. iOS uses
  `AVSpeechSynthesizer.write` (no audio session ⇒ no ducking); Android uses
  `TextToSpeech.synthesizeToFile`; both emit a 16-bit PCM WAV (`codec: "wav"`).
  Desktop returns an `unsupported` error. Additive — existing `speak`/
  `speak_concurrent`/`stop`/`list_voices` are unchanged. Exposed to packs via
  `hostApi.synthesizeToBuffer` (feature-detected).

### Changed
- `openTtsSettings` (iOS): removed all private Settings URL schemes
  (`prefs:`, `App-Prefs:`, `settings-navigation:`) — every one is rejected by
  iPadOS 26 (`open()` → false, verified on-device) and they're an App Store
  risk. Now opens only `openSettingsURLString` (the app's own page, the sole
  public handle); the app shows the exact Accessibility → Spoken Content →
  Voices path in an interstitial. The official iOS 18 `AccessibilitySettings`
  API has no Voices/Spoken-Content destination, so it isn't used.

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
