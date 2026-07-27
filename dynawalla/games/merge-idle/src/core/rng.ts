/** mulberry32 — small, fast, seedable, good enough for a game. */
export type Rng = {
  /** float in [0,1) — presentation only, never an answer or a comparison */
  f(): number
  /** integer in [lo, hi] inclusive */
  int(lo: number, hi: number): number
  pick<T>(xs: readonly T[]): T
  /** true with probability num/den — integer-only so tests stay exact */
  chance(num: number, den: number): boolean
  shuffle<T>(xs: T[]): T[]
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0
  const nextU32 = (): number => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (t ^ (t >>> 14)) >>> 0
  }
  const f = (): number => nextU32() / 4294967296
  const int = (lo: number, hi: number): number => {
    if (hi <= lo) return lo
    return lo + (nextU32() % (hi - lo + 1))
  }
  return {
    f,
    int,
    pick<T>(xs: readonly T[]): T {
      const v = xs[int(0, xs.length - 1)]
      if (v === undefined) throw new Error('rng.pick on empty list')
      return v
    },
    chance: (num, den) => int(1, den) <= num,
    shuffle<T>(xs: T[]): T[] {
      for (let i = xs.length - 1; i > 0; i--) {
        const j = int(0, i)
        const a0 = xs[i] as T
        xs[i] = xs[j] as T
        xs[j] = a0
      }
      return xs
    },
  }
}

/** Deterministic 32-bit hash of a string, for turning a `?seed=` into a number. */
export function hashSeed(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}
