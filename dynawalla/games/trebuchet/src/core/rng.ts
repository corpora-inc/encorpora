/** Seeded, deterministic PRNG. Same seed -> same run, forever. */

export type Rng = {
  /** float in [0,1) — cosmetics only, never a correctness decision */
  next(): number
  /** integer in [lo, hi] inclusive */
  int(lo: number, hi: number): number
  pick<T>(xs: readonly T[]): T
  /** float in [lo, hi) */
  range(lo: number, hi: number): number
  chance(p: number): boolean
  /** a fresh independent stream, deterministically derived */
  fork(tag: string): Rng
  readonly seed: number
}

export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32 — small, fast, good enough, and identical on every platform. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const rng: Rng = {
    seed,
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    range: (lo, hi) => lo + next() * (hi - lo),
    pick: (xs) => xs[Math.floor(next() * xs.length)],
    chance: (p) => next() < p,
    fork: (tag) => makeRng((seed ^ hashString(tag)) >>> 0),
  }
  return rng
}

/** Deterministic shuffle (Fisher-Yates) — returns a new array. */
export function shuffled<T>(xs: readonly T[], rng: Rng): T[] {
  const out = xs.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}
