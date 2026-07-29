// THE TWO CORNERS AND THE NOTCH.
//
// This game paints its whole readable surface on a canvas: the board with the
// sum, the running total on the bar, the belt, the two stamped pedals. A canvas
// cannot see `env(safe-area-inset-*)` — it is a CSS value — so nothing about
// `viewport-fit=cover` was ever compensated for here, and the board's top edge
// sat under the notch on every phone that has one.
//
// On top of that the host floats two 44px controls over the pack, exit at the
// top-left and how-to-play at the top-right. The board is 275px wide on a 320px
// phone and centred, so it ran *under both of them*: the sum a child has to
// read was covered at both ends.
//
// What is "critical" here is small and specific. The board and the belt carry
// figures a child must read. The crowd, the ring frame, the mat, the particles
// and the pedal sockets are background and are SUPPOSED to bleed to the glass —
// that is the point of `cover`. So this file asserts two things and nothing
// more: readable HUD stays inside the safe rectangle, and readable HUD stays
// out of the two corners.
//
// The insets are passed explicitly rather than measured, because node has no
// notch and a test that measures zero insets proves nothing about a device.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  hitsHostChrome,
  safeRect,
  type Insets,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts"
import { computeLayout } from "../render/layout.ts"

const VIEWPORTS: Array<[string, number, number]> = [
  ["phone portrait, small", 320, 568],
  ["phone portrait", 390, 844],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["phone landscape", 844, 390],
]

/** No insets — a laptop, an old tablet, a desktop browser. */
const FLAT: Insets = { top: 0, right: 0, bottom: 0, left: 0 }
/** A notched phone held upright: status bar above, home indicator below. */
const NOTCH: Insets = { top: 47, right: 0, bottom: 34, left: 0 }
/** The same phone on its side. Both long edges lose room to the notch. */
const NOTCH_SIDE: Insets = { top: 0, right: 47, bottom: 21, left: 47 }

const INSETS: Array<[string, Insets]> = [
  ["flat", FLAT],
  ["notched", NOTCH],
  ["notched, on its side", NOTCH_SIDE],
]

const inside = (r: Rect, a: Rect): boolean =>
  r.x >= a.x - 0.5 &&
  r.y >= a.y - 0.5 &&
  r.x + r.w <= a.x + a.w + 0.5 &&
  r.y + r.h <= a.y + a.h + 0.5

for (const [vname, w, h] of VIEWPORTS) {
  for (const [iname, insets] of INSETS) {
    test(`the figures clear the notch and the host's corners — ${vname} (${w}×${h}), ${iname}`, () => {
      const area = safeRect(w, h, insets)
      const l = computeLayout(w, h, area)

      const board: Rect = { x: l.boardX, y: l.boardY, w: l.boardW, h: l.boardH }

      // 1. The safe rectangle. If `computeLayout` ignored `area` these fail on
      //    the notched cases and pass on the flat one, which is exactly the
      //    device-only bug this is here to catch.
      assert.ok(inside(board, area), `the board leaves the safe area (${JSON.stringify(board)})`)
      assert.ok(
        inside(l.topBar, area),
        `the belt channel leaves the safe area (${JSON.stringify(l.topBar)})`,
      )
      assert.ok(l.padTop >= area.y, "the pedal band starts above the safe area")
      assert.ok(
        l.padTop + l.padH <= area.y + area.h + 0.5,
        "the pedal band runs under the home indicator",
      )

      // 2. The two host corners. These hold at zero insets too — the exit and
      //    help squares exist on every device — so removing the channel makes
      //    every case fail, not only the notched ones.
      assert.equal(
        hitsHostChrome(board, w, insets),
        false,
        `the sum is under a host control (${JSON.stringify(board)})`,
      )
      assert.equal(
        hitsHostChrome(l.topBar, w, insets),
        false,
        `the belt is under a host control (${JSON.stringify(l.topBar)})`,
      )

      // The pedals are what a child touches. They are the bottom of the screen
      // and must never reach the corners.
      const pedals: Rect = { x: 0, y: l.padTop, w, h: l.padH }
      assert.equal(hitsHostChrome(pedals, w, insets), false, "a pedal is under a host control")
    })
  }
}

test("the board stays big enough to read after it narrows into the channel", () => {
  // Narrowing the board is only acceptable while the sum stays legible. The
  // type size is `min(boardH * 0.62, boardW * 1.55 / chars)`, and the longest
  // prompt the `add` domain serves is about eleven characters ("4,003 − 87").
  for (const [name, w, h] of VIEWPORTS) {
    const l = computeLayout(w, h, safeRect(w, h, NOTCH))
    const px = Math.min(l.boardH * 0.62, (l.boardW * 1.55) / 11)
    assert.ok(px >= 22, `${name}: the sum would be set at ${px.toFixed(1)}px`)
  }
})

test("the ring itself is not letterboxed by the insets", () => {
  // The counterpart assertion, and the reason `safeRect` is not simply applied
  // to everything. A game that solved the notch by shrinking its whole world
  // into the safe rectangle would have letterboxed itself and `cover` would be
  // pointless. The ring is built from the full width on purpose, so it is
  // pixel-identical with and without insets.
  const flat = computeLayout(390, 844, safeRect(390, 844, FLAT))
  const notched = computeLayout(390, 844, safeRect(390, 844, NOTCH))
  for (const k of ["matLeftTop", "matRightTop", "matLeftBottom", "matRightBottom"] as const) {
    assert.equal(notched[k], flat[k], `the ring moved when a notch appeared (${k})`)
  }
  assert.equal(notched.w, 390)
  assert.equal(notched.h, 844)
  // And the sum did move, because that is the half that has to.
  assert.ok(notched.boardY > flat.boardY, "the board ignored the notch")
})
