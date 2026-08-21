// The game's own mathematics: cracking a number open, exactly.
//
// Every assertion here is between integers. If a float ever reaches a husk, a
// product or a bank, one of these fails.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import {
  MAX_HUSK,
  ascending,
  divisorPairs,
  huskify,
  isPrime,
  multisetDifference,
  primeFactors,
  productOf,
  sameMultiset,
  splitPair,
} from "../game/factor.ts"

test("isPrime agrees with trial division over the whole playable range", () => {
  const sieve = new Uint8Array(1000).fill(1)
  sieve[0] = 0
  sieve[1] = 0
  for (let p = 2; p < 1000; p++) {
    if (!sieve[p]) continue
    for (let m = p * p; m < 1000; m += p) sieve[m] = 0
  }
  for (let n = 0; n < 1000; n++) {
    assert.equal(isPrime(n), sieve[n] === 1, `isPrime(${n})`)
  }
  assert.equal(isPrime(-7), false)
  assert.equal(isPrime(2.5), false)
})

test("primeFactors multiplies back to the number, ascending, all prime", () => {
  for (let n = 2; n <= 2000; n++) {
    const factors = primeFactors(n)
    assert.equal(productOf(factors), n, `product of the factors of ${n}`)
    assert.ok(
      factors.every(isPrime),
      `a factor of ${n} was not prime: ${JSON.stringify(factors)}`,
    )
    assert.deepEqual(factors, ascending(factors), `the factors of ${n} were not ascending`)
  }
  assert.deepEqual(primeFactors(1), [])
  assert.deepEqual(primeFactors(0), [])
})

test("a prime has no divisor pair — that is the wall, in one line", () => {
  for (let n = 2; n <= 500; n++) {
    if (!isPrime(n)) continue
    assert.deepEqual(divisorPairs(n), [], `${n} is prime and offered a divisor pair`)
    assert.equal(splitPair(n, new Rng(n)), null, `${n} is prime and split`)
  }
})

test("splitPair conserves the product, exactly, for every composite under 2000", () => {
  for (let n = 4; n <= 2000; n++) {
    if (isPrime(n)) continue
    for (let s = 0; s < 6; s++) {
      const pair = splitPair(n, new Rng(n * 31 + s))
      assert.ok(pair, `${n} is composite and would not split`)
      const [a, b] = pair
      assert.ok(Number.isInteger(a) && Number.isInteger(b), `${n} split into non-integers`)
      assert.ok(a >= 2 && b >= 2, `${n} split into ${a} × ${b}, which has a 1 in it`)
      assert.equal(a * b, n, `${n} split into ${a} × ${b}`)
    }
  }
})

test("grinding a husk to exhaustion yields exactly its prime factorisation", () => {
  // The whole passive layer, in a loop: shoot until nothing splits, and what is
  // left drifting must be the prime factorisation of what you started with.
  for (const n of [12, 36, 72, 100, 128, 210, 360, 512, 720, 999]) {
    const rng = new Rng(n * 7 + 1)
    let field = [n]
    for (let guard = 0; guard < 200 && field.some((v) => !isPrime(v)); guard++) {
      const next: number[] = []
      for (const v of field) {
        const pair = isPrime(v) ? null : splitPair(v, rng)
        if (pair) next.push(pair[0], pair[1])
        else next.push(v)
      }
      field = next
    }
    assert.ok(field.every(isPrime), `${n} did not grind down: ${JSON.stringify(field)}`)
    assert.ok(
      sameMultiset(field, primeFactors(n)),
      `${n} ground down to ${JSON.stringify(ascending(field))}`,
    )
  }
})

test("huskify hides a prime list inside composites that give it back", () => {
  for (let n = 2; n <= 999; n++) {
    const wanted = primeFactors(n)
    const rng = new Rng(n * 977 + 3)
    const husks = huskify(wanted, rng)
    assert.ok(husks.length > 0, `${n} produced no husks`)
    assert.equal(productOf(husks), n, `the husks for ${n} do not multiply to it`)
    for (const h of husks) {
      assert.ok(Number.isInteger(h) && h >= 2 && h <= MAX_HUSK, `${n} produced the husk ${h}`)
    }
    // And grinding every husk gives the primes back, with multiplicity.
    const ground = husks.flatMap((h) => primeFactors(h))
    assert.ok(sameMultiset(ground, wanted), `the husks for ${n} ground to something else`)
  }
})

test("multiset helpers are count-sensitive, not set-sensitive", () => {
  assert.equal(sameMultiset([2, 2, 3], [3, 2, 2]), true)
  assert.equal(sameMultiset([2, 2, 3], [2, 3]), false)
  assert.equal(sameMultiset([2, 3], [2, 2, 3]), false)
  assert.deepEqual(multisetDifference([2, 2, 3, 5], [2, 3]), [2, 5])
  assert.deepEqual(multisetDifference([2, 3], [2, 2, 3]), [])
  assert.deepEqual(multisetDifference([7], []), [7])
})

test("productOf is exact over the values this game actually holds", () => {
  assert.equal(productOf([]), 1)
  assert.equal(productOf([2, 2, 3]), 12)
  assert.equal(productOf([2, 2, 2, 3, 3]), 72)
  assert.equal(productOf(primeFactors(999)), 999)
  assert.ok(Number.isInteger(productOf(primeFactors(997))))
})
