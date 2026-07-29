// THE SAFE STREET.
//
// Two things can be true at once and both are here.
//
//   1. The world may bleed. `viewport-fit=cover` is set on purpose: the dust,
//      the haze, the crowd and the caller are supposed to reach the glass, and
//      a test that demanded otherwise would be asking for a letterboxed game.
//   2. The slate may not. It carries `47 + 25 = 62`, and a digit behind the
//      camera housing is a wrong call the child did not make. The three shots
//      are the same: the only resource in the game, and the only thing that
//      tells a child the run is nearly over.
//
// So this file asserts the second while deliberately declining to assert the
// first, at the shapes the fleet actually has, WITH the insets a device
// actually reports — a headless canvas reports none, so every one of these
// numbers would pass vacuously if the insets were left at zero.
//
// It runs the layout through `Scene.resize`, which is the exact call `mount.ts`
// makes on rotation. A clearance test that calls `layoutFor` itself is a test
// of the arguments the test chose, not of the ones the game passes.

import { hitsHostChrome, NO_INSETS, type Insets } from "../../../../packs/shared/game-chrome/index.ts"
import assert from "node:assert/strict"
import { test } from "node:test"

import { fakeCanvas } from "./fakeCanvas.ts"
import { Scene } from "./scene.ts"
import { layoutFor, type Rect } from "./street.ts"

const VIEWPORTS: readonly (readonly [string, number, number])[] = [
  ["phone portrait, small", 320, 568],
  ["phone portrait, tall", 390, 844],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["phone landscape, tall", 844, 390],
  ["phone landscape, small", 568, 320],
]

/**
 * What devices actually report. The portrait notch is an iPhone 14/15 class
 * phone; the landscape pair is the same phone turned, where the camera housing
 * moves to a side and the home indicator stays at the bottom.
 */
const INSETS: readonly (readonly [string, Insets])[] = [
  ["no insets", NO_INSETS],
  ["portrait notch", { top: 47, right: 0, bottom: 34, left: 0 }],
  ["landscape notch", { top: 0, right: 47, bottom: 21, left: 47 }],
]

function streetAt(w: number, h: number, insets: Insets): Scene {
  const { canvas } = fakeCanvas(w, h)
  const scene = new Scene(canvas as HTMLCanvasElement)
  // The same call `mount.ts` makes on resize and on an inset change.
  scene.resize(insets)
  return scene
}

const inside = (box: Rect, area: Rect): boolean =>
  box.x >= area.x - 0.5 &&
  box.y >= area.y - 0.5 &&
  box.x + box.w <= area.x + area.w + 0.5 &&
  box.y + box.h <= area.y + area.h + 0.5

const show = (r: Rect): string =>
  `[${r.x.toFixed(1)},${r.y.toFixed(1)} ${r.w.toFixed(1)}×${r.h.toFixed(1)}]`

for (const [shape, w, h] of VIEWPORTS) {
  for (const [where, insets] of INSETS) {
    test(`the slate and the shots clear the host's corners — ${shape} (${String(w)}×${String(h)}), ${where}`, () => {
      const l = streetAt(w, h, insets).layout

      // The promise, and the whole of it: nothing a child must read or touch
      // lands in the two 44px corners the host paints over. Not a reserved
      // band — reserving one costs a twelfth of a 568px phone.
      for (const [name, box] of [
        ["the slate", l.slate],
        ["the shots", l.shots],
        ["the tally", l.tally],
      ] as const) {
        assert.equal(
          hitsHostChrome(box, w, insets),
          false,
          `${name} ${show(box)} is under host chrome at ${String(w)}×${String(h)} ${where}`,
        )
      }
    })

    test(`the readable things stay inside the safe area — ${shape} (${String(w)}×${String(h)}), ${where}`, () => {
      const l = streetAt(w, h, insets).layout
      const area: Rect = {
        x: insets.left,
        y: insets.top,
        w: w - insets.left - insets.right,
        h: h - insets.top - insets.bottom,
      }
      for (const [name, box] of [
        ["the slate", l.slate],
        ["the shots", l.shots],
        ["the tally", l.tally],
      ] as const) {
        assert.ok(
          inside(box, area),
          `${name} ${show(box)} runs outside the safe area ${show(area)} at ${String(w)}×${String(h)} ${where}`,
        )
      }
    })
  }
}

test("the world still bleeds to the edges — that is what cover is for", () => {
  // The counterweight to everything above. If a future change "fixed" the
  // safe area by insetting the whole scene, the game would letterbox itself on
  // every notched phone and this is the test that would say so.
  const l = layoutFor(390, 844, { x: 0, y: 47, w: 390, h: 763 })
  assert.equal(l.horizon, 844 * 0.6, "the horizon was pulled inside the safe area")
  assert.equal(l.w, 390)
  assert.equal(l.h, 844)
})

test("the slate is centred in the safe area, not in the glass", () => {
  // A landscape notch is asymmetric in nothing but its presence: 47 either
  // side. A portrait one is not — 47 top, 34 bottom — and a slate centred on
  // the raw canvas sits too high by half that difference.
  const notched = layoutFor(390, 844, { x: 0, y: 47, w: 390, h: 763 })
  const plain = layoutFor(390, 844, { x: 0, y: 0, w: 390, h: 844 })
  assert.ok(
    notched.slate.y > plain.slate.y,
    `the slate did not move down for the notch (${String(notched.slate.y)} vs ${String(plain.slate.y)})`,
  )
})

test("the shots hang below the slate, always", () => {
  for (const [, w, h] of VIEWPORTS) {
    for (const [, insets] of INSETS) {
      const l = streetAt(w, h, insets).layout
      assert.ok(
        l.shots.y >= l.slate.y + l.slate.h,
        `the shots ride up onto the slate at ${String(w)}×${String(h)}`,
      )
      assert.ok(l.tally.y + l.tally.h <= l.slate.y, `the tally overlaps the slate at ${String(w)}×${String(h)}`)
    }
  }
})

test("the statement stays big enough to read at the smallest phone", () => {
  // The clamp that keeps the slate clear of the corners must not do it by
  // shrinking the one thing in the game a child has to read.
  const l = streetAt(320, 568, { top: 47, right: 0, bottom: 34, left: 0 }).layout
  assert.ok(l.slate.w >= 240, `the slate is ${l.slate.w.toFixed(1)}px wide`)
  assert.ok(l.slate.h >= 70, `the slate is ${l.slate.h.toFixed(1)}px tall`)
})
