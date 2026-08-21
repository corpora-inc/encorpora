// Journey content resolver — seeded PRNG primitives.
//
// DELIBERATE ~20-line duplicate of `journey/engine/rng.ts` (mulberry32 +
// fnv1a32): the engine barrel is closed (engine.md §8.1 — nothing outside
// `journey/engine/**` may deep-import engine internals), so the resolver
// carries its own copy. A parity test (`rng.test.ts`) pins the two against
// shared known-answer vectors so the duplication cannot drift silently.
//
// House rule: `Math.random()` is banned in this module tree — every sample in
// the resolver flows through these functions (content-resolver.md §0 rule 4,
// §4.5).

/**
 * FNV-1a 32-bit hash over UTF-16 code units. Standard offset basis
 * 0x811c9dc5, prime 16777619 (via shifts). Matches the engine's seed
 * derivation (`cardId = fnv1a32(itemId)`, engine.md §4).
 */
export function fnv1a32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    // h *= 16777619 (mod 2^32), expressed with shifts to stay in int32 ops
    h = (h + ((h << 1) >>> 0) + ((h << 4) >>> 0) + ((h << 7) >>> 0) + ((h << 8) >>> 0) + ((h << 24) >>> 0)) >>> 0
  }
  return h >>> 0
}

/**
 * mulberry32 — the canonical 32-bit PRNG. Returns a function producing
 * floats in [0, 1). Deterministic for a given seed across runs and devices.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The card PRNG: `mulberry32(fnv1a32(cardId))` (content-resolver.md §4.5). */
export function cardRng(cardId: string): () => number {
  return mulberry32(fnv1a32(cardId))
}
