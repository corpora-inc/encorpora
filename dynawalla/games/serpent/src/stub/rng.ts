/**
 * Seeded, deterministic RNG. sfc32 with an xmur3 string-hash seeding step.
 *
 * Every question in a Serpent run comes from here, so a seed reproduces a run's
 * arithmetic exactly. Presentation randomness (particles, drift) uses its own
 * stream so that a visual tweak can never shift the maths.
 */

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

export type Rng = {
  /** [0, 1) */
  next(): number;
  /** integer in [lo, hi] inclusive */
  int(lo: number, hi: number): number;
  pick<T>(xs: readonly T[]): T;
  /** Fisher–Yates, in place, returns the same array. */
  shuffle<T>(xs: T[]): T[];
  chance(p: number): boolean;
};

export function makeRng(seed: string): Rng {
  const h = xmur3(seed);
  let a = h();
  let b = h();
  let c = h();
  let d = h();

  const next = (): number => {
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

  const int = (lo: number, hi: number): number => lo + Math.floor(next() * (hi - lo + 1));

  return {
    next,
    int,
    pick<T>(xs: readonly T[]): T {
      const v = xs[int(0, xs.length - 1)];
      if (v === undefined) throw new Error("pick from empty array");
      return v;
    },
    shuffle<T>(xs: T[]): T[] {
      for (let i = xs.length - 1; i > 0; i--) {
        const j = int(0, i);
        const xi = xs[i] as T;
        const xj = xs[j] as T;
        xs[i] = xj;
        xs[j] = xi;
      }
      return xs;
    },
    chance(p: number): boolean {
      return next() < p;
    },
  };
}
