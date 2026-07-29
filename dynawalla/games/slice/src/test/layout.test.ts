// THE ROOM.
//
// THE SPLIT draws its whole HUD on a canvas, and a canvas cannot read
// `env(safe-area-inset-*)`. It also declares `viewport-fit=cover`, which opts
// the document INTO the notch, the home indicator and the rounded corners. So
// for as long as this game has existed its score has been drawn at `y = 12`,
// which on a notched phone is not on the screen at all — and its three lamps
// have been drawn underneath the host's how-to-play control.
//
// Neither defect is visible to a test about rules, and neither is visible in a
// desktop browser. This file is the gate. It runs the SAME layout the renderer
// runs at resize — `hudLayout(w, h, safeRect(w, h, insets))` and
// `candidateRow(...)`, not a hand-built rect and not a copy of the arithmetic —
// and asserts the two promises:
//
//   1. everything a child must READ or TOUCH is inside the safe rect;
//   2. nothing a child must read or touch lands in the host's two 44px corners.
//
// The playfield is deliberately exempt from both. The sky, the ridges, the
// canopies, the blade, the splats, the particles and the flying gourds bleed to
// every edge, which is the reason `viewport-fit=cover` is set in the first
// place.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  hitsHostChrome,
  NO_INSETS,
  safeRect,
  type Insets,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts"
import { candidateHome, candidateRow, hudLayout, lampX, tickRect } from "../render/hud.ts"

const VIEWPORTS: Array<[string, number, number]> = [
  ["phone portrait, small", 320, 568],
  ["phone portrait, tall", 390, 844],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["phone landscape", 844, 390],
]

/**
 * The insets a real device hands back. Measured values, not invented ones: 47pt
 * of notch and 34pt of home indicator held tall, 59pt of rounded corner each
 * side held wide.
 */
const PROFILES: Array<[string, Insets]> = [
  ["no insets", NO_INSETS],
  ["notch, portrait", { top: 47, right: 0, bottom: 34, left: 0 }],
  ["rounded corners, landscape", { top: 0, right: 59, bottom: 21, left: 59 }],
]

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

const inside = (r: Rect, area: Rect): boolean =>
  r.x >= area.x - 0.5 &&
  r.y >= area.y - 0.5 &&
  r.x + r.w <= area.x + area.w + 0.5 &&
  r.y + r.h <= area.y + area.h + 0.5

for (const [pname, insets] of PROFILES) {
  for (const [vname, w, h] of VIEWPORTS) {
    test(`the readouts clear the host's corners at ${vname} (${w}×${h}), ${pname}`, () => {
      // Exactly what `resize()` does. If this line stops matching the renderer,
      // this whole file stops being evidence.
      const l = hudLayout(w, h, safeRect(w, h, insets))

      for (const [what, box] of [
        ["the score column", l.left],
        ["the lamps", l.lamps],
        ["the question banner", l.banner],
      ] as const) {
        assert.equal(
          hitsHostChrome(box, w, insets),
          false,
          `${what} is under the host's chrome: ${JSON.stringify(box)}`,
        )
        assert.ok(inside(box, l.area), `${what} is outside the safe rect: ${JSON.stringify(box)}`)
      }
    })

    test(`the answer lanterns clear the host's corners at ${vname} (${w}×${h}), ${pname}`, () => {
      const l = hudLayout(w, h, safeRect(w, h, insets))
      // The lanterns are the answer input — read AND touched — and where they
      // hang depends on where the tablet was when it was cut. So try the
      // extremes: a tablet cut in a corner, at the top, and off the edge.
      for (const fromX of [-40, 0, w * 0.5, w, w + 40]) {
        for (const fromY of [-40, 0, h * 0.1, h * 0.4, h]) {
          const row = candidateRow(l, 4, fromX, fromY)
          assert.equal(
            hitsHostChrome(row.box, w, insets),
            false,
            `a lantern row from (${fromX.toFixed(0)},${fromY.toFixed(0)}) is under host chrome: ` +
              JSON.stringify(row.box),
          )
          assert.ok(
            inside(row.box, l.area),
            `a lantern row from (${fromX.toFixed(0)},${fromY.toFixed(0)}) leaves the safe rect: ` +
              JSON.stringify(row.box),
          )
          // The banner carries the sum being asked. A lantern row on top of it
          // takes away the one place the question can be re-read.
          assert.ok(
            row.box.y >= l.banner.y + l.banner.h,
            `a lantern row from (${fromX.toFixed(0)},${fromY.toFixed(0)}) covers the question ` +
              `banner by ${(l.banner.y + l.banner.h - row.box.y).toFixed(1)}px`,
          )
          // Every lantern is individually reachable, not just the row's box.
          for (let i = 0; i < 4; i++) {
            const p = candidateHome(row, i, 4)
            assert.ok(
              p.x - row.r >= l.area.x - 0.5 && p.x + row.r <= l.area.x + l.area.w + 0.5,
              `candidate ${i} of 4 hangs outside the safe rect at x=${p.x.toFixed(1)}`,
            )
            assert.ok(p.y > l.chromeBottom, `candidate ${i} of 4 hangs under the host's chrome`)
          }
        }
      }
    })

    test(`the HUD holds together at ${vname} (${w}×${h}), ${pname}`, () => {
      const l = hudLayout(w, h, safeRect(w, h, insets))

      // The lamps hang from the right, the score column reads from the left,
      // and they have never been allowed to touch.
      assert.ok(
        l.left.x + l.left.w <= l.lamps.x + 0.5,
        `the score column runs into the lamps by ${(l.left.x + l.left.w - l.lamps.x).toFixed(1)}px`,
      )

      // The banner never lands on the readouts. It is drawn last and it is
      // opaque, so an overlap does not crowd the score — it erases it.
      assert.equal(overlaps(l.banner, l.left), false, "the question banner covers the score column")
      assert.equal(overlaps(l.banner, l.lamps), false, "the question banner covers the lamps")

      // Three lanterns, in order, all inside the safe rect.
      let prev = Number.POSITIVE_INFINITY
      for (let i = 0; i < 3; i++) {
        const x = lampX(l, i)
        assert.ok(x < prev, "the lamps are not laid out right to left")
        prev = x
        assert.ok(
          x - l.lampR >= l.area.x - 0.5 && x + l.lampR <= l.area.x + l.area.w + 0.5,
          `lamp ${i} hangs outside the safe rect at x=${x.toFixed(1)}`,
        )
      }

      // The relight ticks live under the lamps, inside the lamps' own box.
      for (let i = 0; i < 2; i++) {
        const t = tickRect(i, l)
        assert.ok(inside(t, l.lamps), `relight tick ${i} escapes the lamp block`)
      }

      // Legibility: the score is the largest thing on the HUD and it must not
      // shrink below what a seven-year-old reads across a room.
      assert.ok(l.big >= 24, `the score is ${l.big.toFixed(1)}px`)
      assert.ok(l.lampR >= 9, `a lamp is ${l.lampR.toFixed(1)}px across`)
    })
  }
}

test("the layout is derived from the safe rect, not from the canvas", () => {
  // `hudLayout` takes `area` as a REQUIRED parameter for exactly this reason: a
  // default would let a call site forget it, compile, and draw under the notch,
  // discoverable only on a device with a notch in someone's hand. Here is the
  // proof the parameter is actually load-bearing rather than decorative.
  const notch: Insets = { top: 47, right: 0, bottom: 34, left: 0 }
  const flat = hudLayout(390, 844, safeRect(390, 844, NO_INSETS))
  const notched = hudLayout(390, 844, safeRect(390, 844, notch))
  assert.ok(
    notched.top >= flat.top + notch.top,
    `a 47px notch moved the readouts by ${(notched.top - flat.top).toFixed(1)}px`,
  )
  assert.ok(notched.scoreY > 47, "the score is drawn inside the notch")
})
