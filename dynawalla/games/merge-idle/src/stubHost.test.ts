import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { makeStubHost } from './stubHost.ts'
import { onLadder, decompose } from './core/ladder.ts'

function evalPrompt(prompt: string): number | null {
  // Only the shapes this stub actually emits, evaluated with integers.
  const m2 = /^(\d+) \+ (\d+)$/.exec(prompt)
  if (m2) return Number(m2[1]) + Number(m2[2])
  const m3 = /^(\d+) \+ (\d+) \+ (\d+)$/.exec(prompt)
  if (m3) return Number(m3[1]) + Number(m3[2]) + Number(m3[3])
  const mm = /^(\d+) × (\d+)$/.exec(prompt)
  if (mm) return Number(mm[1]) * Number(mm[2])
  const ms = /^(\d+) − (\d+)$/.exec(prompt)
  if (ms) return Number(ms[1]) - Number(ms[2])
  const mh = /^half of (\d+)$/.exec(prompt)
  if (mh) return Number(mh[1]) / 2
  return null
}

test('the prompt actually evaluates to the answer, for every question it emits', () => {
  const h = makeStubHost({ seed: 42 })
  for (let d = 1; d <= 10; d++) {
    for (let i = 0; i < 300; i++) {
      const q = h.next({ difficulty: d })
      const got = evalPrompt(q.prompt)
      assert.notEqual(got, null, `unrecognised prompt shape: ${q.prompt}`)
      assert.equal(String(got), q.answer, `${q.prompt} should be ${q.answer}, got ${got}`)
    }
  }
})

test('every answer is a safe positive integer — no float ever reaches a comparison', () => {
  const h = makeStubHost({ seed: 7 })
  for (let i = 0; i < 4000; i++) {
    const q = h.next({ difficulty: (i % 10) + 1 })
    const a = Number(q.answer)
    assert.ok(Number.isSafeInteger(a), `${q.answer} must be a safe integer`)
    assert.ok(a > 0)
    assert.equal(String(a), q.answer, 'the answer string must be canonical')
  }
})

test('every answer is a polyp value, so the native path is always available', () => {
  const h = makeStubHost({ seed: 99 })
  for (let i = 0; i < 3000; i++) {
    const q = h.next({ difficulty: (i % 10) + 1 })
    assert.ok(onLadder(Number(q.answer)), `${q.answer} must be buildable on the shelf`)
  }
})

test('three distractors, all distinct, all positive integers, none equal to the answer', () => {
  const h = makeStubHost({ seed: 5 })
  for (let i = 0; i < 3000; i++) {
    const q = h.next({ difficulty: (i % 10) + 1 })
    assert.equal(q.distractors.length, 3, `${q.prompt} produced ${q.distractors.length}`)
    const set = new Set(q.distractors)
    assert.equal(set.size, 3, `duplicate distractors for ${q.prompt}`)
    assert.equal(set.has(q.answer), false, `answer leaked into distractors for ${q.prompt}`)
    for (const d of q.distractors) {
      const n = Number(d)
      assert.ok(Number.isSafeInteger(n) && n > 0, `${d} is not a usable distractor`)
    }
  }
})

test('distractors are mal-rule outputs, not noise — the no-carry bug shows up', () => {
  // 96 + 96 answered column-wise with the carry dropped is 82. A child who does
  // that must find their own wrong answer on the board, or the assay is a guess.
  const h = makeStubHost({ seed: 1234 })
  let sawNoCarry = false
  for (let i = 0; i < 4000 && !sawNoCarry; i++) {
    const q = h.next({ difficulty: 6 })
    const m = /^(\d+) \+ (\d+)$/.exec(q.prompt)
    if (!m) continue
    const a = Number(m[1])
    const b = Number(m[2])
    if (a !== b) continue
    let noCarry = 0
    let mul = 1
    let x = a
    let y = b
    while (x > 0 || y > 0) {
      noCarry += (((x % 10) + (y % 10)) % 10) * mul
      mul *= 10
      x = Math.floor(x / 10)
      y = Math.floor(y / 10)
    }
    if (noCarry !== Number(q.answer) && q.distractors.includes(String(noCarry))) sawNoCarry = true
  }
  assert.ok(sawNoCarry, 'the drop-the-carry mal-rule must appear among the distractors')
})

test('same seed, same stream — twice, exactly', () => {
  const a = makeStubHost({ seed: 314159 })
  const b = makeStubHost({ seed: 314159 })
  for (let i = 0; i < 500; i++) {
    const qa = a.next({ difficulty: (i % 10) + 1 })
    const qb = b.next({ difficulty: (i % 10) + 1 })
    assert.deepEqual(qa, qb)
  }
})

test('different seeds diverge', () => {
  const a = makeStubHost({ seed: 1 })
  const b = makeStubHost({ seed: 2 })
  let differences = 0
  for (let i = 0; i < 100; i++) {
    if (a.next({ difficulty: 5 }).prompt !== b.next({ difficulty: 5 }).prompt) differences++
  }
  assert.ok(differences > 60, `expected mostly-different streams, got ${differences}/100`)
})

test('difficulty moves the answers up the ladder', () => {
  const h = makeStubHost({ seed: 8 })
  const meanStep = (d: number): number => {
    let total = 0
    const n = 400
    for (let i = 0; i < n; i++) total += decompose(Number(h.next({ difficulty: d }).answer))?.step ?? 0
    return total / n
  }
  const easy = meanStep(1)
  const mid = meanStep(5)
  const hard = meanStep(10)
  assert.ok(easy < mid, `difficulty 1 (${easy}) must be easier than 5 (${mid})`)
  assert.ok(mid < hard, `difficulty 5 (${mid}) must be easier than 10 (${hard})`)
})

test('out-of-range difficulty is clamped, never thrown', () => {
  const h = makeStubHost({ seed: 2 })
  for (const d of [-5, 0, 0.4, 11, 99, NaN]) {
    const q = h.next({ difficulty: d })
    assert.ok(q.difficulty >= 1 && q.difficulty <= 10, `difficulty ${d} -> ${q.difficulty}`)
    assert.ok(onLadder(Number(q.answer)))
  }
  const bare = h.next()
  assert.ok(onLadder(Number(bare.answer)))
})

test('question ids are unique within a host', () => {
  const h = makeStubHost({ seed: 77 })
  const ids = new Set<string>()
  for (let i = 0; i < 2000; i++) ids.add(h.next({ difficulty: 4 }).id)
  assert.equal(ids.size, 2000)
})

test('report is forwarded verbatim and haptics never throw without a vibrate API', () => {
  const seen: Array<{ correct: boolean }> = []
  const h = makeStubHost({ seed: 3, onReport: (r) => seen.push({ correct: r.correct }) })
  h.report({ questionId: 'x', correct: true, ms: 12, answered: '48' })
  h.report({ questionId: 'y', correct: false, ms: 900, answered: '82' })
  assert.deepEqual(seen, [{ correct: true }, { correct: false }])
  for (const k of ['light', 'medium', 'heavy', 'success', 'failure'] as const) h.haptic(k)
  assert.equal(h.prefersReducedMotion(), false)
  assert.equal(makeStubHost({ forceReducedMotion: true }).prefersReducedMotion(), true)
})
