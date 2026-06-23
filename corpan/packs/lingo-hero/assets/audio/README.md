# lingo-hero — audio assets

This directory is intentionally (almost) empty.

All sound effects in the SFX-haptics stream are **synthesized at runtime** via
the WebAudio API (`src/audio/SynthEngine.ts` + `src/audio/sounds.ts`). There are
**no bundled audio files** — every cue (hit chime, miss thud, combo riser,
milestone arpeggio, menu chime, game-over sting) is generated from oscillators
and filtered noise.

Why pure synthesis instead of `.wav`/`.ogg`:

- **Zero binary weight** in the IIFE bundle — nothing extra to download.
- **Fully offline / no network** — no remote or fetched audio, ever.
- **Royalty-free by construction** — there is nothing to license.
- **Combo melody** — the hit chime walks up a pentatonic scale with the combo
  counter, which is trivial to do procedurally and impossible to do with a
  fixed sample.

If a future stream needs a recorded sample (e.g. a voiced sting), drop the
royalty-free `.ogg`/`.wav` here and load it with `fetch()` against this
directory; the `SynthEngine` master bus + limiter are reusable for playback.
