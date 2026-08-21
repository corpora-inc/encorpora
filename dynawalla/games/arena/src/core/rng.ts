/**
 * A small, fast, seeded PRNG. Deterministic across platforms because every
 * operation is a 32-bit integer op — no floating point enters the state.
 */
export class Rng {
  private s: number

  constructor(seed: number) {
    // Avoid a zero state; mix the seed so nearby seeds diverge immediately.
    this.s = (seed | 0) === 0 ? 0x9e3779b9 : seed | 0
    for (let i = 0; i < 4; i++) this.u32()
  }

  /** Uniform 32-bit unsigned integer. */
  u32(): number {
    // xorshift32 — integer only.
    let x = this.s
    x ^= x << 13
    x |= 0
    x ^= x >>> 17
    x ^= x << 5
    x |= 0
    this.s = x
    return x >>> 0
  }

  /** Uniform float in [0, 1). Only used for presentation/simulation, never for an answer. */
  f(): number {
    return this.u32() / 4294967296
  }

  /** Uniform float in [lo, hi). */
  range(lo: number, hi: number): number {
    return lo + this.f() * (hi - lo)
  }

  /** Uniform integer in [lo, hi] inclusive. Exact — no float rounding. */
  int(lo: number, hi: number): number {
    if (hi <= lo) return lo
    const span = hi - lo + 1
    return lo + (this.u32() % span)
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.f() < p
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.u32() % arr.length] as T
  }

  /** Fisher-Yates, in place. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.u32() % (i + 1)
      const t = arr[i] as T
      arr[i] = arr[j] as T
      arr[j] = t
    }
    return arr
  }

  /** Signed value in [-a, a). */
  sym(a: number): number {
    return this.range(-a, a)
  }
}
