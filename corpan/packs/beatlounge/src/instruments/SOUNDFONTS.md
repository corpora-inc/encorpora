# Soundfonts (SF2 / SF3) — beatlounge

The `soundfont` instrument (`soundfont.ts`) is backed by **spessasynth** running a
full General-MIDI / SF2 synthesizer inside an `AudioWorklet`. It gives the pack
the entire GM program set plus any world instruments a soundfont contains
(tamburás, sitars, ethnic percussion, orchestral, …) addressed by GM
`program`/`bank`.

A track becomes a real GM instrument by setting its instrument to
`{ kind: "soundfont", soundfontId, program, bank }` — the **Instruments** module
(`src/modules/instruments/`) is the UI that does this: browse by family →
program → one `setInstrument` + an audition.

## The bundled bank — `beatlounge-gm.sf2` (REAL, makes sound)

We ship a compact, fully-original General-MIDI bank so the soundfont engine makes
sound out of the box.

- **File:** `public/soundfonts/beatlounge-gm.sf2` (~26 KB), `soundfontId` =
  `beatlounge-gm`. The build copies `public/` into `dist/`, so it serves at
  `dist/soundfonts/beatlounge-gm.sf2`.
- **What it is:** a preset for every GM melodic program (0..127), grouped into the
  16 standard families, each family a distinct looping synth timbre. It is a
  tasteful GM approximation, not a sampled orchestra — but piano, organ, strings,
  bass, brass, lead, pad, etc. are audibly different and notes sustain.
- **How it's made:** `src/instruments/gmSoundbank.ts` SYNTHESIZES every sample
  from math and writes an SF2 with spessasynth_core's authoring API (Apache-2.0).
  No third-party samples → **CC0 / public domain** (see
  `public/soundfonts/LICENSE.txt`). Regenerate (and re-prove) with:

  ```bash
  npx vitest run src/instruments/gmSoundbank.test.ts
  ```

  That test builds the bank, loads it into the same spessasynth core the worklet
  uses, **renders real audio for many GM programs, asserts it is non-silent and
  that families sound different**, and re-emits the committed `.sf2`. Green ⇒
  audible in the app.

### Swapping in a studio-grade bank

Drop any GM-compatible SF2/SF3 at `public/soundfonts/beatlounge-gm.sf2` (same
basename) — engine code is unchanged. A well-known low-footprint option is
**GeneralUser GS** by S. Christian Collins; its license permits private and
commercial use and bundling, but it asks you not to hotlink its download files,
so it is **not** committed here — host it yourself. SF3 (Ogg-Vorbis-compressed)
is preferred for size; `soundfontUrl` requests `.sf2` by default but passes a
`.sf2`/`.sf3` id through verbatim.

## How the bytes reach the instrument (what the integrator must know)

`audioGraph.build()` calls `instrument.load(assets)` with an `AssetLoader` whose
`resolve()` currently returns an empty buffer (the dev stub). The soundfont
instrument therefore **fetches the SF2 itself**, in this order:

1. **Host `AssetLoader`** — `await assets.resolve({ soundfontId })`. If a real
   Corpán host wires this to return the pack's SF2 bytes, that wins.
2. **Self-fetch** — `GET <base><soundfontId>.sf2`, where `<base>` defaults to the
   relative `soundfonts/` (resolves against the pack's served root → the bundled
   bank). Override globally before boot to point elsewhere (e.g. a CDN or an
   absolute pack-asset URL):

   ```ts
   ;(globalThis as any).BEATLOUNGE_SOUNDFONT_BASE = "https://cdn.example.com/sf/"
   ```

**Integrator action items (zero code required for the default):**

- Ensure `public/soundfonts/beatlounge-gm.sf2` is deployed alongside the pack
  (the build already copies it into `dist/`). With that, GM voices SOUND with no
  further wiring.
- *Optionally* set `BEATLOUNGE_SOUNDFONT_BASE` if the pack assets are served from
  a non-relative location, OR wire the host `AssetLoader.resolve({soundfontId})`
  to return the bytes (e.g. from `corpan-pack://` / IndexedDB) — that path
  overrides the self-fetch and lets large banks be downloadable assets rather
  than bundled.

If every path fails (no asset + no network + no AudioWorklet), the engine keeps
an audible `Tone.Synth` polyphonic fallback so a track is never silent. Every
fallback logs a `console.warn` — noisy, not silent.

## Program / bank selection

`config.program` (0–127 GM patch) and `config.bank` (CC0 bank select; 128 = GM
drum kits) choose the voice. The GM names + families live in
`src/instruments/gmPrograms.ts`. Live automation maps `cutoff`→CC74,
`resonance`→CC71, `expression`→CC11.

## What is and isn't bundled in the JS

- **Bundled (in `app.js`):** the spessasynth DSP **worklet processor** (Vite
  inlines `spessasynth_processor.min.js` as a URL). This is why the soundfont
  engine adds weight to the bundle.
- **A downloadable/bundled ASSET (not in the JS):** the SF2/SF3 itself. We ship a
  tiny one in `public/soundfonts/`; bigger banks should be host-resolved assets.
