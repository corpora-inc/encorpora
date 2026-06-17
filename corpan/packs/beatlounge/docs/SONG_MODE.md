# Song / Arrangement mode — the 0.2.0 seam (DESIGN ONLY)

**Status: deferred. No code in 0.1.0.** This doc fixes the model + scheduler seam
so 0.2.0 can add multi-part arrangement WITHOUT a rewrite or a migration that
touches existing data. Everything below is forward-compatible with what 0.1.0
shipped — read it before changing `loopLengthTicks`, the scheduler, or the
"Rhythmic Cycle" framing.

## Where 0.1.0 stands (the thing we're extending)

A `BeatloungeDoc` is ONE loop:
- global `loopLengthTicks` (the cycle), `tempoMap`/`meterMap`, `swing`, `harmony`;
- `tracks: Track[]`, each with tick-addressed data (`InstrumentTrack.notes`,
  `FragmentTrack` events) and an optional per-track `lengthTicks` (polymeter —
  a track can loop at its own length inside the global cycle);
- the scheduler reads `loopLengthTicks` and wraps playback; every event `tick`
  is GLOBAL (absolute from the doc origin).

0.1.0 deliberately renamed the "Song" tile to **Rhythmic Cycle** and framed it as
"THIS loop's length / meter / tempo" — i.e. it edits the *current part*, not a
song. That naming is the seam: in 0.2.0 a song is an arrangement OF rhythmic
cycles, and the Rhythmic-Cycle editor keeps editing one cycle (now: the selected
part). No rename churn, no concept the user has to relearn.

## The 0.2.0 model (additive, optional fields)

Introduce parts + an arrangement timeline, both OPTIONAL on the doc so every
persisted 0.1.0 doc deserializes unchanged:

```ts
interface Part {
  id: Id
  name: string                 // "A", "Verse", "Chorus", …
  loopLengthTicks: Tick        // this cycle's length (was the doc's)
  tracks: Track[]              // this part's tracks (part-LOCAL tick data)
  harmony?: Harmony            // per-part harmony (modulate between parts)
  swing?: { amount; grid }     // per-part feel; falls back to doc default
  // tempoMap/meterMap stay GLOBAL on the doc (one tempo spine for the song)
}

interface ArrangementClip {
  id: Id
  partId: Id
  startBeat: number            // placement on the SONG timeline, in beats
  lengthBeats: number          // how long it plays (≥ one part loop; repeats)
}

interface BeatloungeDoc {
  // … existing fields stay …
  parts?: Part[]               // absent ⇒ single-part legacy doc
  arrangement?: ArrangementClip[]   // absent ⇒ loop the one part forever
  activePartId?: Id            // which part the editors (incl. Rhythmic Cycle) edit
  songMode?: boolean           // false/absent ⇒ behave EXACTLY like 0.1.0
}
```

Key decisions:
- **Tempo + meter stay global** (one spine). Parts carry their own LENGTH, and
  may carry their own HARMONY (so a chorus can modulate) and feel; they do NOT
  carry their own tempo map. This keeps the scheduler's time math single-spine.
- **Track identity across parts:** a part owns its own `tracks[]`. For the common
  "same instruments, different notes per section" case, parts reference a shared
  track CONFIG by a stable `trackKey` (instrument/fx/mixer) while owning their own
  event data. (Detail for 0.2.0; the seam only needs parts to hold their tracks.)

## Event addressing: part-LOCAL ticks

Inside a part, event `tick` is LOCAL (0 = the part's own origin), exactly like
`loopLengthTicks` is today but scoped to the part. The SONG position of an event
is computed at schedule time, never stored:

```
songTick(clip, event) = beatsToTicks(clip.startBeat) + (event.tick % part.loopLengthTicks)
                        + repeatOffset      // for clips longer than one part loop
```

This is why the migration is free: a 0.1.0 doc's global ticks ARE already
part-local ticks for a part whose origin is 0.

## Scheduler remap (the only real engine change)

Today the lookahead scheduler walks `[0, loopLengthTicks)` and wraps. In song
mode it walks the SONG timeline and, for each lookahead window, asks the
arrangement which clip(s) are active, then emits each active part's events
remapped through `songTick(...)`:

1. `activeClipsAt(windowStart, windowEnd)` → clips overlapping the window.
2. For each clip → its part → the part's events whose LOCAL tick (mod part loop)
   falls in the window after the `songTick` remap → schedule them.
3. Harmony/`swing` resolve from the active part (fallback to doc).
4. `songMode === false` ⇒ skip all of the above and run today's single-loop path
   verbatim. **The 0.1.0 code path is the `else` branch — untouched, not ported.**

The `host.applyParam` live-perf seam, the diff-driven `audioGraph` reconciler,
and per-track `lengthTicks` polymeter all stay as-is (polymeter operates WITHIN a
part's loop).

## Migration (zero-touch, both directions)

- **Load a 0.1.0 doc:** `parts`/`arrangement` absent ⇒ treat the doc itself as a
  single implicit part (`activePartId = "__main__"`, `songMode = false`). Nothing
  is rewritten on disk; `migrateDoc` only fills defaults in memory, mirroring how
  `harmony?` is handled today (`docHarmony`).
- **Enter song mode the first time:** wrap the current doc's loop into
  `parts = [Part("A", loopLengthTicks, tracks, harmony)]`,
  `arrangement = [Clip(partId:A, startBeat:0, lengthBeats: oneLoop)]`,
  `songMode = true`. Reversible: leaving song mode with one part restores the
  flat view.
- **Accessors** (mirror `docHarmony`): `docParts(doc)`, `activePart(doc)`,
  `docArrangement(doc)` always return a valid value for legacy docs, so no
  consumer branches on presence.

## Forward-compatibility checklist (what 0.1.0 already did right)

- **Rhythmic Cycle** edits "this cycle" → in 0.2.0 it edits `activePart` with no
  rename. ✔
- **Per-track-type focused entry** (Drums/Synth/Phrase workspaces, deferred in
  0.1.0) is part-agnostic: a workspace targets tracks, which become the active
  part's tracks. ✔
- **Global harmony** is already a single doc field read through a resolver; making
  it per-part is "resolve from active part, fall back to doc" — additive. ✔
- The **melody score** and **groove dial** write a track's events at LOCAL ticks
  already (they never assume a song timeline), so they keep working inside a part
  unchanged. ✔

## Explicitly NOT in scope for the seam

Section UI (arrangement lane, drag clips, part chips), per-part instrument
overrides, song-length export, and clip-level automation are 0.2.0 BUILD work.
This doc only guarantees the model + scheduler can grow into them without a
migration or a rewrite.
