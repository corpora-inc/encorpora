# Changelog — Juice Squeeze pack

Phrase-building game pack. Currently a prototype — exploring tile-based
sentence assembly with multi-language and CJK support.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.1.5] - 2026-06-16 — Daily-cap enforcement

### Fixed
- **Daily cap now HARD-enforces — including on remount.** The gate counted
  completed phrases but never blocked at the cap. Loading a new phrase to solve
  now checks `isBlocked()` first, *including the initial mount load*: the pack
  does not persist/restore the current utterance, so the old mount exemption let
  an already-capped free user mint one fresh phrase per exit/re-enter. At the cap
  it re-shows the daily-lock overlay (`requestDailyLock()`) instead of dealing
  another phrase — a hard wall until local midnight or subscribe. Subscribers
  never block.

## [0.1.4] - 2026-06-16 — Fix: pack never registered (blank/failed load)

### Fixed
- **Pack now registers in production.** The store imported `create` from the
  root `zustand` entry, which pulls in `react`. This pack declares no React, so
  the IIFE build emitted a bundle that *threw* `Could not resolve "react"
  imported by "zustand"` at module-init — before `registerGame()` ran — so the
  host's `waitForGameModule` timed out with "Content pack did not register:
  juice_squeeze". Switched to `zustand/vanilla`'s `createStore` (the pack is a
  vanilla DOM game; all call sites use `.getState()`/`.subscribe()`). Rebuilt
  bundle contains the registry and no resolve-throw.

### Changed
- Upgraded Babylon.js **6.48 → 9.11** (latest stable). No source changes
  required; typecheck + build clean.

## [0.1.3] - 2025-12 — CJK row fix, ghost preview, layout (#175)
### Added
- Ghost preview during drag.
- Rounded blocks.
### Fixed
- CJK row sizing.
- iPhone layout regressions.

## [0.1.x] - 2025-12 (#177)
### Fixed
- Irrational tile reordering across rows during drag.

## [0.1.x] - 2025-12 (#173)
### Removed
- Unused variables and dead code.

## [0.1.x] - 2025-12 — RTL + layout (#172)
### Fixed
- RTL language layout.
- Layout improvements.

## Older

See `git log corpan/packs/juice-squeeze/` for the prototype's origin.
