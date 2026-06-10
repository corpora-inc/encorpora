# Soundfonts (SF2 / SF3) — beatlounge

The `soundfont` instrument (`soundfont.ts`) is backed by **spessasynth** running a
full General-MIDI / SF2 synthesizer inside an `AudioWorklet`. It gives the pack
the entire GM program set plus any world instruments a soundfont contains
(tamburás, sitars, ethnic percussion, orchestral, …) without bundling samples.

## What is and isn't bundled

- **Bundled (in the JS):** the spessasynth DSP **worklet processor**. Vite inlines
  `spessasynth_lib/dist/spessasynth_processor.min.js` as a `data:` URL (verified
  ~395 KB), so `audioWorklet.addModule()` needs no external file. This is why
  `dist/app.js` is larger than the other engines.
- **NOT bundled (a downloadable asset):** the **SF2/SF3 soundfont** itself. These
  are large (a GM bank is 1–150 MB) and must never live in git. They are resolved
  at runtime through the frozen `AssetLoader` seam:

  ```ts
  const bytes = await assets.resolve({ soundfontId })
  await synth.soundBankManager.addSoundBank(bytes, "main")
  ```

## Providing a soundfont in dev

The instrument config addresses a soundfont by `soundfontId`; the host's
`AssetLoader.resolve({ soundfontId })` must return the SF2/SF3 bytes. In the
standalone dev harness the `AssetLoader` is a stub that returns an empty buffer
(see `engine/audioGraph.ts`), so the engine falls back to an audible triangle
synth and logs a warning — nothing is silent.

To hear real GM instruments locally, wire the dev `AssetLoader` (outside this
team's owned files) to fetch a soundfont, e.g.:

```ts
const loader: AssetLoader = {
  async resolve({ soundfontId }) {
    // Any GM SF2/SF3. Recommended small SF3: spessasynth's "GeneralUserGS"
    // (~5 MB SF3) or "SGM" trimmed. Host the file yourself; do not commit it.
    const res = await fetch(`/soundfonts/${soundfontId}.sf3`)
    return res.arrayBuffer()
  },
  async url() {
    return ""
  },
}
```

Drop a `.sf2`/`.sf3` under the dev server's static root and set the track's
`soundfontId` to its basename. SF3 (Ogg-Vorbis-compressed) is preferred for size.

## Program / bank selection

`config.program` (0–127 GM patch) and `config.bank` (CC0 bank select) choose the
voice. Live automation maps `cutoff`→CC74, `resonance`→CC71, `expression`→CC11.

## Fallback policy

If the AudioWorklet is unavailable, the soundfont asset is missing/empty, or the
synth fails to initialize, the engine keeps an audible `Tone.Synth` polyphonic
fallback so a track is never silent. Every fallback path logs a warning
(`console.warn`) — noisy, not silent.
