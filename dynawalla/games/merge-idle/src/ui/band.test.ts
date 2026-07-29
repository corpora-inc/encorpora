// THE TOP BAR, AND THE RAIL THAT MOVES THE REEF.
//
// Two device photos, one root cause each.
//
// 1. The essence readout rendered as a giant `K` with a stray `.` in front of
//    it, the rate line `▲ 899 / sec` wrapped onto two rows inside a one-row
//    box, the `×2.5 FLOW` pill sat on top of the number, and one orphan dot
//    hung under the right end of the magnitude meter. All four are the same
//    thing: the band's contents were sized against the WHOLE band while
//    actually living in a fraction of it.
//
//    The `.K` in particular is worth naming. An odometer digit column is
//    `overflow:hidden`, and a flex item with `overflow` other than `visible`
//    has an automatic minimum size of ZERO. So when the odometer outgrew its
//    column the digits shrank away to nothing while the `.` and the `K` —
//    which are not `overflow:hidden`, and so are floored at their content —
//    stayed. The child was shown the punctuation of their score and none of
//    the number.
//
// 2. DISSOLVE appears only when the shelf fills, and a `display:none` button
//    takes no grid cell. Four buttons made two rows; five made three; the rail
//    grew, the stage shrank and the entire reef jumped upward mid-play.
//
// The rule behind (2) is general and is the one worth keeping: A CONTROL
// APPEARING MUST NEVER REFLOW THE PLAYFIELD.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { safeRect, type Insets } from '../../../../packs/shared/game-chrome/index.ts'
import { makeBoard } from '../core/board.ts'
import { fmtCompact } from '../core/ladder.ts'
import { computeLayout } from '../render/renderer.ts'
import { actionList, type ActionInput } from './actions.ts'
import {
  chromeLayout,
  ODO_MAX_EM,
  odoWidth,
  railButtonText,
  railHeight,
  RAIL_SLOTS,
  stageAreaFor,
} from './chrome.ts'

const VIEWPORTS: Array<[string, number, number]> = [
  ['phone portrait, small', 320, 568],
  ['phone portrait, tall', 390, 844],
  ['phone portrait, android', 360, 780],
  ['phone landscape', 844, 390],
  ['tablet portrait', 768, 1024],
  ['tablet landscape', 1024, 768],
  ['laptop', 1440, 900],
]

const NONE: Insets = { top: 0, right: 0, bottom: 0, left: 0 }
const TALL: Insets = { top: 47, right: 0, bottom: 34, left: 0 }
const WIDE: Insets = { top: 0, right: 47, bottom: 21, left: 47 }
const insetCases = (w: number, h: number): Array<[string, Insets]> => [
  ['no insets', NONE],
  ['notched', w > h ? WIDE : TALL],
]

/* ----------------------------------------------------- 1. the essence number */

/**
 * What the right-hand column has to hold, measured here rather than imported,
 * so that shrinking the reservation in `chrome.ts` fails this file instead of
 * silently agreeing with it.
 *
 *   `×9.9 FLOW` — nine characters at 10px and a 900 weight, plus 7px of
 *   padding and a 1px border on each side.
 *   one row of the magnitude meter — six 7px pips with 3px between them.
 */
const FLOW_NEEDS = 9 * 0.62 * 10 + 16
const PIP_ROW_NEEDS = 6 * 7 + 5 * 3

test('the essence number always fits its box', () => {
  for (const [name, w, h] of VIEWPORTS) {
    for (const [label, ins] of insetCases(w, h)) {
      const c = chromeLayout(w, h, safeRect(w, h, ins))
      const where = `${name} (${w}×${h}, ${label})`

      // The FLOW pill and the meter get a column of their OWN. They used to be
      // laid on top of the number's row and against a percentage max-width,
      // which is how the pill ended up over the value and the twelfth pip
      // ended up orphaned on a second row.
      assert.ok(
        c.side.w >= FLOW_NEEDS,
        `${where}: the FLOW column is ${c.side.w.toFixed(0)}px and the pill needs ` +
          `${FLOW_NEEDS.toFixed(0)}px — it will sit on the number`,
      )
      assert.ok(
        c.side.w >= PIP_ROW_NEEDS,
        `${where}: the meter column is ${c.side.w.toFixed(0)}px and a row of pips needs ` +
          `${PIP_ROW_NEEDS}px — a pip wraps and hangs on its own`,
      )
      // ...and the two columns and the gap between them fit the readout.
      assert.ok(
        c.essence.x + c.essence.w <= c.side.x + 0.5,
        `${where}: the number runs under the FLOW pill`,
      )
      assert.ok(
        c.side.x + c.side.w <= c.readout.x + c.readout.w + 0.5,
        `${where}: the FLOW pill and meter run past the readout`,
      )
      // The odometer is sized so its WIDEST possible string fits the column it
      // is actually in — not the whole band, which is what it used to be sized
      // against.
      assert.ok(
        c.odoPx * ODO_MAX_EM <= c.essence.w + 0.5,
        `${where}: the odometer needs ${(c.odoPx * ODO_MAX_EM).toFixed(0)}px ` +
          `and its column is ${c.essence.w.toFixed(0)}px — the digits get clipped`,
      )
      assert.ok(c.odoPx >= 22, `${where}: the odometer is ${c.odoPx}px — too small to read`)
    }
  }
})

test('the number fits at every width the pack can be given, not just fleet ones', () => {
  // iPadOS resizes a pack continuously in Split View, and this file's own
  // premise is that a layout is only correct if it is correct at every shape.
  // A sweep also catches the widths BETWEEN the fleet's, which is where sizing
  // the odometer against the whole band went wrong first.
  for (let w = 240; w <= 1440; w += 4) {
    const h = w < 620 ? 640 : 900
    const c = chromeLayout(w, h, safeRect(w, h, NONE))
    assert.ok(
      c.odoPx * ODO_MAX_EM <= c.essence.w + 0.5,
      `${w}px wide: the odometer needs ${(c.odoPx * ODO_MAX_EM).toFixed(0)}px in a ` +
        `${c.essence.w.toFixed(0)}px column — the score gets clipped down to its punctuation`,
    )
  }
})

test('every number the game can actually produce fits', () => {
  // Not "assume five digits". Walk the formatter across the whole range an
  // idle game reaches — the reef compounds, and the string changes SHAPE at
  // 100,000 when `fmtCompact` switches from `99,999` to `123.4K`.
  const values: number[] = [0, 7, 99, 100, 1000, 12_345, 99_999, 100_000]
  for (let e = 5; e <= 21; e++) {
    values.push(10 ** e, 9.99 * 10 ** e, 1.234 * 10 ** e)
  }
  for (const [name, w, h] of VIEWPORTS) {
    for (const [label, ins] of insetCases(w, h)) {
      const c = chromeLayout(w, h, safeRect(w, h, ins))
      for (const v of values) {
        const text = fmtCompact(v)
        const px = odoWidth(text, c.odoPx)
        assert.ok(
          px <= c.essence.w + 0.5,
          `${name} (${w}×${h}, ${label}): "${text}" needs ${px.toFixed(0)}px ` +
            `in a ${c.essence.w.toFixed(0)}px column — the child cannot read their score`,
        )
      }
    }
  }
})

test('the rate line cannot wrap, and the FLOW pill is not on it', () => {
  // `▲ 899 / sec` broke onto two lines because it shared its row with the FLOW
  // pill. FLOW now lives in the right-hand column, and the rate is sized so the
  // longest string the game emits fits on one line.
  const LONGEST = '▲ 999.9Qi / sec'.length
  // A deliberately fat advance for a 800-weight sans; the real font is
  // narrower, so passing here is conservative.
  const EM = 0.66
  for (const [name, w, h] of VIEWPORTS) {
    for (const [label, ins] of insetCases(w, h)) {
      const c = chromeLayout(w, h, safeRect(w, h, ins))
      assert.ok(
        LONGEST * EM * c.ratePx <= c.essence.w + 0.5,
        `${name} (${w}×${h}, ${label}): the rate needs ` +
          `${(LONGEST * EM * c.ratePx).toFixed(0)}px in a ${c.essence.w.toFixed(0)}px column`,
      )
      assert.ok(c.ratePx >= 9, `${name}: the rate is ${c.ratePx}px — unreadable`)
    }
  }
})

test('the band height does not depend on the number in it', () => {
  // The header must not grow as the reef does. Everything with a variable
  // width is on a fixed line box, so the only inputs to the band's height are
  // the viewport and the insets.
  for (const [, w, h] of VIEWPORTS) {
    for (const [, ins] of insetCases(w, h)) {
      const a = chromeLayout(w, h, safeRect(w, h, ins))
      const b = chromeLayout(w, h, safeRect(w, h, ins))
      assert.equal(a.band.h, b.band.h)
      assert.equal(a.stage.y, b.stage.y)
    }
  }
})

/* ------------------------------------------------------ 2. the reflowing rail */

const REEF: ActionInput = {
  essence: 5000,
  upwells: 1,
  grows: 1,
  overcharges: 0,
  vents: 2,
  ventCap: 3,
  cols: 5,
  rows: 6,
  maxCols: 7,
  maxRows: 9,
  full: false,
  crowded: false,
}

test('no reef state changes how many buttons the rail shows', () => {
  const counts = new Set<number>()
  for (const full of [false, true]) {
    for (const crowded of [false, true]) {
      for (const essence of [0, 5000, 1e9]) {
        for (const vents of [1, 3]) {
          const visible = actionList({ ...REEF, full, crowded, essence, vents }).filter(
            (a) => a.visible,
          )
          counts.add(visible.length)
        }
      }
    }
  }
  assert.deepEqual(
    [...counts],
    [RAIL_SLOTS],
    `the rail shows ${[...counts].join(' or ')} buttons depending on state — ` +
      'whichever count changes, the rail reflows and the reef jumps',
  )
})

test('DISSOLVE is present before it is usable, and enabled when it is', () => {
  const locked = actionList(REEF).find((a) => a.id === 'purge')
  const live = actionList({ ...REEF, full: true }).find((a) => a.id === 'purge')
  assert.equal(locked?.visible, true, 'DISSOLVE is hidden until the shelf fills — it will reflow')
  assert.equal(locked?.enabled, false, 'DISSOLVE is pressable when there is nothing to dissolve')
  assert.equal(live?.enabled, true, 'DISSOLVE does not light up when the shelf is full')
})

test('the longest button label still fits a three-across rail', () => {
  // Three columns instead of two is what keeps five buttons in two rows. The
  // buttons are narrower for it, and the labels are `nowrap` with a fixed
  // button height — so a label that did not fit would be CLIPPED rather than
  // wrapped, which would be silent. This is the guard.
  //
  // Honest about what it is: a character-advance model, not a measurement. The
  // 0.72em advance is deliberately fatter than a 900-weight rounded sans
  // actually sets, so passing here leaves room. It cannot replace looking at a
  // device, and it does catch the label growing or the rail narrowing.
  const LONGEST = 'OVERCHARGE'.length
  const EM = 0.72
  for (const [name, w, h] of VIEWPORTS) {
    for (const [label, ins] of insetCases(w, h)) {
      const c = chromeLayout(w, h, safeRect(w, h, ins))
      const px = c.w >= 620 ? 11 : 10 // `.ab-btn .n`, both sides of the media query
      const need = LONGEST * EM * px
      assert.ok(
        need <= railButtonText(c),
        `${name} (${w}×${h}, ${label}): OVERCHARGE needs ~${need.toFixed(0)}px and the ` +
          `button gives ${railButtonText(c).toFixed(0)}px`,
      )
    }
  }
})

test('the shelf does not move when DISSOLVE appears', () => {
  // The assertion the founder's video would have made: lay the reef out with
  // four buttons in the rail and with five, and compare the shelf.
  for (const [name, w, h] of VIEWPORTS) {
    for (const [label, ins] of insetCases(w, h)) {
      const c = chromeLayout(w, h, safeRect(w, h, ins))
      const board = makeBoard(5, 6)

      const shelfWith = (buttons: number) => {
        const stageH = Math.max(1, h - c.band.h - railHeight(w, h, ins.bottom, buttons))
        const stage = { ...c, stage: { x: 0, y: c.band.h, w, h: stageH } }
        return computeLayout(w, stageH, 2, board, stageAreaFor(stage, w, stageH))
      }

      const before = shelfWith(RAIL_SLOTS - 1)
      const after = shelfWith(RAIL_SLOTS)
      assert.deepEqual(
        { x: before.originX, y: before.originY, cell: before.cell },
        { x: after.originX, y: after.originY, cell: after.cell },
        `${name} (${w}×${h}, ${label}): a button appearing moves the shelf by ` +
          `${(after.originY - before.originY).toFixed(1)}px and resizes every polyp from ` +
          `${before.cell.toFixed(1)}px to ${after.cell.toFixed(1)}px`,
      )
    }
  }
})
