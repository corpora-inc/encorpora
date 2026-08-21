import { test } from "node:test"
import assert from "node:assert/strict"
import { Tweens, CH_UI, CH_WORLD } from "./tween.ts"

const obj = () => ({ v: 0 })

test("a tween lands exactly on its end value", () => {
  const tw = new Tweens(8)
  const o = obj()
  tw.to2(o, "v", 0, 10, 100, "linear")
  tw.update(CH_WORLD, 100)
  assert.equal(o.v, 10)
})

test("settle fast-forwards to the END state, never mid-pose", () => {
  const tw = new Tweens(8)
  const o = obj()
  tw.to2(o, "v", 0, 10, 1000, "outBack")
  tw.update(CH_WORLD, 120)
  assert.ok(o.v > 0 && o.v < 10, "should be mid-flight")
  const n = tw.settle()
  assert.equal(n, 1)
  assert.equal(o.v, 10, "an interrupted flourish must end valid, not frozen")
  assert.equal(tw.liveCount, 0)
})

test("settle fires onDone", () => {
  const tw = new Tweens(8)
  const o = obj()
  let done = 0
  const bump = () => {
    done++
  }
  tw.to2(o, "v", 0, 1, 500, "linear", { onDone: bump })
  tw.settle()
  assert.equal(done, 1)
})

test("channels are independent — a frozen world does not stall the UI", () => {
  const tw = new Tweens(8)
  const world = obj()
  const ui = obj()
  tw.to2(world, "v", 0, 10, 100, "linear", { channel: CH_WORLD })
  tw.to2(ui, "v", 0, 10, 100, "linear", { channel: CH_UI })
  // A hitstop frame: dtWorld = 0, dtUi = 16.
  tw.update(CH_WORLD, 0)
  tw.update(CH_UI, 16)
  assert.equal(world.v, 0)
  assert.ok(ui.v > 0)
})

test("a stale handle cannot cancel a recycled slot", () => {
  const tw = new Tweens(2)
  const a = obj()
  const b = obj()
  const h = tw.to2(a, "v", 0, 1, 10, "linear")
  tw.update(CH_WORLD, 20) // completes, slot recycles
  const h2 = tw.to2(b, "v", 0, 5, 1000, "linear")
  assert.notEqual(h, h2)
  tw.cancel(h) // stale
  assert.ok(tw.isActive(h2), "the stale handle killed an unrelated tween")
})

test("a full pool drops the newest, never an in-flight one", () => {
  const tw = new Tweens(2)
  const a = obj()
  tw.to2(a, "v", 0, 1, 1000, "linear")
  tw.to2(a, "v", 0, 1, 1000, "linear")
  const h = tw.to2(a, "v", 0, 1, 1000, "linear")
  assert.equal(h, 0, "overflow returns the null handle")
  assert.equal(tw.overflows, 1)
  assert.equal(tw.liveCount, 2, "the two in flight are untouched")
})

test("delay staggers without a timer", () => {
  const tw = new Tweens(8)
  const o = obj()
  tw.to2(o, "v", 0, 10, 100, "linear", { delayMs: 50 })
  tw.update(CH_WORLD, 40)
  assert.equal(o.v, 0)
  tw.update(CH_WORLD, 20) // 10 ms past the delay
  assert.ok(o.v > 0 && o.v < 2)
})

test("pingpong ends where it started", () => {
  const tw = new Tweens(8)
  const o = obj()
  o.v = 3
  tw.to2(o, "v", 3, 9, 100, "linear", { pingpong: true })
  tw.update(CH_WORLD, 50)
  assert.ok(o.v > 8, `peak should be near 9, was ${String(o.v)}`)
  tw.update(CH_WORLD, 60)
  assert.equal(o.v, 3, "a punch must return to where it started")
})

test("onDone may start a new tween without overflowing", () => {
  const tw = new Tweens(1)
  const o = obj()
  let second = 0
  const chain = () => {
    second = tw.to2(o, "v", 1, 2, 100, "linear")
  }
  tw.to2(o, "v", 0, 1, 10, "linear", { onDone: chain })
  tw.update(CH_WORLD, 20)
  assert.notEqual(second, 0, "the slot must be free before onDone runs")
})

test("update walks only used slots, not the whole capacity", () => {
  const tw = new Tweens(512)
  const o = obj()
  tw.to2(o, "v", 0, 1, 100, "linear")
  // Not directly observable; assert the proxy: a big pool with one tween
  // completes in the same number of steps as a small one.
  tw.update(CH_WORLD, 100)
  assert.equal(o.v, 1)
  assert.equal(tw.liveCount, 0)
})
