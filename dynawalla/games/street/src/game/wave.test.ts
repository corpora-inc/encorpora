import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import { CROWD_MAX, CROWD_MIN, bar, isPrime, isSeam, seamsFor } from "./factor.ts"
import { WAVES_PER_BLOCK, bandFor, isSolid, nextWaveSize, wavesPerBlock } from "./wave.ts"

test("every mob the street can send is breakable or punchable, and never neither", () => {
  const rng = new Rng(0xb10c)
  let previous = 0
  for (let i = 0; i < 4000; i++) {
    const size = nextWaveSize(rng, i % 6, previous)
    assert.ok(size >= CROWD_MIN && size <= CROWD_MAX, `a mob of ${size}`)
    if (isPrime(size)) {
      assert.deepEqual(seamsFor(size), [], `the prime ${size} offered a seam`)
    } else {
      assert.ok(bar(size).some((k) => isSeam(size, k)), `the composite ${size} had no seam on the bar`)
    }
    previous = size
  }
})

test("the same mob never arrives twice running", () => {
  const rng = new Rng(0x5a3e)
  let previous = 0
  for (let i = 0; i < 4000; i++) {
    const size = nextWaveSize(rng, 3, previous)
    assert.notEqual(size, previous, "the same rectangle came round the corner twice")
    previous = size
  }
})

test("the band widens with blocks finished, and then stops", () => {
  assert.deepEqual(bandFor(0), { lo: 4, hi: 9 })
  assert.ok(bandFor(3).hi > bandFor(0).hi)
  // It stops widening: difficulty escalates on what the child finished, and
  // then the street is just the street. Nothing here escalates forever.
  assert.deepEqual(bandFor(3), bandFor(9))
  assert.deepEqual(bandFor(3), bandFor(1000))
  assert.deepEqual(bandFor(-5), bandFor(0))
})

test("the opening block stays small", () => {
  const rng = new Rng(0x0e11)
  for (let i = 0; i < 500; i++) {
    const size = nextWaveSize(rng, 0, 0)
    assert.ok(size <= 9, `a mob of ${size} in the first block`)
  }
})

test("both kinds of mob turn up", () => {
  const rng = new Rng(0xb0d1)
  let primes = 0
  let composites = 0
  let previous = 0
  for (let i = 0; i < 600; i++) {
    const size = nextWaveSize(rng, 3, previous)
    if (isPrime(size)) primes++
    else composites++
    previous = size
  }
  assert.ok(primes > 40, `only ${primes} solid mobs in 600`)
  assert.ok(composites > 200, `only ${composites} breakable mobs in 600`)
})

test("the same seed is the same street, forever", () => {
  const draw = () => {
    const rng = new Rng(0xfeed)
    const out: number[] = []
    let previous = 0
    for (let i = 0; i < 60; i++) {
      previous = nextWaveSize(rng, Math.floor(i / WAVES_PER_BLOCK), previous)
      out.push(previous)
    }
    return out
  }
  assert.deepEqual(draw(), draw())
})

test("a block is three waves and a solid mob is a prime one", () => {
  assert.equal(wavesPerBlock(), WAVES_PER_BLOCK)
  assert.equal(WAVES_PER_BLOCK, 3)
  assert.equal(isSolid(13), true)
  assert.equal(isSolid(12), false)
})
