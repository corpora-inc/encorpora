// src/journey/celebration/praise.ts — the praise-word pool + a non-repeating
// sampler (PREMIUM_SCROLL §3.4). The tier-1 correct splash picks a FRESH
// exclamation every time so the learner keeps playing to see the next word —
// variety is the dopamine hook. Keys are localized in ~54 langs; the legacy
// `journey.celebrate.perfect` key stays working (it is the milestone fallback).
//
// Pure logic, no DOM — unit-testable without a renderer.

/** The pool of short praise-word i18n keys. ~12 exclamations, each ≤ ~2 words. */
export const PRAISE_KEYS = [
  "journey.celebrate.praise.perfect",
  "journey.celebrate.praise.nice",
  "journey.celebrate.praise.brilliant",
  "journey.celebrate.praise.boom",
  "journey.celebrate.praise.nailed",
  "journey.celebrate.praise.unstoppable",
  "journey.celebrate.praise.onFire",
  "journey.celebrate.praise.yes",
  "journey.celebrate.praise.clean",
  "journey.celebrate.praise.sharp",
  "journey.celebrate.praise.wow",
  "journey.celebrate.praise.magic",
] as const

export type PraiseKey = (typeof PRAISE_KEYS)[number]

export interface PraiseSampler {
  /** Draw a fresh praise key that avoids the last `avoid` picks. */
  next(): PraiseKey
}

export interface PraiseSamplerOpts {
  /** How many recent picks to avoid repeating (default 2). */
  avoid?: number
  /** Injected RNG for deterministic tests (default Math.random). */
  rng?: () => number
  /** Restrict the pool (tests); defaults to the full PRAISE_KEYS. */
  pool?: readonly PraiseKey[]
}

/**
 * A non-repeating praise sampler. Never returns a key it returned in the last
 * `avoid` draws (so no immediate or near-immediate repeats), while still drawing
 * uniformly at random from the remaining pool. `avoid` is clamped so it can
 * never starve the pool (always leaves ≥ 1 candidate).
 */
export function createPraiseSampler(opts: PraiseSamplerOpts = {}): PraiseSampler {
  const pool = opts.pool ?? PRAISE_KEYS
  const rng = opts.rng ?? Math.random
  // Never avoid so much that nothing is eligible.
  const avoid = Math.max(0, Math.min(opts.avoid ?? 2, pool.length - 1))
  let recent: PraiseKey[] = []

  return {
    next(): PraiseKey {
      const eligible = pool.filter((k) => !recent.includes(k))
      const candidates = eligible.length > 0 ? eligible : [...pool]
      const choice = candidates[Math.floor(rng() * candidates.length) % candidates.length]
      recent.push(choice)
      while (recent.length > avoid) recent.shift()
      return choice
    },
  }
}
