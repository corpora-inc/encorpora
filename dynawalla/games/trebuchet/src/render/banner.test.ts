/**
 * The keep that lights up — the world half of the reveal, and the exact line
 * the audit found dead.
 *
 * `drawTower` took a `reveal` flag and spent it on one expression:
 *
 *     ctx.fillStyle = reveal && !showBanner ? C.bannerWanted : C.banner
 *
 * `waveConfig` sets `banners: true` for waves 1 to 8, so `showBanner` was true
 * for a child's whole first session and `reveal` could not change a single
 * pixel. The reveal drew the same banner, in the same colour, in the same
 * place. Nothing here mocks the drawing: it records every style the real
 * function sets and compares the two calls.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { drawTower } from './pieces.ts'
import { C } from './theme.ts'
import { buildTower, type Tower } from '../sim/world.ts'
import { makeRng } from '../core/rng.ts'

/** A 2D context that records every fill and stroke style it is given. */
function recordingCtx(): { ctx: CanvasRenderingContext2D; fills: string[]; strokes: string[] } {
  const fills: string[] = []
  const strokes: string[] = []
  const state: Record<string, unknown> = {}
  const ctx = new Proxy(state, {
    get: (t, prop: string) => {
      if (prop === 'measureText') return () => ({ width: 8 })
      if (prop in t) return t[prop]
      return () => undefined
    },
    set: (t, prop: string, value) => {
      t[prop] = value
      if (prop === 'fillStyle' && typeof value === 'string') fills.push(value)
      if (prop === 'strokeStyle' && typeof value === 'string') strokes.push(value)
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, fills, strokes }
}

function keep(): Tower {
  const t = buildTower(0, 56, makeRng(1))
  t.reveal = 1 // fully faded in
  return t
}

test('a lit keep looks different from an unlit one EVEN WHERE THE BANNER IS ALREADY UP', () => {
  // Waves 1 to 8. The whole defect.
  const plain = recordingCtx()
  drawTower(plain.ctx, 20, keep(), true, false, 0)
  const lit = recordingCtx()
  drawTower(lit.ctx, 20, keep(), true, true, 0)

  assert.ok(plain.fills.includes(C.banner), 'the ordinary banner is not drawn in the banner colour')
  assert.ok(lit.fills.includes(C.bannerWanted), 'a lit keep on wave 1 is drawn in the ordinary banner colour')
  assert.ok(!lit.fills.includes(C.banner), 'the lit keep still paints the ordinary banner colour over itself')
  assert.ok(lit.strokes.includes(C.fire1), 'a lit keep has no accent on it')
  assert.ok(!plain.strokes.includes(C.fire1), 'an ordinary keep is already wearing the accent')
})

test('a lit keep is visible on the later waves too, where the banner is off', () => {
  // Waves 9 and up: `banners` is false, and the reveal is the only thing that
  // ever draws the number at all.
  const dark = recordingCtx()
  drawTower(dark.ctx, 20, keep(), false, false, 0)
  const lit = recordingCtx()
  drawTower(lit.ctx, 20, keep(), false, true, 0)
  assert.ok(!dark.fills.includes(C.bannerWanted) && !dark.fills.includes(C.banner), 'a banner was drawn with banners off')
  assert.ok(lit.fills.includes(C.bannerWanted), 'the reveal drew no banner with banners off')
})

test('a destroyed keep is never given a banner to wear', () => {
  const gone = keep()
  gone.alive = false
  const rec = recordingCtx()
  drawTower(rec.ctx, 20, gone, true, true, 0)
  assert.ok(!rec.fills.includes(C.bannerWanted), 'a levelled keep still flies a banner')
})
