# Changelog — beatlounge

All notable changes to this pack are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **World-modes corpus + exact pitch math (foundation).** New canonical
  `src/music/tuning.ts` (cents/ratio/frequency math — `equal12`/`pythagorean`/
  `just` tuning systems, the MIDI→mode detune bridge that retunes a 12-TET MIDI
  note to a mode's exact pitch, e.g. a MIDI piano detuned to maqam) and
  `src/music/modes/` — a comprehensive corpus of modes as exact cents-above-tonic:
  19 Western modes, all 10 Hindustani thaats, all 72 Carnatic melakartas, and 12
  principal Arabic maqamat with researched non-12-TET neutral tones + ajnas. Pure,
  fully tested against textbook values; consumed by future harmony work. Does not
  yet touch the existing scale tables. See `docs/MODES_CORPUS.md`.
- **Scratch — a turntable for one isolated phrase.** A new headline widget that
  loads a single saved snippet onto a big vinyl record you drag to **scratch it
  like a record** — continuous, click-free, forward AND reverse. The engine is a
  looped `Tone.GrainPlayer` riding `playbackRate` directly on the shared
  AudioContext (a live instrument, not the transport): the source never
  re-triggers, so moving the rate even through zero / into reverse is gapless —
  **no skips, no clicks**. The finger drives it turntablist-style (drag angular
  velocity → rate; a held finger holds the groove; release coasts back to the
  baseline). A **Spin/Hold** toggle parks the baseline at a normal loop or a held
  record so you can scratch over the top, plus an independent ±12-semitone pitch
  (granular detune) and a bank-snippet picker. Premium dark platter with grooves
  + label, ≥44px controls, safe-area aware, `prefers-reduced-motion` honored (the
  disc holds still; audio scratch still works). Velocity→rate + rotation math is
  a pure, unit-tested helper.

### Changed
- **Continuous audio-param controls are now REALTIME (founder note).** Every
  knob / XY pad / fader / pan slider that drives an audio parameter now changes
  the SOUND CONTINUOUSLY as the finger moves, instead of only on release —
  driving the live node via `host.applyParam` during the drag (no document
  write, no undo spam) and persisting ONE undo step on release. Flagship fix:
  the fx-rack Filter Cutoff × Resonance XY pad swept only when you let go; it now
  sweeps under the finger. Same pattern applied to fx-rack effect param knobs +
  send levels, the mixer track/master faders + pan, the analog synth knobs/XY
  pad, and the drum-pads / piano-roll / step-grid track Volume & Pan. The pitch
  ribbon (already realtime) is unchanged.
- **Phrase Jam polish pass (founder iPad notes).** Four targeted fixes:
  (1) **Scramble now sounds like a riff.** It drew pitches from an unbounded
  pentatonic ladder that climbed with bar position and pinned every cell at the
  +24 clamp once the bar filled; it now draws each column INDEPENDENTLY from a
  bounded ±12 minor-pentatonic palette, so a scrambled bar is varied, modest and
  tuneful (still pure/reproducible from the seed; one undo step).
  (2) **Clear control.** A danger-tinted icon+label Clear button (inline trash
  glyph, ≥44px) sits beside Scramble and empties the grid in one undo step;
  hidden when the grid is already empty (undo covers mistakes — no confirm
  dialog).
  (3) **Ribbon tracks the finger 1:1.** The thumb's `left` no longer eases
  during a drag (an `.is-dragging` class drops the transition); the
  snap-back-to-centre ease on release is preserved. The shared `ttsFragment`
  GrainPlayer grain was tightened (grainSize 0.1→0.05, overlap 0.05→0.025) so
  live detune responds ~2× snappier without warble on normal playback.
  (4) **Scale lock is now a real musical scale.** The opaque semitone-snap
  toggle became a small named scale picker (Chromatic · Major · Major Pent ·
  Minor Pent · Minor), defaulting to **minor pentatonic**. The ribbon snaps the
  live bend to that scale's degrees relative to centre, so scratching lands on
  consonant intervals. Scale math is a pure, tested `snapToScale` helper.
- **Phrase Discovery responsive pass — two-pane master/detail on wide screens.**
  The immersive Discovery screen now fills the available width on big iPad /
  desktop instead of collapsing to a slim column (root cause: `.bl-disc` didn't
  grow to fill the `display:flex` immersive mount). Content is capped at 1280px
  and centered to match the Stage. At ≥900px the body becomes a master/detail
  grid — search + results on the left, the selected phrase's languages and
  n-gram breakdown given room on the right (with a resting "pick a phrase" pane
  when nothing is selected); the per-language rows go two-up (three-up ≥1240px)
  and the Bank becomes a 2-/3-column grid. Below 900px it keeps the existing
  single-column flow (list → tap → slide-over detail) that already worked well.
  Same DOM reflowed via CSS at the shared 900/1240 breakpoints; no IA changes.
- **Responsive Stage foundation — a deliberate bento from ~300px to desktop.**
  The home Stage is now a fixed-column bento grid with `grid-auto-flow: dense`
  (no dead right column): 1 column below 520px (a clean single stack with
  ≥116px, tappable tiles — no overflow/clipping at ~300px), 2 columns at 520px,
  3 at 900px, 4 at 1240px. Tiles map `tileAspect` to spans (square 1×1, wide
  2×1, tall 1×2), collapsing to 1×1 in the phone band so a wide tile never
  overflows. Re-balanced aspects: Drums / Synth / Mixer / Effects stay **wide**
  feature tiles, Phrases is now a **tall** list tile, and Song / Pads /
  Instruments / Analog / Composer / Ribbon / Phrase Jam are compact **square**
  tiles — ending the old "12 left / 1 right" imbalance. Pure span/column helpers
  in `shell/tileLayout.ts` (tested).

### Fixed
- **Phrase Jam tile rendered blank.** Its store selector returned a fresh object
  literal each render, which zustand v5's `useSyncExternalStore` saw as a changed
  snapshot every time → an infinite re-render loop ("getSnapshot should be
  cached") → React bailed and the tile showed nothing. Now selects primitives.
- **Effects tile** is now a project-wide at-a-glance summary (active-insert count
  + a per-track mini chain of effect pills) instead of a single bound track, and
  is guaranteed visible (defensive primitive selectors, min-height cell).

### Added
- **Phrase Jam — sequence saved snippets like drums + a live pitch ribbon.** A
  drum-style step grid where each row is a saved phrase snippet from the bank
  (`doc.fragmentLibrary`) and columns are the loop's steps: tap to place/clear a
  snippet on the beat. Per-lane pitch (−12..+12) re-pitches the same word across
  the bar into a riff. A prominent live pitch ribbon bends the whole phrase
  track in real time (`pitchOffset`) while it plays, snapping back to centre on
  release, with optional scale-lock. A Scramble action (re)places snippets
  stochastically for happy accidents (one undo step).

### Added
- **Wave 3 — autonomous knob-tweakers.** Instead of hand-tweaking, set off agents
  that drive params over time so the loop evolves itself.
  - The `Modulator` model (sine/triangle/saw/square/random/drift shapes, tempo-
    synced or Hz, depth/center in normalized param space) + a modulation engine
    that writes any param each frame via `AudioGraph.applyParam` (respects
    mute/solo, idle when no tweakers exist).
  - Agent presets — **breathe / drift / chaos / evolve / pulse** — and a
    **Tweakers** panel to spawn/edit/remove them; shared one-source-of-truth with
    the command bar's new `vibe` / `automate` / `chaos` / `calm` tools, so
    "make it evolve" / "more chaos" / "calm down" fire autonomous tweakers en masse.

### Added
- **Delay beat-sync presets** — a Sync row (1/4, 1/4., 1/4T, 1/8, 1/8., 1/8T,
  1/16, 1/16., 1/16T) locks the delay to the live tempo, so echoes sit on the
  grid. The active division highlights; the raw seconds knob still works.

### Fixed (device testing)
- **Empty home tiles** — track-bound tiles (Drums/Pads/Synth/Effects) rendered
  nothing because they captured a track id at mount, then App swapped in a
  persisted IndexedDB doc with different ids. Now HYDRATE-FIRST: build the bus +
  modules from the loaded doc; backfill fields added since (buses, modulators…).
- **Pads were all one sound** — the synth drum kit only voiced kick/snare/hat/
  clap; every other pad fell through to the hat. Expanded to a full GM-ish
  synthesized bank (toms/congas/crash/ride/cowbell/shaker/tamb/rim/claves…).
- **Drawer drag jitter** — the immersive sheet had `transition: transform`, so a
  swipe chased the finger with a lag ("two copies"). Drag now writes the
  transform directly with the transition off.
- **LLM command-bar error spam** — when the on-device model isn't loaded it no
  longer calls `chat()` on every utterance (MODEL_NOT_LOADED ×N); it checks
  status first and falls to keyword routing quietly, announcing "AI offline" once.
- Knobs couldn't be turned on iPad — the chrome-bail guard cancelled a control's
  own drag when an ancestor was marked `[data-bl-nocapture]`. Now only nested
  chrome bails.
- Phrase-sampler re-rendered/​re-fetched infinitely (a fresh `getStackConfig()`
  object every render churned the fetch effect's deps). Snapshot the stack once.
- Drum pads auditioned the kick for every pad — `previewTrack` now takes a pitch.

- **Wave 2 — the fan-out (5 parallel teams).** Built the full feature surface on
  the proven spine; integrated in sequence on `melo`.
  - **Instruments & sound:** multi-zone sampler, wavetable synth, real
    **spessasynth** soundfont (SF2/SF3 — worklet inlined, soundfont stays a
    downloadable asset) for GM + world instruments, lush sine-pad, and
    tamburá/tabla/drone/sub-bass/pluck/bell presets over the engines.
  - **Effects & mixer:** all 11 effect kinds (filter/eq3/comp/dist/chorus/phaser/
    bitcrusher/delay/reverb/limiter/gain), per-track insert chains + post-fader
    sends to group/fx buses in the audio graph (rebuild only on structure
    change), an FX-rack module and a mixer console.
  - **Headline · LLM grid:** a closed tool DSL (setTempo/setSwing/density/
    setMood/euclid/humanize) the on-device Qwen3 4B drives through a tolerant
    `<<tool>>` protocol with parse→validate→repair→keyword-fallback so every
    utterance yields a legal result; a command bar with preview + Keep/Reroll/
    Undo, opened from the Dock-Rail.
  - **Headline · phrase-sampler:** browse/search/randomize the corpus → language-
    aware tokenize → 3-tier AudioSource (native `synthesizeToBuffer` → kit →
    synth-vox floor, IDB byte-cache) → place a pitch-performable sampler track;
    a `ttsFragment` GrainPlayer instrument (detune pitch, scratch) wired through
    the audio graph so placed phrases play real audio.
  - **Surfaces:** a scale-highlighted piano-roll and a velocity drum-pad bank.
  - 271 unit tests green; six module tiles + the command bar verified rendering
    in a real headless browser.
- **Wave 1 — shell + design system.** The premium dark UI half, built on the
  frozen spine.
  - Zustand store (`src/store/`) wrapping the CommandBus with debounced
    IndexedDB persistence of the active song (DB "beatlounge", store "songs",
    key "active") + async hydration via `bus.load`.
  - `BeatloungeHost` builder (`src/host/`) with a chrome bridge, matchMedia
    form-factor observer (phone < 600 / tablet / desktop ≥ 1024).
  - `bl-ui` primitive library (`src/bl-ui/`): Transport (Space-to-toggle),
    StepCell (tap + drag-paint), Knob (drag/wheel/arrows/double-tap-default),
    Fader, MuteSolo, Meter — touch + mouse + keyboard, ≥44px hits, ARIA,
    reduced-motion, inline-SVG glyphs (no emoji), pointer-capture chrome-bail.
  - Stage + Dock-Rail + Immersive shell (`src/shell/`) with a single
    `data-bl-chrome` recede owner, one-z-scale, swipe/Esc to exit immersive,
    dignified toast with Undo. Bottom bar on phone, left rail on tablet/desktop.
  - First real module: the **step-grid sequencer** (`src/modules/step-grid/`) —
    read-only mini-grid tile + full interactive immersive grid (kick/snare/hat/
    clap lanes, live playhead, drag-paint, per-track mute/solo/volume) with a
    `clear` + `fillEveryOther` action registry for the future LLM command bar.
  - Tests for the store (dispatch/undo/redo), the grid's step↔tick mapping, and
    the module actions returning valid commands.
- **Wave 0 — frozen spine.** New pack scaffold (`corpan/packs/beatlounge/`),
  the sibling-in-reverse of melopán: a dark, AI-driven, fully-featured beat
  sequencer that also teaches language.
  - Tick-addressed document model at PPQ 960 (`src/model/document.ts`) — up to
    128 beats per loop, exact 16th-triplets/32nds/dotted values, polymeter via
    per-track `lengthTicks`. Tamburás/tablas/drones/sine-pads are presets over
    generic instrument engines, not new code.
  - The one write path: typed `Command` union + pure `reduce()` with structural
    sharing + a `CommandBus` (undo/redo, transient preview keep/rollback,
    snapshot for the LLM). UI, the LLM tool DSL, and the phrase-sampler all
    funnel through it with zero special-casing.
  - Frozen engine contracts (`Instrument`/`Effect`/`Scheduler`/`AudioGraph`/
    `AssetLoader`) and the `BeatloungeModule`/`BeatloungeHost` UI contract that
    scales to infinite widgets and exposes each widget's actions to the LLM.
  - Rich host SDK types incl. the on-device LLM and the requested native
    `synthesizeToBuffer` TTS-capture capability (feature-detected).
  - Design-system foundation: `--bl-*` tokens, dark skins (midnight/noir/aurora),
    one `:root` z-scale, safe-area insets.
  - Pure-layer test suite (timing math, reducer purity/structural-sharing,
    command bus undo/redo/preview) gating the freeze.
