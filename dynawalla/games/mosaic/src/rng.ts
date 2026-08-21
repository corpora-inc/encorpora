/**
 * Seeded, deterministic RNG. Two of them, deliberately separated:
 *
 *  - `Rng` drives CONTENT (wall layout, rules, question choice). It must be
 *    reproducible from a seed forever, so a wave can be replayed exactly and a
 *    test can assert a layout.
 *  - `fx` (see `fx/rand.ts`) drives cosmetics. Nothing about correctness may
 *    depend on it.
 *
 * mulberry32 — 32-bit state, uniform enough for layout work, one multiply and a
 * couple of shifts per call.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    // Avoid the zero fixed point.
    this.s = (seed >>> 0) || 0x9e3779b9;
  }

  /** Raw uint32. */
  u32(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** [0,1) */
  f(): number {
    return this.u32() / 4294967296;
  }

  /** Integer in [lo, hi] inclusive. Exact — no float rounding at the edges. */
  int(lo: number, hi: number): number {
    if (hi <= lo) return lo;
    const span = hi - lo + 1;
    return lo + (this.u32() % span);
  }

  pick<T>(xs: readonly T[]): T {
    return xs[this.u32() % xs.length]!;
  }

  /** In-place Fisher-Yates. */
  shuffle<T>(xs: T[]): T[] {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = this.u32() % (i + 1);
      const t = xs[i]!;
      xs[i] = xs[j]!;
      xs[j] = t;
    }
    return xs;
  }

  chance(numerator: number, denominator: number): boolean {
    return this.u32() % denominator < numerator;
  }
}

/** Deterministic sub-seed so wave N of run S is always the same wall. */
export function subSeed(seed: number, ...salt: number[]): number {
  let h = seed >>> 0;
  for (const s of salt) {
    h = (Math.imul(h ^ (s >>> 0), 0x27220a95) + 0x165667b1) >>> 0;
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
