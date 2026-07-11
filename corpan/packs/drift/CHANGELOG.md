# Changelog

All notable changes to the Drift pack are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Wired into the app as an auto-installing system pack: the Journey mixer now
  schedules `drift:read` as a reader interlude, discovered from this manifest's
  `activities` via the app's catalog (`web/data/packs.json` + catalog-v3).

## [0.1.0] - 2026-07-10

### Added
- Initial Drift pack — a calm, serial, reactive micro-story reader built as a
  Journey scroll interlude (the down-tempo comedown between exercise cards).
- Pair-agnostic, multilingual content model: scenes are mood + content slots
  filled at runtime from the learner's own corpus (`getStackConfig` /
  `getRandomEntries` / spec `itemRefs`); target + native codes resolved from the
  stack or the Journey spec, degrading to target-only on immersion stacks.
- Tap-any-word gloss reveal in the learner's native language.
- Optional, user-initiated TTS narration via `hostApi.speak()` with
  beat-by-beat word highlighting; sound is off by default so sound-off learners
  are never surprised.
- Reactive scene: an evocative motif (dawn, lantern, snow, tide, door, stars)
  resolves per beat; reduced-motion safe.
- Interlude conformance: honors `journey.isActive()` / `getSpec()`, features the
  spec's current phrase as a story beat, and reports an unscored completion
  (`reportResult({ specId, score: 1, perItem: [], durationMs })`) before
  `corpan:exit` on finish. Swipe-outable; `typicalDurationSec: 30`.
- Manifest declares the `drift:read` journey activity
  (`itemKinds: ["phrase"]`, `requiredHostApis: ["journey"]`,
  `strands: ["mfi","fd"]`); localized name/description for ~54 locales; two
  chrome strings ("Listen"/"Done") localized in-pack.
- Squared-off (8px), cool-temperature, compact-mobile design; self-contained
  IIFE build (`CorpanGames.drift`), no shared deps.
