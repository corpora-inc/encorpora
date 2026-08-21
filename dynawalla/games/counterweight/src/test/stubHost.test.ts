// The stub host has to be the runtime, not a rehearsal for one.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  borrowAcrossZero,
  carryDropped,
  createStubHost,
  smallerFromLarger,
  wrongOperation,
} from "../stubHost.ts"
import { splitPrompt } from "../game/column.ts"

test("the reference case from the curriculum's own mal-rule file", () => {
  // 5001 − 2798. Correct 2203.
  assert.equal(smallerFromLarger(5001, 2798), 3797)
  assert.equal(borrowAcrossZero(5001, 2798), 3203)
})

test("a mal-rule that would be the correct procedure emits nothing", () => {
  // Nothing carries, so dropping the carry is just adding.
  assert.equal(carryDropped(23, 14), null)
  // No column needs regrouping, so taking the smaller from the larger is right.
  assert.equal(smallerFromLarger(58, 23), null)
  // The borrow chain never crossed a zero, so the decrement happened correctly.
  assert.equal(borrowAcrossZero(52, 27), null)
})

test("the buggy procedures produce what a child actually writes", () => {
  assert.equal(carryDropped(27, 15), 32)
  assert.equal(smallerFromLarger(52, 27), 35)
  assert.equal(borrowAcrossZero(403, 87), 416)
  assert.equal(wrongOperation("add", 40, 15), 25)
  assert.equal(wrongOperation("sub", 40, 15), 55)
})

test("the same seed is the same match, forever", () => {
  const a = createStubHost({ seed: 0x1234 })
  const b = createStubHost({ seed: 0x1234 })
  for (let i = 0; i < 200; i++) {
    assert.deepEqual(a.next(), b.next())
  }
})

test("every operand, answer and distractor is a whole number", () => {
  // The game weighs these on a beam and compares them for exact equality. A
  // float anywhere in here would be a round nobody could ever win.
  const host = createStubHost({ seed: 0x77aa })
  for (let i = 0; i < 3000; i++) {
    const q = host.next()
    const answer = Number(q.answer)
    assert.ok(Number.isInteger(answer), `answer "${q.answer}" is not a whole number`)
    assert.ok(answer > 0, `answer ${answer} is not a weight`)
    assert.equal(String(answer), q.answer, "the answer string is not canonical")
    for (const d of q.distractors) {
      const value = Number(d)
      assert.ok(Number.isInteger(value), `distractor "${d}" is not a whole number`)
      assert.notEqual(value, answer, "a distractor was the answer")
    }
  }
})

test("the prompt is the arithmetic, and the answer is its value", () => {
  const host = createStubHost({ seed: 0x2b1c })
  for (let i = 0; i < 2000; i++) {
    const q = host.next()
    const column = splitPrompt(q.prompt)
    assert.ok(column, `"${q.prompt}" would not draw as a column`)
    const top = Number(column.top)
    const bottom = Number(column.bottom)
    const value = column.glyph === "+" ? top + bottom : top - bottom
    assert.equal(value, Number(q.answer), `${q.prompt} is not ${q.answer}`)
  }
})

test("distractors are mal-rule outputs, never the answer off by a fixed step", () => {
  const host = createStubHost({ seed: 0x5c0e })
  let offByOne = 0
  let total = 0
  for (let i = 0; i < 3000; i++) {
    const q = host.next()
    const answer = Number(q.answer)
    for (const d of q.distractors) {
      total += 1
      if (Math.abs(Number(d) - answer) === 1) offByOne += 1
    }
  }
  assert.ok(total > 1000, "hardly any distractors were produced at all")
  // A broken column procedure lands a whole place away, not next door. The odd
  // coincidence is fine; a pattern is a stub that made its wrong answers up.
  assert.ok(offByOne / total < 0.02, `${offByOne} of ${total} distractors were the answer ± 1`)
})

test("the ladder walks from two digits to four", () => {
  const host = createStubHost({ seed: 0x3311 })
  const first: number[] = []
  const last: number[] = []
  for (let i = 0; i < 60; i++) {
    const q = host.next()
    ;(i < 8 ? first : i >= 48 ? last : []).push(Number(q.answer))
  }
  assert.ok(Math.max(...first) < 1000, "the ladder started above two digits")
  assert.ok(Math.max(...last) > 999, "the ladder never reached four digits")
})

test("a pinned level stays pinned", () => {
  const host = createStubHost({ seed: 0x4001, level: 0 })
  for (let i = 0; i < 100; i++) {
    assert.equal(host.next().difficulty, 0)
  }
})

test("a haptic on a device with no motor is not an error anybody hears about", () => {
  const seen: string[] = []
  const host = createStubHost({ seed: 1, onHaptic: (k) => seen.push(k) })
  host.haptic("light")
  host.haptic("failure")
  assert.deepEqual(seen, ["light", "failure"])
})
