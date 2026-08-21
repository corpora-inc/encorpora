import { strict as assert } from "node:assert"
import { test } from "node:test"

import { MICRO } from "../core/bigmath.ts"
import { TIERS, addSparks, buy, newEconomy, sparksPerSecond, step } from "../core/economy.ts"
import { deserialize, load, save, serialize, useSaveSlot, type Persisted } from "./save.ts"

function played() {
  const e = newEconomy()
  addSparks(e, 10n ** 24n * MICRO)
  for (let i = 0; i < TIERS.length; i++) {
    e.tiers[i].unlocked = true
    buy(e, i, 37 - i * 4)
  }
  for (let i = 0; i < 600; i++) step(e, 60n)
  e.carbon = 41n
  e.marks = 13n
  e.quenches = 5n
  return e
}

test("a save round-trips every quantity exactly, at any magnitude", () => {
  const e = played()
  const back = deserialize(serialize(e, 12, false)).e
  assert.equal(back.sparks, e.sparks)
  assert.equal(back.lifetime, e.lifetime)
  assert.equal(back.allTime, e.allTime)
  assert.equal(back.heat, e.heat)
  assert.equal(back.carbon, e.carbon)
  assert.equal(back.marks, e.marks)
  assert.equal(back.quenches, e.quenches)
  assert.equal(back.sparkCarry, e.sparkCarry)
  for (let i = 0; i < e.tiers.length; i++) {
    assert.equal(back.tiers[i].purchased, e.tiers[i].purchased)
    assert.equal(back.tiers[i].stock, e.tiers[i].stock)
    assert.equal(back.tiers[i].unlocked, e.tiers[i].unlocked)
    // The price is NOT stored — it is recomputed from `purchased` with exact
    // integer powers, so a save can never disagree with the live formula.
    assert.equal(back.tiers[i].cost, e.tiers[i].cost)
  }
  assert.equal(sparksPerSecond(back), sparksPerSecond(e))
})

test("a restored forge keeps producing at exactly the same rate", () => {
  const e = played()
  const back = deserialize(serialize(e, 9, true)).e
  for (let i = 0; i < 3600; i++) {
    step(e, 60n)
    step(back, 60n)
  }
  assert.equal(back.sparks, e.sparks)
})

test("a 200-digit fortune survives the round trip", () => {
  const e = newEconomy()
  e.sparks = 10n ** 200n + 7n
  e.lifetime = e.sparks
  const back = deserialize(serialize(e, 3, true)).e
  assert.equal(back.sparks, 10n ** 200n + 7n)
})

test("corrupt or hostile save data degrades to a fresh forge, never throws", () => {
  const junk = {
    v: 1,
    t: Date.now(),
    sparks: "not a number",
    lifetime: "-999",
    allTime: "1e30",
    heat: "0x10",
    carbon: "9".repeat(400),
    marks: "",
    quenches: null,
    carry: "12.5",
    tiers: [{ p: "banana", s: "-1", b: "x", u: "yes", c: "" }, null, 42],
    markOom: "nope",
    audio: 0,
  } as unknown as Persisted

  const { e, markOom, audio } = deserialize(junk)
  assert.equal(e.sparks, 0n)
  assert.equal(e.lifetime, 0n) // negative rejected
  assert.equal(e.allTime, 0n) // "1e30" is not a decimal integer
  assert.equal(e.heat, 0n)
  assert.equal(e.carbon, BigInt("9".repeat(400))) // huge but valid, so kept
  assert.equal(e.marks, 0n)
  assert.equal(e.quenches, 0n)
  assert.equal(e.sparkCarry, 0n)
  assert.equal(e.tiers[0].purchased, 0n)
  assert.equal(e.tiers[0].unlocked, true) // tier 0 is never sealed
  assert.equal(e.tiers[2].unlocked, false) // sealed tiers stay sealed
  assert.equal(markOom, 3)
  assert.equal(audio, true)
})

// The seam `src/pack.ts` uses. There is no `localStorage` in this process and
// there is none in a pack frame either — it is sandboxed without
// `allow-same-origin` — so a save that reached for one directly would be a
// FORGE that silently resets to zero on every launch of the shipped game. The
// point of this test is that `load()` and `save()` go through the installed
// slot and never touch a global.
test("the save slot is pluggable, so a pack frame with no localStorage still persists", () => {
  let stored: string | null = null
  useSaveSlot({
    read: () => stored,
    write: (value) => {
      stored = value
    },
  })

  assert.equal(load(), null) // nothing written yet

  const e = played()
  save(e, 7, false)
  assert.equal(typeof stored, "string")

  const back = load()
  assert.ok(back)
  assert.equal(back.e.sparks, e.sparks)
  assert.equal(back.e.lifetime, e.lifetime)
  assert.equal(back.markOom, 7)
  assert.equal(back.audio, false)
})

test("a slot that throws on write loses the save, not the run", () => {
  useSaveSlot({
    read: () => {
      throw new Error("storage is gone")
    },
    write: () => {
      throw new Error("storage is gone")
    },
  })
  // Both sides swallow: a device that cannot persist still plays, and the
  // alternative is an exception thrown from inside the game loop.
  assert.doesNotThrow(() => {
    save(played(), 3, true)
  })
  assert.equal(load(), null)
})

test("a sealed station cannot be unsealed by editing the save's flag alone", () => {
  // `u` is honoured, because a legitimately cracked seal must persist — but a
  // save that claims a tier is unlocked still gets the tier's real cost curve
  // recomputed, so nothing is free.
  const e = newEconomy()
  const p = serialize(e, 3, true)
  p.tiers[3] = { p: "0", s: "0", b: "0", u: true, c: "0" }
  const back = deserialize(p).e
  assert.equal(back.tiers[3].unlocked, true)
  assert.equal(back.tiers[3].cost, TIERS[3].baseCost)
  assert.equal(back.tiers[3].purchased, 0n)
})
