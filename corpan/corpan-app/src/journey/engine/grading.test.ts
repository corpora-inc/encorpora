// engine.md §8.2 grading — exhaustive §4.5 table walk + caps + boundaries.

import { test } from "node:test"
import assert from "node:assert/strict"

import { toGrade, type GradeInput } from "./grading.ts"
import type { ActivityItemResult, IssuedCard } from "./types.ts"

function issued(over: Partial<IssuedCard> = {}): IssuedCard {
  return {
    specId: "s1",
    activityType: "cloze",
    itemIds: ["phrase:base:1"],
    form: 1,
    guessable: false,
    isReplay: false,
    pool: "due",
    strand: "language",
    estSec: 20,
    modelNeeds: [],
    issuedAtMs: 0,
    ...over,
  }
}

function per(over: Partial<ActivityItemResult> = {}): ActivityItemResult {
  return {
    itemRef: { kind: "phrase", source: "base", id: "1" },
    outcome: "pass",
    latencyMs: 9000, // z = 1 for cloze seed 9000 at textLen 30
    hintsUsed: 0,
    ...over,
  }
}

function grade(input: Partial<GradeInput>): ReturnType<typeof toGrade> {
  return toGrade({
    result: { score: 1 },
    per: per(),
    issued: issued(),
    cardReps: 3,
    baselines: {},
    textLen: 30,
    ...input,
  })
}

// Rows 1–10, top-down first-match --------------------------------------------

test("row 1: never-learned ⇒ forget", () => {
  assert.equal(grade({ per: per({ detail: { selfReport: "never-learned" } }) }).grade, "forget")
})

test("row 2: already-knew on a NEW card ⇒ Easy + priorKnown; ignored on seen cards", () => {
  const fresh = grade({ per: per({ detail: { selfReport: "already-knew" } }), cardReps: 0 })
  assert.equal(fresh.grade, 4)
  assert.equal(fresh.priorKnown, true)
  const seen = grade({ per: per({ detail: { selfReport: "already-knew" } }), cardReps: 5 })
  assert.equal(seen.grade, 3) // falls through to row 10
  assert.equal(seen.priorKnown, false)
})

test("row 3: fail ⇒ Again", () => {
  assert.equal(grade({ per: per({ outcome: "fail" }) }).grade, 1)
})

test("rows 4–5: STT thresholds at 0.44/0.45/0.699/0.7/0.9/0.91", () => {
  const stt = (score: number) => grade({
    issued: issued({ activityType: "speak_echo", modelNeeds: ["stt"] }),
    per: per({ detail: { stt: { overallScore: score } } }),
  }).grade
  assert.equal(stt(0.44), 1)
  assert.equal(stt(0.45), 2)
  assert.equal(stt(0.699), 2)
  assert.equal(stt(0.7), 3) // through to row 10
  assert.equal(stt(0.9), 3) // row 9 needs > 0.9 AND firstTry
  const fast = grade({
    issued: issued({ activityType: "speak_echo", modelNeeds: ["stt"] }),
    per: per({ detail: { stt: { overallScore: 0.91 } }, latencyMs: 1000 }),
    cardReps: 0,
  })
  assert.equal(fast.grade, 4) // z<0.6, firstTry, overall>0.9 ⇒ Easy
})

test("flags.sttUnavailable skips rows 4–5 (STT absence is never a fail)", () => {
  const g = grade({
    issued: issued({ activityType: "speak_echo", modelNeeds: ["stt"] }),
    per: per({ detail: { stt: { overallScore: 0.1 }, flags: { sttUnavailable: true } } }),
  })
  assert.equal(g.grade, 3)
})

test("row 6: partial ⇒ Hard (a pass — Hard is never a fail)", () => {
  assert.equal(grade({ per: per({ outcome: "partial" }) }).grade, 2)
})

test("row 7: hints / retried / slow (z boundaries 2.0 vs 2.01)", () => {
  assert.equal(grade({ per: per({ hintsUsed: 1 }) }).grade, 2)
  assert.equal(grade({ issued: issued({ isReplay: true }) }).grade, 2)
  // cloze seed 9000ms, textLen 30 ⇒ scale 1.0; z = latency/9000
  assert.equal(grade({ per: per({ latencyMs: 9000 * 2.01 }) }).grade, 2)
  assert.equal(grade({ per: per({ latencyMs: 9000 * 2.0 }) }).grade, 3) // z == 2.0 is NOT > 2.0
})

test("row 8: score-only round below 0.5 ⇒ Hard; at 0.5 ⇒ Good (cap)", () => {
  assert.equal(grade({ per: undefined, result: { score: 0.49 } }).grade, 2)
  assert.equal(grade({ per: undefined, result: { score: 0.5 } }).grade, 3)
  assert.equal(grade({ per: undefined, result: { score: 1 } }).grade, 3) // never Easy score-only
})

test("row 9: Easy boundaries (z 0.599 vs 0.6, firstTry, guessable)", () => {
  const fast = (over: Partial<GradeInput>) =>
    grade({ per: per({ latencyMs: 9000 * 0.599 }), cardReps: 0, ...over })
  assert.equal(fast({}).grade, 4)
  assert.equal(grade({ per: per({ latencyMs: 9000 * 0.6 }), cardReps: 0 }).grade, 3) // z==0.6 not <
  assert.equal(fast({ cardReps: 1 }).grade, 3) // not firstTry
  assert.equal(fast({ issued: issued({ guessable: true }) }).grade, 3) // MC-capped
})

test("row 10: otherwise Good", () => {
  assert.equal(grade({}).grade, 3)
})

// Caps ------------------------------------------------------------------------

test("guessable cap: MC formats never exceed Good", () => {
  const g = grade({
    issued: issued({ guessable: true, activityType: "choice_pick" }),
    per: per({ latencyMs: 100 }),
    cardReps: 0,
  })
  assert.equal(g.grade, 3)
})

test("aggregateBinned clamp (R9): Again→Hard, Easy→Good, Hard/Good pass through", () => {
  const binned = (over: Partial<ActivityItemResult>) =>
    grade({ per: per({ ...over, detail: { ...over.detail, flags: { aggregateBinned: true } } }) }).grade
  assert.equal(binned({ outcome: "fail" }), 2) // Again → Hard: never lapses a card
  assert.equal(
    grade({
      per: per({ latencyMs: 1000, detail: { flags: { aggregateBinned: true } } }),
      cardReps: 0,
    }).grade,
    3,
  ) // Easy → Good: never fast-tracks
  assert.equal(binned({ outcome: "partial" }), 2)
  assert.equal(binned({}), 3)
})

test("item-level detail wins over result-level per field", () => {
  const g = toGrade({
    result: { score: 1, detail: { selfReport: "never-learned" } },
    per: per({ detail: { selfReport: "already-knew" } }),
    issued: issued(),
    cardReps: 0,
    baselines: {},
    textLen: 30,
  })
  assert.equal(g.grade, 4) // item-level already-knew shadows result-level
})

test("property: Hard is only ever emitted on a pass", () => {
  // every Hard-producing row above has outcome pass/partial; fail always → Again
  for (const o of ["fail"] as const) {
    assert.equal(grade({ per: per({ outcome: o, hintsUsed: 3 }) }).grade, 1)
  }
})
