import assert from 'node:assert/strict'
import { test } from 'node:test'

import { G, GRAZE_M, heightAtX, posAt, resolve, samplePath, shotScore, solve } from './ballistics.ts'

// Angles, not settings. `solve` is the physics and it has to be right at any
// angle; the game only ever throws at `LOFT_DEG`.
const LOFTS = [26, 34, 42, 52, 63]

test('the dial IS the range: landing = power + wind, exactly, for every integer input', () => {
  for (let R = 8; R <= 122; R++) {
    for (const a of LOFTS) {
      for (const wind of [-9, -4, 0, 3, 9]) {
        const s = solve(R, a, wind)
        assert.equal(s.landing, R + wind, `R=${R} a=${a} w=${wind}`)
        assert.ok(Number.isInteger(s.landing))
      }
    }
  }
})

test('the arc actually arrives where the integer says it does', () => {
  for (let R = 10; R <= 120; R += 7) {
    for (const a of LOFTS) {
      for (const wind of [-6, 0, 5]) {
        const s = solve(R, a, wind)
        const end = posAt(s, s.T)
        assert.ok(Math.abs(end.x - (R + wind)) < 1e-9, `x drift R=${R}`)
        assert.ok(Math.abs(end.y) < 1e-9, `y drift R=${R}`)
      }
    }
  }
})

test('the launch angle changes the shape of the arc, never the landing', () => {
  const flat = solve(70, LOFTS[0], 0)
  const high = solve(70, LOFTS[4], 0)
  assert.equal(flat.landing, high.landing)
  assert.ok(high.apexY > flat.apexY * 1.8, 'a high loft must actually be high')
  assert.ok(high.T > flat.T, 'a high loft must hang longer')
})

test('a high angle clears an obstacle a flat one hits', () => {
  const wallX = 30
  const flat = heightAtX(solve(80, LOFTS[0], 0), wallX)
  const high = heightAtX(solve(80, LOFTS[4], 0), wallX)
  assert.ok(high > flat + 8, `flat=${flat} high=${high}`)
})

test('gravity is the only thing pulling down: apex time = vy/g', () => {
  const s = solve(64, 42, 0)
  assert.ok(Math.abs(s.apexT - s.vy / G) < 1e-12)
  const apex = posAt(s, s.apexT)
  assert.ok(Math.abs(apex.y - s.apexY) < 1e-9)
})

test('wind bends the path but never the arithmetic', () => {
  const still = solve(60, 42, 0)
  const blown = solve(60, 42, 6)
  assert.equal(blown.landing - still.landing, 6)
  assert.ok(Math.abs(blown.T - still.T) < 1e-12, 'wind is horizontal only')
  const mid = posAt(blown, blown.T / 2)
  const midStill = posAt(still, still.T / 2)
  assert.ok(mid.x > midStill.x, 'a tailwind must visibly push it along')
})

test('outcome tiers are integer compares — 0, 1, 3 metres and out', () => {
  const towers = [
    { id: 0, range: 30, value: 30, alive: true },
    { id: 1, range: 56, value: 56, alive: true },
    { id: 2, range: 90, value: 90, alive: true },
  ]
  assert.equal(resolve(56, towers).quality, 'direct')
  assert.equal(resolve(57, towers).quality, 'solid')
  assert.equal(resolve(55, towers).quality, 'solid')
  assert.equal(resolve(59, towers).quality, 'graze')
  assert.equal(resolve(53, towers).quality, 'graze')
  assert.equal(resolve(60, towers).quality, 'miss')
  assert.equal(resolve(60, towers).target, null)
  assert.equal(resolve(59, towers).errorM, GRAZE_M)
  assert.equal(resolve(56, towers).target?.value, 56)
})

test('a dead keep is not a target', () => {
  const towers = [
    { id: 0, range: 40, value: 40, alive: false },
    { id: 1, range: 70, value: 70, alive: true },
  ]
  assert.equal(resolve(40, towers).quality, 'miss')
  assert.equal(resolve(70, towers).quality, 'direct')
})

test('being wrong is never worth more than being right', () => {
  for (let combo = 0; combo < 12; combo++) {
    assert.ok(shotScore('direct', combo, 0.5) > shotScore('solid', combo, 0.5))
    assert.equal(shotScore('graze', combo, 0.5), 0)
    assert.equal(shotScore('miss', combo, 0.5), 0)
  }
})

test('sampled path is finite and starts at the launch height', () => {
  const s = solve(100, 42, -7)
  const pts = samplePath(s, 40)
  assert.equal(pts.length, 41)
  assert.ok(Math.abs(pts[0].y - s.h) < 1e-9)
  for (const p of pts) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y))
  }
})
