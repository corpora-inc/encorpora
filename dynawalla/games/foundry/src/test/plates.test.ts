// The escape is the mathematics, so this is the file that has to hold.
//
// Every case here is exhaustive over a range rather than sampled, and every
// assertion is on integers. Nothing in this file calls `Math.random`: the two
// places that need randomness take a seeded `Rng`, constructed inside the test
// with a literal seed, so a green run is a fact and not a coincidence.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import {
  choosePlates,
  gcd,
  MAX_TAPS,
  minTapsFor,
  reachable,
  representations,
  scorePair,
} from "../game/plates.ts"

/** Brute-force truth for `reachable`, written the slow obvious way on purpose. */
function bruteReachable(remaining: number, a: number, b: number): boolean {
  for (let x = 0; x * a <= remaining; x++) {
    for (let y = 0; x * a + y * b <= remaining; y++) {
      if (x * a + y * b === remaining) return true
    }
  }
  return remaining === 0
}

test("gcd is the greatest common divisor, including the zero cases", () => {
  assert.equal(gcd(12, 18), 6)
  assert.equal(gcd(7, 5), 1)
  assert.equal(gcd(0, 9), 9)
  assert.equal(gcd(9, 0), 9)
  assert.equal(gcd(-12, 18), 6)
})

test("reachable agrees with brute force over every small pair and remainder", () => {
  for (let a = 1; a <= 9; a++) {
    for (let b = a + 1; b <= 13; b++) {
      for (let rem = 0; rem <= 90; rem++) {
        assert.equal(
          reachable(rem, a, b),
          bruteReachable(rem, a, b),
          `reachable(${rem}, ${a}, ${b}) disagreed with brute force`,
        )
      }
    }
  }
})

test("reachable refuses non-integers and negatives rather than guessing", () => {
  assert.equal(reachable(-1, 3, 5), false)
  assert.equal(reachable(2.5, 3, 5), false)
  assert.equal(reachable(0, 3, 5), true)
  assert.equal(reachable(10, 0, 5), false)
})

test("the canonical dead end: 24 from 4s and 7s, three sevens deep", () => {
  assert.equal(reachable(24, 4, 7), true)
  // 7 + 7 + 7 = 21 leaves three, and nothing makes three out of fours and sevens.
  assert.equal(reachable(3, 4, 7), false)
  // 7 + 7 = 14 leaves ten, which is also dead: 4 and 8 straddle it.
  assert.equal(reachable(10, 4, 7), false)
  // 4 + 4 + 4 = 12 leaves twelve, which is three more fours.
  assert.equal(reachable(12, 4, 7), true)
})

test("minTapsFor returns the shortest escape and nothing shorter exists", () => {
  assert.equal(minTapsFor(0, 3, 5), 0)
  assert.equal(minTapsFor(26, 3, 5), 6) // 5+5+5+5+3+3
  assert.equal(minTapsFor(15, 3, 5), 3) // 5+5+5 beats five threes
  assert.equal(minTapsFor(3, 4, 7), null)
  for (let target = 1; target <= 120; target++) {
    const best = minTapsFor(target, 3, 7)
    if (best === null) {
      assert.equal(bruteReachable(target, 3, 7), false)
      continue
    }
    let found = Infinity
    for (const { x, y } of representations(target, 3, 7, 60)) found = Math.min(found, x + y)
    assert.equal(best, found, `minTapsFor(${target}, 3, 7)`)
  }
})

test("representations are exact, integral, and inside the tap budget", () => {
  for (const [target, a, b] of [
    [26, 3, 5],
    [48, 7, 12],
    [100, 6, 25],
  ] as const) {
    const reps = representations(target, a, b)
    assert.ok(reps.length > 0, `no representation of ${target} from ${a}/${b}`)
    for (const { x, y } of reps) {
      assert.ok(Number.isInteger(x) && Number.isInteger(y))
      assert.ok(x >= 0 && y >= 0)
      assert.equal(a * x + b * y, target)
      assert.ok(x + y <= MAX_TAPS)
    }
  }
})

test("scorePair encodes the design of the curve, not a hand-tuned constant", () => {
  // A round heavy plate beats an awkward one at the same tap count.
  assert.ok(scorePair(54, 7, 20, 2, 2) < scorePair(48, 7, 17, 2, 2))
  // Five taps is the sweet spot; nine is a drum solo.
  assert.ok(scorePair(74, 7, 20, 2, 3) < scorePair(129, 7, 20, 4, 5))
  // A target the heavy plate reaches on its own in three taps is a trap: the
  // fastest escape would ignore half the equipment.
  assert.ok(scorePair(74, 7, 20, 2, 3) < scorePair(60, 7, 20, 2, 3))
})

test("the chooser avoids the single-escape cliff", () => {
  // 24 from 4s and 7s has exactly one way out — six fours — because
  // 7y ≡ 24 (mod 4) forces y to zero. The first tap of the heavy plate is
  // fatal, which is a true fact about the coin problem and a cruel thing to
  // hand a child under a three-count. Over a hundred seeds it must never come
  // up, and every pair that does come up must offer a second route.
  for (let seed = 1; seed <= 120; seed++) {
    const p = choosePlates(24, new Rng(seed), {})
    assert.ok(!(p.a === 4 && p.b === 7), `seed ${seed} cut the cliff pair`)
    assert.ok(
      representations(24, p.a, p.b).length >= 2,
      `seed ${seed} cut a one-escape pair: ${p.a}/${p.b}`,
    )
  }
})

test("choosePlates always cuts an exact, escapable pair over the whole target range", () => {
  for (let target = 1; target <= 400; target++) {
    for (const pressure of [0, 0.5, 1]) {
      const rng = new Rng(0x1234 + target)
      const p = choosePlates(target, rng, { pressure })
      assert.ok(Number.isInteger(p.a) && Number.isInteger(p.b), `non-integer plate for ${target}`)
      assert.ok(Number.isInteger(p.x) && Number.isInteger(p.y), `non-integer taps for ${target}`)
      assert.ok(p.a >= 1 && p.b > p.a, `plates not ordered for ${target}: ${p.a}/${p.b}`)
      assert.equal(p.a * p.x + p.b * p.y, target, `pair does not reach ${target}`)
      assert.equal(p.taps, p.x + p.y)
      assert.ok(p.taps <= MAX_TAPS, `escape from ${target} costs ${p.taps} taps`)
      assert.ok(reachable(target, p.a, p.b), `${target} unreachable from its own plates`)
    }
  }
})

test("above a trivial target both plates are always part of the escape", () => {
  for (let target = 5; target <= 400; target++) {
    const rng = new Rng(0x99 + target)
    const p = choosePlates(target, rng, {})
    assert.ok(p.x >= 1 && p.y >= 1, `${target} produced a one-plate escape: ${p.x}/${p.y}`)
  }
})

test("the ladder's largest column sums still get a playable pair", () => {
  // `dw.add.regroup.add-multidigit` tops out around four digits, and
  // `4,003 − 87` is a real item. A pair must exist for every one of them.
  for (const target of [1273, 1998, 3916, 9997, 19998]) {
    const rng = new Rng(target)
    const p = choosePlates(target, rng, { pressure: 1 })
    assert.equal(p.a * p.x + p.b * p.y, target)
    assert.ok(p.taps <= MAX_TAPS)
    assert.ok(p.x >= 1 && p.y >= 1)
  }
})

test("choosePlates is deterministic for a given seed and target", () => {
  for (const target of [24, 73, 156]) {
    const first = choosePlates(target, new Rng(0xabcdef), {})
    const second = choosePlates(target, new Rng(0xabcdef), {})
    assert.deepEqual(first, second)
  }
})

test("pressure lengthens the escape rather than changing what is true", () => {
  let easy = 0
  let hard = 0
  for (let target = 20; target <= 200; target++) {
    easy += choosePlates(target, new Rng(target), { pressure: 0 }).taps
    hard += choosePlates(target, new Rng(target), { pressure: 1 }).taps
  }
  assert.ok(hard > easy, `pressure did not lengthen escapes: ${easy} vs ${hard}`)
})
