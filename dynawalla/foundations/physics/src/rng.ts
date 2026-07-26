// Seeded PRNG for the physics kit.
//
// Nothing in a Dynawalla prototype may call `Math.random()`. A physics scene
// that is not reproducible cannot be replayed, cannot be bisected when a child
// reports "the lamp fell through the floor", and cannot be regression-tested.
// The whole determinism story rests on this file being the only source of
// randomness in the kit.
//
// sfc32 — small, fast, passes PractRand, and (unlike xorshift32) has no weak
// seeds that collapse to short cycles.

export interface Rng {
  /** Uniform in [0, 1). */
  (): number
  /** Uniform in [min, max). */
  range(min: number, max: number): number
  /** Integer in [0, n). */
  int(n: number): number
  /** Uniform in [-spread, +spread) — the one every "jitter" call actually wants. */
  spread(spread: number): number
  pick<T>(items: readonly T[]): T
  /** The seed this stream was created from, so a replay can restate it. */
  readonly seed: number
}

export function makeRng(seed: number): Rng {
  // Expand one 32-bit seed into sfc32's four words with a splitmix-ish walk, so
  // that seeds 1, 2 and 3 produce genuinely unrelated streams. Seeding all four
  // words with the same value is the classic mistake and gives correlated runs.
  let z = seed >>> 0
  const next32 = () => {
    z = (z + 0x9e3779b9) >>> 0
    let t = z
    t = Math.imul(t ^ (t >>> 16), 0x21f0aaad) >>> 0
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97) >>> 0
    return (t ^ (t >>> 15)) >>> 0
  }
  let a = next32()
  let b = next32()
  let c = next32()
  let d = next32()

  const f = (() => {
    let t = 0
    return () => {
      a >>>= 0
      b >>>= 0
      c >>>= 0
      d >>>= 0
      t = (a + b) | 0
      a = b ^ (b >>> 9)
      b = (c + (c << 3)) | 0
      c = (c << 21) | (c >>> 11)
      d = (d + 1) | 0
      t = (t + d) | 0
      c = (c + t) | 0
      return (t >>> 0) / 4294967296
    }
  })() as Rng

  f.range = (min: number, max: number) => min + f() * (max - min)
  f.int = (n: number) => Math.floor(f() * n)
  f.spread = (s: number) => (f() * 2 - 1) * s
  f.pick = <T,>(items: readonly T[]): T => items[Math.floor(f() * items.length)]!
  Object.defineProperty(f, "seed", { value: seed >>> 0, enumerable: true })
  return f
}
