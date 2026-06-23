/**
 * beatlounge — track naming BY KIND (pure, no React/store).
 *
 * The founder's core gripe: he couldn't tell what each mixer strip WAS because
 * names were derived from content (a placed phrase became "I will always…") or
 * were ambiguous duplicates. Tracks must be named by their KIND — "Synth 1",
 * "Drums", "Phrases" — never by the notes/phrase they happen to hold, and a
 * freshly-added track must get a name that doesn't already exist in the song.
 *
 * `nextTrackName(existingNames, base)` returns the lowest "base N" (or bare
 * `base` for a singleton kind) that is free, so deleting "Synth 1" then adding a
 * track yields a name that doesn't collide with a surviving "Synth 2".
 */

/** Default display bases for each track kind. */
export const TRACK_BASE = {
  /** A melodic instrument voice (preset or analog). */
  synth: "Synth",
  /** The drum-sampler kit track. */
  drums: "Drums",
  /** The saved-phrase / fragment track (phrase-jam + phrase-sampler). */
  phrases: "Phrases",
} as const

export type TrackBaseKey = keyof typeof TRACK_BASE

/**
 * The next free "<base> N" given the names already in use. Numbering starts at
 * 1 and skips any taken index, so the result is always unique among `existing`.
 *
 * @param existing the names currently in the song (case-insensitive match).
 * @param base the kind base, e.g. "Synth".
 */
export const nextTrackName = (existing: Iterable<string>, base: string): string => {
  const taken = new Set<string>()
  for (const n of existing) taken.add(n.trim().toLowerCase())
  let i = 1
  while (taken.has(`${base} ${i}`.toLowerCase())) i++
  return `${base} ${i}`
}

/**
 * A unique singleton-or-numbered name: returns the bare `base` when it's free
 * (the first/only one of its kind, e.g. "Drums"), else falls back to numbering.
 * Used where one instance is the norm but the model stays open to N.
 */
export const nextSingletonName = (existing: Iterable<string>, base: string): string => {
  const taken = new Set<string>()
  for (const n of existing) taken.add(n.trim().toLowerCase())
  if (!taken.has(base.toLowerCase())) return base
  return nextTrackName(existing, base)
}
