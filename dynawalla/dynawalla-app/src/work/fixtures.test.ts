// The arithmetic behind the fixture, checked by hand and then asserted.
//
//   5001 − 2798 = 2203        check: 2798 + 2203 = 5001 ✓
//
//   3203  is `mis.add.borrow-across-zero`.
//         The child regroups down through both zeros, writing them as 9s, and
//         never takes the thousand off the 5:
//           units      11 − 8 = 3
//           tens        9 − 9 = 0
//           hundreds    9 − 7 = 2
//           thousands   5 − 2 = 3   ← the 5 was never decremented
//         → 3203, which is 2203 + 1000. Exactly one place-value unit too big,
//           which is what makes the counting board a contradiction: putting it
//           back gives 3203 + 2798 = 6001, not 5001.
//
//   3797  is `mis.add.smaller-from-larger`.
//         Column by column, smaller from larger regardless of which is on top:
//           |5−2| |0−7| |0−9| |1−8|  =  3, 7, 9, 7  →  3797
//         It is not off by a place-value unit at all — 3797 − 2203 = 1594 — so
//         the counting board is *not* its contradiction and it must never be
//         served that card. This is the mapping the program has already got
//         wrong once, in three documents, before a reviewer caught it.

import { test } from "node:test"
import assert from "node:assert/strict"

import { exact, SLOT_BOTTOM, SLOT_TOP } from "./curriculum.ts"
import { CACHED_SEED, fiveThousandOne, operand, scaledAnswer } from "./fixtures.ts"

test("the fixture is the problem P-03 names, generated and not hand-built", () => {
  const { seed, exercise } = fiveThousandOne()
  assert.equal(
    seed,
    CACHED_SEED,
    `the cached seed no longer produces 5001 − 2798 — update CACHED_SEED to ${String(seed)}`,
  )
  assert.equal(operand(exercise, SLOT_TOP), 5001n)
  assert.equal(operand(exercise, SLOT_BOTTOM), 2798n)
})

test("the correct answer is 2203, and it is the generator's, not this file's", () => {
  const { exercise } = fiveThousandOne()
  assert.equal(scaledAnswer(exercise.answer.canonical), 2203n)
  // Checked by hand above; asserted here as arithmetic.
  assert.equal(5001n - 2798n, 2203n)
  assert.equal(2798n + 2203n, 5001n)
})

test("3203 is a thousand too big; 3797 is not off by a place-value unit at all", () => {
  assert.equal(3203n - 2203n, 1000n)
  assert.equal(3203n + 2798n, 6001n)
  assert.equal(3797n - 2203n, 1594n)
  assert.notEqual(3797n - 2203n, 1000n)
})

test("both wrong answers are the generator's own distractors, on this item", () => {
  // If the mal-rules did not produce these numbers on this item, every
  // downstream assertion about diagnosis would be testing this file's opinion
  // rather than the curriculum's behaviour.
  const { exercise } = fiveThousandOne()
  const byRule = new Map<string, bigint | null>()
  for (const distractor of exercise.distractors) {
    if (distractor.misconception === undefined) continue
    byRule.set(String(distractor.misconception), scaledAnswer(distractor.value))
  }
  assert.equal(byRule.get("mis.add.borrow-across-zero"), 3203n)
  assert.equal(byRule.get("mis.add.smaller-from-larger"), 3797n)
})

test("the exact layer never sees a float", () => {
  // The whole no-float rule reduces to this: a value that came from arithmetic
  // is a Rational of BigInts, and comparison is structural.
  const { exercise } = fiveThousandOne()
  const canonical = exercise.answer.canonical
  assert.ok(canonical.kind === "integer")
  assert.equal(typeof canonical.value.n, "bigint")
  assert.equal(typeof canonical.value.d, "bigint")
  assert.ok(exact.eq(canonical.value, exact.rational(2203n)))
})
