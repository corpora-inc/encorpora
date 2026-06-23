# Changelog — tauri-plugin-asr-native

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **Real native recognizers** (replaces the scaffold stubs). iOS: streaming
  `SFSpeechRecognizer` (`requiresOnDeviceRecognition = true`) driven by an
  `AVAudioEngine` tap — real `capabilities`/`is_available` from
  `SFSpeechRecognizer.supportedLocales()` ∩ our codes + `supportsOnDeviceRecognition`,
  partial-result streaming (`asr://partial`), VU level from buffer RMS
  (`asr://level`), interruption → `asr://error{INTERRUPTED}`, `MIC_DENIED`
  structured error. Audio session is `.playAndRecord` + `.mixWithOthers` +
  `.duckOthers` and is **never deactivated on stop**, so radio-stream's
  `.longForm` reader/radio keeps playing (ducked) through a dictation.
  SpeechAnalyzer/SpeechTranscriber (iOS 26) documented as the preferred path.
  Android: `SpeechRecognizer.createOnDeviceSpeechRecognizer` (API 33+) /
  `createSpeechRecognizer` (≤32) with `EXTRA_PREFER_OFFLINE`,
  `checkRecognitionSupport` for the per-locale availability probe,
  `RecognitionListener` partials + `onRmsChanged` VU + mapped error codes;
  `<queries RecognitionService>` declared (required on API 30+). Out-of-process
  → no process-global lock. `cargo test` green; build.rs trimmed to the 6
  contract commands (events go on the trigger channel, not commands).
- **DEVICE VALIDATION REQUIRED** before ship — see `DEVICE_RUNBOOK.md`. The
  recognition path can only be confirmed on real iOS + Android hardware; the
  iOS/Android device build is OWNER-OWNED.
