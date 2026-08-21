import { test } from "node:test"
import assert from "node:assert/strict"
import { centroid, clipHalfPlane, regularPolygon, segPointDistSq } from "../core/geom.ts"

function poly(pts: number[][]): { a: Float32Array; n: number } {
  const a = new Float32Array(pts.length * 2)
  pts.forEach((p, i) => {
    a[i * 2] = p[0] as number
    a[i * 2 + 1] = p[1] as number
  })
  return { a, n: pts.length }
}

function area(src: Float32Array, n: number): number {
  let s = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    s += (src[i * 2] as number) * (src[j * 2 + 1] as number)
    s -= (src[j * 2] as number) * (src[i * 2 + 1] as number)
  }
  return Math.abs(s) / 2
}

test("a cut conserves area: the two halves sum to the whole", () => {
  const sq = poly([
    [-10, -10],
    [10, -10],
    [10, 10],
    [-10, 10],
  ])
  const whole = area(sq.a, sq.n)
  const dst = new Float32Array(32)
  // Try a fan of cut angles and offsets.
  for (let k = 0; k < 40; k++) {
    const ang = (k / 40) * Math.PI
    const nx = Math.cos(ang)
    const ny = Math.sin(ang)
    for (const off of [-6, -2, 0, 3, 7]) {
      const px = nx * off
      const py = ny * off
      const nA = clipHalfPlane(sq.a, sq.n, px, py, nx, ny, true, dst)
      const aA = nA >= 3 ? area(dst, nA) : 0
      const nB = clipHalfPlane(sq.a, sq.n, px, py, nx, ny, false, dst)
      const aB = nB >= 3 ? area(dst, nB) : 0
      assert.ok(
        Math.abs(aA + aB - whole) < 0.02,
        `angle ${ang.toFixed(2)} off ${off}: ${aA} + ${aB} != ${whole}`,
      )
    }
  }
})

test("a cut that misses the shape leaves one whole half and one empty", () => {
  const sq = poly([
    [-10, -10],
    [10, -10],
    [10, 10],
    [-10, 10],
  ])
  const dst = new Float32Array(32)
  const nA = clipHalfPlane(sq.a, sq.n, 0, 40, 0, 1, true, dst)
  const nB = clipHalfPlane(sq.a, sq.n, 0, 40, 0, 1, false, dst)
  assert.ok(nA < 3, "nothing should survive above a line far above the shape")
  assert.equal(nB, 4)
})

test("clipping never writes past the documented n+2 bound", () => {
  const p = poly([
    [-10, -10],
    [10, -10],
    [10, 10],
    [-10, 10],
  ])
  const dst = new Float32Array((p.n + 2) * 2)
  for (let k = 0; k < 60; k++) {
    const ang = (k / 60) * Math.PI * 2
    const n = clipHalfPlane(p.a, p.n, 0, 0, Math.cos(ang), Math.sin(ang), true, dst)
    assert.ok(n <= p.n + 2, `produced ${n} points from ${p.n}`)
  }
})

test("centroid of a symmetric polygon is its centre", () => {
  const sq = poly([
    [-8, -8],
    [8, -8],
    [8, 8],
    [-8, 8],
  ])
  const out = new Float32Array(2)
  const a = centroid(sq.a, sq.n, out)
  assert.ok(Math.abs(out[0] as number) < 1e-4)
  assert.ok(Math.abs(out[1] as number) < 1e-4)
  assert.ok(Math.abs(a - 256) < 1e-3)
})

test("a degenerate sliver still yields a finite centroid", () => {
  const sliver = poly([
    [0, 0],
    [1e-4, 0],
    [1e-4, 1e-4],
  ])
  const out = new Float32Array(2)
  centroid(sliver.a, sliver.n, out)
  assert.ok(Number.isFinite(out[0] as number) && Number.isFinite(out[1] as number))
})

test("segment/point distance is exact at the ends and in the middle", () => {
  assert.equal(segPointDistSq(0, 0, 10, 0, 5, 3), 9)
  assert.equal(segPointDistSq(0, 0, 10, 0, -4, 0), 16)
  assert.equal(segPointDistSq(0, 0, 10, 0, 14, 0), 16)
  // A zero-length segment degrades to point distance rather than NaN.
  assert.equal(segPointDistSq(3, 3, 3, 3, 3, 8), 25)
})

test("a regular polygon has the requested radius and winding", () => {
  const dst = new Float32Array(24)
  const n = regularPolygon(dst, 11, 20, 0, 0, () => 0.5)
  assert.equal(n, 11)
  for (let i = 0; i < n; i++) {
    const r = Math.hypot(dst[i * 2] as number, dst[i * 2 + 1] as number)
    assert.ok(Math.abs(r - 20) < 1e-3, `vertex ${i} radius ${r}`)
  }
})
