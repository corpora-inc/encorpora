import { test } from "node:test"
import assert from "node:assert/strict"

import { columnAt, columnX, makeGeom, project } from "../render/geom.ts"

const SIZES: [number, number][] = [
  [320, 568], // the smallest phone this ships to
  [390, 844],
  [768, 1024], // iPad portrait
  [1280, 800], // desktop and tablet landscape are first-class targets
]

test("the lattice fits inside every viewport, with room for its labels", () => {
  for (const [w, h] of SIZES) {
    const g = makeGeom(w, h, 5)
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
  const g = makeGeom(768, 1024, 5)
  const far = project(g, 0, 0)
  const near = project(g, 0, 1)
  assert.equal(far.y, g.horizonY)
  assert.equal(far.x, g.vpX, "every beam starts at the vanishing point")
  assert.equal(near.y, g.floorY)
  assert.equal(near.x, columnX(g, 0))
  assert.equal(near.scale, 1)
})

test("descent accelerates toward the child rather than sliding at a constant rate", () => {
  const g = makeGeom(390, 844, 5)
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
  const g = makeGeom(390, 844, 5)
  assert.deepEqual(project(g, 2, -3), project(g, 2, 0))
  assert.deepEqual(project(g, 2, 9), project(g, 2, 1))
})

test("a tap anywhere on the floor lands on a real beam", () => {
  for (const [w, h] of SIZES) {
    const g = makeGeom(w, h, 5)
    for (let x = -40; x <= w + 40; x += 3) {
      const c = columnAt(g, x)
      assert.ok(Number.isInteger(c) && c >= 0 && c <= 4, `tap at ${x} chose ${c}`)
    }
    // And a tap on a beam's own foot chooses that beam.
    for (let c = 0; c < 5; c++) assert.equal(columnAt(g, columnX(g, c)), c)
  }
})

test("a single-beam lattice degenerates without dividing by zero", () => {
  const g = makeGeom(390, 844, 1)
  assert.equal(columnX(g, 0), g.vpX)
  assert.equal(columnAt(g, 300), 0)
  assert.ok(Number.isFinite(project(g, 0, 0.5).x))
})
