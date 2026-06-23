# Changelog

All notable changes to the Lingo Hero pack are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed
- TTS now speaks the raw entry text instead of the display-cleaned label;
  display labels are cleaned separately and title-casing is restricted to
  Latin/ASCII text (foreign scripts are left intact).
- The quiz target language now follows the host's chosen languages
  (`getStackConfig().languages`) instead of always picking the first
  non-English translation, and updates live via `onStackConfigChange`.

### Added
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
