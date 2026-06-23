# Changelog

All notable changes to the Lingo Hero pack are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.3.0] - 2026-06-23

New mechanic: **Catch the Translation**. The game now teaches by having you
RECONSTRUCT a translation rather than pick a single answer.

### Changed
- **Core content model — "Catch the Translation".** The prompt is now the phrase
  in your **primary** language (`stack.languages[0]` — the language you already
  know, also the UI language), shown large at the top. The **target** (learning)
  language is the first stack language that isn't your primary (single-language
  stacks fall back sensibly). That phrase's translation in the target language
  falls down the three lanes **word by word, in order**, and you catch each
  correct next word as it crosses the strum line. On a catch the word is
  **spoken in the target language** (so you hear the pronunciation), its lane
  ring flashes, score + combo climb, and the word is revealed in an assembling
  **target-phrase strip** under the prompt. Reconstructing + hearing the
  translation, cued by the phrase you already know, is the learning.
- **Difficulty ramp.** Level 1 (low combo) is pure rhythm — only the correct
  words fall, in order. As your combo climbs, **distractor** target-language
  words (real words that are NOT in this phrase) start falling in the other
  lanes; you catch the right next word and **dodge** the foils (tapping a foil
  or letting the correct word pass the strum is a miss). Distractor frequency
  ramps in gently.
- **Uniform, fixed-size word cards.** Every card now carries a single target
  word on one line, always inside the card with padding (shrink-to-fit for rare
  long tokens) — no wrapping, no clipping, consistent geometry across lanes.
- **Tightened glow / composition.** Strong approach bloom is reserved for the
  one catchable target card; distractor cards read clearly but with restrained
  glow so the word you must catch stands out and the bloom never washes out the
  text.

### Added
- **Assembling target-phrase strip** under the prompt that fills in (with a pop)
  as you catch each word, with placeholder slots for the words still to come.
- **One clear instruction cue** ("Catch the translation") above the prompt.

### Fixed / polish
- **One audio control only.** Removed the separate replay/speaker button;
  "hear again" is now **tap the prompt** (it re-speaks the target translation).
  The mute toggle (top-right) is the single, obvious on/off audio control; Exit
  stays top-left.
- **Combo is hidden until you have a streak** (fades in on the first catch) so
  the HUD reads calm at the start of a round.
- Hit/miss feedback stays bound to the specific lane/ring (lane-flash + hit pop),
  and motion is delta-timed so cards visibly fall on any refresh rate.
- Sharpened the headless gameplay e2e: it now asserts a falling card's `y`
  **increases** across frames (guards the old "frozen notes" bug), that catching
  the **correct next** target word scores, and that tapping the mute control does
  **not** score (no tap-through). Exit-code gating.

## [0.2.2] - 2026-06-23

### Fixed
- **Taps on the on-screen buttons (mute / replay) leaked through into a lane**,
  making the controls impossible to use. Input now listens on the canvas itself,
  so taps on the HUD controls never reach the lanes. (Verified in a headless
  browser: a mute-button tap no longer scores; a lane tap still does.)
- **Mute and replay buttons overlapped in the top-right.** The top bar now
  reserves both corners; replay and mute sit side by side without overlapping.
- **Long phrases were shrunk to an unreadable size.** Note text now wraps to two
  balanced lines at a readable minimum size, and the card grows to fit.

### Added
- **Exit button** (top-left) that leaves the pack via the host's `corpan:exit`
  event — no longer dependent on the OS back button.
- Headless-browser **gameplay test + screenshot capture** (`test/e2e/`) that
  asserts the interaction contracts (correct tap scores; button taps don't leak)
  and produces visual proof — the basis for an automated CI gate.

## [0.2.1] - 2026-06-23

### Fixed
- **Correct taps were scored as "missed" in the app — every time.** Input x was
  measured against the *container*, but notes are drawn in the absolutely-
  positioned *canvas*. In the app the host passes its own (unpositioned)
  container, so the canvas and container don't share an origin — every tap
  resolved to the wrong lane. Pointer x is now measured against the **canvas's**
  bounding rect (with scale normalization), and input uses unified Pointer
  Events. Added a `ResizeObserver` so lane geometry tracks the container even
  when the game mounts before it's sized. Reproduced + verified fixed in a
  headless browser with an offset container (correct tap: old = no score,
  fixed = scores).

## [0.2.0] - 2026-06-23

The premium **Neon Arcade** release: a billion-dollar-bar rebuild of the single
rhythm-match loop — neon synthwave board, glass UI, real learning depth (meaning
reveal, romanization, audio replay, spaced difficulty, mastery), and procedural
synthwave audio. Also folds in the install fix, artwork, playability overhaul,
and the core scoring-correctness fix that shipped since 0.1.0.

### Added
- **Neon Arcade premium foundation.** A cohesive design-token layer (`--na-*`
  palette / glow + bloom shadows / type scale / spacing / radii / motion) at the
  top of `styles.css` that everything downstream styles from. The event bus now
  carries the target **word identity** (`{ entryId, foreign, english,
  romanization?, lang }`) on `noteHit` / `noteMiss` plus a new once-per-wave
  `wave-resolved` event, so the learning stream can do spaced difficulty and the
  UI can do meaning-reveal. New HUD slots: a romanization line under the prompt,
  an audio-replay button, a post-answer feedback card, and a mastery readout
  (minimal no-ops that keep the game playable). `ContentManager` accepts an
  optional injected `WordSelector` (or a process-wide default via
  `setDefaultWordSelector`) to bias wave content toward due/weak words while
  still guaranteeing distinct entries + distinct English answers.
- **Neon Arcade board visuals.** The canvas (`Renderer`) is rebuilt to the
  Neon Arcade bar: a scrolling synthwave perspective grid floor converging to a
  horizon, volumetric glowing lane shafts + neon edge rails in the `--na-lane-*`
  colors (cyan / magenta / lime, single-sourced from the design tokens), premium
  glass note cards with a top specular sheen, lane-color spine, and an approach
  bloom that swells as a note nears the strum line, plus a glass strum bar that
  leans toward the hottest lane. Hits fire a lane-flash light column + white-hot
  pop ring; misses flush the floor red; the whole board escalates intensity with
  the combo (grid speed, lane glow, strum bloom). The VFX particle / shockwave /
  screen-shake layer now reads the same elevated palette so the board reads as
  one instrument. The Renderer reacts to gameplay through a shared
  `effects/boardState` seam written by the bus-subscribed effects layer, so none
  of this touches `Game.ts`. All Canvas2D, additive-bloom, 60fps-targeted, and
  fully offline (palette resolves from `:root` tokens with matching hardcoded
  fallbacks).
- **Neon Arcade shell + learning surfaces (UI).** Filled the foundation HUD
  slots with a cohesive, token-driven UI: a romanization line tucked under the
  foreign prompt, a glassy audio-**replay** button, a premium post-answer
  **feedback card** (outcome-tinted verdict + foreign → romanization → English
  meaning reveal, wired to the once-per-wave `wave-resolved` event), and an
  in-run **mastery readout** (level · correct/seen · accuracy with a progress
  bar fed from persisted level progress). Added a static synthwave perspective
  grid backdrop behind the canvas. RTL-aware (bidi `dir="auto"` on revealed
  text, mirrored chevrons/bars), contrast-checked, fully offline (no remote
  assets), and reduced-motion safe.
- **Spaced difficulty + mastery (learning depth).** A new `src/learning/*`
  layer gives the loop a memory: per-word correctness is tracked over time in a
  Leitner/SM-2-lite scheduler (`wordStats.ts`), keyed by host entry id and
  scoped per (stack, language), persisted offline-first to localStorage with an
  in-memory fallback. The spaced-difficulty `WordSelector` (`selector.ts`)
  resurfaces **due / weak** words as the quiz target and orders believable foils
  as distractors — biasing choice only, never breaking the distinct-entries +
  distinct-English dedup contract (selected target is validated within the pool;
  distractor weighting is re-deduped after). A **gentle, hysteretic adaptive
  difficulty** (`difficulty.ts`) reads rolling accuracy to lean harder into
  resurfacing when the learner is hot and ease off when they struggle — it
  tunes *content* pressure only and never touches note speed/spawn timing, so
  the calibrated ~7s travel feel is preserved. A live **mastery readout**
  (mastered · learning · due, with a mean-strength progress bar) is surfaced via
  the foundation's `#mastery-readout` HUD slot and on the progression snapshot
  (`mastery` / `difficulty`). Wired with **no Game.ts edits** — the learning
  layer initialises from the progression module (which already receives the bus
  + hostApi) and injects via `setDefaultWordSelector`.
- **Synthwave audio palette (fully offline, procedural).** The WebAudio layer
  splits the master into independent SFX + music sub-buses with a synthesized
  convolution reverb (procedural impulse, no IR files). A new evolving
  **MusicBed** — Cm pad + pulsing sub-bass + a combo-faded arp sparkle layer —
  is driven by a lookahead scheduler; combo swells the music level, lifts tempo
  (84→104 BPM), and cools on streak break (reduced-motion = lower steady level,
  arp suppressed). Every SFX cue was elevated with reverb sends + sub-body, tuned
  to the Cm tonic, plus a subtle per-wave verdict accent. A self-contained neon
  **mute toggle** (token-styled, 44px touch target, safe-area insets,
  localStorage-persisted) mutes the whole bus and pauses/resumes the bed. All
  procedurally synthesized — zero binary assets, no network/fonts.
- **Premium integration.** Merged the four disjoint premium streams (board /
  shell / learning / audio) onto the foundation; verified the non-negotiable
  contracts hold post-merge (distinct-entry + distinct-English wave dedup, TTS
  speaks raw foreign text, `lingo_hero` pack id, delta-timed ~7s note travel,
  fully offline — no remote URLs/fonts/fetch) and that the pack builds to
  `dist/app.js` + `dist/app.css` and registers `window.CorpanGames["lingo_hero"]`.

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
