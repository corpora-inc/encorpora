/**
 * The stub host is the test bed `core/ask.ts` is measured against, so its own
 * honesty matters more than usual.
 *
 * The previous version biased its answers onto the polyp ladder. That made every
 * reachability measurement vacuous: the thing under test was handed a stream that
 * could not fail. This one models the shipped curriculum's operand widths and knows
 * nothing about polyps — so if `ask.test.ts` reports 100% buildable targets, that is
 * the negotiation working and not the fixture being kind.
 */

import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { clampDifficulty, makeStubHost, STUB_POOL } from './stubHost.ts'
import { onLadder } from './core/ladder.ts'

test('every answer and every distractor is a positive safe integer', () => {
  const host = makeStubHost({ seed: 1 })
  for (let d = 1; d <= 10; d++) {
    for (let i = 0; i < 200; i++) {
      const q = host.next({ difficulty: d })
      const a = Number(q.answer)
      assert.ok(Number.isSafeInteger(a), `${q.prompt} = ${q.answer} is not a safe integer`)
      assert.ok(a > 0, `${q.prompt} = ${q.answer}`)
      assert.equal(String(a), q.answer, 'the answer string must be exactly the integer')
      assert.equal(q.distractors.length, 3)
      for (const x of q.distractors) {
        assert.ok(Number.isSafeInteger(Number(x)), `${x} is not an integer`)
        assert.notEqual(x, q.answer, 'a distractor may never be the answer')
      }
    }
  }
})

test('the stream is deterministic from its seed', () => {
  const a = makeStubHost({ seed: 77 })
  const b = makeStubHost({ seed: 77 })
  for (let i = 0; i < 100; i++) {
    const x = a.next({ difficulty: 4 })
    const y = b.next({ difficulty: 4 })
    assert.equal(x.prompt, y.prompt)
    assert.equal(x.answer, y.answer)
  }
})

test('it knows NOTHING about the polyp ladder, or every reachability test is vacuous', () => {
  // The generator must never consult the ladder. Asserted on the source, because
  // this is the property that makes `ask.test.ts`'s "100% of targets are buildable"
  // mean something: a fixture that quietly served polyp values would prove nothing.
  return import('node:fs/promises')
    .then((fs) => fs.readFile(new URL('./stubHost.ts', import.meta.url), 'utf8'))
    .then((src) => {
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      // The only mention allowed is the re-export at the bottom, which tests use.
      const uses = code.split('onLadder').length - 1
      assert.equal(uses, 2, `onLadder appears ${uses} times in the generator, not just the re-export`)
      assert.equal(code.includes('SEEDS'), false, 'the fixture must not know the seeds')
      assert.equal(code.includes('decompose'), false, 'the fixture must not decompose a value')

      // And measured on the stream, at the rung where reachability actually bites:
      // an unbiased generator lands on a ladder value only now and then.
      const host = makeStubHost({ seed: 5 })
      let onIt = 0
      const N = 600
      for (let i = 0; i < N; i++) if (onLadder(Number(host.next({ difficulty: 9 }).answer))) onIt++
      console.log(`   ${((100 * onIt) / N).toFixed(1)}% of rung-9 answers happen to be polyp values`)
      assert.ok(onIt < N * 0.1, `${onIt}/${N} answers were already polyp values — the fixture is biased`)
    })
})

test('a harder rung really does mean a bigger answer', () => {
  const host = makeStubHost({ seed: 9 })
  const mean = (d: number): number => {
    let sum = 0
    for (let i = 0; i < 300; i++) sum += Number(host.next({ difficulty: d }).answer)
    return sum / 300
  }
  const low = mean(1)
  const high = mean(9)
  assert.ok(high > low * 50, `rung 1 averaged ${low.toFixed(0)} and rung 9 ${high.toFixed(0)}`)
  // ...which is the whole reason this game states a ceiling. The founder's
  // `58042 + 968` is what rung 9 looks like.
  assert.ok(high > 10_000, `rung 9 averaged only ${high.toFixed(0)}`)
})

test('maxDifficulty is a ceiling the stream never goes above', () => {
  const host = makeStubHost({ seed: 11 })
  for (let i = 0; i < 300; i++) {
    const q = host.next({ difficulty: 9, maxDifficulty: 3 })
    assert.ok(q.difficulty <= 3, `served rung ${q.difficulty} under a ceiling of 3`)
  }
})

test('focus hands back a pooled question whose answer is wanted, when one exists', () => {
  const host = makeStubHost({ seed: 13 })
  // Read a pool's worth of answers, then ask for one of them by value.
  const seen: number[] = []
  const probe = makeStubHost({ seed: 13 })
  for (let i = 0; i < STUB_POOL; i++) seen.push(Number(probe.next({ difficulty: 3 }).answer))
  const wanted = seen.slice(4, 12)
  host.focus?.({ key: 1, wanted })
  let hits = 0
  for (let i = 0; i < wanted.length; i++) {
    if (wanted.includes(Number(host.next({ difficulty: 3 }).answer))) hits++
  }
  assert.ok(hits >= wanted.length - 1, `focus only landed ${hits}/${wanted.length} wanted answers`)
})

test('focus is best effort — a wanted set nothing can satisfy still serves a question', () => {
  const host = makeStubHost({ seed: 17 })
  host.focus?.({ key: 1, wanted: [999999983] })
  const q = host.next({ difficulty: 3 })
  assert.ok(Number(q.answer) > 0)
  assert.notEqual(q.id, '')
})

test('report and skip each close an item exactly once, and never both', () => {
  const reports: string[] = []
  const skips: string[] = []
  const host = makeStubHost({
    seed: 19,
    onReport: (r) => reports.push(r.questionId),
    onSkip: (id) => skips.push(id),
  })
  const a = host.next({ difficulty: 2 })
  const b = host.next({ difficulty: 2 })

  host.report({ questionId: a.id, correct: true, ms: 10, answered: a.answer })
  host.report({ questionId: a.id, correct: true, ms: 10, answered: a.answer })
  assert.deepEqual(reports, [a.id], 'a double report would inflate a child’s record')

  host.skip?.(b.id)
  host.skip?.(b.id)
  assert.deepEqual(skips, [b.id])

  // Skipping is final, and so is answering.
  host.report({ questionId: b.id, correct: false, ms: 1, answered: '0' })
  assert.deepEqual(reports, [a.id], 'an answer after a skip must not be recorded')
  host.skip?.(a.id)
  assert.deepEqual(skips, [b.id], 'a skip after an answer must not be recorded')

  // An id nobody served is dropped.
  host.report({ questionId: 'made-up', correct: true, ms: 1, answered: '1' })
  assert.deepEqual(reports, [a.id])
})

test('clampDifficulty survives everything a caller can get wrong', () => {
  assert.equal(clampDifficulty(NaN), 1)
  assert.equal(clampDifficulty(undefined), 1)
  assert.equal(clampDifficulty('nope'), 1)
  assert.equal(clampDifficulty(-40), 1)
  assert.equal(clampDifficulty(0.4), 1)
  assert.equal(clampDifficulty(40), 10)
  assert.equal(clampDifficulty(6), 6)
})
