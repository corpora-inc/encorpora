// engine.md §8.2 mixer — batch invariants over seeded sessions on the
// fixture graph (§5.4 step-5 rules, model batching, debt brake, timebox,
// determinism).

import { test } from "node:test"
import assert from "node:assert/strict"

import { DAY_MS } from "./clock.ts"
import type { EngineCard } from "./types.ts"
import { makeEngine, playBatch, type Harness } from "./__fixtures__/harness.ts"

const CONS = { availableProviders: ["native"] }

function modelKey(card: EngineCard): number {
  const m = card.spec.modelNeeds ?? []
  if (m.includes("llm")) return 3
  if (m.includes("stt")) return 2
  if (m.includes("tts")) return 1
  return 0
}

function checkBatchInvariants(_h: Harness, cards: EngineCard[], label: string): number {
  let adjacencyViolations = 0
  // no two consecutive slots share activityType (relaxations are
  // telemetry-logged; pairs inside a mandated-contiguous stt/llm/tts block
  // are exempt — §5.4 step 6)
  for (let i = 1; i < cards.length; i++) {
    if (cards[i].spec.activityType !== cards[i - 1].spec.activityType) continue
    if (modelKey(cards[i]) !== 0 || modelKey(cards[i - 1]) !== 0) continue
    adjacencyViolations += 1
  }
  // same item never within gap < 2 (the relaxed floor is never crossed)
  const seen = new Map<string, number>()
  cards.forEach((c, i) => {
    for (const ref of c.spec.itemRefs) {
      const key = `${ref.kind}:${ref.source}:${ref.id}`
      const prev = seen.get(key)
      if (prev !== undefined) {
        assert.ok(i - prev >= 2, `${label}: item ${key} gap ${i - prev} < 2`)
      }
      seen.set(key, i)
    }
  })
  // model-residency: stt/llm blocks contiguous, non-model cards never after them
  const keys = cards.filter((c) => !c.meta.checkpoint && c.meta.pool !== "jump").map(modelKey)
  for (let i = 1; i < keys.length; i++) {
    assert.ok(keys[i] >= keys[i - 1], `${label}: model blocks not contiguous (${keys.join(",")})`)
  }
  // a card with modelNeeds never occupies slot 0 when alternatives exist
  if (cards.length > 1 && keys.some((k) => k === 0)) {
    assert.equal(modelKey(cards[0]), 0, `${label}: model-needing card at slot 0`)
  }
  return adjacencyViolations
}

test("mixer invariants hold across 3 simulated weeks of seeded batches", async () => {
  const h = await makeEngine({ unitsPerArc: 3, itemsPerSkill: 8 })
  let adjacency = 0
  let batches = 0
  for (let day = 0; day < 21; day++) {
    h.engine.startSession()
    for (let b = 0; b < 4; b++) {
      const cards = h.engine.nextFeedItems(10, CONS)
      if (cards.length === 0) break
      batches += 1
      adjacency += checkBatchInvariants(h, cards, `day ${day} batch ${b}`)
      playBatch(h.engine, cards, (_c, i) => i % 5 !== 4) // 80% pass
    }
    h.clock.advance(DAY_MS)
  }
  assert.ok(batches > 40, `served ${batches} batches`)
  // adjacency violations only where the mixer logged a relaxation
  assert.ok(
    adjacency <= h.engine.getTelemetry().relaxations,
    `adjacency ${adjacency} > logged relaxations ${h.engine.getTelemetry().relaxations}`,
  )
})

test("debut order: intro precedes recognition with gap ≥ 3, same session", async () => {
  const h = await makeEngine({ withLessons: false })
  h.engine.startSession()
  const positions = new Map<string, { intro?: number; recog?: number }>()
  let pos = 0
  for (let b = 0; b < 4; b++) {
    const cards = h.engine.nextFeedItems(10, CONS)
    if (cards.length === 0) break
    for (const c of cards) {
      if (c.meta.pool === "new" && c.spec.itemRefs.length === 1) {
        const ref = c.spec.itemRefs[0]
        const key = `${ref.kind}:${ref.source}:${ref.id}`
        const entry = positions.get(key) ?? {}
        if (c.spec.params?.intro === true) entry.intro = pos
        else entry.recog = pos
        positions.set(key, entry)
      }
      pos += 1
    }
    playBatch(h.engine, cards)
  }
  let debutsChecked = 0
  for (const [key, e] of positions) {
    if (e.intro !== undefined && e.recog !== undefined) {
      debutsChecked += 1
      assert.ok(e.recog - e.intro >= 3, `${key}: recognition gap ${e.recog - e.intro} < 3`)
    }
  }
  assert.ok(debutsChecked > 0, "at least one full debut pair observed")
})

test("debt brake: a due avalanche zeroes NEW intake", async () => {
  const h = await makeEngine({ unitsPerArc: 3, itemsPerSkill: 10 })
  // learn for 6 days, then vanish for 25 (lapser pattern)
  for (let day = 0; day < 6; day++) {
    h.engine.startSession()
    for (let b = 0; b < 4; b++) {
      const cards = h.engine.nextFeedItems(10, CONS)
      if (cards.length === 0) break
      playBatch(h.engine, cards)
    }
    h.clock.advance(DAY_MS)
  }
  h.clock.advance(25 * DAY_MS)
  h.engine.startSession()
  assert.ok(h.engine.getCourseSnapshot().debtBrakeActive, "avalanche engages the brake")
  let brakedBatches = 0
  for (let b = 0; b < 3; b++) {
    // the brake is evaluated per batch — reviews within the session can
    // legitimately clear the backlog and re-open intake
    const braked = h.engine.getCourseSnapshot().debtBrakeActive
    const cards = h.engine.nextFeedItems(10, CONS)
    if (braked) {
      brakedBatches += 1
      for (const c of cards) {
        assert.notEqual(c.meta.pool, "new", "debt brake must zero NEW")
        assert.notEqual(c.meta.pool, "trickle", "debt brake pauses TRICKLE")
      }
    }
    playBatch(h.engine, cards)
  }
  assert.ok(brakedBatches >= 1, "at least the first batch ran under the brake")
})

test("timebox trims the batch to the estSec budget", async () => {
  const h = await makeEngine()
  h.engine.startSession()
  const cards = h.engine.nextFeedItems(10, { ...CONS, timeboxSec: 45 })
  const total = cards.reduce((a, c) => a + c.meta.estSec, 0)
  assert.ok(cards.length >= 1)
  assert.ok(total <= 45 || cards.length === 1, `Σ estSec ${total} > 45`)
})

test("availability filter: stt-less host never sees stt cards; quota redistributes", async () => {
  const h = await makeEngine()
  h.engine.startSession()
  for (let b = 0; b < 3; b++) {
    const cards = h.engine.nextFeedItems(10, { ...CONS, modelsAvailable: [] })
    assert.ok(cards.length > 0, "feed degrades gracefully, never empties")
    for (const c of cards) {
      assert.equal((c.spec.modelNeeds ?? []).length, 0)
    }
    playBatch(h.engine, cards)
  }
})

test("excludeActivityTypes is honored (quiet mode)", async () => {
  const h = await makeEngine()
  h.engine.startSession()
  const cards = h.engine.nextFeedItems(10, { ...CONS, excludeActivityTypes: ["speak_echo", "listen_type"] })
  for (const c of cards) {
    assert.notEqual(c.spec.activityType, "speak_echo")
    assert.notEqual(c.spec.activityType, "listen_type")
  }
})

test("P6-style determinism: identical seeds ⇒ identical spec transcripts", async () => {
  const run = async (): Promise<string[]> => {
    const h = await makeEngine()
    const out: string[] = []
    for (let day = 0; day < 3; day++) {
      h.engine.startSession()
      for (let b = 0; b < 3; b++) {
        const cards = h.engine.nextFeedItems(10, CONS)
        if (cards.length === 0) break
        out.push(...cards.map((c) => `${c.spec.specId}|${c.spec.activityType}|${c.meta.pool}`))
        playBatch(h.engine, cards, (_c, i) => i % 3 !== 2)
      }
      h.clock.advance(DAY_MS)
    }
    return out
  }
  const a = await run()
  const b = await run()
  assert.ok(a.length > 20)
  assert.deepEqual(a, b)
})

test("nextFeedItems returns ≥1 card or a typed shortfall reason", async () => {
  const h = await makeEngine()
  h.engine.startSession()
  // impossible constraints: every native type excluded
  const allTypes = [...new Set(h.graph.activityTemplates.map((t) => t.activityType))]
  const cards = h.engine.nextFeedItems(10, { ...CONS, excludeActivityTypes: allTypes })
  if (cards.length === 0) {
    assert.ok(h.engine.getTelemetry().lastShortfallReason, "shortfall must carry a reason")
  }
})

test("newPerDay caps completed debuts per local day", async () => {
  const h = await makeEngine({ unitsPerArc: 3, itemsPerSkill: 12, withLessons: false })
  h.engine.startSession()
  for (let b = 0; b < 10; b++) {
    const cards = h.engine.nextFeedItems(10, CONS)
    if (cards.length === 0) break
    playBatch(h.engine, cards)
  }
  const snap = h.engine.getCourseSnapshot()
  assert.ok(snap.newRemainingToday >= 0, `over-introduced: ${snap.newRemainingToday}`)
})
