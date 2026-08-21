// THE FACTOR TILE BAR — the passive layer, and the one thing it may never do.
//
// The bar is on screen the whole time a child is holding motes: `2·2·3` with a
// running 12 beside it. It is the reason this game teaches anything when nobody
// is trying, and it is worth exactly nothing if it can ever be false.
//
// So: **after every operation, on every path, the bar is a true factorisation
// of the value it shows.** Every tile prime, the product exactly the value.
// There is no sweep, spill, release or refusal that can leave it otherwise.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import { BANK_CAPACITY, Bank } from "../game/bank.ts"
import { MOTE_PRIMES, ascending, isPrime, primeFactors, productOf } from "../game/factor.ts"

/** The invariant, stated once and called after everything. */
function assertTrueBar(bank: Bank, where: string): void {
  const tiles = bank.tiles
  assert.ok(
    tiles.every(isPrime),
    `${where}: the bar showed a tile that is not prime — ${JSON.stringify(tiles)}`,
  )
  assert.equal(
    productOf(tiles),
    bank.value,
    `${where}: the bar read ${bank.label} but the value beside it was ${bank.value}`,
  )
  assert.deepEqual(
    tiles.slice(),
    ascending(tiles),
    `${where}: the bar was not in ascending order`,
  )
  assert.equal(
    bank.label,
    tiles.join("·"),
    `${where}: the drawn label disagreed with the tiles`,
  )
}

test("an empty bar reads nothing and its value is the multiplicative identity", () => {
  const bank = new Bank()
  assert.equal(bank.size, 0)
  assert.equal(bank.value, 1)
  assert.equal(bank.label, "")
  assertTrueBar(bank, "empty")
})

test("the bar is a true factorisation after every sweep, spill and release", () => {
  // A long seeded sitting: sweep, spill, release, sweep again, thousands of
  // times, checking the invariant after every single operation.
  const rng = new Rng(0xba17ba2)
  const bank = new Bank()
  for (let step = 0; step < 4000; step++) {
    const roll = rng.next()
    if (roll < 0.66) {
      bank.take(rng.pick(MOTE_PRIMES))
      assertTrueBar(bank, `after a sweep at step ${step}`)
    } else if (roll < 0.9) {
      bank.spill()
      assertTrueBar(bank, `after a spill at step ${step}`)
    } else {
      const let_go = bank.release()
      assert.ok(let_go.every(isPrime), `a release at step ${step} let go of a non-prime`)
      assertTrueBar(bank, `after a release at step ${step}`)
    }
  }
})

test("the bar shows exactly what was swept, in the order it is read", () => {
  const bank = new Bank()
  for (const p of [5, 2, 13, 2, 3]) assert.ok(bank.take(p))
  assert.deepEqual(bank.tiles.slice(), [2, 2, 3, 5, 13])
  assert.equal(bank.label, "2·2·3·5·13")
  assert.equal(bank.value, 780)
  assert.equal(productOf(primeFactors(780)), 780)
  assertTrueBar(bank, "a mixed sweep")
})

test("a non-prime is refused outright — the bar cannot be made to lie", () => {
  const bank = new Bank()
  for (const bad of [1, 0, -3, 4, 6, 9, 12, 100, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(bank.take(bad), false, `the bank swallowed ${bad}`)
    assertTrueBar(bank, `after refusing ${bad}`)
  }
  assert.equal(bank.size, 0)
})

test("a spill takes the largest tile, and the value follows it exactly", () => {
  const bank = new Bank()
  for (const p of [2, 3, 13]) bank.take(p)
  assert.equal(bank.value, 78)
  assert.equal(bank.spill(), 13)
  assert.equal(bank.value, 6)
  assertTrueBar(bank, "after a spill")
  assert.equal(bank.spill(), 3)
  assert.equal(bank.spill(), 2)
  assert.equal(bank.spill(), null, "an empty hold spilled something")
  assert.equal(bank.value, 1)
  assertTrueBar(bank, "after emptying")
})

test("the hold has a ceiling, and refusing at it does not disturb the bar", () => {
  const bank = new Bank()
  for (let i = 0; i < BANK_CAPACITY; i++) assert.ok(bank.take(2))
  assert.equal(bank.isFull, true)
  assert.equal(bank.take(2), false, "the hold took a mote past its ceiling")
  assert.equal(bank.size, BANK_CAPACITY)
  assertTrueBar(bank, "at the ceiling")
  // Nine twos is 512, the worst case under the largest target the resonator
  // will ask for; the ceiling has to leave room over that.
  assert.ok(BANK_CAPACITY >= 9, "the hold cannot carry the factorisation of 512")
})

test("a release hands back every tile and leaves the bar empty and true", () => {
  const bank = new Bank()
  for (const p of [2, 2, 3, 7]) bank.take(p)
  const back = bank.release()
  assert.deepEqual(ascending(back), [2, 2, 3, 7])
  assert.equal(bank.size, 0)
  assert.equal(bank.value, 1)
  assertTrueBar(bank, "after a release")
})
