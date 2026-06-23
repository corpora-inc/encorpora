# beatlounge — the voice model (Analog · Preset · Osc, unified)

## What an instrument actually IS

There is exactly ONE engine layer: `src/instruments/createInstrument.ts` maps an
`InstrumentConfig.kind` to a live engine:

| kind          | engine                          |
| ------------- | ------------------------------- |
| `synth`       | subtractive synth / sine-pad\*  |
| `fmSynth`     | FM synth                        |
| `wavetable`   | wavetable synth                 |
| `soundfont`   | GM soundfont (spessasynth)      |
| `analogSynth` | the premium analog synth        |
| `sampler` / `ttsFragment` | (special, not voiced here) |

\* a sine/triangle `synth` with a slow attack routes to the lush sine-pad engine.

**A "preset" is NOT a different engine.** Every entry in `presets.ts` is just a
named, well-tuned `InstrumentConfig` over those same engines. The corpus happens
to be mostly `analogSynth` configs (with a frozen param bag), plus some
`fmSynth` / `wavetable` / `synth` voices. Picking a preset dispatches one
`setInstrument` with that config.

**"Osc" is a special case of the subtractive synth.** The Osc voice type is just
a raw `synth` config with a chosen oscillator (sine/saw/tri/sqr) and a default
envelope — the simplest possible preset, with no character baked in. It exists so
you can grab a bare waveform and shape it yourself.

**"Analog" is the `analogSynth` kind** — and its editor (`AnalogPanel`) is the
knob surface for designing/tweaking that engine's patch.

## The bug this fixes: the surprise "jump to the analog knobs"

The voice TYPE (Analog/Preset/Osc) was *derived* from `config.kind`. Because most
presets ARE `analogSynth` configs, picking a preset flipped the derived type to
"analog", and the editor area swapped from the preset browser to the analog
knobs. The founder experienced this as: "picking a preset jumps me to the analog
knobs." The type segment also lived in a SEPARATE spot (under the ribbon) from the
editor (the Voice drawer tab), so the page had two competing controls.

## The unified model (what we ship)

ONE coherent **Voice tab** in the bottom drawer holds the whole voice pipeline,
top to bottom — nothing under the ribbon, no surprise jumps:

1. **Families rail** — the preset families (Keys / Bass / Leads / Pads / … ) PLUS
   a leading **Raw** bank that folds in the Osc oscillators (sine/saw/tri/sqr) as
   ordinary pickable voices. Osc is no longer a separate "mode" — it's a bank in
   the same browser.
2. **Preset grid** — the presets in the open family. Picking one re-voices and
   **stays put** (the browser does not navigate away).
3. **Tweak (analog) panel** — when the current voice is an `analogSynth` patch, an
   expandable "Shape this voice" section reveals the `AnalogPanel` knobs IN PLACE,
   on demand. It never auto-opens just because a preset was analog. This removes
   the jolt while keeping full sound-design access for the voices that support it.

Switching instruments (the track chips) is smooth: the Voice tab re-derives the
open family from the newly-selected track's voice; no flash/modal/navigation.

## Where the code lives

- `voiceTypes.ts` — pure kind↔type mapping (kept; still the source of the
  default config when you grab a Raw oscillator and for the tile's voice label).
- `presets.ts` — the preset corpus + `matchPreset` (resolves a config back to its
  preset so the browser highlights the active one).
- `InstrumentsBrowser.tsx` — renders the unified Voice tab (families incl. Raw,
  grid, on-demand analog tweak). The old under-ribbon voice-type segment is gone.
- `AnalogPanel.tsx` — the analog knob editor, embedded as the expandable tweak
  panel (unchanged engine seam).
