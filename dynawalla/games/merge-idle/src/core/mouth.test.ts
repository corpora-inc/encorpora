/**
 * The mouth is where the two hardest promises in this game live:
 *
 *   * **No clock on the answer.** `docs/EXPERIENCE_DESIGN.md`: "COMPREHENSION —
 *     not budgeted. The child's time. Measured, never limited." Nothing in
 *     `core/mouth.ts` reads a clock, and retraction is free and unlimited.
 *   * **A wrong answer costs work, not dignity.** A spill hands the polyps back
 *     halved. Countable, visible, no buzzer, no life — and never lossy.
 */

import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { canSplit } from './ladder.ts'
import {
  emptyMouth,
  expression,
  feed,
  resolve,
  retract,
  running,
  spillInto,
} from './mouth.ts'

test('a sum blooms the instant it matches, with no commit and no button', () => {
  const m = emptyMouth(3)
  feed(m, 16)
  assert.equal(resolve(m, 'sum', 18).kind, 'open')
  feed(m, 2)
  const v = resolve(m, 'sum', 18)
  assert.equal(v.kind, 'bloom')
  assert.equal(v.kind === 'bloom' && v.answered, '18')
})

test('an overshoot resolves on the drop — trial and error cannot be free', () => {
  const m = emptyMouth(3)
  feed(m, 16)
  feed(m, 8)
  const v = resolve(m, 'sum', 18)
  assert.equal(v.kind, 'spill')
  assert.equal(v.kind === 'spill' && v.answered, '24')
})

test('a full mouth that is still short resolves too', () => {
  const m = emptyMouth(2)
  feed(m, 4)
  feed(m, 4)
  const v = resolve(m, 'sum', 18)
  assert.equal(v.kind, 'spill')
  assert.equal(v.kind === 'spill' && v.produced, 8)
})

test('a sum under the target with a slot left stays OPEN — nothing is decided for you', () => {
  const m = emptyMouth(3)
  feed(m, 4)
  feed(m, 4)
  assert.equal(resolve(m, 'sum', 18).kind, 'open')
})

test('the ordered forms decide nothing until both slots are filled', () => {
  for (const [form, a, b, target] of [
    ['minus', 16, 1, 15],
    ['times', 8, 6, 48],
    ['over', 30, 2, 15],
  ] as const) {
    const m = emptyMouth(2)
    feed(m, a)
    assert.equal(resolve(m, form, target).kind, 'open', `${form} decided on one polyp`)
    feed(m, b)
    assert.equal(resolve(m, form, target).kind, 'bloom', `${form} ${a} ${b} should be ${target}`)
  }
})

test('order matters for − and ÷, and getting it backwards is a spill not a rescue', () => {
  const m = emptyMouth(2)
  feed(m, 2)
  feed(m, 30)
  const v = resolve(m, 'over', 15)
  assert.equal(v.kind, 'spill')
  // 2 ÷ 30 is not a whole number, so what the child produced is the expression
  // itself. It is reported verbatim and the host judges it — never floored, and
  // never the empty string, which the host files as a MISS.
  assert.equal(v.kind === 'spill' && v.produced, null)
  assert.equal(v.kind === 'spill' && v.answered, '2 ÷ 30')
  assert.notEqual(v.kind === 'spill' && v.answered, '')
})

test('the reported answer is what the child produced, never the target', () => {
  const m = emptyMouth(2)
  feed(m, 16)
  feed(m, 5)
  const v = resolve(m, 'sum', 18)
  assert.equal(v.kind, 'spill')
  assert.equal(v.kind === 'spill' && v.answered, '21', 'the child made 21; that is what is reported')
})

/* ------------------------------------------------------------- no clock */

test('nothing in the mouth reads a clock', async () => {
  const src = await import('node:fs/promises').then((fs) =>
    fs.readFile(new URL('./mouth.ts', import.meta.url), 'utf8'),
  )
  for (const banned of ['Date.now', 'performance.now', 'setTimeout', 'setInterval']) {
    assert.equal(src.includes(banned), false, `core/mouth.ts must not use ${banned}`)
  }
})

test('retraction is free, unlimited, and puts the mouth back exactly as it was', () => {
  const m = emptyMouth(3)
  feed(m, 16)
  feed(m, 2)
  // Deliberately many times: a retraction budget would be a clock by another name.
  for (let i = 0; i < 50; i++) {
    assert.equal(retract(m, 1), 2)
    assert.equal(running(m, 'sum'), 16)
    feed(m, 2)
    assert.equal(running(m, 'sum'), 18)
  }
  assert.equal(retract(m, 9), null, 'a slot that is not there retracts nothing')
})

/* ---------------------------------------------------------------- the spill */

test('a spill hands every polyp back HALVED when there is room — that is the cost', () => {
  const m = emptyMouth(3)
  feed(m, 16)
  feed(m, 8)
  assert.deepEqual(spillInto(m, 10), [8, 8, 4, 4])
})

test('a spill never loses a polyp, at any amount of room', () => {
  for (let free = 0; free <= 8; free++) {
    const m = emptyMouth(3)
    feed(m, 16)
    feed(m, 8)
    feed(m, 30)
    const back = spillInto(m, free)
    const total = back.reduce((a, b) => a + b, 0)
    assert.equal(total, 16 + 8 + 30, `room=${free} lost value: got ${total}`)
    assert.ok(back.length >= 3, `room=${free} lost a polyp: ${back.join(',')}`)
    // Never more polyps than there are cells to seat them in. Below three cells
    // the state is unreachable — three polyps just left the shelf, so at least
    // three cells are free — but the arithmetic still may not overcommit.
    assert.ok(back.length <= Math.max(3, free), `room=${free} returned ${back.length} into ${free} cells`)
    if (free >= 3) {
      assert.ok(back.length <= free, `room=${free} returned ${back.length} polyps into ${free} cells`)
    }
  }
})

test('an unsplittable polyp comes back whole, and never as a fraction', () => {
  const m = emptyMouth(2)
  feed(m, 15)
  feed(m, 3)
  const back = spillInto(m, 10)
  assert.deepEqual(back, [15, 3])
  for (const v of back) assert.equal(canSplit(v) || Number.isInteger(v), true)
})

test('the expression a child reads shows the blanks that are still empty', () => {
  const m = emptyMouth(2)
  assert.equal(expression(m, 'over', '÷'), '▢ ÷ ▢')
  feed(m, 30)
  assert.equal(expression(m, 'over', '÷'), '30 ÷ ▢')
  feed(m, 2)
  assert.equal(expression(m, 'over', '÷'), '30 ÷ 2')
  // A sum shows only what is actually in there: its arity is a maximum, not a shape.
  const s = emptyMouth(3)
  feed(s, 16)
  assert.equal(expression(s, 'sum', '+'), '16')
})

test('the mouth refuses a polyp past its slots rather than silently dropping one', () => {
  const m = emptyMouth(2)
  feed(m, 1)
  feed(m, 1)
  feed(m, 1)
  assert.equal(m.fed.length, 2)
})
