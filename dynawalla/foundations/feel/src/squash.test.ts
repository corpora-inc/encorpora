import { test } from "node:test"
import assert from "node:assert/strict"
import { Squash } from "./squash.ts"

test("punch(0.16) actually reaches 1.16 — the calibration bug", () => {
  // The first build multiplied the impulse by a hand-picked 26 and a tier
  // asking for a 16% punch got 3%. Every number in the tier table was quietly
  // five times weaker than it read, and no test or code review could see it.
  for (const want of [0.06, 0.16, 0.3, 0.55]) {
    const s = new Squash()
    s.punch(want)
    let peak = 1
    for (let i = 0; i < 300; i++) {
      s.update(4)
      peak = Math.max(peak, s.scale.y)
    }
    assert.ok(
      Math.abs(peak - (1 + want)) < 0.02,
      `asked for ${String(1 + want)}, peaked at ${peak.toFixed(3)}`,
    )
  }
})

test("volume is conserved — a squash is not a zoom", () => {
  const s = new Squash()
  s.punch(0.4)
  for (let i = 0; i < 60; i++) {
    s.update(4)
    const volume = s.scale.x * s.scale.y * s.scale.z
    assert.ok(Math.abs(volume - 1) < 1e-9, `volume drifted to ${String(volume)}`)
  }
})

test("a negative punch squashes first, a positive one stretches first", () => {
  const down = new Squash()
  down.punch(-0.3)
  down.update(8)
  assert.ok(down.scale.y < 1, "a landing squashes")

  const up = new Squash()
  up.punch(0.3)
  up.update(8)
  assert.ok(up.scale.y > 1, "a launch stretches")
})

test("follow-through happens: it crosses back past neutral", () => {
  const s = new Squash()
  s.punch(0.4)
  let sawOver = false
  let sawUnder = false
  for (let i = 0; i < 200; i++) {
    s.update(4)
    if (s.scale.y > 1.02) sawOver = true
    if (sawOver && s.scale.y < 0.99) sawUnder = true
  }
  assert.ok(sawUnder, "no follow-through — this is a linear scale, not a squash")
})

test("a huge punch at a clamped 50 ms step never mirrors the mesh", () => {
  const s = new Squash()
  s.punch(3)
  for (let i = 0; i < 40; i++) {
    s.update(50)
    assert.ok(s.scale.y > 0, `scale went ${String(s.scale.y)} — mesh inverted`)
    assert.ok(Number.isFinite(s.scale.x))
  }
})

test("settle returns to exactly neutral", () => {
  const s = new Squash()
  s.punch(0.5)
  s.update(10)
  s.settle()
  assert.equal(s.scale.x, 1)
  assert.equal(s.scale.y, 1)
  assert.equal(s.scale.z, 1)
})

test("punches compose additively rather than fighting", () => {
  const one = new Squash()
  one.punch(0.2)
  const two = new Squash()
  two.punch(0.2)
  two.punch(0.2)
  one.update(6)
  two.update(6)
  assert.ok(two.scale.y > one.scale.y, "a second hit must build on the first")
})
