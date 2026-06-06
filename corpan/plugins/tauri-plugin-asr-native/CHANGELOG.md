# Changelog — tauri-plugin-asr-native

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Initial **contract-conformant scaffold** for OS-native dictation (Apple
  SpeechAnalyzer/SFSpeechRecognizer on iOS, Android SpeechRecognizer). Rust
  bridge (desktop + mobile) re-uses `corpan-asr-contract` structs; command
  surface (`capabilities`/`is_available`/`ensure`/`start_session`/
  `stop_session`/`cancel_session`) matches the frozen contract. Swift +
  Kotlin **stubs** report `is_available=false` (host falls through to a
  downloadable provider or the keyboard — no crash, no fake transcripts) with
  the real-impl path + hard constraints (`.longForm` coexistence, `INTERRUPTED`
  clean-cancel, `MIC_DENIED` launchpad) documented inline as TODOs. `cargo
  test` green (desktop); the real recognizers + a device build are the next
  step (owner-owned). See `docs/STT_MASTERPLAN.md` Phase 1.
