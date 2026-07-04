// engine.md §8.2 persistence + recover — codec validation, memory fakes,
// the recovery ladder (log replay, skills proxy, θ re-estimate), downgrades.

import { test } from "node:test"
import assert from "node:assert/strict"

import { DAY_MS } from "./clock.ts"
import { buildGraphIndex } from "./graph.ts"
import { createMemoryPersistence } from "./persistence/memory.ts"
import { projectActivityEvents, recoverEngineState } from "./persistence/recover.ts"
import { itemCardCodec, parseItemCard } from "./persistence/types.ts"
import { createScheduler } from "./scheduler.ts"
import type { CourseState, ItemCard } from "./types.ts"
import { makeEngine, answer, playBatch } from "./__fixtures__/harness.ts"
import { makeFixtureGraph } from "./__fixtures__/fixtureGraph.ts"

const DAY = 20_000
const CONS = { availableProviders: ["native"] }

function goodCard(over: Partial<ItemCard["fsrs"]> = {}): ItemCard {
  return {
    itemId: "phrase:base:1001",
    fsrs: { s: 5.2, d: 4.1, due: DAY + 5, last: DAY, reps: 3, lapses: 1, state: 2, ...over },
    flags: 0,
    form: 1,
  }
}

test("itemCardCodec.parse: round-trips valid cards; rejects out-of-range fields", () => {
  const ok = goodCard()
  assert.deepEqual(parseItemCard(ok), ok)
  assert.equal(parseItemCard(null), null)
  assert.equal(parseItemCard({ ...ok, itemId: "" }), null)
  assert.equal(parseItemCard(goodCard({ s: 0 })), null, "reviewed card with s ≤ 0")
  assert.equal(parseItemCard(goodCard({ d: 0.5 })), null, "d below 1")
  assert.equal(parseItemCard(goodCard({ d: 11 })), null)
  assert.equal(parseItemCard(goodCard({ due: 50_000 })), null, "due beyond sanity horizon")
  assert.equal(parseItemCard(goodCard({ due: 1.5 })), null, "due must be an int epoch day")
  assert.equal(parseItemCard(goodCard({ state: 5 as 0 })), null)
  assert.equal(parseItemCard({ ...ok, form: 3 }), null)
  // New-state cards (incl. post-forget) carry s=0/d=0 legitimately
  const fresh = { ...ok, fsrs: { ...ok.fsrs, s: 0, d: 0, state: 0 as const } }
  assert.deepEqual(parseItemCard(fresh), fresh)
})

test("itemCardCodec.migrate: same-version passes through; unknown versions drop (never guess)", () => {
  const ok = goodCard()
  assert.deepEqual(itemCardCodec.migrate!(ok, 1), ok)
  assert.equal(itemCardCodec.migrate!(ok, 2), null, "downgrade data is dropped, ladder rebuilds")
  assert.equal(itemCardCodec.migrate!(ok, 0), null)
})

test("memory persistence: clone-on-read, event ordering, meta JSON round-trip", async () => {
  const p = createMemoryPersistence()
  const card = goodCard()
  await p.itemCards.put(card.itemId, card)
  const read = (await p.itemCards.get(card.itemId))!
  read.fsrs.s = 999
  assert.equal((await p.itemCards.get(card.itemId))!.fsrs.s, 5.2, "reads are deep clones")
  p.__appendEvent({ ts: 1, tag: "a" })
  p.__appendEvent({ ts: 2, tag: "b" })
  const recs = await p.events.read({})
  assert.deepEqual(recs.map((r) => r.seq), [1, 2])
  await p.meta.setJSON("course", { theta: -1 })
  assert.deepEqual(await p.meta.getJSON("course"), { theta: -1 })
})

function envelope(day: string, items: { ref: string; grade: 1 | 2 | 3 | 4 }[], over: Record<string, unknown> = {}) {
  return {
    v: 1,
    ts: DAY * DAY_MS,
    day,
    sid: "sid",
    stackId: "stack-1",
    courseId: "journey_en",
    e: { type: "activity_result", specId: "s1", activityType: "cloze", slot: "due", strand: "lfl", score: 1, durationMs: 4000, items },
    ...over,
  }
}

test("projectActivityEvents: narrows the analytics envelope; skips alien/other-course records", () => {
  const rows = projectActivityEvents(
    [
      envelope("2024-10-05", [{ ref: "phrase:base:1001", grade: 3 }]),
      envelope("2024-10-06", [{ ref: "phrase:base:1001", grade: 1 }]),
      envelope("2024-10-06", [{ ref: "phrase:base:1002", grade: 4 }], { courseId: "journey_es" }),
      { garbage: true },
      null,
      envelope("not-a-day", [{ ref: "phrase:base:1003", grade: 3 }]),
    ],
    "journey_en",
  )
  assert.equal(rows.length, 2)
  assert.equal(rows[0].itemId, "phrase:base:1001")
  assert.equal(rows[1].grade, 1)
  assert.ok(rows[1].day > rows[0].day)
})

function recoverInput(over: Partial<Parameters<typeof recoverEngineState>[0]> = {}) {
  const graph = makeFixtureGraph()
  const gidx = buildGraphIndex(graph)
  const scheduler = createScheduler()
  const makeDefaultCourse = (): CourseState => ({
    courseId: "journey_en",
    schemaVersion: 1,
    theta: -4,
    thetaK: 0.5,
    resultCount: 0,
    position: { arcId: "arc-0", unitId: "unit-00", unitOrdinal: 0 },
    newPerDay: 12,
    newIntroducedToday: 0,
    dailyCapacityEwma: 40,
    backlogRing: [],
    lastThrottleAdjustDay: DAY,
    strandTally: [],
    jump: { lastOfferedDay: 0, consecutiveCruiseSessions: 0 },
    lesson: null,
    checkpointsPassed: {},
    sessionCounter: 0,
    lastTickDay: DAY,
    lastActiveDay: 0,
    latencyBaselines: {},
    scoredToday: 0,
    sessionsToday: 0,
    sessionsPerDayEwma: 1,
    sessionsWeek: 0,
    cruiseSessionsWeek: 0,
    leechSubstitutes: [],
    leechTypes: {},
    newBoost: [],
    legendaryAttempt: {},
  })
  return {
    gidx,
    scheduler,
    nowMs: DAY * DAY_MS + 12 * 3_600_000,
    day: DAY,
    course: undefined,
    skills: undefined,
    cards: new Map<string, ItemCard>(),
    log: [],
    corruptCards: 0,
    makeDefaultCourse,
    ...over,
  }
}

test("recover 1a: missing cards rebuild from the review log via scheduler.replay; form from registry", () => {
  const input = recoverInput({
    log: [
      { itemId: "phrase:base:1001", ts: 1, day: DAY - 10, grade: 3, activityType: "cloze", specId: "a" },
      { itemId: "phrase:base:1001", ts: 2, day: DAY - 5, grade: 3, activityType: "listen_type", specId: "b" },
      { itemId: "phrase:base:1001", ts: 3, day: DAY - 2, grade: 1, activityType: "speak_echo", specId: "c" },
    ],
  })
  const out = recoverEngineState(input)
  assert.equal(out.report.rebuiltFromLog, 1)
  const card = out.cards.get("phrase:base:1001")!
  assert.equal(card.fsrs.reps, 3)
  assert.equal(card.fsrs.lapses, 1)
  assert.equal(card.form, 2, "highest PASSED form (listen_type=2; the Again row does not ratchet)")
})

test("recover 2/3: skills proxy from derived strength; θ re-estimated at the 75th pct of practiced b", () => {
  // build strong cards for the whole first unit
  const input = recoverInput()
  const scheduler = input.scheduler
  for (const skillId of input.gidx.units[0].skillIds) {
    for (const itemId of input.gidx.skillItems.get(skillId) ?? []) {
      const card: ItemCard = { itemId, fsrs: scheduler.emptyCard(DAY - 1), flags: 0, form: 1 }
      card.fsrs = scheduler.next(card, (DAY - 1) * DAY_MS + 3_600_000, 3).fsrs
      input.cards.set(itemId, card)
    }
  }
  const out = recoverEngineState(input)
  assert.equal(out.report.skillsLost, true)
  assert.equal(out.report.courseStateLost, true)
  const s0 = out.skills.get(input.gidx.units[0].skillIds[0])!
  assert.ok(s0.accEwma > 0.8, "accEwma proxied from derived strength")
  assert.ok(s0.announcedLevel >= 2, "announcedLevel set to derived level (no celebration storm)")
  assert.ok(out.course.theta > -4, "θ re-estimated from practiced skills")
  assert.equal(out.course.position.unitId, "unit-01", "position recomputed from derived levels")
})

test("recover: fresh state (no course, no cards, no log) reports nothing lost", () => {
  const out = recoverEngineState(recoverInput())
  assert.equal(out.report.courseStateLost, false)
  assert.equal(out.report.skillsLost, false)
  assert.equal(out.report.rebuiltFromLog, 0)
})

test("end-to-end: cards persist through flush and a second engine load reads them back", async () => {
  const h = await makeEngine()
  h.engine.startSession()
  for (let b = 0; b < 3; b++) {
    const cards = h.engine.nextFeedItems(10, CONS)
    if (cards.length === 0) break
    playBatch(h.engine, cards)
  }
  await h.engine.flush()
  const persisted = await h.persistence.itemCards.getAll()
  assert.ok(persisted.size > 0)
  for (const [, raw] of persisted) {
    assert.ok(itemCardCodec.parse(raw), "every persisted card passes its own codec")
  }
  // second engine over the same stores
  const { createJourneyEngine } = await import("./engine.ts")
  const engine2 = createJourneyEngine({
    key: { stackId: "stack-1", courseId: "journey_en" },
    graph: h.graph,
    persistence: h.persistence,
    clock: h.clock,
  })
  const loaded = await engine2.load()
  assert.equal(loaded.fresh, false)
  assert.equal(loaded.recovered.courseStateLost, false)
  const snapA = h.engine.getCourseSnapshot()
  const snapB = engine2.getCourseSnapshot()
  assert.equal(snapB.theta, snapA.theta)
  assert.deepEqual(snapB.position, snapA.position)
  void answer
})
