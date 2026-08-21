import { test } from "node:test"
import assert from "node:assert/strict"
import { createStubHost } from "../stubHost.ts"

function drain(seed: number, n: number, difficulty?: number) {
  const host = createStubHost({ seed, reducedMotion: false })
  const out = []
  for (let i = 0; i < n; i++) out.push(host.next(difficulty === undefined ? undefined : { difficulty }))
  return out
}

test("the stream is deterministic for a seed", () => {
  assert.deepEqual(drain(42, 60), drain(42, 60))
  assert.notDeepEqual(drain(42, 60), drain(43, 60))
})

test("every answer is an exact integer and the prompt evaluates to it", () => {
  for (let d = 1; d <= 10; d++) {
    for (const q of drain(9001 + d, 250, d)) {
      const m = /^(\d+) ([×+−÷]) (\d+)$/.exec(q.prompt)
      assert.ok(m, `unparseable prompt ${q.prompt}`)
      const a = Number(m[1])
      const b = Number(m[3])
      const expected =
        m[2] === "×" ? a * b : m[2] === "+" ? a + b : m[2] === "−" ? a - b : a / b
      assert.ok(Number.isInteger(expected), `${q.prompt} is not exact`)
      assert.equal(q.answer, String(expected))
      assert.equal(String(Number(q.answer)), q.answer, "answer must be a bare integer string")
      assert.ok(Number(q.answer) > 0, `${q.prompt} = ${q.answer} must be positive`)
    }
  }
})

test("no floating point ever reaches an answer or a distractor", () => {
  for (const q of drain(5150, 800)) {
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
        assert.ok(s.length <= 3, `"${s}" from ${q.prompt} cannot be read on a moving object`)
      }
    }
  }
})

test("distractors are mal-rule outputs, not noise: the ×-table neighbours dominate", () => {
  // For a multiplication question, at least one distractor should be a real
  // procedural slip — a neighbouring times-table row, the sum of the operands,
  // or the reversal — rather than answer±k, on the large majority of items.
  let malRule = 0
  let total = 0
  for (const q of drain(24680, 3000)) {
    const m = /^(\d+) × (\d+)$/.exec(q.prompt)
    if (!m) continue
    total++
    const a = Number(m[1])
    const b = Number(m[2])
    const ans = Number(q.answer)
    const rev = Number(String(ans).split("").reverse().join(""))
    const expected = new Set([a * (b - 1), a * (b + 1), a + b, a * (b % 10), rev, ans - a])
    if (q.distractors.some((s) => expected.has(Number(s)))) malRule++
  }
  assert.ok(total > 500, "not enough multiplication items sampled")
  assert.ok(malRule / total > 0.95, `only ${((malRule / total) * 100).toFixed(1)}% carried a mal-rule`)
})

test("difficulty is clamped and monotone in operand size", () => {
  const easy = drain(11, 400, 1)
  const hard = drain(11, 400, 10)
  const mean = (qs: { answer: string }[]) => qs.reduce((s, q) => s + Number(q.answer), 0) / qs.length
  assert.ok(mean(hard) > mean(easy) * 2, "difficulty 10 must be materially harder than 1")
  for (const q of drain(11, 50, 99)) assert.ok(q.difficulty <= 10)
  for (const q of drain(11, 50, -5)) assert.ok(q.difficulty >= 1)
})

test("report and haptic are safe to call with no DOM", () => {
  const seen: string[] = []
  const host = createStubHost({ seed: 1, onReport: (r) => seen.push(r.questionId), onHaptic: (k) => seen.push(k) })
  host.report({ questionId: "q1", correct: true, ms: 120, answered: "56" })
  host.haptic("success")
  assert.deepEqual(seen, ["q1", "success"])
})
