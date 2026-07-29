/**
 * The gate on where things land.
 *
 * Two bugs live here and neither is visible to a test about ballistics:
 *
 *  1. **The notch.** The pack declares `viewport-fit=cover` and draws its whole
 *     HUD on canvas, where `env()` cannot be reached — so the fire button used to
 *     be measured from bare `h` and sat under the home indicator, and the
 *     equation plaque sat under the notch. `hudLayout` now takes the safe rect as
 *     a REQUIRED argument, and this runs it with the insets a real iPhone
 *     reports, because node measures zero.
 *
 *  2. **The host's chrome.** Exit (top-left) and how-to-play (top-right), 44px
 *     each, float OVER the game. Mute used to sit exactly under the how-to-play
 *     button, and a centred equation plaque reaches both corners on a 320px
 *     phone. Nothing a child must read or touch may land in those two squares.
 *
 * Everything here goes through `hudLayout(w, h, safeRect(w, h, insets), loft)` —
 * the exact call `TrebuchetGame.resize()` makes — rather than a hand-built rect,
 * so removing the fix turns this red.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  hitsHostChrome,
  safeRect,
  type Insets,
  type Rect,
} from '../../../../packs/shared/game-chrome/index.ts'
import { dialNumeralBox, hudLayout, rackLayout, type HudLayout, type HudState } from './hud.ts'

const VIEWPORTS: Array<[string, number, number]> = [
  ['phone portrait, small', 320, 568],
  ['phone portrait, tall', 390, 844],
  ['tablet portrait', 768, 1024],
  ['tablet landscape', 1024, 768],
  ['phone landscape', 844, 390],
]

/** Node reports no insets, so the device profiles are supplied by hand. */
const PROFILES: Array<[string, Insets]> = [
  ['no insets', { top: 0, right: 0, bottom: 0, left: 0 }],
  ['notch, portrait', { top: 47, right: 0, bottom: 34, left: 0 }],
  ['notch, landscape', { top: 0, right: 44, bottom: 21, left: 44 }],
]

const inside = (r: Rect, a: Rect): boolean =>
  r.x >= a.x - 0.5 &&
  r.y >= a.y - 0.5 &&
  r.x + r.w <= a.x + a.w + 0.5 &&
  r.y + r.h <= a.y + a.h + 0.5

const show = (r: Rect): string =>
  `[${r.x.toFixed(1)},${r.y.toFixed(1)} ${r.w.toFixed(1)}x${r.h.toFixed(1)}]`

/** A state that only exists to be measured; the rack is what a real wave holds. */
function stateFor(layout: HudLayout): HudState {
  return {
    layout,
    equation: '347 + 268',
    rack: ['347 + 268', '91 − 47', '8 × 7', '120 − 65', '46 + 39'],
    rackActive: 0,
    wave: 3,
    score: 1200,
    scorePop: 1,
    combo: 1,
    wind: -2,
    showWind: true,
    loftUnlocked: true,
    loftIndex: 2,
    loftCount: 5,
    muted: false,
    introT: 1,
    clearT: -1,
    clearHits: 0,
    clearOf: 5,
    dialPop: 1,
    canFire: true,
  }
}

for (const [vname, w, h] of VIEWPORTS) {
  for (const [pname, insets] of PROFILES) {
    for (const loft of [false, true]) {
      const label = `${vname} (${w}×${h}), ${pname}${loft ? ', loft' : ''}`

      test(`every control is inside the safe rect — ${label}`, () => {
        const layout = hudLayout(w, h, safeRect(w, h, insets), loft)
        assert.ok(layout.buttons.length >= 4, 'the controls went missing')
        for (const b of layout.buttons) {
          assert.ok(
            inside(b, layout.area),
            `${b.id} ${show(b)} is outside the safe rect ${show(layout.area)}`,
          )
        }
        if (loft) assert.ok(layout.buttons.some((b) => b.id === 'loft'), 'no loft lever')
      })

      test(`nothing a child touches sits under the host's chrome — ${label}`, () => {
        const layout = hudLayout(w, h, safeRect(w, h, insets), loft)
        for (const b of layout.buttons) {
          assert.equal(
            hitsHostChrome(b, w, insets),
            false,
            `${b.id} ${show(b)} is under the host chrome`,
          )
        }
      })

      test(`the question stays readable — ${label}`, () => {
        const layout = hudLayout(w, h, safeRect(w, h, insets), loft)
        // `plaqueMax` is the widest the plaque can ever be drawn: a long sum on a
        // narrow phone reaches BOTH corners, so the whole pinned stack starts
        // under them.
        assert.equal(
          hitsHostChrome(layout.plaqueMax, w, insets),
          false,
          `the equation plaque ${show(layout.plaqueMax)} is under the host chrome`,
        )
        assert.ok(
          inside(layout.plaqueMax, layout.area),
          `the equation plaque ${show(layout.plaqueMax)} runs outside the safe rect`,
        )
        // The rack is read AND tapped — a stone loads that boulder. Five
        // multi-digit sums is an ordinary wave, and they must all be on the
        // glass, not just clear of the chrome.
        for (const s of rackLayout(stateFor(layout))) {
          assert.equal(hitsHostChrome(s, w, insets), false, `a rack stone ${show(s)} is under chrome`)
          assert.ok(inside(s, layout.area), `a rack stone ${show(s)} runs off the safe rect`)
        }
        // The wave counter and the score are read, so they move too.
        for (const [what, r] of [
          ['the wave counter', layout.wave],
          ['the score', layout.score],
        ] as const) {
          assert.equal(hitsHostChrome(r, w, insets), false, `${what} ${show(r)} is under chrome`)
          assert.ok(inside(r, layout.area), `${what} ${show(r)} runs outside the safe rect`)
        }
      })

      test(`the dial numeral is legible wherever the camera puts it — ${label}`, () => {
        const layout = hudLayout(w, h, safeRect(w, h, insets), loft)
        // The numeral rides the aim marker in the world, so the camera decides
        // its anchor — which means every anchor on the glass has to be safe, not
        // just the one a particular shot produces.
        for (let ax = -40; ax <= w + 40; ax += 20) {
          for (let ay = -40; ay <= h + 40; ay += 20) {
            for (const s of [4, 9, 20]) {
              for (const digits of [1, 2, 3]) {
                const box = dialNumeralBox(ax, ay, s, digits, layout)
                assert.equal(
                  hitsHostChrome(box, w, insets),
                  false,
                  `the dial numeral ${show(box)} is under the host chrome (anchor ${ax},${ay})`,
                )
                assert.ok(
                  inside(box, layout.area),
                  `the dial numeral ${show(box)} is outside the safe rect ${show(layout.area)}`,
                )
              }
            }
          }
        }
      })
    }
  }
}

test('the pinned stack is ordered, and leaves the field its room', () => {
  for (const [, w, h] of VIEWPORTS) {
    const layout = hudLayout(w, h, safeRect(w, h), true)
    assert.ok(layout.topClear > layout.area.y, 'the stack starts at the very top edge')
    assert.ok(layout.rackTop > layout.plaqueMax.y + layout.plaqueMax.h - 1, 'the rack is on the plaque')
    assert.ok(layout.windY > layout.rackTop + layout.rackH, 'the wind chip is on the rack')
    assert.ok(layout.stackBottom < layout.area.y + layout.area.h * 0.5, 'the HUD eats half the glass')
  }
})
