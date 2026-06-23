/**
 * beatlounge — the ambient SONG-TEMPO source.
 *
 * Tempo-aware audio nodes (the tempo-synced delay; any future beat-locked
 * effect) need the song BPM. Rather than thread `bpm` as a parameter down
 * through createEffect → buildChain → update → the scratch bus, there is ONE
 * global the engine binds to the live document once (see createAudio), and
 * everything reads it directly via `getBpm()`. Single source of truth, read at
 * the moment of use — no prop-drilling, no stale mirrors.
 *
 * Plain module singleton (like the other engine globals) — not React state.
 * Tests can `bindTempoSource(() => 120)` to pin it.
 */

let read: () => number = () => 120

/** Point the tempo source at the live document's BPM (called once at engine init
 *  with `() => currentDoc.bpm`). */
export const bindTempoSource = (fn: () => number): void => {
  read = fn
}

/** The current song BPM (guarded to a sane positive value). */
export const getBpm = (): number => {
  const b = read()
  return Number.isFinite(b) && b > 0 ? b : 120
}
