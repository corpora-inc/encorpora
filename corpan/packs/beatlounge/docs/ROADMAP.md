# beatlounge — Roadmap (the big things)

Wave 0–3 shipped a full, playable instrument: tick-accurate sequencer, 7 module
surfaces, instruments + effects + mixer, the phrase-sampler, and autonomous
"knob-tweaker" agents. This is what's left to make it world-class. Ordered by the
founder's stated priorities.

## 1. Mass-effect the grid (the stated #1 — "autonomous knob tweakers", expanded)
The modulation engine + agents already let you (and the LLM) fire autonomous
tweakers. The frontier:
- **Agents that compose over time** — an "arc" agent: a 16/32-bar build → drop →
  breakdown that schedules density/filter/modulator changes across song time
  (needs a lightweight timeline/section model, additive to the doc).
- **Generative pattern agents** — not just param knobs but NOTE generators
  (euclid drift, call-and-response, fill-every-N-bars, humanizing performers)
  that keep re-rolling within musical constraints.
- **Re-targeting modulators** — a tweaker that wanders across *which* param it
  drives, so the texture never sits still.
- **Macro "scenes"** — snapshot a vibe (tempo+swing+fx+modulators) and let an
  agent morph between scenes.
- All of these are just more `Command` bundles + a small scheduler over song
  time; they slot behind the same command bus + the LLM tool DSL.

## 2. Make the on-device LLM real (the headline is currently degraded)
Today the model reports `MODEL_NOT_LOADED`, so the command bar falls back to
keyword routing (works, but not the magic). Needs **host coordination**:
- Does the host auto-load the Qwen3 model for packs, or must the pack call
  `llm.load({modelPackId})`? Which model id? Is it installed by default?
- Add `load`/`isInstalled`/`install` to the pack-facing `LlmApi` and drive a
  proper "AI warming up… / install model" affordance in the command bar.
- Once loaded, validate the `<<tool>>` protocol reliability on-device and tune.

## 3. Native TTS capture — real phrase audio on the grid (host + device builds)
`synthesizeToBuffer` is feature-detected but not implemented; placed phrases use
the synth-vox floor. Build the native plugin (Rust + iOS `AVSpeechSynthesizer
.write` + Android `synthesizeToFile`). **Needs your build coordination** (device
builds), so it's a deliberate, separate track.

## 4. Real sound — samples over synthesis
The drum kit + instruments are synthesized. Source/curate redistributable
one-shot kits + GM/world soundfonts (the spessasynth engine + AssetLoader + the
catalog two-zip delivery already exist) and ship them as downloadable instrument
packs. Biggest perceived-quality jump.

## 5. Architecture cleanup — tile rendering
Each Stage tile mounts its own nested React root (the source of the empty-tile
bug, now worked around by hydrate-first). Render module tile/immersive surfaces
in the main React tree instead (or a single shared root) to remove the nested-
root fragility + the per-tile overhead. Keep the `BeatloungeModule` contract.

## 6. The rest
MIDI import/export (the 960-PPQ model is built for it), song arrangement/scenes,
catalog-driven pack metadata + i18n chrome, and a proper "new song / songs"
browser over the IDB store.
