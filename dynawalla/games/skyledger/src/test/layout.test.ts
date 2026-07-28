// THE ROOM.
//
// The first draft of this game drew a beautiful astrolabe sitting directly on
// top of the horizon with the ruled plane squeezed into a strip above it, and
// nothing in the test suite noticed, because a layout bug is invisible to every
// test that is about rules. This file is that gate.
//
// It runs the layout at the shapes the fleet actually has — phones held tall
// and wide, tablets both ways, a desktop window — and asserts the things a
// screenshot would have shown: everything is on screen, the instrument does not
// stand on the sky, the lamps have room to burn under the plane, and the
// figures are big enough to read.
//
// Tablet and desktop are first-class here. Neither is a stretched phone.

import assert from "node:assert/strict"
import { test } from "node:test"

import { dialReach, lampGeometry, layoutFor, starPoint, stationPoint } from "../render/sky.ts"

const VIEWPORTS: Array<[string, number, number]> = [
  ["phone portrait", 360, 640],
  ["phone portrait, tall", 390, 844],
  ["phone portrait, small", 320, 568],
  ["phone landscape", 844, 390],
  ["tablet portrait", 768, 1024],
  ["tablet landscape", 1024, 768],
  ["iPad landscape", 1180, 820],
  ["iPad portrait", 820, 1180],
  ["laptop", 1440, 900],
  ["desktop wide", 1920, 1080],
  ["square", 700, 700],
]

for (const [name, w, h] of VIEWPORTS) {
  test(`the room holds together at ${name} (${w}×${h})`, () => {
    const l = layoutFor(w, h)
    const reach = dialReach(l)

    // Everything is on the glass.
    assert.ok(l.sky.x >= 0 && l.sky.y >= 0, "the sky starts off screen")
    assert.ok(l.sky.x + l.sky.w <= w + 0.5, "the sky runs off the right")
    assert.ok(l.sky.y + l.sky.h <= h + 0.5, "the sky runs off the bottom")
    assert.ok(l.dial.cx - reach >= -0.5, "the astrolabe runs off the left")
    assert.ok(l.dial.cx + reach <= w + 0.5, "the astrolabe runs off the right")
    assert.ok(l.dial.cy - reach >= -0.5, "the astrolabe runs off the top")
    assert.ok(l.dial.cy + reach <= h + 0.5, "the astrolabe runs off the bottom")

    // The instrument does not stand on the sky. This is the bug that shipped
    // in the first draft, and it is one inequality.
    const gapX = Math.max(l.sky.x - l.dial.cx, l.dial.cx - (l.sky.x + l.sky.w), 0)
    const gapY = Math.max(l.sky.y - l.dial.cy, l.dial.cy - (l.sky.y + l.sky.h), 0)
    assert.ok(
      Math.hypot(gapX, gapY) >= reach - 0.5,
      `the astrolabe overlaps the sky (clearance ${Math.hypot(gapX, gapY).toFixed(1)} < ${reach.toFixed(1)})`,
    )

    // The ruled plane is inside the sky, square, and clear of the lamps.
    assert.ok(l.plane.x >= l.sky.x, "the plane runs out the left of the sky")
    assert.ok(l.plane.x + l.plane.w <= l.sky.x + l.sky.w + 0.5, "the plane runs out the right")
    assert.ok(l.plane.y >= l.sky.y, "the plane runs out the top of the sky")
    assert.equal(Math.round(l.plane.w), Math.round(l.plane.h), "the lattice is not square")
    assert.equal(Math.round(l.plane.w), Math.round(l.cell * 9))

    const lamp = lampGeometry(l)
    const figuresEnd = l.plane.y + l.plane.h + l.cell * 0.66 + Math.min(l.cell * 0.34, 28)
    assert.ok(
      figuresEnd <= lamp.top + 0.5,
      `the axis figures overlap the lamps by ${(figuresEnd - lamp.top).toFixed(1)}px`,
    )

    // Room for the axis figures on the left, too.
    assert.ok(l.plane.x - l.sky.x >= l.cell * 0.34, "no room for the TENS figures")

    // Legibility: a lattice a child cannot read the figures on is not a
    // coordinate plane, it is graph paper.
    assert.ok(l.cell >= 16, `the lattice cell is ${l.cell.toFixed(1)}px — the figures collide`)
    assert.ok(l.dial.r >= 60, `the astrolabe is ${l.dial.r.toFixed(1)}px — it cannot be turned`)

    // A station and a star both land where they are supposed to.
    const origin = stationPoint(l, 0, 0)
    const far = stationPoint(l, 9, 9)
    assert.ok(far.px > origin.px, "the ONES axis runs the wrong way")
    assert.ok(far.py < origin.py, "the TENS axis does not climb")

    const top = starPoint(l, 0.5, 0)
    const ground = starPoint(l, 0.5, 1)
    assert.ok(top.py > l.ceiling, "a star is released above the aperture")
    assert.equal(Math.round(ground.py), Math.round(l.horizon))
    for (const lane of [0, 0.5, 1]) {
      const p = starPoint(l, lane, 0.4)
      assert.ok(p.px >= l.sky.x && p.px <= l.sky.x + l.sky.w, `lane ${lane} falls outside the sky`)
    }
  })
}

test("the layout flips between two rooms rather than stretching one", () => {
  const wide = layoutFor(1024, 768)
  const tall = layoutFor(768, 1024)
  assert.equal(wide.landscape, true)
  assert.equal(tall.landscape, false)
  // Beside, in landscape; under, in portrait.
  assert.ok(wide.dial.cx > wide.sky.x + wide.sky.w, "the astrolabe did not move beside the sky")
  assert.ok(tall.dial.cy > tall.sky.y + tall.sky.h, "the astrolabe did not move under the sky")
})

test("the sky gets the larger share of the room, at every shape", () => {
  for (const [name, w, h] of VIEWPORTS) {
    const l = layoutFor(w, h)
    const sky = l.sky.w * l.sky.h
    const dial = Math.PI * dialReach(l) ** 2
    assert.ok(sky > dial, `${name}: the instrument takes more room than the sky it reads`)
  }
})
