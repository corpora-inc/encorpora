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
  type Rect,
  hitsHostChrome,
  safeRect,
} from "../../../../packs/shared/game-chrome/index.ts"
import { cellAt, viewLayout } from "./layout.ts"
import { VIEWPORTS, profiles } from "./viewports.ts"

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
        ["the gauge", l.gauge],
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

/* ────────────────────────────────────────────────────── the lever row shares */

// The gauge is the panel that answers "what am I holding", and from this change
// on it is also where a child taps to ask the hint to keep going. It used to be
// whatever was left over after two independently-sized levers had taken what
// they wanted — `shear.x − (furnace.x + furnace.w) − 24` — and the renderer gave
// up on it below 60px without drawing anything at all. That is a panel that
// silently disappears on the narrow screens where it is needed most.

for (const [shape, w, h] of VIEWPORTS) {
  for (const [profile, insets] of profiles(w, h)) {
    const where = `${shape} ${String(w)}×${String(h)}, ${profile}`

    test(`the lever row holds three panels without them touching — ${where}`, () => {
      const l = viewLayout(w, h, insets)
      assert.ok(
        l.furnace.x + l.furnace.w <= l.gauge.x + 0.5,
        `the FURNACE overlaps the gauge at ${where}`,
      )
      assert.ok(
        l.gauge.x + l.gauge.w <= l.shear.x + 0.5,
        `the gauge overlaps the SHEAR lever at ${where} — gauge ends ${(l.gauge.x + l.gauge.w).toFixed(1)}, shear starts ${l.shear.x.toFixed(1)}`,
      )
      assert.ok(
        l.furnace.x >= l.levers.x - 0.5 && l.shear.x + l.shear.w <= l.levers.x + l.levers.w + 0.5,
        `the lever row runs off its own strip at ${where}`,
      )
    })

    test(`the gauge is wide enough to read a piece in — ${where}`, () => {
      const l = viewLayout(w, h, insets)
      assert.ok(
        l.gauge.w >= 72,
        `the gauge is ${l.gauge.w.toFixed(1)}px at ${where}; below 72 it clips to one link and stops answering`,
      )
    })

    test(`both levers stay a hittable size — ${where}`, () => {
      const l = viewLayout(w, h, insets)
      assert.ok(l.shear.w >= 108, `the SHEAR lever is ${l.shear.w.toFixed(1)}px at ${where}`)
      assert.ok(l.furnace.w >= 84, `the FURNACE lever is ${l.furnace.w.toFixed(1)}px at ${where}`)
      assert.ok(l.shear.h >= 44 && l.furnace.h >= 44, `a lever is under 44px tall at ${where}`)
    })
  }
}
