/**
 * Deterministic randomness. Every random choice in the engine takes an Rng so
 * a session, an exam form and a test are reproducible from a seed.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
}

/** FNV-1a, 32 bit. Stable across platforms. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: small, fast, good enough for sampling. */
export function createRng(seed: number | string): Rng {
  let a = (typeof seed === "string" ? hashString(seed) : seed) >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Integer in [0, n). */
export function randInt(rng: Rng, n: number): number {
  if (!Number.isInteger(n) || n <= 0) throw new RangeError("randInt needs a positive integer");
  return Math.floor(rng.next() * n);
}

/** Fisher-Yates on a copy. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/** Draw an index with probability proportional to weight. Weights must be >= 0 with a positive sum. */
export function weightedIndex(rng: Rng, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) {
    if (!Number.isFinite(w) || w < 0) throw new RangeError("weights must be finite and >= 0");
    total += w;
  }
  if (total <= 0) throw new RangeError("weights must have a positive sum");
  let r = rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i] as number;
    if (r < 0) return i;
  }
  // Floating point remainder: the last positive weight.
  for (let i = weights.length - 1; i >= 0; i--) if ((weights[i] as number) > 0) return i;
  return weights.length - 1;
}
