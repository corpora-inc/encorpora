import assert from "node:assert/strict"
import { test } from "node:test"

import { isCorrect, outcomeOf, responseFor } from "./response.ts"
import type { Statement } from "./statement.ts"

function statement(over: Partial<Statement> = {}): Statement {
  return {
    questionId: "q1",
    expression: "47 + 25",
    claimed: "62",
    answer: "72",
    truth: false,
    text: "47 + 25 = 62",
    windowMs: 2100,
    stillMs: 900,
    ...over,
  }
}

test("the four outcomes are the two calls against the two truths", () => {
  assert.equal(outcomeOf("draw", true), "hit")
  assert.equal(outcomeOf("draw", false), "wild")
  assert.equal(outcomeOf("hold", false), "bow")
  assert.equal(outcomeOf("hold", true), "slow")
})

test("drawing and holding are each right exactly half the time", () => {
  const outcomes = [
    outcomeOf("draw", true),
    outcomeOf("draw", false),
    outcomeOf("hold", true),
    outcomeOf("hold", false),
  ]
  assert.equal(outcomes.filter(isCorrect).length, 2)
})

test("a wrong draw reports the mal-rule value, so the misconception routes", () => {
  const s = statement()
  // The child said "62". 62 is the carry-dropped output, the host records a
  // miss and names the diagnosis. This is the format's best property.
  assert.equal(responseFor("wild", s), "62")
})

test("a correct draw reports the value it claimed, which is the answer", () => {
  const s = statement({ claimed: "72", truth: true })
  assert.equal(responseFor("hit", s), "72")
})

test("a correct hold is credited rather than recorded as a miss", () => {
  // A child who correctly rejects a mal-rule value has done the thing this
  // game measures. Reporting the claimed value instead would demote them down
  // the ladder for playing perfectly.
  assert.equal(responseFor("bow", statement()), "72")
})

test("letting a true statement stand reports nothing the host can parse", () => {
  const s = statement({ claimed: "72", truth: true })
  // Unparseable, so it is recorded as a miss with no diagnosis. Refusing a
  // true sentence is not a misconception with a name.
  assert.equal(responseFor("slow", s), "")
})
