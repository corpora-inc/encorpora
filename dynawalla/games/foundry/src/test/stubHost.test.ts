// The stub host has to be as honest as the runtime it stands in for, because
// every hour of development happens against it. If it deals a float, or a
// distractor no child would ever produce, the game is being tuned against a
// fiction.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  borrowAcrossZero,
  carryDropped,
  createStubHost,
  smallerFromLarger,
  wrongOperation,
} from "../stubHost.ts"

// The reference case is the one `packs/shared/curriculum/src/malrules/columnOp.ts`
// puts in its own docblock, because the program has confused these two rules
// once already.
test("5001 − 2798 separates the two subtraction rules exactly as the curriculum does", () => {
  assert.equal(5001 - 2798, 2203)
  assert.equal(smallerFromLarger(5001, 2798), 3797) // |5−2| |0−7| |0−9| |1−8|
  assert.equal(borrowAcrossZero(5001, 2798), 3203) // the thousand never given up
})

test("carryDropped adds every column and writes no carry", () => {
  assert.equal(carryDropped(27, 15), 32) // 7+5→2, 2+1→3
  assert.equal(carryDropped(456, 789), 135)
  // Nothing carries, so the rule is the correct procedure and does not apply.
  assert.equal(carryDropped(11, 11), null)
})

test("smallerFromLarger takes the smaller digit from the larger, every column", () => {
  assert.equal(smallerFromLarger(52, 27), 35)
  assert.equal(smallerFromLarger(403, 87), 484) // |3−7|, |0−8|, |4−0|
  // No column needs regrouping, so the bug and the correct procedure coincide.
  assert.equal(smallerFromLarger(58, 27), null)
})

test("borrowAcrossZero turns the zeros into nines and never pays for them", () => {
  // 403 − 87 is 316. The bug writes 416: the four is never decremented.
  assert.equal(borrowAcrossZero(403, 87), 416)
  // 1002 − 5 is 997; the bug writes 1997.
  assert.equal(borrowAcrossZero(1002, 5), 1997)
  // With a non-zero digit to borrow from, this procedure decrements correctly —
  // it *is* the correct procedure, so it does not apply. 61 − 28 = 33 is not a
  // distractor anybody should be shown.
  assert.equal(borrowAcrossZero(61, 28), null)
  assert.equal(borrowAcrossZero(58, 27), null)
})

test("wrongOperation is named for what it is and is not dressed as a mal-rule", () => {
  assert.equal(wrongOperation("add", 27, 15), 12)
  assert.equal(wrongOperation("sub", 52, 27), 79)
})

test("every served question is exact integer arithmetic, end to end", () => {
  const host = createStubHost({ seed: 0xc0ffee })
  for (let i = 0; i < 400; i++) {
    const q = host.next()
    const answer = Number(q.answer)
    assert.ok(Number.isInteger(answer), `non-integer answer "${q.answer}"`)
    assert.ok(answer >= 1, `non-positive answer "${q.answer}" from "${q.prompt}"`)
    assert.equal(String(answer), q.answer, "an answer must be its own canonical string")

    const match = /^(\d+) ([+−]) (\d+)$/.exec(q.prompt)
    assert.ok(match, `unparseable prompt "${q.prompt}"`)
    const a = Number(match[1])
    const b = Number(match[3])
    assert.equal(match[2] === "+" ? a + b : a - b, answer, `prompt "${q.prompt}" ≠ ${q.answer}`)

    for (const d of q.distractors) {
      const v = Number(d)
      assert.ok(Number.isInteger(v), `non-integer distractor "${d}"`)
      assert.notEqual(v, answer, "a distractor must not be the answer")
      assert.equal(String(v), d)
    }
    assert.equal(new Set(q.distractors).size, q.distractors.length, "duplicate distractor")
    assert.ok(q.difficulty >= 0 && q.difficulty <= 1, "difficulty must be normalised")
  }
})

test("distractors are mal-rule outputs, not near-misses", () => {
  const host = createStubHost({ seed: 0x1234 })
  let offByOne = 0
  let explained = 0
  let total = 0
  for (let i = 0; i < 300; i++) {
    const q = host.next()
    const match = /^(\d+) ([+−]) (\d+)$/.exec(q.prompt)
    assert.ok(match)
    const a = Number(match[1])
    const b = Number(match[3])
    const answer = Number(q.answer)
    const rules = (
      match[2] === "+"
        ? [carryDropped(a, b), wrongOperation("add", a, b)]
        : [smallerFromLarger(a, b), borrowAcrossZero(a, b), wrongOperation("sub", a, b)]
    ).filter((v) => v !== null)
    for (const d of q.distractors) {
      total++
      const v = Number(d)
      if (Math.abs(v - answer) === 1) offByOne++
      if (rules.includes(v)) explained++
    }
  }
  assert.ok(total > 0)
  assert.equal(explained, total, "every distractor must be the output of a named mal-rule")
  // An off-by-one can *happen* — some mal-rules land next door — but it must be
  // a consequence, never the recipe.
  assert.ok(offByOne / total < 0.1, `${offByOne}/${total} distractors were off-by-one`)
})

test("no distractor is a fixed offset from the answer", () => {
  // The failure this guards against is a stub that computes a shortcut off the
  // correct answer instead of running a buggy procedure. A rule that did would
  // show the *same* gap on every item it fired on.
  const host = createStubHost({ seed: 0x5150 })
  const gaps = new Map<number, number>()
  let total = 0
  for (let i = 0; i < 400; i++) {
    const q = host.next()
    const answer = Number(q.answer)
    for (const d of q.distractors) {
      total++
      const gap = Number(d) - answer
      gaps.set(gap, (gaps.get(gap) ?? 0) + 1)
    }
  }
  let worst = 0
  for (const n of gaps.values()) worst = Math.max(worst, n)
  assert.ok(
    worst / total < 0.25,
    `one gap accounted for ${worst}/${total} distractors — that is a shortcut, not a procedure`,
  )
})

test("the same seed is the same card, forever", () => {
  const a = createStubHost({ seed: 42 })
  const b = createStubHost({ seed: 42 })
  const c = createStubHost({ seed: 43 })
  const from = (h: ReturnType<typeof createStubHost>) =>
    Array.from({ length: 60 }, () => {
      const q = h.next()
      return `${q.prompt}=${q.answer}|${q.distractors.join(",")}`
    })
  assert.deepEqual(from(a), from(b))
  assert.notDeepEqual(from(createStubHost({ seed: 42 })), from(c))
})

test("the ladder walks from two-digit sums to four-digit borrows", () => {
  const host = createStubHost({ seed: 7 })
  const first = host.next()
  assert.equal(first.difficulty, 0)
  let last = first
  for (let i = 0; i < 200; i++) last = host.next()
  assert.ok(last.difficulty > 0.5, "the ladder never climbed")
  assert.ok(last.difficulty <= 1)
})

test("a pinned level serves that rung and only that rung", () => {
  for (const level of [0, 3, 7]) {
    const host = createStubHost({ seed: 5, level })
    for (let i = 0; i < 40; i++) assert.equal(host.next().difficulty, level / 8)
  }
})

test("the no-regroup rungs really do not regroup", () => {
  const host = createStubHost({ seed: 0xbeef, level: 0 })
  for (let i = 0; i < 200; i++) {
    const q = host.next()
    const match = /^(\d+) ([+−]) (\d+)$/.exec(q.prompt) as RegExpExecArray
    const a = Number(match[1])
    const b = Number(match[3])
    if (match[2] === "+") {
      // No column may sum past nine.
      for (let p = 1; p <= 1000; p *= 10) {
        assert.ok((Math.floor(a / p) % 10) + (Math.floor(b / p) % 10) <= 9, q.prompt)
      }
    } else {
      // No column may need to borrow.
      for (let p = 1; p <= 1000; p *= 10) {
        assert.ok(Math.floor(a / p) % 10 >= Math.floor(b / p) % 10, q.prompt)
      }
    }
  }
})

test("prefersReducedMotion is honoured when it is stated", () => {
  assert.equal(createStubHost({ reducedMotion: true }).prefersReducedMotion(), true)
  assert.equal(createStubHost({ reducedMotion: false }).prefersReducedMotion(), false)
})

test("report and haptic observers are called and never throw without a device", () => {
  const seen: string[] = []
  const host = createStubHost({ onReport: (r) => seen.push(r.answered), onHaptic: (k) => seen.push(k) })
  host.report({ questionId: "x", correct: true, ms: 10, answered: "24" })
  host.haptic("success")
  assert.deepEqual(seen, ["24", "success"])
})
