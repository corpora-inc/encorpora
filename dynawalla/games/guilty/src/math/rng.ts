/**
 * Seeded, deterministic PRNG. mulberry32 — 32-bit state, fast, good enough for
 * particles and question selection, and identical on every device.
 *
 * `nextFloat` exists for *presentation* randomness only (spark angles, pitch
 * jitter). Anything that decides a question, an answer or a comparison uses the
 * integer paths, so no answer path ever touches a float.
 */
export type Rng = {
  /** Uniform 32-bit unsigned integer. */
  nextUint(): number;
  /** Uniform float in [0,1). Presentation only. */
  nextFloat(): number;
  /** Uniform integer in [lo, hi] inclusive. */
  int(lo: number, hi: number): number;
  /** Uniform float in [lo, hi). Presentation only. */
  range(lo: number, hi: number): number;
  pick<T>(items: readonly T[]): T;
  /** In-place Fisher-Yates. Returns the same array. */
  shuffle<T>(items: T[]): T[];
  /** Current raw state, so a run can be resumed or logged. */
  state(): number;
};

export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  if (s === 0) s = 0x9e3779b9;

  const nextUint = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };

  const nextFloat = (): number => nextUint() / 4294967296;

  const int = (lo: number, hi: number): number => {
    if (hi <= lo) return lo;
    const span = hi - lo + 1;
    return lo + (nextUint() % span);
  };

  return {
    nextUint,
    nextFloat,
    int,
    range: (lo, hi) => lo + nextFloat() * (hi - lo),
    pick: <T,>(items: readonly T[]): T => {
      const v = items[int(0, items.length - 1)];
      if (v === undefined) throw new Error("pick from empty array");
      return v;
    },
    shuffle: <T,>(items: T[]): T[] => {
      for (let i = items.length - 1; i > 0; i--) {
        const j = int(0, i);
        const a = items[i] as T;
        const b = items[j] as T;
        items[i] = b;
        items[j] = a;
      }
      return items;
    },
    state: () => s >>> 0,
  };
}

/** FNV-1a over a string — turns a question id into a stable presentation seed. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
