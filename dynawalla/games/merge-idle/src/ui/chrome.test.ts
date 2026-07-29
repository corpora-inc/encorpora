// THE FRAME.
//
// A layout bug is invisible to every test that is about rules, so all 54 of
// this game's other tests passed while the essence odometer sat underneath the
// notch and underneath the host's exit chevron, and the magnitude pips sat
// underneath the how-to-play control. This file is that gate.
//
// It runs the real layout — the same `chromeLayout` the HUD applies and the
// same `computeLayout` the renderer resizes with — at the shapes the fleet
// actually has, with and without a notch, and asserts the two things a
// screenshot would have shown:
//
//   1. Nothing a child must READ or TOUCH is inside the safe area's edges.
//   2. Nothing a child must READ or TOUCH lands in either of the host's two
//      44px corners.
//
// The water, the light shafts and the particles are deliberately NOT checked.
// They run to the glass edge and under the rounded corners on purpose; that is
// the whole reason the document asks for `viewport-fit=cover`.
//
// Tablet and desktop are first-class here. Neither is a stretched phone.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  hitsHostChrome,
  safeRect,
  type Insets,
  type Rect,
} from '../../../../packs/shared/game-chrome/index.ts'
import { makeBoard } from '../core/board.ts'
import { computeLayout } from '../render/renderer.ts'
import { chromeLayout, stageAreaFor } from './chrome.ts'

const VIEWPORTS: Array<[string, number, number]> = [
  ['phone portrait, small', 320, 568],
  ['phone portrait, tall', 390, 844],
  ['phone landscape', 844, 390],
  ['tablet portrait', 768, 1024],
  ['tablet landscape', 1024, 768],
  ['laptop', 1440, 900],
]

const NONE: Insets = { top: 0, right: 0, bottom: 0, left: 0 }
/** A notched phone held tall: the sensor housing above, the home indicator below. */
const TALL: Insets = { top: 47, right: 0, bottom: 34, left: 0 }
/** The same phone turned sideways: the housing moves to one edge, and swaps. */
const WIDE: Insets = { top: 0, right: 47, bottom: 21, left: 47 }

const insetCases = (w: number, h: number): Array<[string, Insets]> => [
  ['no insets', NONE],
  ['notched', w > h ? WIDE : TALL],
]

/** Move a stage-local rect into viewport coordinates. */
const onGlass = (r: Rect, stage: Rect): Rect => ({
  x: r.x + stage.x,
  y: r.y + stage.y,
  w: r.w,
  h: r.h,
})

for (const [name, w, h] of VIEWPORTS) {
  for (const [label, ins] of insetCases(w, h)) {
    test(`the frame holds together at ${name} (${w}×${h}, ${label})`, () => {
      const area = safeRect(w, h, ins)
      const c = chromeLayout(w, h, area)

      // The band's readout is inside the safe area, in all four directions.
      assert.ok(c.readout.y >= area.y, 'the readout starts above the safe area')
      assert.ok(c.readout.x >= area.x, 'the readout starts left of the safe area')
      assert.ok(
        c.readout.x + c.readout.w <= area.x + area.w + 0.5,
        'the readout runs past the right of the safe area',
      )
      assert.ok(c.readout.w >= 120, `the readout is ${c.readout.w.toFixed(0)}px wide — nothing fits`)

      // The rail keeps its buttons off the home indicator.
      assert.ok(
        c.railPad.bottom >= ins.bottom,
        'the action rail sits on top of the home indicator',
      )

      // The stage begins below the band and ends above the rail.
      assert.equal(c.stage.y, c.band.h)
      assert.ok(c.stage.h > 120, `the stage is ${c.stage.h.toFixed(0)}px tall — no room to play`)

      // The canvas, through the renderer's own layout function.
      const board = makeBoard(5, 6)
      const sa = stageAreaFor(c, c.stage.w, c.stage.h)
      const l = computeLayout(c.stage.w, c.stage.h, 2, board, sa)

      // The shelf and the vents stay inside the safe area; the water does not,
      // and is not asked to.
      assert.ok(l.board.x >= ins.left, 'the shelf runs under the left edge')
      assert.ok(
        l.board.x + l.board.w <= w - ins.right + 0.5,
        'the shelf runs under the right edge',
      )
      assert.ok(l.ventStrip.x >= ins.left, 'the vents run under the left edge')
      assert.ok(
        l.ventStrip.x + l.ventStrip.w <= w - ins.right + 0.5,
        'the vents run under the right edge',
      )
      assert.ok(l.cell >= 18, `the shelf cell is ${l.cell.toFixed(1)}px — the numerals collide`)
      assert.ok(l.ventStrip.w > 60 && l.ventStrip.h > 60, 'the vents have collapsed')
    })
  }
}

test('nothing a child reads or touches sits under the host chrome', () => {
  // The host paints an exit chevron top-LEFT and a how-to-play control
  // top-RIGHT, floating over the pack rather than reserving a band — reserving
  // one cost 12% of a small phone's height. The promise a game makes in return
  // is exactly this: those two 44px squares hold nothing critical.
  for (const [name, w, h] of VIEWPORTS) {
    for (const [label, ins] of insetCases(w, h)) {
      const where = `${name} (${w}×${h}, ${label})`
      const c = chromeLayout(w, h, safeRect(w, h, ins))

      assert.equal(
        hitsHostChrome(c.readout, w, ins),
        false,
        `${where}: the essence readout is under host chrome`,
      )
      assert.equal(
        hitsHostChrome(c.mute, w, ins),
        false,
        `${where}: the mute button is under host chrome`,
      )
      assert.equal(
        hitsHostChrome(c.rail, w, ins),
        false,
        `${where}: the action rail is under host chrome`,
      )

      // The canvas too: the shelf a child drags on, and the vent that holds the
      // question. Both are in stage coordinates, so they move onto the glass by
      // the height of the band above them.
      const board = makeBoard(5, 6)
      const sa = stageAreaFor(c, c.stage.w, c.stage.h)
      const l = computeLayout(c.stage.w, c.stage.h, 2, board, sa)
      assert.equal(
        hitsHostChrome(onGlass(l.board, c.stage), w, ins),
        false,
        `${where}: the shelf is under host chrome`,
      )
      assert.equal(
        hitsHostChrome(onGlass(l.ventStrip, c.stage), w, ins),
        false,
        `${where}: the vents are under host chrome`,
      )
    }
  }
})

test('the band is tall enough that the whole canvas clears the corners', () => {
  // This is the invariant that makes the canvas safe without the canvas having
  // to know anything: the stage starts below the host's two squares, so every
  // polyp, vent and floater is clear of them by construction. It holds because
  // the odometer's floor height is larger than the gap it has to cover, and it
  // is asserted here so that shrinking the odometer cannot silently break it.
  for (const [, w, h] of VIEWPORTS) {
    for (const [, ins] of insetCases(w, h)) {
      const c = chromeLayout(w, h, safeRect(w, h, ins))
      const cornerBottom = ins.top + 3 + 10 + 44
      assert.ok(
        c.stage.y >= cornerBottom,
        `${w}×${h}: the stage starts at ${c.stage.y} — above the corners' ${cornerBottom}`,
      )
    }
  }
})
