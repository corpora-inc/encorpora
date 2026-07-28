import assert from "node:assert/strict"
import { test } from "node:test"

import { PUSH_MAX, isShoved, newPush, pressed, pressure, relieved } from "./push.ts"

test("the meter starts at the far end of the street", () => {
  const push = newPush()
  assert.equal(push.marks, 0)
  assert.equal(isShoved(push), false)
  assert.equal(pressure(push), 0)
})

test("six slips with nothing in between is a shove", () => {
  let push = newPush()
  for (let i = 0; i < PUSH_MAX - 1; i++) {
    push = pressed(push)
    assert.equal(isShoved(push), false, `shoved after ${i + 1} slips`)
  }
  push = pressed(push)
  assert.equal(isShoved(push), true)
  assert.equal(pressure(push), 1)
})

test("a rank going down buys ground back", () => {
  let push = newPush()
  push = pressed(pressed(pressed(push)))
  assert.equal(push.marks, 3)
  push = relieved(push)
  assert.equal(push.marks, 2)
  // A run of good taps at the far end does not bank credit for later slips.
  push = relieved(relieved(relieved(relieved(push))))
  assert.equal(push.marks, 0)
})

test("the meter has no clock in it", () => {
  // Nothing in this module takes a duration, a timestamp or a frame delta:
  // standing still and reading the mob costs exactly nothing, which is the
  // whole reason a timer is not the stake in this game.
  assert.equal(pressed.length, 1)
  assert.equal(relieved.length, 1)
  assert.equal(newPush.length, 0)
})

test("the meter never leaves its rails", () => {
  let push = newPush()
  for (let i = 0; i < 40; i++) push = pressed(push)
  assert.equal(push.marks, PUSH_MAX)
  for (let i = 0; i < 40; i++) push = relieved(push)
  assert.equal(push.marks, 0)
})
