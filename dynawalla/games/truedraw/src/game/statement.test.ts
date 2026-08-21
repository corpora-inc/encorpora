import assert from "node:assert/strict"
import { test } from "node:test"

import type { Question } from "../contract.ts"
import { CADENCE } from "./cadence.ts"
import { sameValue } from "../core/exact.ts"
import { Rng } from "../core/rng.ts"
import { createStubHost } from "../stub/host.ts"
import { buildStatement, falsehoodsFor, stillFor, windowFor } from "./statement.ts"

function question(over: Partial<Question> = {}): Question {
  return {
    id: "q1",
    prompt: "47 + 25",
    answer: "72",
    distractors: ["62", "82"],
    domain: "add",
    difficulty: 0.4,
    ...over,
  }
}

test("a true statement claims the canonical answer, verbatim", () => {
  const s = buildStatement(question(), true, new Rng(1))
  assert.equal(s.truth, true)
  assert.equal(s.claimed, "72")
  assert.equal(s.text, "47 + 25 = 72")
})

test("a false statement claims a mal-rule value", () => {
  const s = buildStatement(question(), false, new Rng(1))
  assert.equal(s.truth, false)
  assert.ok(["62", "82"].includes(s.claimed))
  assert.equal(s.text, `47 + 25 = ${s.claimed}`)
})

test("the answer wearing a different coat is not a falsehood", () => {
  // Every one of these *is* 72. A statement built from one would present a
  // true sentence and ask the child to reject it.
  const q = question({ distractors: ["072", "72.0", "+72", " 72 "] })
  assert.deepEqual(falsehoodsFor(q), [])
  const s = buildStatement(q, false, new Rng(3))
  assert.equal(s.truth, true, "with nothing to lie with, the slate tells the truth")
})

test("an answer that is not a numeral makes every claim untellable", () => {
  // The worst failure this game has is presenting a true sentence as false. If
  // the canonical value cannot be read, no claim can be *proved* wrong, so none
  // is presented as wrong — the slate tells the truth and the round is worth
  // nothing rather than worth a lie.
  for (const answer of ["", "  ", "seven", "1,234"]) {
    const q = question({ answer, distractors: ["62", "82"] })
    assert.deepEqual(falsehoodsFor(q), [], JSON.stringify(answer))
    assert.equal(buildStatement(q, false, new Rng(9)).truth, true, JSON.stringify(answer))
  }
})

test("junk in the distractor list is dropped rather than drawn", () => {
  const q = question({ distractors: ["", "seven", "1,234", "62"] })
  assert.deepEqual(falsehoodsFor(q), ["62"])
})

test("a duplicate distractor is offered once", () => {
  const q = question({ distractors: ["62", "062", "62.00", "82"] })
  assert.deepEqual(falsehoodsFor(q), ["62", "82"])
})

test("across a long stream, a false statement is never accidentally true", () => {
  const host = createStubHost({ seed: 0xf001 })
  const rng = new Rng(0xf002)
  let falses = 0
  for (let i = 0; i < 6000; i++) {
    const q = host.next()
    const s = buildStatement(q, i % 2 === 0, rng)
    if (s.truth) {
      assert.ok(sameValue(s.claimed, s.answer), `claimed ${s.claimed} for answer ${s.answer}`)
      continue
    }
    falses++
    assert.ok(!sameValue(s.claimed, s.answer), `a "false" statement claimed the answer: ${s.text}`)
  }
  assert.ok(falses > 2800, `only ${String(falses)} false statements were buildable`)
})

test("the mal-rule value is preferred over the padding", () => {
  // The host puts the diagnostic value first. A slate that only ever lied with
  // a near-miss would be teaching the child to reject by feel.
  const q = question({ distractors: ["62", "73", "71", "82"] })
  let head = 0
  const rng = new Rng(808)
  for (let i = 0; i < 2000; i++) {
    if (buildStatement(q, false, rng).claimed === "62") head++
  }
  assert.ok(head > 900 && head < 1300, `${String(head)} of 2000 used the mal-rule`)
})

test("the draw window is a function of the statement and of nothing else", () => {
  // In particular not of how long the run has been going: a reaction game that
  // tightens its window as a run lengthens is escalation on run length, which
  // EXPERIENCE_DESIGN.md bans outright.
  const short = windowFor("12 + 5 = 17")
  const long = windowFor("753 + 577 = 1330")
  assert.ok(long > short, "more numeral, more time")
  assert.equal(windowFor("12 + 5 = 17"), short, "the same statement always gets the same window")
  // No upper clamp. The old one — 3600 ms — was the whole defect: it bit long
  // before the difficulty did, so the ramp inverted. See `cadence.test.ts`.
  assert.ok(long > 3600, `a three-digit sum still fits inside the old ceiling: ${String(long)}ms`)
  assert.equal(windowFor("no digits at all"), CADENCE.fact.p90)
})

test("a four-digit sum gets time a child could actually use", () => {
  // EXPERIENCE_DESIGN.md puts the `5,001 − 2,798` class at a 16 s p50 and a 40 s
  // p90. Verification is *not* cheaper than computation here — every procedural
  // mal-rule this game prefers reproduces the true ones digit, which
  // `malRule.test.ts` proves — so the window is budgeted at the p90 for the
  // class and nothing clamps it.
  const rng = new Rng(4)
  const text = "5001 − 2798 = 2203"
  const budget = windowFor(text) + stillFor(text, rng)
  assert.ok(
    budget >= CADENCE.wide.p90,
    `only ${String(budget)}ms to work a four-column subtraction with a borrow across a zero`,
  )
})

test("a short statement comes at you faster than a long one", () => {
  // The stillness flattens where the window climbs: a lead-in long enough for
  // `753 + 577 = 1330` is dead air on `12 + 5 = 17`.
  const rng = new Rng(5)
  const quick = windowFor("12 + 5 = 17") + stillFor("12 + 5 = 17", rng)
  const slow = windowFor("4003 − 87 = 3916") + stillFor("4003 − 87 = 3916", rng)
  assert.ok(quick < slow - 800, `${String(quick)}ms vs ${String(slow)}ms`)
})

test("the beat before the statement is short, jittered, and NOT a function of the item", () => {
  // It used to be 620–1150ms and to scale UP with the digit count — dead air, more of
  // it the harder the sum, on a game whose complaint was that it was boring. It is now
  // a flat ~320ms because the slate is BLANK for all of it: the statement is cut in
  // when the window opens, so there is nothing to read during the lead-in and nothing
  // for it to be proportional to.
  const rng = new Rng(17)
  const seen = new Set<number>()
  for (const text of ["7 + 8 = 15", "4003 − 87 = 3916", "5001 − 2798 = 2203"]) {
    for (let i = 0; i < 400; i++) {
      const still = stillFor(text, rng)
      assert.ok(still >= 250 && still <= 410, `${text}: ${String(still)}ms`)
      seen.add(still)
    }
  }
  // The jitter is real: a fixed lead would let a child pre-load the flick and stop
  // reading, and pre-loading is the one way left to fake a fast call.
  assert.ok(seen.size > 40, `only ${String(seen.size)} distinct lead-ins`)
})

test("the item's own p50 rides on the statement, so the bag and the ladder agree", () => {
  const s = buildStatement(question(), true, new Rng(9))
  assert.equal(s.p50Ms, CADENCE.regroup.p50, `two-digit regrouping got a p50 of ${String(s.p50Ms)}`)
  const wide = buildStatement(
    question({ prompt: "5001 − 2798", answer: "2203", distractors: ["3313"] }),
    true,
    new Rng(9),
  )
  assert.ok(wide.p50Ms > s.p50Ms, "a harder item did not get a longer beat")
})
