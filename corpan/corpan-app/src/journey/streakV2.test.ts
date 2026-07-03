// Streak v2 accounting tests (feed-ux §1.8): consecutive days, rest-token
// grant (1 per 7 days, cap 2), single-missed-day auto-cover, repair-by-
// learning state machine, milestones.

import { test, beforeEach } from "node:test"
import assert from "node:assert/strict"

// zustand persist needs a storage; give node a localStorage before import.
if (typeof globalThis.localStorage === "undefined") {
  const bag = new Map<string, string>()
  ;(globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => bag.get(k) ?? null,
    setItem: (k: string, v: string) => void bag.set(k, String(v)),
    removeItem: (k: string) => void bag.delete(k),
    clear: () => bag.clear(),
    key: (i: number) => [...bag.keys()][i] ?? null,
    get length() {
      return bag.size
    },
  }
}

const { useJourneyStore } = await import("./store.ts")
const {
  displayStreak,
  maybeOfferRepair,
  noteRepairCheckpoint,
  streakLength,
  tickStreak,
  epochToDay,
  dayToEpoch,
} = await import("./streakV2.ts")

const KEY = "stack::journey_en"
const D0 = "2026-07-01"
const day = (offset: number) => epochToDay(dayToEpoch(D0) + offset)

beforeEach(() => {
  useJourneyStore.setState({ byCourse: {}, learningDays: [] })
  useJourneyStore.getState().enroll(KEY)
})

test("streakLength counts consecutive days ending today or yesterday", () => {
  const days = new Set([day(0), day(1), day(2)])
  assert.equal(streakLength(days, day(2)), 3)
  assert.equal(streakLength(days, day(3)), 3) // yesterday seed
  assert.equal(streakLength(days, day(5)), 0)
})

test("tickStreak is idempotent per day and grants a token on day 7 (cap 2)", () => {
  for (let i = 0; i < 7; i++) {
    tickStreak(KEY, { today: day(i) })
    tickStreak(KEY, { today: day(i) }) // idempotent
  }
  const meta = useJourneyStore.getState().byCourse[KEY]
  assert.equal(meta.restDayTokens, 1)
  assert.equal(displayStreak(KEY, { today: day(6) }), 7)
  // days 8..14 grant the second token; 15..21 must NOT exceed the cap
  for (let i = 7; i < 21; i++) tickStreak(KEY, { today: day(i) })
  assert.equal(useJourneyStore.getState().byCourse[KEY].restDayTokens, 2)
})

test("one missed day is covered by a banked token, shown honestly", () => {
  for (let i = 0; i < 7; i++) tickStreak(KEY, { today: day(i) })
  // miss day 7; show up day 8
  const snap = tickStreak(KEY, { today: day(8) })
  assert.equal(snap.restDayAppliedTo, day(7))
  assert.equal(snap.length, 9) // unbroken through the rest day
  assert.equal(useJourneyStore.getState().byCourse[KEY].restDayTokens, 0)
  assert.ok(useJourneyStore.getState().byCourse[KEY].restDaysUsed.includes(day(7)))
})

test("two missed days break the streak even with a token banked", () => {
  for (let i = 0; i < 7; i++) tickStreak(KEY, { today: day(i) })
  const snap = tickStreak(KEY, { today: day(9) }) // missed 7 AND 8
  assert.equal(snap.length, 1)
})

test("milestone fires exactly when a threshold day is newly reached", () => {
  for (let i = 0; i < 6; i++) tickStreak(KEY, { today: day(i) })
  const snap = tickStreak(KEY, { today: day(6) })
  assert.equal(snap.milestone, 7)
  const again = tickStreak(KEY, { today: day(6) })
  assert.equal(again.milestone, null)
})

test("repair: offered on a broken 14+ streak, restores after 2 checkpoints", () => {
  // no current streak; broken length 20
  const offer = maybeOfferRepair(KEY, 20, { today: day(0) })
  assert.ok(offer)
  assert.equal(offer?.deadlineDay, day(3))
  assert.equal(noteRepairCheckpoint(KEY, { today: day(0) }), false)
  assert.equal(noteRepairCheckpoint(KEY, { today: day(1) }), true) // restored
  tickStreak(KEY, { today: day(1) })
  assert.equal(displayStreak(KEY, { today: day(1) }), 21) // 1 live + 20 restored
})

test("repair window expires past the deadline", () => {
  maybeOfferRepair(KEY, 20, { today: day(0) })
  assert.equal(noteRepairCheckpoint(KEY, { today: day(4) }), false)
  assert.equal(useJourneyStore.getState().byCourse[KEY].repair, null)
})

test("no repair offer below the 14-day floor or while a streak is alive", () => {
  assert.equal(maybeOfferRepair(KEY, 13, { today: day(0) }), null)
  tickStreak(KEY, { today: day(0) })
  assert.equal(maybeOfferRepair(KEY, 30, { today: day(0) }), null)
})
