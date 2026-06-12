/**
 * beatlounge — pick a random world rhythm. Pure + seedable so the "shuffle a
 * groove" affordance (Drums home widget) is testable and reproducible: pass an
 * `rng` returning [0,1) and it picks a rhythm id deterministically; optionally
 * `avoid` the currently-loaded one so a re-roll always lands somewhere new.
 *
 * "Infinitely variable, satisfying results" = a random rhythm choice + the
 * scatter engine's fresh per-press seed (the caller still re-rolls the scatter).
 */

import { RHYTHMS } from "../../rhythm"

/**
 * A random rhythm id from the corpus. `avoid` (e.g. the currently-selected one)
 * is excluded when there is more than one rhythm, so a shuffle never no-ops by
 * landing on the same groove. Falls back to the first rhythm for an empty rng.
 */
export const pickRandomRhythmId = (
  rng: () => number,
  avoid?: string
): string => {
  const pool =
    avoid != null && RHYTHMS.length > 1
      ? RHYTHMS.filter((r) => r.id !== avoid)
      : RHYTHMS.slice()
  if (pool.length === 0) return RHYTHMS[0]?.id ?? ""
  const i = Math.min(pool.length - 1, Math.max(0, Math.floor(rng() * pool.length)))
  return pool[i]!.id
}

/**
 * Resolve the rhythm id a "default rhythm" surface (e.g. the home Drums +/-
 * dial) should operate on, NEVER defaulting to "the first" rhythm:
 *   1. an EXPLICIT id (e.g. a shuffle that just picked one) always wins;
 *   2. else the LAST-USED id on this surface (sticky between presses);
 *   3. else a RANDOM groove from the corpus.
 *
 * Pure + seedable (pass an `rng`) so the never-first behaviour is unit-testable.
 */
export const resolveDialRhythmId = (
  rng: () => number,
  lastUsed: string | undefined,
  explicit?: string
): string => explicit ?? lastUsed ?? pickRandomRhythmId(rng)
