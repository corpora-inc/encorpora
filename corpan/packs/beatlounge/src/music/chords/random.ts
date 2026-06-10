/**
 * beatlounge — seeded random selection from the corpus.
 *
 * Uses the same mulberry32 stream shape as the rest of the pack so picks are
 * fully deterministic from an integer seed (or any 0..1 RNG function).
 */

import { CORPUS } from "./corpus"
import type { CorpusProgression, ProgressionFamily } from "./types"

/** A 0..1 random source. */
export type Rng = () => number

/** mulberry32 — pack-standard deterministic stream from an integer seed. */
export const makeRng = (seed: number): Rng => {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface RandomFilter {
  family?: ProgressionFamily
  /** Require ALL of these tags. */
  tags?: string[]
  /** Restrict to these modes. */
  modes?: CorpusProgression["mode"][]
  /** Custom predicate (composed with the above). */
  where?: (p: CorpusProgression) => boolean
}

/** The candidate pool after applying a filter. */
const candidatePool = (filter?: RandomFilter): readonly CorpusProgression[] => {
  if (!filter) return CORPUS
  return CORPUS.filter((p) => {
    if (filter.family && p.family !== filter.family) return false
    if (filter.tags && !filter.tags.every((t) => p.tags.includes(t))) return false
    if (filter.modes && !filter.modes.includes(p.mode)) return false
    if (filter.where && !filter.where(p)) return false
    return true
  })
}

/**
 * Pick a progression deterministically from `rng`, optionally filtered.
 * Accepts either an Rng function or an integer seed. Returns undefined only if
 * the filter matches nothing.
 */
export const randomProgression = (
  rngOrSeed: Rng | number,
  filter?: RandomFilter
): CorpusProgression | undefined => {
  const rng = typeof rngOrSeed === "number" ? makeRng(rngOrSeed) : rngOrSeed
  const pool = candidatePool(filter)
  if (pool.length === 0) return undefined
  const i = Math.floor(rng() * pool.length)
  return pool[Math.min(i, pool.length - 1)]
}
