import { test } from "node:test"
import assert from "node:assert/strict"

import { columnAt, columnX, geomForViewport, project } from "../render/geom.ts"

const SIZES: [number, number][] = [
  [320, 568], // the smallest phone this ships to
  [390, 844],
  [768, 1024], // iPad portrait
  [1280, 800], // desktop and tablet landscape are first-class targets
]

test("the lattice fits inside every viewport, with room for its labels", () => {
  for (const [w, h] of SIZES) {
    const g = geomForViewport(w, h, 5)
    for (let c = 0; c < 5; c++) {
      const x = columnX(g, c)
      assert.ok(x >= 0 && x <= w, `beam ${c} foot at ${x} is off a ${w}px screen`)
      assert.ok(x >= g.margin - 0.001 && x <= w - g.margin + 0.001, `beam ${c} has no label room`)
    }
    // Beams never collide: the gap has to stay wide enough to tap.
    const gap = columnX(g, 1) - columnX(g, 0)
    assert.ok(gap > 40, `a ${gap.toFixed(0)}px beam gap cannot be hit with a finger`)
  }
})

test("the projection pins the horizon and the floor exactly", () => {
  const g = geomForViewport(768, 1024, 5)
  const far = project(g, 0, 0)
  const near = project(g, 0, 1)
  assert.equal(far.y, g.horizonY)
  assert.equal(far.x, g.vpX, "every beam starts at the vanishing point")
  assert.equal(near.y, g.floorY)
  assert.equal(near.x, columnX(g, 0))
  assert.equal(near.scale, 1)
})

test("descent accelerates toward the child rather than sliding at a constant rate", () => {
  const g = geomForViewport(390, 844, 5)
  const step = (t: number): number => project(g, 4, t + 0.05).y - project(g, 4, t).y
  assert.ok(step(0.8) > step(0.4), "the last stretch must be the fastest")
  assert.ok(step(0.4) > step(0.05))
  let prev = -1
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const p = project(g, 3, t)
    assert.ok(p.y > prev, "y must be monotone down the lattice")
    prev = p.y
    assert.ok(p.scale > 0 && p.scale <= 1)
  }
})

test("out-of-range t is clamped rather than projected off the world", () => {
  const g = geomForViewport(390, 844, 5)
  assert.deepEqual(project(g, 2, -3), project(g, 2, 0))
  assert.deepEqual(project(g, 2, 9), project(g, 2, 1))
})

test("a tap anywhere on the floor lands on a real beam", () => {
  for (const [w, h] of SIZES) {
    const g = geomForViewport(w, h, 5)
    for (let x = -40; x <= w + 40; x += 3) {
      const c = columnAt(g, x)
      assert.ok(Number.isInteger(c) && c >= 0 && c <= 4, `tap at ${x} chose ${c}`)
    }
    // And a tap on a beam's own foot chooses that beam.
    for (let c = 0; c < 5; c++) assert.equal(columnAt(g, columnX(g, c)), c)
  }
})

test("a single-beam lattice degenerates without dividing by zero", () => {
  const g = geomForViewport(390, 844, 1)
  assert.equal(columnX(g, 0), g.vpX)
  assert.equal(columnAt(g, 300), 0)
  assert.ok(Number.isFinite(project(g, 0, 0.5).x))
})

// ─────────────────────────────────────────────────────────────────────────────
// THE FRAME.
//
// Everything above is about the projection. None of it can see that the hall is
// drawn inside a screen that has a notch cut out of the top of it, a home
// indicator across the bottom, and two 44px squares of host chrome floating
// over the corners.
//
// LATTICE RUNNER shipped wrong on all three. The score was drawn at `(14, 20)`,
// which is the exact square the host paints "back" into. The three anchor
// lamps — which ARE the lives — were drawn at `(w - 14 - 2*18, 18)`, under the
// how-to-play control. And the beam labels, the divisors the entire game is
// played by, were carved at `floorY + (h - floorY) * 0.5` off the GLASS, which
// on a phone with a home indicator is behind the home indicator.

import { anchorsRect, makeGeom } from "../render/geom.ts"
import { hitsHostChrome, safeRect, type Insets } from "../../../../packs/shared/game-chrome/index.ts"

/** The two counts the game actually mounts with. */
const BEAMS = 5
const ANCHORS = 3

const VIEWPORTS: Array<[string, number, number]> = [
  ["phone portrait, small", 320, 568],
  ["phone portrait, tall", 390, 844],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["phone landscape", 844, 390],
]

test("nothing a child must read sits under the host's two corners", () => {
  for (const [name, w, h] of VIEWPORTS) {
    const g = geomForViewport(w, h, BEAMS)

    assert.equal(
      hitsHostChrome(g.hud, w),
      false,
      `${name} (${w}×${h}): the score and resonance block is under host chrome`,
    )
    assert.equal(
      hitsHostChrome(anchorsRect(g, ANCHORS), w),
      false,
      `${name} (${w}×${h}): the anchor lamps are under host chrome`,
    )

    // The beam labels, too. They are at the floor rather than the ceiling, so
    // this can only fail if the hall is ever flipped — but they are the single
    // most important text on the screen and the assertion costs nothing.
    for (let c = 0; c < BEAMS; c++) {
      const box = { x: columnX(g, c) - 18, y: g.labelY - 16, w: 36, h: 32 }
      assert.equal(
        hitsHostChrome(box, w),
        false,
        `${name} (${w}×${h}): beam ${c}'s label is under host chrome`,
      )
    }

    // The two blocks must not collide with each other either, which is the
    // failure mode of "just move everything down".
    assert.ok(
      g.hud.x + g.hud.w <= anchorsRect(g, ANCHORS).x + 0.5 ||
        g.hud.y + g.hud.h <= anchorsRect(g, ANCHORS).y ||
        anchorsRect(g, ANCHORS).y + anchorsRect(g, ANCHORS).h <= g.hud.y,
      `${name}: the score and the anchor lamps overlap`,
    )
  }
})

// Node has no notch, so `safeInsets()` reads zeros and the test above cannot
// tell a hall built inside the safe rectangle from one built against the glass.
// This one can: it hands `makeGeom` the rectangle a real device would give it.
const NOTCHED: Array<[string, number, number, Insets]> = [
  ["phone portrait, notch + home indicator", 390, 844, { top: 59, right: 0, bottom: 34, left: 0 }],
  ["phone landscape, notch on the left", 844, 390, { top: 0, right: 59, bottom: 21, left: 59 }],
  ["small phone", 320, 568, { top: 44, right: 0, bottom: 34, left: 0 }],
]

test("the hall is built inside the safe rectangle, not against the glass", () => {
  for (const [name, w, h, insets] of NOTCHED) {
    const area = safeRect(w, h, insets)
    const g = makeGeom(w, h, BEAMS, area)

    // The beam labels. This is the bug: the divisors were carved into the strip
    // the home indicator sits in.
    assert.ok(
      g.labelY + 16 <= area.y + area.h + 0.5,
      `${name}: the beam labels are under the home indicator`,
    )
    assert.ok(g.labelY > g.floorY, `${name}: the labels climbed above the floor plate`)

    // The lattice itself, left and right. In landscape the notch is on one side
    // and the outermost beam's foot was behind it.
    for (let c = 0; c < BEAMS; c++) {
      const x = columnX(g, c)
      assert.ok(
        x - 18 >= area.x - 0.5 && x + 18 <= area.x + area.w + 0.5,
        `${name}: beam ${c}'s foot at ${x.toFixed(0)} is outside the safe area`,
      )
    }

    // The horizon and the floor.
    assert.ok(g.horizonY >= area.y, `${name}: the horizon is above the safe area`)
    assert.ok(g.floorY <= area.y + area.h, `${name}: the floor plate is below the safe area`)

    // And the corners still hold once there ARE insets, which move both of the
    // host's controls.
    assert.equal(hitsHostChrome(g.hud, w, insets), false, `${name}: the score is under chrome`)
    assert.equal(
      hitsHostChrome(anchorsRect(g, ANCHORS), w, insets),
      false,
      `${name}: the anchor lamps are under chrome`,
    )

    // A tap still chooses the beam under the finger, with the origin shifted.
    for (let c = 0; c < BEAMS; c++) assert.equal(columnAt(g, columnX(g, c)), c)
  }
})
