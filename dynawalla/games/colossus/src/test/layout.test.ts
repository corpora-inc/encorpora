// THE FRAME.
//
// COLOSSUS shipped drawing `TOWER 3` at (18, 30) and its progress pips at
// `w - 18`. On every phone the host ships to, those are respectively under the
// exit control and under the how-to-play control, and on a notched phone the
// first of them is under the notch as well. Nothing in the rules tests could
// ever have noticed: a layout bug is invisible to a test about factors.
//
// This is that gate, and it is built so it cannot pass by accident.
//
//   * It calls `viewLayout`, the SAME entry point `Scene.resize` calls, rather
//     than the inner `layout(w, h, area)` with an area the test made up. Take
//     the `area` plumbing out of `viewLayout` and the notch cases fail here.
//   * It runs every viewport against three inset profiles, including none. Take
//     the horizontal corner inset out of `layout` and the zero-inset cases fail.
//
// Both halves are guarded, so neither can be removed quietly.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  hitsHostChrome,
  safeRect,
  NO_INSETS,
  type Insets,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts"
import { MAX_FLOORS } from "../game/game.ts"
import { MAX_KEYSTONES } from "../game/tower.ts"
import { cameraFor, floorBox, keystoneBox, pipX, viewLayout } from "../render/layout.ts"

const VIEWPORTS: Array<[string, number, number]> = [
  ["phone portrait, small", 320, 568],
  ["phone portrait, tall", 390, 844],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["phone landscape", 844, 390],
]

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

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

const box = (r: Rect): string =>
  `[${r.x.toFixed(1)}, ${r.y.toFixed(1)} ${r.w.toFixed(1)}×${r.h.toFixed(1)}]`

// Tower heights worth checking: an almost-empty building, a fresh one, and the
// tallest a run of wrong strikes can ever make it.
const HEIGHTS = [1, 2, 5, 9, 14, MAX_FLOORS]

for (const [vname, w, h] of VIEWPORTS) {
  for (const [iname, insets] of INSETS) {
    const where = `${vname} (${w}×${h}), ${iname}`

    test(`nothing a child reads or touches is under the chrome — ${where}`, () => {
      const l = viewLayout(w, h, insets)
      const area = safeRect(w, h, insets)

      // Everything critical, named. If a rect is added to the HUD it belongs in
      // this list or it is not being checked.
      const critical: Array<[string, Rect]> = [
        ["the TOWER label", l.towerBox],
        ["the BEST label", l.bestBox],
        ["the progress pips", l.pips],
        ["the STRIKE pill", l.strike],
      ]

      for (const [name, rect] of critical) {
        assert.equal(
          hitsHostChrome(rect, w, insets),
          false,
          `${name} ${box(rect)} is under the host's chrome`,
        )
        assert.ok(inside(rect, area), `${name} ${box(rect)} is outside the safe area ${box(area)}`)
      }

      // The keystone carries the sum. The floors are the tap targets. Both are
      // centred, so the corners are not the likely failure — the notch is.
      for (const n of HEIGHTS) {
        const key = keystoneBox(l, n)
        assert.equal(
          hitsHostChrome(key, w, insets),
          false,
          `${n} floors: the keystone ${box(key)} is under the host's chrome`,
        )
        assert.ok(
          inside(key, area),
          `${n} floors: the keystone ${box(key)} is outside the safe area ${box(area)}`,
        )

        const top = floorBox(l, n, n - 1)
        assert.equal(
          hitsHostChrome(top, w, insets),
          false,
          `${n} floors: the top floor ${box(top)} is under the host's chrome`,
        )
        assert.ok(
          inside(top, area),
          `${n} floors: the top floor ${box(top)} is outside the safe area ${box(area)}`,
        )

        // And the building never stands on its own button.
        assert.ok(
          l.groundY <= l.strike.y + 0.5,
          `${n} floors: the ground line ${l.groundY.toFixed(1)} is inside the strike bar`,
        )
      }
    })

    test(`the label and the pips do not collide — ${where}`, () => {
      const l = viewLayout(w, h, insets)
      // Abreast where there is room, stacked where there is not — but never
      // overlapping, and never solved by letting one of them into a corner.
      for (const label of [l.towerBox, l.bestBox]) {
        assert.equal(
          overlaps(label, l.pips),
          false,
          `the HUD label ${box(label)} runs into the pips ${box(l.pips)}`,
        )
      }
      assert.ok(
        l.towerBox.w >= 40,
        `the HUD label has ${l.towerBox.w.toFixed(1)}px — "TOWER 3" does not fit`,
      )
      // Every shorter run of pips hangs inside the widest one.
      for (let total = 1; total <= MAX_KEYSTONES; total++) {
        assert.ok(
          pipX(l, 0, total) >= l.pips.x - 0.5,
          `a run of ${total} pips starts left of the strip`,
        )
        assert.ok(
          pipX(l, total - 1, total) + l.pipW <= l.pips.x + l.pips.w + 0.5,
          `a run of ${total} pips runs off the right of the strip`,
        )
      }
    })

    test(`the camera keeps the building in the room — ${where}`, () => {
      const l = viewLayout(w, h, insets)
      assert.ok(l.usableH >= 120, `the camera band is ${l.usableH.toFixed(1)}px`)
      assert.ok(l.hudTop >= l.area.y, "the camera band starts above the safe area")
      for (const n of HEIGHTS) {
        const cam = cameraFor(l, n)
        assert.ok(cam.scale > 0, `${n} floors: the camera scale collapsed`)
        assert.ok(cam.scale <= cam.cap + 1e-9, `${n} floors: the camera exceeds its own cap`)
        assert.ok(
          keystoneBox(l, n).y >= l.hudTop - 0.5,
          `${n} floors: the keystone climbs above the camera band`,
        )
      }
      // The eased camera can pass through a larger scale on its way down after
      // the tower grows. The cap is what stops that frame from being wrong.
      const grown = cameraFor(l, 3)
      assert.ok(
        keystoneBox(l, 3, grown.cap).y >= l.hudTop - 0.5,
        "at the camera's cap the keystone still climbs above the band",
      )
    })
  }
}

test("the safe area is what moves the HUD, not a constant", () => {
  // The plumbing itself: with a notch, everything critical moves down and in by
  // exactly the inset. This is the assertion that fails if `viewLayout` stops
  // threading insets through `safeRect`.
  const plain = viewLayout(390, 844, NO_INSETS)
  const notched = viewLayout(390, 844, { top: 59, right: 0, bottom: 34, left: 0 })
  assert.equal(notched.towerBox.y - plain.towerBox.y, 59, "the HUD did not move below the notch")
  assert.ok(
    notched.strike.y + notched.strike.h < plain.strike.y + plain.strike.h,
    "the strike pill did not move above the home indicator",
  )

  const shifted = viewLayout(844, 390, { top: 0, right: 59, bottom: 21, left: 59 })
  assert.equal(shifted.towerBox.x - viewLayout(844, 390, NO_INSETS).towerBox.x, 59)
})

test("the corners are cleared sideways, not by reserving a band", () => {
  // A reserved 67px top strip costs 12% of a 568px phone. The promise here is
  // narrower and cheaper: the HUD sits level with the host's controls, and the
  // clearance is horizontal.
  const l = viewLayout(320, 568, NO_INSETS)
  assert.ok(l.towerBox.y < 44, "the HUD was pushed below the host's controls instead of beside them")
  assert.ok(l.hudX >= 54, `the HUD starts at ${l.hudX}, inside the exit control`)
  assert.ok(l.pips.x + l.pips.w <= 266, "the pips reach into the help control")
})
