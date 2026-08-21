// TEACHING THE GESTURE, AND KNOWING WHEN TO STOP.
//
// The hint is the only thing in this game that appears without the child asking for
// it, so every gate on it is load-bearing. The failures this file is aimed at are
// all failures of restraint:
//
//   * a ghost that keeps demonstrating after the child has plainly got it;
//   * a ghost that appears the instant the window opens, over a slate a fast child
//     is already answering;
//   * a ghost that leans the way the CURRENT statement ought to go, which is the
//     game answering the round and poisoning the learner model;
//   * anything that gets more urgent the longer a child thinks, which is a
//     countdown wearing a costume — speed is rewarded in this game, never enforced.

import assert from "node:assert/strict"
import { test } from "node:test"

import type { Phase } from "../game/round.ts"
import { CYCLE_MS, MARK_REST, NUDGE_MS, hintFor, markGlow, type HintInput } from "./hint.ts"

const base = (over: Partial<HintInput> = {}): HintInput => ({
  phase: "call",
  elapsedMs: NUDGE_MS + 2000,
  reduced: false,
  dragging: false,
  calls: 0,
  ...over,
})

test("THE TEACHING STOPS FOR GOOD AT THE FIRST CORRECT CALL", () => {
  // One correct call is proof the gesture landed. A hint that outstays the moment it
  // was needed is condescension, and this product does not do that to children.
  assert.ok(hintFor(base({ calls: 0 })), "a child who has landed nothing gets no help")
  for (const calls of [1, 2, 9, 40]) {
    assert.equal(hintFor(base({ calls })), null, `still hinting after ${String(calls)} calls`)
  }
})

test("IT WAITS FOR THE HESITATION AND NEVER PRE-EMPTS AN ANSWER", () => {
  // A child who knows the gesture answers well inside `NUDGE_MS` and never sees the
  // ghost at all. One that appeared immediately would be drawn over a slate somebody
  // was already flicking.
  for (const elapsedMs of [0, 100, 400, NUDGE_MS - 1, NUDGE_MS]) {
    assert.equal(hintFor(base({ elapsedMs })), null, `hinted at ${String(elapsedMs)}ms`)
  }
  assert.ok(hintFor(base({ elapsedMs: NUDGE_MS + 1 })))
})

test("IT NEVER GETS MORE URGENT — a hint that escalates is a countdown", () => {
  // The strength ramps in once and then holds, flat, forever. If a child sits for a
  // minute the street says exactly what it said after two seconds.
  const strengthAt = (ms: number): number => hintFor(base({ elapsedMs: ms }))?.strength ?? 0
  const settled = strengthAt(NUDGE_MS + 3000)
  for (const ms of [4000, 12_000, 30_000, 90_000]) {
    assert.equal(strengthAt(NUDGE_MS + ms), settled, `the hint escalated by ${String(ms)}ms`)
  }
  assert.ok(settled > 0 && settled <= 1)
})

test("IT DEMONSTRATES BOTH GESTURES AND NEVER THE ANSWER", () => {
  // The safety property. A ghost that leaned the way the CURRENT statement ought to
  // go would be the game playing the round, and every one of those rounds would
  // enter the learner model as evidence about arithmetic the child did not do.
  //
  // `hintFor` cannot even express that: it is not handed the statement, and over one
  // cycle it shows both directions in a fixed order.
  const calls = new Set<string>()
  for (let ms = NUDGE_MS + 10; ms < NUDGE_MS + CYCLE_MS; ms += 40) {
    const hint = hintFor(base({ elapsedMs: ms }))
    assert.ok(hint)
    calls.add(hint.call)
  }
  assert.deepEqual([...calls].sort(), ["keep", "toss"], "the ghost only ever showed one gesture")
  // ...and `keep` comes first: the affirmative gesture is the one a child reaches
  // for unprompted, so the loop starts by confirming the instinct.
  assert.equal(hintFor(base({ elapsedMs: NUDGE_MS + 30 }))?.call, "keep")
  assert.equal(hintFor(base({ elapsedMs: NUDGE_MS + CYCLE_MS * 0.6 }))?.call, "toss")
})

test("the ghost travels and fades within each half, and never sits still lit", () => {
  const at = (frac: number): { drift: number; alpha: number } => {
    const hint = hintFor(base({ elapsedMs: NUDGE_MS + CYCLE_MS * frac }))
    assert.ok(hint)
    return { drift: hint.drift, alpha: hint.alpha }
  }
  // Travel across the first half.
  assert.ok(at(0.02).drift < at(0.2).drift, "the ghost did not travel")
  assert.ok(at(0.2).drift < at(0.34).drift)
  // And fade out at the ends of it, so nothing is left hanging mid-air.
  assert.ok(at(0.02).alpha < at(0.25).alpha, "the ghost appeared fully formed")
  assert.ok(at(0.48).alpha < at(0.25).alpha, "the ghost never faded out")
  for (const frac of [0.01, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 0.99]) {
    const { drift, alpha } = at(frac)
    assert.ok(drift >= 0 && drift <= 1, `drift ${String(drift)}`)
    assert.ok(alpha >= 0 && alpha <= 1, `alpha ${String(alpha)}`)
  }
})

test("REDUCED MOTION KEEPS THE TEACHING AND DROPS THE MOVING OBJECT", () => {
  // A branch, not a deletion. There is no drifting ghost, and the two marks are lit
  // by the hint's full strength instead — so the instruction is still there, it just
  // is not animated.
  const hint = hintFor(base({ reduced: true }))
  assert.ok(hint, "reduced motion removed the teaching entirely")
  assert.equal(hint.alpha, 0, "reduced motion still drew a moving ghost")
  assert.ok(hint.strength > 0, "reduced motion left the marks unlit")
})

test("a finger on the glass ends the hint immediately", () => {
  // The child is doing the thing. A demonstration competing with a live drag is
  // noise on top of the one moment the affordance is already working.
  assert.equal(hintFor(base({ dragging: true })), null)
})

test("nothing is taught outside an open window, or behind the manual", () => {
  for (const phase of ["idle", "raise", "still", "verdict", "clear", "over"] as Phase[]) {
    assert.equal(hintFor(base({ phase })), null, `hinted during ${phase}`)
  }
  assert.equal(hintFor(base({ masked: true })), null, "hinted behind the sheet")
})

test("THE MARKS ARE ALWAYS THERE, FAINTLY, AND THE RIGHT ONE LIGHTS", () => {
  // The permanent half of the instructions: `≠` above, `=` below. They are not a
  // tutorial that gets dismissed, so there is nothing to miss and nothing to recall —
  // but at rest they must not compete with the statement, which is the only thing on
  // the street a child has to read.
  assert.equal(markGlow(true, 0, null, false), MARK_REST)
  assert.ok(MARK_REST > 0.1, "the marks are invisible at rest — they teach nothing")
  assert.ok(MARK_REST < 0.35, "the marks compete with the statement at rest")

  // A finger heading for a destination lights it, and lights it much more than rest.
  assert.ok(markGlow(true, 1, null, false) > MARK_REST * 3)
  // The other one does not move at all.
  assert.equal(markGlow(false, 1, null, false), MARK_REST)

  const hint = hintFor(base())
  assert.ok(hint)
  assert.ok(markGlow(true, 0, hint, true) > MARK_REST, "the ghost's destination did not light")
  assert.equal(markGlow(true, 0, hint, false), MARK_REST, "the other destination lit too")
  // Never over one, whatever adds up.
  assert.ok(markGlow(true, 1, hint, true) <= 1)
})
