// sfc32 — small, fast, well-distributed, and identical on every engine because
// every operation is a 32-bit integer op. Seeded and reproducible: the same
// seed always yields the same stream, which is what makes the question stub
// deterministic and the economy tests meaningful.

export type Rng = {
  /** Next uint32. */
  u32(): number
  /** Uniform integer in [lo, hi] inclusive. Rejection-free, bias below 2^-32. */
  int(lo: number, hi: number): number
  /** Uniform float in [0, 1). Presentation only — never a game quantity. */
  unit(): number
  /** Uniform pick. */
  pick<T>(xs: readonly T[]): T
  /** Fisher–Yates, in place, returns the same array. */
  shuffle<T>(xs: T[]): T[]
  /** True with probability num/den. */
  chance(num: number, den: number): boolean
}

export function makeRng(seed: number): Rng {
  // Scramble the seed into four words so seed=0 and seed=1 do not correlate.
  let a = (seed ^ 0x9e3779b9) >>> 0
  let b = (seed ^ 0x243f6a88) >>> 0
  let c = (seed ^ 0xb7e15162) >>> 0
  let d = (seed ^ 0x85ebca6b) >>> 0

  const u32 = (): number => {
    const t = (a + b) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    d = (d + 1) | 0
    const r = (t + d) | 0
    c = (c + r) | 0
    return r >>> 0
  }

  // Warm up: the first few outputs of sfc32 from a raw seed are weak.
  for (let i = 0; i < 12; i++) u32()

  const int = (lo: number, hi: number): number => {
    if (hi <= lo) return lo
    const span = hi - lo + 1
    return lo + (u32() % span)
  }

  return {
    u32,
    int,
    unit: () => u32() / 4294967296,
    pick: <T>(xs: readonly T[]): T => xs[int(0, xs.length - 1)] as T,
    shuffle: <T>(xs: T[]): T[] => {
      for (let i = xs.length - 1; i > 0; i--) {
        const j = int(0, i)
        const t = xs[i] as T
        xs[i] = xs[j] as T
        xs[j] = t
      }
      return xs
    },
    chance: (num: number, den: number) => int(1, den) <= num,
  }
}
