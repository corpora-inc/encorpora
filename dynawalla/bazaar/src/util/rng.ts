/**
 * Deterministic pseudo-randomness.
 *
 * Everything in the bazaar that looks incidental — which awning stripe, where a
 * tile is chipped, how far apart two stalls sit — is generated from a seed, so
 * the same street is the same street on every device and in every screenshot.
 */

/** splitmix32: fast, well-distributed, and stable across engines. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x9e3779b9) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 16), 0x21f0aaad);
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
    return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
}

/** A stable 32-bit hash of a string, for deriving a seed from an id. */
export function hash(s: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Mix two integers into a new seed. Order matters. */
export function mix(a: number, b: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ b, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** A deterministic float in [0,1) from a seed, without holding a generator. */
export function frand(seed: number): number {
  let t = (seed + 0x9e3779b9) >>> 0;
  t = Math.imul(t ^ (t >>> 16), 0x21f0aaad);
  t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
  return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
}

export function pick<T>(items: readonly T[], r: number): T {
  return items[Math.min(items.length - 1, Math.floor(r * items.length))]!;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Smooth 0→1 with zero derivative at both ends. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * A non-repeating idle oscillation: two sines at prime-ratio periods so nothing
 * visibly loops. §5.1 of the aesthetic bible.
 */
const IDLE_PERIODS = [5.2, 7.3, 11.1, 13.7, 17.3, 19.1] as const;

export function idle(t: number, seed: number, amplitude = 1): number {
  const i = Math.floor(frand(seed) * IDLE_PERIODS.length);
  let j = Math.floor(frand(seed ^ 0x5bf03635) * (IDLE_PERIODS.length - 1));
  if (j >= i) j += 1;
  const p1 = IDLE_PERIODS[i]!;
  const p2 = IDLE_PERIODS[j]!;
  const ph1 = frand(seed ^ 0x1b873593) * Math.PI * 2;
  const ph2 = frand(seed ^ 0xcc9e2d51) * Math.PI * 2;
  return (
    amplitude *
    (0.62 * Math.sin((Math.PI * 2 * t) / p1 + ph1) +
      0.38 * Math.sin((Math.PI * 2 * t) / p2 + ph2))
  );
}
