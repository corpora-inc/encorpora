/**
 * THE TARGET IS THE ONE THING A CHILD MUST READ, AND IT MUST NOT BE UNDER A BUTTON.
 *
 * The host floats an exit chevron over the top-left 44px and a how-to-play control
 * over the top-right 44px, and asks each game to keep those two squares clear of
 * anything readable or tappable. `viewport-fit=cover` opts this document into the
 * notch as well. Every number in `ui/chrome.ts` is arithmetic on a safe rectangle
 * passed in as an argument — **`env(safe-area-inset-*)` is never read, because it is
 * zero inside a sandboxed pack frame and four games in this fleet shipped with a HUD
 * under the notch because of it** — so all of it is checkable here, in node, at every
 * viewport the fleet has.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { hitsHostChrome, type Insets, type Rect } from '../../../../packs/shared/game-chrome/index.ts'
import { faceOf, FORMS } from '../core/target.ts'
import {
  chromeLayout,
  faceEm,
  faceSizeFor,
  insetsOf,
  METER_H,
  isMouthColumn,
  MOUTH_END_PAD,
  STAGE_BTN,
  stageAreaFor,
  WIDEST_FACE,
} from './chrome.ts'

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

const insetCases = (): Array<[string, Insets]> => [
  ['no insets', NONE],
  ['notch + home indicator', TALL],
  ['sensor housing, sideways', WIDE],
]

const rectOf = (i: Insets, w: number, h: number): Rect => ({
  x: i.left,
  y: i.top,
  w: w - i.left - i.right,
  h: h - i.top - i.bottom,
})

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** Every face the game can ever draw, at a size that makes the width worst-case. */
const FACES = [
  '1',
  '18',
  '999',
  '1,024',
  '999,999',
  ...FORMS.filter((f) => f !== 'sum').map((f) => faceOf(999999, f)),
  ...FORMS.filter((f) => f !== 'sum').map((f) => faceOf(15, f)),
]

for (const [name, w, h] of VIEWPORTS) {
  for (const [label, inset] of insetCases()) {
    const c = chromeLayout(w, h, rectOf(inset, w, h))

    test(`${name}, ${label}: the target clears both host corners`, () => {
      assert.equal(
        hitsHostChrome(c.readout, w, inset),
        false,
        `readout ${JSON.stringify(c.readout)} collides with host chrome`,
      )
      assert.equal(hitsHostChrome(c.face, w, inset), false)
      assert.equal(hitsHostChrome(c.meter, w, inset), false)
    })

    test(`${name}, ${label}: both stage buttons are 44px, on screen, and clear of the host`, () => {
      for (const [what, r] of [
        ['dissolve', c.dissolve],
        ['mute', c.mute],
      ] as const) {
        assert.equal(r.w, STAGE_BTN, `${what} is ${r.w}px wide`)
        assert.equal(r.h, STAGE_BTN)
        assert.ok(r.x >= inset.left, `${what} runs under the left inset`)
        assert.ok(r.x + r.w <= w - inset.right, `${what} runs under the right inset`)
        assert.ok(r.y + r.h <= h - inset.bottom, `${what} runs under the home indicator`)
        assert.ok(r.y >= c.stage.y, `${what} is above the stage it lives in`)
        assert.equal(hitsHostChrome(r, w, inset), false, `${what} is under host chrome`)
      }
      assert.equal(overlaps(c.dissolve, c.mute), false, 'the two buttons overlap each other')
    })

    test(`${name}, ${label}: the widest face this game can produce still fits`, () => {
      const px = faceSizeFor(c, WIDEST_FACE)
      assert.ok(px >= 9, `the widest face was squeezed to ${px}px`)
      assert.ok(
        faceEm(WIDEST_FACE) * px <= c.readout.w + 1,
        `the widest face needs ${(faceEm(WIDEST_FACE) * px).toFixed(1)}px in ${c.readout.w.toFixed(1)}px`,
      )
    })

    /**
     * The band's height is the canvas stage's origin, so a band that changed
     * height when the target changed would move every polyp on the shelf every
     * time the number did. The size is solved for a fixed line box and the face is
     * fitted inside it.
     */
    test(`${name}, ${label}: the band's height does not depend on what the target says`, () => {
      for (const face of FACES) {
        const px = faceSizeFor(c, face)
        assert.ok(px <= c.facePx, `"${face}" wanted ${px}px in a ${c.facePx}px box`)
        assert.ok(faceEm(face) * px <= c.readout.w + 1, `"${face}" is too wide at ${px}px`)
      }
      // And the band arithmetic itself never reads the face at all.
      assert.equal(c.band.h, c.bandPad.top + c.facePx + (c.meter.y - c.face.y - c.face.h) + METER_H + c.bandPad.bottom)
    })

    test(`${name}, ${label}: the stage is everything below the band, and there is no rail`, () => {
      assert.equal(c.stage.y, c.band.h)
      assert.equal(c.stage.h, h - c.band.h)
      assert.ok(c.stage.h > 0)
      // Every pixel of the glass is either band or stage. The five-button action
      // rail that used to take 62px of the bottom is gone; the shelf has it.
      assert.equal(c.band.h + c.stage.h, h)
    })

    test(`${name}, ${label}: the stage's safe area keeps out of the side and bottom insets`, () => {
      const area = stageAreaFor(c, c.stage.w, c.stage.h)
      assert.equal(area.x, inset.left)
      assert.equal(area.x + area.w, c.stage.w - inset.right)
      assert.ok(area.h <= c.stage.h - inset.bottom + 1)
      assert.ok(area.h > 0)
    })

    test(`${name}, ${label}: the mouth's reservation actually clears a button`, () => {
      // The mouth is a drop target and the buttons sit at the end of it, so the
      // reserved room has to be at least the button plus a gesture's worth of gap.
      assert.ok(MOUTH_END_PAD >= STAGE_BTN, `${MOUTH_END_PAD} does not clear a ${STAGE_BTN}px button`)
      assert.ok(MOUTH_END_PAD * 2 < c.stage.w, 'the reservation eats the whole stage')
    })

    test(`${name}, ${label}: in landscape both buttons move to the right, off the shelf`, () => {
      if (!isMouthColumn(c.stage.w, c.stage.h)) {
        // Portrait: the two corners, with the mouth between them.
        assert.ok(c.dissolve.x < c.mute.x)
        assert.ok(c.dissolve.x < c.stage.w / 2)
        return
      }
      // Landscape: the bottom-left of the stage is SHELF, so nothing may be put
      // there. Both buttons go inside the mouth column's footprint on the right.
      assert.ok(c.dissolve.x > c.stage.w / 2, `CLEAR at x=${c.dissolve.x} sits on the shelf`)
      assert.ok(c.dissolve.x + c.dissolve.w <= c.mute.x, 'the two buttons overlap')
    })
  }
}

test('insetsOf inverts a safe rectangle exactly', () => {
  for (const [, w, h] of VIEWPORTS) {
    for (const [, inset] of insetCases()) {
      assert.deepEqual(insetsOf(w, h, rectOf(inset, w, h)), inset)
    }
  }
})

test('faceEm never under-measures a face, so a fitted size can never overflow', () => {
  // Every glyph the game can put on the band has an advance, and the widest one
  // sets the floor. A character with no entry would silently measure as narrow.
  for (const ch of '0123456789,= ▢+−×÷') {
    assert.ok(faceEm(ch) > 0, `"${ch}" has no advance`)
    assert.ok(faceEm(ch) <= 1, `"${ch}" measures wider than its own type size`)
  }
  assert.equal(faceEm(''), 0)
})

test('the chrome holds no essence odometer, no rate, no flow pill and no rail', async () => {
  const src = await import('node:fs/promises').then((fs) =>
    fs.readFile(new URL('./chrome.ts', import.meta.url), 'utf8'),
  )
  for (const gone of ['odoPx', 'ratePx', 'railCols', 'railHeight', 'RAIL_SLOTS', 'PIPS_PER_ROW']) {
    assert.equal(src.includes(gone), false, `${gone} should be gone from the chrome`)
  }
  // ...and it still never reads the one thing that lies inside a pack frame. The
  // comments are stripped first, because the ban is WRITTEN DOWN in the header and
  // a naive substring search finds the prohibition and calls it the offence.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  assert.ok(src.includes('safe-area-inset'), 'the ban should be written down in the header')
  assert.equal(code.includes('safe-area-inset'), false, 'env(safe-area-inset-*) is zero in a pack frame')
  assert.equal(code.includes('env('), false, 'nothing in this pack may read an env() inset')
})
