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

import {
  exitRect,
  helpRect,
  hitsHostChrome,
  HOST_PROGRESS_H,
  NO_INSETS,
  type Insets,
} from "../../../../packs/shared/game-chrome/index.ts"
import assert from "node:assert/strict"
import { test } from "node:test"

import { fakeCanvas } from "./fakeCanvas.ts"
import { Scene } from "./scene.ts"
import { columnOf, densityOf, GESTURE_STRIP, layoutFor, type Rect } from "./street.ts"

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
        ["the chute", l.chute],
        ["the bag", l.bag],
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
        ["the chute", l.chute],
        ["the bag", l.bag],
      ] as const) {
        assert.ok(
          inside(box, area),
          `${name} ${show(box)} runs outside the safe area ${show(area)} at ${String(w)}×${String(h)} ${where}`,
        )
      }
    })
    // ── THE PINNING, which is the founder's note, at every shape ────────────
    //
    // "The cache/keep score/pile could be locked to the bottom of the screen and
    // the discard target to the top." Locked, not merely near: each of the two
    // destinations sits ON the boundary of the column the game owns, and the
    // boundaries themselves come out of `layoutFor` rather than being recomputed
    // here — a clearance test that derives its own edge is a test of the edge it
    // derived.

    test(`THE HOARD IS LOCKED TO THE BOTTOM — ${shape} (${String(w)}×${String(h)}), ${where}`, () => {
      const l = streetAt(w, h, insets).layout
      const bottom = l.bag.y + l.bag.h

      assert.ok(
        Math.abs(bottom - l.floor) < 0.5,
        `the hoard ends at ${bottom.toFixed(1)} and the floor is ${l.floor.toFixed(1)} — ` +
          `${(l.floor - bottom).toFixed(1)}px of nothing under the keep pile`,
      )
      // The floor itself clears BOTH hazards. Android's gesture strip reports an
      // inset of ZERO on many devices — it is an overlay, not a cutout — so the
      // bottom inset alone is not enough and never was.
      assert.ok(
        l.floor <= h - GESTURE_STRIP + 0.001,
        `the floor at ${l.floor.toFixed(1)} is inside the ${String(GESTURE_STRIP)}px the system swipes in`,
      )
      assert.ok(
        l.floor <= h - insets.bottom + 0.001,
        `the floor at ${l.floor.toFixed(1)} is under the ${String(insets.bottom)}px bottom inset`,
      )
      // The shots ride directly above it rather than floating somewhere.
      assert.ok(l.shots.y + l.shots.h <= l.bag.y + 0.5, "the shots are inside the hoard")
      assert.ok(
        l.bag.y - (l.shots.y + l.shots.h) < (l.floor - l.ceiling) * 0.1,
        "the shots have drifted away from the hoard they belong to",
      )
    })

    test(`THE CHUTE IS LOCKED TO THE TOP — ${shape} (${String(w)}×${String(h)}), ${where}`, () => {
      const l = streetAt(w, h, insets).layout
      assert.ok(
        Math.abs(l.chute.y - l.ceiling) < 0.5,
        `the chute starts at ${l.chute.y.toFixed(1)} and the ceiling is ${l.ceiling.toFixed(1)}`,
      )
      // And the ceiling clears everything the HOST paints over the game: both 44px
      // corner controls and the progress hairline. The chute is pinned BELOW them
      // rather than threading between them, which is the only placement correct at
      // every width — at 320px there are 192px between the two corners and at 320px
      // in landscape with a side notch there are fewer.
      const exit = exitRect(insets)
      const help = helpRect(w, insets)
      assert.ok(l.ceiling >= exit.y + exit.h, `the ceiling is inside the exit control`)
      assert.ok(l.ceiling >= help.y + help.h, `the ceiling is inside the how-to-play control`)
      assert.ok(l.ceiling >= insets.top + HOST_PROGRESS_H, `the ceiling is under the progress hairline`)
      assert.equal(hitsHostChrome(l.chute, w, insets), false)
    })

    test(`NOTHING OVERLAPS AND NO BAND IS DEAD — ${shape} (${String(w)}×${String(h)}), ${where}`, () => {
      const l = streetAt(w, h, insets).layout
      const column = columnOf(l)

      // In order, top to bottom, with nothing sitting on anything else.
      let cursor = l.ceiling
      for (const [name, box] of column) {
        assert.ok(
          box.y >= cursor - 0.5,
          `${name} ${show(box)} starts at ${box.y.toFixed(1)}, above ${cursor.toFixed(1)}`,
        )
        cursor = box.y + box.h
      }
      assert.ok(cursor <= l.floor + 0.5, `the column runs ${(cursor - l.floor).toFixed(1)}px past the floor`)

      // ── the founder's actual complaint, as two numbers ──────────────────
      //
      // The layout this replaced measured everything downward from the slate and
      // then simply stopped: on a 320×568 phone with a notch it left 163px — 39%
      // of the column — dead in one continuous strip below the hoard, and covered
      // only 39% of it. Those are the numbers this asserts against, and the old
      // layout fails both by a wide margin.
      // The chevrons and the marks each keep their own band inside their own
      // destination. "Put the mark in the middle of the chevrons" is legible on a
      // 190px iPad hoard and a smudge on a 40px one, which is why these are
      // rectangles rather than fractions written into the drawing code.
      for (const [name, band, host] of [
        ["the chute's chevrons", l.chuteFlow, l.chute],
        ["the ≠ mark", l.chuteMark, l.chute],
        ["the hoard's chevrons", l.hoardFlow, l.bag],
        ["the = mark", l.hoardMark, l.bag],
      ] as const) {
        assert.ok(band.y >= host.y - 0.001, `${name} starts above its destination`)
        assert.ok(band.y + band.h <= host.y + host.h + 0.001, `${name} runs past its destination`)
        assert.ok(band.h > 0, `${name} has no height`)
      }
      const apart = (a: Rect, b: Rect): boolean => a.y + a.h <= b.y + 0.001 || b.y + b.h <= a.y + 0.001
      assert.ok(apart(l.chuteFlow, l.chuteMark), "the ≠ is drawn through the chevrons")
      assert.ok(apart(l.hoardFlow, l.hoardMark), "the = is drawn through the chevrons")
      // And the mark fits the band it was sized for, rather than overflowing the
      // one thing on the street that has to be readable at 40px.
      assert.ok(
        l.markPx * 0.75 <= Math.min(l.chuteMark.h, l.hoardMark.h) + 1,
        `a ${String(l.markPx)}px mark in a ${Math.min(l.chuteMark.h, l.hoardMark.h).toFixed(1)}px band`,
      )
      // The pile, the lip and the count stack down the hoard without colliding.
      assert.ok(l.hoardMark.y + l.hoardMark.h <= l.lipY + 0.001, "the = mark sits on the lip")
      assert.ok(l.lipY < l.countY, "the count is above the lip it sits on")
      assert.ok(l.countY < l.pileY, "the count is buried in the card stack")
      assert.ok(l.pileY + l.cardH <= l.bag.y + l.bag.h, "the card stack runs out of the hoard")

      const { covered, deadest } = densityOf(l)
      assert.ok(
        covered >= 0.55,
        `only ${(covered * 100).toFixed(0)}% of the playable column is used at ${String(w)}×${String(h)} ${where}`,
      )
      assert.ok(
        deadest <= 0.2,
        `a dead band of ${(deadest * 100).toFixed(0)}% of the column at ${String(w)}×${String(h)} ${where}`,
      )
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
      assert.ok(
        l.chute.y + l.chute.h <= l.slate.y + 0.5,
        `the chute overlaps the slate at ${String(w)}×${String(h)}`,
      )
      assert.ok(
        l.bag.y >= l.shots.y + l.shots.h - 0.5,
        `the bag rides up onto the shots at ${String(w)}×${String(h)}`,
      )
    }
  }
})

test("the two destinations are on the two sides of the slate, always", () => {
  // The whole affordance depends on it: up is the chute, down is the bag. A layout
  // that put them the same side of the slate, or crossed them, would make the gesture
  // a thing a child has to remember instead of a thing they can see.
  for (const [shape, w, h] of VIEWPORTS) {
    for (const [where, insets] of INSETS) {
      const l = streetAt(w, h, insets).layout
      assert.ok(
        l.chute.y + l.chute.h <= l.slate.y + 0.5,
        `${shape} ${where}: the chute is not above the slate`,
      )
      assert.ok(
        l.bag.y >= l.slate.y + l.slate.h,
        `${shape} ${where}: the bag is not below the slate`,
      )
      assert.ok(l.bag.w > 0 && l.bag.h > 0 && l.chute.h > 0, `${shape} ${where}: a zero-size target`)
    }
  }
})

test("the bag is wide enough to read a four-digit coin count in", () => {
  for (const [shape, w, h] of VIEWPORTS) {
    const l = streetAt(w, h, NO_INSETS).layout
    assert.ok(
      l.bag.w >= l.bagPx * 2.4,
      `${shape}: a ${l.bag.w.toFixed(0)}px bag for ${String(l.bagPx)}px numerals`,
    )
  }
})

test("the statement stays big enough to read at the smallest phone", () => {
  // The clamp that keeps the slate clear of the corners must not do it by
  // shrinking the one thing in the game a child has to read.
  const l = streetAt(320, 568, { top: 47, right: 0, bottom: 34, left: 0 }).layout
  assert.ok(l.slate.w >= 240, `the slate is ${l.slate.w.toFixed(1)}px wide`)
  assert.ok(l.slate.h >= 70, `the slate is ${l.slate.h.toFixed(1)}px tall`)
})
