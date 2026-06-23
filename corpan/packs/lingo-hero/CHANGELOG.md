# Changelog

All notable changes to the Lingo Hero pack are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed
- **Correct answers were being scored as wrong (core logic).** Wave content had
  no dedup, so on a small per-language pool the *correct* English could appear on
  both the target and a distractor — tapping the right answer hit the duplicate
  and was penalized. Wave content now guarantees one target + distractors with
  **distinct entries and distinct English answers**.
- **Tap-lane vs shown-lane mismatch.** Input split the full width into thirds
  while the board is centered/capped at 600px, so on wide layouts the lane you
  tapped wasn't the lane you saw. Input now uses the exact board geometry.
- Hit detection now selects the note *closest* to the strum line (was first in
  array order).

### Changed
- **Playability overhaul — much slower and easier.** Notes now fall over ~7s
  (was ~1.3–2.7s) and movement is delta-timed, so it no longer runs 2× faster on
  90/120Hz phones. Words and note cards are substantially larger and more
  readable, the hit window is far more forgiving, and BLITZ wave cadence eased
  from ~1.2s to 3.5–5.5s between waves. Tunable via `NOTE_TRAVEL_SECONDS`.

### Fixed
- Install no longer fails with "Pack id mismatch": the pack id is now the
  underscore form `lingo_hero` (manifest, catalog, and game registration) to
  match the id the installer derives from the `lingo-hero.zip` filename. Paths
  and the zip stay hyphenated.
- Added the pack avatar (`lingo-hero-avatar.png`); the catalog entry previously
  pointed at a non-existent image, so the pack shipped with no artwork.
- TTS now speaks the raw entry text instead of the display-cleaned label;
  display labels are cleaned separately and title-casing is restricted to
  Latin/ASCII text (foreign scripts are left intact).
- The quiz target language now follows the host's chosen languages
  (`getStackConfig().languages`) instead of always picking the first
  non-English translation, and updates live via `onStackConfigChange`.

### Added
- Premium UI/UX design system: cohesive glass/neon menu, in-game HUD, and
  game-over panel with juicy mode buttons (icons, sub-labels, hover/active
  glow), animated combo pulse, floating score deltas, a "New Best!" ribbon,
  and a progression-aware game-over summary (best streak / level / high score).
- Locally vendored fonts (`assets/fonts/*.woff2`, Lato under OFL-1.1) with
  `@font-face` in `styles.css`; removed the remote Google Fonts `@import` so
  the pack is fully offline-first. `'Russo One'` (used by the canvas renderer)
  is aliased to the vendored display weight.
- RTL layout mirroring driven by the active-language `isRTL` flag (logical CSS
  properties + `dir` on the UI layer), accessible focus-visible states, and a
  `prefers-reduced-motion` fallback.
- Typed event bus (`src/events.ts`) emitting `gameStart`, `menuShown`,
  `noteHit`, `noteMiss`, `comboChange`, `scoreChange`, `gameOver`.
- Stream seams (no-op): `effects/`, `audio/`, `progression/`, and a `Hud`
  class (`ui/Hud.ts`) that owns the DOM overlay.
- RTL awareness (`ar`/`he`/`fa`/`ur`) surfaced on the active-language context.
- First canvas paint is gated on `document.fonts.ready`.
- Super-premium VFX layer (`src/effects/*`): pooled additive particle bursts
  on hits, combo-escalating shards/stars, trauma-based screen shake on
  misses/big combos, expanding hit shockwaves, floating `+score` popups, combo
  milestone banners, a living parallax/aurora background that reacts to combo
  energy, and cinematic scene transitions (menu/play/game-over). Note motion
  trails, a breathing strum line, and animated fret buttons added in
  `Renderer.ts`. All GPU-cheap Canvas 2D, 60fps-targeted, offline.
- Offline WebAudio SFX + haptics layer (`src/audio/*`): procedural,
  zero-asset synthesis — combo-rising pentatonic hit chimes, miss thud,
  passed-by descend, milestone arpeggio riser, combo-break deflate, menu/start/
  game-over stings, lane-to-stereo panning, and `navigator.vibrate` patterns
  gated on `prefers-reduced-motion`. AudioContext unlocks on first gesture.
- Gamification/progression layer (`src/scoring/curve.ts`,
  `src/progression/*`): combo→multiplier staircase, super-linear XP/level
  curve, combo tiers (HOT STREAK→GODLIKE), S/A/B/C/D end-of-run grade, and
  offline-first per-stack localStorage persistence with in-memory fallback.
- Catalog registration: listed in `web/data/packs.json` on the `preview`
  channel as a free `game` pack (`minAppVersion` 0.17.0).
- Pages deploy wiring (`.github/workflows/deploy-pages.yml`): install, build,
  zip (`manifest.json` + `dist/` + optional `assets/` fonts/audio), and copy
  the pack into `web/io/out` for the static catalog.
