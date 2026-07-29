// `reissue` — the challenge an adult gets after a miss.
//
// Its own file because `parentalGate.test.ts` holds the *gate* (the property
// that it is never arithmetic, and that a child cannot type their way through
// it), and this holds a property of the SHEET that happens to live in the
// model: the sheet must not change shape underneath somebody who has just been
// told they got it wrong.
//
// The two forms are different heights — a word challenge renders a line of
// display type above the field, a year challenge does not. Regenerating with
// `makeChallenge()` swapped the form half the time, which moved the field and
// the "Continue" button up the screen at the exact moment a finger was on its
// way to them.

import test from "node:test"
import assert from "node:assert/strict"

import { GATE_WORDS, makeChallenge, passes, reissue, type Challenge } from "./parentalGate.ts"

/** A generator that walks a fixed sequence, so a test is a test not a coin toss. */
function sequence(values: readonly number[]): () => number {
  let index = 0
  return () => values[index++ % values.length] ?? 0
}

const NEW_YEAR = new Date(2026, 0, 1).getTime()

test("a reissued challenge keeps the form of the one it replaces", () => {
  // The whole point. Five hundred misses, both forms, and the layout never
  // changes height.
  for (let i = 0; i < 500; i++) {
    const first = makeChallenge()
    assert.equal(reissue(first).kind, first.kind, `a ${first.kind} challenge became something else`)
  }
})

test("a missed word is never re-asked as itself", () => {
  // Otherwise Continue-twice is the gate. Every word in the list, checked
  // against every draw the generator can make from the remaining seventeen.
  for (const word of GATE_WORDS) {
    const missed: Challenge = { kind: "word", word, answer: word }
    for (let draw = 0; draw < GATE_WORDS.length; draw++) {
      const next = reissue(missed, sequence([draw / GATE_WORDS.length]))
      assert.equal(next.kind, "word")
      if (next.kind !== "word") return
      assert.notEqual(next.word, word, `${word} was re-issued as itself`)
      assert.ok(GATE_WORDS.includes(next.word), `${next.word} is not a gate word`)
    }
  }
})

test("a reissued word is still one you have to read and type", () => {
  // The barrier is transcription load, and a reissue that quietly handed back
  // something short would be a gate that got easier the more you missed it.
  const missed: Challenge = { kind: "word", word: "ACCOMMODATION", answer: "ACCOMMODATION" }
  // A seeded generator, not `Math.random`. This file's own header promises "a
  // test is a test, not a coin toss", and this was the one call in it that
  // took the real one — so the assertions below ran against whatever forty
  // draws happened to come up.
  for (let draw = 0; draw < GATE_WORDS.length; draw++) {
    const next = reissue(missed, sequence([draw / GATE_WORDS.length]))
    if (next.kind !== "word") continue
    assert.ok(next.word.length >= 13, `${next.word} is too short to be a barrier`)
    assert.equal(next.answer, next.word)
    // Case-insensitively, which is what `passes` does — it upper-cases BOTH
    // sides. The line that used to be here asserted that lower case PASSES
    // while its own message said it was rejected, and because `passes` folds
    // the case it could not have failed either way. It tested nothing and
    // documented the opposite of the behaviour.
    assert.ok(passes(next, next.word.toLowerCase()), "a reissued word accepts lower case")
    assert.equal(passes(next, `${next.word}X`), false, "a near miss is still a miss")
  }
})

test("a reissued year is the year at the moment it is reissued", () => {
  // A sheet left open across midnight on New Year's Eve, which is the one time
  // a cached answer would lock a parent out of their own purchase.
  const missed: Challenge = { kind: "year", answer: "2025" }
  assert.equal(reissue(missed, Math.random, NEW_YEAR).answer, "2026")
  assert.equal(passes(reissue(missed, Math.random, NEW_YEAR), "2026"), true)
  assert.equal(passes(reissue(missed, Math.random, NEW_YEAR), "2025"), false)
})

test("reissue holds no state between calls", () => {
  // Same input, same generator, same answer — and nothing accumulating in the
  // module that would survive the sheet closing.
  const missed: Challenge = { kind: "word", word: "THERMODYNAMICS", answer: "THERMODYNAMICS" }
  const once = reissue(missed, sequence([0.3]))
  const twice = reissue(missed, sequence([0.3]))
  assert.deepEqual(once, twice)
})
