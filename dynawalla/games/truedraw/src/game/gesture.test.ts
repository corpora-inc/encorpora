// The two gestures. Every threshold in `gesture.ts` is a number a six-year-old
// either lands or does not, so every one of them is asserted here — including the
// two that are properties of OTHER modules in this repository and would otherwise
// drift silently.

import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import {
  commitDistance,
  COMMIT_MAX_PX,
  COMMIT_MIN_PX,
  DOMINANCE,
  Gesture,
  SDK_DRAG_SLOP_PX,
  TAP_SLOP_PX,
} from "./gesture.ts"

const flick = (g: Gesture, dx: number, dy: number, steps = 6): (string | null)[] => {
  const out: (string | null)[] = []
  g.begin(200, 400)
  for (let i = 1; i <= steps; i++) {
    out.push(g.move(200 + (dx * i) / steps, 400 + (dy * i) / steps))
  }
  return out
}

test("down is keep and up is toss, and nothing else is either", () => {
  const commit = commitDistance(390, 844)
  let g = new Gesture(commit)
  assert.ok(flick(g, 0, commit + 4).includes("keep"), "a downward flick did not keep")
  g = new Gesture(commit)
  assert.ok(flick(g, 0, -(commit + 4)).includes("toss"), "an upward flick did not toss")
})

test("a flick commits exactly once, however long the finger keeps travelling", () => {
  // A pointermove stream is 120 Hz. A recogniser that fired on every frame past the
  // threshold would settle twenty verdicts out of one flick — nineteen of them
  // against slates that no longer exist.
  const g = new Gesture(40)
  const calls = flick(g, 0, 600, 60).filter((c) => c !== null)
  assert.deepEqual(calls, ["keep"], `one flick produced ${String(calls.length)} verdicts`)
})

test("a travel short of the threshold is not a verdict", () => {
  const commit = commitDistance(390, 844)
  const g = new Gesture(commit)
  assert.deepEqual(
    flick(g, 0, commit - 2).filter((c) => c !== null),
    [],
    "a flick that stopped short still answered the question",
  )
  assert.equal(g.end(), "drag", "a long-but-short-of-commit travel is not a tap either")
})

test("a horizontal drag is never a verdict, and neither is a 45-degree one", () => {
  const commit = 40
  for (const [dx, dy] of [
    [300, 0],
    [-300, 0],
    // Exactly diagonal: dy is not 1.4x dx, so it means nothing.
    [200, 200],
    [200, -200],
    [-200, 240],
  ] as const) {
    const g = new Gesture(commit)
    assert.deepEqual(
      flick(g, dx, dy, 20).filter((c) => c !== null),
      [],
      `${String(dx)},${String(dy)} was read as a verdict`,
    )
  }
})

test("a steep diagonal still commits — a child's flick is never plumb", () => {
  const g = new Gesture(40)
  assert.ok(flick(g, 20, 120, 12).includes("keep"), "a realistic thumb arc was rejected")
})

test("DOMINANCE is the line, exactly", () => {
  // Just inside and just outside, so the constant is the thing being tested rather
  // than a comfortable margin around it.
  const commit = 50
  const inside = new Gesture(commit)
  assert.ok(flick(inside, 30, 30 * DOMINANCE + 22, 12).includes("keep"))
  const outside = new Gesture(commit)
  assert.deepEqual(
    flick(outside, 60, 60 * DOMINANCE - 1, 12).filter((c) => c !== null),
    [],
  )
})

test("a tap is a tap, and a tap is never an answer", () => {
  const g = new Gesture(commitDistance(390, 844))
  g.begin(100, 200)
  assert.equal(g.move(103, 204), null)
  assert.equal(g.end(), "tap")
})

test("a scrub that never committed is a drag, not a tap", () => {
  const g = new Gesture(200)
  g.begin(100, 200)
  g.move(100, 260)
  assert.equal(g.end(), "drag", "a 60px scrub would have started a run as a tap")
})

test("the commit distance clears the SDK's drag slop by a wide margin", () => {
  // `packs/shared/sdk/src/tapzoom.ts` treats travel past DRAG_SLOP_PX as a drag and
  // leaves it entirely alone; anything at or under it is a candidate TAP, which the
  // guard may cancel and re-dispatch as a click with no travel in it at all. A
  // commit threshold inside that slop would have its verdicts eaten by the zoom
  // guard on the second flick of any rapid pair.
  assert.ok(
    COMMIT_MIN_PX >= SDK_DRAG_SLOP_PX * 3,
    `${String(COMMIT_MIN_PX)}px is not clear of the SDK's ${String(SDK_DRAG_SLOP_PX)}px slop`,
  )
  for (const [w, h] of [
    [320, 568],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [844, 390],
    [568, 320],
    [1366, 1024],
  ] as const) {
    const commit = commitDistance(w, h)
    assert.ok(
      commit > SDK_DRAG_SLOP_PX * 3,
      `${String(w)}×${String(h)}: ${commit.toFixed(1)}px is inside the SDK's slop`,
    )
    assert.ok(commit >= COMMIT_MIN_PX && commit <= COMMIT_MAX_PX, `${String(w)}×${String(h)}`)
  }
})

test("the SDK's drag slop has not moved out from under us", () => {
  // `gesture.ts` restates a number that lives in another package. If that package
  // raises it, the margin above is a fiction and this is the test that says so.
  const source = readFileSync(
    fileURLToPath(new URL("../../../../packs/sdk/src/tapzoom.ts", import.meta.url)),
    "utf8",
  )
  const found = /export const DRAG_SLOP_PX = (\d+)/.exec(source)?.[1]
  assert.equal(
    Number(found),
    SDK_DRAG_SLOP_PX,
    `the SDK's DRAG_SLOP_PX is now ${String(found)}; gesture.ts still says ${String(SDK_DRAG_SLOP_PX)}`,
  )
})

test("the commit distance is reachable on the smallest phone and bounded on the biggest tablet", () => {
  assert.equal(commitDistance(320, 568), COMMIT_MIN_PX, "the small phone is not at the floor")
  assert.equal(commitDistance(1366, 2000), COMMIT_MAX_PX, "the big tablet is not at the ceiling")
  // And it is always a fraction of a slate height, so the flick is a motion across
  // the thing being judged rather than a drag across the room. The slate is
  // `min(area.w * 0.88, 640) * 0.3` tall.
  for (const [w, h] of [
    [320, 568],
    [390, 844],
    [768, 1024],
    [1024, 1366],
  ] as const) {
    const slateH = Math.min(w * 0.88, 640) * 0.3
    assert.ok(
      commitDistance(w, h) <= slateH * 1.35,
      `${String(w)}×${String(h)}: a ${commitDistance(w, h).toFixed(0)}px flick against a ${slateH.toFixed(0)}px slate`,
    )
  }
})

test("a cancel owes nothing — the system taking the gesture is not a verdict", () => {
  const g = new Gesture(40)
  g.begin(100, 200)
  g.move(100, 230)
  g.cancel()
  assert.equal(g.down, false)
  assert.equal(g.move(100, 600), null, "a cancelled gesture still committed")
})

test("the live drag is clamped, so the slate can never be dragged off the world", () => {
  // Driven with a travel the DOMINANCE rule refuses to commit — a huge horizontal
  // component — because a committed gesture has no live drag at all by design, and a
  // clamp is only interesting while the finger is still deciding.
  const g = new Gesture(50)
  for (const dy of [5000, -5000]) {
    g.begin(100, 200)
    g.move(100 + 20_000, 200 + dy)
    assert.equal(g.committed, false, "the guard travel committed after all")
    assert.equal(g.pull, 1, `a pull of ${String(g.pull)} would throw the slate off the world`)
  }
})

test("the heading lights up before the verdict fires, which is the whole affordance", () => {
  const g = new Gesture(80)
  g.begin(100, 400)
  g.move(100, 420)
  assert.equal(g.heading, "keep", "the child gets no hint which way they are going")
  assert.equal(g.pull > 0 && g.pull < 1, true)
  g.begin(100, 400)
  g.move(100, 380)
  assert.equal(g.heading, "toss")
})

test("TAP_SLOP_PX is small enough that a tap cannot become a heading", () => {
  const g = new Gesture(80)
  g.begin(100, 400)
  g.move(100, 400 + TAP_SLOP_PX)
  assert.equal(g.heading, null, "a tap's wander showed a direction")
})
