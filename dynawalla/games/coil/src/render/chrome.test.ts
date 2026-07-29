// THE TWO CORNERS AND THE NOTCH.
//
// This game declares `viewport-fit=cover`, so its canvas reaches under the
// notch, the home indicator and the rounded corners, and the host floats an
// exit control over the top-left and a how-to-play control over the top-right.
// A canvas cannot read `env()`, so none of that is visible to `fillText`: the
// carved problem was drawn at `wall.y + wall.h * 0.12`, about 27px down, which
// is underneath the exit control on every phone that has one, and underneath
// the notch as well on the ones with a notch.
//
// The gate is deliberately built around `viewLayout` — the exact function
// `Scene.resize` calls — rather than around `layout`, because a test that hands
// the layout an area it invented itself passes whether or not the renderer ever
// asks for one. Here, if the safe area stops being plumbed through, the notched
// profiles fail; if the corner inset on the recess goes, the flat profiles fail
// too.

import assert from "node:assert/strict"
import test from "node:test"

import {
  type Insets,
  NO_INSETS,
  type Rect,
  hitsHostChrome,
  safeRect,
} from "../../../../packs/shared/game-chrome/index.ts"
import { cellAt, viewLayout } from "./layout.ts"

const PORTRAIT_NOTCH: Insets = { top: 59, right: 0, bottom: 34, left: 0 }
const LANDSCAPE_NOTCH: Insets = { top: 0, right: 59, bottom: 21, left: 59 }

const VIEWPORTS: Array<[string, number, number]> = [
  ["phone portrait, small", 320, 568],
  ["phone portrait, tall", 390, 844],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["phone landscape", 844, 390],
]

/** A flat profile always, and the notch the device of that shape actually has. */
function profiles(w: number, h: number): Array<[string, Insets]> {
  return [
    ["no insets", NO_INSETS],
    w >= h
      ? ["landscape notch", LANDSCAPE_NOTCH]
      : ["portrait notch", PORTRAIT_NOTCH],
  ]
}

const contains = (outer: Rect, inner: Rect): boolean =>
  inner.x >= outer.x - 0.5 &&
  inner.y >= outer.y - 0.5 &&
  inner.x + inner.w <= outer.x + outer.w + 0.5 &&
  inner.y + inner.h <= outer.y + outer.h + 0.5

for (const [shape, w, h] of VIEWPORTS) {
  for (const [profile, insets] of profiles(w, h)) {
    const where = `${shape} ${String(w)}×${String(h)}, ${profile}`

    test(`nothing a child reads or touches is under the host's chrome — ${where}`, () => {
      const l = viewLayout(w, h, insets)
      const area = safeRect(w, h, insets)

      // The carved problem with the lit demand. It IS the instruction of the
      // game: a child who cannot read it cannot play, so it is first.
      const critical: Array<[string, Rect]> = [
        ["the recess", l.recess],
        ["the brick courses", l.courses],
        ["the lane", l.lane],
        ["the SHEAR lever", l.shear],
        ["the FURNACE lever", l.furnace],
      ]

      for (const [name, rect] of critical) {
        assert.equal(
          hitsHostChrome(rect, w, insets),
          false,
          `${name} is under the host's chrome at ${where}`,
        )
        assert.ok(
          contains(area, rect),
          `${name} leaves the safe area at ${where} — ${JSON.stringify(rect)} vs ${JSON.stringify(area)}`,
        )
      }
    })

    test(`every link in the lane is tappable — ${where}`, () => {
      const l = viewLayout(w, h, insets)
      const area = safeRect(w, h, insets)
      const r = l.lane.unit
      for (let i = 0; i < l.lane.capacity; i++) {
        const c = cellAt(l.lane, i)
        const box: Rect = { x: c.x - r, y: c.y - r, w: r * 2, h: r * 2 }
        assert.equal(hitsHostChrome(box, w, insets), false, `link ${String(i)} at ${where}`)
        assert.ok(contains(area, box), `link ${String(i)} leaves the safe area at ${where}`)
      }
    })

    test(`the recess is wide enough to carve a problem into — ${where}`, () => {
      const l = viewLayout(w, h, insets)
      assert.ok(l.recess.w >= 90, `the recess is ${l.recess.w.toFixed(1)}px at ${where}`)
      assert.ok(l.recess.h >= 55, `the recess is ${l.recess.h.toFixed(1)}px tall at ${where}`)
    })
  }
}
