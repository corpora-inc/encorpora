import test from "node:test"
import assert from "node:assert/strict"
import { createStubHost, mulberry32 } from "./stubHost.ts"

/**
 * The stub host is the only part of the game that produces mathematics, so it
 * is the part that has to be provably right. The renderer can be wrong and a
 * child sees an ugly frame; this file can be wrong and a child is told correct
 * work is incorrect.
 *
 * `next()` takes the difficulty explicitly here. The live ramp is driven by the
 * run, and a loop that just calls `next()` would sit at the default forever and
 * never reach the `div` or `signed` families.
 */

/** Prompt glyphs are typographic (U+2212, ×, ÷); make them evaluable. */
const norm = (s: string): string =>
  s.replace(/−/g, "-").replace(/×/g, "*").replace(/÷/g, "/")

test("every generated question is well formed", () => {
  const h = createStubHost({ seed: 4242 })
  for (let i = 0; i < 4000; i++) {
    const q = h.next({ difficulty: (i % 10) + 1 })

    const a = Number(q.answer)
    assert.ok(Number.isInteger(a), `answer is not an exact integer: ${q.answer}`)

    assert.equal(q.distractors.length, 3, `wanted 3 distractors in ${q.prompt}`)
    const vals = q.distractors.map(Number)
    for (const v of vals) {
      assert.ok(Number.isInteger(v), `distractor is not an exact integer: ${v}`)
      assert.notEqual(v, a, `distractor equals the answer in ${q.prompt}`)
    }
    assert.equal(new Set(vals).size, 3, `duplicate distractors in ${q.prompt}`)

    assert.ok(q.prompt.length > 0, "empty prompt")
    // Strict: no ASCII hyphen anywhere in a prompt. Every generator emits
    // U+2212 for both subtraction and negation, so nothing legitimate puts a
    // hyphen here.
    //
    // The `(?<![0-9(])-` lookbehind this replaces had a hole exactly where it
    // mattered: it accepted `(-4) + 2`, because the hyphen follows `(`. That is
    // the precise shape genSigned produces — `(−a) + (−b)` — so a generator
    // regressing from U+2212 to ASCII in its negation branch was the one
    // regression the assertion could not see.
    assert.doesNotMatch(q.prompt, /-/, "use U+2212, never a hyphen")
    assert.ok(q.id.length > 0, "empty id")
  }
})

test("prompts are arithmetically true", () => {
  const h = createStubHost({ seed: 77 })
  let checked = 0
  for (let i = 0; i < 3000; i++) {
    const q = h.next({ difficulty: (i % 10) + 1 })
    const a = Number(q.answer)
    const p = norm(q.prompt)

    assert.match(p, /^[-()\d+*/\s]+$/, `unexpected glyph in prompt: ${q.prompt}`)
    // eslint-disable-next-line no-new-func -- test-only evaluation of our own generated infix
    const v = Function(`"use strict";return (${p})`)() as number
    assert.equal(v, a, `${q.prompt} should be ${a}, computed ${v}`)

    if (q.domain === "div") {
      // Division must come out exact — a remainder would be unanswerable.
      assert.ok(Number.isInteger(v), `${q.prompt} is not an exact division`)
    }
    checked++
  }
  assert.equal(checked, 3000)
})

test("the whole family table is reachable across the difficulty ramp", () => {
  const h = createStubHost({ seed: 9 })
  const seen = new Set<string>()
  for (let i = 0; i < 4000; i++) seen.add(h.next({ difficulty: (i % 10) + 1 }).domain)
  assert.deepEqual(
    [...seen].sort(),
    ["add", "div", "mul", "signed", "sub"],
    `only saw ${[...seen].sort().join(",")}`,
  )
})

test("a pinned domain is honoured", () => {
  const h = createStubHost({ seed: 3 })
  for (const d of ["add", "sub", "mul", "div", "signed"]) {
    for (let i = 0; i < 50; i++) {
      assert.equal(h.next({ domain: d, difficulty: 8 }).domain, d)
    }
  }
})

test("seeded runs are byte-identical", () => {
  const a = createStubHost({ seed: 99 })
  const b = createStubHost({ seed: 99 })
  for (let i = 0; i < 500; i++) {
    assert.deepEqual(a.next({ difficulty: (i % 10) + 1 }), b.next({ difficulty: (i % 10) + 1 }))
  }
})

test("mulberry32 is deterministic and stays in [0,1)", () => {
  const a = mulberry32(1234)
  const b = mulberry32(1234)
  for (let i = 0; i < 1000; i++) {
    const v = a()
    assert.equal(v, b())
    assert.ok(v >= 0 && v < 1, `rng out of range: ${v}`)
  }
})

test("report reaches the onReport hook", () => {
  const got: string[] = []
  const h = createStubHost({ seed: 1, onReport: (r) => got.push(r.questionId) })
  h.report({ questionId: "q-1", correct: true, ms: 900, answered: "7" })
  assert.deepEqual(got, ["q-1"])
})
