// engine.md §8.2 engine facade — load idempotence, lazy tickDay, seed
// stability, jump/legendary gauntlets, telemetry.

import { test } from "node:test"
import assert from "node:assert/strict"

import { DAY_MS } from "./clock.ts"
import { answer, makeEngine, playBatch } from "./__fixtures__/harness.ts"

const CONS = { availableProviders: ["native"] }

test("load is idempotent (one promise, one result)", async () => {
  const h = await makeEngine()
  const a = await h.engine.load()
  const b = await h.engine.load()
  assert.equal(a, b)
  assert.equal(a.fresh, true)
})

test("lazy tickDay: first call of a new day resets the intake counter", async () => {
  const h = await makeEngine()
  h.engine.startSession()
  for (let b = 0; b < 4; b++) {
    const cards = h.engine.nextFeedItems(10, CONS)
    if (cards.length === 0) break
    playBatch(h.engine, cards)
  }
  const before = h.engine.getCourseSnapshot().newRemainingToday
  assert.ok(before < 12, "some debuts landed today")
  h.clock.advance(DAY_MS)
  h.engine.nextFeedItems(1, CONS) // any mutating entry point ticks the day
  assert.equal(h.engine.getCourseSnapshot().newRemainingToday, 12)
})

test("startSession seed stability: same (key, sessionCounter) ⇒ same feed", async () => {
  const a = await makeEngine()
  const b = await makeEngine()
  a.engine.startSession()
  b.engine.startSession()
  const ca = a.engine.nextFeedItems(10, CONS)
  const cb = b.engine.nextFeedItems(10, CONS)
  assert.deepEqual(
    ca.map((c) => `${c.spec.specId}:${c.spec.activityType}`),
    cb.map((c) => `${c.spec.specId}:${c.spec.activityType}`),
  )
})

test("requestJump mints a production-bias gauntlet; pass grants provisional skills + θ bonus; probes create no cards", async () => {
  const h = await makeEngine({ chainUnits: false })
  h.engine.startSession()
  const theta0 = h.engine.getCourseSnapshot().theta
  const gauntlet = h.engine.requestJump()
  assert.ok(gauntlet && gauntlet.length >= 3, "3 probes per skipped layer")
  for (const card of gauntlet!) {
    assert.equal(card.meta.pool, "jump")
    h.engine.applyResult(answer(card, { pass: true }))
  }
  await h.engine.flush()
  assert.equal((await h.persistence.itemCards.getAll()).size, 0, "jump probes never create cards")
  assert.ok(h.engine.getCourseSnapshot().theta > theta0, "θ bonus applied on pass")
  const skills = (await h.persistence.meta.getJSON("skills")) as { placedAt?: number }[]
  assert.ok(skills.some((s) => s.placedAt !== undefined), "skipped skills provisionally Practiced")
})

test("failed jump boosts failed items to the head of NEW with zero penalty", async () => {
  const h = await makeEngine({ chainUnits: false })
  h.engine.startSession()
  const theta0 = h.engine.getCourseSnapshot().theta
  const gauntlet = h.engine.requestJump()
  assert.ok(gauntlet)
  for (const card of gauntlet!) h.engine.applyResult(answer(card, { pass: false }))
  const snap = h.engine.getCourseSnapshot()
  assert.ok(snap.theta <= theta0 + 0.01, "no jump bonus on fail")
  await h.engine.flush()
  const course = (await h.persistence.meta.getJSON("course")) as { newBoost: string[] }
  assert.ok(course.newBoost.length > 0, "failed layers' items head the NEW queue")
})

test("requestLegendary: one attempt per day; pass stamps legendaryAt", async () => {
  const h = await makeEngine()
  h.engine.startSession()
  const skillId = h.graph.units[0].skillIds[0]
  const batch = h.engine.requestLegendary(skillId)
  if (!batch) {
    // fixture skill has 6 items < LEGENDARY_ITEMS_MIN ⇒ refused; larger skill:
    const h2 = await makeEngine({ itemsPerSkill: 14 })
    h2.engine.startSession()
    const b2 = h2.engine.requestLegendary(h2.graph.units[0].skillIds[0])
    assert.ok(b2 && b2.length >= 12)
    for (const card of b2!) h2.engine.applyResult(answer(card, { pass: true }))
    await h2.engine.flush()
    const skills = (await h2.persistence.meta.getJSON("skills")) as { skillId: string; legendaryAt?: number }[]
    assert.ok(skills.find((s) => s.skillId === h2.graph.units[0].skillIds[0])?.legendaryAt !== undefined)
    assert.equal(h2.engine.requestLegendary(h2.graph.units[0].skillIds[0]), undefined, "one attempt per local day")
    return
  }
  assert.ok(batch.length >= 12)
})

test("telemetry counts batches and exposes shortfall reasons", async () => {
  const h = await makeEngine()
  h.engine.startSession()
  h.engine.nextFeedItems(10, CONS)
  const t = h.engine.getTelemetry()
  assert.ok(t.batches >= 1)
  assert.equal(typeof t.relaxations, "number")
})
