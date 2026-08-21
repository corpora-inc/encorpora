// journey/engine/rng.ts — seeded PRNG primitives + sampling helpers.
//
// CANONICAL ALGORITHMS (engine.md §0 rule 3, §9.9). `journey/content/rng.ts`
// carries a deliberate duplicate of fnv1a32/mulberry32 (the engine barrel is
// closed); its parity test (`journey/content/rng.test.ts`) pins the two
// implementations against shared known-answer vectors:
//   fnv1a32("") = 0x811c9dc5, fnv1a32("a") = 0xe40c292c,
//   fnv1a32("foobar") = 0xbf9cf968; mulberry32 increment 0x6d2b79f5.
//
// House rule: unseeded randomness is banned everywhere in the engine — every
// sample flows through an injected Rng seeded from
// (stackId, courseId, sessionCounter) (adaptivity.md §7).

/**
 * FNV-1a 32-bit hash over UTF-16 code units. Standard offset basis
 * 0x811c9dc5, prime 16777619 (via shifts). Also the ts-fsrs fuzz seed
 * derivation: `cardId = fnv1a32(itemId)` (engine.md §1.3).
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

/** The injected randomness surface every engine module samples through. */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number
  /** Uniform int in [0, maxExclusive). */
  int(maxExclusive: number): number
  /** Uniform pick. Undefined on an empty array. */
  pick<T>(arr: readonly T[]): T | undefined
  /** Normal(mean, sd) via Box–Muller (two uniforms per draw; deterministic). */
  gauss(mean: number, sd: number): number
  /** In-place Fisher–Yates. Returns the same array. */
  shuffle<T>(arr: T[]): T[]
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed)
  return {
    next,
    int(maxExclusive: number): number {
      if (maxExclusive <= 0) return 0
      return Math.floor(next() * maxExclusive)
    },
    pick<T>(arr: readonly T[]): T | undefined {
      if (arr.length === 0) return undefined
      return arr[Math.floor(next() * arr.length)]
    },
    gauss(mean: number, sd: number): number {
      // Box–Muller; guard u1=0.
      const u1 = Math.max(next(), 1e-12)
      const u2 = next()
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      return mean + sd * z
    },
    shuffle<T>(arr: T[]): T[] {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        const tmp = arr[i]
        arr[i] = arr[j]
        arr[j] = tmp
      }
      return arr
    },
  }
}

/** Session PRNG seed: hash of `${stackId}:${courseId}:${sessionCounter}`
 *  (adaptivity.md §7 — reproducible given the persisted counter). */
export function deriveSessionSeed(stackId: string, courseId: string, sessionCounter: number): number {
  return fnv1a32(`${stackId}:${courseId}:${sessionCounter}`)
}

/**
 * Weighted pick over [value, weight] entries. Non-positive weights are
 * skipped; undefined when nothing is pickable.
 */
export function weightedPick<T>(rng: Rng, entries: ReadonlyArray<readonly [T, number]>): T | undefined {
  let total = 0
  for (const [, w] of entries) if (w > 0) total += w
  if (total <= 0) return undefined
  let roll = rng.next() * total
  for (const [v, w] of entries) {
    if (w <= 0) continue
    roll -= w
    if (roll <= 0) return v
  }
  return entries[entries.length - 1]?.[0]
}
