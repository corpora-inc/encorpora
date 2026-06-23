# Instruments Reorg — ribbon-everywhere (WS-E, frozen spec)

Status: **approved design, pending build.** Sequenced AFTER WS-D (module
consolidation) lands, because both touch `ribbon/RibbonImmersive.tsx` and
`allModules.ts`. The build agent owns `instruments/**`, `ribbon/**`,
`synth-analog/**`, a new `instrument-surface/**`; the integrator owns the
`allModules.ts` edits.

## The one load-bearing insight

There are **two live-play audio paths and they disagree**:

1. `host.playLiveVoice(trackId, midi, vel)` → `createAudio.ts` →
   `graph.liveInstrument(trackId)` → the **bound track's real instrument**
   `.live` pool (`liveVoices.ts`). **Polyphonic**, through the track's
   FX + mixer. Implemented by every melodic engine (`synth`, `fmSynth`,
   `wavetable`, `sinePad`, `monoSynthLive`, `analogSynth`). This is what
   `PlaySurface` uses.
2. `ribbonVoice.ts` (`createRibbonVoice`) → a self-contained `Tone.MonoSynth`
   wired straight to `ctx.destination`. **Monophonic**, ignores inserts/mixer,
   plays the *wrong* sound. This is what `RibbonImmersive` uses today.

**The reorg = marry path #1's audio to the Ribbon's gesture/harmony UX.** The
Ribbon's feel lives in `RibbonImmersive` (comet/frets/`activeMidiInRange`/
`quantizeToHarmony`), NOT in `ribbonVoice`. So: extract the surface, swap its
backend from `ribbonVoice` to `playLiveVoice`, then **delete `ribbonVoice.ts`**.

## What ships

- **New `src/modules/instrument-surface/InstrumentRibbon.tsx`** (+ css), the
  reusable player. Props `{host, store, audio, trackId, record?, quantizeRecord?,
  showRecord?}`. Polyphonic via a per-pointer `Map<pointerId,{handle,midi}>`
  (port `PlaySurface`'s `touches` map). `onDown`→`playLiveVoice`,
  `onMove`→`handle.bend` (guarded on pitch change), `onUp`→`handle.release`.
  Harmony reading is preserved verbatim: frets via `activeMidiInRange(doc,0,…)`,
  in-key snap via `quantizeToHarmony(raw, doc, 0)` read **live** in the pointer
  closure so chord/mode changes apply mid-gesture. Two-button segment kept:
  **In key** (default) / **Free glide**. The `scalePitches`/`quantizeToScale`
  memos RELOCATE here from `InstrumentsBrowser` (do not delete — move).
- **Rewrite `InstrumentsBrowser.tsx`** (keep filename/export): track-switcher
  bar (chips + `TrackNameEdit` rename + per-chip `×` remove guarded against the
  last melodic track) → `<InstrumentRibbon>` headline → voice-type segment
  **Analog · Preset · Osc** (derived from the bound track's `instrument.kind`)
  → bottom `TrackDrawer` (Voice / Effects / Mixer / **Score-slot**) copying the
  Drums-page pattern from `StepGridImmersive.tsx` (`TrackFxChain`, `TrackMixer`).
- **Analog folds in as a voice type, not a module.** Extract the editor body of
  `SynthAnalogImmersive` → `instruments/AnalogPanel.tsx {host,store,trackId}`
  (drop its `TrackBar` + `Keyboard`; keep `live()`/`commit()` verbatim). Keep
  `instruments/analogSynth.ts` engine. **Osc** tab = raw sine/saw/tri/sqr via
  `synthPreset()` (`document.ts`).
- **Record-into-loop**: generalize `RibbonImmersive`'s existing `recordIntoTrack`
  (lines ~172–202) into `InstrumentRibbon`. Subscribe `audio.onPlayhead` →
  `stepForTick`; place `addNote` at `tickForStep(step, grid)` while armed;
  per-pointer `lastRecordedStep` dedupe; `quantizeRecord` prop (default true).
  **INVARIANT: arming Record must NOT start the transport** (setup-don't-play).
- **Score seam (don't build, slot it):** reserve a drawer tab
  `{id:"score", render:() => <ScorePlaceholder trackId/>}`, contract
  `ScoreProps = {host, store, trackId}`. Ribbon = perform/record, score =
  step-edit — two editors of ONE track's `notes`, same `addNote`/`removeNote`
  commands. WS-F fills it.

## Retire

- `ribbonVoice.ts` (after the backend swap).
- `instruments/PlaySurface.tsx` + `instruments/pitchMap.ts` (+ its test) — folded
  into `InstrumentRibbon`; grep for importers first.
- `synth-analog/` UI files (`index.tsx`, `SynthAnalogTile/Immersive`, `Keyboard`,
  `actions`, `styles`) after extraction.
- The standalone **Ribbon module stays** (thin host of `InstrumentRibbon`,
  plays the first melodic track) — it's the quick-perform surface.

## Integrator decisions (LOCKED)

1. **soundfont/sampler fallback:** `playLiveVoice` returns undefined for engines
   without `.live`. The page already excludes drums; presets voice to synthesis
   kinds, so this is rare. Still: when undefined, fall back to
   `host.previewTrack(trackId, vel, midi)` per crossing (stepped but audible).
   GATE it, never throw.
2. **Analog `actions` re-homing:** KEEP the existing action ids; re-home them
   onto `instruments/actions.ts` so "make analog / set cutoff" voice commands
   survive. The integrator does the `allModules.ts` deregistration at merge.
3. **Standalone Ribbon:** KEEP (shared component).
4. **Expression→param (`applyParam cutoff`):** only meaningful for analog/synth;
   wrap in try / no-op for soundfont/sampler.
5. **CSS migration:** move `bl-ribbon-*` + `bl-synth-*` rules WITHOUT losing the
   WebKit `line-height` fret-label/readout centering; visual-diff the ribbon.

## Build order (low-risk)

A. Extract surface as a pure move (keep `ribbonVoice`); `RibbonImmersive` becomes
   a thin wrapper; ribbon `actions.test.ts` green = clean extraction.
B. Swap backend → `playLiveVoice` handle-map; delete `ribbonVoice.ts`.
C. Rewrite `InstrumentsBrowser` (bar + headline + chooser + drawer); drop
   `PlaySurface`; extract `AnalogPanel` + Osc tab.
D. Retire modules; integrator deregisters Analog from `allModules.ts`.
E. Generalize record path; add the Score drawer-tab placeholder.

Test gate: repoint `synth-analog/analog.test.ts` → `instruments/analogSynth.ts`;
new unit tests for record placement (dedupe/quantize on/off) + voice-type→config
mapping + track add/remove/rename re-binding; retire `pitchMap.test.ts`.
`npm run typecheck && npm run test:run && npm run build` green; CHANGELOG line.
