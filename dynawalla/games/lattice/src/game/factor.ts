// Exact integer factorisation. Every number in this file is an integer and
// every comparison is between integers; a float never reaches a husk, a bank,
// a product, or a reported answer.
//
// This is the game's *own* mathematics. The host asked "what is 47 + 25". That
// a 72 can be cracked into 8 and 9, and the 8 into 2 and 4, and the 4 into 2
// and 2, until only primes are left drifting on the grid, is a thing THE
// LATTICE does with a trigger finger rather than a question anybody asked.
// Nothing about the cracking is reported.
//
// The one property the whole game stands on: **a prime cannot be split.** A
// shot that hits a prime is refused, and no amount of sweeping smaller numbers
// will ever multiply up to it. Primeness is a wall the child hits hundreds of
// times a session, at speed, with a sound attached.

import type { Rng } from "../core/rng.ts"

/** The largest value a husk may carry, and so the largest resonator target. */
export const MAX_HUSK = 9999

/** Primes small enough to be drawn as a drifting mote and read at speed. */
export const MOTE_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47] as const

/**
 * The largest prime the game calls readable, derived rather than repeated.
 *
 * `MOTE_PRIMES` has always said which primes are small enough to be a mote, and
 * the resonator then happily asked for 794 = 2 · 397. A hold with a 397 in it is
 * not the game this pack describes: `resonance.isResonant` uses this so the two
 * statements cannot drift apart.
 */
export const LARGEST_MOTE_PRIME = MOTE_PRIMES[MOTE_PRIMES.length - 1] as number

/** The biggest prime in `n`'s factorisation. `0` for `n < 2`. */
export function largestPrimeFactor(n: number): number {
  const factors = primeFactors(n)
  return factors.length === 0 ? 0 : (factors[factors.length - 1] as number)
}

export function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false
  if (n % 2 === 0) return n === 2
  for (let d = 3; d * d <= n; d += 2) {
    if (n % d === 0) return false
  }
  return true
}

/** Prime factors of `n`, ascending, with multiplicity. `[]` for `n < 2`. */
export function primeFactors(n: number): number[] {
  if (!Number.isInteger(n) || n < 2) return []
  const out: number[] = []
  let m = n
  while (m % 2 === 0) {
    out.push(2)
    m /= 2
  }
  for (let p = 3; p * p <= m; p += 2) {
    while (m % p === 0) {
      out.push(p)
      m /= p
    }
  }
  if (m > 1) out.push(m)
  return out
}

/** Every `d` with `2 <= d <= n / d` and `n % d === 0`. Ascending. */
export function divisorPairs(n: number): Array<[number, number]> {
  const out: Array<[number, number]> = []
  if (!Number.isInteger(n) || n < 4) return out
  for (let d = 2; d * d <= n; d++) {
    if (n % d === 0) out.push([d, n / d])
  }
  return out
}

/**
 * Crack `n` into two factors, both at least 2, whose product is exactly `n`.
 *
 * `null` when `n` is prime or below 4 — that is the wall, and it is the whole
 * reason this function returns a nullable rather than throwing: the arena asks
 * every shot the same question and the answer "this one does not go" is an
 * ordinary answer with its own sound.
 *
 * The pair is chosen to be *seeable*: the split nearest the square root first,
 * so 72 comes apart as 8 × 9 rather than as 2 × 36, and the tree the child
 * watches is balanced rather than a stalk.
 */
export function splitPair(n: number, rng: Rng): [number, number] | null {
  const pairs = divisorPairs(n)
  if (pairs.length === 0) return null

  // Rank by how balanced the split is; keep the tidiest third, then pick.
  const ranked = pairs.slice().sort((x, y) => x[1] / x[0] - y[1] / y[0])
  const keep = Math.max(1, Math.ceil(ranked.length / 3))
  const [a, b] = rng.pick(ranked.slice(0, keep)) as [number, number]
  return rng.chance(0.5) ? [a, b] : [b, a]
}

/** The product of a list. Exact; every input here is a bounded integer. */
export function productOf(values: readonly number[]): number {
  let out = 1
  for (const v of values) out *= v
  return out
}

/** Ascending copy. The bank and the tile bar are always read in this order. */
export function ascending(values: readonly number[]): number[] {
  return values.slice().sort((a, b) => a - b)
}

/** Multiset equality over integers. Order-insensitive, count-sensitive. */
export function sameMultiset(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false
  const x = ascending(a)
  const y = ascending(b)
  for (let i = 0; i < x.length; i++) {
    if (x[i] !== y[i]) return false
  }
  return true
}

/**
 * `a` with one copy of each element of `b` removed, where present.
 * Used to work out which primes a distractor needs that the answer does not.
 */
export function multisetDifference(a: readonly number[], b: readonly number[]): number[] {
  const out = a.slice()
  for (const v of b) {
    const at = out.indexOf(v)
    if (at >= 0) out.splice(at, 1)
  }
  return out
}

/**
 * Gather a list of primes into husks: composite numbers that, cracked all the
 * way down, give back exactly those primes and nothing else.
 *
 * Guaranteed by `factor.test.ts`: the product of the husks equals the product
 * of the primes handed in, every husk is an integer in `2..MAX_HUSK`, and
 * cracking every husk to exhaustion returns the same multiset.
 *
 * A husk carries two or three primes when they fit under the cap and one when
 * they do not — a lone 47 drifting as a prime from the start is not a
 * degradation, it is the wall standing in plain sight.
 */
export function huskify(primes: readonly number[], rng: Rng): number[] {
  const pool = rng.shuffle(primes.slice())
  const husks: number[] = []
  while (pool.length > 0) {
    const want = pool.length >= 3 && rng.chance(0.35) ? 3 : pool.length >= 2 ? 2 : 1
    let value = 1
    let taken = 0
    while (taken < want && pool.length > 0) {
      const p = pool[0] as number
      if (value * p > MAX_HUSK && taken > 0) break
      if (value * p > MAX_HUSK) {
        // A single prime larger than the cap cannot happen (targets are capped)
        // but the guard keeps the loop total rather than infinite.
        husks.push(p)
        pool.shift()
        value = 1
        taken = 0
        continue
      }
      value *= p
      pool.shift()
      taken += 1
    }
    if (value > 1) husks.push(value)
  }
  return husks
}
