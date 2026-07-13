// Tests for the active-utterance tracker (audio lifecycle: APP-initiated
// advance waits for the reward utterance; USER-initiated advance never does).
// Run with the repo's native runner: `npm test` →
//   node --experimental-strip-types --test src/**/*.test.ts
//
// `audioManager.ts` has no path-aliased imports, so the bare strip-types
// loader resolves it directly.

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  beginUtterance,
  endUtterance,
  estimateSpeechDurationMs,
  isUtteranceActive,
  waitForActiveUtterance,
  _resetAudioManagerForTests,
} from "./audioManager.ts"

test("estimateSpeechDurationMs scales with word count and rate", () => {
  const one = estimateSpeechDurationMs("hola")
  const many = estimateSpeechDurationMs("hola buenos dias como estas hoy")
  assert.ok(many > one, "more words → longer estimate")

  const slow = estimateSpeechDurationMs("hola buenos dias", 0.5)
  const fast = estimateSpeechDurationMs("hola buenos dias", 1.5)
  assert.ok(slow > fast, "a slower rate → longer estimate")
})

test("estimateSpeechDurationMs is clamped to a sane floor/ceiling", () => {
  assert.ok(estimateSpeechDurationMs("") >= 350, "empty text still floors at MIN_DURATION_MS")
  const huge = estimateSpeechDurationMs(new Array(500).fill("word").join(" "))
  assert.ok(huge <= 6000, "very long text is capped at MAX_DURATION_MS")
})

test("waitForActiveUtterance resolves instantly when nothing is playing", async () => {
  _resetAudioManagerForTests()
  const start = Date.now()
  await waitForActiveUtterance()
  assert.ok(Date.now() - start < 50, "no active utterance ⇒ no wait")
})

test("isUtteranceActive reflects the estimated window", () => {
  _resetAudioManagerForTests()
  assert.equal(isUtteranceActive(), false)
  beginUtterance("hola", 1)
  assert.equal(isUtteranceActive(), true)
})

test("endUtterance clears tracking so a later wait is instant", async () => {
  _resetAudioManagerForTests()
  beginUtterance("hola buenos dias como estas hoy amigo", 1) // long enough to still be "active"
  assert.equal(isUtteranceActive(), true)
  endUtterance()
  assert.equal(isUtteranceActive(), false)
  const start = Date.now()
  await waitForActiveUtterance()
  assert.ok(Date.now() - start < 50, "cleared utterance ⇒ no wait")
})

test("endUtterance(id) only clears the matching generation (stale calls are ignored)", () => {
  _resetAudioManagerForTests()
  const first = beginUtterance("hola", 1)
  const second = beginUtterance("adios", 1)
  endUtterance(first.id) // stale — a newer utterance is now active
  assert.equal(isUtteranceActive(), true, "the second utterance is still tracked")
  endUtterance(second.id)
  assert.equal(isUtteranceActive(), false)
})

test("waitForActiveUtterance caps its wait at capMs regardless of estimate", async () => {
  _resetAudioManagerForTests()
  // A long utterance whose full estimated duration would exceed the cap.
  beginUtterance(new Array(60).fill("palabra").join(" "), 1)
  const start = Date.now()
  await waitForActiveUtterance(80)
  const elapsed = Date.now() - start
  assert.ok(elapsed >= 70 && elapsed < 400, `capped wait should be ~80ms, was ${elapsed}ms`)
})
