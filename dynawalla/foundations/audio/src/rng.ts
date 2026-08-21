/**
 * Deterministic, allocation-free randomness.
 *
 * Why not Math.random: a sound heard 500 times must vary, but a bug report must
 * reproduce. Every preset draws from a seeded stream; pass `seed` to `play()`
 * and you get byte-identical output. Also: Math.random on some WebViews is a
 * surprisingly hot call under a rain of grains — mulberry32 is ~3ns and inlines.
 */

/** mulberry32 — 32-bit state, excellent distribution, one multiply-heavy line. */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Cheap string hash for stable per-preset seeds. */
export const hashString = (s: string): number => {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Semitones → frequency ratio. */
export const semi = (n: number): number => Math.pow(2, n / 12)

/** Cents → frequency ratio. */
export const cents = (n: number): number => Math.pow(2, n / 1200)

/** MIDI note → Hz (A4 = 69 = 440Hz). */
export const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12)

/** dB → linear gain. */
export const dbGain = (db: number): number => Math.pow(10, db / 20)

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v

/** Equal-power crossfade curve value for x in 0..1. */
export const equalPower = (x: number): number => Math.sin((x * Math.PI) / 2)

/**
 * Anti-fatigue variation shaper.
 *
 * A flat ±30 cent uniform jitter still fatigues, because uniform noise clusters.
 * This pushes samples away from the centre (a soft bimodal shape), which reads
 * as "a different strike" rather than "the same strike, slightly detuned".
 */
export const spread = (r: number): number => {
  const x = r * 2 - 1
  return Math.sign(x) * Math.pow(Math.abs(x), 0.6)
}

/**
 * Round-robin without immediate repeats: returns an index in [0,n) that is
 * never the same as `last`. This is the single highest-value anti-fatigue trick
 * — human ears detect an exact repeat far more readily than a pitch shift.
 */
export const rotate = (r: number, n: number, last: number): number => {
  if (n <= 1) return 0
  const i = Math.floor(r * (n - 1))
  return i >= last ? i + 1 : i
}
