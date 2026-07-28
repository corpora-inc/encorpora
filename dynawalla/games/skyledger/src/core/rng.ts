// A seeded, deterministic PRNG. Every stochastic decision in the game and in
// the stub host runs through one of these so a watch can be replayed exactly.
//
// mulberry32: 32-bit state, no allocation, and trivially portable into a test.

export class Rng {
  private s: number

  constructor(seed: number) {
    // Force to uint32; a 0 seed is legal for mulberry32 but degenerate-looking,
    // so nudge it off zero.
    this.s = (seed >>> 0) || 0x9e3779b9
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0
    let t = this.s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Uniform in [lo, hi). */
  range(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo)
  }

  /** Uniform integer in [lo, hi] inclusive. */
  int(lo: number, hi: number): number {
    if (hi <= lo) return lo
    return lo + Math.floor(this.next() * (hi - lo + 1))
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p
  }

  pick<T>(xs: readonly T[]): T {
    if (xs.length === 0) throw new Error("rng.pick: empty")
    return xs[Math.floor(this.next() * xs.length)] as T
  }

  /** In-place Fisher–Yates. Returns the same array for chaining. */
  shuffle<T>(xs: T[]): T[] {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      const a = xs[i] as T
      xs[i] = xs[j] as T
      xs[j] = a
    }
    return xs
  }

  /** Snapshot/restore so a subsystem can be forked without disturbing the run. */
  fork(salt: number): Rng {
    return new Rng((this.s ^ Math.imul(salt, 0x85ebca6b)) >>> 0)
  }
}
