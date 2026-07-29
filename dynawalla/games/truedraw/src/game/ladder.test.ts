// What this game asks for, and how fast it moves.
//
// The founder's complaint, quantified:
//
//   > "I've gotten 10 correct in a row fast and I still get `2+0=1`... I did 20 in a
//   > row max speed and got `2+1=3`. 25 in a row max speed and I get `2+0=1`."
//
// So the numbers here are asserted against exactly that: ten fast correct calls, and
// where on the ladder they land you.

import assert from "node:assert/strict"
import { test } from "node:test"

import { CEILING, DOWN, Ladder, START, stepFor, UP_MAX, UP_MIN } from "./ladder.ts"
import { OUTCOMES } from "./response.ts"

test("ten correct calls at full speed walk from the bottom to near the top", () => {
  const ladder = new Ladder()
  assert.equal(ladder.difficulty, START)
  for (let i = 0; i < 10; i++) ladder.settle("bank", 1)
  assert.ok(
    ladder.difficulty >= 0.9,
    `ten fast correct calls only reached ${ladder.difficulty.toFixed(3)}`,
  )
})

test("twenty-five at full speed are long since at the ceiling", () => {
  const ladder = new Ladder()
  for (let i = 0; i < 25; i++) ladder.settle("spot", 1)
  assert.equal(ladder.difficulty, CEILING)
})

test("speed is the signal: fast and right climbs far faster than slow and right", () => {
  const fast = new Ladder()
  const slow = new Ladder()
  for (let i = 0; i < 10; i++) {
    fast.settle("bank", 1)
    slow.settle("bank", 0)
  }
  assert.ok(
    fast.difficulty - START > (slow.difficulty - START) * 3,
    `fast climbed ${(fast.difficulty - START).toFixed(3)}, slow ${(slow.difficulty - START).toFixed(3)}`,
  )
  // ...but a correct-and-slow call still climbs. Being right is never a demotion.
  assert.ok(slow.difficulty > START, "a correct but deliberate child was not moved up")
})

test("you fall faster than you climb", () => {
  assert.ok(DOWN > UP_MAX, `a miss (${String(DOWN)}) costs less than a fast hit gains`)
  const ladder = new Ladder(0.6)
  ladder.settle("bank", 1)
  const climbed = ladder.difficulty
  ladder.settle("dud", 1)
  assert.ok(ladder.difficulty < 0.6, `one miss left the child at ${ladder.difficulty.toFixed(3)}`)
  assert.ok(climbed - ladder.difficulty > UP_MAX)
})

test("a wrong verdict costs the same whichever direction it was", () => {
  assert.equal(stepFor("dud", 1), stepFor("burn", 1))
  assert.equal(stepFor("dud", 0), stepFor("dud", 1), "a fast wrong answer was priced differently")
})

test("A LAPSE MOVES NOTHING — a child who ran out of time told us nothing", () => {
  // The same rule `skip` states: no outcome, no verdict, no movement. Betting either
  // way on a window that closed untouched is a guess about a child, and this module
  // does not guess.
  for (const q of [0, 0.5, 1]) assert.equal(stepFor("lapse", q), 0)
  const ladder = new Ladder(0.5)
  for (let i = 0; i < 30; i++) ladder.settle("lapse", 1)
  assert.equal(ladder.difficulty, 0.5)
})

test("the request is NEVER exactly 1, which the SDK would read as the ladder's BOTTOM", () => {
  // `game-host`'s `toUnit`: below 1 is a fraction, at or above 1 is a 1..10 ladder
  // index, and the one ambiguous value — 1 — resolves as the ladder's bottom because
  // five of the six index-scale games send it on their opening question. A game
  // speaking fractions that sent 1.0 would ask for the EASIEST content in the
  // product at the exact moment a child had earned the hardest.
  assert.ok(CEILING < 1)
  const ladder = new Ladder()
  for (let i = 0; i < 200; i++) ladder.settle("bank", 1)
  assert.ok(ladder.difficulty < 1, `the game asked for ${String(ladder.difficulty)}`)
  assert.equal(ladder.difficulty, CEILING)
})

test("the request never goes below zero either", () => {
  const ladder = new Ladder()
  for (let i = 0; i < 200; i++) ladder.settle("burn", 0)
  assert.equal(ladder.difficulty, 0)
})

test("every outcome has a step, and only a miss is negative", () => {
  for (const outcome of OUTCOMES) {
    const step = stepFor(outcome, 0.5)
    assert.ok(Number.isFinite(step), outcome)
  }
  assert.ok(stepFor("bank", 0) >= UP_MIN)
  assert.ok(stepFor("spot", 1) <= UP_MAX)
})

test("a NaN quickness cannot strand the ladder", () => {
  const ladder = new Ladder()
  ladder.settle("bank", Number.NaN)
  assert.ok(Number.isFinite(ladder.difficulty))
  assert.equal(ladder.difficulty, START + UP_MIN)
})

test("a finished run does not send the child back to the bottom", () => {
  // A child who reached rung eight can do rung eight. Handing them `1 + 0 = 1` again
  // because a run ended is the exact complaint this module answers.
  const ladder = new Ladder()
  for (let i = 0; i < 8; i++) ladder.settle("bank", 1)
  const reached = ladder.difficulty
  ladder.reset()
  assert.equal(ladder.difficulty, reached)
})
