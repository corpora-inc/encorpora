// The two gestures, as a state machine with no DOM in it.
//
//   swipe DOWN  →  keep  ("this claim is true", into the bag)
//   swipe UP    →  toss  ("this claim is false", thrown away)
//
// Split out from `mount.ts` so the thresholds — which are the difference between
// a gesture a six-year-old lands every time and one that eats their answer — can
// be driven exactly rather than approximated through a fake PointerEvent.
//
// ── COMMIT_MIN_PX = 34, and why not less ─────────────────────────────────────
//
// Three numbers already in this repository bound it from below.
//
//   * `dynawalla/packs/sdk/src/tapzoom.ts` calls travel past `DRAG_SLOP_PX = 10` a
//     drag rather than a tap. That module cancels the second tap of a zoom-shaped
//     chain and re-dispatches its `click`; a *drag* it leaves entirely alone. So a
//     committed swipe must be comfortably past 10 px, and at 34 it is 3.4× clear.
//     A swipe under that slop would be seen by the guard as a tap, could be
//     cancelled as half of a double tap, and would arrive at the canvas as a
//     re-dispatched click with no travel in it at all.
//   * A resting thumb wanders a few pixels between `pointerdown` and
//     `pointerup`. 34 px is past any of that, so a child who means to tap never
//     accidentally banks a counterfeit.
//   * 34 CSS px is 34 pt on iOS, just under the 44 pt minimum touch target. A
//     flick that travels less than one target height is not a flick.
//
// ── COMMIT_MAX_PX = 84, and why there is a ceiling at all ────────────────────
//
// The threshold scales with the viewport so an iPad does not feel like a phone,
// but it must never exceed what a thumb can travel in one motion without the hand
// moving. On a 1366 px iPad the unclamped fraction is 102 px; clamped it is 84.
// The slate itself is `min(area.w × 0.88, 640)` wide and 0.3 of that tall, so 84
// px is well inside one slate height on every shape the fleet has — the gesture
// is always a flick across the thing being judged, never a drag across the room.
//
// ── the fraction between them ────────────────────────────────────────────────
//
// 7.5% of the SHORTER side, not of the height. In landscape on a phone the height
// is the short side and a height-based threshold would be tiny; in portrait on an
// iPad the width is the short side and a height-based one would be enormous. The
// shorter side is the one bounded by the hand in both orientations.
//
// ── DOMINANCE = 1.4, and what it defends ─────────────────────────────────────
//
// A vertical travel only commits if it is 1.4× the horizontal travel. A diagonal
// drag is not a verdict, and neither is a horizontal one: the host owns horizontal
// gestures on its own surfaces, and a child who drags sideways across a canvas has
// not said anything about arithmetic. Making that ambiguous would spend a shot.
//
// ── COMMIT ON CROSSING, NOT ON RELEASE ──────────────────────────────────────
//
// The verdict fires the instant the threshold is crossed, mid-motion, and the
// timestamp taken there is the reported latency. Two reasons, and the second is
// the one that matters.
//
//   1. Feel. A card you have thrown is gone before your hand stops.
//   2. Honesty. The alternative anchors — `pointerdown`, or the end of the
//      release animation — are both wrong. `pointerdown` is unknowable (the
//      direction does not exist yet) and would be *exploitable*: rest a finger on
//      the slate at the moment it lights, think for six seconds, then flick, and
//      a `pointerdown`-anchored clock would report a reaction of zero and hand out
//      the full speed bonus. Anchoring at the crossing costs the ~80–150 ms of
//      finger travel, uniformly, on both gestures — noise against a p50 measured
//      in thousands — and cannot be gamed by holding still.

import type { Call } from "./response.ts"

/** Share of the shorter viewport side a swipe must travel to commit. */
export const COMMIT_FRACTION = 0.075

export const COMMIT_MIN_PX = 34
export const COMMIT_MAX_PX = 84

/** How much more vertical than horizontal a travel must be to mean anything. */
export const DOMINANCE = 1.4

/**
 * The SDK's own drag threshold, restated here as the floor it is.
 *
 * `COMMIT_MIN_PX` must stay above it. Imported as a number rather than from the
 * SDK because this package does not depend on the SDK — but `gesture.test.ts`
 * reads the real constant out of `tapzoom.ts` and fails if the two drift.
 */
export const SDK_DRAG_SLOP_PX = 10

/** How far a pointer may wander and still be a tap rather than a scrub. */
export const TAP_SLOP_PX = 10

export function commitDistance(w: number, h: number): number {
  const short = Math.max(1, Math.min(w, h))
  return Math.max(COMMIT_MIN_PX, Math.min(COMMIT_MAX_PX, COMMIT_FRACTION * short))
}

/** How a completed pointer sequence ended. */
export type Release = "tap" | "drag"

/**
 * One pointer at a time, with the commit fired exactly once per sequence.
 *
 * The "exactly once" is not decoration. A `pointermove` stream on a real device
 * arrives at 120 Hz, and a finger that keeps travelling after the threshold would
 * otherwise commit a verdict on every frame — twenty duds from one flick.
 */
export class Gesture {
  private readonly commit: number
  private active = false
  private fired = false
  private startX = 0
  private startY = 0
  private x = 0
  private y = 0

  constructor(commitPx: number) {
    this.commit = commitPx
  }

  get down(): boolean {
    return this.active
  }

  /** Whether this sequence has already produced its one verdict. */
  get committed(): boolean {
    return this.fired
  }

  /**
   * ── the three accessors below are THE LIVE DRAG, and they go neutral the
   *    instant a verdict commits ──────────────────────────────────────────────
   *
   * Not a nicety. A finger does not stop when it crosses the threshold: it keeps
   * travelling and then it RESTS on the glass, and `move` keeps recording `x`/`y`
   * for all of it. If these kept reporting that travel, the renderer would be
   * handed a large drag on a slate that had already been answered — and, because
   * the pointer is only cleared on release, that same drag would still be there
   * 1.2 s later when the NEXT slate came up. A child who flicks down and rests
   * their thumb would watch the following statement render 165 px below its rest
   * position with the bag lit, unreadable and unanswerable until they lifted.
   *
   * `pull` is clamped and `dy` deliberately is not — the renderer wants the real
   * travel so the slate has weight — which is exactly why the guard has to live
   * here, on the concept, rather than at the one call site that reads it today.
   */
  get dy(): number {
    return this.active && !this.fired ? this.y - this.startY : 0
  }

  /** 0..1 towards a commit, for the renderer. Clamped, so the slate cannot fly off. */
  get pull(): number {
    return Math.max(0, Math.min(1, Math.abs(this.dy) / this.commit))
  }

  /**
   * The call this travel is heading towards, or null while it means nothing yet.
   *
   * It lights as soon as the travel is past a tap's wander and vertical enough to be
   * unambiguous — deliberately much earlier than the commit. That is the affordance:
   * the child sees which way they are going while they can still change their mind,
   * which is why the controls do not have to be explained twice.
   */
  get heading(): Call | null {
    if (!this.active || this.fired) return null
    const dy = this.dy
    if (Math.abs(dy) <= TAP_SLOP_PX) return null
    if (Math.abs(dy) <= Math.abs(this.x - this.startX) * DOMINANCE) return null
    return dy > 0 ? "keep" : "toss"
  }

  begin(x: number, y: number): void {
    this.active = true
    this.fired = false
    this.startX = x
    this.startY = y
    this.x = x
    this.y = y
  }

  /** The call, the one frame it crosses. Null on every other frame. */
  move(x: number, y: number): Call | null {
    if (!this.active || this.fired) {
      this.x = x
      this.y = y
      return null
    }
    this.x = x
    this.y = y
    const dy = y - this.startY
    const dx = x - this.startX
    if (Math.abs(dy) < this.commit) return null
    // A diagonal is not a verdict. Checked after the distance so a long
    // horizontal scrub cannot commit by accumulating a little vertical drift.
    if (Math.abs(dy) <= Math.abs(dx) * DOMINANCE) return null
    this.fired = true
    return dy > 0 ? "keep" : "toss"
  }

  /**
   * The pointer lifted. Says whether the sequence was a tap, so `mount.ts` can
   * use one to start a run — and never to answer a question.
   */
  end(): Release {
    const travelled = Math.hypot(this.x - this.startX, this.y - this.startY)
    const release: Release = !this.fired && travelled <= TAP_SLOP_PX ? "tap" : "drag"
    this.active = false
    this.fired = false
    return release
  }

  /** The system took the gesture away. Nothing committed, nothing is owed. */
  cancel(): void {
    this.active = false
    this.fired = false
  }
}
