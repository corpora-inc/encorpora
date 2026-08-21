import { strict as assert } from "node:assert"
import { test } from "node:test"

import { MICRO } from "../core/bigmath.ts"
import {
  type Economy,
  addSparks,
  buy,
  newEconomy,
  sparksPerSecond,
  step,
  tierCount,
} from "../core/economy.ts"
import { makeRng } from "../core/rng.ts"
import { type MarkRound, applyOffer, makeMarkRound, markOutcome } from "./marks.ts"

function stocked(purchases: number) {
  const e = newEconomy()
  addSparks(e, 10n ** 15n * MICRO)
  buy(e, 0, purchases)
  return e
}

/**
 * An economy whose HAMMER row is genuinely being produced into: two ANVILs (a
 * deliberate two, so `chooseTier` still lands the mark on HAMMER rather than on
 * the ANVIL row above it) pouring hammers in on every tick.
 */
function producing(hammers: number): Economy {
  const e = newEconomy()
  addSparks(e, 10n ** 15n * MICRO)
  for (let i = 0; i <= 3; i++) e.tiers[i].unlocked = true
  buy(e, 3, 2)
  buy(e, 2, hammers)
  return e
}

/** Run `seconds` of simulation at 60 Hz, exactly as the game loop does. */
function run(e: Economy, seconds: number): void {
  for (let i = 0; i < seconds * 60; i++) step(e, 60n)
}

const whole = (e: Economy, tier: number) => tierCount(e.tiers[tier]) / MICRO

test("the better offer is always the one that yields more, and never a tie", () => {
  const rng = makeRng(31337)
  for (const owned of [3, 4, 9, 17, 40, 120, 400]) {
    for (let i = 0; i < 200; i++) {
      const e = stocked(owned)
      const m = makeMarkRound(e, rng)
      const c0 = markOutcome(m, 0)
      const c1 = markOutcome(m, 1)
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

test("x2 exactly doubles that station's count AND its output", () => {
  const e = stocked(9)
  const before = sparksPerSecond(e)
  const countBefore = tierCount(e.tiers[0])
  applyOffer(e, { kind: "double", tier: 0 })
  assert.equal(tierCount(e.tiers[0]), countBefore * 2n)
  assert.equal(sparksPerSecond(e), before * 2n)
})

test("the crossover really moves as the player grows", () => {
  // The same offer, +20, is right when you own 9 and wrong when you own 400.
  const offer = { kind: "add", tier: 0, n: 20n } as const
  const dbl = { kind: "double", tier: 0 } as const
  const small: MarkRound = { tier: 0, have: 9n, offers: [offer, dbl], better: 0 }
  const large: MarkRound = { tier: 0, have: 400n, offers: [offer, dbl], better: 1 }
  assert.ok(markOutcome(small, 0) > markOutcome(small, 1))
  assert.ok(markOutcome(large, 0) < markOutcome(large, 1))
})

// --- the card must not move under the child ---------------------------------
//
// The bug this guards: `have` was snapshotted when the round was built, while
// the two previews were recomputed live from `tierCount` at render time. In an
// idle game that count climbs every tick, so the card printed HAMMER 16 and
// then offered `+27 -> 73` and `x2 -> 93` — three numbers measured from three
// different C's, none of which agreed. A child reasoning correctly from the 16
// they were shown was told they were wrong.
//
// Every assertion below reads the round AFTER real simulation, never on the
// frame it was built.

test("the whole card is frozen while the station keeps producing", () => {
  const rng = makeRng(4242)
  const e = producing(16)
  const m = makeMarkRound(e, rng)
  assert.equal(m.tier, 2, "the mark should be on the producing HAMMER row")

  const have = m.have
  const before = [markOutcome(m, 0), markOutcome(m, 1)]
  const better = m.better
  const countAtCut = whole(e, 2)

  // Time passes, exactly as it does between the milestone and the tap: the
  // anvils pour in hammers and the player keeps buying more.
  run(e, 400)
  buy(e, 2, 25)
  const drift = whole(e, 2) - countAtCut
  assert.ok(drift > 30n, `the count must really have moved; it moved ${drift}`)

  assert.equal(m.have, have, "C moved under the child")
  assert.equal(markOutcome(m, 0), before[0], "the left preview moved")
  assert.equal(markOutcome(m, 1), before[1], "the right preview moved")
  assert.equal(m.better, better, "the right answer changed after the question")
})

test("both previews are exactly the frozen C put through the ingot's own sum", () => {
  const rng = makeRng(99)
  for (let i = 0; i < 120; i++) {
    const e = producing(9 + i)
    const m = makeMarkRound(e, rng)
    run(e, 60)
    for (let k = 0; k < 2; k++) {
      const o = m.offers[k]
      const want = o.kind === "add" ? m.have + o.n : m.have * 2n
      assert.equal(markOutcome(m, k), want, `ingot ${k} does not equal its own sum`)
    }
    // ...and the game's idea of the better one is that same comparison.
    assert.equal(m.better, markOutcome(m, 0) > markOutcome(m, 1) ? 0 : 1)
  }
})

test("the number on the ingot is the number you are left holding", () => {
  const rng = makeRng(777)
  for (let i = 0; i < 60; i++) {
    for (const pick of [0, 1] as const) {
      const e = producing(12 + i * 3)
      const m = makeMarkRound(e, rng)
      const promised = markOutcome(m, pick)
      applyOffer(e, m.offers[pick])
      assert.equal(
        whole(e, m.tier),
        promised,
        `${m.offers[pick].kind} promised ${promised} and left ${whole(e, m.tier)}`,
      )
    }
  }
})

test("taking the better ingot really does leave you producing more", () => {
  const rng = makeRng(31415)
  for (let i = 0; i < 60; i++) {
    const worse = producing(10 + i * 5)
    const m = makeMarkRound(worse, rng)
    const best = producing(10 + i * 5)
    run(worse, 30)
    run(best, 30)
    applyOffer(best, m.offers[m.better])
    applyOffer(worse, m.offers[1 - m.better])
    assert.ok(
      tierCount(best.tiers[m.tier]) > tierCount(worse.tiers[m.tier]),
      "the ingot the game calls better must be the one that leaves more",
    )
  }
})

test("C of 1 is an offer, not a tie", () => {
  // chooseTier falls back to BELLOWS when nothing is running yet, and an empty
  // BELLOWS row floors C to 1. `x2` leaves 2 there, so the addition must win.
  const rng = makeRng(5)
  for (let i = 0; i < 200; i++) {
    const m = makeMarkRound(newEconomy(), rng)
    assert.equal(m.have, 1n)
    assert.notEqual(markOutcome(m, 0), markOutcome(m, 1), "a tie at C=1")
    const addIndex = m.offers[0].kind === "add" ? 0 : 1
    assert.equal(m.better, addIndex, "with one unit, adding must beat doubling")
  }
})
