/**
 * beatlounge — seeded RANDOM selection from the mode corpus.
 *
 * Used by "Start fresh → Randomize" to pick a fresh scale. Deterministic from
 * an `Rng` (mulberry32) so a roll is reproducible in tests. By default we draw
 * from the equal-tempered families (western + thaat) so a fresh random start is
 * playable on the 12-TET keyboard; pass families to widen to microtonal corpora.
 */

import { type Rng } from "../chords/random"
import { ALL_MODES, MODES_BY_FAMILY } from "./index"
import type { Mode, ModeFamily } from "./types"

/** The default families a random start draws from — equal-tempered, playable. */
export const DEFAULT_RANDOM_MODE_FAMILIES: readonly ModeFamily[] = ["western", "thaat"]

/** A random mode from the given families (default: western + thaat). */
export const pickRandomMode = (
  rng: Rng,
  families: readonly ModeFamily[] = DEFAULT_RANDOM_MODE_FAMILIES
): Mode => {
  const pool = families.flatMap((f) => MODES_BY_FAMILY[f] ?? [])
  const list = pool.length > 0 ? pool : ALL_MODES
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))]
}
