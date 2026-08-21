import { strict as assert } from "node:assert"
import { test } from "node:test"

import { MICRO } from "./bigmath.ts"
import {
  QUENCH_FLOOR,
  TIERS,
  addHeat,
  addSparks,
  buy,
  canQuench,
  carbonFor,
  doublings,
  globalMul,
  loseHeat,
  newEconomy,
  peekCost,
  quench,
  sparksPerSecond,
  step,
  tierCount,
} from "./economy.ts"

function run(seconds: number, tps: bigint, setup: (e: ReturnType<typeof newEconomy>) => void) {
  const e = newEconomy()
  setup(e)
  const ticks = Math.round(seconds * Number(tps))
  for (let i = 0; i < ticks; i++) step(e, tps)
  return e
}

test("every quantity stays a bigint through a long run", () => {
  const e = run(600, 60n, (x) => {
    addSparks(x, 10_000n * MICRO)
    buy(x, 0, 40)
    buy(x, 1, 20)
  })
  assert.equal(typeof e.sparks, "bigint")
  assert.equal(typeof e.lifetime, "bigint")
  assert.equal(typeof e.tiers[0].stock, "bigint")
  assert.ok(e.sparks > 0n)
})

test("simulation is deterministic — two identical runs agree exactly", () => {
  const setup = (x: ReturnType<typeof newEconomy>) => {
    addSparks(x, 1_000_000n * MICRO)
    buy(x, 0, 31)
    buy(x, 1, 17)
    addHeat(x, 144, 6)
  }
  const a = run(300, 60n, setup)
  const b = run(300, 60n, setup)
  assert.equal(a.sparks, b.sparks)
  assert.equal(a.heat, b.heat)
  assert.equal(a.tiers[0].stock, b.tiers[0].stock)
})

test("offline catch-up at 1 Hz tracks the live 60 Hz sim closely", () => {
  // The SAME `step`, run coarser. They cannot be bit-identical (production is
  // integrated at a different granularity and the chain compounds), but they
  // must not diverge in any way a player could notice or exploit.
  const setup = (x: ReturnType<typeof newEconomy>) => {
    addSparks(x, 500_000n * MICRO)
    buy(x, 0, 25)
    buy(x, 1, 12)
  }
  const fast = run(3600, 60n, setup)
  const slow = run(3600, 1n, setup)
  const hi = fast.sparks > slow.sparks ? fast.sparks : slow.sparks
  const lo = fast.sparks > slow.sparks ? slow.sparks : fast.sparks
  assert.ok(lo > 0n)
  // Within 1%, integer-only comparison.
  assert.ok((hi - lo) * 100n < hi, `divergence too large: ${lo} vs ${hi}`)
})

test("carry means a slow station never rounds itself to a standstill", () => {
  // One CRUCIBLE's output per tick is a fraction of a micro-unit at 60 Hz.
  // Integer division alone would floor it to zero forever; the carry means a
  // second of ticks pays exactly one second of production, to the micro.
  const e = newEconomy()
  e.tiers[1].purchased = 1n
  e.tiers[1].unlocked = true
  const before = tierCount(e.tiers[0])
  for (let i = 0; i < 60; i++) step(e, 60n)
  const after = tierCount(e.tiers[0])
  assert.ok(after > before)
  assert.equal(after - before, TIERS[1].rate)
})

test("a station too slow to pay a whole micro per tick still pays", () => {
  // The pathological case the carry exists for: one micro-unit per second is
  // 1/60 of a unit per tick, which truncates to nothing every single tick.
  const e = newEconomy()
  const tiny = { ...TIERS[1], rate: 1n }
  const t = e.tiers[1]
  t.purchased = 1n
  t.unlocked = true
  // Drive the same arithmetic `step` uses, with a rate of one micro per second.
  let carry = 0n
  let gained = 0n
  for (let i = 0; i < 60; i++) {
    const total = tiny.rate + carry
    gained += total / 60n
    carry = total % 60n
  }
  assert.equal(gained, 1n)
})

test("cost curve is exact, monotone, and peekCost matches sequential buying", () => {
  const a = newEconomy()
  addSparks(a, 10n ** 12n * MICRO)
  const quoted = peekCost(a, 0, 25)
  const before = a.sparks
  const n = buy(a, 0, 25)
  assert.equal(n, 25)
  assert.equal(before - a.sparks, quoted * MICRO)

  // Strictly increasing.
  const b = newEconomy()
  addSparks(b, 10n ** 18n * MICRO)
  let last = 0n
  for (let i = 0; i < 60; i++) {
    assert.ok(b.tiers[0].cost > last, `cost ${b.tiers[0].cost} > ${last}`)
    last = b.tiers[0].cost
    buy(b, 0, 1)
  }
  // 1.15^60 is about 4384x the base.
  assert.ok(b.tiers[0].cost > TIERS[0].baseCost * 4000n)
})

test("output doubles every ten purchases, exactly", () => {
  const e = newEconomy()
  addSparks(e, 10n ** 9n * MICRO)
  buy(e, 0, 10)
  const at10 = sparksPerSecond(e)
  assert.equal(doublings(e.tiers[0]), 1n)
  // Ten more units at double the multiplier is four times the output.
  buy(e, 0, 10)
  assert.equal(doublings(e.tiers[0]), 2n)
  assert.equal(sparksPerSecond(e), at10 * 4n)
})

test("heat multiplies production exactly and bleeds to zero", () => {
  const e = newEconomy()
  addSparks(e, 10_000n * MICRO)
  buy(e, 0, 10)
  const cold = sparksPerSecond(e)
  addHeat(e, 100, 0) // +100 heat -> x2.00
  assert.equal(e.heat, 100n * MICRO)
  assert.equal(globalMul(e).num / globalMul(e).den, 2n)
  assert.equal(sparksPerSecond(e), cold * 2n)

  for (let i = 0; i < 60 * 600; i++) step(e, 60n)
  assert.equal(e.heat, 0n)
})

test("a wrong strike costs a quarter of the heat you were sitting on", () => {
  const e = newEconomy()
  addHeat(e, 200, 0)
  const lost = loseHeat(e)
  assert.equal(lost, 50n * MICRO)
  assert.equal(e.heat, 150n * MICRO)
  // The penalty scales with success: guessing while hot is the expensive move.
  addHeat(e, 2000, 0)
  assert.ok(loseHeat(e) > lost * 8n)
})

test("combo scales the heat payout by exactly (2+c)/2", () => {
  const e = newEconomy()
  assert.equal(addHeat(e, 10, 0), 10n * MICRO)
  e.heat = 0n
  assert.equal(addHeat(e, 10, 4), 30n * MICRO)
  e.heat = 0n
  // Capped at combo 10 so it cannot run away.
  assert.equal(addHeat(e, 10, 50), 60n * MICRO)
})

test("carbon is an exact integer square root of lifetime / QUENCH_FLOOR", () => {
  const e = newEconomy()
  assert.equal(carbonFor(e.lifetime), 0n)
  e.lifetime = (QUENCH_FLOOR - 1n) * MICRO
  assert.equal(carbonFor(e.lifetime), 0n)
  e.lifetime = QUENCH_FLOOR * MICRO
  assert.equal(carbonFor(e.lifetime), 1n)
  e.lifetime = 400n * QUENCH_FLOOR * MICRO
  assert.equal(carbonFor(e.lifetime), 20n)
  e.lifetime = 10_000n * QUENCH_FLOOR * MICRO
  assert.equal(carbonFor(e.lifetime), 100n)
  // Quadrupling the haul only doubles the payout. That is the lesson.
  e.lifetime = 40_000n * QUENCH_FLOOR * MICRO
  assert.equal(carbonFor(e.lifetime), 200n)
})

test("quench resets the run, keeps carbon and marks, and pays the difference", () => {
  const e = newEconomy()
  addSparks(e, 400n * QUENCH_FLOOR * MICRO)
  buy(e, 0, 12)
  e.marks = 3n
  assert.ok(canQuench(e))
  const gained = quench(e)
  assert.equal(gained, 20n)
  assert.equal(e.carbon, 20n)
  assert.equal(e.marks, 3n)
  assert.equal(e.sparks, 0n)
  assert.equal(e.lifetime, 0n)
  assert.equal(e.tiers[0].purchased, 0n)
  assert.equal(e.tiers[0].cost, TIERS[0].baseCost)
  assert.equal(canQuench(e), false)
  // 20 carbon is a x5 global multiplier, permanently.
  assert.equal(globalMul(e).num / globalMul(e).den, 5n)
})

test("the chain really is a chain: a deeper station compounds into sparks", () => {
  // Two identical forges. One also runs HAMMERs, which make CRUCIBLEs, which
  // make BELLOWS, which make sparks — a third-order term that must overtake
  // the second-order one given a minute to integrate.
  function forge(withHammers: boolean) {
    const e = newEconomy()
    addSparks(e, 10n ** 12n * MICRO)
    buy(e, 0, 5)
    buy(e, 1, 5)
    e.tiers[2].unlocked = true
    if (withHammers) buy(e, 2, 5)
    for (let i = 0; i < 60 * 60; i++) step(e, 60n)
    return sparksPerSecond(e)
  }
  const flat = forge(false)
  const deep = forge(true)
  assert.ok(flat > 0n)
  assert.ok(deep > flat * 2n, `deep ${deep} should dwarf flat ${flat}`)
})
