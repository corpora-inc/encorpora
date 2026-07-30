// THE SHELF AND THE MOUTH ARE TWO PLACES, NOT ONE PLACE TWICE.
//
// From a device photo of the previous build: the four vent number-pills were
// painted along the bottom edge of the reef, over the last row of polyps, whose
// digits a child then could not read or aim a drag at. The founder asked the right
// question — "shouldn't the pill numbers be under the polyps horizontally rather
// than over them in Z?" — and the answer is that this was a layout bug, not a
// paint-order one: the strip drew AFTER the polyps with a 0.95-alpha body, so
// whatever it overlapped it erased.
//
// What was wrong: `computeLayout` sized the grid as if a polyp were exactly its
// cell. A polyp sprite is SPRITE_SCALE — 1.62 — cells across, centred on the cell,
// so it reaches POLYP_BLEED (0.31) of a cell past the cell box on every side, and
// the rock under it reaches further still. The clearance left was a single `pad`,
// 8 to 22px, which is smaller than that at every portrait size the fleet has.
//
// There is one mouth now instead of up to five vents, and it is a DROP TARGET, so
// this file asserts three things at every shape the fleet has and every shelf the
// reef can grow into: the polyps as DRAWN and the mouth as DRAWN are disjoint, the
// mouth is big enough to hit, and the mouth does not reach the two stage buttons.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { type Insets, type Rect } from '../../../../packs/shared/game-chrome/index.ts'
import { makeBoard } from '../core/board.ts'
import { START_COLS, START_ROWS } from '../core/engine.ts'
import { chromeLayout, MOUTH_END_PAD, stageAreaFor, STAGE_BTN } from '../ui/chrome.ts'
import {
  computeLayout,
  fedSlotRect,
  LEGIBLE_CELL,
  MOUTH_MIN,
  mouthRect,
  shelfCap,
  totalRect,
} from './renderer.ts'

const NONE: Insets = { top: 0, right: 0, bottom: 0, left: 0 }
const TALL: Insets = { top: 47, right: 0, bottom: 34, left: 0 }
const WIDE: Insets = { top: 0, right: 47, bottom: 21, left: 47 }

const VIEWPORTS: Array<[string, number, number]> = [
  ['phone portrait, small', 320, 568],
  ['phone portrait, tall', 390, 844],
  ['phone portrait, android', 360, 780],
  ['phone landscape', 844, 390],
  ['phone landscape, small', 568, 320],
  ['phone landscape, android', 780, 360],
  ['tablet portrait', 768, 1024],
  ['tablet landscape', 1024, 768],
  ['laptop', 1440, 900],
]

/**
 * Every shelf the reef can grow into. The starting board is bigger than the old
 * game's 5x6 — the founder asked for "more room for a bigger board", and deleting
 * the vent strip and the five-button rail is what paid for it.
 */
const SHELVES: Array<[number, number]> = [
  [START_COLS, START_ROWS],
  [7, 7],
  [7, 9],
  [8, 9],
  [9, 11],
]

const rectOf = (i: Insets, w: number, h: number): Rect => ({
  x: i.left,
  y: i.top,
  w: w - i.left - i.right,
  h: h - i.top - i.bottom,
})

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01

for (const [name, w, h] of VIEWPORTS) {
  for (const [label, inset] of [
    ['no insets', NONE],
    ['notch + home indicator', TALL],
    ['sensor housing, sideways', WIDE],
  ] as Array<[string, Insets]>) {
    const chrome = chromeLayout(w, h, rectOf(inset, w, h))
    const stageW = chrome.stage.w
    const stageH = chrome.stage.h
    const area = stageAreaFor(chrome, stageW, stageH)

    for (const [cols, rows] of SHELVES) {
      const l = computeLayout(stageW, stageH, 2, makeBoard(cols, rows), area, MOUTH_END_PAD)
      const m = mouthRect(l)

      test(`${name}, ${label}, ${cols}x${rows}: the drawn shelf never meets the mouth`, () => {
        assert.equal(
          overlaps(l.gridRect, m),
          false,
          `gridRect ${JSON.stringify(l.gridRect)} overlaps the mouth ${JSON.stringify(m)}`,
        )
      })

      test(`${name}, ${label}, ${cols}x${rows}: the mouth is a target a child can hit`, () => {
        assert.ok(m.w >= MOUTH_MIN, `the mouth is ${m.w.toFixed(1)}px wide`)
        assert.ok(m.h >= MOUTH_MIN, `the mouth is ${m.h.toFixed(1)}px tall`)
      })

      test(`${name}, ${label}, ${cols}x${rows}: neither the mouth nor the shelf covers a button`, () => {
        for (const btn of [chrome.dissolve, chrome.mute]) {
          const inStage: Rect = { x: btn.x, y: btn.y - chrome.stage.y, w: btn.w, h: btn.h }
          assert.equal(
            overlaps(m, inStage),
            false,
            `the mouth ${JSON.stringify(m)} covers a ${STAGE_BTN}px button at ${JSON.stringify(inStage)}`,
          )
          assert.equal(
            overlaps(l.gridRect, inStage),
            false,
            `the shelf ${JSON.stringify(l.gridRect)} covers a button at ${JSON.stringify(inStage)}`,
          )
        }
      })

      test(`${name}, ${label}, ${cols}x${rows}: every fed slot and the total stay inside the mouth`, () => {
        for (const slots of [1, 2, 3]) {
          for (let i = 0; i < slots; i++) {
            const box = fedSlotRect(m, i, slots)
            assert.ok(box.w > 0 && box.h > 0, `slot ${i}/${slots} is ${box.w}x${box.h}`)
            assert.ok(box.x >= m.x - 0.01 && box.x + box.w <= m.x + m.w + 0.01, `slot ${i} leaves the mouth`)
            assert.ok(box.y >= m.y - 0.01 && box.y + box.h <= m.y + m.h + 0.01)
          }
        }
        const tot = totalRect(m)
        assert.ok(tot.w > 0 && tot.h > 0)
        assert.ok(tot.x + tot.w <= m.x + m.w + 0.01)
        // The slots and the total must not draw on top of each other.
        assert.equal(overlaps(fedSlotRect(m, 2, 3), tot), false, 'the last slot runs into the total')
      })

      test(`${name}, ${label}, ${cols}x${rows}: the shelf and the mouth stay inside the safe area`, () => {
        const right = area.x + area.w
        assert.ok(l.gridRect.x >= area.x - 0.01, 'the shelf runs under the left inset')
        assert.ok(l.gridRect.x + l.gridRect.w <= right + 0.01, 'the shelf runs under the right inset')
        assert.ok(m.x >= area.x - 0.01, 'the mouth runs under the left inset')
        assert.ok(m.x + m.w <= right + 0.01, 'the mouth runs under the right inset')
        assert.ok(m.y + m.h <= area.y + area.h + 0.01, 'the mouth runs under the home indicator')
      })
    }

    test(`${name}, ${label}: the starting shelf is drawn at a legible cell`, () => {
      const l = computeLayout(stageW, stageH, 2, makeBoard(START_COLS, START_ROWS), area, MOUTH_END_PAD)
      assert.ok(l.cell >= LEGIBLE_CELL, `the starting cell is ${l.cell.toFixed(1)}px`)
    })

    test(`${name}, ${label}: growth is capped at what this glass can draw legibly`, () => {
      const l = computeLayout(stageW, stageH, 2, makeBoard(START_COLS, START_ROWS), area, MOUTH_END_PAD)
      const cap = shelfCap(l)
      const grown = makeBoard(Math.max(START_COLS, cap.cols), Math.max(START_ROWS, cap.rows))
      const g = computeLayout(stageW, stageH, 2, grown, area, MOUTH_END_PAD)
      assert.equal(overlaps(g.gridRect, mouthRect(g)), false, 'a shelf grown to the cap hits the mouth')
    })
  }
}

/**
 * Deleting the vent strip and the action rail was supposed to BUY board. This is the
 * receipt: the same phone, the same insets, and the shelf gets materially more room
 * than the old layout's 21%-of-stage vent strip plus a 62px rail left it.
 */
test('the mouth costs the shelf less than the old vent strip and rail did', () => {
  const w = 390
  const h = 844
  const chrome = chromeLayout(w, h, rectOf(TALL, w, h))
  const area = stageAreaFor(chrome, chrome.stage.w, chrome.stage.h)
  const l = computeLayout(chrome.stage.w, chrome.stage.h, 2, makeBoard(START_COLS, START_ROWS), area, MOUTH_END_PAD)
  const share = l.board.h / chrome.stage.h
  // The old layout: a 21%-of-stage vent strip, and a stage that was already 62px
  // shorter because the rail took it.
  assert.ok(share > 0.75, `the shelf only got ${(share * 100).toFixed(0)}% of the stage's height`)
  assert.ok(l.cell >= LEGIBLE_CELL + 6, `a 6x7 shelf on a tall phone should be roomy, got ${l.cell.toFixed(1)}px`)
})

test('landscape puts the mouth down the right and hands the width back to the shelf', () => {
  const w = 1024
  const h = 768
  const chrome = chromeLayout(w, h, rectOf(NONE, w, h))
  const area = stageAreaFor(chrome, chrome.stage.w, chrome.stage.h)
  const l = computeLayout(chrome.stage.w, chrome.stage.h, 2, makeBoard(8, 9), area, MOUTH_END_PAD)
  assert.equal(l.mouthColumn, true)
  const m = mouthRect(l)
  assert.ok(m.x > l.gridRect.x + l.gridRect.w, 'the mouth should be to the RIGHT of the shelf')
  assert.equal(overlaps(l.gridRect, m), false)
})
