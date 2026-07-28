// Exact integer factorisation. Every number in this file is an integer and
// every comparison is between integers; a float never reaches a slab, a
// product, or a reported answer.
//
// This is the game's *own* mathematics, not the curriculum's. The host asked
// "what is 47 + 25". Splitting the answer into 8 × 9 is a thing COLOSSUS does
// to turn a number into a building, and nothing about it is reported.

import type { Rng } from "../core/rng.ts"

/**
 * The largest number a slab may carry.
 *
 * Four digits, because three-digit column addition answers 1998 and a keystone
 * the tower cannot carry is a keystone the child never gets asked.
 */
export const MAX_SLAB = 9999

/**
 * The largest factor the game will ever ask a child to multiply *by*.
 *
 * The factoring is the game's own mathematics and it must stay easier than the
 * curriculum's, or the tiers invert: a keystone reading `198 + 246` split into
 * `12 × 37` would make the addition the easy half. So a split only happens when
 * one factor is times-table stone and the other is small; otherwise the answer
 * stands on a single slab and the arithmetic is the whole task, which is the
 * right shape at the tiers where the arithmetic is three digits wide.
 */
export const SMALL_SLAB = 12

/** The other factor of a pair. `7 × 13` is fair; `12 × 37` is a different game. */
export const PAIR_CAP = 25

/** Prime factors of `n`, ascending, with multiplicity. `n >= 2`. */
export function primeFactors(n: number): number[] {
  const out: number[] = []
  let m = n
  for (let p = 2; p * p <= m; p += p === 2 ? 1 : 2) {
    while (m % p === 0) {
      out.push(p)
      m = Math.floor(m / p)
    }
  }
  if (m > 1) out.push(m)
  return out
}

/** Every `d` with `2 <= d <= n / d` and `n % d === 0`. Ascending. */
export function divisorPairs(n: number): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (let d = 2; d * d <= n; d++) {
    if (n % d === 0) out.push([d, Math.floor(n / d)])
  }
  return out
}

/**
 * Split `value` into exactly `want` slabs whose product is `value`.
 *
 * Returns fewer slabs than asked for when the number will not go — 73 is prime
 * and there is no honest pair, so it comes back as a single slab reading 73.
 * That is not a degradation: a one-slab keystone is "find the floor that equals
 * 47 + 25", which is the same arithmetic with the multiplication layer off, and
 * it is exactly what the youngest tier should be playing.
 *
 * Guarantees, all asserted in `factor.test.ts`:
 *   * the product of the result is `value`, exactly;
 *   * every slab is a positive integer no larger than `MAX_SLAB`;
 *   * the result is never empty.
 */
export function slabsFor(value: number, want: number, rng: Rng): number[] {
  if (!Number.isInteger(value) || value < 2 || value > MAX_SLAB) return [value]
  const target = Math.max(1, Math.min(3, Math.round(want)))
  if (target === 1) return [value]

  if (target === 3) {
    const triple = intoBuckets(value, 3, SMALL_SLAB, rng)
    if (triple) return triple
  }

  // A pair a child can see: one times-table factor, one small one. When there
  // is none — 444 is 12 × 37 and nothing kinder — the answer stands on a slab
  // of its own rather than being bent into a harder sum than the keystone.
  const pairs = divisorPairs(value).filter(([a, b]) => a <= SMALL_SLAB && b <= PAIR_CAP)
  if (pairs.length === 0) return [value]

  // The roundest splits first: 72 as 8 × 9 before 72 as 3 × 24.
  const tidy = pairs.filter(([, b]) => b <= SMALL_SLAB)
  const [a, b] = rng.pick(tidy.length > 0 ? tidy : pairs)
  return rng.chance(0.5) ? [a, b] : [b, a]
}

/**
 * Recombine the prime factors of `value` into exactly `count` buckets, each at
 * most `cap`. `null` when the primes will not go — 2 × 3 × 251 cannot become
 * three slabs of twelve or less.
 *
 * Exhaustive over assignments for the small factor counts this game produces
 * (a value under 1000 has at most nine prime factors, so at most 3^9 = 19683
 * assignments), and the first legal one wins after a seeded shuffle so the same
 * value does not always break the same way.
 */
function intoBuckets(value: number, count: number, cap: number, rng: Rng): number[] | null {
  const primes = primeFactors(value)
  if (primes.length < count) return null
  if (primes.some((p) => p > cap)) return null

  const order = rng.shuffle(primes.slice())
  const total = count ** order.length
  const start = rng.int(0, total - 1)

  for (let step = 0; step < total; step++) {
    const code = (start + step) % total
    const buckets = new Array<number>(count).fill(1)
    let rest = code
    for (const p of order) {
      const slot = rest % count
      rest = Math.floor(rest / count)
      buckets[slot] = (buckets[slot] as number) * p
    }
    if (buckets.every((b) => b >= 2 && b <= cap)) return buckets
  }
  return null
}

/** The product of a list of slab values. Exact; overflow is impossible here. */
export function productOf(values: readonly number[]): number {
  let out = 1
  for (const v of values) out *= v
  return out
}
