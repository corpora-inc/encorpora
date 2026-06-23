# beatlounge — Modularization Audit & Extraction Roadmap

**Status:** DESIGN / PLANNING. Read-only audit. No production code changes are made by this doc —
it is the ordered roadmap for the "global pass on modularization" the founder asked for. The
implementer executes it in controlled, test-gated passes.

> "Always modularize… we are building a scalable juggernaut, so it needs to be properly modularized
> all the time." — the founder

**In-flight (assumed DONE; not re-recommended here):** a separate effort is extracting the
**pipeline drawer** (handle + Grooves/Kit/Effects/Mixer tabs) and the **lane grid + selectable lane
head** into shared components (likely `src/modules/track-studio/`) used by BOTH the Drums page
(`step-grid`) and Phrase Jam (`phrase-jam`). That extraction is the **template** the rest of this
plan follows: pure logic + a shared React surface + the source modules become thin consumers, with
the hard-won WebKit `line-height` lane-head centering preserved. Everything below covers the rest.

---

## 1. Current module map

The pack is already unusually well-layered for its size (~41k LOC). The seams below are the spine —
the plan's prime directive is **preserve them** and pull the scattered code *toward* them.

| Area | Owns | Depends on | Seam quality |
| --- | --- | --- | --- |
| `model/` | The document, command set, pure `reduce`, `commandBus`, `timing` (PPQ math), ids | nothing (pure) | **Clean** — the heart. `reduce.ts` is the one mutation point; `timing.ts` is the one tick/step authority. |
| `contracts/` | `module.ts` (`BeatloungeModule` factory + action schema), `audioFacade.ts`, `engine.ts` | model, sdk | **Clean & frozen** — the load-bearing abstraction; extend additively only. |
| `engine/` | scheduler, audioGraph, createAudio — implements `AudioFacade`, subscribes to the bus | model, instruments, effects | **Clean** — shell never imports a Tone object; mutate via commands, audio reacts. |
| `instruments/` | synths, sampler, soundfont, drumKit, ttsFragment, GM programs | tuning, model edges | Mostly clean; a few private MIDI/freq helpers (see §2). |
| `effects/` | createEffect, params, chainSig, timeDivisions | model | Clean, pure-tested. |
| `model/document.ts` + `store/` | doc shape; `store.ts` (history/undo), `persistence.ts`, `db.ts` (IDB) | model | **Clean** — IDB is centralized in `store/db.ts` (the ONE IDB seam; don't fragment it). |
| `music/` | `harmony.ts`, `ribbonScales.ts`, `tuning.ts`, `jam.ts`, `progression.ts`, `euclid.ts`, `chords/`, `modes/` | tuning | **MIXED** — `tuning.ts` + `modes/` are the new canonical corpus (cents-exact); `harmony.ts` + `ribbonScales.ts` are the **legacy divergent tables** (see §2.1). This is the biggest boundary debt. |
| `rhythm/` | groove corpus + engine (clave/samba/…), profile, roles, targeting | model | **Clean library** — exemplary "corpus as a standalone tested library." |
| `kits/` | drum-kit corpus, voiceForPitch, buildVoice, KitPicker | instruments | Clean library. |
| `phrase/` | tokenize, decode, pipeline, audioSource, audition, bank, combos | host, audio | Clean library; owns the TTS→buffer pipeline. |
| `modulation/` | shapes, ranges, agents, engine (autonomous knob tweakers) | model | Clean, pure-tested. Has its own PRNG (see §2.2). |
| `llm/` | protocol, runtime, tools, keywordFallback | contracts (action registry) | Clean tool-surface; has its own PRNG copy. |
| `bl-ui/` | Knob, Fader, XYPad, Meter, MuteSolo, StepCell, Transport, glyphs, `useDrag` | none | **Good but THIN** — 8 primitives. Many higher-order "primitives" are reinvented per-module (see §2.3). |
| `shell/` | Shell, DockRail, ModuleHost, Immersive, Toast, ErrorBoundary, tileLayout | contracts, registry | Clean shell; nested-React-root-per-tile is a known fragility (Roadmap §5). |
| `host/`, `sdk/` | host bridge, mockHostApi, types | — | Clean host seam. |
| `modules/*` | 16 modules, each `{ index.tsx (factory+mount), actions.ts, *Model.ts, *Tile.tsx, *Immersive.tsx, *.css }` | everything | **The duplication surface.** The contract is clean; the *implementations* copy-paste boilerplate, UI sub-components, and helpers (§2). |

**Good seams to preserve (do not "improve" these into something clever):** the command-bus /
`reduce` single write path; `AudioFacade` as the only UI↔engine seam; `BeatloungeModule` factory +
action registry (one tool surface for the LLM); `model/timing.ts` as the single tick/step authority;
`store/db.ts` as the single IDB seam; corpora (`rhythm`/`kits`/`music/chords`/`music/modes`) as
standalone tested libraries; `runAction` wrapping multi-command actions in one undo batch.

---

## 2. Duplication & drift inventory

### 2.1 The scale/pitch table divergence — the #1 architectural debt

HARMONY_VISION flagged THREE tables. The audit finds **FIVE** parallel western-mode definitions plus
multiple A4/midiToFreq/pitch-name copies. The good news: the **canonical replacement already exists**
(`music/tuning.ts` cents-exact engine + `music/modes/` corpus, which explicitly documents itself as
"the NEW canonical corpus… nothing here imports the legacy tables"). The debt is that the legacy
tables are still wired into live modules.

| Location | Defines | Consumed by | Disposition |
| --- | --- | --- | --- |
| `music/modes/` + `music/tuning.ts` | Cents-exact modes (western/thaat/melakarta/maqam) + the 4 pitch formulas, reference-aware `midiToFreq`/`freqToMidi`, `quantizeToScale`, `detuneCentsForMidi` | (tests only, so far) | **CANONICAL — migrate everyone onto this.** |
| `music/harmony.ts` `SCALES` | 14 western modes + diatonic/chord logic | JAM/composer | Legacy. Re-source from `modes/`; keep chord logic. |
| `music/ribbonScales.ts` `SCALE_MODES` + own `A4`/`midiToFreq`/`noteLabel` | 11 western modes | ribbon | Legacy. Delete table + private A4/midiToFreq; point at tuning/modes. |
| `modules/piano-roll/pitchModel.ts` `MAJOR_SCALE` + `PITCH_CLASS_NAMES` + `pitchLabel` | hardcoded C-major + names | piano-roll highlight | Legacy. Re-source scale from resolver; move names/label to shared util. |
| `music/chords/qualities.ts` western-mode rows | same offsets again | chords corpus | De-dupe against `modes/western.ts` (single source of semitone sets). |

Also duplicated pitch-name/label primitives, three different MIDI→name functions:
`ribbonScales.ts:81 noteLabel`, `piano-roll/pitchModel.ts:81 pitchLabel`, `instruments/sampler.ts:47
noteName` (Tone-based). And `PITCH_CLASS_NAMES`/`KEY_NAMES` literals duplicated across
`pitchModel.ts`, `ribbonScales.ts`, `harmony.ts`, `composerState.ts`, `synth-analog/Keyboard.tsx`,
`ribbon/Ribbon*.tsx`, `llm/tools.ts`.

> NOTE: unifying the *scale tables* couples to the future Harmony resolver (HARMONY_VISION). The
> *pitch-name/label/midi-freq helpers* do NOT — they are a safe quick win extractable today (§6).

### 2.2 The seeded-PRNG copy-paste — the cheapest, safest win

`mulberry32` / `makeRng` / `rngFrom` / `seededRng` is **re-implemented in ≥6 production files** (byte-
identical body) plus ~7 test copies:

| File | Symbol |
| --- | --- |
| `modules/runAction.ts:16` | `mulberry32` |
| `llm/runtime.ts:68` | `mulberry32` |
| `music/jam.ts:76` | `makeRng` (+ `evolveSeed`) |
| `music/chords/random.ts:15` | `makeRng` |
| `modules/grooves/grooveModel.ts:137` | `makeRng` |
| `modulation/shapes.ts:34` | inline hash variant |
| + composer/grooves/synth-analog/drum-pads/phrase-jam tests | re-declared per file |

`evolveSeed`/`nextEvolveSeed`/`rollSeed` (`music/jam.ts:88`, `composerState.ts:108-111`) are the same
seed-stepping logic in two places. **One `util/rng.ts` exporting `mulberry32`, `evolveSeed`,
`rollSeed`, `hashStringToSeed` retires all of it.** The `phrase/pipeline.ts:385` string-hash is a
related but distinct helper that belongs in the same util.

### 2.3 Reinvented UI primitives & the realtime-param triplet

The "live-drag a knob/fader → `host.applyParam(...)` in real time (no doc write) → persist ONE
`setTrackProp`/param on release" pattern is implemented **four times**, and `TrackParamKnob.tsx`'s own
header admits it ("mirror of the fx-rack ParamKnob and the mixer LiveFader"):

| Impl | File |
| --- | --- |
| `TrackParamKnob` | `modules/TrackParamKnob.tsx` |
| `LiveFader` | `modules/mixer/MixerConsole.tsx:150` |
| `ParamKnob` | `modules/synth-analog/SynthAnalogImmersive.tsx:310` |
| `ParamKnob` | `modules/fx-rack/TrackFxChain.tsx:412` |
| inline `liveVol` | `modules/step-grid/StepGridImmersive.tsx:436` |

All wrap a bl-ui `Knob`/`Fader` with the same `useState<number|null>` live-value + `onLive`/`onCommit`
choreography. **Extract one `bl-ui/LiveParam` (or `useLiveParam` hook) that takes a `ParamTarget` +
host + commit command.** This is the single highest-leverage non-scale extraction.

Other reinvented patterns repeated across modules (every module hand-rolls these in its `*.css` /
`*Immersive.tsx`): the segmented/tab strip, the sticky bottom action bar, empty-state placeholders
(present in ~30 module files per the grep), the responsive sheet/drawer scaffold, and the immersive
header (title + close/back). The track-studio extraction (in-flight) covers the drawer + lane head;
the **segmented tabs, sticky action bar, and empty-state** are the obvious next `bl-ui` additions.

### 2.4 Other small duplications

- `clamp(min,max,v)` is inlined as `Math.max(min, Math.min(max, x))` ~69 times. One `util/math.ts`
  (`clamp`, `lerp`, `mapRange`) cleans them up incrementally.
- Title-Case label helper (`w.charAt(0).toUpperCase() + w.slice(1)`) appears in `ribbonScales.ts`
  `modeLabel` and elsewhere → `util/format.ts`.
- Number formatters for knob readouts (`volFmt`/`panFmt` in `TrackParamKnob.tsx`, dB/%/pan in mixer
  and fx-rack) are per-module → `util/format.ts` (`fmtPercent`, `fmtPan`, `fmtDb`, `fmtHz`).
- 16 `modules/*/index.tsx` mount files share a ~60–90-line `createRoot` + tile/immersive switch +
  guarded `root.unmount()` skeleton. A `mountReactModule(mount, {Tile, Immersive})` helper would
  collapse most of each to its props wiring (relates to Roadmap §5 nested-root cleanup — keep it
  small; do NOT block on the bigger single-root rework).

### 2.5 Honest non-duplications (do NOT abstract — YAGNI)

- The corpora (`rhythm`, `kits`, `chords`, `modes`) legitimately have their own shapes; do not force a
  "generic corpus" base type. They already share the right pattern (typed data + pure engine + tests).
- `model/timing.ts` is already the single tick/step authority — the many files that *import* it are
  correct consumers, not duplication. Leave them.
- `store/db.ts` is the single IDB seam — already factored. Don't add per-module IDB.
- Each module's `actions.ts` is genuinely module-specific; the shared part (undo batching, RNG seeding)
  is already in `runAction.ts`. Good.

---

## 3. Proposed target structure

```
src/
  util/                         NEW — pure, dependency-free, exhaustively tested
    rng.ts                      mulberry32, evolveSeed, rollSeed, hashStringToSeed  (§2.2)
    math.ts                     clamp, lerp, mapRange, smoothstep                   (§2.4)
    format.ts                   fmtPercent, fmtPan, fmtDb, fmtHz, titleCase         (§2.4)
    pitchNames.ts               PITCH_CLASS_NAMES, midiToName, pitchClassName       (§2.1, name-only — no scale theory)

  bl-ui/                        primitives only (headless behavior + --bl-* skin)
    LiveParam.tsx / useLiveParam.ts   the realtime-param hook  (retires the 4 copies, §2.3)
    SegmentedTabs.tsx           the tab strip used by every immersive
    ActionBar.tsx               sticky bottom action bar
    EmptyState.tsx              dignified placeholder
    (existing: Knob, Fader, XYPad, Meter, MuteSolo, StepCell, Transport, glyphs, useDrag)

  modules/
    track-studio/               (IN-FLIGHT) pipeline drawer + lane grid + selectable lane head
    _shared/                    NEW — cross-module React surfaces too domain-specific for bl-ui
      mountReactModule.ts       the createRoot/unmount skeleton (16 index.tsx collapse, §2.4)
      ImmersiveFrame.tsx        title + close/back header scaffold
      MixerStrip.tsx            (later) channel strip reused by mixer + track-studio mixer tab
    <each module>               becomes a THIN consumer of the above

  music/
    tuning.ts        (CANONICAL — keep)         cents/ratio/freq engine
    modes/           (CANONICAL — keep)         western/thaat/melakarta/maqam corpus
    resolver.ts      (FUTURE, HARMONY_VISION)   activePitches / chordAt — the one thing modules call
    harmony.ts       slimmed → re-sources scale sets from modes/; keeps chord/diatonic logic
    ribbonScales.ts  DELETE table + private A4/midiToFreq; thin re-export or fold into resolver
    chords/          (keep as library; qualities.ts mode rows de-duped against modes/western.ts)
```

**Boundary rules this enforces:**
- `util/` = pure, no React, no audio, no model. Importable from anywhere, imports nothing internal.
- `bl-ui/` = generic, reusable widgets that don't know about `BeatloungeDoc` semantics. `LiveParam`
  takes a `ParamTarget` + callbacks (the doc-shaped bit) but no store/registry knowledge.
- `modules/_shared/` (+ `track-studio/`) = React surfaces that DO know doc/host semantics but are
  shared across 2+ modules. The dividing line vs `bl-ui`: "does it reference the document model?"
- corpora stay standalone, tested, no React.
- the resolver (future) is the ONLY harmony entry point; the legacy tables are deleted behind it.

---

## 4. Module conventions (codify what already works)

These are the patterns the pack already uses well. A new module/primitive/corpus MUST follow them.

**A `BeatloungeModule` (the factory shape):**
1. `export const createXModule = (deps: ModuleDeps): BeatloungeModule => ({...})` — never edit
   `App.tsx`; wire one line into `modules/allModules.ts`.
2. `id`, `kind`, `glyph` (a known bl-ui `GlyphName`, **no emoji**), `title`, `immersive`, optional
   `tileAspect`, `actions` (LLM-callable), and `mount(mount): ModuleInstance`.
3. `mount` creates its own React root (today), renders `Tile` for `surface:"tile"` or `Immersive`
   otherwise, returns `{ unmount() { try root.unmount() catch {} }, refreshTile }`. (Migrate to
   `mountReactModule` once it lands — §3.)
4. **Setup, don't play:** an applied action only WRITES the document (the grid); it never makes sound.
   Sound comes from the engine reacting to the doc. (Grooves' header states this explicitly.)
5. **Pure logic split from React:** all musical math lives in `*Model.ts` / `actions.ts` (pure,
   tested); the `*.tsx` is the surface. Mutations go through `runAction` → command bus → one undo step.
6. Render only into `mount.container` (**never `document.body`**). Free nodes/listeners/blob URLs in
   `unmount()`.
7. Real-time performance (knobs/ribbons/XY) drives `host.applyParam(target, value)` (no doc write);
   persist exactly one command on release. Use the shared `LiveParam`/`useLiveParam` (§3).

**A `bl-ui` primitive:** headless behavior + `--bl-*` token skin; touch/mouse/keyboard; ≥44px hit
targets; ARIA; honor `prefersReducedMotion`. **Preserve the WebKit lane-head `line-height` centering
gotcha** when touching anything that vertically-centers text in a fixed-height cell — that fix is
load-bearing and easy to regress in an extraction.

**A corpus (`rhythm`/`kits`/`music/*`):** typed data + a pure engine + exhaustive tests against
textbook/cited values (the `tuning.ts` standard — Pythagorean 3rd = 407.82¢, comma = 23.46¢). No
React, no audio, no model imports. One barrel `index.ts`.

**Host seams:** consume `BeatloungeHost` / `AudioFacade` / `HostApi` only — never reach into Tone or
the engine internals from a module. Errors are **noisy, not silent** (toast + log).

---

## 5. Ordered, low-risk migration plan

Each phase is independently shippable and test-gated. **Hard rule: an extraction must not regress the
source** — especially the WebKit `line-height` lane-head centering and the immersive-mount fill. The
verification bar for every phase: existing unit tests green + the touched module visually identical in
the REAL embedded app (rebuild dist + reopen), not just standalone.

| Phase | What moves | Why / value | Blast radius | Verify |
| --- | --- | --- | --- | --- |
| **0 — `util/rng.ts`** | The 6+ `mulberry32`/`makeRng` copies + `evolveSeed`/`rollSeed` → one util; update imports | Cheapest, safest, deletes the most lines; removes "which RNG am I using" drift | Wide but mechanical (import swaps); pure functions, identical output | Determinism tests: same seed → same sequence as before; all model/action/jam/groove tests green |
| **1 — `util/math.ts` + `util/format.ts` + `util/pitchNames.ts`** | `clamp`/`lerp`; knob/pan/dB/% formatters; `PITCH_CLASS_NAMES`/`midiToName` (the 3 note-label fns) | Quick wins; removes name-table drift; **does NOT touch scale theory** so it's safe before Harmony | Wide, mechanical | Snapshot the label/format outputs; visual check knob readouts unchanged |
| **2 — `bl-ui/LiveParam`** | Fold `TrackParamKnob`, mixer `LiveFader`, the two `ParamKnob`s, step-grid `liveVol` into one hook/component | Highest-leverage UI extraction; one realtime-param contract; future modules get it free | Medium — 4 call sites, all real-time audio; risk of a dropped `applyParam` smoothing | Drive each knob/fader in the app, confirm live audio + single undo step on release; no doc-write spam |
| **3 — `bl-ui/SegmentedTabs` + `ActionBar` + `EmptyState`** | The tab strip, sticky bottom bar, placeholder reinvented per module | De-dupes ~30 modules' chrome; visual consistency; pairs with the in-flight drawer extraction | Medium — pure presentational; CSS token alignment is the only trap | Side-by-side each migrated immersive; assert no layout/centering regression (esp. lane head) |
| **4 — `modules/_shared/mountReactModule` + `ImmersiveFrame`** | The 16 `index.tsx` mount skeletons + the immersive header | Collapses boilerplate; sets up Roadmap §5 single-root cleanup without doing the risky part yet | Wide but each module independently migratable | Mount/unmount each module repeatedly; no leaked roots/listeners; ErrorBoundary still catches |
| **5 — scale-name/label de-dupe (NON-harmony part)** | `qualities.ts` western rows → reference `modes/western.ts`; remove duplicate `KEY_NAMES` literals | Single source for the semitone *sets* and names, decoupled from the resolver build | Medium — chords corpus is widely consumed | chords + harmony tests green; composer/JAM output byte-identical |
| **6 — Harmony resolver migration (DEEP, see HARMONY_VISION)** | Add `doc.harmony` + `music/resolver.ts`; point ribbon → piano-roll → composer/JAM at it; **delete** `ribbonScales.ts` `SCALE_MODES`, `pitchModel.ts` `MAJOR_SCALE`, `harmony.ts` `SCALES`, `composerState` key/mode | The founder's "one global pitch world"; structurally deletes the divergence | **Large** — every melodic module; microtonal playback path is the real engineering risk | Per HARMONY_VISION §8: module-by-module behind the resolver; each independently verifiable; ship 12-TET first, microtone data correct from day one |

**Stay-as-is (don't over-abstract):** `model/timing.ts` consumers; `store/db.ts`; per-module
`actions.ts`; the corpora shapes; the command-bus/`reduce` path. Resist a "generic corpus base type"
or a "universal module config" abstraction — YAGNI; the factory + typed-data patterns are already the
right amount of structure.

---

## 6. Quick wins vs deep refactors

**Quick, safe, do-now (Phases 0–2, no Harmony coupling):**
- `util/rng.ts` — retire 6+ PRNG copies. (Phase 0)
- `util/math.ts` / `util/format.ts` / `util/pitchNames.ts` — clamp/lerp, formatters, the 3 note-name
  fns + the duplicated `PITCH_CLASS_NAMES` literals. **Pure name/format extraction — explicitly NOT
  scale theory, so it ships before the Harmony engine.** (Phase 1)
- `bl-ui/LiveParam` — collapse the 4 realtime-param impls. (Phase 2)
- `bl-ui/SegmentedTabs`/`ActionBar`/`EmptyState` + `mountReactModule` — chrome de-dupe. (Phases 3–4)

**Deep, coordinated, value-gated:**
- The **Harmony resolver** (Phase 6 / HARMONY_VISION) — unifying the FIVE scale tables. High value
  (the founder's headline "change the chords, everything follows") but couples to the future Harmony
  engine and the microtonal playback path. Do it module-by-module behind `music/resolver.ts`, 12-TET
  first; the cents-exact `tuning.ts`/`modes/` foundation is already built and tested, which de-risks
  it substantially. **This is the only item that should wait** — the rest is independent of it.
- Roadmap §5 single-React-root tile rendering — `mountReactModule` (Phase 4) is the safe on-ramp;
  the full single-root rework is a separate, larger track.

---

## Appendix — key file pointers

- Module contract: `src/contracts/module.ts`; audio seam: `src/contracts/audioFacade.ts`
- Canonical pitch math: `src/music/tuning.ts`; canonical modes: `src/music/modes/index.ts`
- Legacy scale tables to retire: `src/music/harmony.ts` (`SCALES`), `src/music/ribbonScales.ts`
  (`SCALE_MODES`, `A4`, `midiToFreq`, `noteLabel`), `src/modules/piano-roll/pitchModel.ts`
  (`MAJOR_SCALE`, `pitchLabel`, `PITCH_CLASS_NAMES`), `src/music/chords/qualities.ts` (mode rows)
- PRNG copies: `src/modules/runAction.ts:16`, `src/llm/runtime.ts:68`, `src/music/jam.ts:76`,
  `src/music/chords/random.ts:15`, `src/modules/grooves/grooveModel.ts:137`, `src/modulation/shapes.ts:34`
- Realtime-param copies: `src/modules/TrackParamKnob.tsx`, `src/modules/mixer/MixerConsole.tsx:150`,
  `src/modules/synth-analog/SynthAnalogImmersive.tsx:310`, `src/modules/fx-rack/TrackFxChain.tsx:412`,
  `src/modules/step-grid/StepGridImmersive.tsx:436`
- Note-name fns: `src/music/ribbonScales.ts:81`, `src/modules/piano-roll/pitchModel.ts:81`,
  `src/instruments/sampler.ts:47`
- Single seams to preserve: `src/model/reduce.ts`, `src/model/commandBus.ts`, `src/model/timing.ts`,
  `src/store/db.ts`, `src/modules/runAction.ts`
