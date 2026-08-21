// The claim this file exists to prove: the springs are frame-rate independent.
//
// This is not a nicety. An iPad Pro runs at 120 Hz, a budget Android at 60, and
// several Androids at an adaptive 90. If a spring integrates differently at
// each, then every impact in the product is a different animation per device
// and the tuning is meaningless. A numerically-integrated spring fails this
// test; the exponential integrator in `spring.ts` passes it to float precision.

import { test } from "node:test"
import assert from "node:assert/strict"
import { Spring1D } from "./spring.ts"

test("one 16 ms step equals sixteen 1 ms steps", () => {
  for (const zeta of [1, 0.45, 1.8]) {
    const coarse = new Spring1D(12, zeta)
    const fine = new Spring1D(12, zeta)
    coarse.impulse(40)
    fine.impulse(40)
    for (let i = 0; i < 40; i++) {
      coarse.update(16)
      for (let k = 0; k < 16; k++) fine.update(1)
    }
    assert.ok(
      Math.abs(coarse.x - fine.x) < 1e-9,
      `zeta=${String(zeta)} diverged: ${String(coarse.x)} vs ${String(fine.x)}`,
    )
  }
})

test("60 Hz and 120 Hz reach the same place at the same wall-clock time", () => {
  const a = new Spring1D(14, 0.5)
  const b = new Spring1D(14, 0.5)
  a.impulse(25)
  b.impulse(25)
  // 500 ms of wall clock, both ways.
  for (let i = 0; i < 30; i++) a.update(1000 / 60)
  for (let i = 0; i < 60; i++) b.update(1000 / 120)
  assert.ok(Math.abs(a.x - b.x) < 1e-9, `${String(a.x)} vs ${String(b.x)}`)
})

test("a stiff spring at a clamped 50 ms step stays bounded", () => {
  // Semi-implicit Euler explodes here. This is the tab-switch case.
  const s = new Spring1D(25, 0.4)
  s.impulse(200)
  for (let i = 0; i < 20; i++) s.update(50)
  assert.ok(Number.isFinite(s.x) && Math.abs(s.x) < 1, `blew up: ${String(s.x)}`)
})

test("critically damped never overshoots", () => {
  const s = new Spring1D(10, 1)
  s.impulse(30)
  let sign = 0
  let crossings = 0
  for (let i = 0; i < 200; i++) {
    s.update(5)
    const cur = Math.sign(s.x)
    if (cur !== 0 && sign !== 0 && cur !== sign) crossings++
    if (cur !== 0) sign = cur
  }
  assert.equal(crossings, 0)
})

test("under-damped overshoots exactly the way a follow-through should", () => {
  const s = new Spring1D(10, 0.35)
  s.impulse(30)
  let crossings = 0
  let sign = 1
  for (let i = 0; i < 400; i++) {
    s.update(4)
    const cur = Math.sign(s.x)
    if (cur !== 0 && cur !== sign) {
      crossings++
      sign = cur
    }
  }
  assert.ok(crossings >= 2, `expected visible oscillation, saw ${String(crossings)} crossings`)
})

test("settle is instant and exact", () => {
  const s = new Spring1D(10, 0.4)
  s.impulse(50)
  s.update(20)
  s.settle()
  assert.equal(s.x, 0)
  assert.equal(s.v, 0)
  assert.ok(s.isAtRest())
})

test("everything comes to rest", () => {
  for (const zeta of [0.3, 1, 2]) {
    const s = new Spring1D(8, zeta)
    s.impulse(100)
    for (let i = 0; i < 600; i++) s.update(16.67)
    assert.ok(s.isAtRest(), `zeta=${String(zeta)} still moving: x=${String(s.x)}`)
  }
})
