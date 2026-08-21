import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ANSWER_MAX, ANSWER_MIN, MIN_GAP, createStubHost, spreadDistractors } from './stubHost.ts'
import { makeRng } from './core/rng.ts'

/** Evaluate the prompt independently of the generator that produced it. */
function evaluatePrompt(p: string): number {
  const m = /^(\d+)\s*([+−×÷])\s*(\d+)$/.exec(p)
  assert.ok(m, `unparseable prompt: ${p}`)
  const a = Number(m[1])
  const b = Number(m[3])
  switch (m[2]) {
    case '+':
      return a + b
    case '−':
      return a - b
    case '×':
      return a * b
    case '÷':
      assert.equal(a % b, 0, `${p} is not exact`)
      return a / b
  }
  throw new Error('unreachable')
}

test('every question the host hands out is arithmetically true', () => {
  const h = createStubHost({ seed: 12345 })
  for (let d = 0; d <= 1.0001; d += 0.1) {
    h.setDifficulty(d)
    for (let i = 0; i < 300; i++) {
      const q = h.next()
      assert.equal(Number(q.answer), evaluatePrompt(q.prompt), q.prompt)
      assert.ok(Number.isInteger(Number(q.answer)))
    }
  }
})

test('answers always fit the field', () => {
  const h = createStubHost({ seed: 777 })
  for (let d = 0; d <= 1.0001; d += 0.05) {
    h.setDifficulty(d)
    for (let i = 0; i < 200; i++) {
      const a = Number(h.next().answer)
      assert.ok(a >= ANSWER_MIN && a <= ANSWER_MAX, `answer ${a} off the field`)
    }
  }
})

test('distractors are integers, separated, in range, and never the answer', () => {
  const h = createStubHost({ seed: 4242 })
  for (const k of [1, 2, 3, 4, 5]) {
    h.setDistractorCount(k)
    for (let d = 0; d <= 1.0001; d += 0.2) {
      h.setDifficulty(d)
      for (let i = 0; i < 150; i++) {
        const q = h.next()
        const a = Number(q.answer)
        assert.equal(q.distractors.length, k)
        const vals = q.distractors.map(Number)
        for (const v of vals) {
          assert.ok(Number.isInteger(v), `${v} not an integer`)
          assert.ok(v >= ANSWER_MIN && v <= ANSWER_MAX, `${v} off the field`)
          assert.ok(Math.abs(v - a) >= MIN_GAP, `${v} too close to ${a}`)
        }
        for (let x = 0; x < vals.length; x++) {
          for (let y = x + 1; y < vals.length; y++) {
            assert.ok(Math.abs(vals[x] - vals[y]) >= MIN_GAP, `${vals[x]} and ${vals[y]} would overlap`)
          }
        }
      }
    }
  }
})

test('the same seed plays the same siege, every time', () => {
  const a = createStubHost({ seed: 999 })
  const b = createStubHost({ seed: 999 })
  for (let i = 0; i < 200; i++) {
    const qa = a.next()
    const qb = b.next()
    assert.equal(qa.prompt, qb.prompt)
    assert.equal(qa.answer, qb.answer)
    assert.deepEqual(qa.distractors, qb.distractors)
  }
  const c = createStubHost({ seed: 1000 })
  assert.notEqual(c.next().prompt + c.next().prompt, (() => {
    const d = createStubHost({ seed: 999 })
    return d.next().prompt + d.next().prompt
  })())
})

test('mal-rule distractors are preferred when they are legal', () => {
  // 7 x 8 = 56. Legal mal-rules: 49 (one group short), 63 (one group long),
  // 15 (added instead), 65 (digits reversed). 54 is only 2 away, so its keep would
  // stand inside the target's keep — it has to be dropped however good an error it is.
  const rng = makeRng(1)
  const legal = [49, 63, 15, 65]
  for (let seed = 1; seed < 40; seed++) {
    const picked = spreadDistractors(56, [49, 63, 54, 15, 65], 2, makeRng(seed))
    assert.equal(picked.length, 2)
    for (const p of picked) assert.ok(legal.includes(p), `unexpected ${p}`)
    assert.ok(!picked.includes(54), '54 is 2 away and would overlap the target')
  }
  void rng
})

test('reports carry through to the caller', () => {
  const seen: string[] = []
  const h = createStubHost({ seed: 5, onReport: (r) => seen.push(`${r.questionId}:${r.correct}`) })
  const q = h.next()
  h.report({ questionId: q.id, correct: true, ms: 1200, answered: q.answer })
  assert.deepEqual(seen, [`${q.id}:true`])
  assert.equal(h.reports.length, 1)
})
