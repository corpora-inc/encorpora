// The parental gate, and the one property that makes it a gate *here*.
//
// Apple's canonical gate is a multiplication problem. This is a mathematics
// app for grades 1–6, so the audience is being trained daily to defeat exactly
// that challenge — a grade-4 child beats their parent to `6 × 7` and the gate
// has taught them that solving sums opens the money screen. `no arithmetic` is
// therefore a test, not a comment.

import test from "node:test"
import assert from "node:assert/strict"

import { GATE_WORDS, makeChallenge, passes } from "./parentalGate.ts"

/** A generator that walks a fixed sequence, so a test is a test not a coin toss. */
function sequence(values: readonly number[]): () => number {
  let index = 0
  return () => values[index++ % values.length] ?? 0
}

test("the challenge is never arithmetic", () => {
  // Every challenge this thing can produce, checked for anything a child could
  // solve by doing sums: an operator, an equals sign, a pair of operands.
  for (let i = 0; i < 200; i++) {
    const challenge = makeChallenge()
    const shown = challenge.kind === "word" ? challenge.word : challenge.answer
    assert.ok(!/[+\-×÷*/=]/.test(shown), `the gate showed an operator: ${shown}`)
  }
})

test("the year challenge asks for the current year", () => {
  const now = new Date(2026, 6, 26).getTime()
  const challenge = makeChallenge(sequence([0.1]), now)
  assert.equal(challenge.kind, "year")
  assert.equal(challenge.answer, "2026")
})

test("the word challenge shows the word it wants", () => {
  const challenge = makeChallenge(sequence([0.9, 0]))
  assert.equal(challenge.kind, "word")
  if (challenge.kind !== "word") return
  assert.equal(challenge.answer, challenge.word)
})

test("every gate word is long, uppercase and not curricular", () => {
  for (const word of GATE_WORDS) {
    // Reading and typing load is the whole barrier, and short words do not
    // carry it: TELEVISION was in the first draft of this list and a
    // nine-year-old types it without hesitating. Thirteen letters is the floor.
    assert.ok(word.length >= 13, `${word} is too short to be a barrier`)
    assert.equal(word, word.toUpperCase(), `${word} is not uppercase`)
    assert.ok(/^[A-Z]+$/.test(word), `${word} is not plain letters`)
    // Nothing a maths app has been teaching: no number names, no shapes.
    assert.ok(
      !/^(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|HUNDRED|THOUSAND|TRIANGLE|RECTANGLE|MULTIPLY|SUBTRACT|FRACTION)$/.test(
        word,
      ),
      `${word} is curriculum`,
    )
  }
  assert.equal(new Set(GATE_WORDS).size, GATE_WORDS.length, "a word is repeated")
})

test("an adult who types it in lower case is let through", () => {
  // They have demonstrated everything the gate exists to demonstrate.
  // Rejecting them teaches nobody anything and sends them to the app store.
  const challenge = makeChallenge(sequence([0.9, 0]))
  if (challenge.kind !== "word") return
  assert.equal(passes(challenge, challenge.word.toLowerCase()), true)
  assert.equal(passes(challenge, `  ${challenge.word}  `), true)
})

test("a near miss does not pass", () => {
  const challenge = makeChallenge(sequence([0.1]), new Date(2026, 0, 1).getTime())
  assert.equal(passes(challenge, "2025"), false)
  assert.equal(passes(challenge, ""), false)
  assert.equal(passes(challenge, "20 26"), false)
})

test("both forms are reachable", () => {
  // A single fixed form is a single thing to memorise.
  const kinds = new Set<string>()
  for (let i = 0; i < 400; i++) kinds.add(makeChallenge().kind)
  assert.deepEqual([...kinds].sort(), ["word", "year"])
})

test("nothing about a challenge is persisted", () => {
  // Two calls, two challenges. There is no module state to leak a passed gate
  // into the next sheet, and a tablet left unlocked does not stay unlocked.
  const first = makeChallenge(sequence([0.9, 0.1]))
  const second = makeChallenge(sequence([0.9, 0.6]))
  assert.notDeepEqual(first, second)
})
