# Changelog — beatlounge

All notable changes to this pack are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
