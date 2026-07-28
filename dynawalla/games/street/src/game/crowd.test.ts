// The crowd, played through without a canvas.
//
// The invariant that carries the art direction as much as the arithmetic:
// **nobody leaves a crack.** A seam rearranges the same bodies into a different
// rectangle, and if that ever stopped being exactly true the array model on
// screen would be a picture of a lie.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import {
  canPunch,
  isCleanBreak,
  isCleared,
  newCrowd,
  punch,
  standing,
  strike,
  type Crowd,
} from "./crowd.ts"
import { bar, crowdPool, isPrime, minimumTaps, seamsFor } from "./factor.ts"

test("a landing seam conserves every body", () => {
  for (const n of crowdPool()) {
    const start = newCrowd(n)
    for (const k of bar(n)) {
      const result = strike(start, k)
      if (result.kind !== "crack") continue
      assert.equal(standing(result.crowd), standing(start), `${k} on ${n} lost bodies`)
      assert.equal(result.crowd.size, k, "the new rank is not the stud struck")
      assert.equal(result.crowd.ranks * k, n)
      assert.equal(result.crowd.total, n)
      assert.equal(result.crowd.downed, 0)
    }
  }
})

test("a refused seam changes nothing at all", () => {
  for (const n of crowdPool()) {
    const start = newCrowd(n)
    for (const k of bar(n)) {
      const result = strike(start, k)
      if (result.kind !== "ringoff") continue
      assert.deepEqual(result.crowd, start, `${k} on ${n} moved the mob`)
      assert.equal(result.remainder, n % k)
      assert.ok(result.remainder > 0, "a refusal with no remainder is a landing")
    }
  }
})

test("a prime mob refuses every stud on its bar", () => {
  for (const n of crowdPool()) {
    if (!isPrime(n)) continue
    const start = newCrowd(n)
    assert.deepEqual(seamsFor(n), [])
    for (const k of bar(n)) {
      assert.equal(strike(start, k).kind, "ringoff", `${k} broke the prime ${n}`)
    }
    // And the thing that will not break is the thing you can hit.
    assert.equal(canPunch(start), true, `the prime ${n} could not be punched`)
  }
})

test("fists bounce off a composite rank and land on a prime one", () => {
  for (const n of crowdPool()) {
    const start = newCrowd(n)
    const result = punch(start)
    if (isPrime(n)) {
      assert.equal(result.kind, "down", `the prime ${n} did not go down`)
      if (result.kind !== "down") return
      assert.equal(result.felled, n)
      assert.equal(result.cleared, true)
      assert.equal(result.crowd.downed, n)
      assert.equal(standing(result.crowd), 0)
    } else {
      assert.equal(result.kind, "bounce", `the composite ${n} was punched down`)
      if (result.kind !== "bounce") return
      assert.deepEqual(result.crowd, start)
    }
  }
})

test("standing plus downed is the whole mob at every step of every wave", () => {
  const rng = new Rng(0x51de)
  for (const n of crowdPool()) {
    let crowd = newCrowd(n)
    let guard = 0
    while (!isCleared(crowd) && guard++ < 400) {
      assert.equal(standing(crowd) + crowd.downed, crowd.total, `bookkeeping broke on ${n}`)
      if (canPunch(crowd)) {
        const result = punch(crowd)
        assert.equal(result.kind, "down")
        crowd = result.crowd
        continue
      }
      // A composite rank: take a seam at random from the ones on offer, so the
      // walk is not the same walk every time.
      const seams = seamsFor(crowd.size)
      assert.ok(seams.length > 0, `stuck on a rank of ${crowd.size}`)
      const result = strike(crowd, rng.pick(seams))
      assert.equal(result.kind, "crack")
      crowd = result.crowd
    }
    assert.equal(isCleared(crowd), true, `a crowd of ${n} never cleared`)
    assert.equal(crowd.downed, n)
    assert.equal(standing(crowd), 0)
  }
})

test("every wave clears however badly it is played", () => {
  // The worst legal play: always take the *smallest* seam, which is the longest
  // route through the tree. It still terminates, and it still terminates fast
  // enough that a child who never finds the good move is not stranded.
  for (const n of crowdPool()) {
    let crowd = newCrowd(n)
    let taps = 0
    let guard = 0
    while (!isCleared(crowd) && guard++ < 500) {
      if (canPunch(crowd)) {
        crowd = (punch(crowd) as { crowd: Crowd }).crowd
      } else {
        const worst = seamsFor(crowd.size)[0] as number
        crowd = (strike(crowd, worst) as { crowd: Crowd }).crowd
      }
      taps++
    }
    assert.equal(isCleared(crowd), true, `the worst play never cleared ${n}`)
    assert.ok(taps >= minimumTaps(n), `the worst play beat the optimum on ${n}`)
    assert.ok(taps <= 16, `the worst play on ${n} took ${taps} taps`)
  }
})

test("a punched-out crowd stays punched out", () => {
  let crowd = newCrowd(5)
  crowd = (punch(crowd) as { crowd: Crowd }).crowd
  assert.equal(isCleared(crowd), true)
  assert.equal(canPunch(crowd), false)
  assert.equal(punch(crowd).kind, "bounce")
  assert.equal(strike(crowd, 2).kind, "ringoff")
})

test("a clean break is the minimum with nothing refused", () => {
  assert.equal(isCleanBreak(5, 0, 5), true)
  assert.equal(isCleanBreak(5, 1, 5), false, "an error still counted as clean")
  assert.equal(isCleanBreak(6, 0, 5), false, "a longer route still counted as clean")
  assert.equal(isCleanBreak(minimumTaps(12), 0, minimumTaps(12)), true)
})
