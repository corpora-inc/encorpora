# asr-native — device validation runbook (OWNER-RUN)

The native recognizer code is written + `cargo check`/`cargo test` green, but
the actual recognition path can ONLY be confirmed on real hardware. The
iOS/Android device build is the owner's — coordinate before building; this doc
is the exact checklist + what to watch for.

## Build (owner)
- iOS: `npm run tauri ios dev` (or `ios:redeploy` for Swift-only changes) after
  the plugin is registered in `corpan-app/src-tauri/{Cargo.toml,lib.rs}` (the
  integrator's shared-file patch). Mic + speech-recognition usage strings must
  be in `gen/apple/*/Info.plist` (`NSMicrophoneUsageDescription`,
  `NSSpeechRecognitionUsageDescription`).
- Android: a normal `tauri android` build; `RECORD_AUDIO` runtime permission is
  requested at first dictation.

## What to validate (per platform)

### iOS
1. **capabilities()** returns a non-empty `languages` list on the test device
   (the ∩ of our codes with `SFSpeechRecognizer.supportedLocales()`). Expect
   the majors incl. en/es/fr/de/it/ja/ko/zh/ar/he/th.
2. **is_available("ar")**, **("ja")**, **("th")** → `ok:true` on a device with
   those locales (these are the langs that matter most — native covers them
   where the downloadable model is weak).
3. **Dictation**: open a wired field (CR-B), tap mic, speak → partials stream
   into the field, final text on stop. Confidence > 0 when non-empty.
4. **.longForm coexistence (CRITICAL)**: start the radio/reader, THEN dictate.
   The stream must keep playing (ducked) during dictation and return to full
   volume after — it must NOT stop/interrupt. (This is the
   `feedback_reader_audio_interruption_longform` invariant.)
5. **INTERRUPTED**: dictate, then pull Control Center / take a call → the
   session emits `asr://error{INTERRUPTED}` and cancels cleanly (no crash).
6. **MIC_DENIED**: deny mic/speech permission → `asr://error{MIC_DENIED}` and
   the JS launchpad offers "Open Settings" (openSettingsURLString).
7. **iOS 26**: confirm whether SpeechTranscriber gives better results than the
   SFSpeechRecognizer path used here; if so, wire the `#available(iOS 26)`
   branch (currently documented, SFSpeechRecognizer is the shipping impl).

### Android
1. **isRecognitionAvailable** true on the device (needs Google app / a
   RecognitionService; the `<queries>` manifest entry is required on API 30+).
2. **is_available("en")** on API 33+ returns `ok:true` only when the on-device
   language is INSTALLED (`installedOnDeviceLanguages`); `needsDownload:true`
   when supported-but-not-installed. Verify the install state matches reality.
3. **Dictation** partials + final via `RecognitionListener`; **onRmsChanged**
   drives the VU.
4. **Errors**: `ERROR_NO_MATCH`/`SPEECH_TIMEOUT` → `NO_SPEECH`;
   `INSUFFICIENT_PERMISSIONS` → `MIC_DENIED`. Confirm no crash on any
   `onError`.
5. OEM caveat: `createOnDeviceSpeechRecognizer` is solid on Pixel; some OEMs
   lag — note which test devices have it.

## Known code spots that may need a device-driven tweak
- iOS: the final-result timing in `NativeSession.finish()` uses a 0.3 s settle
  before resolving the transcript — tune if finals arrive slower/faster.
- iOS: the RMS→VU scale (`rms * 4`, clamped) is a guess; calibrate against a
  real mic so the meter feels right.
- Android: the `onRmsChanged` dB→0..1 map (`(rmsdB + 2) / 12`) is approximate;
  calibrate.
- The `he`→`iw-IL` (Android legacy Hebrew tag) + `yue-HK`/`yue-CN` locale tags
  may differ per OS version — verify the device accepts them, else adjust the
  map.

Report back: which langs `capabilities()` lists per device, the `.longForm`
result, and any locale-tag mismatches. That closes Phase-1 native validation.
