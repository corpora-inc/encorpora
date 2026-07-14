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
  getActiveUtteranceId,
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

test("getActiveUtteranceId reflects the current active utterance, or undefined", () => {
  _resetAudioManagerForTests()
  assert.equal(getActiveUtteranceId(), undefined, "nothing active yet")
  const handle = beginUtterance("hola", 1)
  assert.equal(getActiveUtteranceId(), handle.id)
  endUtterance(handle.id)
  assert.equal(getActiveUtteranceId(), undefined, "cleared after end")
})

// Regression test for the stopSpeech() race: a user-advance fires
// `void stopSpeech()`, which captures the currently-active utterance id
// BEFORE awaiting the async native stop call. While that await is in
// flight, the next card's autoplay can call beginUtterance() for a NEW
// utterance. Once the native stop resolves, stopSpeech()'s `finally` must
// end only the id it captured at entry — the new utterance must survive.
test("id-scoped end survives a new utterance registered mid-stop (stopSpeech interleaving)", async () => {
  _resetAudioManagerForTests()

  // Card N's TTS is playing.
  const cardN = beginUtterance("adios amigo, hasta luego", 1)
  assert.equal(isUtteranceActive(), true)

  // stopSpeech() begins: capture the id it intends to stop, exactly like
  // `const idToEnd = getActiveUtteranceId()` in speak.ts.
  const idToEnd = getActiveUtteranceId()
  assert.equal(idToEnd, cardN.id)

  // ...await the native stop call is in flight here (simulated by a
  // microtask/await boundary)...
  await Promise.resolve()

  // The user has already advanced to card N+1 by the time the await
  // above yields, and its autoplay begins a NEW utterance before
  // stopSpeech()'s `finally` runs.
  const cardNPlus1 = beginUtterance("buenos dias otra vez", 1)
  assert.equal(getActiveUtteranceId(), cardNPlus1.id)

  // stopSpeech()'s finally: end only the id captured at entry.
  if (idToEnd !== undefined) {
    endUtterance(idToEnd)
  }

  assert.equal(
    getActiveUtteranceId(),
    cardNPlus1.id,
    "the newly-registered utterance must survive the stale stop",
  )
  assert.equal(isUtteranceActive(), true, "card N+1's utterance is still tracked as active")
})

// Companion case: stopSpeech() is called when NOTHING is active (idToEnd
// undefined at entry) — e.g. a stray advance with no audio playing. It
// must not clobber an utterance that begins during the await, which is
// exactly what an unscoped `endUtterance()` (no id) would do.
test("stopSpeech with nothing active at entry does not clobber a utterance that starts mid-await", async () => {
  _resetAudioManagerForTests()

  const idToEnd = getActiveUtteranceId()
  assert.equal(idToEnd, undefined, "nothing active when stopSpeech was called")

  await Promise.resolve() // native stop in flight

  const started = beginUtterance("hola de nuevo", 1)

  if (idToEnd !== undefined) {
    endUtterance(idToEnd)
  }

  assert.equal(getActiveUtteranceId(), started.id, "utterance started mid-stop must survive")
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
