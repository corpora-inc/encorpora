/**
 * Seeded, integer-only PRNG.
 *
 * ADR-0006 / CG-16: generation is seeded, pure and platform-stable. Never
 * `Math.random`, no `Intl` inside generation, no key-order assumptions.
 *
 * `mulberry32` is normally written to return a float in [0, 1). It does not here:
 * every draw is a uint32 and every derived value is produced by integer arithmetic
 * with rejection sampling, so the stream is identical on x86 and arm64 and no
 * float ever enters generation.
 *
 * This module is the local home of what ARCHITECTURE.md schedules as
 * `shared/kernel/rng.ts` at M2 (PR-2.1). `shared/` does not exist yet; when it
 * does, this file moves and the known-answer vectors move with it.
 */

const UINT32 = 4294967296;

/** FNV-1a, 32-bit. Maps seed material (an exercise id) to a uint32 seed. */
export function fnv1a32(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export type Rng = {
  /** Uniform uint32. */
  nextUint32(): number;
  /** Uniform integer in `[lo, hi]`, both inclusive. Rejection-sampled, unbiased. */
  nextInt(lo: number, hi: number): number;
  /** Uniform element of a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** `count` distinct elements of `items`, in ascending index order. */
  sample<T>(items: readonly T[], count: number): T[];
  /** How many uint32 draws have been consumed. Feeds `SelectionTrace.rngDraws`. */
  draws(): number;
};

/**
 * mulberry32, emitting uint32 rather than a float.
 * Known-answer vectors for seed 0 and seed 0x9E3779B9 are pinned in `rng.test.ts`;
 * a change to this stream changes every generated exercise, which is why CG-16
 * hashes generator output on two operating systems.
 */
export function createRng(seed: number): Rng {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed >= UINT32) {
    throw new RangeError(`createRng: seed must be a uint32, got ${String(seed)}`);
  }
  let state = seed >>> 0;
  let consumed = 0;

  const nextUint32 = (): number => {
    consumed += 1;
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };

  const nextInt = (lo: number, hi: number): number => {
    if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hi)) {
      throw new RangeError(`nextInt: bounds must be integers, got ${String(lo)}..${String(hi)}`);
    }
    if (hi < lo) throw new RangeError(`nextInt: empty range ${String(lo)}..${String(hi)}`);
    const range = hi - lo + 1;
    if (range > UINT32) throw new RangeError("nextInt: range exceeds uint32");
    if (range === 1) return lo;
    // Reject the ragged tail so every value in the range is equally likely.
    const limit = UINT32 - (UINT32 % range);
    let draw = nextUint32();
    while (draw >= limit) draw = nextUint32();
    return lo + (draw % range);
  };

  return {
    nextUint32,
    nextInt,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new RangeError("pick: empty array");
      const chosen = items[nextInt(0, items.length - 1)];
      if (chosen === undefined) throw new RangeError("pick: undefined element");
      return chosen;
    },
    sample<T>(items: readonly T[], count: number): T[] {
      if (count < 0 || count > items.length) {
        throw new RangeError(`sample: cannot take ${String(count)} of ${String(items.length)}`);
      }
      // Selection sampling (Knuth 3.4.2 S): one pass, order-preserving, and it
      // consumes a draw count that depends only on `items.length`.
      const out: T[] = [];
      let remaining = count;
      for (let i = 0; i < items.length && remaining > 0; i++) {
        const left = items.length - i;
        if (nextInt(1, left) <= remaining) {
          const item = items[i];
          if (item === undefined) throw new RangeError("sample: undefined element");
          out.push(item);
          remaining -= 1;
        }
      }
      return out;
    },
    draws: () => consumed,
  };
}

/**
 * Separator for seed material. Explicit and printable so the seed of any exercise
 * can be reproduced by hand from its id.
 */
export const SEED_SEPARATOR = "|";

/** Derive a uint32 seed from stable string material (usually the exercise id). */
export function seedFrom(...parts: readonly string[]): number {
  return fnv1a32(parts.join(SEED_SEPARATOR));
}
