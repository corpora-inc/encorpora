// THE BAG, and the arithmetic that makes guessing lose.
//
// Every assertion here is a product claim, not a robustness check.

import assert from "node:assert/strict"
import { test } from "node:test"

import { quicknessOf } from "./cadence.ts"
import { addCoins, coinsFor, COIN_BASE, COIN_MAX, COIN_QUICK, COIN_WRONG } from "./bag.ts"
import { isCorrect, OUTCOMES } from "./response.ts"

test("a wrong verdict costs strictly more than the very best call can earn", () => {
  // THE property. If this is ever false the bag becomes a random walk with no
  // drift, and a child who swipes at random — right exactly half the time, because
  // the truth bag deals in exact halves — grows their bag by mashing.
  assert.ok(
    COIN_WRONG > COIN_MAX,
    `a coin flip breaks even or wins: wrong ${String(COIN_WRONG)} vs best ${String(COIN_MAX)}`,
  )
  // ...and the margin, stated: half of (best gain) minus half of (loss) per round.
  const drift = 0.5 * COIN_MAX - 0.5 * COIN_WRONG
  assert.ok(drift < 0, `a coin flip drifts ${drift.toFixed(1)} coins a round`)
})

test("being right is worth more than being fast", () => {
  assert.ok(
    COIN_BASE > COIN_QUICK,
    `speed can outweigh correctness: base ${String(COIN_BASE)} vs quick ${String(COIN_QUICK)}`,
  )
})

test("fast and right is worth the most there is", () => {
  assert.equal(coinsFor("bank", 1), COIN_MAX)
  assert.equal(coinsFor("spot", 1), COIN_MAX)
  assert.ok(coinsFor("bank", 1) > coinsFor("bank", 0))
})

test("slowness is measured and never punished, at any reaction whatsoever", () => {
  // The standing rule. Swept rather than spot-checked: there must be no reaction
  // time anywhere, however long, at which a correct call pays less than the base.
  for (const p50 of [2800, 6000, 16000]) {
    for (let ms = 0; ms <= p50 * 10; ms += 137) {
      const coins = coinsFor("bank", quicknessOf(ms, p50))
      assert.ok(
        coins >= COIN_BASE,
        `a correct call at ${String(ms)}ms against a p50 of ${String(p50)} paid ${String(coins)}`,
      )
      assert.ok(coins <= COIN_MAX)
    }
  }
})

test("the two correct verdicts pay exactly the same", () => {
  // Symmetry is not decoration here. An asymmetry would bias which gesture a child
  // reaches for, and the ladder is now driven by the latency on BOTH of them — so a
  // reward that favoured one direction would bias the sample the ladder learns from.
  for (const q of [0, 0.25, 0.5, 0.75, 1]) {
    assert.equal(coinsFor("bank", q), coinsFor("spot", q), `at quickness ${String(q)}`)
  }
})

test("the two wrong verdicts cost exactly the same, and speed does not change it", () => {
  // A wrong answer given fast is not more wrong than a wrong answer given slowly.
  for (const q of [0, 0.5, 1]) {
    assert.equal(coinsFor("dud", q), -COIN_WRONG)
    assert.equal(coinsFor("burn", q), -COIN_WRONG)
  }
})

test("a lapse is not priced at all", () => {
  for (const q of [0, 0.5, 1]) assert.equal(coinsFor("lapse", q), 0)
})

test("every outcome has a price, and only the correct ones are positive", () => {
  for (const outcome of OUTCOMES) {
    const coins = coinsFor(outcome, 0.5)
    assert.ok(Number.isFinite(coins), outcome)
    if (isCorrect(outcome)) assert.ok(coins > 0, outcome)
    else assert.ok(coins <= 0, outcome)
  }
})

test("the bag floors at nothing — a child is never shown a debt", () => {
  assert.equal(addCoins(0, -COIN_WRONG), 0)
  assert.equal(addCoins(4, -COIN_WRONG), 0)
  assert.equal(addCoins(20, -COIN_WRONG), 8)
})

test("a NaN quickness cannot poison the bag for the rest of the run", () => {
  // It arrives from a division by a table lookup. One NaN in the bag and the score
  // is NaN forever, which is a bug a child would see and nobody would understand.
  // A non-finite credit pays the BASE, not the bonus. Being right still pays in
  // full — the bug must never cost a child coins — but a broken measurement never
  // buys a speed bonus either, because a bonus handed out for a NaN is a bonus a
  // masher gets for free the moment anything upstream divides by zero.
  assert.equal(coinsFor("bank", Number.NaN), COIN_BASE)
  assert.equal(coinsFor("bank", Number.POSITIVE_INFINITY), COIN_BASE)
  assert.equal(coinsFor("bank", -5), COIN_BASE)
})
