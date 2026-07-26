// Exact integer arithmetic for the cascade. No floating point anywhere in this
// module: every value the player sees is an integer, every split is an exact
// factorisation, and `a * b === n` is asserted by a test over the whole range
// the spawner can throw.

const SMALL_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47] as const

export function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false
  for (const p of SMALL_PRIMES) {
    if (n === p) return true
    if (n % p === 0) return false
  }
  // Everything the game throws is well under 50^2 = 2401 after the small-prime
  // sieve above, but be correct anyway.
  for (let d = 49; d * d <= n; d += 2) {
    if (n % d === 0) return false
  }
  return true
}

/** Every divisor pair (a, b) with a <= b, a > 1, a * b === n. Ordered by a. */
export function factorPairs(n: number): Array<[number, number]> {
  const out: Array<[number, number]> = []
  if (!Number.isInteger(n) || n < 4) return out
  for (let a = 2; a * a <= n; a++) {
    if (n % a === 0) out.push([a, n / a])
  }
  return out
}

/**
 * Big Omega — the number of prime factors counted with multiplicity. This is
 * the depth of the cascade a number produces, and therefore the single knob the
 * spawner uses to decide how much work a thrown numeral is worth.
 */
export function omega(n: number): number {
  if (!Number.isInteger(n) || n < 2) return 0
  let m = n
  let count = 0
  for (let d = 2; d * d <= m; d++) {
    while (m % d === 0) {
      m /= d
      count++
    }
  }
  if (m > 1) count++
  return count
}

/**
 * Choose the pair a number splits into when it is cut.
 *
 * Weighted toward *balanced* pairs. 24 → (4, 6) reads instantly; 24 → (2, 12)
 * barely feels like progress and drags the cascade out one useless level. The
 * weight is `1 / (1 + b - a)`, integer-derived, so the most balanced pair is
 * several times likelier than the thinnest one without ever excluding it.
 */
export function chooseSplit(n: number, rnd: () => number): [number, number] | null {
  const pairs = factorPairs(n)
  if (pairs.length === 0) return null
  if (pairs.length === 1) return pairs[0] as [number, number]

  let total = 0
  const weights = new Array<number>(pairs.length)
  for (let i = 0; i < pairs.length; i++) {
    const [a, b] = pairs[i] as [number, number]
    const w = 1 / (1 + (b - a))
    weights[i] = w
    total += w
  }
  let r = rnd() * total
  for (let i = 0; i < pairs.length; i++) {
    r -= weights[i] as number
    if (r <= 0) return pairs[i] as [number, number]
  }
  return pairs[pairs.length - 1] as [number, number]
}

/**
 * Candidate values the spawner may throw, bucketed by omega. Built once.
 *
 * The range stops at 144 because a numeral has to be legible at speed on a
 * 320px-wide screen: three digits is the hard ceiling and 144 is the largest
 * value that still yields a satisfying tree. Primes are included on purpose —
 * they are the payoff, not a trap.
 */
export type NumberPool = {
  byOmega: ReadonlyArray<readonly number[]>
  primes: readonly number[]
  maxOmega: number
}

export function buildNumberPool(lo = 2, hi = 144): NumberPool {
  const buckets: number[][] = []
  const primes: number[] = []
  let maxOmega = 0
  for (let n = lo; n <= hi; n++) {
    const w = omega(n)
    if (w === 0) continue
    if (w === 1) primes.push(n)
    maxOmega = Math.max(maxOmega, w)
    ;(buckets[w] ??= []).push(n)
  }
  for (let i = 0; i <= maxOmega; i++) buckets[i] ??= []
  return { byOmega: buckets, primes, maxOmega }
}
