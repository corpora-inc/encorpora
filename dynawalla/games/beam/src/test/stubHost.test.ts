import { test } from "node:test"
import assert from "node:assert/strict"

import { createStubHost } from "../stubHost.ts"

function drain(seed: number, n: number, difficulty?: number) {
  const host = createStubHost({ seed, reducedMotion: false })
  const out = []
  for (let i = 0; i < n; i++) {
    out.push(host.next(difficulty === undefined ? undefined : { difficulty }))
  }
  return out
}

test("the stream is deterministic for a seed", () => {
  assert.deepEqual(drain(42, 80), drain(42, 80))
  assert.notDeepEqual(drain(42, 80), drain(43, 80))
})

test("it serves only what the curriculum can actually serve", () => {
  // The `add` domain is the only one with active rows: whole-number column
  // addition and subtraction. A stub that handed out division while the ladder
  // cannot would misrepresent the game on a real device.
  for (const q of drain(1234, 900)) {
    assert.ok(q.domain === "add" || q.domain === "sub", `unexpected domain ${q.domain}`)
    assert.ok(/^\d+ [+−] \d+$/.test(q.prompt), `unexpected prompt ${q.prompt}`)
  }
})

test("every answer is an exact integer and the prompt evaluates to it", () => {
  for (let d = 1; d <= 10; d++) {
    for (const q of drain(9001 + d, 300, d)) {
      const m = /^(\d+) ([+−]) (\d+)$/.exec(q.prompt)
      assert.ok(m, `unparseable prompt ${q.prompt}`)
      const a = Number(m[1])
      const b = Number(m[3])
      const expected = m[2] === "+" ? a + b : a - b
      assert.ok(Number.isInteger(expected), `${q.prompt} is not exact`)
      assert.equal(q.answer, String(expected))
      assert.equal(String(Number(q.answer)), q.answer, "answer must be a bare integer string")
      assert.ok(Number(q.answer) > 0, `${q.prompt} = ${q.answer} must be positive`)
    }
  }
})

test("no floating point ever reaches an answer or a distractor", () => {
  for (const q of drain(5150, 900)) {
    for (const s of [q.answer, ...q.distractors]) {
      assert.ok(/^\d+$/.test(s), `"${s}" is not a bare non-negative integer`)
    }
  }
})

test("there are always exactly three distinct distractors, none equal to the answer", () => {
  for (let d = 1; d <= 10; d++) {
    for (const q of drain(31337 + d, 400, d)) {
      assert.equal(q.distractors.length, 3, `${q.prompt} produced ${q.distractors.length}`)
      const set = new Set(q.distractors)
      assert.equal(set.size, 3, `${q.prompt} has duplicate distractors`)
      assert.ok(!set.has(q.answer), `${q.prompt} lists its own answer as a distractor`)
    }
  }
})

test("every value fits the three-digit legibility ceiling", () => {
  for (let d = 1; d <= 10; d++) {
    for (const q of drain(777 + d, 400, d)) {
      for (const s of [q.answer, ...q.distractors]) {
        assert.ok(s.length <= 3, `"${s}" from ${q.prompt} cannot be read on a moving hull`)
      }
    }
  }
})

test("distractors are mal-rule outputs, not noise", () => {
  // What a child running a specific broken column procedure actually writes:
  // the carry dropped, the carry added twice, the same slip a column left, the
  // small digit taken from the large one, the reversal, the wrong operation.
  const reverse = (n: number): number => {
    let out = 0
    let m = n
    while (m > 0) {
      out = out * 10 + (m % 10)
      m = Math.floor(m / 10)
    }
    return out
  }
  const digitwise = (a: number, b: number, f: (x: number, y: number) => number): number => {
    let out = 0
    let place = 1
    let x = a
    let y = b
    while (x > 0 || y > 0) {
      out += f(x % 10, y % 10) * place
      place *= 10
      x = Math.floor(x / 10)
      y = Math.floor(y / 10)
    }
    return out
  }
  let malRule = 0
  let total = 0
  for (const q of drain(24680, 4000)) {
    const m = /^(\d+) ([+−]) (\d+)$/.exec(q.prompt)
    if (!m) continue
    total++
    const a = Number(m[1])
    const b = Number(m[3])
    const ans = Number(q.answer)
    const expected = new Set(
      m[2] === "+"
        ? [digitwise(a, b, (x, y) => (x + y) % 10), ans - 10, ans + 10, ans - 100, Math.abs(a - b), reverse(ans)]
        : [digitwise(a, b, (x, y) => Math.abs(x - y)), ans + 10, ans - 10, ans + 100, a + b, reverse(ans)],
    )
    if (q.distractors.some((s) => expected.has(Number(s)))) malRule++
  }
  assert.ok(total > 3000, "not enough items sampled")
  assert.ok(malRule / total > 0.98, `only ${((malRule / total) * 100).toFixed(1)}% carried a mal-rule`)
})

test("no distractor is ever the off-by-one that teaches nothing", () => {
  let offByOne = 0
  let total = 0
  for (const q of drain(1357, 3000)) {
    const ans = Number(q.answer)
    for (const s of q.distractors) {
      total++
      if (Math.abs(Number(s) - ans) === 1) offByOne++
    }
  }
  assert.ok(total > 8000)
  assert.equal(offByOne, 0, `${offByOne} distractors were answer ± 1`)
})

test("difficulty is clamped and monotone in operand size", () => {
  const mean = (qs: { answer: string }[]): number =>
    qs.reduce((s, q) => s + Number(q.answer), 0) / qs.length
  assert.ok(mean(drain(11, 500, 10)) > mean(drain(11, 500, 1)) * 2)
  for (const q of drain(11, 60, 99)) assert.ok(q.difficulty <= 10)
  for (const q of drain(11, 60, -5)) assert.ok(q.difficulty >= 1)
})

test("report and haptic are safe to call with no DOM", () => {
  const seen: string[] = []
  const host = createStubHost({
    seed: 1,
    onReport: (r) => seen.push(r.questionId),
    onHaptic: (k) => seen.push(k),
  })
  host.report({ questionId: "q1", correct: true, ms: 120, answered: "56" })
  host.haptic("success")
  assert.deepEqual(seen, ["q1", "success"])
  assert.equal(typeof host.prefersReducedMotion(), "boolean")
})
