// engine.md §8.2 daily — catchup ticks, weekly throttle cadence, hysteresis,
// active-day accounting, checkpoint-gated position, epoch-day stability.

import { test } from "node:test"
import assert from "node:assert/strict"

import { DAY_MS, epochDayFromMs } from "./clock.ts"
import { tickOneDay, type DailyBag } from "./daily.ts"
import { buildGraphIndex } from "./graph.ts"
import { createMastery } from "./mastery.ts"
import { createRng } from "./rng.ts"
import { createScheduler } from "./scheduler.ts"
import type { CourseState, ItemCard, SessionState, SkillScalars } from "./types.ts"
import { makeEngine, playBatch } from "./__fixtures__/harness.ts"
import { makeFixtureGraph } from "./__fixtures__/fixtureGraph.ts"

const DAY = 20_000
const CONS = { availableProviders: ["native"] }

function makeDailyBag() {
  const graph = makeFixtureGraph()
  const gidx = buildGraphIndex(graph)
  const scheduler = createScheduler()
  const cards = new Map<string, ItemCard>()
  const skills = new Map<string, SkillScalars>()
  const mastery = createMastery({ gidx, cards, skills, scheduler })
  const course: CourseState = {
    courseId: "journey_en",
    schemaVersion: 1,
    theta: -2,
    thetaK: 0.5,
    resultCount: 0,
    position: { arcId: "arc-0", unitId: "unit-00", unitOrdinal: 0 },
    newPerDay: 12,
    newIntroducedToday: 5,
    dailyCapacityEwma: 40,
    backlogRing: [],
    lastThrottleAdjustDay: DAY - 8,
    strandTally: [{ day: DAY - 20, secs: [1, 1, 1, 1] }, { day: DAY - 1, secs: [2, 2, 2, 2] }],
    jump: { lastOfferedDay: 0, consecutiveCruiseSessions: 0 },
    lesson: null,
    checkpointsPassed: {},
    sessionCounter: 1,
    lastTickDay: DAY - 1,
    lastActiveDay: DAY - 1,
    latencyBaselines: {},
    scoredToday: 30,
    sessionsToday: 1,
    sessionsPerDayEwma: 1,
    sessionsWeek: 4,
    cruiseSessionsWeek: 3,
    leechSubstitutes: [],
    leechTypes: {},
    newBoost: [],
    legendaryAttempt: {},
  }
  const session = { debuts: new Map(), flow: { window: [], mode: "normal" } } as unknown as SessionState
  const nowMs = DAY * DAY_MS + 12 * 3_600_000
  const bag: DailyBag = {
    gidx,
    course,
    cards,
    skills,
    mastery,
    lessonBag: { gidx, course, session, cards, mastery, scheduler, nowMs, day: DAY },
    nowMs,
  }
  return { bag, course, cards, skills, mastery, gidx, scheduler, rng: createRng(7) }
}

test("tick resets daily counters, prunes the 14-day strand tally, records active-day backlog", () => {
  const { bag, course } = makeDailyBag()
  const rollover = tickOneDay(bag, DAY)
  assert.equal(course.newIntroducedToday, 0)
  assert.equal(course.scoredToday, 0)
  assert.equal(course.strandTally.length, 1, "20-day-old bucket dropped")
  assert.equal(course.backlogRing.length, 1, "active day pushed |DUE|")
  assert.ok(course.dailyCapacityEwma !== 40, "capacity EWMA moved toward 30")
  assert.equal(rollover.day, DAY)
})

test("inactive days do not distort the backlog ring", () => {
  const { bag, course } = makeDailyBag()
  course.scoredToday = 0
  tickOneDay(bag, DAY)
  assert.equal(course.backlogRing.length, 0)
})

test("weekly newPerDay adaptation: down on backlog, up on cruise; ≤1 adjust per 7 days", () => {
  const { bag, course } = makeDailyBag()
  course.backlogRing = [80, 90, 100, 80, 90, 100, 90] // median 90 > 1.5×40
  tickOneDay(bag, DAY)
  assert.equal(course.newPerDay, Math.round(12 * 0.8))
  // second tick one day later: cadence guard blocks another adjust
  course.backlogRing = [100, 100, 100, 100, 100, 100, 100]
  course.scoredToday = 10
  tickOneDay(bag, DAY + 1)
  assert.equal(course.newPerDay, Math.round(12 * 0.8), "no second adjustment within 7 days")
})

test("throttle-up needs near-zero backlog AND >50% cruise share; clamps [4,30]", () => {
  const { bag, course } = makeDailyBag()
  course.backlogRing = [0, 0, 0, 0, 0, 0, 0]
  course.newPerDay = 28
  tickOneDay(bag, DAY) // cruiseShare 3/4 > 0.5
  assert.equal(course.newPerDay, 30, "×1.2 then clamped at 30")
})

test("announcement hysteresis: one transition per level change; announcedLevel updated", () => {
  const { bag, course, skills } = makeDailyBag()
  course.scoredToday = 0
  const r1 = tickOneDay(bag, DAY)
  // root skills flip 0 → 1 exactly once
  const roots = r1.announcements.filter((a) => a.from === 0 && a.to === 1)
  assert.ok(roots.length >= 2)
  const r2 = tickOneDay(bag, DAY + 1)
  assert.equal(r2.announcements.length, 0, "no flapping on the next day")
  assert.ok([...skills.values()].some((s) => s.announcedLevel === 1))
})

test("position never advances past an unpassed checkpoint (§4.6.6)", () => {
  const { bag, course, cards, skills, gidx, scheduler, mastery } = makeDailyBag()
  // make unit-00 skills all derive Practiced
  for (const skillId of gidx.units[0].skillIds) {
    skills.set(skillId, { skillId, accEwma: 0.9, announcedLevel: 0 })
    for (const itemId of gidx.skillItems.get(skillId) ?? []) {
      const card: ItemCard = { itemId, fsrs: scheduler.emptyCard(DAY), flags: 0, form: 1 }
      card.fsrs = scheduler.next(card, bag.nowMs - DAY_MS, 3).fsrs
      cards.set(itemId, card)
    }
    mastery.markDirty(skillId)
  }
  tickOneDay(bag, DAY)
  assert.equal(course.position.unitId, "unit-00", "checkpoint gate holds the cursor")
  // pass the checkpoint ⇒ next tick advances
  course.checkpointsPassed["cp-unit-00"] = DAY
  course.scoredToday = 1
  tickOneDay(bag, DAY + 1)
  assert.equal(course.position.unitId, "unit-01")
})

test("multi-day catchup through the facade: 7 missed days tick; >30 jumps to today", async () => {
  const h = await makeEngine()
  h.engine.startSession()
  const cards = h.engine.nextFeedItems(10, CONS)
  playBatch(h.engine, cards)
  h.clock.advance(7 * DAY_MS)
  const r = h.engine.tickDay()
  assert.equal(r.day, epochDayFromMs(h.clock.nowMs()))
  h.clock.advance(100 * DAY_MS)
  const r2 = h.engine.tickDay()
  assert.equal(r2.day, epochDayFromMs(h.clock.nowMs()), "100-day gap jumps straight to today")
})

test("epochDay is stable across DST-style offset boundaries", () => {
  // fixed injected offsets — spring-forward: offset −60min → 0 at a boundary
  const t = DAY * DAY_MS + 2 * 3_600_000
  assert.equal(epochDayFromMs(t, 0), DAY)
  assert.equal(epochDayFromMs(t, -3_600_000), DAY)
  assert.equal(epochDayFromMs(t, 3 * 3_600_000), DAY - 1, "before local midnight with +3h offset")
})

test("week-one check evaluates exactly once at 150 results", () => {
  const { bag, course } = makeDailyBag()
  course.firstWeek = { results: 150, correct: 80, cruiseSessions: 0 } // 53% < 60%
  course.position = { arcId: "arc-0", unitId: "unit-01", unitOrdinal: 1 }
  const r = tickOneDay(bag, DAY)
  assert.equal(r.placementCheck, "offer-rewind")
  assert.equal(course.position.unitOrdinal, 0, "soft rewind steps back one unit")
  assert.equal(course.firstWeek, undefined, "evaluated exactly once")
})
