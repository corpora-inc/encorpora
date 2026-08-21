/** Deterministic, seedable PRNG. No Math.random anywhere in the game. */

export type Rng = {
  /** float in [0,1) */
  f(): number;
  /** integer in [lo,hi] inclusive */
  i(lo: number, hi: number): number;
  /** float in [lo,hi) */
  r(lo: number, hi: number): number;
  /** +1 or -1 */
  sign(): number;
  /** true with probability p */
  chance(p: number): boolean;
  /** uniform pick */
  pick<T>(xs: readonly T[]): T;
  /** in-place Fisher-Yates */
  shuffle<T>(xs: T[]): T[];
  fork(tag: number): Rng;
};

/** mulberry32 — small, fast, good enough, and identical on every platform. */
export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  const f = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    f,
    i: (lo, hi) => lo + Math.floor(f() * (hi - lo + 1)),
    r: (lo, hi) => lo + f() * (hi - lo),
    sign: () => (f() < 0.5 ? -1 : 1),
    chance: (p) => f() < p,
    pick: <T,>(xs: readonly T[]): T => xs[Math.floor(f() * xs.length)] as T,
    shuffle: <T,>(xs: T[]): T[] => {
      for (let i = xs.length - 1; i > 0; i--) {
        const j = Math.floor(f() * (i + 1));
        const a = xs[i] as T;
        xs[i] = xs[j] as T;
        xs[j] = a;
      }
      return xs;
    },
    fork: (tag) => makeRng((s ^ Math.imul(tag + 1, 0x9e3779b1)) >>> 0),
  };
  return rng;
}
