# Changelog — `tauri-plugin-haptics`

Native haptic feedback for Corpán: a single fire-and-forget `impact(style)`
command mapping to `UIImpactFeedbackGenerator`/`UINotificationFeedbackGenerator`
on iOS and `Vibrator`/`VibratorManager` predefined effects on Android. Desktop
is a clean no-op.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.1.0] - 2026-06-16

### Added
- Initial plugin. One command — `impact(style)` where `style` is one of
  `light`, `medium`, `heavy`, `success`, `warning`. iOS uses the haptic
  feedback generators on the main thread; Android uses API-aware
  `VibrationEffect` (predefined `EFFECT_TICK`/`EFFECT_CLICK`/`EFFECT_HEAVY_CLICK`
  with one-shot/waveform fallbacks), guarded for devices with no vibrator.
  Desktop is a no-op.

## Older

See `git log corpan/plugins/tauri-plugin-haptics/`.
