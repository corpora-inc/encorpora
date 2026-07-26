/**
 * Seeded, deterministic integer RNG.
 *
 * mulberry32 on a uint32 state. Every consumer in `core/` draws integers only —
 * no float ever reaches a value, a comparison or an answer.
 */

export class Rng {
  private s: number;

  constructor(seed: number) {
    // Force a uint32 that is never 0 (mulberry32 is fine with 0 but a zero seed
    // reads like "unseeded" in a bug report).
    this.s = (seed >>> 0) || 0x9e3779b9;
  }

  /** Raw uint32. */
  u32(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** Uniform integer in [0, n). n must be a positive integer. */
  int(n: number): number {
    if (n <= 0) return 0;
    // Rejection-free modulo bias is irrelevant at our n (<= a few hundred) but
    // the multiply-shift keeps it uniform enough and stays integer-only.
    return this.u32() % n;
  }

  /** Uniform integer in [lo, hi] inclusive. */
  range(lo: number, hi: number): number {
    if (hi <= lo) return lo;
    return lo + this.int(hi - lo + 1);
  }

  /** True with probability numerator/denominator. */
  chance(numerator: number, denominator: number): boolean {
    return this.int(denominator) < numerator;
  }

  pick<T>(xs: readonly T[]): T {
    return xs[this.int(xs.length)] as T;
  }

  /** In-place Fisher-Yates. Deterministic for a given state. */
  shuffle<T>(xs: T[]): T[] {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const a = xs[i] as T;
      xs[i] = xs[j] as T;
      xs[j] = a;
    }
    return xs;
  }

  /** Snapshot / restore, so a replay can fork without disturbing the run. */
  state(): number {
    return this.s;
  }
  setState(s: number): void {
    this.s = s >>> 0;
  }
}

/** Cheap string -> uint32, for turning a seed phrase into a seed. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
