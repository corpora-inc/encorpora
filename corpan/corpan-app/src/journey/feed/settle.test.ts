// Settle-decision tests (W3 — no fake "correcto"): unscored cards settle
// NEUTRALLY (no stamp, no celebration); scored cards stamp + celebrate honestly.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  celebrationFor,
  isSingleShotSettle,
  settleOk,
  settleStamp,
  singleShotAttempt,
} from "./settle.ts"

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

test("EVERY pass celebrates (tier 1) and carries the combo — juice on every correct", () => {
  // clean fast first-try: celebrates + flagged perfect for bonus flair.
  assert.deepEqual(
    celebrationFor({ attempt: "first", fraction: 1, unscored: false, fast: true, hintsUsed: 0, combo: 0 }),
    { tier: 1, comboCount: 1, perfect: true },
  )
  // a SLOW pass still celebrates (was a silent tier 0 — the "word-order felt
  // dead" bug); just not flagged perfect.
  assert.deepEqual(
    celebrationFor({ attempt: "first", fraction: 1, unscored: false, fast: false, hintsUsed: 0, combo: 0 }),
    { tier: 1, comboCount: 1, perfect: false },
  )
  // a hinted retry pass still celebrates.
  assert.deepEqual(
    celebrationFor({ attempt: "retry", fraction: 1, unscored: false, fast: true, hintsUsed: 1, combo: 2 }),
    { tier: 1, comboCount: 3, perfect: false },
  )
})

test("speak_echo is single-shot (owns its own in-card retry); tap/type cards are not", () => {
  assert.equal(isSingleShotSettle("speak_echo"), true)
  // Tap/type cards keep the miss-scaffold retry.
  assert.equal(isSingleShotSettle("choice_pick"), false)
  assert.equal(isSingleShotSettle("listen_type"), false)
  assert.equal(isSingleShotSettle("cloze"), false)
})

test("single-shot settle grades in ONE call — a low score never traps (settles failed, not a scaffold miss)", () => {
  // A pass settles as a clean first-try.
  assert.equal(singleShotAttempt(1), "first")
  assert.equal(singleShotAttempt(0.6), "first")
  // A low score settles straight to failed — NOT a first miss that would demand
  // a second Continue press (the old speak brick). One press always moves on.
  assert.equal(singleShotAttempt(0.59), "failed")
  assert.equal(singleShotAttempt(0), "failed")
  // Either outcome is a terminal settle attempt, so onOutcome resolves the card
  // in a single call — the Continue press advances immediately.
  assert.notEqual(singleShotAttempt(0.4), "retry")
})

test("combo count is always carried so the effect layer can escalate", () => {
  // combo before this card = 4 → comboNow = 5. The effect layer reads comboCount
  // to grow the celebration (a combo-5 answer is juicier than a combo-1).
  assert.deepEqual(
    celebrationFor({ attempt: "first", fraction: 1, unscored: false, fast: true, hintsUsed: 0, combo: 4 }),
    { tier: 1, comboCount: 5, perfect: true },
  )
})
