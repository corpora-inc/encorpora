# Changelog — beatlounge

All notable changes to this pack are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- 50 new software-instrument presets across all seven families (keys, bass,
  lead, pad, pluck, brass, fx), bringing the corpus to 123 voices. Pure data
  over the existing synth / fmSynth / wavetable / analogSynth engines — no new
  assets. (Beat-Lounge-Plus; closes #325.)
- Record-arm button on the Dock-Rail (home strip): arm/disarm the selected synth
  for recording without opening the Instruments page. Binds to the same selected
  melodic track and the existing sticky, persisted record-arm; lit red + pulsing
  when armed. (Beat-Lounge-Plus; closes #336.)
- Home voice switcher: a compact prev / name / next control in the Stage head
  flips the selected synth through the preset corpus (one `setInstrument` per
  step = one undo) without opening the Instruments page. (Beat-Lounge-Plus;
  closes #337.)
- "New…" world form (Scenes): turns one-tap Randomize into a controllable roll —
  each of the eight facets (meter, tempo, key, kit, the three voices, groove)
  shows its rolled value with a lock toggle; Reroll re-rolls only the unlocked
  facets, Create applies the draft as a fresh empty-grid world (one undo). The
  randomizer is refactored to build from an explicit `DraftWorld`
  (`rollDraftWorld` / `buildSnapshotFromDraft`); `buildRandomSnapshot` is now a
  thin all-random wrapper. (Beat-Lounge-Plus; closes #326.)
- Per-facet reroll in the "New…" form: a dice beside each row rerolls just that
  facet and keeps the rest; disabled while the facet is locked. (Beat-Lounge-Plus;
  closes #327.)
- Score note selection: a **Select** mode in the instrument score where you tap
  or **drag across notes** to select a set of them (bold accent highlight + a
  count). Touch-drag uses a finger-position hit-test (iOS-reliable). Selection
  clears on mode-off / track-switch and exposes the selected note ids for the
  upcoming +/− and evolve-on-selection actions. Scoped to the Score — Drums'
  paint behaviour is unchanged. (Beat-Lounge-Plus; closes #331.)

### Fixed
- Scratch empty-state no longer looks broken: with an empty bank the idle
  turntable always renders (instead of a "nothing here" screen), the Effects /
  Phrases toggle is no longer stuck, and tapping "Pick snippet" opens the Phrases
  loader instead of an empty dropdown. (Beat-Lounge-Plus)
- Home voice switcher: a long instrument name no longer pushes the next arrow off
  the safe screen zone — the name truncates in a stable-width slot and the arrows
  hold their position. (Beat-Lounge-Plus)
- Instrument score now shows the **full instrument range** (88-key piano, A0–C8),
  scrollable, instead of a ~3-octave window — notes can be seen and placed
  anywhere. Opens scrolled to ~middle C; the +/− generator still works in the
  singable register. (Beat-Lounge-Plus; closes #394.)

## [0.3.2] - 2026-06-19

### Changed
- Tightened the store/catalog description to a concise, on-brand line
  ("Make music with the language you're learning. Scratch real phrases from
  50+ languages, all offline. No music theory needed.") across the manifest,
  the app's bundled catalog, and `web/data/packs.json`, with all 54 localized
  descriptions updated to match.

## [0.3.1] - 2026-06-18

### Changed
- Updated the pack avatar artwork (regenerated PNG + added an SVG source).

## [0.3.0] - 2026-06-16 — Start fresh: Clear, Randomize, Demos

### Added
- **Start fresh — Clear, Randomize, and Demos.** The Scenes drawer gains a
  "Start fresh" block for drastic change after you've saved. **Clear** wipes the
  song to an empty blank slate (default key, kit and tempo, no notes). **Randomize**
  sets up a whole new world — three synth voices (a bass, a mid, a lead, each
  random within its class), a random drum kit, a random key/scale/progression,
  and a genuinely randomized time signature + beat count (odd meters like 5/4,
  7/8 and 13/8 included — not just 4/4) — but leaves the grid empty, so pressing
  play is silence until you start writing. **Demos** drops a shipped starter song onto the grid: 21
  public-domain pieces spanning classical, folk, blues/early-jazz/spirituals, and
  world/Latin (Ode to Joy, Greensleeves, a 12-bar blues, Hava Nagila, and more).
  All three are one undoable step and reachable by voice via the command bar
  (`clearSong` / `randomizeSong` / `loadDemo`). Every new string is localized
  into all 50 shipped languages (with placeholders + RTL preserved).
- **Tempo-synced delay.** The delay now locks to a note length (default a dotted
  quarter) and derives its time from the song tempo, so changing the BPM — or
  hitting Randomize — re-computes the echo to stay in time. A "Free" chip drops
  back to a raw-seconds delay. Implemented with an ambient tempo source
  (`effects/tempo.ts`) the engine binds to the live doc once, so tempo-aware
  nodes read it directly instead of threading BPM through the graph. Existing
  delays are migrated once on load — their saved time is matched to the nearest
  note length so they stay locked to it (a dotted 1/16 stays a dotted 1/16 as the
  tempo changes); an off-grid time becomes "Free" and keeps its raw seconds.

### Changed
- **The default song is now an empty blank slate** instead of the old rising
  C–E–G–C riff over a four-on-the-floor beat. A fresh open is a calm, silent
  canvas — add your own content, randomize a world, or load a demo.
- Catalog listing: add Javanese (jv), Sundanese (su) and Tagalog (tl)
  `descriptionLocalized` strings, the three languages added app-wide in 0.18.1.
  Music loan-words (beatlounge, scratch, deck, offline) stay international.
  Catalog metadata is served OTA, so this needs no version bump.

### Fixed
- **Record arm is now per-track, sticky and persisted** — it was a single
  transient flag shared across every synth (so arming one voice bled onto the
  others, and turning it off never reliably stuck). Each voice now remembers its
  own arm in a persisted store (`store/recordArm.ts`), shared by the Instruments
  page and the Ribbon; default is OFF, turning it off sticks, and switching
  voices shows that voice's own arm. Record a loop, disarm, and keep playing /
  evolving without laying more notes. A whole-song replace (Clear / Randomize /
  Demo) disarms everything.

## [0.2.1] - 2026-06-13

_The right-to-left release: beatlounge now flips for Arabic, Hebrew, Persian and
Urdu, plus two phone fixes._

### Added
- **Right-to-left layout (Arabic, Hebrew, Persian, Urdu).** The interface now
  flips properly under an RTL language, not just translates. Panel copy
  right-aligns (the rhythmic-cycle "Teental · 4/4 · 96 bpm" line, the instrument
  name box, the phrase picker); the performance ribbon mirrors so high pitches
  sit on the left and low on the right, with its octave arrows and expand button
  following suit; and directional glyphs flip — the play button points left, the
  exit chevron points right. Built on CSS logical properties so left-to-right
  stays pixel-identical. Script subtags decide direction independently of region,
  so an Arabic-script regional tag (e.g. `pa-Arab-PK`) reads RTL while Gurmukhi
  stays LTR. (The piano-roll and track timeline keep their physical left-to-right
  orientation on purpose.)

### Fixed
- **The drums "−" now actually thins the beat.** On the drums home widget, "−"
  was wired to the additive generator, so it layered a new beat on top and could
  *add* hits. It now removes hits with a weighted-random thinning that plucks
  off-beat and quieter notes first and spares the downbeat — surprising each
  press, but always strictly fewer hits, never more. (The displayed density level
  only drops when hits were actually removed.)
- **The mixer pan slider is grabbable again.** On the phone drawer mixer the
  per-track pan had collapsed to a ~5px nub with no track (its wrapper was never
  stretched, only the inner track), so it was almost impossible to use. It now
  spans the row like the level fader above it. (The level fader and the iPad
  console were unaffected.)

## [0.2.0] - 2026-06-13

_GA + the calling card: beatlounge goes stable and the entire interface ships in
50+ languages, with a localized catalog listing to match._

### Added
- **The whole interface speaks your language — 50+ of them.** Every chrome string
  (buttons, labels, hints, empty states, toasts) is now localized into the user's
  native language via a keyed `src/i18n/strings.ts` + `ct()` seam, generated by
  `tools/gen_i18n.py` (codex-cli, one call per locale). Music loan-words stay
  international on purpose — Reverb/Delay/EQ, BPM, note/mode/raga names, the proper
  names of kits and world rhythms. A freshness-gate test keeps every locale in sync.
- **Auto melody expansion — per-track, persisted, always-on.** The Score editor's
  Auto is now a per-track generative conductor that keeps re-walking a flowing
  line each loop wrap, and keeps going after you leave the Instruments screen
  (it runs at the pack level, not the editor). Behind the Auto chip: **Feel**,
  **Motion**, a **Density** +/- stepper, and a new **Variation** control —
  **Lock** (a fixed ostinato), **Evolve** (gradual mutation), or **New** (a fresh
  line every loop). Two armed voices de-correlate so they don't play in lockstep.
  Painting a cell or tapping the +/- layer dial on an armed track hands control
  back to you. The endless line no longer floods undo — it writes transiently, so
  your real edits stay on the undo stack.
- **More Auto melody character.** The generative Auto banks grew: two new Feels
  (**offbeat**, **driving**) and three new Motions (**descending**, **drone**,
  **wide**) — 7 Feels × 6 Motions now feed the conductor, so armed lines have far
  more variety. (Everything was already wired; the corpus was just small.)

### Changed
- **Scratch stage decluttered on the phone.** The main turntable area no longer
  mirrors the **Effects** / **Phrases** buttons (they're the bottom drawer's own
  tabs) — that pair is gone from the stage. The spin transport now shares a row with
  the rate/clock readout (a FIXED-width slot so the value changing each frame never
  shoves the buttons around). The platter is sized so the transport never hides behind
  the drawer. Less crowding, no overlap, nothing clipped.
- **Two turntables is a tablet/desktop feature.** A phone stays single-deck (the deck
  toggle and its header are hidden below the md breakpoint) — a phone has no room for a
  real two-deck console, and dropping it gives the disc the full stage.
- **Tighter drawer peek.** The collapsed Effects/Phrases drawer no longer leaves a dead
  band under the tabs on phones (the full safe-area was padding empty space below a
  top-aligned tab bar); the tabs now sit close to the edge. Shared by every drawer.
- **Drawer mixers are horizontal on the phone.** The in-drawer track mixer (Drums,
  Phrase Jam, Instruments) now uses the same wide horizontal level fader as the
  mixer console on the phone — level on top, pan + mute/solo on one row beneath —
  instead of a narrow vertical strip. The tall vertical fader stays on the iPad.

### Removed
- **Explainer sentences nobody needs to read.** Cut the "the full mixer lives on
  the Mix page…" paragraph under the drawer mixer, a dev-status note on the
  Rhythmic Cycle accent map, and trimmed empty-state / home-tile copy to terse
  fragments. The UI shows what to do by how it looks, not by a sentence to read.

### Performance
- **No more first-entry scratch hitch.** The scratch AudioWorklet compiles once per
  audio session; it used to do that the first time you grabbed the platter, hitching
  the running beat. It now warms the instant you open the Scratch pane — overlapping
  the first snippet's decode and finishing before you scratch — so the beat stays put.
- **The scratch platter spins at 60fps without re-rendering React.** The turntable's
  rotation now writes its CSS variable straight to the disc each frame instead of
  pushing React state every frame (which re-rendered the whole platter + every word
  label and churned the garbage collector — the "audio getting crusty" culprit). The
  readout (rate/clock/word) updates only when it changes, ~8×/s. No visual change.
- **The mixer meters stop churning when the mix is quiet.** The per-frame meter pulse
  cached its track lookup (was two array scans per track per frame) and skips the
  re-render once every meter has settled to dark — so a stopped/held mix no longer
  spins React on every animation frame.

### Fixed
- **The scratch effects rack is remembered.** A master chain you dial in now survives
  leaving the pack and coming back (it was rebuilt empty on every entry).

## [0.1.0] - 2026-06-12

_First public release: the full beat-lounge studio — tick-addressed sequencer +
command bus, harmony engine (modes/maqam/chords), the ribbon + N instruments, the
generative drum density dial, phrase jam/scratch, the mixer + FX rack, and the
squared-off, compact-mobile design standard. Everything below ships in 0.1.0._

### Fixed (on-device Android polish)
- **Harmony scale-system selector no longer wraps funny.** Western/Thaat/Melakarta/
  Maqam overflowed the phone row and wrapped the segmented control into a broken
  two-line block; all four now fit on one row (no scroll) down to ~320px.
- **No OS text-selection / copy-paste callout while jamming.** A long-press on the
  ribbon (or anywhere) could pop the system selection menu — the root's
  `user-select: none` was missing the `-webkit-` prefixes WebKit/Android WebView
  need. Suppressed selection + the touch callout on every element (form fields opt
  back in so BPM / rename / command-bar typing still works).
- **Drums beat grid scrolls horizontally with comfortable cells.** The step cells
  used `minmax(0,1fr)` (crammed to fit), so 8 steps were tiny and 128 unusable. Now
  cells are a fixed 34px and the grid scrolls horizontally — with the drum-name head
  pinned (sticky) on the left so you always know the row. Works 8 → 128+ steps.
- **Grooves +/- bar — tight inset.** The two density buttons were small and centred
  in a wide padded strip (way too much inset on phone); they now fill the bar with a
  tight gutter.
- **Killed the dead strip below the Drums +/- (≈20% of the screen on Android).** The
  bottom safe-area was counted THREE times under the +/- bar — the immersive sheet's
  margin, the drawer body's padding, AND the grooves footer all added
  `safe-area-inset-bottom`. The sheet margin is the single home-indicator clearance;
  dropped the redundant two so the +/- sits just above the gesture bar.

### Fixed (pre-release, from PR review)
- **In-key snapping no longer jumps an octave in sparse modes.** `detuneCentsForMidi`
  tracked the nearest mode degree but lost which octave-candidate won, so a note just
  below the next tonic in a pentatonic (etc.) snapped a whole octave DOWN (≈ −1100¢)
  instead of up (+100¢). Now the winning candidate's octave is carried through.
- **Jazz-blues `#IVdim7` is rooted correctly** — it was at semitone 4 (E/III) instead
  of 6 (F#/#IV), out of step with the same chord elsewhere in the corpus.
- **Duplicate preset-id guard** — the id index fails fast on a collision instead of
  silently dropping a preset.

### Added
- **Stochastic, musical drum-beat GENERATOR behind the +/− dial.** The home Drums
  widget, the Drums pane and the Grooves panel now GENERATE a fresh, surprising
  beat across the WHOLE kit on every press — never a stale stock pattern on three
  drums. A shipped per-(role, step) weight model combines metric ARCHETYPES (kick →
  downbeats, snare/clap → backbeats, hats → swung subdivisions, open-hat →
  off-beats, toms/conga/cowbell/tamb/shaker/claves → sparse syncopated colour) with
  the chosen groove's SIGNATURE onsets, so the result spreads over all 16 rows yet
  feels like the selected world rhythm. Every (role, step) carries a probability
  (strongest capped at 0.92 — even beat 1 is skippable), an emphasis → velocity
  band, and a per-press jitter, so presses vary. `+` raises a density level (a
  denser all-new beat), `−` lowers it (sparser, down to empty); a single `+` from
  empty averages ~5 hits (legitimately 1–10). A contrast curve keeps the strong
  beats frequent and the ~0 beats quiet at low density. New `src/rhythm/{kit,
  archetypes,weights,generator}.ts` + the `generate` action.
- **Shared, persisted "selected groove" store slice** (`store/selectedGroove.ts`):
  one source of truth for the chosen world rhythm across the home widget, the Drums
  pane and the Grooves panel — pick a groove anywhere and it reflects everywhere.
  Defaults to a random groove (never "the first"/son-clave) and survives reloads.

### Fixed
- **The selected synth persists.** The piano-roll kept its bound track in LOCAL
  state, so switching to Synth 3, leaving, and coming back snapped you to Synth 1.
  It now uses the SAME shared selection slice as the Instruments page / ribbon / FX
  (one source of truth), and that slice is now persisted to localStorage — so the
  chosen synth survives a full reload / app restart, not just in-session navigation.
- **Ribbon note readouts are per-finger now.** A single shared readout showed the
  last-touched note, so playing a C3 + an E5 and lifting the E5 left "E5" stranded
  under the C3. Each active finger now carries its OWN note label on its lit marker;
  a chord shows every name and a release clears only that finger's label.
- **Live tile expand button no longer steals a column.** The Ribbon (and Drums)
  home widgets reserved a ~30px right column for the shell's floating expand
  control, so the ribbon strip + surface stopped short of the right edge. The
  expand only overlaps the top-right CORNER (y≈12–40), so the reservation moved to
  just the head row that needs it (the Drums groove label); the Ribbon drops it
  entirely. Now: `[Lock│Free   ⤢] / [octave] / [ribbon full width]` — the surface
  reaches all the way right.
- **Home stops overflowing right on slim phones.** Root cause (found by driving the
  REAL pack at a true 390px viewport over CDP — the Stage measured 514px): the SHELL
  grid used `grid-template-areas` with NO explicit columns, so the stage column was
  `auto` and sized to the tiles' MAX-content, pushing the stage wider than the
  viewport (then `.bl-root`'s `overflow:hidden` just CLIPPED the right of the panels).
  Fixed by giving the shell `grid-template-columns: minmax(0,1fr)` (phone) /
  `auto minmax(0,1fr)` (desktop), and the bento + mini-grids `minmax(0,1fr)` +
  `min-width:0`, so columns shrink to the viewport. Also fit the bottom Dock-Rail on
  slim phones (drop the master meter <460px, smaller buttons + no "BPM" unit <400px,
  rail scrolls within itself as a hard safety). Verified zero overflow at 320/360/390.
- **No groove rejects a drum row — "+" always adds if there's space.** The
  generator could leave a selected "off-groove" row at zero probability, so "+"
  said "no room" / nothing happened. Now every (row, step) keeps a small non-zero
  probability floor (no place is ever a dead zero), AND a "+" that would otherwise
  add nothing forces ONE hit on a free cell — metric-weighted (downbeats favoured)
  but every empty cell has a chance. So "+ on any row, any groove" reliably adds.
- **Clear honours the lane selection on Phrase Jam too** (matching Drums): with
  snippet rows selected, Clear wipes only those; none selected clears the jam.
- **"+ Add effect" opens the effect-type picker (not a silent filter).** On phone
  it was doing a one-tap default insert (always a Filter); now it always reveals
  the full picker (Filter · EQ · Compressor · Distortion · Chorus · Phaser ·
  Bitcrusher · Delay · Reverb · Limiter · Gain) to choose from.
- **The drum density dial is strictly +/- again (no more shuffle).** "+" was
  REGENERATING (clear-then-place) the kit each press — it looked like a reshuffle
  of the same few hits. Now "+" strictly ADDS a fresh stochastic layer ON TOP of
  what's there (keeps every existing hit, unions new ones, de-duped) so repeated +
  genuinely densifies while staying surprising; "−" strictly REMOVES a fraction.
  Either acts on the SELECTED rows, or the WHOLE kit when none are selected — so
  "−" with no selection no longer says "nothing to thin" while hits sit on
  off-groove rows. Dropped the now-unused density-level state + Intensity.

### Added
- **Clear honours the lane selection on the Drums page.** With drum lane heads
  selected, the header Clear wipes ONLY those rows; with none selected it clears
  the whole grid (one undo batch either way). Its tooltip reflects which.

### Changed
- **Streaming header status across all editor panes.** Drums, Piano-roll,
  Phrase-jam and Pads now stream their toasts inline by the track light.
- **Track-editor headers stripped to a tiny Clear; toasts stream inline.** Volume,
  Pan, Mute and Solo are gone from the Drums / Piano-roll / Phrase-jam / Pads
  editor headers + foots — they live in the Mixer drawer, so the header carries
  only a small icon-only Clear (shared `ClearButton`, no translated string). And
  the floating toast — which overlapped the controls and got in the way of rapid
  +/- density taps — now types itself out INLINE in the header next to the track
  light (LLM-stream style, shared `HeaderStatus`), with a tiny inline Undo; it
  never covers a control or reflows the layout. The Drums pane routes every child
  toast (incl. the Grooves dial) through it.
- **Grooves panel, compact on mobile.** The drum-drawer Grooves tab gives the
  rhythm picker the scroll room: the +/- density dial is two small squared buttons
  pinned to the bottom, ALONE — the Intensity slider and the "Plays on its natural
  voices…" / detail copy are cut on phone (the detail returns on iPad).
- **Even the transport play button is squared** now (the unified 8px corner) —
  no circles except true round shapes.
- **Home Harmony tile fixed.** Its popover used `position:fixed` but a Stage tile
  has `backdrop-filter`, which traps fixed descendants — so the full Harmony sheet
  rendered crammed + clipped INSIDE the little tile. It now portals to the pack
  root, opening as a proper full-screen sheet.
- **Squared-off rounding, unified everywhere.** Dropped the over-rounded stadium
  pills: every tappable control — chips, segmented toggles (`Lock│Free`, `3│5│8`),
  Record, command-bar buttons, scratch tool/deck/picker buttons, sampler tabs,
  grooves/song tags, the piano-roll + drums add buttons — now shares ONE 8px
  squared corner (the iOS "continuous corner" feel). Only genuinely-round things
  stay round: the circular transport play button, slider tracks/thumbs, the
  scratch needle/cut bars, fader tracks, grip handles, and tiny circular × remove
  buttons. The Voice drawer's Raw bank drops the repeated "Bare oscillator — shape
  it yourself." line under every wave (the name says it).
- **Instruments header compacted to 3 tidy rows.** The detail-page chrome was
  eating the ribbon's space (harmony, a wrapping chip-row of voices, a full-width
  Record row, plus the ribbon's own controls). Now: row 1 = the harmony summary
  (flex-grow) + a compact **voice dropdown** (switch / rename / remove / add — the
  old wrapping chip switcher collapsed into one control); row 2 = **Lock/Free +
  Record** sharing a line (Record no longer owns a row — it slots into the ribbon's
  control strip); row 3 = the octave window **◀ low · 3│5│8 span · high ▶**. Clean
  at 320 → iPad. The Voice drawer's family banks line up on ONE horizontally-
  scrolling row instead of wrapping into several. The bottom-drawer grab handle
  trimmed 64px → 44px (the platform touch-target floor) with a bolder grip pill —
  just as grabbable, far less vertical space.
- **Scenes moved off the home Stage into the nav.** Scenes (save / load complete
  states) is no longer a home tile — its entry is a button in the persistent
  Dock-Rail that opens the existing Scenes drawer. The module stays registered so
  its save/load actions remain in the command bar's browse picker + the LLM tool
  index. New `hideOnStage` module flag (a module can live in the nav/command
  surface with no Stage tile while keeping its actions + immersive). The Stage
  skips `hideOnStage` modules.

### Verified
- **Scene snapshots fully serialize/deserialize the ENTIRE musical state.** Added
  a rigorous round-trip proof (`snapshot.roundtrip.test.ts`): a maximally-loaded
  doc (multi-preset instrument tracks with multi-insert chains + sends, a fragment
  track, buses with effects, chordal harmony + progression, modulators, non-default
  swing/tempo/meter) snapshots, the live doc is mutated heavily, applies back, and
  every sound-defining field deep-equals the original — with explicit non-aliasing
  and JSON-durability (IDB path) assertions. Audit confirmed all 11 sound-defining
  doc fields are captured (deep-cloned) and only identity/volatile/structural ones
  excluded; no gaps found.

- **The Mixer is now the HOME for the whole mix — effects + modulators folded in.**
  Each channel strip pulls up THAT track's full effects chain inline (the SAME
  shared `TrackFxChain` rack — no parallel FX UI) via an **FX** affordance, and an
  **Open** affordance deeplinks to the track's dedicated detail page: a drum strip
  opens the Drums step-grid, a synth strip opens the Instruments page bound to that
  synth, the Phrases strip opens Phrase Jam. The standalone **Effects** and
  **Players** tiles are retired from Home (their surfaces live in the Mixer now).
- **"Tweakers" renamed to "Players"** (per docs/PLAYERS.md) and re-homed into the
  Mixer as a global Players section, reusing the same autonomous-modulation panel
  (extracted to a shared `PlayersPanel`). Behavior unchanged; the deeper
  Players-protocol rebuild remains a later round.
- **Mobile-first Mixer redesign.** At phone width every strip is a compact card —
  horizontal meter + horizontal level fader + pan + Mute/Solo + FX/Open — so all
  channels and the Players section fit on one phone screen with thumb-reachable
  controls; the per-track FX chain expands cleanly inline. It promotes to the
  classic side-by-side console of tall vertical faders on iPad/desktop (FX-open
  strips expand to a controls-left / rack-right grid). One stylesheet, `--bl-*`
  tokens only.
- **Scratch now uses the FULL shared effects pipeline (one canonical rack).** The
  turntable's master FX is no longer a bespoke fixed-4 panel — it's the SAME
  chainable `FxChainView` drums / instruments / the mixer use: the add-effect menu
  over the WHOLE palette, add / remove / reorder, per-effect power + params + the
  Filter XY pad. Extracted the presentational pipeline out of `TrackFxChain` into a
  backing-agnostic `FxChainView`; `TrackFxChain` is now a thin doc adapter (store
  commands + undo + sends, behavior-identical) and scratch drives the same view over
  the live `ScratchFxBus` (no doc / no undo). Deleted the bespoke `ScratchFxPanel` +
  `scratchFxChain`.
- **Delay effect — tempo-synced note-length presets (every screen).** The shared
  delay card gains quick-set chips — 1/4 · 1/4· · 1/8 · 1/8T · 1/16 — that lock the
  delay time to that note value at the song BPM (the matching chip highlights; the
  free seconds knob stays for fine control). New pure `noteLengthSeconds` helper +
  preset table. Because it lives in the shared pipeline, drums, instruments, the
  mixer AND scratch all get it.
- **Squared-off, iPhone-bezel rounding pass (central).** Tuned the shared
  `--bl-radius*` tokens toward a tighter, consistent iOS "continuous corner"
  scale — cards `14px → 11px`, with a new `--bl-radius-lg: 14px` reserved for the
  large sheets/popovers (immersive sheet, harmony popover) and `--bl-radius-tab:
  9px` for tab bars; the full pill (999px) is now reserved for genuinely pill
  things (status chips, circular icon/transport buttons). Because everything
  keys off the tokens, the whole app reads subtly squarer + more premium in one
  edit. Added a shared squared `.bl-tabbar`/`.bl-tab` component.
- **Switchers that are really tab bars now READ as squared tabs, not pills.** The
  Drums/Phrase-Jam drawer header tabs (Grooves/Pads/Kit/Effects/Mixer) and the
  Instruments synth-track switcher are now roomy, squared SEGMENT bars (one
  squared track with the active segment lifted to a solid accent fill).
- **Instruments — re-entering STAYS on the selected synth (no reset to the
  first).** The persisted `useSelectedInstrument` selection now wins on mount;
  the mount's `trackId` is only a fallback when nothing is stored. (Root cause:
  the page unconditionally seeded from the mount's track — resolved to the FIRST
  melodic track — clobbering a persisted pick.) New pure `seedSelectionOnMount`.
- **Instruments — drawer-at-FULL keeps a mini ribbon playable.** At the tallest
  drawer detent the harmony summary header collapses and the ribbon shrinks to a
  pinned mini height (reserved ~96px) instead of being fully covered — so you can
  play the ribbon while adjusting effects in the drawer at the same time.
- **Home Drums −/+ dial NEVER defaults to "the first" rhythm.** The density dial
  used `RHYTHMS[0]` (son clave) when nothing had been chosen yet; it now defaults
  to a RANDOM world groove (then stays on it / the last-used one between presses),
  matching Shuffle. New pure `resolveDialRhythmId`.

### Added
- **Scratch — a master EFFECTS RACK in the shared drawer.** An optional effect chain
  now sits on the scratch MASTER output (between both decks' bus and the speakers), so
  a few high-value DJ effects colour the whole turntable at once — Filter (with the
  same Cutoff×Resonance XY pad as the mixer), Delay, Reverb, and Crush. It's the FULL
  effect rack from every other screen, mounted in the SAME bottom drawer Drums and
  Instruments use (the "Effects" tab) — not a bespoke popover. The cards reuse the
  shared fx-rack look and the shared effect factory + param schemas, so a knob here
  drives the exact same Tone node the mixer would. Inserts start bypassed (the table
  is clean until you dial one in); a dot on the header tool shows when any is engaged.
  No document coupling — it's a live performance, like the rest of scratch.
- **Scratch — "Phrases" now DISCOVERS from the whole catalog.** The "Phrases" tab in
  the shared drawer is full phrase discovery: search the entire corpus, drill a
  language, audition, and save — reusing the same discovery flow as the Phrases
  screen. Saving loads the new phrase straight onto a deck (aim A or B when two decks
  are up), so finding a phrase and dropping it on the platter is one move. The per-deck
  picker still handles what's already on the table.
- **Groove corpus expanded to 87 world rhythms** (was 66) so random/shuffle stays
  surprising: e.g. mozambique, pilón, bembé, afoxé, frevo, cumbia, salsa cáscara,
  gospel shout, surf, half-time, dubstep, electro, gabber, kpanlogo, bikutsi, paso
  doble, tarantella, waḥda, samāʿī (10/8), deepchandi (14), chautal. Each is
  authored with accents/ghosts so the auto-derived scatter profile keeps random
  placement consistently musical (no per-rhythm weighting needed).
- **Scratch — a master EFFECTS RACK (popup).** An optional effect chain now sits on
  the scratch MASTER output (between both decks' bus and the speakers), so a few
  high-value DJ effects colour the whole turntable at once — Filter (with the same
  Cutoff×Resonance XY pad as the mixer), Delay, Reverb, and Crush. A premium popover
  (the "Effects" button in the header) toggles each insert and tweaks its knobs; the
  rack reuses the SHARED effect factory + param schemas, so a knob here drives the
  exact same Tone node the mixer would. Inserts start bypassed (the table is clean
  until you dial one in); a dot on the button shows when any is engaged. No document
  coupling — it's a live performance, like the rest of scratch.
- **Scratch — a phrase BANK drawer.** Phrase management now lives INSIDE scratch: a
  bottom drawer ("Phrases" in the header) searches the saved phrase bank and loads
  any snippet onto deck A or B (the row marked A/B is what each deck holds), so you
  never leave the turntable to manage what's on the decks. Loading onto B brings the
  second deck up automatically. Reads the same bank data as the per-deck picker.

### Changed
- **Scratch — UNIFIED on the shared bottom drawer (no more dinky popovers).** The
  scratch FX rack and Phrases now live in the SAME drawer surface every other screen
  uses (handle + tabs + sized panel, scrim/peek conventions), instead of two bespoke
  mini-popovers anchored to the crossfader — one surface type, premium and consistent.
- **Scratch — the per-deck phrase picker now OVERLAYS, never reflows.** Opening the
  picker dropdown floats it above the stage (absolutely positioned on its deck) so it
  never pushes the turntable down or resizes the platter — same fix class as the FX/
  phrase surfaces (surfaces overlay the layout, never sit in flow).
- **Home Drums tile — tapping the body now OPENS the Drums pane.** The mini-grid
  (and header) act as the "open Drums" affordance — a tap anywhere but the live
  controls enters the immersive step-grid. The −/+ density dial and Shuffle keep
  working in place (they are siblings of the open affordance, so they never bubble
  to open). The dial + shuffle target the WHOLE kit (no row selection ⇒ all drum
  rows), and Shuffle now leans into delightful randomness — a fresh world rhythm
  (never the current one) clear-scattered across the kit with a randomized
  intensity + density each press. Still grid-only, one undo per press, never starts
  transport.
- **Home Harmony tile — opens the FULL-SIZE harmony form.** The press now opens a
  large, premium, OPAQUE sheet (opaque base under the surface tint, real elevation,
  scrim-dismissed) that hosts the COMPLETE HarmonyPanel (tonic · Mode⇄Progression ·
  chord grid · 994-browser · note row) at a comfortable size — was a cramped popover
  too small for the full form. Resize-clean 320px→iPad; the tile summary stays.
- **Home Ribbon tile — a flat PLAY surface, not a button.** The ribbon strip no
  longer depresses/scales or shifts its background when touched (it's a surface you
  play on directly); the InstrumentRibbon inside still captures the play gesture.
  Live (interactive) tiles in general no longer depress as a whole — their own
  controls give the press feedback.
- **Instruments — a harmony change now snaps the WHOLE SONG into the new key.**
  Changing the mode/scale/progression re-quantizes EVERY melodic track to the
  nearest in-key pitch (drums skipped) in one undo step — was only the bound
  track. Setup-don't-play: it writes notes, never starts the transport.
- **Instruments — the home tile reflects the SELECTED synth.** The tile now binds
  to the same persisted selection the page uses, showing that track's name +
  preset/voice label + family, and updating when you pick a different synth.
- **Instruments — one coherent Voice tab (no more "jump to the analog knobs").**
  The Analog/Preset/Osc segment under the ribbon is gone; the voice pipeline now
  lives entirely in the drawer's Voice tab as ONE browser: families (plus a
  leading **Raw** bank that folds the bare oscillators in as pickable voices) →
  presets. Picking a preset re-voices and STAYS PUT. When the voice is an analog
  patch, an on-demand "Shape this voice" disclosure reveals the analog knobs in
  place — never an automatic jump. (See `src/modules/instruments/VOICES.md`.)
- **Instruments — the ribbon lights ALL held notes.** Multitouch now glows one
  lit marker per active finger (the primary finger keeps the comet/beam), so
  every note you're holding is visible. 60fps — markers are positioned straight
  on the DOM, no per-frame React re-render.
- **Instruments — tap a track to switch, long-press to rename.** Tapping a track
  chip now SWITCHES to it (the common action); renaming requires a ~450ms
  long-press on the name. (The shared `TrackNameEdit` keeps tap-to-rename where
  no switch action is wired.)
- **Instruments — the harmony popover is a solid, premium surface.** The
  top-of-page harmony popover was see-through (the surface tokens carry alpha);
  it now sits on an opaque base with proper elevation and spacing.
- **Scratch — the deck toggle moved to the TOP.** The "One deck / Two decks" toggle
  now sits in a header bar at the top of the scratch view (alongside the new Effects
  and Phrases buttons), freeing the bottom for the crossfader + the phrase-management
  drawer so it never gets overrun. The crossfader stays a horizontal A↔B fader fixed
  at the bottom; the responsive side-by-side (landscape) / stacked (portrait) deck
  layout is unchanged.
- **Scratch — performance layout overhaul.** The two decks now STACK vertically
  (full-width each) so the second deck can never overflow the screen, and the
  crossfader is a real horizontal A↔B fader fixed at the bottom with a fat,
  throwable handle (was a small vertical slider floating in the middle). Each
  deck's transport is now a **Spin** toggle (tap to play at natural tempo, tap to
  stop — one button) plus a **Reverse** button, not separate play/stop. Word
  labels are anchored at each word's START so the active word sits under the
  right-side needle as it lights up (was a quarter-turn behind). Bigger grab
  targets on the platter buttons and the cut fader; platters fill the space.
- **Scratch — a REAL turntable (CONTINUOUS-RATE scrub engine).** The phrase-scratch
  module's granular looper (`Tone.GrainPlayer`) is replaced by a single-read-head
  velocity engine: ONE `AudioBuffer`, ONE floating-point playhead, ONE continuous
  signed rate, interpolated (Catmull-Rom cubic, linear-selectable). An `AudioWorklet`
  processor (loaded via a Blob URL since the pack has no served worklet file) holds
  the wave and integrates `playhead += rate` EVERY sample, continuously, slewing the
  rate (one-pole) toward the target the main thread posts each frame — so the audio
  is always gliding at the finger's speed and never freezes between frames. (The
  earlier position/snap-to-target build froze the playhead for ~13ms of each 16ms
  frame → a distorted DC buzz; this fixes that — slow-scrubbing a word is now
  intelligible.) A `ScriptProcessor` fallback runs the same DSP if the worklet is
  unavailable; the load never crashes.
- **Scratch — the phrase LOOPS.** Past the end the playhead wraps to the start (and
  past the start, to the end), so continuous spinning replays the phrase — a locked
  groove, not a run-off.
- **Scratch — consistent time per revolution + forward = forward.** A fixed
  `SECONDS_PER_REV` (≈2s) maps one disc turn to a fixed slice of audio for EVERY
  phrase, regardless of sample length (a longer phrase just spans more revolutions);
  the mapping is never scaled by duration. Dragging the record forward (clockwise)
  now plays the phrase forward (the direction sign was inverted before).
- **Scratch — needle on the RIGHT, locked to the audio.** The fixed needle moves to
  3 o'clock and its angle convention is corrected so the groove position UNDER the
  needle is exactly the playhead you hear (it previously read ~180° off). The engine
  reports its true playhead back so the needle/visual stay locked. Words are placed
  along the spiral groove at their real buffer-time ranges (spiraling inward across
  revolutions); word times come from a forced-alignment seam (exact `WordTiming[]`,
  else silence-split or even distribution).
- **Scratch — optional second deck + crossfader.** A "Two decks" affordance reveals
  a second turntable (its own snippet) and an equal-power crossfader; the single
  deck is the default and unaffected.
- **Scratch — loop QUANTIZED to the revolution + a single START marker.** The phrase
  used to loop at its raw duration (never a whole number of 2s revolutions), so the
  phrase start landed at a different angle every loop. Now the decoded buffer is
  padded with trailing SILENCE up to a whole number of revolutions
  (`ceil(duration / SECONDS_PER_REV) * SECONDS_PER_REV`) with a short (~22ms) baked
  fade at each phrase↔silence boundary (click-free), so after every loop the playhead
  returns to 0 at an integer number of full disc turns — the phrase START returns
  under the 3 o'clock needle at the SAME angle every time. A single tasteful START
  marker is fixed on the disc at that start-of-phrase groove point (replacing
  per-word markers as the primary reference; subtle word labels remain).
  `SECONDS_PER_REV` is unchanged; the mapping is still never scaled by duration.
- **Scratch — fixed decks at every size.** Each turntable now lives in a reserved,
  fixed-aspect footprint (disc / needle / marker / labels positioned absolutely
  inside it), so spinning a record can no longer grow its box or shove its neighbour
  — decks stay put down to ~320px.
- **Scratch — deluxe, space-filling layout.** The immersive view fills the sheet:
  one large platter + a channel-fader-style Cut on a single deck; a real DJ console
  (deck A | center crossfader column | deck B) when two decks are shown, stacking
  with a horizontal crossfader on narrow screens. Sizes off the available box, no
  lonely corner.
- **Scratch — Cut fader feel.** The Cut now drives its cap imperatively on pointer
  move (zero lag on a fast flick), with a fatter grip cap, a satisfying throw
  matching the platter height, and tap-to-jump for an instant cut.

### Fixed
- **Grooves / Score +/− — no off-grid "phantom" placements.** Every hit/word/note
  the +/− engine lays now SNAPS to the target track's visible grid step
  (`quantizeTick`). World rhythms with finer-than-16th detail (triplet grooves,
  `stepsPerBeat: 3` ⇒ 320-tick cells) and the 16th-grained melody corpus could
  land notes BETWEEN the cells the grid renders — hits you could hear but not see
  or edit. Drum scatter, the natural-voice mapping, phrase scatter, and the melody
  layer (plus auto-play when a grid is supplied) all quantize each placed tick;
  snap collisions de-dupe by (tick, pitch) / (tick, snippet).
- **Grooves / Score +/− — a "+" ALWAYS adds at least one hit (no more "no onsets
  to place").** When the probabilistic roll yielded zero onsets (very sparse phrase
  density) or every rolled onset was already occupied, "+" used to silently do
  nothing. It now re-rolls with a fresh seed (bounded) and, failing that, forces a
  placement on the groove's / metric's strongest onset — so a "+" is always
  audible, with no unbounded retry loop.
- **Grooves — "+/−" with NOTHING selected targets ALL rows.** A phrases "+" with no
  snippet row selected now spreads the groove across EVERY saved snippet (was a
  single random snippet per onset); drums with no selection continue to play all of
  the groove's natural voices.

### Added
- **Scratch — Spin / Hold.** A per-deck Spin/Hold toggle: Spin auto-rotates the
  platter at natural tempo (the phrase plays at normal speed, looping) and the disc
  turns at the matching angular speed; Hold stops the record dead (silence).
  Scratching over the top overrides while in contact and returns to Spin on release.
- **Scratch — single-deck CUT FADER.** A throwable vertical level fader on each deck
  (the scratch "cut") for fast 0→full fade-ins — present even with one turntable,
  composed with the two-deck crossfader.

### Added
- **Home Stage — live mini-widgets.** Tiles can declare `tileInteractive` to be
  a live control surface (rendered un-buttoned so their own controls work)
  instead of a tap-to-open summary; the shell adds one consistent corner
  "expand" control (redirectable via `tileExpandTo`, or suppressed via
  `tileOwnsExpand` when the widget owns its own affordance). Three Home tiles
  are now live: **Drums** embeds the Grooves +/− density dial + a shuffle
  (random world rhythm) bound to the drum track (setup-don't-play); **Ribbon**
  is a play strip bound to the persisted selected synth (the same voice the
  Instruments page edits); **Harmony** opens a premium home popover with the
  full `HarmonyPanel` (changing mode/progression snaps the score).
- **Instruments — Harmony now leads the page.** The harmony bar (tonic +
  Mode⇄Progression + chord grid + 994-progression browser) is extracted into a
  reusable `HarmonyPanel` and mounted at the TOP of the Instruments page as a
  compact one-line summary row that expands to a popover — so the page leads with
  the harmony that governs every voice. The standalone Harmony tile is unchanged
  (it now renders the same panel, plus its jam controls).
- **Harmony → score snap.** Changing the mode / scale / progression re-quantizes
  the bound melody to the nearest in-key pitch (`snapTrackToHarmony`), keeping
  each note's tick / duration / velocity and moving only its pitch — one undo
  step, setup-don't-play (never starts the transport). The score follows the key.
- **The selected instrument persists.** The Instruments page's bound melodic
  track is now a global, document-keyed selection (`store/selectedInstrument.ts`)
  that survives leaving the page and returning, with a graceful fallback to the
  first melodic track when the stored one vanishes.
- **Deeper instrument palette.** The synthesis preset corpus grows to 78
  genuinely-distinct, premium voices across keys, bass, leads, pads, plucks &
  mallets, brass & wind, and FX — each its own oscillator mix / filter / envelope
  (e.g. Moog Bass, Sync Lead, Voices, Trumpet, Atmosphere). Analog, Preset, and
  Osc voice types all remain distinct.
- **Scenes — save, name, and switch between complete states of a loop.** A new
  Scenes module (`src/modules/scenes/`) lets you snapshot the whole musical state
  of the song (tracks, harmony, loop length, tempo/meter, swing, master volume,
  buses, fragment library, modulators), name it, and return to it later. Save the
  current state as a Scene, then evolve the loop and save another — tap any saved
  Scene to load it (the live song becomes that snapshot) and switch A ↔ B ↔ C
  freely. Loading is one atomic, undoable step (a mis-tap is one undo away) and
  leaves the transport running. Default names are date-prefixed with a random
  two-word name (e.g. "2026-06-11 · brave-canyon"); rename inline (double-tap) or
  delete. An unsaved-changes indicator shows when the live loop has drifted from
  the loaded Scene. Scenes persist per-song in their own IndexedDB slice, so the
  live document and its undo history stay lean. The LLM can save a Scene or load
  one by name. Not undo/redo — these are explicit checkpoints you curate.
- **Score — compose a melody with a +/− "layer" dial.** The Instruments page's
  Score drawer tab is now a real melody editor (`src/modules/score/`). Rows are
  the active scale degrees across ~2 octaves, resolved in key via the harmony
  resolver; select a row range to target. The +/− layer dial mirrors Grooves:
  "+" lays one more probabilistic melodic pass (metric profile × transition
  table) into the selected rows — additive, re-rolled each tap; "−" thins the
  current melody (lowest-weight / off-beat first) down to nothing, a smaller bite
  than "+" adds. An optional Auto toggle fills the loop with an endless,
  non-repeating line that re-generates each loop on the global transport. Every
  note resolves through `degreeToPitch`, so changing the song's mode/chords keeps
  the score in key. Pure model in `scoreModel.ts` (unit-tested); setup-don't-play
  (never auto-starts the transport).
- **Command bar — a browsable actions picker (the model is now optional).** A
  grid button opens a panel that lists every module's actions grouped by module,
  each with its plain-language description and a one-tap Run. Actions with simple
  params expose quick sliders / selects / toggles; everything else runs on
  sensible defaults. Running routes through the same live-preview lifecycle as the
  text bar — one undo step, Keep / Reroll (for varying actions) / Undo — so a
  low-power device gets the full power of the command bar with zero LLM. Each
  result is honestly labelled by where it came from ("via assistant" when the
  on-device model interpreted it, "via keywords" otherwise). The text box still
  takes typed commands when no model is loaded; the bar's icons and controls were
  tightened to the pack's tokens.
- **Melody corpus — compose without tapping every note.** A new key- and
  mode-agnostic library (`src/music/melody/`) of 351 generated contour cells plus
  two probability banks — per-sixteenth metric-onset profiles (downbeats high,
  pre-downbeat ≈ 0) and degree-transition tables (stepwise / arpeggiac /
  pentatonic) — driving endless, non-repeating, LLM-free melody generation.
  Degrees resolve against the global harmony (any mode/maqam) and a tiny
  degree→pitch bridge carries non-12-TET detune. Foundation for the score's +/−
  layer dial and auto-play; see `docs/MELODY_CORPUS.md`.

### Changed
- **Home Stage — regrouped + trimmed bento.** Tiles are grouped by adjacency
  (session: Rhythmic Cycle + Scenes; instruments: Instruments + Ribbon +
  Harmony; drums; phrases: Phrases + Phrase Jam + Scratch; mix: Effects + Mixer
  + Tweakers). The standalone Piano-roll ("Synth") tile is removed from Home —
  the in-Instruments Score replaces it.
- **Scratch turntable now feels like real vinyl.** The platter follows your
  finger 1:1 at any speed (no easing/inertia lag during contact — the disc angle
  maps directly to a position in the buffer). A single word is stretched across
  about half the record so you can scrub one word slowly and precisely, with
  baked silence between words so each word is separated and legible. The current
  word is printed on the rotating label. On release the platter coasts with
  friction (a flick throws it; Spin floors the coast at a natural loop), and the
  first phrase now loads reliably (a monotonic load token discards stale async
  decodes so the current selection always wins).
- **Instruments is now one playable page — the ribbon plays the track's real
  voice.** The Instruments page leads with a polyphonic performance ribbon that
  plays the bound track's actual instrument through its FX + mixer (was a
  throwaway mono synth on the wrong sound). It keeps the in-key / free-glide
  feel, frets that follow the song's chords as they change mid-drag, and records
  into the same track. A track-switcher bar renames + adds + removes voices (you
  can't delete the last one), a voice-type segment (Analog · Preset · Osc)
  re-voices the track, and a bottom drawer holds Voice / Effects / Mixer (plus a
  reserved Score step-editor tab). The standalone Analog tile folds in as the
  Analog voice type; the Ribbon stays as the quick-perform surface.
- **Fewer, more intentional Stage tiles + a single header convention.** Module
  bodies no longer repeat their own title or carry a play/stop button — the
  shell's immersive header owns the title and the one global transport. Grooves
  and Pads are no longer standalone tiles: Grooves stays embedded in the Drums
  and Phrase-Jam drawers, and the velocity Pads surface now folds into the Drums
  module as a "Pads" tab. The Song tile is renamed **Rhythmic Cycle** (this
  loop's length / meter / tempo). The Grooves density panel reflows cleanly from
  ~320px to iPad.

### Fixed
- **Tweakers + Effects fill the screen on tablet/desktop.** Both immersive
  panels now stretch edge-to-edge (`flex:1; width:100%`) instead of sitting in a
  narrow column. The tweakers list and the effects chain reflow into a
  responsive grid (one column on a phone, two-plus as the panel widens) so a
  short list no longer leaves a tall empty column on the right; the tweakers
  empty state now centers in the freed space. Clean from 320px to iPad. No
  behaviour, audio, or model change — layout only.
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
