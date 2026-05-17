# Changelog — Corpán (core app)

All notable changes to the Corpán Tauri app are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

### Fixed
- Main experience: language stack could hide its last row under the
  floating Nav with no way to scroll to it. The inner content used
  `my-auto` to vertically center, which in WebKit's flex
  implementation can absorb layout space in a way that suppresses
  scroll activation at the boundary where content is just barely
  taller than the visible area. Replaced with
  `justify-content: safe center` on the scroll container itself —
  modern CSS that centers when content fits and falls back to
  `flex-start` when it overflows, so scrolling reliably reaches
  the last row. Also measured the Nav at runtime via
  `ResizeObserver` so the scroll container's bottom padding always
  exceeds the Nav's actual rendered height.

## [0.13.0] - 2026-05-16

The "Parlometron" release. The pronunciation-coach pack is rebranded
to **Parlometron** and gains a multiplayer mode alongside the
existing solo practice flow. The catalog ID `pronunciation_coach` is
stable so older Corpán builds still see the 0.5.x pack; only this
version (and newer) sees the 0.6.0 pack under its new brand.

### Added
- **Per-call `downloadUrl` plumbing on `installModel`**. The host's
  `installModel` wrapper at `corpan-app/src/contentPacks/hostApi.ts`
  + the matching opts type in `types.ts` now forwards an optional
  `downloadUrl` to the native plugin. Lets packs ship community /
  self-quantized model variants from our own CDN — first use case is
  the Parlometron pack's new `Large q8 ★` entry (full Whisper Large
  v3 at 8-bit precision, ~1.58 GB, quantized from fp16 ourselves
  because upstream `ggerganov/whisper.cpp` doesn't publish one).

### Fixed
- Wire-format gap on `installModel`. The host JS wrapper had been
  silently stripping any field other than `model` from the opts
  payload before invoking the native command — same kind of trap
  the `whisperParams` plumbing hit on the Rust side earlier in
  0.12.x. With this fix the field flows all the way through to
  Swift / Kotlin and on to the actual HTTP download.

### Changed
- App version unified to `0.13.0` across `package.json`,
  `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` (these
  had drifted across 0.12.6/0.12.8 during the Android-only patch
  releases — now back in sync).

## [0.12.8] - 2026-05-15

Android-only rebuild on top of 0.12.6/0.12.7's content. Fixes two
Play Console warnings that surfaced when the new whisper.cpp JNI lib
landed: a 16 KB page-size compatibility gap, and missing native
debug symbols metadata in the AAB.

### Fixed
- 16 KB page size compatibility for `libwhisper-jni.so`. The CMake
  build (NDK 28 + AGP 8.11) was producing 4 KB-aligned segments
  while every other native lib in the AAB (Rust `libcorpan_lib.so`
  across all four ABIs, NDK `libc++_shared.so`) was correctly
  16 KB-aligned via the rustflags block in
  `src-tauri/.cargo/config.toml` from 0.7.8. Added matching
  linker flags to the plugin's CMakeLists.txt
  (`target_link_options ... -Wl,-z,max-page-size=16384`,
  `-Wl,-z,common-page-size=16384`). On Pixel 9 / Android 15+
  16 KB hardware this avoids the bionic 4 KB-emulation shim
  (15-30% slower startup, ~5% more power).
- Native debug symbols actually reach Play Console. AGP release
  config in `gen/android/app/build.gradle.kts` switched from
  `debugSymbolLevel = "FULL"` to `"SYMBOL_TABLE"` after observing
  on 0.12.6 and 0.12.7 that FULL left the AAB's
  `BUNDLE-METADATA/com.android.tools.build.debugsymbols/`
  directory empty under AGP 8.11 + NDK 28 + the universal flavor.
  SYMBOL_TABLE is the format Play actually uses for crash
  symbolication; both formats clear the "you've not uploaded
  debug symbols" warning. Also added a defensive
  `packaging { jniLibs { keepDebugSymbols.clear() } }` to the
  release block so AGP's strip task can actually strip.

### Changed
- Plugin `tauri-plugin-stt` 0.3.0 → 0.3.1 (16 KB fix + carries
  the symbols work from 0.3.0's incomplete release notes).

## [0.12.6] - 2026-05-13

### Added
- `SKAdNetworkItems` entry for Google Ads (`cstr6suwn9.skadnetwork`)
  in iOS `info.properties` (template at `src-tauri/ios/project.yml`),
  authorizing Apple to deliver SKAdNetwork conversion postbacks to
  Google for paid acquisition campaigns. Metadata only; no SDK
  integration. xcodegen regenerates `Info.plist` from the template,
  so the entry round-trips through any future Xcode project rebuild.
- Anonymous, session-scoped main-app analytics. Same privacy
  posture as the existing reader-pack analytics (ephemeral session
  UUID, no persistent identifiers, no IP storage, country-only
  geo via the CDN edge). Events: `session_start`,
  `app_pack_entered`, `app_pack_heartbeat` (30s while a pack is
  open), `app_pack_exited`, `app_language_switched`,
  `app_onboarding_completed`, `app_paid_unlock_viewed`,
  `app_session_summary` (on pagehide). Reuses
  `packs/shared/analytics`; backend Lambda allowlist updated to
  accept `reader_id="corpan-app"`. Build-time kill switch via
  `VITE_ANALYTICS_ENABLED=false`.
- **Settings → Send anonymous usage data** toggle. Default on
  (matching the reader-pack opt-out model). Off disables all
  main-app analytics immediately and clears the local queue.

### Changed
- Release build now ships native debug symbols to Play Console.
  `Cargo.toml` release profile no longer strips the Rust `.so`
  (`strip = false`, `debug = 1`); Gradle's `debugSymbolLevel = "FULL"`
  embeds them in the AAB metadata. APK size on-device is unchanged
  (Gradle still strips before packaging). Future Android native
  crashes will arrive in Play Console pre-symbolicated instead of as
  raw hex offsets.
- Privacy Promise (web/io/app/privacy/page.tsx) rewritten to
  reflect the anonymous usage analytics, the new in-app opt-out,
  and the network paths the app uses (IAP verification, pack
  downloads, optional live-radio streaming). The previous "no
  telemetry, ever" wording was no longer accurate.

## [0.12.5] - 2026-05-07

### Fixed
- **STT plugin upgraded to 0.2.2**, multiple memory-hygiene fixes
  for the model-switch / transcribe path on iPhone. Most impactful
  change: the dual-decode (constrained + free passes) now runs
  **in series** instead of in a concurrent TaskGroup, halving peak
  memory during transcribe with no wall-clock cost (the parallel
  form never gave a real speedup on a shared GPU). Also: runtime
  prepare uses `prewarm: false` (defers CoreML compile to first
  transcribe), and consecutive loads of the same model retry on
  transient mmap failures (sub-second resource race that was
  surfacing as LOAD_FAILED). New memory snapshot logs at every
  load/transcribe boundary make future diagnoses readable. See
  the plugin's own changelog for the full story.

## [0.12.4] - 2026-05-07

### Fixed
- **STT plugin upgraded to 0.2.1**, which fixes a model-switch OOM
  crash on iPhone caused by concurrent WhisperKit allocations. The
  plugin now serializes `prepare()` calls through a chain so two
  loads can never run in parallel; peak memory during a switch is
  bounded by the larger of the two models, not their sum. See the
  plugin's own changelog for the full story. The host-app side
  pulls in the new plugin code automatically — no `hostApi.ts`
  changes — but the iOS bundle has to be rebuilt to ship the Swift
  fix, hence the 0.12.4 bump.

## [0.12.3] - 2026-05-06

### Changed
- **STT plugin upgraded to 0.2.0** — substantial robustness pass on
  the on-device WhisperKit pipeline. The host-app side picks up the
  matching bridge changes:
  - **Structured error codes** (`MODEL_NOT_INSTALLED`, `LOAD_FAILED`,
    `NETWORK`, `IO_FAILED`, `BUSY`, `CANCELLED`,
    `MIC_PERMISSION_DENIED`, etc.) flow through `hostApi.ts` —
    incoming plugin errors now carry `error.code` parsed from the
    `"CODE: description"` string convention. Packs route on code,
    never on message substring.
  - **`stt.listInstalled({ models: [...] })`** — single round-trip
    that returns disk-truth validation state for every requested
    variant. Pronunciation Coach 0.2.0 calls it once on boot
    instead of N×`validateModel`.
  - **`stt.unload()`** — drops the in-memory WhisperKit instance
    without touching disk; available for memory-warning hooks.
  - **CoreML compute-backend fallback to CPU-only on error -14**.
    Affected iPad chips that couldn't compile `large-v3-turbo`
    even with `.cpuAndGPU` now transparently retry with
    `.cpuOnly`. Slower but works on every device we ship to;
    eliminates the Reinstall loop that was a backend bug, not a
    corruption signal.
  - **Atomic install with rollback.** `installModel` stages any
    existing on-disk install aside before WhisperKit downloads new
    files; commits on validation success or rolls back on failure.
    A failed install never corrupts the previously working install.
- **Pronunciation Coach catalog gate raised** to `minAppVersion
  "0.12.3"` — pc 0.2.0 calls `listInstalled` and routes on
  structured error codes, both unavailable in 0.12.2 binaries.

## [0.12.2] - 2026-05-05

### Added
- **Pronunciation Coach 0.1.0** ships as the first iOS-only pack —
  on-device speech-to-text via the new `tauri-plugin-stt` (WhisperKit
  + ANE/GPU compute units, dual decode for honest scoring, per-language
  acoustic ramps, calibration-ready signal mining). Catalog gate is
  `platforms: ["ios"]` + `minOSVersion: "17.0"` + `minAppVersion:
  "0.12.2"` so it never lists for Android, web, or older iPads where
  WhisperKit can't load.
- **Catalog v3 platform / OS gating**: entries now accept
  `platforms?: HostPlatform[]` (one of `ios | android | macos | windows
  | linux`) and `minOSVersion?: string`. `filterCatalogForApp` skips
  packs whose declared platforms don't include the host or whose
  `minOSVersion` exceeds the host's iOS / Android / macOS version.
  Host detection runs through `@tauri-apps/plugin-os` — outside Tauri
  the gates become no-ops so the dev catalog still loads everywhere.
- **13 new languages** added to the bundled experience (now 51 total):
  Nepali (ne), European Portuguese (pt-PT), Croatian (hr), Serbian (sr,
  Cyrillic + Latin romanization), Ukrainian (uk), Bulgarian (bg),
  Romanian (ro), Catalan (ca), Cantonese (yue-Hant-HK, Traditional +
  Jyutping), Czech (cs), Lithuanian (lt), Slovak (sk), Slovenian (sl).
  Each ships with full LLM-translated 10k-phrase corpus, native UI
  i18n in `public/locales/<code>/common.json`, and platform-aware TTS
  voice resolution (e.g. `yue-Hant-HK` → Apple `zh-HK` voices,
  `sr` → Croatian voice fallback when no Serbian voice is installed).
  Nepali ships without Apple TTS support — onboarding's existing
  generic "Send Apple Feedback" path covers it.
- **iOS deployment target raised to 16.0** (WhisperKit requirement).
  Also added `NSMicrophoneUsageDescription` to `ios/project.yml` so it
  survives Xcode project regeneration.

## [0.12.1] - 2026-05-01

### Fixed
- **Android release builds**: World Radio HTTP stations (~75% of catalog)
  failing with `ERROR_CODE_IO_NETWORK_CONNECTION_FAILED`. Fix lives in
  `tauri-plugin-radio-stream` 0.1.1, which now contributes a
  `network_security_config.xml` to the merged manifest. Mirrors the iOS
  ATS exception we already shipped in `src-tauri/ios/project.yml`. No
  changes to `gen/android/`.
- **World Radio error UX (Android)**: player bar no longer flashes-and-hides
  when a station fails. The native plugin now holds the error visible
  through ExoPlayer's post-error `STATE_IDLE` transition, and the message
  is "Couldn't connect to the station" instead of the cryptic "Source error".

iOS code unchanged from 0.12.0 — this release is Android-only in substance.
Ship iOS at 0.12.1 only if you want App Store / Play Store version parity.

## [0.12.0] - 2026-05-01

### Added
- **World Radio: native streaming** via `tauri-plugin-radio-stream` —
  ExoPlayer (Android) / AVPlayer (iOS) running outside the WebView.
  Lock-screen / Control Center transport, ICY metadata, background-resilient
  playback, audio-focus surfacing on Android, lock-screen widget hardened
  on iOS through pause/resume cycles. Pack rebuilt for the new architecture
  ships as World Radio 0.5.0; older app versions stay on World Radio 0.3.x.
- Catalog filter now honors `maxAppVersion` on V3 entries, letting a single
  pack id ship different versions to old vs. new apps (e.g. World Radio
  0.3.x for ≤ 0.11.x, 0.5.x for ≥ 0.12.0).
- First-run **Discover Packs** panel after onboarding — shows curated
  packs (Earthgate Reader, Stargate Reader, Hover Runner, Hanzipan)
  with one-tap install. Persisted dismiss flag (`hasSeenPacksDiscover`)
  so it appears once.
- Contextual **Stacks intro tip** on first visit to Settings → Stacks.
- 9 new languages localized end-to-end (Hebrew with nikkud, Swedish,
  Finnish, Dutch, Swahili, Norwegian, Danish, Greek, Malay) — total
  language coverage now **38**.
- Hebrew + Greek romanization across the corpus.

### Changed
- Slimmed bundled corpus from ~27k to ~10k phrases — heavier curation,
  A1–B2 weighted, ~50 % smaller bundle while covering 31 % more
  languages. Pre-prune snapshot archived to S3 (`corpan-prod` bucket)
  for reversibility.
- Onboarding kept its 3-step shape but received a polish pass: RTL-aware
  arrows everywhere, autonyms in their own scripts on the primary-
  language picker, deduped welcome cloud, header background flows under
  the nav (no lighter band on the TTS step), single-language chip no
  longer presents as removable.
- Onboarding typography decoupled from user's text-size accessibility
  setting via a `.wizard-shell` CSS scope.
- Tip cards (`DismissableTip`) redesigned: bordered purple-tinted card,
  X anchored in the corner, RTL-safe logical margins.
- `InstallProvider` lifted to `App.tsx` so the install-progress dialog
  and launched reader render above any first-run panel.
- Modal stack: Radix Dialog and `ContentPackOverlay` raised to
  `z-[1100]` so dialogs and the launched reader sit above app chrome.

### Fixed
- **True random entry selection.** `get_random_entry_with_translations`
  and the plural variant were using `subsec_nanos() % total` as a PRNG;
  rapid taps clustered within the same nanosecond and collided on the
  same offset, producing the same handful of phrases over and over.
  Replaced with SQLite `ORDER BY RANDOM()` — properly seeded, uniform
  across currently-matching rows.
- Runtime "gaslight" fallback for pruned-entry IDs in user history now
  silently substitutes a same-level random entry instead of erroring.
- `dialects.<code>` localization gap that surfaced raw codes (e.g. "sv")
  instead of translated language names — added entries for the 9 new
  languages across all 38 locales.

## [0.11.8] - 2026-04 — Android TTS onboarding (#230)

### Added
- Android TTS onboarding overhaul: explicit engine probe, auto-recover
  attempt, rescue card UI for diagnosed failures (engine disabled,
  engine missing, voice data missing, engine hung).
- Voice-selection per-language section with samples and previews.

## [0.11.7] - 2026-03 — IAP rewrite for App Review resubmission

### Changed
- Native StoreKit 2 + Play Billing rewrite via `tauri-plugin-iap` to
  pass App Review.

## [0.11.6] - 2026-03 — IAP retry + diagnostics + lifecycle hardening

### Added
- IAP retry surfaces and diagnostics.
- Earthgate Reader 0.5.1 bundled.

### Fixed
- Lifecycle edge cases around backgrounded purchases.

## [0.11.5] - 2026-02 — IAP lifecycle, iOS reader bugs

### Fixed
- Various iOS reader bugs.
- IAP lifecycle in Apple sandbox.

## [0.11.3] - 2026-02 — Books, packs, paid content (#225)

### Added
- Paid-book downloads.
- Subscription management surfaces.
- Books pipeline plumbing.

## [0.10.0] - 2026-01 — Reader pack improvements (#214)

### Added
- Reader-pack delivery improvements end-to-end.

## [0.9.10] - 2025-12 — iPhone finish push (#209)

### Changed
- iPhone polish in service of ship.

## [0.9.9] - 2025-12 (#208)

### Changed
- Continued ship readiness.

## [0.9.8] - 2025-12 — Stargate reader full rollout (#195)

### Added
- Stargate Reader as a fully shipped pack.

## [0.9.7] - 2025-12 — Keep Alive and Upgrades (#192)

### Added
- Audio keep-alive plugin to fix iOS background audio.

## [0.9.6] - 2025-11 — Reform DB loading (#186)

### Changed
- DB loading reform.

## [0.9.5] - 2025-11 (#185)

### Changed
- General improvements.

## [0.9.3] - 2025-11 — Padding flail (#148)

### Fixed
- Padding regressions.

## [0.9.2] - 2025-11 (#147)

### Changed
- Padding adjustments and Hanzipan version sync.

## [0.9.0] - 2025-10 — Packs ship (#142)

### Added
- Packs system shipped end-to-end.

## [0.8.8] - 2025-09 — Fully offline packs (#130)

### Added
- Fully offline pack delivery.

## [0.8.5] - 2025-09 — Add 8 South Asian languages (#122)

### Added
- 8 South Asian languages added.

## Older

For the full history, see `git log corpan/corpan-app/`. Notable older
milestones: GAMETIME (#120, first packs), Bengali + Watashi (0.7.10
#105), Thai (0.7.12 #108), Turkish (0.7.16 #116), Indonesian (0.7.15
#114), A0 level + DB compress (#109), Rating prompt (#103).
