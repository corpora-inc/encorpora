# Changelog — Corpán (core app)

All notable changes to the Corpán Tauri app are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

### Added
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
