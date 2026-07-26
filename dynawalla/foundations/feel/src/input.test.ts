import { test } from "node:test"
import assert from "node:assert/strict"
import { Coyote, InputBuffer, nearestTarget, COYOTE_MS, type Target } from "./input.ts"

const T = (id: string, x: number, y: number, w = 64, h = 64): Target => ({ id, x, y, w, h })

test("coyote time matches Celeste's JumpGraceTime of 100 ms", () => {
  assert.equal(COYOTE_MS, 100)
  let t = 0
  const c = new Coyote(COYOTE_MS, () => t)
  c.arm()
  t = 1000
  c.expire(t)
  t = 1099
  assert.ok(c.isOpen(t), "a tap 99 ms after the deadline was already committed")
  t = 1101
  assert.ok(!c.isOpen(t))
})

test("slam closes without grace", () => {
  let t = 0
  const c = new Coyote(100, () => t)
  c.arm()
  c.slam()
  assert.ok(!c.isOpen(t))
})

test("the buffer keeps the newest press, not a queue of them", () => {
  let t = 0
  const b = new InputBuffer<string>(180, () => t)
  b.press("a")
  b.press("b")
  b.press("c")
  const got = b.consume(t)
  assert.equal(got?.payload, "c", "mashing means go, not go three times")
  assert.equal(b.consume(t), null)
})

test("a buffered press outside the window is dropped, not applied late", () => {
  let t = 0
  const b = new InputBuffer<string>(180, () => t)
  b.press("a", 0)
  t = 400
  assert.equal(b.consume(t), null)
  assert.equal(b.expired, 1)
})

test("the buffered press carries the time the child actually touched glass", () => {
  const b = new InputBuffer<string>(180, () => 0)
  b.press("a", 120)
  const got = b.consume(200)
  assert.equal(got?.atMs, 120, "latency must be measured from the touch, not the apply")
})

test("hit slop rescues a tap that lands just below a button", () => {
  const targets = [T("seven", 100, 100)]
  assert.equal(nearestTarget(targets, 132, 172, 12)?.id, "seven", "8 px below the bottom edge")
  assert.equal(nearestTarget(targets, 132, 180, 12), null, "16 px below is a genuine miss")
})

test("slop never bridges two adjacent answers — nearest centre wins", () => {
  // Two 64 px keys with a 16 px gap: slop of 12 overlaps in the gap.
  const targets = [T("a", 0, 0), T("b", 80, 0)]
  assert.equal(nearestTarget(targets, 70, 32, 12)?.id, "a", "closer to a")
  assert.equal(nearestTarget(targets, 78, 32, 12)?.id, "b", "closer to b")
  // The important property: never ambiguous, never both.
  for (let x = 60; x <= 90; x++) {
    const hit = nearestTarget(targets, x, 32, 12)
    assert.ok(hit !== null, `gap at x=${String(x)} produced no hit`)
  }
})

test("a tap on empty space stays a tap on empty space", () => {
  assert.equal(nearestTarget([T("a", 0, 0)], 400, 400, 12), null)
})

test("disabled targets are not tappable, even with slop", () => {
  const targets: Target[] = [{ ...T("a", 0, 0), enabled: false }]
  assert.equal(nearestTarget(targets, 32, 32, 12), null)
})
