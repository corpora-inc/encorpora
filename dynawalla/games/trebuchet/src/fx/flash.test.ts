/**
 * The photosensitivity budget is a safety property, so it is a test, not a habit.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { Flash } from './flash.ts'

test('no more than three bright events in any one second', () => {
  const f = new Flash()
  let allowed = 0
  for (let i = 0; i < 40; i++) {
    if (f.add(1, 0.2)) allowed++
    f.update(1 / 60)
  }
  // 40 frames at 60fps is 0.66 s
  assert.equal(allowed, Flash.MAX_PER_SEC)
})

test('the budget refills, it does not lock out forever', () => {
  const f = new Flash()
  for (let i = 0; i < 5; i++) f.add(1, 0.2)
  for (let i = 0; i < 70; i++) f.update(1 / 60)
  assert.equal(f.add(1, 0.2), true)
})

test('a strobe is impossible: every event lasts at least MIN_LIFE', () => {
  const f = new Flash()
  assert.ok(Flash.MIN_LIFE >= 0.1, 'anything under ~8 Hz is the danger band')
  f.add(1, 0.001)
  // it must still be alive after a couple of frames
  f.update(1 / 60)
  f.update(1 / 60)
  const calls = countFills(f, 800, 600)
  assert.ok(calls > 0, 'a sub-frame flash must be stretched, not dropped')
})

test('reduced motion scales brightness down and never up', () => {
  const f = new Flash()
  f.motion = 0.25
  f.add(1, 0.3)
  f.update(0.1)
  const a1 = peakAlpha(f)
  const g = new Flash()
  g.add(1, 0.3)
  g.update(0.1)
  const a2 = peakAlpha(g)
  assert.ok(a1 < a2)
})

test('total brightness is clamped no matter how much is stacked', () => {
  const f = new Flash()
  for (let i = 0; i < 3; i++) f.add(1, 0.3)
  f.update(0.05)
  assert.ok(peakAlpha(f) <= Flash.MAX_ALPHA + 1e-9)
})

/* --- a canvas stub good enough to observe what the compositor was asked to do --- */

type Rec = { alpha: number; fills: number }

function fakeCtx(rec: Rec): CanvasRenderingContext2D {
  const grad = { addColorStop(): void {} }
  const c = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    save(): void {},
    restore(): void {},
    createRadialGradient(): unknown {
      return grad
    },
    fillRect(): void {
      rec.fills++
      rec.alpha = Math.max(rec.alpha, (c as unknown as { globalAlpha: number }).globalAlpha)
    },
  }
  return c as unknown as CanvasRenderingContext2D
}

function peakAlpha(f: Flash): number {
  const rec: Rec = { alpha: 0, fills: 0 }
  f.draw(fakeCtx(rec), 800, 600, 'rgba(255,255,255,1)')
  return rec.alpha
}

function countFills(f: Flash, w: number, h: number): number {
  const rec: Rec = { alpha: 0, fills: 0 }
  f.draw(fakeCtx(rec), w, h, 'rgba(255,255,255,1)')
  return rec.fills
}
