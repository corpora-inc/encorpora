# Changelog

All notable changes to this plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Android + iOS: a bare `prepare()` with NO model no longer unloads a bigger
  resident model.** When `prepare()` is called without a `model` and a model is
  already loaded, both platforms now keep the resident model (report it ready)
  instead of resolving the argument to the tiny default (`ggml-tiny.bin`),
  unloading the resident model, and then — because the swap branch dropped it —
  reporting `MODEL_NOT_INSTALLED`. This is the native backstop for the journey
  warm-up recurrence; the JS side also stopped issuing bare prepares. Guard is
  narrow: an explicit model argument is unaffected.

### Changed
- **Android + iOS: model install now verifies bytes on disk instead of
  immediately running a native load test.** Download completion now does
  a durable write/readback barrier, validates ggml magic plus tail
  readability, writes a `ggml-probe-v2` install marker, and leaves native
  initialization to `prepare()`, where memory headroom, fresh-install
  settle timing, and crash breadcrumbs all run in one guarded path. This
  avoids stacking large-model download finalization and whisper.cpp init
  in the same memory-pressure window on first install.

### Added
- **iOS: native-init crash breadcrumbs now match Android's analytics
  path.** A failed previous process load is surfaced once via
  `getStatus().priorInitCrash`.

## [0.5.3] - 2026-06-04 — Truncated-download guard + crash-breadcrumb harvest

### Fixed
- **Android + iOS: truncated-download completeness gate.** The download
  path renamed the `.part`/temp file into place on any non-throwing
  finish — but a clean end-of-stream before the advertised
  `Content-Length` (dropped connection, CDN closing the socket early) is
  a SHORT file with valid ggml magic that then SIGSEGVs deep in
  `whisper_init_state` when native code reads tensor data past EOF. This
  is a likely source of the field `ggml_backend_sched_split_graph`
  crashes that survived the 0.5.1/0.5.2 concurrency fixes. Both platforms
  now compare bytes-received against `Content-Length`
  (`expectedContentLength` on iOS) and fail with a clean, retryable
  `DOWNLOAD_FAILED` on a short read instead of installing a corrupt model.
- **Android: the pre-load ggml magic check now fails CLOSED on a read
  error.** 0.5.2 added the check but failed *open* (a read error let the
  load proceed). That file is about to reach native init, which can't
  defend itself and SIGSEGVs uncatchably on a bad file; reading 4 bytes
  of a local file that exists and is ≥1 MB does not fail transiently, so
  refusing is strictly safer and costs no legitimate loads.

### Added
- **Android: the init-crash breadcrumb is now harvested into on-device
  analytics, not just logged.** The 0.5.2 `STT_INIT_CRASH` breadcrumb was
  `Log.e`-only, which we can't retrieve from a random user's device. It is
  now also held in process-global state and surfaced exactly once via
  `getStatus().priorInitCrash`; the host's getStatus wrapper records it as
  a `stt_init_crash` analytics event, then the native field self-clears.

## [0.5.2] - 2026-06-01 — Process-global native lock + init safeguards

### Fixed
- **Android: native SIGSEGV during model load STILL fired after 0.5.1
  — the lock was per-instance, the corrupt state is process-global.**
  0.5.1's `Mutex` was a `private val` on `SttPlugin`, so it only
  serialized native calls within ONE plugin instance. On Activity
  recreation (process-restore, low-memory restart, or a config change
  outside the app's `configChanges` list) Tauri builds a *second*
  `SttPlugin` with its own mutex while the first instance's init may
  still be running on a blocking JNI thread (cancellation is
  cooperative; JNI ignores it). The two instance-local locks don't
  exclude each other, so the cross-instance `whisper_init_state` race
  kept crashing in the field on builds that already had 0.5.1. The
  lock is now a process-global singleton (`WhisperNative.mutex`), the
  single gate for every native call regardless of instance count.
- **Android: pre-load ggml magic check.** `loadGuarded()` rejects a
  file whose first bytes aren't the ggml magic (a truncated download or
  an HTML error page saved as the model) and returns a clean
  `LOAD_FAILED` instead of handing garbage to native init. Fails open
  on a read error so a transient IO hiccup never blocks a real model.
  (0.5.3 flips this to fail closed.)

### Added
- **Android: native-init crash breadcrumb.** A `.json` breadcrumb is
  written to disk immediately before `nativeInitFromFile` and deleted
  right after. An uncatchable SIGSEGV inside ggml init leaves it
  behind; the next launch logs `STT_INIT_CRASH` with the model,
  instance ordinal, instances-created count, and process uptime — the
  cold-launch-vs-recreate signal the store crash console can't give.

## [0.5.1] - 2026-05-28 — Serialize native whisper calls

### Fixed
- **Android: native SIGSEGV during model load
  (`ggml_backend_sched_split_graph`).** All native whisper.cpp calls
  (init / transcribe / free) now serialize through a single `Mutex`
  in `SttPlugin`. They previously ran unsynchronized on the
  `Dispatchers.IO` pool despite `WhisperContext`'s contract that
  callers serialize: the check-then-act guard in `prepare()` /
  `installModel()` let two rapid calls both launch a load, and
  whisper.cpp + ggml share lazily-initialized, lock-free process
  globals (f16 / type-trait tables, CPU backend registry) that
  corrupt under concurrent init. The same lock closes the
  load-vs-free and free-vs-transcribe use-after-free windows;
  `onDestroy` releases via `tryLock` so teardown never frees a
  context out from under an in-flight transcribe (nor blocks the
  main thread waiting on one). _(Shipped in app 0.15.10 — but see the
  0.5.2 Unreleased entry: this lock was per-instance and the crash
  persisted.)_

## [0.5.0] - 2026-05-19 — Per-call scoring overlay

### Added
- **`scoringParams` field on `startSession`.** Wire-format
  parameter alongside `whisperParams` that lets the pack override
  the native acoustic ramp (`avgZero` / `avgOne` / `minZero` /
  `minOne` / `textFloor`) and compression-ratio gate threshold per
  call. Threaded through Rust (`models.rs::ScoringParams`), Swift
  (`ScoringParamsArg` + `applyScoringOverlay` in
  `STTPlugin.swift`), and Kotlin (`ScoringParamsArg` +
  `Scoring.ScoringOverlay` + overlay-aware `Scoring.computeScores`).
  When the field is absent or empty, every native ramp and gate
  threshold stays exactly as before — backwards-compatible with all
  shipped pack versions. New Swift `Whisper |` log line announces
  when an overlay applies, with the resulting effective ramp values.

## [0.4.1] - 2026-05-17

The "0.4.0's memory gate wasn't enough" point release. May-17
device log capture showed the gate fired on the wrong condition:

1. Pack flow is `stt.unload()` → `stt.prepare(newModel)` as two
   separate JS calls. By the time `prepare()` ran, `loadedModel`
   was already nil and the swap-branch settle code was skipped
   entirely. The new prepare-time pressure-relief + settle never
   executed on the actual user flow.
2. Even if it had executed, the 1.3× available-memory headroom
   multiplier was too tight for the freelist-hoarding case.
   Crash log showed `resident=1880MB available=3339MB` after
   the unload — the C heap was still parked on the previous
   model's 1.55 GB. We passed the gate (3339 > 1.3×1579 =
   2053) then jetsam-killed during the new model's allocation
   when peak resident climbed to ~5040 MB against a ~5220 MB
   budget.

### Changed
- **Settle pattern always runs at the start of `prepare()`**,
  not just inside the swap-branch. So whether the pack pre-unloaded
  in a separate JS call or whether prepare itself detects the swap,
  the malloc pressure-relief + 150 ms page-reclamation settle
  happen before the headroom check. The swap-branch keeps its
  ctx-drop logic for callers that skip the explicit unload.
- **Composite headroom check** replaces the flat 1.3× multiplier.
  New formula projects peak resident as `residentNow + modelSize ×
  2.0` (covers ggml's init double-buffering + per-context working
  memory) and refuses if peak exceeds 85% of the total memory
  budget (`residentNow + availableNow`). Also keeps a flat 1.5×
  available-memory floor as belt-and-suspenders for weird states.
  Distinguishes freelist-hoarding refusals ("restart Corpán to
  clear the allocator") from genuinely-tight-device refusals
  ("close other apps") so the user sees an accurate action.
- **Headroom check log line** gains `residentMB`,
  `projectedPeakMB`, `peakLimitMB`, and `budgetMB` so future
  device-log forensics can reconstruct the exact decision math
  without re-reading the source.

### Added
- **`currentResidentBytes()` helper** wrapping the same
  `mach_task_basic_info` syscall `sttMemSnapshot` uses, factored
  out so the headroom check can read resident memory cheaply.

## [0.4.0] - 2026-05-17

The "model swap won't crash your app" release. Adds end-to-end
memory-headroom protection around `prepare()`'s model swap path,
fixes the StatusResult wire-format gap that was silently dropping
`availableMemoryMB` on the way to JS, and brings the Android side
to parity.

### Added
- **`INSUFFICIENT_MEMORY` structured error code.** Returned from
  `prepare()` when, after unloading the previously-loaded model
  and running malloc pressure relief, the OS still doesn't have
  enough headroom to safely allocate the new model's weights +
  working memory (~1.3× the model file size). Lets the pack route
  the user to "restart the app and try again" instead of
  jetsam-crashing on the next allocation. iOS uses
  `os_proc_available_memory()` as the authoritative measurement;
  Android uses `ActivityManager.MemoryInfo.availMem` (and respects
  the `lowMemory` flag).

### Changed
- **Aggressive pressure relief between model unload + reload.** iOS
  now calls `malloc_zone_pressure_relief(nil, 0)` after the
  `autoreleasepool { ctx = nil }` block, followed by a 150 ms
  settle, before consulting `os_proc_available_memory()`. Without
  this, the C heap holds whisper.cpp's freed weights on its
  freelist and `os_proc_available_memory` under-reports headroom,
  triggering false-positive insufficient-memory refusals.
  Android does `System.gc() + Thread.sleep(150)` for the same
  effect (no malloc-pressure API on Bionic). The settle delay
  surfaces as a brief "Unloading..." beat in the pack's UI — fine
  trade-off for the reliability win.
- **Mirror memory snapshots bracketing the swap** (`sttMemSnapshot`
  on iOS, new `memSnapshot` on Android) so the actual memory
  trajectory of a crash report is reconstructable from device
  logs. Stages: before-unload, after-pressure-relief, after-settle,
  before-load, after-load.

### Fixed
- **`StatusResult` wire-format gap (Rust → JS).** The Rust
  `StatusResult` struct in `src/models.rs` was missing the
  `available_memory_mb` and `physical_memory_mb` fields that the
  iOS and Android plugins were sending. Serde silently drops
  unknown fields on the way through the mobile-plugin
  deserialization boundary, so the pack's `stt.getStatus()` was
  always returning `availableMemoryMB: undefined` on iOS — even
  though the native side computed and emitted the value. This
  meant the pack's UA-based fallback path (`looksIpadByUA`) was
  the actual code path on every device, and the entire
  memory-budget gating story was built on a broken signal. Same
  trap that bit `whisperParams`, `downloadUrl`, and
  `install_progress` before — added field declarations on the
  Rust struct with the `#[serde(default)]` attribute and a
  comment pointing future-us at the pattern.

## [0.3.2] - 2026-05-17

The Parlometron-pairing release: adds the `audio_level` event
stream that powers the pack's silence-detector, the `release_audio`
command for clean pack-close, the `downloadUrl` install field that
unlocks our self-quantized Large q8 model, and an audio-session
correctness fix (release between recordings instead of keeping the
engine warm).

### Changed
- **Release audio between sessions.** `stopSession` and
  `cancelSession` now tear down the audio engine + deactivate
  the AVAudioSession (iOS) / release the AudioRecord (Android)
  immediately after snapshotting the captured samples. We
  previously kept the engine warm across sessions to dodge the
  ~1 s AVAudioEngine startup cost on back-to-back recordings,
  but that left the iOS mic indicator on during scoring and
  result viewing, and held the session in `.playAndRecord +
  .duckOthers` so TTS played softer. Releasing between
  sessions trades the back-to-back latency for indicator-off
  and full TTS volume between mic tries — the user-facing
  correctness wins. If first-word clipping becomes a problem
  again, address it with a background pre-warm tied to
  phrase-load events on the pack side, not by re-introducing
  the always-warm native engine.

### Added
- **`audio_level` event stream.** While a session is recording, the
  native plugin emits a per-buffer `audio_level` event (`{ rms: number,
  t: number }`) at the platform's natural cadence — ~11 Hz on iOS
  (4096-frame tap @ ~48 kHz native), ~8 Hz on Android (2048-frame
  read @ 16 kHz). RMS is computed inside the existing audio tap
  (~5–10 µs/buffer), so there is no additional thread or audio
  session. Subscribe from JS via `addPluginListener('stt',
  'audio_level', ...)`. First consumer is the pronunciation-coach
  pack's silence detector — same pattern can drive future live
  transcription / waveform-viz features. iOS: closure on
  `WhisperManager.audioLevelEmitter`, wired in `STTPlugin.init()`.
  Android: `AudioRecorder.onLevel` callback, wired in `SttPlugin`
  when the recorder is first started.
- **`release_audio` command** — tear down AVAudioEngine /
  AVAudioSession on iOS and AudioRecord on Android. Distinct from
  `cancel_session` (which deliberately keeps the engine warm for
  back-to-back recordings inside one pack session). Packs should
  call `stt.releaseAudio()` from their `unmount` path; without it,
  on iOS the orange mic indicator stays on and `.duckOthers` keeps
  ambient audio softer until the next process kill. Wired through
  `build.rs` COMMANDS allowlist, `permissions/default.toml`,
  iOS `STTPlugin.swift` (`releaseAudio` @objc + `WhisperManager`
  method), and Android `SttPlugin.kt` (`@Command fun releaseAudio`).
- **Custom `downloadUrl` for `installModel`.** iOS `PrepareArgs` and
  Android `InstallArgs` now accept an optional `downloadUrl` field;
  when set, `installModel` downloads from that URL instead of the
  hardcoded `huggingface.co/ggerganov/whisper.cpp/resolve/main/<file>`
  base. Lets the pack ship community / self-quantized model
  variants from our own CDN — first use case is the `large_q8_full`
  variant (full Whisper Large v3 at 8-bit precision, quantized
  ourselves because upstream doesn't publish it).
- **Android mirror of the `whisperParams` plumbing.** Kotlin
  `SttPlugin.kt` gains a `WhisperParamsArg` data class and a
  `whisperParams` property on `StartSessionArgs` — same Gson-drops-
  unknown-fields trap that bit us on the Rust side applies here too,
  so this property has to exist or the override never reaches JNI.
  `WhisperContext.kt`'s `transcribe()` accepts overrides and unboxes
  them to NaN-float / `-1` Int / empty-String sentinels before
  passing into JNI; `nativeFullTranscribe` in `whisper_jni.cpp`
  gains eight new params, applies each via `std::isnan` / tri-state
  checks, and pins the `initial_prompt` UTF chars for the
  `whisper_full` lifetime. End-to-end JS → Rust → Kotlin → JNI →
  whisper.cpp parity with iOS.
- **`initial_prompt` is now part of the wire format on every layer.**
  Rust `WhisperParams.initial_prompt: Option<String>`, Swift
  `WhisperParamsArg.initial_prompt: String?`, Kotlin
  `WhisperParamsArg.initial_prompt: String?`. Applied to
  `params.initial_prompt` in both `WhisperCppContext.transcribe`
  (iOS, with nested `withCString` for C-pointer lifetime) and
  `nativeFullTranscribe` (Android JNI, with `GetStringUTFChars` /
  `ReleaseStringUTFChars` pinning). Most powerful single lever for
  Indic / low-resource languages — biases the decoder's first
  generated tokens toward the prompt's script and vocabulary,
  killing the wrong-script greedy-attractor failure mode (Telugu
  audio decoded as Bengali ৃ-loop on Medium).

### Fixed
- `whisperParams` on `startSession` now actually reaches the native
  plugin. Previous Unreleased entry only added the field on the Swift
  side; the Rust-side `StartSessionArgs` in `src/models.rs` didn't
  declare a `whisper_params` field, and serde silently drops unknown
  fields when deserializing JS args, so the override object never
  made it past the Rust boundary. Added `WhisperParams` mirror struct
  to `models.rs`, threaded it through `commands.rs` and `mobile.rs`,
  added the matching `_whisper_params` arg on `desktop.rs` stub. The
  same gotcha that `PrepareResult`'s docstring warns about for
  response payloads, in the inbound direction.

### Added (initial iOS Swift-side work that this entry supersedes)
- iOS `startSession` now accepts an optional `whisperParams` field
  (camelCase or `whisper_params` snake_case). Each non-null field
  overrides the matching `whisper_full_params` member on top of
  `whisper_full_default_params(GREEDY)`, applied per call inside
  `WhisperCppContext.transcribe()`. Fields exposed: `temperature`,
  `temperature_inc`, `entropy_thold`, `logprob_thold`,
  `no_speech_thold`, `suppress_blank`, `suppress_nst`, `n_threads`.
  Lets the pack disable whisper.cpp's internal temperature-fallback
  loop per language (set `temperature_inc = 0`) — fixes salad output
  on Indic / low-resource languages where the default compression-
  ratio gate trips every call.
- Log line `Whisper | params lang=... temp=... temp_inc=...` emitted
  before each transcribe so the effective params land in the device
  trace alongside the existing sample-count / language lines.

## [0.3.1] - 2026-05-15

### Fixed
- Android `libwhisper-jni.so` is now 16 KB page-aligned. CMake build
  was producing 4 KB segments by NDK 28 default while every other
  native lib in the AAB was correctly 16 KB-aligned (Rust via
  `src-tauri/.cargo/config.toml` rustflags from 0.7.8, libc++_shared
  via NDK). Added `target_link_options(whisper-jni PRIVATE
  -Wl,-z,max-page-size=16384 -Wl,-z,common-page-size=16384)` to
  `android/src/main/cpp/CMakeLists.txt`. Resolves Play Console's
  "your app does not support 16 KB memory page sizes" warning that
  hit on 0.12.7 (and would have become a hard upload rejection
  per Google's May 1 2026 enforcement deadline).
- Native debug symbols actually flow to Play Console. Two-part fix:
  CMake `-g -fno-omit-frame-pointer` (added in 0.3.0 but never
  reached the AAB), plus the main app's release `build.gradle.kts`
  switched from `debugSymbolLevel = "FULL"` to `"SYMBOL_TABLE"` —
  FULL appeared to interact poorly with AGP 8.11 + NDK 28 + the
  universal flavor, leaving `BUNDLE-METADATA/com.android.tools.
  build.debugsymbols/` empty in the produced AAB. SYMBOL_TABLE is
  the format Play actually uses for crash symbolication. Future
  ANRs and native crashes in whisper.cpp / ggml territory will
  come through pre-symbolicated.

## [0.3.0] - 2026-05-12

Substantial release: Android STT plugin debut (full whisper.cpp JNI
port), iOS runtime swap from WhisperKit to whisper.cpp, Android CPU
perf flags, and a pass of scoring fixes informed by live testing.

### Fixed
- **Scoring: pure-punctuation tokens no longer poison
  `tokenLogprobStdev` OR the per-word probability average.** Two
  related leaks on both platforms:
  - The per-token logprob list (used for the stdev calculation) was
    unconditionally accumulating every token, including ".", ",",
    "!", "?", and the inline punctuation Whisper emits. Their
    logprobs sit in a wildly different range from word tokens,
    inflating stdev and falsely triggering the `acoustic *= 0.5`
    penalty in `computeScores`.
  - The per-word probability rollup skipped *pure-punctuation
    words* at flush time, but Whisper often appends a punctuation
    token onto the previous word (no leading space) — e.g. "gusto!"
    came through as one word grouping tokens `[gusto 0.97, ! 0.38]`,
    averaging to 0.68 instead of 0.97. The punctuation prob inside
    the word was real, measurable damage on clean speech
    (live-observed dragging `acoustic` from 1.00 down to ~0.68 on
    "Mucho gusto!").
  Both leaks fixed by gating the `.append`s on a letter/digit
  presence check at the token loop. The displayed word string still
  includes punctuation (used in "Heard you say" UI); only the
  numeric score inputs ignore it. Fixed on iOS (`STTPlugin.swift`
  token loop) and Android (`SttPlugin.kt` `collectResult`).
- **Scoring: numeral words excluded from the acoustic-score
  per-word probs.** Per-word probabilities under the constrained
  decode are unreliable for numerals: if the corpus says "Tengo 10
  años" and the user says "diez", `prefixTokens` forces the "10"
  token at decode and its probability reflects "audio match for the
  literal token '10'" rather than "did the user say the right
  number?" Transcript scoring already handles `diez` ↔ `10` via
  `normalize`'s number-word dict; the acoustic layer now opts out of
  the digit/word ambiguity via a new
  `isUncertainNumeralWord(word, lang)` helper that returns true when
  the word normalizes to pure digits (catches both "10" and
  number-word forms like "diez", "noventa", "neunzig" in one shot).
  Helper is in `Scoring.kt` on Android and `STTPlugin.swift` on iOS,
  with the filter applied at the `wordProbs` build site.

### Changed
- **Android: `+dotprod` added to the arm64-v8a `-march` flag.** Was
  `-march=armv8.2-a+fp16`, now `-march=armv8.2-a+fp16+dotprod`. Unlocks
  the dotprod-accelerated `vec_dot_q*_q8_0` kernels in
  `ggml-cpu/arch/arm/quants.c` (gated behind `__ARM_FEATURE_DOTPROD`).
  Verified via `.cxx` `compile_commands.json` that `quants.c` and
  `ggml-quants.c` both compile with the new flag. The `+dotprod` ARM
  extension is ARMv8.2-A and is supported on every device our `+fp16`
  target already covers (Cortex-A75+, Snapdragon 8-series, ~2018+
  phones), so no minSdk impact.

### Added
- **Android: `whisper_print_timings()` log after every transcribe.**
  Prints per-phase ggml compute time (load / mel / sample / encode /
  decode / batchd / total) to stderr after each `whisper_full` returns.
  Routes through `RustStdoutStderr` into logcat — grep for
  `whisper_print_timings:` to capture. One line of JNI, no behavioral
  change, makes future CPU tuning measurable.

### Performance notes (Snapdragon 8 Elite, S25 Ultra, post-`+dotprod`)

Live-measured wall time per `whisper_full` encoder pass, single-greedy
decode, perf-core threading:

| Model | encode/pass | decode/token |
|---|---|---|
| `ggml-small.bin` (fp16) | ~6.0 s | ~7 ms |
| `ggml-large-v3-turbo-q5_0.bin` | ~14.8 s | ~7 ms |
| `ggml-large-v3-turbo-q8_0.bin` | **~6.0 s** | ~19 ms |

**Headline finding**: Large Turbo q8 encoder lands in the same wall-time
envelope as Small fp16 on this hardware, despite being ~2× the model
size. Reason: with `+dotprod`, q8_0 × q8_0 vec_dot runs as a direct
UDOT/SDOT chain — no unpacking. q5_0 has to unpack 5-bit nibbles into
int8 before the same UDOT, and that overhead lives inside every
encoder matmul. The 287 MB download premium over q5_0 turbo buys you
~2.5× faster encoder and a noticeably better model.

For Pronunciation Coach scoring (which calls `whisper_full` twice per
mic tap — constrained + free decode), Large q8 turbo total wall time
≈ 2 × 6 s ≈ 12 s — comparable to Small but with Large-class
multilingual quality.

Encoder remains the wall on CPU; dotprod's biggest impact is on the
per-token decode path, where it makes q8 specifically much cheaper.
No regression on fp16 models (Tiny / Small / Medium / Full Weight
Large Turbo) — those don't use the dotprod kernels.

`+i8mm` (ARMv8.6-A int8 matrix multiply) is NOT enabled. Bigger
potential win for q4/q5/q8 but only on Snapdragon 8 Gen 1+ (2022+
phones); enabling in a single-variant build would SIGILL on older
hardware. Defer until we either bump minSdk or wire ggml's
multi-variant runtime selection. Encoder dominance suggests the
incremental gain would be modest anyway — future investigation if
needed.

### Added
- **Android: Phase 0 of the whisper.cpp port** — model load + download,
  no audio capture yet.

  - `src/main/cpp/whisper_jni.cpp` — JNI shim wrapping
    `whisper_init_from_file_with_params` / `whisper_free` /
    a version smoke test.
  - `src/main/cpp/CMakeLists.txt` — externalNativeBuild config that
    compiles whisper.cpp v1.8.4 (vendored under
    `src/main/cpp/whisper.cpp/`, gitignored) plus the JNI shim into
    a single `libwhisper-jni.so`. CPU-only for now (Metal off, OpenCL
    off, Vulkan off, OpenMP off, BLAS off). arm64-v8a only.
  - `WhisperContext.kt` — Kotlin wrapper that mirrors the Swift
    `WhisperCppContext` actor. Holds the opaque `whisper_context*` as
    a `Long`, exposes `load()` / `release()`, smoke-tests the JNI link
    via `nativeVersion()`.
  - `SttPlugin.kt` — rewritten from the all-rejecting stub to a
    Phase 0 surface: `isAvailable` → true, `getStatus` returns device
    memory + loaded-model state, `installModel` does single-file
    OkHttp download from the same HF base URL the iOS side uses
    (`huggingface.co/ggerganov/whisper.cpp/resolve/main/<file>`),
    `prepare` calls into `WhisperContext.load`, `validateModel` /
    `listInstalled` / `wipeModel` / `unload` round out the
    file-management commands. `startSession` / `stopSession` /
    `cancelSession` still reject with a clear "Phase 1" message.
  - `AndroidManifest.xml` — INTERNET (model downloads) + RECORD_AUDIO
    (Phase 1) permissions added.
  - `build.gradle.kts` — externalNativeBuild + OkHttp + coroutines
    deps; abiFilters = arm64-v8a only.

  Phase 1 (next): AudioRecord pipeline → 16 kHz f32 mono, full
  transcribe + per-token timing, scoring math mirrored 1:1 from the
  Swift side.

### Changed
- **Runtime swapped from WhisperKit to whisper.cpp.** `STTPlugin.swift`
  rewritten end-to-end against the `whisper` C module from the official
  `whisper-v1.8.4-xcframework.zip` release asset on
  `ggml-org/whisper.cpp`. New `WhisperCppContext` actor wraps
  `whisper_init_from_file_with_params` + `whisper_full`. `Package.swift`
  drops the `argmaxinc/WhisperKit` SPM dep in favor of a `binaryTarget`
  pointing at the XCFramework (sha256
  `1c7a93bd20fe4e57e0af12051ddb34b7a434dfc9acc02c8313393150b6d1821f`).

  Why: every WhisperKit large-v3 variant is broken on iPadOS 26.4.x in
  one of two distinct Apple compiler bugs (compile-time error -14 or
  predict-time `MPSGraphTensorData initWithMTLBuffer` SIGABRT). See
  `memory/feedback_whisper_ipados26_mps_crash.md` for the full failure
  matrix. whisper.cpp ships its own Metal compute shaders and does NOT
  route through MPSGraph — same Metal hardware, different code path
  that the regression doesn't touch.

  JS API contract preserved: every plugin command name + arg shape
  + payload field is unchanged, so pronunciation-coach 0.3.x JS works
  without modification.

  Phase 1 (this entry) is a proof-of-concept. Several scoring inputs
  WhisperKit surfaced as first-class (`noSpeechProb`,
  `compressionRatio`, `temperature`, per-word timings) get sane
  defaults until Phase 2 wires them through whisper.cpp's per-token
  data + token timestamps. Single decode pass instead of dual
  constrained+free; `freeVsConstrainedSimilarity` collapses to 1.0.

- **Model storage layout:** moved from
  `Documents/huggingface/models/argmaxinc/whisperkit-coreml/<name>/`
  (multi-file `.mlmodelc` bundle) to `Documents/whisper-cpp/models/<name>`
  (single `.bin` file). Old WhisperKit installs become orphans on disk;
  cleanup is deferred. Install marker file pattern under
  `Documents/.pronunciation-coach/installed/<name>.marker` is unchanged.

- **Install:** `WhisperKit.download(variant:)` replaced with a single
  `URLSession` download from `https://huggingface.co/ggml-org/whisper.cpp/resolve/main/<filename>`.
  `URLSessionDownloadDelegate` reports byte-level progress mapped onto
  the existing `InstallProgressPayload` shape.

### Removed
- `loadKitWithComputeFallback` and the CPU+GPU → CPU-only fallback
  path. whisper.cpp doesn't have CoreML's error -14 problem, and
  flash_attn / use_gpu are simple struct fields rather than typed
  enums. The decision tree collapses to a single `WhisperCppContext.load(path:)`.
- `isComputeBackendError`, `isTransientMmapError` — both were
  WhisperKit / CoreML specific symptoms.
- The `.mlmodelc` directory tree validation in `validateModel` —
  replaced with a single-file existence + size check.
- The atomic-staging install pattern (move-aside / rollback). Single
  `.bin` files are atomic by construction; on failure we just remove
  the partial file.

## [0.2.3] - 2026-05-07

This release is the consolidated state of an intense same-day
iteration cycle (0.2.0 → 0.2.3) tested live against iPhone 17 Pro
Max + iPad over many hours. The intermediate version bumps were
mostly cache-busts to force Cargo to re-pick up Swift edits;
0.2.3 is the actual shippable plugin behind Corpán 0.12.5.

### Fixed
- **Model-switch OOM via `prepare()` chain serialization.** Two
  concurrent `prepare()` calls (e.g., boot's prepare + a
  setup-overlay switch landing while the boot load is still in
  flight) used to spawn parallel `Task { try await
  WhisperKit(...) }` allocations and stack model memory, OOM-
  killing the app even when each model fit individually. Every
  `prepare()` now appends to a `prepareChain: Task<Void, Never>`
  and awaits the previous tail before doing any work. After the
  await it re-checks state and either short-circuits ("already
  loaded") or runs its load. At most one WhisperKit allocation in
  flight at a time. New trace line: `Whisper | prepare queueing
  behind in-flight load: <model> (requested: <other-model>)`.
- **Transient `Unable to mmap` failures on consecutive loads of
  the same model.** A successful install-time load test followed
  ~30 ms later by a runtime prepare for the same file can fail
  with an mmap error because CoreML/kernel hasn't released the
  prior mapping. `loadKitWithComputeFallback` now retries on the
  "Unable to mmap" / "Error parsing MIL model" pattern with
  250 ms / 750 ms exponential backoff (up to 3 total tries),
  bounded so genuine corruption still fails fast.
- **CPU-only compute fallback for CoreML error -14.** Some Apple
  Silicon chips fail to compile a CoreML execution plan for
  `large-v3-turbo`'s decoder graph on `.cpuAndGPU` and surface
  as `error code: -14`. `loadKitWithComputeFallback` detects the
  pattern (`"execution plan"`, `"could not build the model"`,
  `"error code: -14"`) and retries with `.cpuOnly`. Slower but
  works on every iPad we ship to. Network and missing-file errors
  bubble up immediately without a fallback attempt.
- **`unload()` wraps the kit drop in `autoreleasepool`** so CoreML's
  MLModel weight buffers release immediately rather than at some
  deferred ARC moment.

### Added
- **Memory snapshot logging at every load/transcribe boundary.**
  New helper `sttMemSnapshot(tag:)` logs resident memory and
  `os_proc_available_memory()` at: prepare entry, prepare loaded,
  after unload, transcribe entry, transcribe done. Format:
  `Whisper | mem [<tag>] resident=NMB available=NMB`. Lets us
  diagnose future memory issues by reading numbers off the log.
- **`getStatus()` exposes `availableMemoryMB` and `physicalMemoryMB`**
  on the response payload (iOS 13+, from
  `os_proc_available_memory()` and `ProcessInfo.physicalMemory`).
  Returns a plain `[String: Any]` Dictionary rather than the
  Encodable `StatusPayload` struct because Tauri's iOS
  `Invoke.resolve` was observed silently dropping newly-added
  Optional fields when serializing structs. Dictionary path goes
  through `JSONSerialization` directly with no reflection
  ambiguity.
- **Android stub module** (`android/build.gradle.kts` +
  `SttPlugin.kt`) so `gradlew :app:assembleRelease` can resolve
  the `:tauri-plugin-stt` project dependency. The plugin is
  iOS-only at runtime; every Android command rejects with
  "STT not supported on Android" or returns a feature-detection
  no (`isAvailable: false`, `listInstalled: []`).

### Changed
- **`build.rs` declares `cargo:rerun-if-changed=ios` and
  `=android/src`** so Cargo detects Swift / Kotlin source edits
  and re-runs the plugin build script. Without this, Cargo
  previously skipped recompiling the plugin even when the Swift
  changed, which manifested as "I rebuilt 100 times and nothing
  changed" — fixed permanently.

### Reverted (within the same iteration)
- Tried `prewarm: false` on runtime prepare to defer CoreML
  compile from load-time to first-transcribe time. Reshaped
  runtime behavior in ways that regressed models that previously
  worked. Reverted to `prewarm: true`.
- Tried serializing the dual decode (constrained then free) to
  halve peak memory. Changed CoreML scheduling in ways that
  interacted poorly with quantized variants. Reverted to the
  original concurrent `withThrowingTaskGroup` form with shared
  timeout race.

The structural fixes (chain serializer, mmap retry, autoreleasepool,
memory snapshots, compute fallback, `getStatus` payload, Android
stub, build-script directives) all stay. Only the runtime-shape
experiments (prewarm and serial decode) were reverted.

## [0.2.2] - 2026-05-07

### Reverted
- **`prewarm: false` on runtime prepare → reverted to `prewarm: true`.**
  Briefly tried this as a memory micro-optimization (defer CoreML
  compile from load-time to first-transcribe time). It reshaped
  runtime behavior in ways that hurt on models that previously
  worked. Restored the original prewarm-at-load behavior across
  the runtime prepare path and both install-failure restore paths.
  First transcribe is cheap again.
- **Serial dual-decode → reverted to parallel TaskGroup.** The
  original concurrent form was what worked before. Forcing
  constrained-then-free serial may have changed CoreML scheduling
  in ways that interacted poorly with quantized variants. Restored
  the parallel form with shared timeout race.

The chain serializer (preventing two concurrent `prepare()` calls
from stacking model allocations), `autoreleasepool` around kit
drops, mmap retry, and memory snapshot logging all stay — those
are structural fixes, not runtime-shape changes.

### Added
- **`getStatus()` returns memory budget data.** Two new fields on
  `StatusPayload`: `availableMemoryMB` (per-app jetsam budget from
  `os_proc_available_memory()`, iOS 13+) and `physicalMemoryMB`
  (total device RAM from `ProcessInfo.processInfo.physicalMemory`).
  Used by the pack to gate memory-hungry models on devices with
  iPhone-class budgets, regardless of what `navigator.userAgent`
  claims about iPad-vs-iPhone.

### Fixed
- **Transcribe-time OOM crash on iPhone with quantized large
  models, take 2 — serial dual-decode.** The previous theory
  (prewarm on prepare being responsible) was wrong on its own. With
  `prewarm: false` on prepare, the same crash reproduced
  immediately on the 632 MB Large Turbo (Mobile) variant during
  the very first transcribe. Live trace showed the app dying
  mid-transcribe with 4386 MB available at entry — confirming the
  burst exceeded 4 GB even with no prewarm.

  Real root cause: the dual decode (constrained + free passes,
  used for honest scoring) ran both passes **concurrently** in a
  `withThrowingTaskGroup`. On a large model that put TWO decoder
  activation tensor sets live in GPU/ANE memory at the same time —
  roughly 2× peak memory of a single decode. The original code
  even noted "we pay ~2× transcribe latency for this," meaning the
  parallel form wasn't even giving a wall-clock speedup (the GPU
  is shared, both passes serialize on it under the hood). Cost of
  the concurrency was pure: doubled peak memory for no
  throughput win.

  Decodes now run **in series** — constrained first, then free —
  with the same per-pass timeout race. Peak memory during
  transcribe approximately halves; wall-clock cost is unchanged.
  Two new memory snapshots (`transcribe-constrained-start`,
  `transcribe-free-start`) make the new shape visible in trace.

- **Transient `Unable to mmap` failures on consecutive loads of
  the same model.** Live trace showed `LOAD_FAILED` (mmap
  error on `weights/weight.bin`) on a prepare that ran ~30 ms
  after a successful install-time load test of the same file.
  Same model loaded fine ~10 s later. The mmap failure is a
  short-lived resource issue (CoreML / kernel hasn't released
  the prior mapping yet); it's not corruption. `loadKitWithComputeFallback`
  now retries on the "Unable to mmap" pattern with 250 ms / 750 ms
  exponential backoff (up to 3 total tries), bounded so a genuinely
  unreadable file still fails fast. Genuine corruption fails on
  every retry and surfaces LOAD_FAILED as before.

- **Prewarm: false on the runtime prepare path** (kept from the
  earlier theory — still a memory win even though it wasn't the
  full story). Install-time load test still uses `prewarm: true`
  so we verify the model compiles end-to-end on the device before
  declaring the install successful. The two install-failure
  restore paths also use `prewarm: false` since by the time we
  reach those, the device is already memory-pressured.

### Added
- **Memory snapshot logging at every load/transcribe boundary.**
  New helper `sttMemSnapshot(tag:)` logs resident memory and
  `os_proc_available_memory()` (iOS's "headroom before jetsam"
  estimate) at: prepare entry, prepare loaded, after unload,
  transcribe entry, transcribe done. Format:
  `Whisper | mem [<tag>] resident=NMB available=NMB`. Lets us
  diagnose future OOM crashes by reading numbers off the log
  instead of guessing from process death.

## [0.2.1] - 2026-05-07

### Fixed
- **Model-switch OOM crash on iPhone.** `prepare()` had no in-flight
  serialization — every call unconditionally spawned a fresh
  `Task { try await loadKitWithComputeFallback(...) }`. When two
  prepares arrived close together (e.g., boot's prepare still
  loading when a setup-overlay switch fired), both Tasks ran their
  CoreML allocations in parallel, peaking at `(old + new)` resident
  memory and tripping iOS jetsam on iPhones even when each model
  fit individually. Live trace evidence:

  ```
  12:35:19  prepare requested: large-v3_turbo
  12:35:19  loading model from disk: large-v3_turbo
  12:35:28  prepare requested: base       ← second prepare 9s later
  12:35:28  loading model from disk: base ← runs concurrently
  12:35:34  loaded ok: base
  12:35:35  loaded ok: large-v3_turbo     ← both kits resident
  ```

  Two `loading model from disk` lines back-to-back with no
  intervening unload.

  Fix: every `prepare()` now appends to a `prepareChain: Task<Void,
  Never>` and awaits the previous tail before doing any work. After
  the await, it re-checks whether the requested model is now loaded
  (a previous chain entry may have just loaded it for us) and
  short-circuits if so. Otherwise it drops the previous kit
  (in `autoreleasepool` so CoreML's MLModel can release its
  memory-mapped weight buffers immediately) and runs its own load.
  Net effect: at most ONE WhisperKit allocation in flight at a
  time. Concurrent prepares queue cleanly. Switch-during-load adds
  a few seconds of latency but never crashes.

  Also: a new log line — `Whisper | prepare queueing behind
  in-flight load: <model> (requested: <other-model>)` — makes the
  serialization visible in trace.

### Changed
- **`unload()` wraps the kit drop in `autoreleasepool`** so the
  Obj-C autorelease drain fires immediately, not at some deferred
  ARC moment. Without this, a subsequent `prepare()` could begin
  allocating a new kit before CoreML had actually released the
  previous one's memory.

## [0.2.0] - 2026-05-06

### Added
- **Android stub module** (`android/build.gradle.kts` + `SttPlugin.kt`)
  so `gradlew :app:assembleRelease` can resolve the
  `:tauri-plugin-stt` project dependency. The plugin is iOS-only at
  runtime; every command on Android either rejects with "STT not
  supported on Android" or returns a feature-detection no
  (`isAvailable: false`, `listInstalled: []`). Pronunciation-coach
  is gated to `platforms: ["ios"]` in the catalog, so these stubs
  are never invoked at runtime — they only exist so the Android
  release variant resolves and the Android APK build can complete.

### Changed
- **CoreML compute-backend fallback to CPU-only on error -14.**
  Even with `.cpuAndGPU` for both encoder and decoder, certain iPad
  chips still fail to compile a CoreML execution plan for
  `large-v3-turbo` and surface as `"Failed to build the model
  execution plan ... error code: -14"`. Reinstalling didn't help
  (the bytes were fine — it's an MLProgram backend bug). The plugin
  now wraps all WhisperKit loads in `loadKitWithComputeFallback`,
  which on a compute-backend error specifically (matched on
  "execution plan" / "could not build the model" / "error code: -14"
  patterns) automatically retries with `.cpuOnly`. Pure-CPU is
  noticeably slower but works on every iPad we ship to. Affected
  devices keep working without ever surfacing the Reinstall loop
  caused by what was actually a backend bug. Network and
  file-not-found errors bubble up immediately without a fallback
  attempt.

### Changed
- **Model lifecycle rebuilt — no more error-driven auto-wipe.** Two
  reproducible failures motivated the rewrite: (1) "Could not load
  Advanced model: Model not installed" appearing right after a
  successful install, and (2) leaving the pack and returning leaving
  Standard no longer installed. Root cause was the JS `looksCorrupt`
  substring predicate matching `"timed out"` and triggering `wipeModel`
  on any transient timeout — CoreML slow first-compile, app suspended
  mid-transcribe, tokenizer fetch hiccup during prepare(). The fix:
  - **Structured error codes.** Every plugin failure carries a stable
    code (`MODEL_NOT_INSTALLED`, `NETWORK`, `LOAD_FAILED`, `IO_FAILED`,
    `BUSY`, `CANCELLED`, `MIC_PERMISSION_DENIED`, etc.) emitted as
    `"CODE: human-readable description"` (matching the convention used
    by tauri-plugin-iap). The host-app bridge parses the prefix and
    attaches `error.code` to thrown errors. Packs route on code, never
    on message substring.
  - **`listInstalled({ models: [...] })` command.** Single round-trip
    that returns disk-truth validation state for every requested
    variant. Boot calls it once instead of N×`validateModel`.
  - **Atomic install.** `installModel` now stages the existing on-disk
    install aside before WhisperKit.download writes new files, then
    validates and either commits (drop the rollback target) or rolls
    back (restore the previous install, remove the partial download).
    A failed install never corrupts the previous working install.
  - **`unload()` command.** Drops the in-memory WhisperKit instance
    without touching disk — for memory-warning hooks. Next prepare()
    is a load, not a download.
  - **No more `looksCorrupt` heuristic on transcribe error.** The
    in-memory kit is no longer dropped on substring matches like
    "timed out" or "weight.bin". If on-disk bytes are genuinely bad,
    the next prepare() returns LOAD_FAILED and the pack surfaces a
    Reinstall prompt — the user, not a substring match, decides
    whether to delete files.

- **Phase 1 of pronunciation-scoring rethink: mine WhisperKit properly.**
  Single-pass Whisper scoring was leaning entirely on `avgLogprob` and
  per-word `probability`, which let `large-v3-turbo`'s LM prior recover
  a "correct" transcript from cadence-only nonsense (FR/ES "got away
  with murder") and intrinsically misranked low-resource Telugu.
  Several signals now flow into the score:
  - **Per-segment quality signals** (`noSpeechProb`, `compressionRatio`,
    `temperature`) read from every `TranscriptionSegment`. `noSpeechProb
    > 0.5` becomes a hard early-exit "Couldn't hear you" gate (no score
    breakdown, doesn't reset streak). `compressionRatio > 2.4` caps
    overall ≤ 0.4 (Whisper's own gibberish threshold). `temperature > 0`
    (decoder fell back from greedy) multiplies acoustic by 0.8.
  - **Per-token logprobs** (`segment.tokenLogProbs[i][segment.tokens[i]]`)
    aggregated to `minTokenLogprob` and `tokenLogprobStdev`. High stdev
    (> 0.8) — confident on some tokens, lost on others — is an honest
    pronunciation problem and halves acoustic.
  - **Free-vs-constrained dual decode.** Whisper is now run twice on
    the same audio: once with `prefixTokens` set to the encoded
    expected text (constrained), once with no bias (free). Levenshtein
    similarity between the two transcripts becomes
    `freeVsConstrainedSimilarity`; < 0.6 means the prior was rescuing
    weak audio and halves acoustic. Cost is ~2× transcribe latency;
    encoder-shared optimization (run audio encoder once, decoder
    twice) is a follow-up if latency proves user-visible.
- **Switched from `promptTokens` to `prefixTokens` for constrained
  decode.** `promptTokens` is conversation-context-style soft bias;
  `prefixTokens` is appended after SOT/lang/task prefill and feeds
  directly into the output sequence, giving us per-token logprobs
  against the *expected* text rather than against whatever Whisper
  would have free-decoded.
- **Free decode now drives `transcriptScore` directly.** The
  constrained pass matches expected almost by construction (prefix
  forces it), so its similarity to expected was a near-useless
  signal that the score was leaning on. `transcriptScore` is now
  `min(sim(constrained, expected), sim(free, expected))` — a strong
  free match ratifies the constrained match; a weak free match (the
  prior is rescuing rhythm-only mispronunciation) drags the score
  down directly. Real case that motivated this: expected "Necessito
  la clau" → constrained heard "Necessito la clau" (prior-rescued)
  while free heard "Necessita le cli" (~0.76 similarity), and the
  user got 100% "Nailed it" for an intentional mispronunciation.
- **Acoustic penalty for free-vs-expected divergence is now a smooth
  band**, not a binary `<0.6 → ×0.5` cliff. Multiplier curve: sim
  1.0 → ×1.0, 0.85 → ×0.90, 0.70 → ×0.70, 0.60 → ×0.55, 0.40 →
  ×0.35, 0.0 → ×0.20 floor. Penalty now bites in the 0.7–0.85 range
  where the old cliff was silently letting prior rescue through.
- **CoreML load test is resilient to flaky-network tokenizer fetches.**
  WhisperKit's `loadTokenizerIfNeeded` falls back to fetching the
  tokenizer from the openai/<variant> repo on Hugging Face when no
  local `tokenizer.json` is present (the argmaxinc/whisperkit-coreml
  repo we download from doesn't include one). On a slow / flaky
  connection that fetch times out and the install path was wiping the
  whole model — forcing the user to re-download 150 MB / 1.6 GB even
  though the model bytes were perfectly fine. Now the post-download
  load test retries up to 3 times with 2s/4s backoff on network errors,
  and on final failure the network case surfaces a friendly "couldn't
  fetch the tokenizer" message and DOES NOT wipe the model. CoreML
  errors still trigger a wipe (those mean the download was actually
  truncated).
- **Word-level similarity now drives transcript scoring alongside
  character-level.** The Spanish complaint case: user mispronounced
  "Si comes bien, te sentirás más saludable" → free decode
  "sitcoms been t centuris miss saludable". Char-level Levenshtein
  reads ~0.6 (accidental letter overlap inflates the score) but
  word-level reads ~0.2 (only 1 of 8 words actually matched).
  `transcriptScore` is now `min(charSim, wordSim)` against
  expected — both must agree on "good match" for full credit, so
  cadence-only mispronunciations no longer leak through as 60%+
  scores. Char-level alone is preserved for CJK / no-whitespace
  scripts where every character is a meaningful unit (word-level
  Levenshtein on a single "word" produces a useless 0/1 binary).
- **Removed the now-redundant acoustic divergence penalty.** When
  `transcriptScore` ignored the free decode, an `acoustic *=
  penaltyMul(freeVsExpected)` curve was the only way to surface
  free-vs-expected divergence in the score. With the min(char,
  word) change above baking that signal directly into transcript,
  applying the curve on top double-counted the same penalty.
  `freeVsConstrainedSimilarity` is still computed for the
  diagnostic chip and OSLog.
- **Compression-ratio gate is per-language now.** Whisper's 2.4
  default is calibrated for Latin-script English; Indic / Persian
  / Urdu BPE expands a single phoneme to 2–4 sub-tokens, so even
  clean speech in te/ta/bn/ml/mr/gu/pa/ur/fa/si/ne/or/as can
  legitimately push `compressionRatio` past 2.4. The gate was
  capping perfect Tamil attempts at 40% with a false "garbled"
  flag. Threshold raised to `3.5` for low-resource langs; `2.4`
  default holds for everything else.
- **Number-words ↔ digits normalization.** Whisper transcribes
  spoken numbers as digits regardless of how the speaker said
  them — `"novanta"` (it) → `"90"`, `"ten"` (en) → `"10"` — so
  text comparison was failing the user even on perfect
  pronunciation. `normalize()` now takes an optional `lang` and
  applies a per-language word→digit map before comparison.
  Coverage: en/es/fr/it/de/pt for 0–20, round tens, hundreds,
  thousand. Compound forms ("ventuno", "twenty-one") are out of
  scope for this pass; the common round-number practice case is
  covered. Heard side already arrives in digit form, so the
  expected side gets normalized to match.
- **Tightened acoustic ramps to remove top-end inflation.** With
  `highRes` ramp `avgZero=0.30, avgOne=0.85, minZero=0.10, minOne=
  0.50` plus `0.7·avg + 0.3·min` blending, "phrase understood,
  accent clearly off" was scoring 100%. Pushed to `avgZero=0.40,
  avgOne=0.95, minZero=0.20, minOne=0.78` and bumped min weight to
  `0.6·avg + 0.4·min` so a single weak word visibly hurts the
  score. `lowRes` ramp also nudged: `avgOne 0.55→0.70`, `minOne
  0.35→0.45`. Result: 100% now requires near-native confidence on
  every word; "passable" sits in the 60–80 range with room above.
- **Fixed crash when switching from Standard → Advanced.** The
  previous-loaded model wasn't released before the new one was
  allocated, so peak memory hit `oldModel + newModel + CoreML
  buffers`. Standard (~150 MB) → Advanced (~640 MB) blew past iOS's
  per-app memory limit and the OS killed the app. Reverse direction
  worked because peak was bounded by the resident large model.
  `prepare()` now drops the existing kit reference (under
  `queue.sync` to flush deallocation) BEFORE allocating the new
  one.
- **Latency caps to fail fast on nonsense audio.** Two
  `DecodingOptions` knobs were running on defaults that ballooned
  latency on hard audio:
  - `sampleLength` (default 224 = `Constants.maxTokenContext`) is
    now capped at `max(40, min(120, expectedTokenCount * 3))`.
    Practice phrases are typically <30 words (~60 tokens), so good
    speech finishes well under the cap; nonsense audio that would
    otherwise grind through 224 tokens looking for a confident stop
    is bounded.
  - `temperatureFallbackCount` (default 5: greedy plus retries at
    temperatures 0.2/0.4/0.6/0.8/1.0) is now `0`. The fallback
    loop was Whisper's mechanism for rescuing weak audio at higher
    sampling temperature — exactly the prior-rescue pattern we're
    fighting. For pronunciation training the honest greedy result
    is the answer; we don't want the decoder to try harder. Cuts
    worst-case dual-decode latency by up to 6× on nonsense audio.
- **Empty free-decode is no longer a silent failure.** When dual
  decode runs and the free pass returns no text (Whisper gave up on
  the audio without the prefix bias — a genuine pronunciation
  failure mode, not silence which `noSpeechProb` already catches),
  the plugin used to fall back to constrained-only scoring,
  silently inflating the result. Now: an `sttErr` log line fires
  with session/lang/expected/heard context, `transcriptScoreFree`
  is forced to 0, the divergence-penalty curve always runs, and
  acoustic floors at the curve's 0.20 minimum. Net effect: nonsense
  audio that constrained "rescues" via prefix tokens scores ≈ 0%
  instead of 70–90%.

### Added
- New `TranscriptionResult` fields: `acousticScore`, `noSpeechProb`,
  `compressionRatio`, `temperature`, `minTokenLogprob`,
  `tokenLogprobStdev`, `freeVsConstrainedSimilarity`, `freeText`.
- OSLog lines tagged `[stt-cal]` for every transcribe — heard,
  expected, normalized versions, all signals — so per-language
  thresholds can be calibrated from real recordings via
  `log show --predicate 'subsystem == "com.corpora.corpan"' --info`.

### Fixed
- **Telugu (and other Indic / Persian abugida) scripts no longer
  collapse to 0% on score.** Two compounding bugs hit the
  low-resource path:
  - `normalize()` was an allowlist over `CharacterSet.letters` (Unicode
    L*) plus digits and space, which dropped Indic vowel marks
    (categories Mn / Mc) — essential for the spelling of Telugu, Tamil,
    Bengali, Malayalam, Marathi, Gujarati, Punjabi. After NFC and
    lowercase it now strips only punctuation, symbols, controls,
    illegals, and format characters (a blocklist), keeping every
    script's marks.
  - When WhisperKit returned no per-word timings (rare but observed on
    Telugu), `acousticScore` collapsed to 0 and the multiplicative
    `overall = transcript × (textFloor + (1-textFloor)·acoustic)`
    floored hard. We now fall back to the overall `avgLogprob` mapped
    to 0..1 so the score still tracks model confidence.
- **Diagnostic log line** now prints `lang`, raw and normalized heard
  vs expected text, word count, avgWordProb, minWordProb, transcript,
  likelihood, and overall on every transcribe — makes "why is Telugu
  scoring weirdly" debuggable from device logs.

### Changed
- **Always prewarm.** WhisperKit's CoreML models need device-specific
  "specialization" before first inference; Apple maintains that cache
  outside the app and evicts it on OS updates and after extended idle
  periods. Without prewarm the first transcribe of a session can take
  10–30 s while CoreML re-specializes on demand, which produced the
  "scoring takes 0.5 s sometimes and 30 s other times" inconsistency.
  Both `installModel`'s CoreML load test and `prepare`'s load now pass
  `prewarm: true` to `WhisperKitConfig`. ~2× one-time load cost (already
  hidden in the install "Verifying…" phase) in exchange for consistent
  fast inference afterward.
- **Language-tier scoring.** Whisper's per-word probabilities are
  calibrated very differently across languages — low-resource ones
  (Telugu, Tamil, Bengali, Malayalam, Marathi, Gujarati, Punjabi,
  Urdu, Persian, Sinhala, Nepali, Odia, Assamese) intrinsically score
  lower even on perfect speech, so a single threshold tuned on English
  was making them stuck at ~30%. Two-tier ramp now: high-resource uses
  the prior `avgWordProb 0.30→0 / 0.85→1` curve with `textFloor=0.10`;
  low-resource uses `0.10→0 / 0.55→1` with `textFloor=0.30`. Native
  Telugu pronunciation now scores ~80% instead of capping at ~30%;
  garbage still scores ~15%.
- **Scoring uses per-word acoustic confidence (`avgWordProb` /
  `minWordProb` from Whisper word timings) multiplicatively with the
  transcript-text match.** Previous formula
  (`0.7·transcript + 0.3·likelihood`) let `large-v3-turbo`'s strong
  language-model prior recover the right transcript text from rhythm
  alone, scoring "Nailed it" on bad pronunciations. New formula:
  `overall = transcript × (0.1 + 0.9·acoustic)` where `acoustic =
  0.7·avgAcoustic + 0.3·minAcoustic`, both mapped from word
  probabilities via 0.30 → 0 / 0.85 → 1 (and 0.10 → 0 / 0.50 → 1 for
  min). Empty-expected fallback uses `acoustic` directly. Telemetry log
  line now includes `avgWordProb` and `minWordProb`.

### Fixed
- **CoreML error -14 ("Failed to build the model execution plan") on
  `large-v3-turbo`.** WhisperKit's default `textDecoderCompute` is
  `.cpuAndNeuralEngine`, but on some M-series iPad chips ANE refuses to
  compile a plan for the turbo text decoder graph and surfaces as -14.
  Both `installModel` (the post-download CoreML load test) and `prepare`
  now pass an explicit `ModelComputeOptions(audioEncoderCompute: .cpuAndGPU,
  textDecoderCompute: .cpuAndGPU)`. Still hardware-accelerated, works on
  every shipped device, harmless for the smaller `base` model that was
  already loading fine on ANE.

## [0.1.0] - 2026-05-04

### Added
- Initial scaffold of `tauri-plugin-stt`.
- iOS implementation backed by WhisperKit (Argmax's CoreML-based Whisper) for
  on-device speech-to-text with word-level timestamps and average log-probability.
- Commands: `prepare`, `start_session`, `stop_session`, `cancel_session`,
  `is_available`, `get_status`.
- Built-in scoring components against an `expectedText`:
  - `transcript_score` — normalized Levenshtein similarity.
  - `likelihood_score` — average log-probability mapped to [0, 1].
  - `overall_score` — weighted blend.
- Audio capture via `AVAudioEngine` with `AVAudioConverter` to 16 kHz mono Float32.
- Android stub returns `unsupported`. Desktop stub returns `unsupported`.
- iOS deployment target raised to 16.0 (WhisperKit requirement).
