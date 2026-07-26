/** Deterministic, seedable RNG. sfc32 — fast, good distribution, 128-bit state. */
export type Rng = {
  /** float in [0, 1) */
  f(): number;
  /** integer in [lo, hi] inclusive */
  i(lo: number, hi: number): number;
  /** float in [lo, hi) */
  r(lo: number, hi: number): number;
  /** picks an element; never called on an empty array */
  pick<T>(xs: readonly T[]): T;
  /** true with probability p */
  chance(p: number): boolean;
  /** Fisher-Yates, in place, returns the same array */
  shuffle<T>(xs: T[]): T[];
};

export function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let k = 0; k < str.length; k++) {
    h ^= str.charCodeAt(k);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function makeRng(seed: number): Rng {
  let a = (seed ^ 0x9e3779b9) >>> 0;
  let b = (seed ^ 0x243f6a88) >>> 0;
  let c = (seed ^ 0xb7e15162) >>> 0;
  let d = 1;

  const f = (): number => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };

  // warm up so nearby seeds diverge immediately
  for (let k = 0; k < 12; k++) f();

  const i = (lo: number, hi: number): number => lo + Math.floor(f() * (hi - lo + 1));
  return {
    f,
    i,
    r: (lo, hi) => lo + f() * (hi - lo),
    pick: <T>(xs: readonly T[]): T => xs[i(0, xs.length - 1)] as T,
    chance: (p) => f() < p,
    shuffle: <T>(xs: T[]): T[] => {
      for (let k = xs.length - 1; k > 0; k--) {
        const j = i(0, k);
        const tmp = xs[k] as T;
        xs[k] = xs[j] as T;
        xs[j] = tmp;
      }
      return xs;
    },
  };
}
