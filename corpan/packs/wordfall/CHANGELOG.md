# Changelog

All notable changes to the Wordfall pack are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Wired into the app as an auto-installing system pack: the Journey mixer now
  schedules `wordfall:catch` as a game interlude, discovered from this manifest's
  `activities` via the app's catalog (`web/data/packs.json` + catalog-v3).
- `nameLocalized` / `descriptionLocalized` added to the manifest for all ~54
  app locales.

### Fixed
- `minAppVersion` raised to `0.20.3` (was `0.17.0`) — the premium-scroll Journey
  interlude host that runs `wordfall:catch` first shipped in 0.20.3, so pre-0.20.3
  apps can't use the pack and should not see it.
- The pack ZIP is now actually built and published by `deploy-pages.yml`;
  previously the catalog advertised `wordfall.zip` but the workflow never
  produced it. (Wordfall stays `channel: preview` — dev-only — until promoted.)

## [0.1.0] - 2026-07-10

### Added

- Initial Wordfall pack — a catch-the-meaning arcade interlude for the Journey
  scroll (design: `journey/docs/PREMIUM_SCROLL.md` §5, "Game 3 — Wordfall").
- Canvas game: target-language word tiles rain down; tap the one that matches
  the prompt's meaning before it floors, let distractors fall. Escalating fall
  speed, combo, spoken catch feedback.
- Journey interlude conformance (activity-contract §4.2): declares the
  `wordfall:catch` activity; consumes `spec.itemRefs`; suppresses menus under
  `hostApi.journey.isActive()`; streams `reportItem` per resolved spec tile;
  emits exactly one `reportResult` at the natural end (with the
  `corpan:activity-result` event-rail fallback); swipe-outable with no fake
  terminal result on abandon.
- Standalone mode: samples via `hostApi.getRandomEntries`, Play / "Play again"
  cards, `npm run dev` mock-host mount; never reports.
- Single-language / immersion support (`packs/SINGLE_LANGUAGE_RULE.md`): prompt
  falls back to the target word itself when there is no native gloss.
- Sound-off is first-class: an in-pack toggle gates both `hostApi.speak` and the
  WebAudio SFX.
- Squared-off premium dark visuals with the app's violet accent; overlay HUD
  (prompt, round pips, combo chip) that never reflows the layout;
  reduced-motion aware.
- Headless contract test (`test/journey/instrumentation.spec.mjs`) proving
  content resolution, per-item reporting, terminal result + idempotency, and the
  event-rail fallback.
