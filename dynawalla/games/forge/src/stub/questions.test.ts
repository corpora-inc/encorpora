import { strict as assert } from "node:assert"
import { test } from "node:test"

import { makeRng } from "../core/rng.ts"
import { generate, payoutFor } from "./questions.ts"

test("every generated question is well formed", () => {
  const rng = makeRng(99)
  for (let level = 0; level <= 1.0001; level += 0.05) {
    for (let i = 0; i < 400; i++) {
      const q = generate(rng, level)
      assert.equal(q.distractors.length, 3, q.prompt)
      assert.ok(q.prompt.length > 0)
      assert.ok(/^\d+$/.test(q.answer), `answer not a plain integer: ${q.answer}`)
      const set = new Set([q.answer, ...q.distractors])
      assert.equal(set.size, 4, `duplicate option in ${q.prompt}: ${[...set].join(",")}`)
      for (const d of q.distractors) {
        assert.ok(/^\d+$/.test(d), `distractor not a non-negative integer: ${d}`)
      }
      assert.ok(q.difficulty >= 0 && q.difficulty <= 1)
    }
  }
})

test("the stated answer is the arithmetically correct one", () => {
  const rng = makeRng(7)
  const ops: Record<string, (a: number, b: number) => number> = {
    "+": (a, b) => a + b,
    "−": (a, b) => a - b,
    "×": (a, b) => a * b,
    "÷": (a, b) => a / b,
  }
  let checked = 0
  for (let i = 0; i < 3000; i++) {
    const q = generate(rng, i / 3000)
    const m = /^(\d+) ([+−×÷]) (\d+)$/.exec(q.prompt)
    if (!m) continue
    const fn = ops[m[2] as string]
    assert.equal(fn(Number(m[1]), Number(m[3])), Number(q.answer), q.prompt)
    checked++
  }
  assert.ok(checked > 800, `expected plenty of plain binary prompts, got ${checked}`)
})

test("missing-operand prompts are consistent", () => {
  const rng = makeRng(11)
  let checked = 0
  for (let i = 0; i < 4000; i++) {
    const q = generate(rng, 0.9)
    const m = /^(\d+) × □ = (\d+)$/.exec(q.prompt)
    if (!m) continue
    assert.equal(Number(m[1]) * Number(q.answer), Number(m[2]), q.prompt)
    checked++
  }
  assert.ok(checked > 50)
})

test("exponent-product prompts add the exponents", () => {
  const rng = makeRng(13)
  const sups = "⁰¹²³⁴⁵⁶⁷⁸⁹"
  const unsup = (s: string) =>
    Number([...s].map((c) => String(sups.indexOf(c))).join(""))
  let checked = 0
  for (let i = 0; i < 6000; i++) {
    const q = generate(rng, 1)
    const m = /^10([⁰-⁹]+) × 10([⁰-⁹]+) = 10□$/.exec(q.prompt)
    if (!m) continue
    assert.equal(unsup(m[1] as string) + unsup(m[2] as string), Number(q.answer), q.prompt)
    checked++
  }
  assert.ok(checked > 50, `expected exponent prompts at level 1, got ${checked}`)
})

test("no distractor is a free pass", () => {
  // A wrong answer an order of magnitude away is not a distractor, it is a
  // giveaway: the player picks by size and never does the arithmetic.
  const rng = makeRng(5)
  let far = 0
  let total = 0
  for (let i = 0; i < 2000; i++) {
    const q = generate(rng, 0.5)
    const a = Number(q.answer)
    for (const d of q.distractors) {
      total++
      if (Number(d) > a * 10 + 30 || Number(d) < a / 10 - 30) far++
    }
  }
  assert.equal(far, 0, `${far}/${total} distractors are implausible`)
})

test("dropping implausible mal-rules has not degenerated into off-by-one noise", () => {
  // The backfill exists for collisions, not as the main supply. If most
  // distractors were just answer +/- 1 the options would stop teaching
  // anything, so this asserts real mal-rule outputs still dominate.
  const rng = makeRng(6)
  let rule = 0
  let total = 0
  for (let i = 0; i < 2000; i++) {
    const q = generate(rng, 0.5)
    const a = Number(q.answer)
    for (const d of q.distractors) {
      total++
      if (Math.abs(Number(d) - a) > 2) rule++
    }
  }
  assert.ok(rule / total > 0.55, `only ${((rule / total) * 100).toFixed(0)}% are real mal-rules`)
})

test("payout is bounded so a lucky exponent cannot outrank a minute of work", () => {
  assert.equal(payoutFor("7"), 7)
  assert.equal(payoutFor("0"), 3)
  assert.equal(payoutFor("144"), 144)
  assert.ok(payoutFor("10000000") < 200)
  assert.ok(payoutFor("not-a-number") > 0)
})

test("the generator is seeded: same seed, same stream", () => {
  const a = makeRng(4242)
  const b = makeRng(4242)
  for (let i = 0; i < 200; i++) {
    const qa = generate(a, 0.4)
    const qb = generate(b, 0.4)
    assert.equal(qa.prompt, qb.prompt)
    assert.equal(qa.answer, qb.answer)
    assert.deepEqual(qa.distractors, qb.distractors)
  }
})
