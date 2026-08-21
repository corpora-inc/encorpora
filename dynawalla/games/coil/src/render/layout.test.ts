import assert from "node:assert/strict"
import test from "node:test"

import { Rng } from "../core/rng.ts"
import { LANE_CELLS, cellAt, cellNear, inside, viewLayout } from "./layout.ts"

const SEED = 0x0c011960

/** Phone portrait, phone landscape, tablet portrait, tablet landscape, desktop. */
const VIEWPORTS: [number, number][] = [
  [320, 568],
  [390, 844],
  [844, 390],
  [768, 1024],
  [1024, 768],
  [1366, 1024],
  [1920, 1080],
]

test("the lane never claims more than ninety-six cells", () => {
  for (const [w, h] of VIEWPORTS) {
    const l = viewLayout(w, h)
    assert.ok(l.lane.capacity <= LANE_CELLS, `${String(w)}×${String(h)}`)
    assert.ok(l.lane.capacity >= 12, `${String(w)}×${String(h)} is playable`)
  }
})

test("nothing overlaps and nothing leaves the viewport", () => {
  for (const [w, h] of VIEWPORTS) {
    const l = viewLayout(w, h)
    assert.ok(l.wall.y >= 0)
    assert.ok(l.wall.x >= 0)
    assert.ok(l.wall.x + l.wall.w <= w + 0.5)
    assert.ok(l.lane.y >= l.wall.y + l.wall.h, `${String(w)}×${String(h)} lane clears the wall`)
    assert.ok(l.levers.y >= l.lane.y + l.lane.h - 0.5)
    assert.ok(l.levers.y + l.levers.h <= h + 0.5)
    assert.ok(l.shear.x + l.shear.w <= l.levers.x + l.levers.w + 0.5)
    assert.ok(l.furnace.x + l.furnace.w < l.shear.x, "the two levers cannot be confused")
  }
})

test("every lever is at least a finger across", () => {
  for (const [w, h] of VIEWPORTS) {
    const l = viewLayout(w, h)
    assert.ok(l.shear.w >= 44 && l.shear.h >= 44, `shear at ${String(w)}×${String(h)}`)
    assert.ok(l.furnace.w >= 44 && l.furnace.h >= 44, `furnace at ${String(w)}×${String(h)}`)
  }
})

test("consecutive lane cells are adjacent — the chain never jumps", () => {
  for (const [w, h] of VIEWPORTS) {
    const l = viewLayout(w, h)
    for (let i = 1; i < l.lane.capacity; i++) {
      const a = cellAt(l.lane, i - 1)
      const b = cellAt(l.lane, i)
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      assert.ok(d <= Math.max(l.lane.pitch, l.lane.rowPitch) + 1, `${String(i)} at ${String(w)}`)
    }
  }
})

test("the serpentine turns at the end of every row and never crosses itself", () => {
  const l = viewLayout(1024, 768)
  const seen = new Set<string>()
  for (let i = 0; i < l.lane.capacity; i++) {
    const c = cellAt(l.lane, i)
    const key = `${String(Math.round(c.x))}:${String(Math.round(c.y))}`
    assert.equal(seen.has(key), false, `cell ${String(i)} is its own`)
    seen.add(key)
  }
  assert.equal(cellAt(l.lane, 0).dir, 1)
  assert.equal(cellAt(l.lane, l.lane.cols).dir, -1)
})

test("cellNear finds the cell under a point and refuses one that is not", () => {
  const l = viewLayout(768, 1024)
  const rng = new Rng(SEED ^ 0xdd)
  for (let k = 0; k < 200; k++) {
    const i = rng.int(0, l.lane.capacity - 1)
    const c = cellAt(l.lane, i)
    const jitter = l.lane.pitch * 0.2
    const hit = cellNear(l.lane, c.x + rng.range(-jitter, jitter), c.y + rng.range(-jitter, jitter), l.lane.capacity)
    assert.equal(hit, i)
  }
  assert.equal(cellNear(l.lane, -500, -500, l.lane.capacity), -1)
})

test("a point inside a rect is inside it", () => {
  const l = viewLayout(1024, 768)
  assert.equal(inside(l.shear, l.shear.x + 1, l.shear.y + 1), true)
  assert.equal(inside(l.shear, l.shear.x - 1, l.shear.y + 1), false)
  assert.equal(inside(l.furnace, l.shear.x + 1, l.shear.y + 1), false)
})

test("the layout is a pure function of the viewport", () => {
  for (const [w, h] of VIEWPORTS) {
    assert.deepEqual(viewLayout(w, h), viewLayout(w, h))
  }
})
