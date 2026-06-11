# Changelog — beatlounge

All notable changes to this pack are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **Melody corpus — compose without tapping every note.** A new key- and
  mode-agnostic library (`src/music/melody/`) of 351 generated contour cells plus
  two probability banks — per-sixteenth metric-onset profiles (downbeats high,
  pre-downbeat ≈ 0) and degree-transition tables (stepwise / arpeggiac /
  pentatonic) — driving endless, non-repeating, LLM-free melody generation.
  Degrees resolve against the global harmony (any mode/maqam) and a tiny
  degree→pitch bridge carries non-12-TET detune. Foundation for the score's +/−
  layer dial and auto-play; see `docs/MELODY_CORPUS.md`.

### Changed
- **Fewer, more intentional Stage tiles + a single header convention.** Module
  bodies no longer repeat their own title or carry a play/stop button — the
  shell's immersive header owns the title and the one global transport. Grooves
  and Pads are no longer standalone tiles: Grooves stays embedded in the Drums
  and Phrase-Jam drawers, and the velocity Pads surface now folds into the Drums
  module as a "Pads" tab. The Song tile is renamed **Rhythmic Cycle** (this
  loop's length / meter / tempo). The Grooves density panel reflows cleanly from
  ~320px to iPad.

### Fixed
- **Reliable load/unload — no more black screen on reload.** The pack and every
  module now tear down their React root via a shared deferred, once-only
  `unmount()` (microtask, never synchronously mid-render), so a host reload can
  no longer interrupt React mid-commit and detach the DOM (`NotFoundError` →
  black screen). The pack root's rig dispose is per-subsystem try/catch so one
  failing dispose can't blank the screen. The AudioContext now resumes ONLY from
  a real user gesture (the scratch turntable no longer attempts an off-gesture
  resume), silencing the "AudioContext was not allowed to start" spam. The IDB
  open no longer caches a stuck/slow connection — it retries on the next call
  (jittered) and first paint always falls back to the in-memory default.

### Added
- **Explicit track naming + rename + N-synth navigation.** Every track is now
  named by its KIND, never by its content: synths are "Synth 1", "Synth 2", …
  (uniquely numbered so a name never collides with a surviving strip after a
  delete), drums stay "Drums", and the phrase/fragment track is "Phrases" — a
  placed phrase no longer becomes the track name ("I will always…"). Track names
  are now editable everywhere they appear: tap the name in the mixer (or the
  Synth editor) to rename it (`setTrackProp prop:"name"`, one undo step). The
  **Synth (piano-roll) editor gained a track switcher** — chips of the N melodic
  synth tracks with the active one marked, plus an "Add" affordance — matching
  the Instruments and Analog pages, so you can finally get to and edit every
  synth track. The synth editors agree on which tracks they target (melodic =
  non-drum).
- **Global Harmony engine + the top-level Harmony bar.** Harmony (tonic, scale/
  mode or chord progression, tuning, reference pitch) now lives once on
  `doc.harmony` and every melodic module reads it through one pure resolver
  (`music/resolver.ts` — `harmonyAt` / `activePitches` / `chordAt` /
  `quantizeToHarmony` / `inHarmony` / `detuneForMidi`). Modal and chordal modes
  resolve to the SAME active-pitch set, so consumers never branch on mode.
- **Harmony module replaces the Composer's chord text input.** "Both in one
  Harmony bar": a tonic/key picker, a Mode⇄Progression toggle, a family→scale
  picker (Western · Thaat · Melakarta · Maqam, with a microtonal flag) that shows
  the resulting note row, a **visual chord grid across the loop's beats** (tap a
  beat → pick a chord from a root/quality palette; sustained chords tie), and a
  "browse 994 progressions" picker that drops a ready-made progression in. The
  free-text chord field is gone; every edit is one undo-friendly command.
- **Piano-roll and Ribbon follow the song.** The piano-roll highlights the global
  active pitch set and the ribbon frets/snaps to it (`In key`), with a `Free
  glide` opt-out — change the song's mode or chords and both update live. The
  ribbon's private key/mode controls were retired in favour of following the
  global harmony. Microtonal tunings (just/Pythagorean) and maqam carry an exact
  detune via `detuneForMidi` (audio-edge wiring is a follow-up; 12-TET locking is
  live). Persisted pre-harmony songs migrate to modal C-major on load.
- **The Instruments page is now a PLAYABLE instrument.** The browse-and-audition
  flow is replaced by a premium multitouch play surface: a continuous-pitch
  "string field" (X = pitch, stacked octave rows) that performs the bound track's
  voice live. It's polyphonic — every finger is its own voice — and dragging a
  finger glides pitch smoothly (fretless / Theremin feel). Three play modes:
  **Fretless** (continuous), **Chromatic** (continuous + semitone reference
  markers), and **Scale** (snaps to the song's scale via the global Harmony
  engine when present; chromatic until then). Picking a preset re-voices the
  track and you hear it by playing — the standalone "Audition" button is gone.
- **A richer synthesis palette.** The instrument corpus grew from 31 to 45
  hand-tuned presets — Wurli, DX Piano, Reese & Synth Bass, Mono & Chip Lead,
  Analog & Halo pads, Harp, Vibraphone, Flute, French Horn, Metallic, Riser and
  more — every family now several voices deep.

### Fixed
- **The Analog synth can no longer wreck your drum track.** Selecting the stray
  "Drums" chip in the Analog synth and tapping "Make analog" used to turn the
  drum track into a synth and destroy it ("no drum track"). The analog surface
  now treats ONLY melodic (non-`drumSampler`) instrument tracks as targets: no
  "Drums" chip, no drum-track fallback in the resolver, and a drum-track mount
  hint is refused. When a song has no melodic track yet, "Make analog" now ADDS
  a fresh synth track and makes THAT analog, leaving Drums/Pads untouched.

### Changed
- **Grooves: a granular +/− density dial replaces the Scatter / Clear + Scatter
  buttons.** The two big word-buttons are gone for a compact, icon-forward − / +
  control on the targeted rows. **+** lays one more probabilistic layer of the
  selected groove (ADDITIVE — keeps what's there, re-rolls a fresh sprinkle each
  tap, gradually denser). **−** thins the row, removing a fraction of the current
  hits lowest-emphasis/off-beat first, each tap thinner, down to nothing — and a
  − removes a smaller bite than a + adds ("harder to take away than to add").
  Each tap is one undo step, grid-only (never auto-plays). **Phrases are now far
  sparser than drums**: a phrase + uses a dramatically lower per-tap placement
  density (~90% sparser) so it drops only a handful of well-placed words instead
  of one on every 8th — build phrase density with more + taps. New pure engine
  op `chooseHitsToSparsify` (off-beat/quiet first, down to empty) plus
  `denser`/`sparser` actions; unit-tested.
- **Synth editor: dropped the "Arpeggiate" / "Octave Up" boilerplate buttons.**
  They laid down a stock rising scale on tap; the piano-roll edits notes, so the
  header is now just the track switcher + rename + Clear. (The arpeggiate /
  transpose actions stay registered for the assistant's command bus.)
- **Phrase Jam now mirrors the Drums page.** The page was rebuilt on the SAME
  shared track-studio building blocks as Drums so the two can't drift: a selectable
  lane grid (`<LaneGrid>` — one row per saved snippet, lane heads select to target
  groove scatter, hard-won line-height label centering preserved), the full-width
  bottom pipeline drawer (`<TrackDrawer>` with tabs **Grooves · Effects · Mixer** —
  no Kit, since phrases have no drum kit), and a header consistent with Drums
  (global transport + track volume/pan + Clear). The drum page was refactored to
  consume the same extracted components, rendering identically.
- **No more semitone/scale on phrases.** Removed the per-lane −/+ semitone steppers
  (phrases are spoken sounds, not notes — snippets place at centre pitch), the
  "Scramble" header button (Scatter in the drawer replaces it), and ALL scale UI
  from the pitch ribbon (no Chromatic/Major/Pentatonic pills, no key/cents readout,
  no snapping).
- **Pitch ribbon is a free slide at the TOP.** Moved above the grid (it used to be
  pinned at the bottom where it overlapped the drawer) and turned into a continuous
  low → high slide that bends the whole phrase track's pitch live during playback
  (the realtime `applyParam` pitch bend stays; only its scale/cents UI is gone).
- **Grooves panel redesign — probabilistic SCATTER + a two-action box.** The five
  buttons (Apply · Layer · Vary · Evolve · Randomize) collapse to TWO, with the
  primary pinned to the TOP of the action box (no scroll): **Scatter** (the star —
  spread the groove across the selected rows, leaving existing notes) and **Clear +
  Scatter** (wipe the targeted rows first). Each press RE-ROLLS a fresh seed, so
  pressing again gives a different, surprising result (Vary/Evolve baked in;
  Randomize removed — it had nothing to do with the chosen groove).
- **The new apply algorithm.** Applying a groove to selected rows now SPREADS it
  stochastically: for each selected row × each step, a hit lands with a probability
  taken from the groove's per-step emphasis profile (a clave's onsets fire often +
  loud, its rests rarely), at a random velocity within that step's band. With NO
  rows selected the groove still plays on its natural kit voices. Phrase Jam gets
  the same idea — snippets scatter onto the groove's steps probabilistically.
- **Groove corpus schema.** `Rhythm` gains an optional `scatter` override and a
  derived per-cell `GrooveProfile` (`src/rhythm/profile.ts`) — probability +
  velocity band computed from each rhythm's own lanes/accents/ghosts, so all 66
  grooves get a musical scatter profile with no hand-editing (override per-rhythm
  later). The groove brain stays the source of these profiles.

### Added
- **Software-instrument preset corpus + preset browser (fix: every instrument
  sounded the same).** The Instruments browser used to pick a General-MIDI program
  and set a `soundfont` voice — but no GM soundfont asset ships, so EVERY program
  collapsed to one triangle synth. Replaced it with a corpus of ~30 fully
  *synthesized* presets (`src/instruments/presets.ts`) across seven families —
  Keys, Bass, Leads, Pads, Plucks & Mallets, Brass & Wind, FX — each a distinct,
  recognizable voice built on the existing synth / sine-pad / FM / wavetable /
  analog engines (no sample assets). The immersive view now browses presets grouped
  by family; picking one dispatches a single `setInstrument` (one undo step) and
  auditions a short note (never starts the transport). The tile + header show the
  active preset by name. Typed schema + `getPreset` / `listPresets` /
  `presetsByFamily` / `matchPreset` lookups, mirroring the other corpora. Real
  multisampled soundfonts remain a future downloadable path (the engine stays).
- **Multiple instrument tracks.** The browser gains an **Add** affordance that
  spawns a new melodic synth track (voiced to a sensible default preset) plus a
  track switcher to pick which track the browser is editing — so a song can carry
  several distinct synth voices. Pure `newInstrumentTrackInit` helper over the
  existing `addTrack` command, with tests.
- **Drums page rework v2 — the whole drum-track pipeline in one place.** Replaced
  the cramped Grooves/Effects side column with a single FULL-WIDTH bottom DRAWER
  (drag handle + peek/open/expanded states, local to the module, one z-scale,
  safe-area + reduced-motion aware) holding four tabs: **Grooves** (the shared
  panel, now with room to breathe — no truncated names), **Kit** (the `<KitPicker>`
  — the previously-missing kit corpus, 18 kits), **Effects** (the drum-bus
  `<TrackFxChain>`), and **Mixer** (level/pan/mute/solo). When peeked, the grid
  takes the full screen.
- **Drum-lane groove targeting.** The step grid's lane heads are now selectable
  (tap to toggle, clear-all chip). The selection re-points an applied groove:
  **0** selected → the natural role→kit mapping (unchanged); **1** → the whole
  rhythm collapses onto that one voice (a clave can play the kick); **N** → the
  rhythm is distributed across them (signature lane first, then by hit density).
  Threaded through `applyRhythm` / `buildGrooveCommands` / the Grooves Apply ·
  Layer · Vary · Evolve actions, with pure unit tests.
- **Drums grid polish.** Lane cells fill the full row width responsively (the old
  wasted horizontal region is gone now the grid is full-width); selected lanes are
  visually distinct.
- **Drum-kit corpus + parametric drum synth (the 4th corpus).** New `src/kits/`:
  a typed `KitDef` schema (per-voice synthesis params as plain data — no samples,
  no downloads) and a curated repertoire of **18 kits** across three families —
  Electronic (808, 909, 707, techno, house, trap, lo-fi, industrial, synthwave),
  Acoustic (studio/default, rock, jazz brushes, orchestral, vintage 60s), and
  World (Afro-Cuban, Brazilian batucada, Middle-Eastern, Indian tabla). The drum
  instrument (`instruments/drumKit.ts`) is now a **parametric synth** that builds
  its 16 voices from a kit; the default "studio" kit reproduces the original sound
  1:1. Switching kits is **live** — selecting a kit emits one `setInstrument`
  (swap `kitId`, preserve pads) and the synth `update()` rebuilds its voices so the
  new kit is heard immediately, with clean disposal (no node leaks). Ships a
  reusable, premium-dark `<KitPicker>` component (family-grouped browse, active-kit
  highlight, explicit voice preview that never starts the transport) for the drum
  page to embed. See `docs/KITS_CORPUS.md`.
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
- **Drums page is now a complete, self-contained drum studio (founder note).**
  The Drums screen shows the **FULL kit** — one editable lane per voice the kit
  triggers (kick · snare · rim · clap · closed/pedal/open hat · ride · crash ·
  hi/lo tom · conga · cowbell · tamb · shaker · claves), sourced from the kit so
  no groove hit is ever invisible; the lane stack scrolls vertically while the
  playhead, hit-testing and paint-stroke keep working. **Grooves** are embedded
  right in the page (the shared `<GroovesPanel>`, also used by the standalone
  Grooves module) so you browse styles by family and **Apply / Layer / Vary /
  Evolve / Randomize** them while watching the live grid update — no leaving the
  screen. **Layer** is new: it applies a groove *additively* (unioned with the
  existing pattern, de-duped + idempotent) so you can stack a clave over a
  backbeat. The drum bus's **effects pipeline** is embedded too (the shared
  `<TrackFxChain>`, also used by the FX rack) with the realtime param wiring
  intact. Responsive IA with zero clip ~300px → iPad/desktop: grid is the main
  canvas, with Grooves/Effects as a collapsible sheet under it on phone and a
  side panel on wide. Removed the old "fill the hi-hat lane" placeholder button.
  Fixed "Lay phrases on the groove": it now places phrases on the groove's onsets
  (Apply replaces, Layer unions) and, when there's no phrase track / empty bank,
  the toggle is disabled with a **visible hint** instead of a silent no-op.
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
