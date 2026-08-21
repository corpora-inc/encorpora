// engine.md §8.2 scheduler — T-sched-1 weight pin + wrapper behavior.

import { test } from "node:test"
import assert from "node:assert/strict"

import { DAY_MS } from "./clock.ts"
import { DESIRED_RETENTION } from "./constants.ts"
import { createScheduler, JOURNEY_FSRS_PARAMS } from "./scheduler.ts"
import type { ItemCard } from "./types.ts"

const DAY = 20_000
const noon = (day: number): number => day * DAY_MS + 12 * 3_600_000

function freshCard(itemId = "phrase:base:1"): ItemCard {
  const s = createScheduler()
  return { itemId, fsrs: s.emptyCard(DAY), flags: 0, form: 0 }
}

test("T-sched-1: JOURNEY_FSRS_PARAMS.w equals the 21 FSRS-6 weights verbatim", () => {
  assert.deepEqual(
    [...JOURNEY_FSRS_PARAMS.w],
    [0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001,
     1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014,
     1.8729, 0.5425, 0.0912, 0.0658, 0.1542],
  )
  assert.equal(JOURNEY_FSRS_PARAMS.maximum_interval, 365)
  // the pace knob lives in constants.ts (engine.md §1.1); this pins the wiring
  assert.equal(JOURNEY_FSRS_PARAMS.request_retention, DESIRED_RETENTION)
  assert.equal(JOURNEY_FSRS_PARAMS.enable_short_term, true)
  assert.deepEqual(JOURNEY_FSRS_PARAMS.learning_steps, [])
})

test("same-day replay path: fail then same-day Good does not shrink stability", () => {
  const s = createScheduler()
  const card = freshCard()
  card.fsrs = s.next(card, noon(DAY), 3).fsrs // Good — establish memory
  card.fsrs = s.next(card, noon(DAY + 2), 1).fsrs // Again on due day
  const sAfterFail = card.fsrs.s
  card.fsrs = s.next(card, noon(DAY + 2) + 60_000, 3).fsrs // same-day Good (short-term path)
  assert.ok(card.fsrs.s >= sAfterFail, `S' ${card.fsrs.s} < ${sAfterFail}`)
})

test("a lapse never increases stability", () => {
  const s = createScheduler()
  const card = freshCard()
  card.fsrs = s.next(card, noon(DAY), 3).fsrs
  card.fsrs = s.next(card, noon(DAY + 2), 3).fsrs
  const before = card.fsrs.s
  card.fsrs = s.next(card, noon(card.fsrs.due), 1).fsrs
  assert.ok(card.fsrs.s < before)
  assert.equal(card.fsrs.lapses, 1)
})

test("clock-jump guards: negative elapsed = same-day; huge gaps clamp at 365", () => {
  const s = createScheduler()
  const a = freshCard()
  a.fsrs = s.next(a, noon(DAY), 3).fsrs
  // clock moved BACKWARDS 10 days — treated as same-day, no throw
  const back = s.next(a, noon(DAY - 10), 3).fsrs
  assert.ok(back.due >= DAY - 10)
  // 1000-day gap clamps elapsed to 365
  const b = freshCard("phrase:base:2")
  b.fsrs = s.next(b, noon(DAY), 3).fsrs
  const far = s.next(b, noon(DAY + 1000), 3).fsrs
  assert.ok(far.due - (DAY + 1000) <= 365)
})

test("fuzz determinism: same card + grade + day ⇒ identical due across runs", () => {
  const s1 = createScheduler()
  const s2 = createScheduler()
  const mk = (): ItemCard => freshCard("phrase:base:42")
  const a = mk()
  const b = mk()
  let fa = a.fsrs
  let fb = b.fsrs
  for (const [day, grade] of [[DAY, 3], [DAY + 2, 3], [DAY + 8, 4], [DAY + 30, 2]] as const) {
    fa = s1.next({ ...a, fsrs: fa }, noon(day), grade).fsrs
    fb = s2.next({ ...b, fsrs: fb }, noon(day), grade).fsrs
  }
  assert.equal(fa.due, fb.due)
  assert.equal(fa.s, fb.s)
})

test("forget resets to New", () => {
  const s = createScheduler()
  const card = freshCard()
  card.fsrs = s.next(card, noon(DAY), 3).fsrs
  const forgotten = s.forget(card, noon(DAY + 1))
  assert.equal(forgotten.state, 0)
  assert.equal(forgotten.s, 0)
})

test("retrievability: 0 for New; decays over time for reviewed cards", () => {
  const s = createScheduler()
  const card = freshCard()
  assert.equal(s.retrievability(card, noon(DAY)), 0)
  card.fsrs = s.next(card, noon(DAY), 3).fsrs
  const r1 = s.retrievability(card, noon(DAY + 1))
  const r10 = s.retrievability(card, noon(DAY + 10))
  assert.ok(r1 > r10)
  assert.ok(r1 > 0.8 && r10 > 0)
})

test("replay() reconstructs S/D within 1e-6 of sequential next()", () => {
  const s = createScheduler()
  const card = freshCard("phrase:base:7")
  const grades: (1 | 2 | 3 | 4)[] = [3, 3, 2, 4, 1, 3]
  const days = [DAY, DAY + 2, DAY + 7, DAY + 12, DAY + 30, DAY + 31]
  let f = card.fsrs
  for (let i = 0; i < grades.length; i++) {
    f = s.next({ ...card, fsrs: f }, days[i] * DAY_MS + DAY_MS / 2, grades[i]).fsrs
  }
  const rebuilt = s.replay(
    grades.map((g, i) => ({
      itemId: card.itemId,
      ts: days[i] * DAY_MS,
      day: days[i],
      grade: g,
      activityType: "cloze",
      specId: `spec-${i}`,
    })),
    noon(DAY + 40),
  )
  assert.ok(rebuilt)
  assert.ok(Math.abs(rebuilt.s - f.s) < 1e-6, `S ${rebuilt.s} vs ${f.s}`)
  assert.ok(Math.abs(rebuilt.d - f.d) < 1e-6)
  assert.equal(rebuilt.reps, f.reps)
  assert.equal(rebuilt.lapses, f.lapses)
})

test("seedPriorKnown: Easy then same-day Good, reps 2, spread due dates", () => {
  const s = createScheduler()
  const a = s.seedPriorKnown("phrase:base:11", noon(DAY))
  assert.equal(a.reps, 2)
  assert.equal(a.lapses, 0)
  assert.ok(a.due > DAY + 3, "seeded card is scheduled out")
  // deterministic fuzz keyed by cardId spreads due dates across an item set
  const dues = new Set<number>()
  for (let i = 0; i < 12; i++) dues.add(s.seedPriorKnown(`phrase:base:${1000 + i * 137}`, noon(DAY)).due)
  assert.ok(dues.size >= 3, `due dates spread (${[...dues].join(",")})`)
})
