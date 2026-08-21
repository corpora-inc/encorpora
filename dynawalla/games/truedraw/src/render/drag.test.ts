// THE FEEL OF THE DRAG, as numbers.
//
// "Dragging can be juicy and awesome." Juice is not a thing a test can assert, but
// every property that MAKES a drag feel like a thrown card rather than a slider is,
// and each one below is a distinct failure a child would notice:
//
//   weight      the slate lags the finger at the start, so a flick has mass
//   magnetism   it accelerates INTO the destination as it arrives
//   resistance  and stops chasing a finger that has gone much too far
//   direction   it never leads its finger, and never lags in the wrong direction
//
// Nothing here needs a canvas: `drag.ts` is pure.

import assert from "node:assert/strict"
import { test } from "node:test"

import { commitDistance } from "../game/gesture.ts"
import {
  FOLLOW_BASE,
  FOLLOW_RUBBER,
  TILT_MAX,
  TRAIL_MAX,
  followOffset,
  magnetism,
  tiltFor,
  trailFor,
} from "./drag.ts"

/** The commit distances the fleet's shapes actually produce. */
const COMMITS = [320, 390, 768, 1024].map((w, i) => commitDistance(w, [568, 844, 1024, 768][i] ?? 800))

test("THE SLATE HAS WEIGHT: the first pixels move it less than the finger", () => {
  // A control that tracks 1:1 from zero reads as a scroll view. It also makes the
  // commit threshold feel like a cliff instead of an arrival.
  for (const c of COMMITS) {
    for (const dy of [4, 8, 12]) {
      const moved = followOffset(dy, c)
      assert.ok(moved < dy, `${String(dy)}px of finger moved ${moved.toFixed(1)}px of slate at commit ${String(c)}`)
      assert.ok(moved / dy >= FOLLOW_BASE - 0.001, "the slate lagged further behind than the base follow")
    }
  }
})

test("MAGNETISM: the slate arrives faster than it left", () => {
  // The whole of "snap as the card nears a target". The ratio of slate travel to
  // finger travel must RISE as the finger approaches the commit line — a constant
  // ratio is the old linear follow and is what the founder called lame.
  for (const c of COMMITS) {
    const ratios = [0.15, 0.4, 0.7, 0.95].map((f) => followOffset(c * f, c) / (c * f))
    for (let i = 1; i < ratios.length; i++) {
      assert.ok(
        (ratios[i] ?? 0) > (ratios[i - 1] ?? 0),
        `the follow ratio did not rise into the target: ${ratios.map((r) => r.toFixed(3)).join(" → ")}`,
      )
    }
    // ...and it is a real difference, not a rounding one.
    assert.ok(
      (ratios.at(-1) ?? 0) > (ratios[0] ?? 0) * 1.4,
      `magnetism is ${(((ratios.at(-1) ?? 0) / (ratios[0] ?? 1)) * 100 - 100).toFixed(0)}% — imperceptible`,
    )
  }
})

test("RESISTANCE: past the commit line the slate stops chasing the finger", () => {
  // A diagonal drag can travel a very long way without committing — the recogniser
  // wants 1.4x vertical dominance — and a slate that kept tracking it would fly off
  // the street while the child had said nothing at all.
  for (const c of COMMITS) {
    const at = (dy: number): number => followOffset(dy, c)
    const marginalInside = at(c) - at(c * 0.9)
    const marginalOutside = at(c * 2) - at(c * 1.9)
    assert.ok(
      marginalOutside < marginalInside * 0.5,
      `no rubber band: ${marginalInside.toFixed(2)}px in, ${marginalOutside.toFixed(2)}px out`,
    )
    // A pixel of finger past the line is worth exactly the rubber constant.
    assert.ok(Math.abs((at(c * 3) - at(c * 3 - 10)) / 10 - FOLLOW_RUBBER) < 1e-9)
  }
})

test("the slate never leads its finger and never lags the wrong way", () => {
  for (const c of COMMITS) {
    for (const dy of [-900, -200, -c, -35, -1, 0, 1, 35, c, 200, 900]) {
      const moved = followOffset(dy, c)
      assert.equal(Math.sign(moved), Math.sign(dy), `${String(dy)} → ${String(moved)}`)
      assert.ok(Math.abs(moved) <= Math.abs(dy) + 1e-9, "the slate outran the finger")
      assert.ok(Number.isFinite(moved))
    }
    // Monotone the whole way out, in both directions: a fold in the curve is felt
    // as the slate stalling and then jumping.
    let previous = Number.NEGATIVE_INFINITY
    for (let dy = -600; dy <= 600; dy += 7) {
      const moved = followOffset(dy, c)
      assert.ok(moved > previous - 1e-9, `the follow folded back at ${String(dy)}`)
      previous = moved
    }
  }
})

test("a zero or absurd commit distance cannot produce a NaN slate", () => {
  for (const c of [0, -5, Number.NaN]) {
    assert.ok(Number.isFinite(followOffset(50, c)), `commit ${String(c)}`)
  }
})

test("the tilt leans the way the card is thrown, and reduced motion has none", () => {
  const c = commitDistance(390, 844)
  assert.ok(tiltFor(c, c, false) > 0, "a downward throw did not tilt down")
  assert.ok(tiltFor(-c, c, false) < 0, "an upward throw did not tilt up")
  assert.ok(Math.abs(tiltFor(c * 4, c, false)) <= TILT_MAX + 1e-9, "the tilt is unbounded")
  // A card, not a door: five degrees is already a lot at this size.
  assert.ok(TILT_MAX < 0.11, "the slate tilts far enough to read as a swinging object")
  for (const dy of [-200, -c, -20, 0, 20, c, 200]) {
    assert.equal(tiltFor(dy, c, true), 0, "reduced motion rotated the slate")
  }
})

test("the trail is motion blur, not a permanent fringe", () => {
  const c = commitDistance(390, 844)
  assert.equal(trailFor(0, c, false).length, 0, "a resting slate has a smear under it")
  assert.equal(trailFor(6, c, false).length, 0, "a two-pixel wander drew a trail")
  const moving = trailFor(c * 0.9, c, false)
  assert.ok(moving.length > 0, "a committing flick left no trail")
  assert.ok(moving.length <= TRAIL_MAX)
  // Every echo sits BEHIND the slate — opposite the travel — and fades with distance.
  for (const echo of moving) {
    assert.ok(echo.back < 0, "an echo led the slate")
    assert.ok(echo.alpha > 0 && echo.alpha < 0.5, `echo alpha ${String(echo.alpha)}`)
  }
  for (let i = 1; i < moving.length; i++) {
    assert.ok((moving[i]?.alpha ?? 1) < (moving[i - 1]?.alpha ?? 0), "the trail does not fade")
  }
  assert.equal(trailFor(c * 0.9, c, true).length, 0, "reduced motion drew a motion trail")
})

test("magnetism is 0 at rest and 1 at the line, and clamps beyond it", () => {
  const c = commitDistance(768, 1024)
  assert.equal(magnetism(0, c), 0)
  assert.ok(Math.abs(magnetism(c, c) - 1) < 1e-9)
  assert.equal(magnetism(c * 5, c), 1)
  assert.equal(magnetism(-c, c), 1, "magnetism is a magnitude, not a direction")
})
