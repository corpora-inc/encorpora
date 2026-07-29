// THE SHELF AND THE VENTS ARE TWO PLACES, NOT ONE PLACE TWICE.
//
// From a device photo: the four vent number-pills were painted along the bottom
// edge of the reef, over the last row of polyps, whose digits a child then
// could not read or aim a drag at. The founder asked the right question —
// "shouldn't the pill numbers be under the polyps horizontally rather than over
// them in Z?" — and the answer is that this is a layout bug, not a paint-order
// one. The vents draw AFTER the polyps, on the same canvas, with a 0.95-alpha
// chimney; whatever they overlap they erase. Restacking, dimming or shrinking
// the pills would all be ways of not fixing it.
//
// What was wrong: `computeLayout` sized the grid as if a polyp were exactly its
// cell. A polyp sprite is SPRITE_SCALE — 1.62 — cells across, centred on the
// cell, so it reaches POLYP_BLEED (0.31) of a cell past the cell box on every
// side. The clearance left between the grid's arithmetic bottom and the vent
// strip was a single `pad`, 8 to 22px, which is smaller than that bleed at
// every portrait size the fleet has.
//
// So this file asserts the thing the screenshot showed, at the shapes the fleet
// actually has, for every shelf the game can grow into and every vent count a
// screen can hold: the polyps as DRAWN and the vents as DRAWN are disjoint.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { safeRect, type Insets, type Rect } from '../../../../packs/shared/game-chrome/index.ts'
import { makeBoard } from '../core/board.ts'
import { chromeLayout, stageAreaFor } from '../ui/chrome.ts'
import { computeLayout, LEGIBLE_CELL, promptPlate, shelfCap, ventCap, ventRects } from './renderer.ts'

const NONE: Insets = { top: 0, right: 0, bottom: 0, left: 0 }
const TALL: Insets = { top: 47, right: 0, bottom: 34, left: 0 }
const WIDE: Insets = { top: 0, right: 47, bottom: 21, left: 47 }

const VIEWPORTS: Array<[string, number, number]> = [
  ['phone portrait, small', 320, 568],
  ['phone portrait, tall', 390, 844],
  // The founder's device: 1080x2340 physical, which is this in CSS px.
  ['phone portrait, android', 360, 780],
  ['phone landscape', 844, 390],
  // Every portrait shape turned sideways. A vent is a drop target, and it is
  // the SHORT landscape stage that squeezes the chimneys under 44px.
  ['phone landscape, small', 568, 320],
  ['phone landscape, android', 780, 360],
  ['tablet portrait', 768, 1024],
  ['tablet landscape', 1024, 768],
  ['laptop', 1440, 900],
]

/** Every shelf the game can grow into: 5x6 at the start, 7x9 at the ceiling. */
const SHELVES: Array<[number, number]> = [
  [5, 6],
  [6, 6],
  [5, 9],
  [6, 9],
  [7, 9],
]

const insetCases = (w: number, h: number): Array<[string, Insets]> => [
  ['no insets', NONE],
  ['notched', w > h ? WIDE : TALL],
]

/** The overlap of two rectangles, or null when they do not touch. */
function overlap(a: Rect, b: Rect): { w: number; h: number } | null {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return w > 0.001 && h > 0.001 ? { w, h } : null
}

const say = (r: Rect): string =>
  `[${r.x.toFixed(1)},${r.y.toFixed(1)} ${r.w.toFixed(1)}x${r.h.toFixed(1)}]`

for (const [name, w, h] of VIEWPORTS) {
  for (const [label, ins] of insetCases(w, h)) {
    for (const [cols, rows] of SHELVES) {
      test(`the vents never touch the shelf at ${name} (${w}×${h}, ${label}, ${cols}×${rows})`, () => {
        const c = chromeLayout(w, h, safeRect(w, h, ins))
        const b = makeBoard(cols, rows)
        const l = computeLayout(c.stage.w, c.stage.h, 2, b, stageAreaFor(c, c.stage.w, c.stage.h))
        const vents = ventRects(l, ventCap(l))

        for (let i = 0; i < vents.length; i++) {
          const v = vents[i]
          if (!v) continue
          // The chimney: opaque, drawn last, and therefore the thing that
          // actually erased the polyps.
          const onVent = overlap(l.gridRect, v)
          assert.equal(
            onVent,
            null,
            `vent ${i} ${say(v)} covers the shelf ${say(l.gridRect)} by ` +
              `${onVent?.w.toFixed(1)}x${onVent?.h.toFixed(1)}px — a child cannot read the bottom row`,
          )
          // And the number plate on it: the pill the founder photographed.
          const onPill = overlap(l.gridRect, promptPlate(v))
          assert.equal(
            onPill,
            null,
            `the number pill on vent ${i} sits over the shelf by ` +
              `${onPill?.w.toFixed(1)}x${onPill?.h.toFixed(1)}px`,
          )
        }

        // A vent is a DROP target — a polyp dragged anywhere onto a chimney is
        // fed to it — so the chimney, not the little pill, is what has to clear
        // the platform's 44px minimum. (The pill is a label; nothing is bound
        // to it.) The axis that matters is the one the vents stack along.
        for (const v of vents) {
          assert.ok(
            v.w >= 44 && v.h >= 44,
            `a vent is ${v.w.toFixed(0)}x${v.h.toFixed(0)}px — under the 44px touch minimum`,
          )
        }

        // The shelf must still be worth playing on after the band is reserved:
        // below LEGIBLE_CELL the numerals on the polyps collide. Only shelves
        // the game will actually grow into are held to it — an oversized shelf
        // carried in from a tablet save has to shrink, and shrinking is what
        // `computeLayout` now does instead of overrunning the vents.
        const cap = shelfCap(l)
        if (cols <= cap.cols && rows <= cap.rows) {
          assert.ok(
            l.cell >= LEGIBLE_CELL,
            `the cell is ${l.cell.toFixed(1)}px — the numerals on the polyps collide`,
          )
        }
        // And the drawn shelf has to stay inside the region it was given, or
        // "disjoint from the vents" is true only by luck.
        assert.ok(
          l.gridRect.x >= l.board.x - 0.5 &&
            l.gridRect.y >= l.board.y - 0.5 &&
            l.gridRect.x + l.gridRect.w <= l.board.x + l.board.w + 0.5 &&
            l.gridRect.y + l.gridRect.h <= l.board.y + l.board.h + 0.5,
          `the drawn shelf ${say(l.gridRect)} spills out of its region ${say(l.board)}`,
        )
      })
    }
  }
}

test('DEEPEN is never allowed to grow a shelf this glass cannot draw', () => {
  // The other half of the fix: `computeLayout` shrinks a shelf that does not
  // fit rather than overrunning the vents with it, and `shelfCap` stops the
  // game ever CHOOSING one. Every shelf the cap admits must be legible.
  for (const [name, w, h] of VIEWPORTS) {
    for (const [label, ins] of insetCases(w, h)) {
      const c = chromeLayout(w, h, safeRect(w, h, ins))
      const probe = computeLayout(c.stage.w, c.stage.h, 2, makeBoard(5, 6), stageAreaFor(c, c.stage.w, c.stage.h))
      const cap = shelfCap(probe)
      assert.ok(cap.cols >= 5 && cap.rows >= 6, `${name} ${label}: cannot even hold the starting 5×6 shelf`)
      const at = computeLayout(
        c.stage.w,
        c.stage.h,
        2,
        makeBoard(Math.min(7, cap.cols), Math.min(9, cap.rows)),
        stageAreaFor(c, c.stage.w, c.stage.h),
      )
      assert.ok(
        at.cell >= LEGIBLE_CELL,
        `${name} ${label}: the cap admits a ${cap.cols}×${cap.rows} shelf whose cell is ${at.cell.toFixed(1)}px`,
      )
    }
  }
})

test('the vent band is a band: it is below the shelf in portrait, beside it in landscape', () => {
  // The regions are disjoint by CONSTRUCTION — the vents are placed first and
  // the shelf gets the remainder — so this also documents which way round.
  for (const [name, w, h] of VIEWPORTS) {
    const c = chromeLayout(w, h, safeRect(w, h, NONE))
    const l = computeLayout(c.stage.w, c.stage.h, 2, makeBoard(5, 6), stageAreaFor(c, c.stage.w, c.stage.h))
    if (l.ventColumn) {
      assert.ok(
        l.board.x + l.board.w <= l.ventStrip.x,
        `${name}: the shelf runs into the vent column`,
      )
    } else {
      assert.ok(
        l.board.y + l.board.h <= l.ventStrip.y,
        `${name}: the shelf runs into the vent band`,
      )
    }
  }
})
