// THE STUB HOST.
//
// It stands in for the runtime so the observatory is playable with `npm run
// dev`. Three properties it has to have, because the real host has them and a
// stub that is looser than the thing it stands in for hides bugs rather than
// finding them.

import assert from "node:assert/strict"
import { test } from "node:test"

import { answerOf, isUsable } from "../game/station.ts"
import { createStubHost } from "../stubHost.ts"

test("every operand, answer and distractor is an exact integer", () => {
  const host = createStubHost({ seed: 0xe0ac7 })
  for (let i = 0; i < 400; i++) {
    const q = host.next({ difficulty: (i % 10) / 10 })
    assert.ok(/^\d+$/.test(q.answer), `answer "${q.answer}" is not a whole number`)
    const value = Number(q.answer)
    assert.ok(Number.isInteger(value) && value >= 0)
    for (const d of q.distractors) {
      assert.ok(/^-?\d+$/.test(d), `distractor "${d}" is not a whole number`)
      assert.ok(Number.isInteger(Number(d)))
    }
    // And the prompt really is the arithmetic the answer came from.
    const m = /^(\d+) ([+−]) (\d+)$/.exec(q.prompt)
    assert.ok(m, `prompt "${q.prompt}" is not a column sum`)
    const a = Number(m[1])
    const b = Number(m[3])
    assert.equal(value, m[2] === "+" ? a + b : a - b, `"${q.prompt}" does not make ${q.answer}`)
  }
})

test("the same seed is the same stream, forever", () => {
  const a = createStubHost({ seed: 0x5eed })
  const b = createStubHost({ seed: 0x5eed })
  for (let i = 0; i < 200; i++) {
    assert.deepEqual(a.next({ difficulty: 0.5 }), b.next({ difficulty: 0.5 }))
  }
  const c = createStubHost({ seed: 0x5eee })
  assert.notDeepEqual(a.next(), c.next())
})

test("every question the stub draws can be stationed on this sky", () => {
  const host = createStubHost({ seed: 0x11a7 })
  for (let i = 0; i < 500; i++) {
    const q = host.next({ difficulty: (i % 11) / 10 })
    assert.equal(isUsable(q), true, `"${q.prompt}" = ${q.answer} has no station`)
    assert.ok((answerOf(q) ?? -1) >= 0)
  }
})

test("distractors are mal-rule outputs, not the answer and not noise around it", () => {
  const host = createStubHost({ seed: 0x9a1e })
  let offByOne = 0
  let total = 0
  for (let i = 0; i < 400; i++) {
    const q = host.next({ difficulty: (i % 10) / 10 })
    const answer = Number(q.answer)
    assert.equal(new Set(q.distractors).size, q.distractors.length, "a distractor was repeated")
    for (const d of q.distractors) {
      assert.notEqual(Number(d), answer, "the answer was served as a distractor")
      total++
      if (Math.abs(Number(d) - answer) === 1) offByOne++
    }
  }
  assert.ok(total > 0)
  // `answer ± 1` is the shape of noise. A mal-rule pool can produce one by
  // coincidence; it must not be made of them.
  assert.ok(offByOne / total < 0.1, `${offByOne}/${total} distractors were answer ± 1`)
})

test("the stub reports, haptics and stopping points are all observable", () => {
  const reports: unknown[] = []
  const haptics: string[] = []
  const transitions: string[] = []
  const host = createStubHost({
    seed: 1,
    reducedMotion: true,
    onReport: (r) => reports.push(r),
    onHaptic: (k) => haptics.push(k),
    onTransition: (k) => transitions.push(k),
  })
  host.report({ questionId: "x", correct: true, ms: 12, answered: "7" })
  host.haptic("success")
  host.transition?.("level", "watch 1")
  assert.equal(reports.length, 1)
  assert.deepEqual(haptics, ["success"])
  assert.deepEqual(transitions, ["level"])
  assert.equal(host.prefersReducedMotion(), true)
})
