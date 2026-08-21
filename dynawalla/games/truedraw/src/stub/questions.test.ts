import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import {
  addNoCarry,
  borrowAcrossZero,
  drawProblem,
  reverseDigits,
  subSmallerFromLarger,
} from "./questions.ts"

test("each mal-rule reproduces the procedure it is named for", () => {
  // Every carry dropped.
  assert.equal(addNoCarry(47, 25), 62)
  assert.equal(addNoCarry(9, 9), 8)
  // The smaller digit taken from the larger, column by column.
  assert.equal(subSmallerFromLarger(52, 27), 35)
  // The borrow travels through the zero and the zero is read as ten.
  assert.equal(borrowAcrossZero(503, 87), 426)
  assert.equal(503 - 87, 416)
  // A transcription slip, not a procedure.
  assert.equal(reverseDigits(63), 36)
})

test("borrowAcrossZero refuses rather than inventing a non-digit", () => {
  // No column to borrow from at all.
  assert.equal(borrowAcrossZero(12, 99), -1)
})

test("the stream is exact integers only, at every level", () => {
  for (let level = 0; level <= 7; level++) {
    const rng = new Rng(1000 + level)
    for (let i = 0; i < 400; i++) {
      const drawn = drawProblem(level, rng)
      for (const value of [drawn.a, drawn.b, drawn.answer, ...drawn.distractors]) {
        assert.ok(Number.isInteger(value), `${String(value)} is not an integer`)
      }
      assert.ok(drawn.answer > 0, "an answer is a positive whole number")
      const expected = drawn.op === "add" ? drawn.a + drawn.b : drawn.a - drawn.b
      assert.equal(drawn.answer, expected)
    }
  }
})

test("a distractor is never the answer, and never a duplicate", () => {
  const rng = new Rng(4242)
  for (let i = 0; i < 3000; i++) {
    const drawn = drawProblem(i % 8, rng)
    const seen = new Set<number>()
    for (const value of drawn.distractors) {
      assert.notEqual(value, drawn.answer)
      assert.ok(!seen.has(value), "duplicate distractor")
      seen.add(value)
    }
  }
})

test("every problem carries at least one wrong value to lie with", () => {
  const rng = new Rng(99)
  for (let i = 0; i < 2000; i++) {
    const drawn = drawProblem(i % 8, rng)
    assert.ok(drawn.distractors.length >= 1, `${String(drawn.a)} ${drawn.op} ${String(drawn.b)}`)
  }
})

test("the same seed is the same stream, forever", () => {
  const a = new Rng(0xbeef)
  const b = new Rng(0xbeef)
  for (let i = 0; i < 200; i++) {
    assert.deepEqual(drawProblem(3, a), drawProblem(3, b))
  }
})
