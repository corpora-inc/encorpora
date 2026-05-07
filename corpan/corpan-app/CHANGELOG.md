# Changelog — Corpán (core app)

All notable changes to the Corpán Tauri app are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.12.6] - 2026-05-07

### Changed
- Release build now ships native debug symbols to Play Console.
  `Cargo.toml` release profile no longer strips the Rust `.so`
  (`strip = false`, `debug = 1`); Gradle's `debugSymbolLevel = "FULL"`
  embeds them in the AAB metadata. APK size on-device is unchanged
  (Gradle still strips before packaging). Future Android native
  crashes will arrive in Play Console pre-symbolicated instead of as
  raw hex offsets.

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
