import { test } from "node:test"
import assert from "node:assert/strict"
import { Kick, Shake, noise1 } from "./shake.ts"

test("noise is coherent where random is not — this is shake vs buzz", () => {
  // Sample the noise and Math.random at the same rate the shake does and
  // compare mean absolute frame-to-frame delta. Coherent noise moves smoothly;
  // uncorrelated random jumps by ~0.5 of full range every frame, which is the
  // visual difference between a camera shaking and a camera vibrating.
  const step = 26 / 60 // 26 Hz sampled at 60 fps
  let noiseDelta = 0
  let prev = noise1(0, 7)
  for (let i = 1; i < 2000; i++) {
    const v = noise1(i * step, 7)
    noiseDelta += Math.abs(v - prev)
    prev = v
  }
  noiseDelta /= 1999

  let randDelta = 0
  let p = Math.random() * 2 - 1
  for (let i = 1; i < 2000; i++) {
    const v = Math.random() * 2 - 1
    randDelta += Math.abs(v - p)
    p = v
  }
  randDelta /= 1999

  assert.ok(
    noiseDelta < randDelta * 0.55,
    `noise ${noiseDelta.toFixed(3)} vs random ${randDelta.toFixed(3)}`,
  )
})

test("noise is continuous across integer boundaries", () => {
  for (let i = -3; i < 3; i++) {
    const a = noise1(i + 0.999, 11)
    const b = noise1(i + 1.001, 11)
    assert.ok(Math.abs(a - b) < 0.02, `discontinuity at ${String(i + 1)}`)
  }
})

test("noise stays inside [-1, 1]", () => {
  let lo = 1
  let hi = -1
  for (let i = 0; i < 20000; i++) {
    const v = noise1(i * 0.37, 3)
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  assert.ok(lo >= -1 && hi <= 1, `range ${lo.toFixed(3)}..${hi.toFixed(3)}`)
})

test("amplitude is trauma squared — a small hit barely registers", () => {
  const s = new Shake({ decayPerSec: 0, exponent: 2, maxOffset: 100 })
  s.add(0.5)
  let halfPeak = 0
  for (let i = 0; i < 200; i++) {
    s.update(16.67)
    halfPeak = Math.max(halfPeak, Math.abs(s.x))
  }
  const s2 = new Shake({ decayPerSec: 0, exponent: 2, maxOffset: 100 })
  s2.add(1)
  let fullPeak = 0
  for (let i = 0; i < 200; i++) {
    s2.update(16.67)
    fullPeak = Math.max(fullPeak, Math.abs(s2.x))
  }
  // Quadratic: half the trauma is a quarter of the shake, not half of it.
  const ratio = halfPeak / fullPeak
  assert.ok(ratio > 0.2 && ratio < 0.3, `ratio ${ratio.toFixed(3)} is not quadratic`)
})

test("trauma decays to exactly zero and the output stops", () => {
  const s = new Shake({ decayPerSec: 1.4 })
  s.add(1)
  for (let i = 0; i < 120; i++) s.update(16.67)
  assert.equal(s.trauma, 0)
  assert.equal(s.x, 0)
  assert.equal(s.y, 0)
  assert.equal(s.roll, 0)
})

test("trauma saturates — you cannot bank shake", () => {
  const s = new Shake()
  for (let i = 0; i < 20; i++) s.add(0.5)
  assert.equal(s.trauma, 1)
})

test("the three axes are decorrelated, not one wave delayed", () => {
  const s = new Shake({ decayPerSec: 0, maxOffset: 1, maxRoll: 1 })
  s.add(1)
  let dot = 0
  let nx = 0
  let ny = 0
  for (let i = 0; i < 600; i++) {
    s.update(16.67)
    dot += s.x * s.y
    nx += s.x * s.x
    ny += s.y * s.y
  }
  const corr = Math.abs(dot / Math.sqrt(nx * ny))
  assert.ok(corr < 0.3, `x and y correlate at ${corr.toFixed(3)} — reads as a diagonal slide`)
})

test("settle bleeds off rather than snapping to zero", () => {
  const s = new Shake()
  s.add(1)
  s.update(16.67)
  s.settle()
  assert.ok(s.trauma > 0 && s.trauma <= 0.08, "a hard cut to zero reads as a bug")
})

test("kick is directional and returns", () => {
  const k = new Kick()
  k.add(5, 0, 0)
  let maxX = 0
  let maxY = 0
  for (let i = 0; i < 200; i++) {
    k.update(16.67)
    maxX = Math.max(maxX, Math.abs(k.x))
    maxY = Math.max(maxY, Math.abs(k.y))
  }
  assert.ok(maxX > 0.01, "no travel along the impact axis")
  assert.equal(maxY, 0, "an X impulse must not move Y")
  assert.ok(k.isAtRest())
})

test("kick overshoots exactly once — the thunk", () => {
  // Counting raw sign changes counts the denormal tail too: the first version
  // of this test reported 67 crossings for a spring whose *visible* motion
  // crosses zero once. Crossings are only counted above 2% of peak, which is
  // roughly where a 0.3-unit camera recoil stops being a pixel.
  const k = new Kick()
  k.add(0, -0.3, 0)
  const ys: number[] = []
  let peak = 0
  for (let i = 0; i < 300; i++) {
    k.update(8)
    ys.push(k.y)
    peak = Math.max(peak, Math.abs(k.y))
  }
  let crossings = 0
  let sign = 0
  for (const y of ys) {
    if (Math.abs(y) < peak * 0.02) continue
    const cur = Math.sign(y)
    if (cur !== 0 && sign !== 0 && cur !== sign) crossings++
    if (cur !== 0) sign = cur
  }
  assert.equal(crossings, 1, `${String(crossings)} visible crossings`)
})

test("kick arguments are peak displacement, not arbitrary impulse", () => {
  // The bug this catches: a tier asking for a 0.3-unit recoil got 0.00125.
  const k = new Kick()
  k.add(0, -0.3, 0)
  let peak = 0
  for (let i = 0; i < 200; i++) {
    k.update(4)
    peak = Math.max(peak, Math.abs(k.y))
  }
  assert.ok(
    Math.abs(peak - 0.3) < 0.02,
    `asked for 0.3 units of recoil, got ${peak.toFixed(4)}`,
  )
})
