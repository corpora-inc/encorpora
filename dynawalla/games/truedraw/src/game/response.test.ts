import assert from "node:assert/strict"
import { test } from "node:test"

import { coinsFor } from "./bag.ts"
import {
  isCorrect,
  isMiss,
  isVerdict,
  outcomeOf,
  OUTCOMES,
  reportsToCurriculum,
  responseFor,
} from "./response.ts"
import { applyOutcome, newRun, SHOTS } from "./run.ts"
import type { Statement } from "./statement.ts"

function statement(over: Partial<Statement> = {}): Statement {
  return {
    questionId: "q1",
    expression: "47 + 25",
    claimed: "62",
    answer: "72",
    truth: false,
    text: "47 + 25 = 62",
    windowMs: 14000,
    stillMs: 320,
    p50Ms: 6000,
    ...over,
  }
}

test("the four verdicts are the two gestures against the two truths", () => {
  assert.equal(outcomeOf("keep", true), "bank")
  assert.equal(outcomeOf("keep", false), "dud")
  assert.equal(outcomeOf("toss", false), "spot")
  assert.equal(outcomeOf("toss", true), "burn")
})

test("each gesture is right exactly half the time", () => {
  const outcomes = [
    outcomeOf("keep", true),
    outcomeOf("keep", false),
    outcomeOf("toss", true),
    outcomeOf("toss", false),
  ]
  assert.equal(outcomes.filter(isCorrect).length, 2)
})

test("a lapse is not a verdict, and the four gestures are", () => {
  for (const outcome of OUTCOMES) {
    assert.equal(isVerdict(outcome), outcome !== "lapse", outcome)
  }
})

test("keeping a counterfeit reports the mal-rule value, so the misconception routes", () => {
  const s = statement()
  // The child said "62". 62 is the carry-dropped output, the host records a miss and
  // names the diagnosis. This is the format's best property.
  assert.equal(responseFor("dud", s), "62")
})

test("banking a true claim reports the value it claimed, which is the answer", () => {
  const s = statement({ claimed: "72", truth: true })
  assert.equal(responseFor("bank", s), "72")
})

test("spotting a counterfeit is credited rather than recorded as a miss", () => {
  // A child who correctly rejects a mal-rule value has done the thing this game
  // measures. Reporting the claimed value instead would demote them down the ladder
  // for playing perfectly.
  assert.equal(responseFor("spot", statement()), "72")
})

test("THROWING AWAY A TRUE CLAIM IS NOW REPORTED, AND THAT IS THE POINT", () => {
  // This is the outcome the second gesture created. Under one verb, "I say that sum
  // is wrong" was expressed by letting the window run out — indistinguishable from
  // "I am still working it out" — so it could not be reported at all and half of the
  // child's evidence never reached the ladder. A swipe up is unambiguous, so it is
  // sent, as the wrong answer it is.
  assert.equal(reportsToCurriculum("burn"), true)
  assert.equal(isCorrect("burn"), false)
  // With no mal-rule to name: "I do not believe 47 + 25 = 72" is not a broken
  // procedure with an output. The host files a miss, which is what it was.
  assert.equal(responseFor("burn", statement({ claimed: "72", truth: true })), "")
})

test("A LAPSE IS NEVER REPORTED — it is skipped", () => {
  // The three verdicts somebody performed are evidence. A window closing on an
  // untouched screen is not, and `report({ correct: false, answered: "" })` is NOT
  // how you say so: the SDK is explicit that the empty string fails to parse and is
  // filed as a MISS, stepping the ladder down for a child who was merely deliberate.
  // `mount.ts` calls `host.skip` instead, and `wiring.test.ts` holds that.
  assert.equal(reportsToCurriculum("bank"), true)
  assert.equal(reportsToCurriculum("spot"), true)
  assert.equal(reportsToCurriculum("dud"), true)
  assert.equal(reportsToCurriculum("burn"), true)
  assert.equal(reportsToCurriculum("lapse"), false)
})

test("a lapse costs neither a shot nor a coin", () => {
  // A window that closed untouched is not a mistake. The two wrong VERDICTS spend a
  // shot; a lapse spends nothing, in either currency.
  assert.equal(isMiss("dud"), true)
  assert.equal(isMiss("burn"), true)
  assert.equal(isMiss("lapse"), false)
  const after = applyOutcome(newRun(), "lapse", coinsFor("lapse", 1))
  assert.equal(after.shots, SHOTS, "a lapse spent a shot")
  assert.equal(after.bag, 0)
  assert.equal(after.lapses, 1)
  assert.equal(after.over, false)
})

test("both wrong verdicts spend a shot, so refusing to read never pays", () => {
  const budget = applyOutcome(
    applyOutcome(newRun(), "burn", coinsFor("burn", 1)),
    "dud",
    coinsFor("dud", 1),
  )
  assert.equal(budget.shots, SHOTS - 2, "one shot each, in both directions")
  assert.equal(budget.calls, 0)
})
