// The stub host's three promises, which the real runtime also has to keep.
//
// It matters that these are asserted rather than assumed: every other test in
// this package plays the game through this host, so a stub that quietly served
// a float or an unseeded stream would make the rest of the suite meaningless.

import assert from "node:assert/strict"
import { test } from "node:test"

import { createStubHost } from "../stubHost.ts"

test("exact arithmetic: every answer and every distractor is a positive integer", () => {
  const host = createStubHost({ seed: 0x1234 })
  for (let i = 0; i < 3000; i++) {
    const q = host.next()
    assert.ok(/^\d+$/.test(q.answer), `answer "${q.answer}" is not an integer string`)
    assert.ok(Number(q.answer) >= 1)
    for (const d of q.distractors) {
      assert.ok(/^\d+$/.test(d), `distractor "${d}" is not an integer string`)
      assert.notEqual(d, q.answer, "a distractor was the answer")
    }
    assert.equal(new Set(q.distractors).size, q.distractors.length, "duplicate distractors")
  }
})

test("the prompt and the answer agree, digit for digit", () => {
  const host = createStubHost({ seed: 0x9 })
  for (let i = 0; i < 2000; i++) {
    const q = host.next()
    const match = /^(\d+) ([+−]) (\d+)$/.exec(q.prompt)
    assert.ok(match, `prompt "${q.prompt}" is not a column sum`)
    const a = Number(match[1])
    const b = Number(match[3])
    const expected = match[2] === "+" ? a + b : a - b
    assert.equal(Number(q.answer), expected, `"${q.prompt}" does not make ${q.answer}`)
  }
})

test("seeded and deterministic: the same seed is the same stream, forever", () => {
  const a = createStubHost({ seed: 0xc0105 })
  const b = createStubHost({ seed: 0xc0105 })
  for (let i = 0; i < 500; i++) {
    assert.deepEqual(a.next(), b.next())
  }
  const c = createStubHost({ seed: 0xc0106 })
  const d = createStubHost({ seed: 0xc0105 })
  let same = 0
  for (let i = 0; i < 200; i++) if (c.next().prompt === d.next().prompt) same++
  assert.ok(same < 20, "two different seeds produced nearly the same stream")
})

test("distractors are mal-rule outputs, not `answer ± 1` noise", () => {
  // The dropped-carry rule: 27 + 15 written down as 32, because the 1 the ones
  // column made never reached the tens. It is the single most common column
  // addition error there is, and COLOSSUS stands it up as a slab to punch.
  const host = createStubHost({ seed: 0x1234, difficulty: 0.4 })
  let malRules = 0
  let nearMisses = 0
  for (let i = 0; i < 600; i++) {
    const q = host.next()
    const answer = Number(q.answer)
    for (const text of q.distractors) {
      const v = Number(text)
      if (Math.abs(v - answer) <= 2) nearMisses++
      else malRules++
    }
  }
  assert.ok(
    malRules > nearMisses * 6,
    `only ${malRules} mal-rule values against ${nearMisses} near-misses`,
  )
})

test("reduced motion is whatever it is told, not whatever the machine has", () => {
  assert.equal(createStubHost({ reducedMotion: true }).prefersReducedMotion(), true)
  assert.equal(createStubHost({ reducedMotion: false }).prefersReducedMotion(), false)
})

test("difficulty is the 0..1 the real host sends, and it is clamped", () => {
  const host = createStubHost({ seed: 3 })
  for (let i = 0; i < 200; i++) {
    const q = host.next()
    assert.ok(q.difficulty >= 0 && q.difficulty <= 1, `difficulty ${q.difficulty}`)
  }
  assert.equal(host.next({ difficulty: 5 }).difficulty, 1)
  assert.equal(host.next({ difficulty: -3 }).difficulty, 0)
})
