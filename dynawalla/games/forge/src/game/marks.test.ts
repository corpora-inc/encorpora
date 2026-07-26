import { strict as assert } from "node:assert"
import { test } from "node:test"

import { MICRO } from "../core/bigmath.ts"
import { addSparks, buy, newEconomy, sparksPerSecond, tierCount } from "../core/economy.ts"
import { makeRng } from "../core/rng.ts"
import { applyOffer, makeMarkRound, resultingCount } from "./marks.ts"

function stocked(purchases: number) {
  const e = newEconomy()
  addSparks(e, 10n ** 15n * MICRO)
  buy(e, 0, purchases)
  return e
}

test("the better offer is always the one that yields more, and never a tie", () => {
  const rng = makeRng(31337)
  for (const owned of [3, 4, 9, 17, 40, 120, 400]) {
    for (let i = 0; i < 200; i++) {
      const e = stocked(owned)
      const m = makeMarkRound(e, rng)
      const c0 = resultingCount(e, m.offers[0])
      const c1 = resultingCount(e, m.offers[1])
      assert.notEqual(c0, c1, "a tie would make the choice meaningless")
      assert.equal(m.better, c0 > c1 ? 0 : 1)

      // And the rule the child is actually learning holds: +N beats x2 exactly
      // when N is bigger than what you already own.
      const addIndex = m.offers[0].kind === "add" ? 0 : 1
      const add = m.offers[addIndex]
      assert.equal(add.kind, "add")
      if (add.kind !== "add") return
      assert.equal(m.better === addIndex, add.n > m.have)
    }
  }
})

test("both outcomes appear — it is not learnable by pattern", () => {
  const rng = makeRng(2024)
  let addWins = 0
  const N = 400
  for (let i = 0; i < N; i++) {
    const e = stocked(25)
    const m = makeMarkRound(e, rng)
    const addIndex = m.offers[0].kind === "add" ? 0 : 1
    if (m.better === addIndex) addWins++
  }
  assert.ok(addWins > N * 0.3 && addWins < N * 0.7, `add won ${addWins}/${N}`)
})

test("the side each offer sits on is also randomised", () => {
  const rng = makeRng(808)
  let leftIsAdd = 0
  for (let i = 0; i < 400; i++) {
    const e = stocked(12)
    if (makeMarkRound(e, rng).offers[0].kind === "add") leftIsAdd++
  }
  assert.ok(leftIsAdd > 120 && leftIsAdd < 280, `left was add ${leftIsAdd}/400`)
})

test("+N adds exactly N units of production and moves neither price nor pips", () => {
  const e = stocked(9)
  const priceBefore = e.tiers[0].cost
  const purchasedBefore = e.tiers[0].purchased
  const countBefore = tierCount(e.tiers[0])
  applyOffer(e, { kind: "add", tier: 0, n: 14n })
  assert.equal(tierCount(e.tiers[0]) - countBefore, 14n * MICRO)
  assert.equal(e.tiers[0].cost, priceBefore)
  assert.equal(e.tiers[0].purchased, purchasedBefore)
})

test("x2 exactly doubles that station's output", () => {
  const e = stocked(9)
  const before = sparksPerSecond(e)
  applyOffer(e, { kind: "double", tier: 0 })
  assert.equal(sparksPerSecond(e), before * 2n)
})

test("the crossover really moves as the player grows", () => {
  // The same offer, +20, is right when you own 9 and wrong when you own 400.
  const small = stocked(9)
  const large = stocked(400)
  const offer = { kind: "add", tier: 0, n: 20n } as const
  const dbl = { kind: "double", tier: 0 } as const
  assert.ok(resultingCount(small, offer) > resultingCount(small, dbl))
  assert.ok(resultingCount(large, offer) < resultingCount(large, dbl))
})
