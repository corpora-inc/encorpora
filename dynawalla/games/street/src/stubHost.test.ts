import assert from "node:assert/strict"
import { test } from "node:test"

import { createStubHost } from "./stubHost.ts"

const DIGITS = /^\d+$/

test("every numeral that reaches a rivet is an exact integer", () => {
  // No float ever enters an answer or a comparison. A rivet reading `72.0000001`
  // is not a wrong answer, it is a broken product.
  for (let seed = 1; seed <= 40; seed++) {
    const host = createStubHost({ seed })
    for (let i = 0; i < 60; i++) {
      const q = host.next({ difficulty: 1 + (i % 10) })
      assert.match(q.answer, DIGITS, q.prompt)
      assert.equal(Number.isInteger(Number(q.answer)), true)
      assert.ok(Number(q.answer) > 0, `${q.prompt} = ${q.answer}`)
      for (const d of q.distractors) {
        assert.match(d, DIGITS, `${q.prompt} → ${d}`)
        assert.equal(Number.isInteger(Number(d)), true)
      }
    }
  }
})

test("the prompt and the answer agree, computed independently", () => {
  const host = createStubHost({ seed: 0xa11 })
  for (let i = 0; i < 400; i++) {
    const q = host.next({ difficulty: 1 + (i % 10) })
    const [left, glyph, right] = q.prompt.split(" ")
    const a = Number(left)
    const b = Number(right)
    assert.ok(Number.isInteger(a) && Number.isInteger(b), q.prompt)
    const expected = glyph === "+" ? a + b : a - b
    assert.equal(Number(q.answer), expected, q.prompt)
  }
})

test("no distractor is the answer, and none repeats", () => {
  const host = createStubHost({ seed: 0xd15 })
  for (let i = 0; i < 400; i++) {
    const q = host.next({ difficulty: 1 + (i % 10) })
    assert.ok(!q.distractors.includes(q.answer), `${q.prompt} offered its own answer twice`)
    assert.equal(new Set(q.distractors).size, q.distractors.length, q.prompt)
    assert.equal(q.distractors.length, 3, q.prompt)
  }
})

test("the wrong values are mal-rule outputs, not answer ± 1 noise", () => {
  // A rivet has to be worth rejecting. `answer ± 1` is rejected by counting; a
  // dropped carry is rejected by doing the arithmetic, which is the point.
  const host = createStubHost({ seed: 0x3a1 })
  let nearMisses = 0
  let total = 0
  for (let i = 0; i < 400; i++) {
    const q = host.next({ difficulty: 3 })
    const answer = Number(q.answer)
    for (const d of q.distractors) {
      total++
      if (Math.abs(Number(d) - answer) <= 2) nearMisses++
    }
  }
  assert.ok(nearMisses / total < 0.12, `${nearMisses}/${total} of the rivets were near-misses`)
})

test("the same seed is the same stream, forever", () => {
  const draw = () => {
    const host = createStubHost({ seed: 0x5eed })
    return Array.from({ length: 80 }, (_, i) => {
      const q = host.next({ difficulty: 1 + (i % 10) })
      return `${q.prompt}=${q.answer}|${q.distractors.join(",")}`
    })
  }
  assert.deepEqual(draw(), draw())
  const other = createStubHost({ seed: 0x5eee })
  assert.notEqual(other.next().prompt, createStubHost({ seed: 0x5eed }).next().prompt)
})

test("difficulty widens the operands rather than changing the arithmetic", () => {
  const widthAt = (difficulty: number): number => {
    const host = createStubHost({ seed: 0xd1ff })
    let max = 0
    for (let i = 0; i < 200; i++) {
      max = Math.max(max, Number(host.next({ difficulty }).answer))
    }
    return max
  }
  assert.ok(widthAt(9) > widthAt(1) * 4, "the top of the ladder is not wider than the bottom")
})

test("subtraction never goes below zero", () => {
  const host = createStubHost({ seed: 0x5bb })
  for (let i = 0; i < 600; i++) {
    const q = host.next({ difficulty: 1 + (i % 10) })
    if (!q.prompt.includes("−")) continue
    assert.ok(Number(q.answer) > 0, q.prompt)
  }
})

test("reports and haptics are observable, and a stopping point is offered", () => {
  const reports: string[] = []
  const haptics: string[] = []
  const transitions: string[] = []
  const host = createStubHost({
    seed: 1,
    reducedMotion: true,
    onReport: (r) => reports.push(r.answered),
    onHaptic: (k) => haptics.push(k),
    onTransition: (k) => transitions.push(k),
  })
  host.report({ questionId: "q", correct: true, ms: 10, answered: "72" })
  host.haptic("medium")
  host.transition?.("level")
  assert.deepEqual(reports, ["72"])
  assert.deepEqual(haptics, ["medium"])
  assert.deepEqual(transitions, ["level"])
  assert.equal(host.prefersReducedMotion(), true)
})
