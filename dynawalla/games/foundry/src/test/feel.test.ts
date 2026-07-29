// The response layer, and the reduced-motion branch.
//
// Reduced motion is a branch and not a degradation: the game still says
// everything it said, it just says it without travel. So the assertion is not
// "the numbers are smaller" — it is that every motion channel is exactly zero
// while the information channels are untouched.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Feel } from "../core/feel.ts"
import { Rng } from "../core/rng.ts"
import { safeRect } from "../../../../packs/shared/game-chrome/index.ts"
import { computeLayout, matHalfWidth } from "../render/layout.ts"

test("reduced motion zeroes every motion channel", () => {
  const feel = new Feel({ reducedMotion: true })
  feel.addTrauma(1)
  feel.kick(1, 1, 40)
  feel.punch(0.5)
  feel.hitstop(400)
  feel.slowmo(0.2, 400)
  feel.requestFlash(1, "#ffffff")
  const advanced = feel.advance(16, 16)
  assert.equal(advanced, 16, "a hitstop must never be served under reduced motion")
  assert.equal(feel.shakeX, 0)
  assert.equal(feel.shakeY, 0)
  assert.equal(feel.scale, 1)
  assert.equal(feel.flashAlpha, 0)
  assert.equal(feel.timeScale(), 1)
})

test("a hitstop stops the simulation and then gives the time back", () => {
  const feel = new Feel({ reducedMotion: false })
  feel.hitstop(50)
  assert.equal(feel.advance(16, 16), 0)
  assert.equal(feel.advance(16, 32), 0)
  assert.equal(feel.advance(16, 48), 0)
  assert.equal(feel.advance(16, 64), 0)
  assert.ok(feel.advance(16, 80) > 0, "the freeze has to end")
})

test("flashes are rate-limited rather than queued, and capped", () => {
  const feel = new Feel({ reducedMotion: false })
  feel.advance(16, 1000)
  feel.requestFlash(1, "#ffffff")
  feel.advance(1, 1001)
  const first = feel.flashAlpha
  assert.ok(first <= 0.42, `a flash reached ${first}`)
  // A second request 1ms later must not stack into a strobe.
  feel.requestFlash(1, "#ffffff")
  feel.advance(1, 1002)
  assert.ok(feel.flashAlpha <= 0.42)
})

test("trauma and kick decay to nothing on their own", () => {
  const feel = new Feel({ reducedMotion: false })
  feel.addTrauma(1)
  feel.kick(0, -1, 30)
  for (let i = 0; i < 200; i++) feel.advance(16, 1000 + i * 16)
  assert.ok(Math.abs(feel.shakeX) < 0.01)
  assert.ok(Math.abs(feel.shakeY) < 0.01)
  assert.equal(feel.trauma, 0)
})

test("shake never calls Math.random, so a replay is a replay", () => {
  const a = new Feel({ reducedMotion: false })
  const b = new Feel({ reducedMotion: false })
  a.addTrauma(1)
  b.addTrauma(1)
  const trail = (f: Feel) =>
    Array.from({ length: 30 }, (_, i) => {
      f.advance(16, i * 16)
      return f.shakeX.toFixed(6)
    })
  assert.deepEqual(trail(a), trail(b))
})

test("the layout keeps the pedals enormous at every size the app runs at", () => {
  for (const [w, h] of [
    [320, 568],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1366, 1024],
  ] as const) {
    const l = computeLayout(w, h, safeRect(w, h))
    assert.ok(l.padH >= 150, `${w}×${h} gave a ${l.padH}px pedal band`)
    assert.ok(l.padTop > l.matTop, `${w}×${h} put the pedals above the mat`)
    assert.ok(l.matBottom > l.matTop, `${w}×${h} inverted the mat`)
    assert.ok(l.matBottom <= l.padTop, `${w}×${h} overlapped the mat and the pedals`)
    assert.ok(l.boardY + l.boardH < l.horizon, `${w}×${h} put the board under the crowd`)
    assert.ok(l.boardW <= w, `${w}×${h} ran the board off the screen`)
  }
})

test("the mat narrows towards the far ropes and never inverts", () => {
  const l = computeLayout(768, 1024, safeRect(768, 1024))
  const far = matHalfWidth(l, l.matTop)
  const near = matHalfWidth(l, l.matBottom)
  assert.ok(near > far, "the near edge of a ring is the wider one")
  assert.ok(far > 0)
  // Outside the mat the value is clamped rather than extrapolated to nonsense.
  assert.equal(matHalfWidth(l, l.matTop - 500), far)
  assert.equal(matHalfWidth(l, l.matBottom + 500), near)
})

test("the seeded rng is deterministic and stays in range", () => {
  const a = new Rng(99)
  const b = new Rng(99)
  for (let i = 0; i < 500; i++) {
    const v = a.next()
    assert.equal(v, b.next())
    assert.ok(v >= 0 && v < 1)
  }
  const r = new Rng(1)
  for (let i = 0; i < 500; i++) {
    const n = r.int(3, 7)
    assert.ok(Number.isInteger(n) && n >= 3 && n <= 7)
  }
  assert.equal(new Rng(0).next(), new Rng(0).next())
})

test("the particle pool honours the quality tier's ceiling", async () => {
  const { Particles, KIND_SPARK } = await import("../render/particles.ts")
  const { TIERS } = await import("../core/tiers.ts")
  const parts = new Particles()

  parts.setLimit(TIERS.ultra.particles)
  parts.burst(KIND_SPARK, 0, 0, 3000, 100, 0, 1, 2)
  assert.ok(parts.count <= TIERS.ultra.particles)
  const atUltra = parts.count
  assert.ok(atUltra > TIERS.low.particles, "the ultra tier should be holding more than low allows")

  // A downgrade has to take effect on the next frame, not once the burst that
  // was already in flight happens to expire.
  parts.setLimit(TIERS.low.particles)
  assert.ok(
    parts.count <= TIERS.low.particles,
    `${parts.count} particles survived a downgrade to ${TIERS.low.particles}`,
  )

  // And the pool keeps working at the smaller ceiling.
  parts.burst(KIND_SPARK, 0, 0, 3000, 100, 0, 1, 2)
  assert.ok(parts.count <= TIERS.low.particles)
  parts.clear()
  assert.equal(parts.count, 0)
})
