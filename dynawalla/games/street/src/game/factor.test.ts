// The three claims this game exists to make, and they are checked over the
// whole space rather than over examples. Nothing here is sampled and nothing
// here uses `Math.random`.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  CROWD_MAX,
  CROWD_MIN,
  STUDS,
  bar,
  bestSeam,
  crowdPool,
  isComposite,
  isPrime,
  isSeam,
  largestPrimeFactor,
  leftover,
  minimumTaps,
  primeFactors,
  seamsFor,
  smallestPrimeFactor,
} from "./factor.ts"

// ------------------------------------------------------- the three claims --

test("a prime crowd has no valid seam", () => {
  // The pedagogy in one assertion. A child is never told thirteen is prime;
  // they strike every stud on the bar at thirteen and thirteen does not move.
  for (let n = 2; n <= 400; n++) {
    if (!isPrime(n)) continue
    assert.deepEqual(seamsFor(n), [], `${n} is prime and offered a seam`)
    for (const k of STUDS) {
      assert.equal(isSeam(n, k), false, `stud ${k} landed on the prime ${n}`)
    }
    // And the bar the child is actually shown is exhausted too — "nothing on
    // the bar works" has to mean "nothing works" or the lesson is a lie.
    for (const k of bar(n)) {
      assert.equal(isSeam(n, k), false, `a shown stud ${k} landed on the prime ${n}`)
    }
  }
})

test("every seam the game accepts is a true factor pair", () => {
  for (let n = 2; n <= 400; n++) {
    for (let k = -3; k <= n + 3; k++) {
      if (!isSeam(n, k)) continue
      const other = n / k
      assert.ok(Number.isInteger(other), `${n} / ${k} was not an integer`)
      assert.equal(k * other, n, `${k} × ${other} did not make ${n}`)
      assert.ok(k >= 2, `a seam of ${k} is not a break`)
      assert.ok(other >= 2, `a seam of ${k} on ${n} left a single rank`)
      assert.equal(n % k, 0)
      assert.equal(leftover(n, k), 0, "an accepted seam left a remainder")
    }
  }
})

test("every composite crowd has at least one seam, and it is on the bar", () => {
  // A wave you cannot clear is worse than one that is too easy. `bar(size)`
  // narrows the studs to those below the rank, so this checks the seam is one
  // the child is actually shown, not merely one that exists.
  for (const n of crowdPool()) {
    if (isPrime(n)) continue
    const seams = seamsFor(n)
    assert.ok(seams.length > 0, `the composite ${n} had no seam`)
    const shown = bar(n).filter((k) => isSeam(n, k))
    assert.ok(shown.length > 0, `the composite ${n} had no seam on the bar`)
  }
})

test("the bar can express every seam that exists, for every crowd", () => {
  // Stronger than "at least one": there is no number that divides a mob and no
  // stud to say it with. That is what makes a bar full of ring-offs honest.
  for (const n of crowdPool()) {
    const seams = seamsFor(n)
    const shown = bar(n).filter((k) => isSeam(n, k))
    assert.deepEqual(shown, seams, `the bar for ${n} did not offer every seam`)
  }
})

// ------------------------------------------------------------- primality --

test("isPrime agrees with a trial-division sieve up to 2000", () => {
  const sieve = new Array<boolean>(2001).fill(true)
  sieve[0] = false
  sieve[1] = false
  for (let i = 2; i * i <= 2000; i++) {
    if (!sieve[i]) continue
    for (let j = i * i; j <= 2000; j += i) sieve[j] = false
  }
  for (let n = 0; n <= 2000; n++) {
    assert.equal(isPrime(n), sieve[n], `isPrime(${n})`)
  }
  assert.equal(isPrime(1.5), false)
  assert.equal(isPrime(-7), false)
  assert.equal(isPrime(Number.NaN), false)
})

test("isComposite is the exact complement inside the pool", () => {
  for (const n of crowdPool()) {
    assert.equal(isComposite(n), !isPrime(n))
  }
})

test("prime factors multiply back to the number, exactly", () => {
  for (let n = 2; n <= 500; n++) {
    const fs = primeFactors(n)
    assert.ok(fs.length > 0)
    assert.equal(
      fs.reduce((a, b) => a * b, 1),
      n,
    )
    for (const f of fs) assert.equal(isPrime(f), true, `${f} is not prime`)
    assert.equal(smallestPrimeFactor(n), fs[0])
    assert.equal(largestPrimeFactor(n), fs[fs.length - 1])
  }
})

// ------------------------------------------------------ the optimal route --

/**
 * The fewest taps to clear a crowd of `n`, found by breadth-first search over
 * the actual game states rather than by the closed form `minimumTaps` uses.
 *
 * A state is `ranks` ranks of `size`. A strike costs one tap and turns it into
 * `ranks * size / k` ranks of `k`; a punch costs one tap, is legal only on a
 * prime rank, and takes one rank away. Cleared is `ranks === 0`.
 */
function searchMinimumTaps(n: number): number {
  const start = `1:${n}`
  const seen = new Map<string, number>([[start, 0]])
  let queue: string[] = [start]
  while (queue.length > 0) {
    const next: string[] = []
    for (const key of queue) {
      const cost = seen.get(key) as number
      const [ranksText, sizeText] = key.split(":")
      const ranks = Number(ranksText)
      const size = Number(sizeText)
      if (ranks === 0) return cost
      const moves: string[] = []
      if (isPrime(size)) moves.push(`${ranks - 1}:${size}`)
      for (let k = 2; k < size; k++) {
        if (size % k === 0) moves.push(`${(ranks * size) / k}:${k}`)
      }
      for (const move of moves) {
        if (seen.has(move)) continue
        seen.set(move, cost + 1)
        next.push(move)
      }
    }
    queue = next
  }
  return Number.POSITIVE_INFINITY
}

test("minimumTaps matches a breadth-first search over real game states", () => {
  for (const n of crowdPool()) {
    assert.equal(minimumTaps(n), searchMinimumTaps(n), `minimumTaps(${n})`)
  }
})

test("the optimal opening strike is the largest prime factor", () => {
  for (const n of crowdPool()) {
    if (isPrime(n)) {
      // Nothing to strike. The answer to a solid mob is a fist.
      assert.equal(bestSeam(n), 0)
      assert.equal(minimumTaps(n), 1)
      continue
    }
    const k = bestSeam(n)
    assert.equal(isSeam(n, k), true, `the best seam ${k} does not land on ${n}`)
    assert.equal(isPrime(k), true, `the best seam ${k} is not prime`)
    // Striking it leaves `n / k` prime ranks, so the wave is one strike plus
    // that many punches — and that is the minimum.
    assert.equal(1 + n / k, minimumTaps(n))
  }
})

test("no wave in the pool is longer than eleven taps", () => {
  // A feel bound, and the reason `CROWD_MAX` is 24. A wave that runs longer
  // than this stops being a wave and starts being a sentence.
  for (const n of crowdPool()) {
    assert.ok(minimumTaps(n) <= 11, `a crowd of ${n} needs ${minimumTaps(n)} taps`)
  }
})

test("the pool sits inside its stated bounds", () => {
  const pool = crowdPool()
  assert.equal(pool[0], CROWD_MIN)
  assert.equal(pool[pool.length - 1], CROWD_MAX)
  assert.equal(new Set(pool).size, pool.length)
  assert.ok(pool.some((n) => isPrime(n)), "no prime mob can ever arrive")
  assert.ok(pool.some((n) => !isPrime(n)), "no composite mob can ever arrive")
})

test("a refused seam leaves the remainder standing", () => {
  for (const n of crowdPool()) {
    for (const k of bar(n)) {
      if (isSeam(n, k)) continue
      const rest = leftover(n, k)
      assert.ok(rest > 0 || k >= n, `${k} refused ${n} with nothing left over`)
      assert.equal(Math.floor(n / k) * k + rest, n, "the groups and the remainder do not add up")
    }
  }
})
