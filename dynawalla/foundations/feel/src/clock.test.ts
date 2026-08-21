import { test } from "node:test"
import assert from "node:assert/strict"
import { FeelClock, MAX_DT_MS } from "./clock.ts"

const mk = () => new FeelClock({ now: () => 0, raf: () => 0, cancelRaf: () => {} })

test("hitstop freezes the world and leaves real and ui running", () => {
  const c = mk()
  c.hitstop(50)
  const t = c.step(16.67)
  assert.equal(t.dtWorld, 0, "world must be frozen")
  assert.equal(t.dtReal, 16.67, "real time never stops")
  assert.equal(t.dtUi, 16.67, "the next problem must keep presenting")
})

test("hitstop is wall-clock, so it is identical at 60 and 120 Hz", () => {
  const a = mk()
  const b = mk()
  a.hitstop(50)
  b.hitstop(50)
  let aFrames = 0
  let bFrames = 0
  while (a.hitstopMs > 0) {
    a.step(1000 / 60)
    aFrames++
  }
  while (b.hitstopMs > 0) {
    b.step(1000 / 120)
    bFrames++
  }
  // Different frame counts, same elapsed real time. That is the whole point:
  // a frame-counted hitstop would be half as long on the 120 Hz device.
  assert.equal(aFrames, 3)
  assert.equal(bFrames, 6)
  assert.ok(Math.abs(a.tReal - b.tReal) < 1e-9)
})

test("hitstop takes the max, never sums", () => {
  const c = mk()
  c.hitstop(40)
  c.hitstop(75)
  c.hitstop(20)
  assert.equal(c.hitstopMs, 75)
})

test("slow-motion snaps in and eases out", () => {
  const c = mk()
  c.slowmo(0.3, 200)
  assert.equal(c.timeScale, 0.3, "entry must be instant, not ramped")
  const first = c.step(16.67)
  assert.ok(first.dtWorld < first.dtReal * 0.6)
  let elapsed = 16.67
  while (elapsed < 260) {
    c.step(16.67)
    elapsed += 16.67
  }
  assert.equal(c.timeScale, 1, "must return exactly to 1, not asymptotically")
})

test("settleNow cancels every distortion synchronously", () => {
  const c = mk()
  c.hitstop(150)
  c.slowmo(0.25, 400)
  c.settleNow()
  assert.equal(c.hitstopMs, 0)
  assert.equal(c.timeScale, 1)
  const t = c.step(16.67)
  assert.equal(t.dtWorld, 16.67)
})

test("a long stall is clamped, not replayed", () => {
  const c = mk()
  const t = c.step(90_000)
  assert.equal(t.dtReal, MAX_DT_MS)
  assert.ok(t.stalled)
})

test("start is idempotent — two mounts do not make two loops", () => {
  let started = 0
  const c = new FeelClock({
    now: () => 0,
    raf: () => {
      started++
      return 1
    },
    cancelRaf: () => {},
  })
  c.start()
  c.start()
  c.start()
  assert.equal(started, 1)
})

test("the tick object is reused — zero allocation per frame", () => {
  const c = mk()
  const a = c.step(16)
  const b = c.step(16)
  assert.equal(a, b, "a fresh object per frame is 60 allocations a second")
})

test("world time accumulates only what the world saw", () => {
  const c = mk()
  c.hitstop(33)
  c.step(16.67)
  c.step(16.67)
  c.step(16.67)
  assert.ok(c.tReal > c.tWorld)
  assert.ok(Math.abs(c.tWorld - 16.67) < 0.01, `world advanced ${String(c.tWorld)}`)
})
