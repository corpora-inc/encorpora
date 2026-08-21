/**
 * A seeded generator, so that "random" is a thing a test can assert.
 *
 * mulberry32 — the same one beatlounge's `chords/random.ts` and this repo's
 * game RNGs use. Thirty-two bits of state, no dependencies, and identical
 * output on every engine, which is what makes a melody reproducible: the whole
 * point of this module is that the notes are not written down anywhere, so the
 * only way to test them is to be able to replay them.
 *
 * Deliberately NOT `Math.random()`. A soundscape that cannot be replayed cannot
 * be reported: "the steelyard sounded wrong on the fourth weight" would be
 * unreproducible, which is how audio bugs become opinions.
 */
export class Rng {
  private state: number

  constructor(seed: number) {
    // `>>> 0` because the algorithm is defined over unsigned 32-bit state, so
    // the invariant holds from construction rather than from the first draw.
    // It is also the whole of the input validation, and it is enough: `>>>`
    // truncates a fraction, wraps a negative and turns a non-finite into 0, so
    // every number is a seed and no seed can produce a different stream on a
    // different engine. A seed arrives over the wire, so that has to be true of
    // all of them. (`next` applies the same coercion to the sum, which is why
    // dropping this line changes no output — it is an invariant, not a fix.)
    this.state = seed >>> 0
  }

  /** The next value in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** An integer in [0, n). Returns 0 for a non-positive or absurd `n`. */
  int(n: number): number {
    if (!Number.isFinite(n) || n <= 0) return 0
    return Math.min(Math.floor(n) - 1, Math.floor(this.next() * Math.floor(n)))
  }

  /** An index into `weights`, chosen in proportion to them. */
  weighted(weights: readonly number[]): number {
    let total = 0
    for (const w of weights) total += Math.max(0, w)
    if (!(total > 0)) return 0
    let roll = this.next() * total
    for (let i = 0; i < weights.length; i++) {
      roll -= Math.max(0, weights[i] ?? 0)
      if (roll < 0) return i
    }
    return weights.length - 1
  }
}
