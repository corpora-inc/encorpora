// Exact integer arithmetic, asserted. A float in here would become a float in
// a reported answer, and the host judges by string equality.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import { MAX_SLAB, divisorPairs, primeFactors, productOf, slabsFor } from "../game/factor.ts"

test("primeFactors multiplies back to the input, for everything a slab can carry", () => {
  for (let n = 2; n <= 1200; n++) {
    const primes = primeFactors(n)
    assert.equal(productOf(primes), n, `primes of ${n}`)
    for (const p of primes) {
      assert.ok(Number.isInteger(p) && p >= 2, `${p} is not a prime factor`)
      assert.equal(primeFactors(p).length, 1, `${p} is not prime`)
    }
  }
})

test("divisorPairs are exact and ordered", () => {
  for (const n of [12, 72, 100, 210, 997, 1998]) {
    for (const [a, b] of divisorPairs(n)) {
      assert.equal(a * b, n)
      assert.ok(a <= b)
      assert.ok(Number.isInteger(a) && Number.isInteger(b))
    }
  }
})

test("slabsFor: the product is the value, exactly, at every requested width", () => {
  const rng = new Rng(0xc0105)
  for (let n = 1; n <= 2200; n++) {
    for (const want of [1, 2, 3]) {
      const slabs = slabsFor(n, want, rng)
      assert.ok(slabs.length >= 1, `${n}/${want} produced no slab`)
      assert.equal(productOf(slabs), n, `${n} split into ${slabs.join("×")}`)
      for (const v of slabs) {
        assert.ok(Number.isInteger(v), `${v} is not an integer`)
        assert.ok(v >= 1 && v <= MAX_SLAB, `${v} is off the slab range`)
      }
      assert.ok(slabs.length <= want, `${n}/${want} produced ${slabs.length} slabs`)
    }
  }
})

test("a prime keystone comes back as one slab rather than a lie", () => {
  const rng = new Rng(11)
  assert.deepEqual(slabsFor(73, 2, rng), [73])
  assert.deepEqual(slabsFor(73, 3, rng), [73])
  assert.deepEqual(slabsFor(997, 3, rng), [997])
})

test("a composite keystone splits into times-table stone when it can", () => {
  const rng = new Rng(5)
  for (let i = 0; i < 200; i++) {
    const pair = slabsFor(72, 2, rng)
    assert.equal(pair.length, 2)
    assert.equal(productOf(pair), 72)
    assert.ok(
      pair.every((v) => v <= 12),
      `72 split into ${pair.join("×")}, which is not times-table stone`,
    )
  }
  const triple = slabsFor(72, 3, rng)
  assert.equal(triple.length, 3)
  assert.equal(productOf(triple), 72)
  assert.ok(triple.every((v) => v >= 2 && v <= 12))
})

test("slabsFor is seeded: the same seed builds the same tower forever", () => {
  const a = new Rng(0xbeef)
  const b = new Rng(0xbeef)
  for (let n = 2; n < 400; n++) {
    assert.deepEqual(slabsFor(n, 3, a), slabsFor(n, 3, b))
  }
})
