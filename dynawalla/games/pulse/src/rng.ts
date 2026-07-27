/** Seeded, deterministic PRNG. Same seed → same run, forever. */

export function hashSeed(s: string): number {
  // FNV-1a 32-bit.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type Rng = {
  /** [0,1) */
  f(): number;
  /** integer in [0,n) */
  i(n: number): number;
  /** float in [a,b) */
  range(a: number, b: number): number;
  pick<T>(xs: readonly T[]): T;
  /** Fisher-Yates, in place, returns the same array. */
  shuffle<T>(xs: T[]): T[];
  bool(p: number): boolean;
};

/** mulberry32 — small, fast, good enough for chart and particle variation. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const f = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const i = (n: number): number => Math.floor(f() * n);
  return {
    f,
    i,
    range: (lo, hi) => lo + f() * (hi - lo),
    pick: <T,>(xs: readonly T[]): T => {
      if (xs.length === 0) throw new RangeError("pick: empty");
      return xs[i(xs.length)]!;
    },
    shuffle: <T,>(xs: T[]): T[] => {
      for (let k = xs.length - 1; k > 0; k--) {
        const j = i(k + 1);
        const tmp = xs[k]!;
        xs[k] = xs[j]!;
        xs[j] = tmp;
      }
      return xs;
    },
    bool: (p) => f() < p,
  };
}
