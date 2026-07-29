// The defence this game used to make for its own short window, tested.
//
// `statement.ts` justified a 1750–3600 ms clamp with one sentence:
//
//   > Verification is cheaper than computation (the ones column alone rejects
//   > most mal-rules), which is why the budget can be under the cadence target
//   > at all.
//
// It is not true, and it is most spectacularly not true for the mal-rule this
// game deliberately *prefers* — `pickFalsehood` puts 55% of its weight on the
// head of the host's distractor list, and the head is the dropped carry.
//
// `47 + 25` is 72. Drop the carry and you write 62. Both end in 2.
//
// That is not a coincidence of those two operands. Every one of the three
// procedural mal-rules the curriculum emits is *correct in the ones column* and
// wrong further left — that is what makes them the mistakes a child actually
// makes rather than noise:
//
//   * dropped carry      — the ones column is `(a+b) mod 10`, which is the true
//                          ones digit by definition. Invisible, always.
//   * borrow left at ten — the bug is in the zero the borrow travelled through,
//                          which is never the ones column. Invisible, always.
//   * smaller-from-larger— invisible whenever the ones column did not itself
//                          need a borrow, which is most of the time.
//
// Measured across the dealer's own stream, a last-digit check rejects well under
// half of the falsehoods this game puts on a slate, and none at all of the most
// likely one. Verification costs what computation costs, and the window is now
// budgeted at what computation costs.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import { createStubHost } from "../stub/host.ts"
import { addNoCarry, borrowAcrossZero, drawProblem, subSmallerFromLarger } from "../stub/questions.ts"
import { Dealer } from "./dealer.ts"

const ones = (n: number): number => Math.abs(n) % 10

test("47 + 25 = 62 shares its ones digit with the true 72", () => {
  // The exact collision the file's defence was checked against, spelled out.
  assert.equal(addNoCarry(47, 25), 62)
  assert.equal(47 + 25, 72)
  assert.equal(ones(62), ones(72))
  assert.equal(
    ones(addNoCarry(47, 25)),
    ones(72),
    "the ones column cannot tell the dropped carry from the truth",
  )
})

test("the dropped carry never changes the ones digit, on any operands", () => {
  const rng = new Rng(0xca11)
  for (let i = 0; i < 4000; i++) {
    const a = rng.int(12, 9899)
    const b = rng.int(12, 9899)
    assert.equal(
      ones(addNoCarry(a, b)),
      ones(a + b),
      `${String(a)} + ${String(b)}: the ones column rejected a dropped carry`,
    )
  }
})

test("smaller-from-larger survives a ones check whenever the ones column does not borrow", () => {
  // The one procedural mal-rule a last-digit check *can* sometimes catch — and
  // only sometimes. It is invisible unless the ones column itself needed a
  // borrow, which is a little under half the time, and even then it stays
  // invisible when the two digits are five apart.
  const rng = new Rng(0xbeef)
  let noBorrow = 0
  let caught = 0
  let total = 0
  for (let i = 0; i < 4000; i++) {
    const a = rng.int(100, 9899)
    const b = rng.int(12, a - 1)
    const wrong = subSmallerFromLarger(a, b)
    if (wrong === a - b) continue
    total++
    const borrows = a % 10 < b % 10
    if (!borrows) {
      noBorrow++
      assert.equal(
        ones(wrong),
        ones(a - b),
        `${String(a)} − ${String(b)}: a non-borrowing ones column must be identical`,
      )
    }
    if (ones(wrong) !== ones(a - b)) caught++
  }
  assert.ok(noBorrow > 500, `only ${String(noBorrow)} non-borrowing cases sampled`)
  assert.ok(
    caught / total < 0.5,
    `the ones column caught ${((caught / total) * 100).toFixed(1)}% of smaller-from-larger`,
  )
})

test("a borrow left at ten never changes the ones digit either", () => {
  const rng = new Rng(0x0ff)
  let checked = 0
  for (let i = 0; i < 6000 && checked < 300; i++) {
    const a = rng.int(1002, 9899)
    const b = rng.int(12, a - 1)
    const wrong = borrowAcrossZero(a, b)
    if (wrong < 0 || wrong === a - b) continue
    checked++
    assert.equal(
      ones(wrong),
      ones(a - b),
      `${String(a)} − ${String(b)}: the ones column rejected a borrow-at-ten`,
    )
  }
  assert.ok(checked > 100, `only ${String(checked)} borrow-across-zero cases exercised`)
})

test("across the real stream, the ones column rejects a minority of falsehoods", () => {
  // The claim under test is "the ones column alone rejects MOST mal-rules". It
  // does not: the procedural ones all survive it, and only the transcription
  // slips — a reversal, a ±10 — are ever caught by it. If this ever climbs back
  // over half, the window may be revisited; until then it may not be.
  const host = createStubHost({ seed: 0xa17e })
  const dealer = new Dealer(host, new Rng(0xa17f))
  let falsehoods = 0
  let rejectedByOnes = 0
  for (let i = 0; i < 4000; i++) {
    const s = dealer.deal()
    if (s.truth) continue
    falsehoods++
    if (ones(Number(s.claimed)) !== ones(Number(s.answer))) rejectedByOnes++
  }
  assert.ok(falsehoods > 1500, `only ${String(falsehoods)} falsehoods in 4000`)
  const share = rejectedByOnes / falsehoods
  assert.ok(
    share < 0.5,
    `the ones column rejected ${(share * 100).toFixed(1)}% of falsehoods — the old defence would be back`,
  )
})

test("the mal-rule the dealer prefers is the one the ones column cannot see", () => {
  // `pickFalsehood` weights the head of the distractor list at 55%, and the head
  // is always the procedural mal-rule. So the *most likely* thing on a false
  // slate is precisely the thing a last-digit check accepts.
  const rng = new Rng(0xd00d)
  let head = 0
  let headSurvivesOnes = 0
  let addHead = 0
  let addSurvives = 0
  for (let i = 0; i < 2000; i++) {
    const drawn = drawProblem(3, rng)
    const first = drawn.distractors[0]
    if (first === undefined) continue
    head++
    const survives = ones(first) === ones(drawn.answer)
    if (survives) headSurvivesOnes++
    if (drawn.op === "add") {
      addHead++
      if (survives) addSurvives++
    }
  }
  assert.ok(head > 1900, `only ${String(head)} items carried a mal-rule at the head`)
  assert.equal(
    addSurvives,
    addHead,
    "every dropped carry must be invisible to a ones check — that is what makes it the mistake a child makes",
  )
  assert.ok(
    headSurvivesOnes / head > 0.75,
    `only ${((headSurvivesOnes / head) * 100).toFixed(1)}% of preferred mal-rules survive a ones check`,
  )
})
