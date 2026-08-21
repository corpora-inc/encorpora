// Seeded, deterministic, integer-only state. Same seed → same run, forever.

export type Rng = {
  /** Uniform in [0, 1). Derived from a 32-bit integer draw. */
  next(): number
  /** Uniform integer in [0, n). */
  int(n: number): number
  /** Uniform float in [lo, hi). */
  range(lo: number, hi: number): number
  /** One of the items, uniformly. */
  pick<T>(items: readonly T[]): T
  /** In-place Fisher-Yates. Returns the same array. */
  shuffle<T>(items: T[]): T[]
  /** Current 32-bit state — snapshot it to reproduce a run mid-flight. */
  state(): number
}

/** xorshift32. Cheap, deterministic across engines, no float state. */
export function makeRng(seed: number): Rng {
  let s = seed >>> 0
  if (s === 0) s = 0x9e3779b9

  const raw = (): number => {
    s ^= s << 13
    s >>>= 0
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s
  }

  const rng: Rng = {
    next: () => raw() / 4294967296,
    int: (n: number) => (n <= 0 ? 0 : raw() % n),
    range: (lo: number, hi: number) => lo + (raw() / 4294967296) * (hi - lo),
    pick: <T,>(items: readonly T[]): T => items[raw() % items.length] as T,
    shuffle: <T,>(items: T[]): T[] => {
      for (let i = items.length - 1; i > 0; i--) {
        const j = raw() % (i + 1)
        const t = items[i] as T
        items[i] = items[j] as T
        items[j] = t
      }
      return items
    },
    state: () => s >>> 0,
  }
  return rng
}

/** FNV-1a over a string → a 32-bit seed. Stable across runs and platforms. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}
