// The mathematics of the street. Exact integers only: no float ever enters a
// crowd size, a seam, a rank count or a comparison in this file.
//
// One idea carries the whole game.
//
//   A **crowd** is `ranks` ranks of `size` bodies each — a rectangle, and
//   therefore an array model the child built rather than one they were shown.
//
//   A **seam** is a number `k` you strike. It is valid on a crowd whose rank
//   size is `size` exactly when `2 <= k < size` and `k` divides `size`. The
//   crack lands and every rank of `size` becomes `size / k` ranks of `k`. The
//   body count is untouched: `ranks * size === (ranks * size / k) * k`.
//
//   A rank can be **knocked down** exactly when its size is prime.
//
// Those two rules are the same rule seen from both sides, and between them they
// are the pedagogy:
//
//   * A **prime** rank has no divisor strictly between 1 and itself, so *every*
//     stud on the bar rings off it. The child is never told a number is prime.
//     They strike 2, 3, 4, 5, 6 at a mob of thirteen and thirteen does not
//     move. That is what prime is.
//   * And the thing that will not break is the thing you can hit. A composite
//     rank locks arms and your fists bounce off it; a prime rank goes down in
//     one. So every tap in this game is a claim about a number, and the street
//     answers it in under a frame.

/** Primes small enough to sieve by, covering everything the street can spawn. */
const SMALL_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47] as const

export function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false
  for (const p of SMALL_PRIMES) {
    if (n === p) return true
    if (n % p === 0) return false
  }
  for (let d = 49; d * d <= n; d += 2) {
    if (n % d === 0) return false
  }
  return true
}

export function isComposite(n: number): boolean {
  return Number.isInteger(n) && n >= 4 && !isPrime(n)
}

/**
 * The studs on the breaker bar, in order.
 *
 * It runs to 12 rather than to 9 for a reason that is a design guarantee and
 * not a convenience: the largest proper divisor of any crowd this game spawns
 * is `size / 2 <= 12`, so **every seam that exists is a stud the child can
 * strike**. There is no number that divides the mob and no way to say it. That
 * makes "nothing on the bar works" mean "nothing works", which is the only way
 * a ring-off can honestly teach primeness.
 *
 * `bar()` narrows this to the studs that could conceivably apply, so a rank of
 * five never shows the child a nine.
 */
export const STUDS: readonly number[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

/** The studs offered against a rank of `size`: every stud below it. */
export function bar(size: number): number[] {
  return STUDS.filter((k) => k < size)
}

/** Every valid seam on a rank of `size`, ascending. Empty exactly when prime. */
export function seamsFor(size: number): number[] {
  if (!Number.isInteger(size) || size < 2) return []
  const out: number[] = []
  for (let k = 2; k < size; k++) {
    if (size % k === 0) out.push(k)
  }
  return out
}

/** Whether striking `k` at a rank of `size` lands. The one gate on a strike. */
export function isSeam(size: number, k: number): boolean {
  if (!Number.isInteger(size) || !Number.isInteger(k)) return false
  if (k < 2 || k >= size) return false
  return size % k === 0
}

/**
 * The remainder a refused seam leaves standing.
 *
 * A crack that rings off is not silent about *why*. Striking 5 at a mob of
 * twelve makes two groups of five and leaves two bodies over, and those two are
 * drawn standing apart in the gap before the mob closes back up. Division with
 * a remainder, shown rather than named.
 */
export function leftover(size: number, k: number): number {
  if (!Number.isInteger(size) || !Number.isInteger(k) || k < 1) return 0
  return size % k
}

export function primeFactors(n: number): number[] {
  const out: number[] = []
  if (!Number.isInteger(n) || n < 2) return out
  let m = n
  for (let d = 2; d * d <= m; d++) {
    while (m % d === 0) {
      out.push(d)
      m /= d
    }
  }
  if (m > 1) out.push(m)
  return out
}

/** The largest prime dividing `n`. `0` for anything below 2. */
export function largestPrimeFactor(n: number): number {
  const fs = primeFactors(n)
  return fs.length === 0 ? 0 : (fs[fs.length - 1] as number)
}

/** The smallest prime dividing `n`. Used as the hint after a shove-back. */
export function smallestPrimeFactor(n: number): number {
  const fs = primeFactors(n)
  return fs.length === 0 ? 0 : (fs[0] as number)
}

/**
 * The fewest taps that clear a crowd of `n`, and the proof is short enough to
 * put here because the number is shown to the child as a target.
 *
 * From one rank of `n`, a strike of `k` produces `n / k` ranks of `k`, and the
 * ranks can only be knocked down once their size is prime. A chain of strikes
 * `n = s0 > s1 > … > sm = p` costs `m` strikes plus `n / p` punches, and the
 * punch count depends only on the prime it ends at — never on the route. So
 * more than one strike is always strictly worse, and one strike is always
 * available on a composite (strike a prime factor). Therefore:
 *
 *     prime n     →  1                      (a fist, and nothing else)
 *     composite n →  1 + n / largestPrimeFactor(n)
 *
 * Which is also the lesson: **strike the biggest prime that goes into it.**
 * `factor.test.ts` checks this against a breadth-first search over crowd states
 * rather than trusting the argument.
 */
export function minimumTaps(n: number): number {
  if (!Number.isInteger(n) || n < 2) return 0
  if (isPrime(n)) return 1
  return 1 + n / largestPrimeFactor(n)
}

/** The strike that achieves `minimumTaps`. `0` when the crowd is already prime. */
export function bestSeam(n: number): number {
  if (!isComposite(n)) return 0
  return largestPrimeFactor(n)
}

/**
 * Crowd sizes the street may send.
 *
 * The ceiling is 24 and it is a feel number, not a rendering one: `1 + 24 / 3`
 * is nine taps, which is a long enough wave to have a shape and a short enough
 * one that a child who chose badly is not serving a sentence. Primes are in the
 * pool on purpose and are not a trap — a prime mob is the fastest wave in the
 * game and the loudest, because the answer to it is a fist.
 *
 * 2 and 3 are excluded as *opening* sizes: a mob that is over in one tap before
 * the child has read it is a beat, not a wave.
 */
export const CROWD_MIN = 4
export const CROWD_MAX = 24

export function crowdPool(): number[] {
  const out: number[] = []
  for (let n = CROWD_MIN; n <= CROWD_MAX; n++) out.push(n)
  return out
}
