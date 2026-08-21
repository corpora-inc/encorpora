// THE YARD, ON A REAL DEVICE.
//
// Two things were wrong with this game's layout and neither could be seen from
// a desk. The pack declares `viewport-fit=cover`, so the canvas runs under the
// notch and the home indicator, and the stamp — the one control the round
// ends on — was pinned to `h - pad` and therefore underneath the home
// indicator. And the host floats an exit control over the top-left corner and a
// how-to-play control over the top-right, so `TURK 4` at one end of the HUD and
// the tally at the other were both sitting under a button.
//
// This file is the gate. It runs the layout at the shapes the fleet has, CROSSED
// with the inset profiles the fleet has, and asserts what a photograph of a
// device would have shown.
//
// **Why it goes through `viewLayout`.** A test that calls `layoutFor(w, h,
// safeRect(w, h))` proves nothing: it supplies the safe rectangle itself, so it
// passes whether or not the renderer ever asks for one. `viewLayout` is the
// single entry point `Scene.resize` uses, so exercising it here is exercising
// the frame.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  hitsHostChrome,
  NO_INSETS,
  safeRect,
  type Insets,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts"
import { panExtent, TOUCH_FLOOR, viewLayout } from "../render/layout.ts"

const VIEWPORTS: Array<[string, number, number]> = [
  ["phone portrait, small", 320, 568],
  ["phone portrait, tall", 390, 844],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["phone landscape", 844, 390],
]

/** Real device shapes: a notched phone held tall, and the same one held wide. */
const INSETS: Array<[string, Insets]> = [
  ["no insets", NO_INSETS],
  ["portrait notch", { top: 59, right: 0, bottom: 34, left: 0 }],
  ["landscape notch", { top: 0, right: 59, bottom: 21, left: 59 }],
]

const inside = (r: Rect, area: Rect): boolean =>
  r.x >= area.x - 0.5 &&
  r.y >= area.y - 0.5 &&
  r.x + r.w <= area.x + area.w + 0.5 &&
  r.y + r.h <= area.y + area.h + 0.5

const show = (r: Rect): string =>
  `[${r.x.toFixed(1)}, ${r.y.toFixed(1)} ${r.w.toFixed(1)}×${r.h.toFixed(1)}]`

for (const [vname, w, h] of VIEWPORTS) {
  for (const [iname, insets] of INSETS) {
    test(`the yard stands inside the safe area at ${vname} (${w}×${h}), ${iname}`, () => {
      const l = viewLayout(w, h, insets)
      const area = safeRect(w, h, insets)

      // Everything a child reads or touches. The backdrop is deliberately not
      // in this list — it bleeds to the full canvas, which is the entire point
      // of `cover`.
      const critical: Array<[string, Rect]> = [
        ["the HUD row", l.hud],
        ["the stage", l.stage],
        ["the pans", panExtent(l)],
        ["the gauge", l.gauge],
        ["the rack", l.rack],
        ["the stamp", l.stamp],
        ...l.pillars.flatMap(
          (p): Array<[string, Rect]> => [
            [`the ${p.place} ADD face`, p.up],
            [`the ${p.place} TAKE face`, p.down],
          ],
        ),
      ]

      for (const [what, rect] of critical) {
        assert.ok(
          inside(rect, area),
          `${what} ${show(rect)} runs outside the safe area ${show(area)}`,
        )
        assert.equal(
          hitsHostChrome(rect, w, insets),
          false,
          `${what} ${show(rect)} is under the host's chrome`,
        )
      }
    })

    test(`every touch target is still hittable at ${vname} (${w}×${h}), ${iname}`, () => {
      const l = viewLayout(w, h, insets)
      // The rack and the stamp are the whole input vocabulary. A face under the
      // touch floor is a blow the child meant to land and did not, and on this
      // beam an unintended second blow is how you shear it.
      const targets: Array<[string, Rect]> = [
        ["the stamp", l.stamp],
        ...l.pillars.flatMap(
          (p): Array<[string, Rect]> => [
            [`the ${p.place} ADD face`, p.up],
            [`the ${p.place} TAKE face`, p.down],
          ],
        ),
      ]
      for (const [what, r] of targets) {
        assert.ok(
          r.w >= TOUCH_FLOOR,
          `${what} is ${r.w.toFixed(1)}px wide — under the ${TOUCH_FLOOR}px touch floor`,
        )
        assert.ok(
          r.h >= TOUCH_FLOOR,
          `${what} is ${r.h.toFixed(1)}px tall — under the ${TOUCH_FLOOR}px touch floor`,
        )
      }
    })
  }
}

test("the HUD steps in past the host's corners rather than reserving a band", () => {
  // The fix is horizontal, not vertical: reserving a 67px top band costs 12% of
  // a small phone and would push the rack off the bottom. Both ends of the HUD
  // give way instead, and the top of the HUD stays where it was.
  const l = viewLayout(320, 568)
  assert.ok(l.hud.x >= 54, `the HUD starts at ${l.hud.x.toFixed(1)} — inside the exit corner`)
  assert.ok(
    l.hud.x + l.hud.w <= 320 - 54,
    `the HUD ends at ${(l.hud.x + l.hud.w).toFixed(1)} — inside the help corner`,
  )
  assert.ok(l.hud.y <= 20, `the HUD was pushed down to y=${l.hud.y.toFixed(1)}`)
  assert.ok(l.hud.w >= 190, `only ${l.hud.w.toFixed(1)}px left between the corners`)
})

test("the safe area moves the yard, it does not merely shrink it", () => {
  // If the insets were ignored, these two would be identical. They are the
  // same screen, notched and not.
  const bare = viewLayout(390, 844)
  const notched = viewLayout(390, 844, { top: 59, right: 0, bottom: 34, left: 0 })
  assert.ok(notched.hud.y > bare.hud.y, "the HUD did not move down for the notch")
  assert.ok(
    notched.stamp.y + notched.stamp.h < bare.stamp.y + bare.stamp.h,
    "the stamp did not lift off the home indicator",
  )
})
