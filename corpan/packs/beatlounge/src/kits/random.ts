/**
 * beatlounge — seeded RANDOM selection from the drum-kit corpus.
 *
 * Used by "Start fresh → Randomize" to drop a fresh kit on the drum track.
 * Deterministic from an `Rng` (mulberry32) so a roll is reproducible in tests.
 */

import { type Rng } from "../music/chords/random"
import { KITS } from "./corpus"
import type { KitDef, KitFamily } from "./types"

/** A random kit (optionally limited to families) — undefined if none match. */
export const pickRandomKit = (
  rng: Rng,
  families?: readonly KitFamily[]
): KitDef | undefined => {
  const pool = families ? KITS.filter((k) => families.includes(k.family)) : KITS
  if (pool.length === 0) return undefined
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))]
}

/** Convenience: a random kit id (defaults to the first kit if the corpus were
 *  ever empty, which it is not). */
export const pickRandomKitId = (rng: Rng, families?: readonly KitFamily[]): string =>
  (pickRandomKit(rng, families) ?? KITS[0]).id
