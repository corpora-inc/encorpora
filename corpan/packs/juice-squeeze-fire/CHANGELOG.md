# Changelog

All notable changes to the **Juice Squeeze ✨** pack (`juice_squeeze_fire`) are
documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

This is a ground-up rebuild of Juice Squeeze: React + dnd-kit UI with a
Pixi.js shader-driven liquid hero, layered sound, and native haptics. It ships
preview-gated alongside the original `juice_squeeze` until promoted.

## [Unreleased]

### Added
- **Jar-fly bottle-complete celebration (Ian's jar idea)** — on a full bottle,
  after the fill-to-100% + celebration beat and BEFORE the drain-to-empty, a
  small CAPPED jar (the just-completed bottle's fruit gradient) appears
  center-screen, caps, and flies up into the header `BottleCollection` (~900ms),
  with a `jar-close.wav` at the cap. Pure DOM overlay (`src/components/jarFly.ts`)
  driven from `useGameLogic`'s bottle-complete branch; auto-removes on
  animationend, cleaned up via `winTimers` on unmount. The collection now renders
  completed bottles as small capped-jar icons so the flown jar visually joins
  them.
- **Sound pass** — wired more of the prepared WAVs UNDER the voice: `snap.wav`
  (0.5) on tap-to-place a word, `jar-close.wav` (0.9) on the jar-fly cap, and a
  soft `ping-h-1.wav` (0.5) accent layered on bottle-complete. `win` (1.0),
  `fill` (0.85), and `level-complete` (1.0) unchanged.

### Changed
- **Fruit-icon header** — `BottleGauge` shows the current fruit (~38px) with a
  gentle 2.5s bob/pulse (respects `prefers-reduced-motion`) instead of a
  redundant mini-bottle; removed the now-unused `.jsf-jar*` / `.jsf-mini-bottle*`
  CSS.

### Fixed
- **Clean completion ding (pack-side duck fix)** — `runWin` now calls
  `hostApi.stopSpeech?.()` before the chime, clearing any lingering previous
  phrase voice so the host TTS doesn't duck the win chime/glug. No host change.

### Added
- **Real completion sounds (Web Audio)** — `src/audio/SfxEngine.ts`: one shared
  `AudioContext` (with the `webkitAudioContext` fallback), unlocked/resumed on
  the first user gesture (iOS), with the two prepared WAVs preloaded + decoded.
  `play("win")` → `win.wav` on every correct phrase; a full bottle →
  `level-complete.wav`. Assets resolve against the host-injected pack base URL
  (falls back to `./audio/...` in standalone dev) and ship in `public/audio/`
  (copied to `dist/audio/`, not bundled). Fully fail-safe: any decode/context/
  fetch failure is a silent no-op, and playback respects `soundEffectsEnabled`.

### Polish batch
- **Juicier win pop** — the win ✓ now springs up with an overshoot and lingers
  (~1080 ms bouncy pop) instead of a ~500 ms blink, paired with the liquid
  `triggerWin` surge so every correct phrase reads as a celebratory beat.
- **Visible juice** — cooled the app background to a soft light cool-neutral
  gradient (`#f6f7fb → #eef0f6`) so colored juice pops instead of blending into
  the old warm orange; strengthened the liquid body (saturated, glossier) with a
  brighter double-stroke meniscus + a highlight band so the rising surface is
  obvious at low fill.
- **Mason-jar gauge** — the header `BottleGauge` is redesigned as a small
  marmalade jar: a darker rounded lid band, a slightly tapered glass body
  (clip-path), a fruit-colored fill with a meniscus, and a soft glass highlight.
- **Content-sized bank + sentence** — the word bank and sentence drop-zone now
  size to their content (`flex: 0 0 auto`) with a `max-height` cap (42vh / 32vh)
  + scroll; short phrases no longer balloon the bank, leaving the freed space as
  visible background juice.

### Changed
- **Target TTS is tap-only** — removed the auto-play of the target phrase on
  load; the target speaks ONLY when tapped (the built-sentence win TTS stays).
  Removes overlapping TTS on fast navigation.
- **Eye = silent, headphone = audio** — the 👁 give-up overlay now reveals the
  answer with NO sound; the 🎧 ear button is the audio-only path.
- **Hero juice vessel** — a big central glass tumbler (Pixi.js v8) that fills as
  you complete phrases. Smooth spring-rise fill, idle slosh/wobble surface,
  bright meniscus, glass gloss + inner shadow, moving sheen, and a fruit-colored
  3-stop gradient body. Replaces the tiny `BottleGauge` as the fill indicator;
  `BottleCollection` stays as header icons.
  - `triggerWin`: quick juice pour + splash + liquid jump + bloom flash + chunky
    rounded droplet particles (~600 ms).
  - `triggerBottleComplete`: bigger overflow + celebratory droplet burst; color
    cycles to the next fruit for the fresh bottle.
- **Instant win confirmation** — a brief full-screen green pulse with a ✓ badge
  (~500 ms) so a correct answer is unmistakable.
- `LiquidController` boundary (`src/liquid/LiquidController.ts` + `LiquidStage.ts`)
  with an imperative API (mount/setColor/setFill/triggerWin/triggerBottleComplete/
  resize/dispose). ONE WebGL context, resolution capped at min(dpr, 2), full Pixi
  teardown on dispose, and a no-op guard so happy-dom/SSR never init WebGL.
- New liquid traces: `liquid setFill`, `liquid triggerWin`, `liquid bottleComplete`.

### Changed
- **Liquid is now a full-screen background** — the juice fills the WHOLE screen
  from the bottom up (the original "whole screen fills with juice" feel) instead
  of a centered glass tumbler. The Pixi canvas is a fixed full-viewport layer
  behind all the UI (z-index 0, pointer-events:none); surface Y maps fill 0→~8%
  to 1→~88% of screen height with slosh, meniscus, sheen, and a soft top fade so
  the UI above the surface stays readable. No more glass outline/mouth ellipse.
- **Layout reclaims the freed space** — with the central jar gone, the main
  column (header → target → sentence → nav → controls → bank) uses the full
  height. The word bank now grows to fill the remaining space and SCROLLS for
  long phrases; the sentence drop-zone wraps and scrolls if extreme.
- **Readability-first block sizing** — replaced the fill-available crush that
  collapsed long phrases to ~9px clipped specks. Chips are now content-sized at a
  shared font that shrinks with word count but floors at a readable 14px (buckets
  n≤4→22, ≤6→20, ≤9→18, ≤12→16, ≤18→15, else 14); only a giant single word
  shrinks further so it still fits on one line, capped at 80vw. Text is never
  clipped.
- The tiny header `BottleGauge` returns as the precise fill % readout alongside
  the ambient background fill; `BottleCollection` stays as header icons.
- `win`/`bottleComplete` effects now surge the full-screen surface (a brief rise
  + splash + droplets + bloom) instead of a glass pour.
- Initial scaffold: Vite IIFE build, React root, `CorpanGames["juice_squeeze_fire"]`
  registration, dev console forwarder, boot screen with synchronous `window.__jsf`
  debug surface for on-device CDP inspection.
- Floating action controls (🍊 / 🎧 / 👁) moved to a full-width, evenly-spaced bar
  just above the word bank so they never overlap the words.
