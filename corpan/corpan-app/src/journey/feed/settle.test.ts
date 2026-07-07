// Settle-decision tests (W3 — no fake "correcto"): unscored cards settle
// NEUTRALLY (no stamp, no celebration); scored cards stamp + celebrate honestly.

import { test } from "node:test"
import assert from "node:assert/strict"
import { celebrationFor, settleOk, settleStamp } from "./settle.ts"

test("unscored card never shows a correct/incorrect stamp", () => {
  // The exact intro_echo path: emits correct:true, first attempt.
  assert.equal(settleStamp({ attempt: "first", fraction: 1, unscored: true }), null)
  // Even a nominal miss stays neutral when unscored.
  assert.equal(settleStamp({ attempt: "failed", fraction: 0, unscored: true }), null)
})

test("scored card stamps by correctness", () => {
  assert.equal(settleStamp({ attempt: "first", fraction: 1, unscored: false }), "correct")
  assert.equal(settleStamp({ attempt: "retry", fraction: 1, unscored: false }), "correct")
  assert.equal(settleStamp({ attempt: "first", fraction: 0.4, unscored: false }), "incorrect")
  assert.equal(settleStamp({ attempt: "failed", fraction: 0, unscored: false }), "incorrect")
})

test("settleOk: pass at >=0.6, never on a failed attempt", () => {
  assert.equal(settleOk("first", 0.6), true)
  assert.equal(settleOk("first", 0.59), false)
  assert.equal(settleOk("failed", 1), false)
})

test("unscored card never celebrates (no exposure-as-win juice)", () => {
  assert.equal(
    celebrationFor({ attempt: "first", fraction: 1, unscored: true, fast: true, hintsUsed: 0, combo: 0 }),
    null,
  )
})

test("a miss never celebrates", () => {
  assert.equal(
    celebrationFor({ attempt: "failed", fraction: 0, unscored: false, fast: true, hintsUsed: 0, combo: 0 }),
    null,
  )
})

test("clean fast first-try is tier 1; a hinted/slow pass is a quiet tier 0", () => {
  assert.deepEqual(
    celebrationFor({ attempt: "first", fraction: 1, unscored: false, fast: true, hintsUsed: 0, combo: 0 }),
    { tier: 1 },
  )
  assert.deepEqual(
    celebrationFor({ attempt: "first", fraction: 1, unscored: false, fast: false, hintsUsed: 0, combo: 0 }),
    { tier: 0 },
  )
  assert.deepEqual(
    celebrationFor({ attempt: "retry", fraction: 1, unscored: false, fast: true, hintsUsed: 1, combo: 0 }),
    { tier: 0 },
  )
})

test("every 5th perfect combo carries the combo count", () => {
  // combo before this card = 4 → comboNow = 5 → combo moment.
  assert.deepEqual(
    celebrationFor({ attempt: "first", fraction: 1, unscored: false, fast: true, hintsUsed: 0, combo: 4 }),
    { tier: 1, comboCount: 5 },
  )
})
