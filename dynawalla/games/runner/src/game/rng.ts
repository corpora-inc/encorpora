/**
 * Deterministic, allocation-free PRNG (mulberry32 over a 32-bit state).
 *
 * Every stochastic decision in VOLTA routes through one of these so a seed
 * reproduces a run exactly: same gates, same hazard cadence, same spark rows.
 * That makes "it felt unfair at 4:20" a bug report someone can actually replay.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    // Avoid the degenerate zero state; keep it a uint32.
    this.s = (seed >>> 0) || 0x9e3779b9;
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform integer in [lo, hi] inclusive. */
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  /** Uniform float in [lo, hi). */
  range(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Pick one element. Never called with an empty array in this game. */
  pick<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.next() * xs.length)];
  }

  /** In-place Fisher-Yates. No allocation. */
  shuffle<T>(xs: T[]): T[] {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = xs[i];
      xs[i] = xs[j];
      xs[j] = t;
    }
    return xs;
  }
}
