import { test } from "node:test"
import assert from "node:assert/strict"

import { Feel } from "../core/feel.ts"

test("reduced motion is a branch, not a degradation: nothing travels at all", () => {
  const f = new Feel({ reducedMotion: true })
  f.addTrauma(1)
  f.kick(1, 1, 40)
  f.punch(0.4)
  f.hitstop(200)
  f.slowmo(0.2, 800)
  f.requestFlash(0.4, "#fff")
  const simMs = f.advance(16, 1000)
  assert.equal(simMs, 16, "a reduced-motion frame must never be frozen")
  assert.equal(f.shakeX, 0)
  assert.equal(f.shakeY, 0)
  assert.equal(f.scale, 1)
  assert.equal(f.flashAlpha, 0)
  assert.equal(f.timeScale(), 1)
})

test("a hitstop freezes the simulation and then hands the time back", () => {
  const f = new Feel({ reducedMotion: false })
  f.hitstop(90)
  assert.equal(f.advance(16, 0), 0)
  assert.equal(f.advance(16, 16), 0)
  let now = 32
  for (let i = 0; i < 8; i++) {
    now += 16
    if (f.advance(16, now) > 0) break
  }
  assert.ok(f.advance(16, now + 16) > 0, "the freeze never released")
})

test("flashes are rate-limited and capped, so a fast run cannot strobe", () => {
  const f = new Feel({ reducedMotion: false })
  let peak = 0
  let now = 0
  for (let i = 0; i < 240; i++) {
    now += 16
    f.requestFlash(1, "#fff")
    f.advance(16, now)
    peak = Math.max(peak, f.flashAlpha)
  }
  // Four seconds of a flash requested on every single frame.
  assert.ok(peak <= 0.42 + 1e-9, `flash reached ${peak}`)
})

test("slow motion recovers to real time and never speeds it up", () => {
  const f = new Feel({ reducedMotion: false })
  f.advance(16, 1000)
  f.slowmo(0.3, 400)
  f.advance(16, 1000)
  assert.ok(f.timeScale() < 1)
  f.advance(16, 1500)
  assert.equal(f.timeScale(), 1)
  for (let t = 1000; t <= 1500; t += 20) {
    f.advance(16, t)
    assert.ok(f.timeScale() <= 1 + 1e-9, "time must never run fast")
  }
})

test("reset puts the camera back where it started", () => {
  const f = new Feel({ reducedMotion: false })
  f.addTrauma(1)
  f.kick(1, 0, 30)
  f.punch(0.3)
  f.reset()
  f.advance(16, 2000)
  assert.ok(Math.abs(f.shakeX) < 1e-6)
  assert.ok(Math.abs(f.scale - 1) < 1e-6)
  assert.equal(f.flashAlpha, 0)
})
