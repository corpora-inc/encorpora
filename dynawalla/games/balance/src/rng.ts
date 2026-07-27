// mulberry32 — small, fast, seeded, deterministic across engines.
// Question generation uses it, so a seed reproduces a run exactly.
// Cosmetic jitter (particles, pitch) uses a *separate* stream so that a
// different number of sparks can never shift the curriculum.

export type Rng = {
  /** [0, 1) */
  next(): number;
  /** integer in [lo, hi] inclusive */
  int(lo: number, hi: number): number;
  /** float in [lo, hi) */
  range(lo: number, hi: number): number;
  pick<T>(xs: readonly T[]): T;
  /** Fisher-Yates, returns a new array */
  shuffle<T>(xs: readonly T[]): T[];
  chance(p: number): boolean;
};

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number): number =>
    lo + Math.floor(next() * (hi - lo + 1));
  return {
    next,
    int,
    range: (lo, hi) => lo + next() * (hi - lo),
    pick: <T,>(xs: readonly T[]): T => xs[int(0, xs.length - 1)],
    shuffle: <T,>(xs: readonly T[]): T[] => {
      const out = xs.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i);
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },
    chance: (p) => next() < p,
  };
}
