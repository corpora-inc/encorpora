import { strict as assert } from "node:assert"
import { test } from "node:test"

import { ease, makeJuice } from "./juice.ts"

test("prefers-reduced-motion removes motion, not information", () => {
  const j = makeJuice(true)
  j.shake(40)
  j.punch(0, 1, 20)
  j.slowmo(0.2, 500)
  j.update(16)
  assert.equal(j.shakeX, 0)
  assert.equal(j.shakeY, 0)
  assert.equal(j.timeScale, 1, "no slow-motion under reduced motion")

  // Hitstop is timing, not movement, and it is most of what makes a hit read
  // as a hit — so it survives.
  j.hitstop(90)
  j.update(16)
  assert.equal(j.frozen, true)
})

test("a full-screen flash is amplitude-capped hard under reduced motion", () => {
  const j = makeJuice(true)
  j.requestFlash(1)
  j.update(1)
  assert.ok(j.flash <= 0.15, `flash was ${j.flash}`)
})

test("flashes are rate-limited below the photosensitivity band", () => {
  // Guidance puts the risk band at 3 Hz and above. Fire a flash request every
  // frame for a second and count how many actually land.
  const j = makeJuice(false)
  let landed = 0
  let last = 0
  for (let f = 0; f < 60; f++) {
    j.requestFlash(0.5)
    j.update(16.67)
    if (j.flash > last + 0.001) landed++
    last = j.flash
  }
  assert.ok(landed <= 3, `${landed} flashes in one second`)
})

test("a flash never exceeds the amplitude cap even when asked for more", () => {
  const j = makeJuice(false)
  j.requestFlash(5)
  j.update(1)
  assert.ok(j.flash <= 0.56, `flash was ${j.flash}`)
})

test("shake decays to nothing rather than running forever", () => {
  const j = makeJuice(false)
  j.shake(30)
  for (let i = 0; i < 60; i++) j.update(16.67)
  assert.ok(Math.abs(j.shakeX) < 0.2, `shake still ${j.shakeX} after a second`)
})

test("shake decay is frame-rate independent", () => {
  const a = makeJuice(false)
  const b = makeJuice(false)
  a.shake(30)
  b.shake(30)
  for (let i = 0; i < 30; i++) a.update(16.67) // 60 fps for 500 ms
  for (let i = 0; i < 15; i++) b.update(33.33) // 30 fps for 500 ms
  // Same elapsed time must leave the same energy, within a hair.
  const ea = Math.hypot(a.shakeX, a.shakeY)
  const eb = Math.hypot(b.shakeX, b.shakeY)
  assert.ok(Math.abs(ea - eb) < 0.35, `${ea} vs ${eb}`)
})

test("outBack overshoots and settles; the others stay in range", () => {
  assert.ok(ease.outBack(0.6) > 1, "outBack must overshoot to read as an impact")
  assert.ok(Math.abs(ease.outBack(1) - 1) < 1e-9)
  for (const name of ["outCubic", "outQuint", "outExpo", "inOutQuad", "outBounce"] as const) {
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const v = ease[name](Math.min(1, t))
      assert.ok(v >= -0.001 && v <= 1.001, `${name}(${t}) = ${v}`)
    }
  }
})
