import assert from "node:assert/strict"
import test from "node:test"

import { roundFrom } from "./game/round.ts"
import {
  addNoCarry,
  borrowSkippingZero,
  createStubHost,
  subSmallerFromLarger,
} from "./stubHost.ts"

const SEED = 0x0c011960

test("the stream is seeded: the same seed is the same run, forever", () => {
  const a = createStubHost({ seed: SEED })
  const b = createStubHost({ seed: SEED })
  const c = createStubHost({ seed: SEED + 1 })
  const first: string[] = []
  const second: string[] = []
  const third: string[] = []
  for (let i = 0; i < 60; i++) {
    first.push(a.next().prompt)
    second.push(b.next().prompt)
    third.push(c.next().prompt)
  }
  assert.deepEqual(first, second)
  assert.notDeepEqual(first, third)
})

test("every operand, answer and distractor is an exact whole number", () => {
  const host = createStubHost({ seed: SEED })
  for (let i = 0; i < 600; i++) {
    const q = host.next()
    assert.match(q.answer, /^\d+$/, q.prompt)
    assert.ok(Number.isSafeInteger(Number(q.answer)))
    for (const d of q.distractors) {
      assert.match(d, /^\d+$/, `${q.prompt} → ${d}`)
      assert.notEqual(d, q.answer, "a distractor is never the answer")
    }
    assert.equal(new Set(q.distractors).size, q.distractors.length, "no duplicates")
  }
})

test("the prompt is what the host actually emits, and the answer agrees with it", () => {
  const host = createStubHost({ seed: SEED ^ 0x1 })
  for (let i = 0; i < 600; i++) {
    const q = host.next()
    const m = /^(\d+) ([+−]) (\d+)$/.exec(q.prompt)
    assert.notEqual(m, null, q.prompt)
    if (!m) continue
    const a = Number(m[1])
    const b = Number(m[3])
    assert.equal(Number(q.answer), m[2] === "+" ? a + b : a - b)
    assert.ok(a > 0 && b > 0)
    if (m[2] === "−") assert.ok(b < a, "the stub never serves a negative answer")
  }
})

test("every question the stub serves is one this game can cut", () => {
  const host = createStubHost({ seed: SEED ^ 0x2 })
  for (let i = 0; i < 600; i++) {
    const q = host.next()
    const round = roundFrom(q)
    assert.notEqual(round, null, q.prompt)
    if (!round) continue
    assert.ok(round.coil >= round.demand, q.prompt)
    assert.ok(round.demand >= 1)
    assert.equal(
      round.mode === "take" ? round.coil - round.demand : round.ingot + round.demand,
      round.answer,
      q.prompt,
    )
  }
})

test("the stub walks its own ladder and a pinned rung stays put", () => {
  const walking = createStubHost({ seed: SEED })
  const early: number[] = []
  const late: number[] = []
  for (let i = 0; i < 30; i++) {
    const q = walking.next()
    ;(i < 5 ? early : late).push(Number(q.answer))
  }
  assert.ok(Math.max(...late) > Math.max(...early), "the coils get bigger")

  const pinned = createStubHost({ seed: SEED, rung: 0 })
  for (let i = 0; i < 40; i++) {
    assert.ok(Number(pinned.next().answer) <= 99, "rung 0 stays small")
  }
})

test("mal-rules are procedures a child runs, not noise around the answer", () => {
  // 27 + 15 with every carry dropped.
  assert.equal(addNoCarry(27, 15), 32)
  assert.equal(addNoCarry(4, 5), 9)
  // 52 − 27, taking the smaller digit from the larger in every column.
  assert.equal(subSmallerFromLarger(52, 27), 35)
  assert.equal(subSmallerFromLarger(97, 43), 54)
  // 403 − 87, writing a ten into the column the borrow passed through where a
  // nine belongs. Every one of these is exactly ten more than the answer, which
  // is what makes it a diagnosis rather than a near-miss.
  assert.equal(borrowSkippingZero(403, 87), 326)
  assert.equal(borrowSkippingZero(4_003, 87), 3_926)
  assert.equal(borrowSkippingZero(400_300, 87), 400_223)
  // Nothing to borrow across is nothing for the bug to do.
  assert.equal(borrowSkippingZero(97, 43), -1)
  assert.equal(borrowSkippingZero(52, 27), -1)
})

test("a distractor is a wrong answer, never the right one dressed up", () => {
  const host = createStubHost({ seed: SEED ^ 0x3 })
  let malRules = 0
  for (let i = 0; i < 400; i++) {
    const q = host.next()
    const m = /^(\d+) ([+−]) (\d+)$/.exec(q.prompt)
    if (!m) continue
    const a = Number(m[1])
    const b = Number(m[3])
    const known =
      m[2] === "+"
        ? [addNoCarry(a, b), a - b]
        : [subSmallerFromLarger(a, b), borrowSkippingZero(a, b), a + b]
    for (const d of q.distractors) {
      if (known.includes(Number(d))) malRules++
    }
  }
  assert.ok(malRules > 200, `mal-rule outputs dominate the distractors (${String(malRules)})`)
})

test("reduced motion is answered honestly and can be forced", () => {
  assert.equal(createStubHost({ seed: SEED, reducedMotion: true }).prefersReducedMotion(), true)
  assert.equal(createStubHost({ seed: SEED, reducedMotion: false }).prefersReducedMotion(), false)
  // With no DOM and no override, the honest answer is "no".
  assert.equal(createStubHost({ seed: SEED }).prefersReducedMotion(), false)
})

test("reports and haptics are observable, and a missing motor is not an error", () => {
  const reports: string[] = []
  const haptics: string[] = []
  const host = createStubHost({
    seed: SEED,
    onReport: (r) => reports.push(r.answered),
    onHaptic: (k) => haptics.push(k),
  })
  host.report({ questionId: "a", correct: true, ms: 10, answered: "47" })
  host.haptic("success")
  assert.deepEqual(reports, ["47"])
  assert.deepEqual(haptics, ["success"])
})
