import { test } from "node:test"
import assert from "node:assert/strict"

import { strapworkTile, pathPoints, type StrapworkSpec } from "./strapwork.ts"

const spec: StrapworkSpec = { unit: 24, height: 12, inset: 2, knot: 2 }

test("the tile repeats seamlessly", () => {
  // The whole point of a tile: the strap arrives at the right edge exactly
  // where the next copy starts on the left. A one-unit drift here shows up as
  // a visible break every repeat, at whatever width the device happens to be.
  const { strapA, strapB } = strapworkTile(spec)
  for (const path of [strapA, strapB]) {
    const points = pathPoints(path)
    const first = points.at(0)!
    const last = points.at(-1)!
    assert.equal(last[0], spec.unit, "tile does not span exactly one unit")
    assert.equal(first[1], last[1], "strap does not meet itself at the seam")
  }
})

test("the straps cross where the knots sit", () => {
  const { strapA, strapB, knots } = strapworkTile(spec)
  const a = pathPoints(strapA)
  const b = pathPoints(strapB)

  // Mirrored straps of equal period cross at a quarter and three quarters.
  assert.deepEqual(a[0], [0, spec.inset])
  assert.deepEqual(b[0], [0, spec.height - spec.inset])

  assert.equal(knots.length, 2)
  const centres = knots.map((k) => {
    const p = pathPoints(k)
    return (p[0]![0] + p[2]![0]) / 2
  })
  assert.deepEqual(centres, [spec.unit / 4, (spec.unit * 3) / 4])
})

test("every coordinate stays inside the band", () => {
  const { strapA, strapB, knots } = strapworkTile(spec)
  for (const path of [strapA, strapB, ...knots]) {
    for (const [x, y] of pathPoints(path)) {
      assert.ok(Number.isFinite(x) && Number.isFinite(y), `non-finite point in ${path}`)
      assert.ok(x >= 0 && x <= spec.unit, `x out of band: ${x}`)
      assert.ok(y >= 0 && y <= spec.height, `y out of band: ${y}`)
    }
  }
})

test("output is byte-identical for identical input", () => {
  assert.deepEqual(strapworkTile(spec), strapworkTile({ ...spec }))
})

test("knot: 0 omits the knots rather than drawing degenerate ones", () => {
  assert.deepEqual(strapworkTile({ ...spec, knot: 0 }).knots, [])
})

test("a band that cannot be drawn throws instead of emitting NaN", () => {
  // NaN in path data renders nothing at all, silently, which is the worst
  // possible failure: the band simply disappears on one device.
  assert.throws(() => strapworkTile({ ...spec, unit: 0 }), RangeError)
  assert.throws(() => strapworkTile({ ...spec, height: -1 }), RangeError)
  assert.throws(() => strapworkTile({ ...spec, inset: 40 }), RangeError)
  assert.throws(() => strapworkTile({ ...spec, unit: Number.NaN }), RangeError)
})

test("a band that would draw outside itself throws too", () => {
  // Clipping is quieter than NaN and just as wrong: the tile keeps its size,
  // so the motif is cropped at the seam on every repeat and nothing errors.
  // `knot` is the tuning knob, which makes it the parameter most likely to be
  // pushed past what the band can hold.
  assert.throws(() => strapworkTile({ ...spec, knot: 20 }), RangeError)
  assert.throws(() => strapworkTile({ ...spec, knot: -1 }), RangeError)
  // Taller than the band it sits in.
  assert.throws(() => strapworkTile({ ...spec, height: 12, knot: 6.5 }), RangeError)
  // Wide enough to reach the next crossing, in a band tall enough to hide it.
  assert.throws(() => strapworkTile({ ...spec, height: 40, knot: 6.5 }), RangeError)

  // Two straps on one flat line is not an interlace.
  assert.throws(() => strapworkTile({ ...spec, inset: spec.height / 2 }), RangeError)

  // And the bounds themselves are still drawable.
  assert.ok(strapworkTile({ ...spec, knot: spec.unit / 4 }).knots.length === 2)
})
