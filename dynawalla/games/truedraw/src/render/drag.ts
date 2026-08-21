// HOW THE SLATE MOVES UNDER A FINGER.
//
// The founder's note: *"dragging can be juicy and awesome."* It was not. The old
// renderer moved the slate by `dy × 0.55` and tilted it by a constant — a linear
// map with no character in it, which reads as a slider rather than as a card you
// are about to throw.
//
// Everything a drag feels like is in these four pure functions, so it can be
// driven to the pixel by a test instead of being judged by eye on a device.
//
// ── the shape of the follow, in three parts ─────────────────────────────────
//
//   WEIGHT      the first pixels move the slate less than the finger. A card has
//               mass; a control that tracks 1:1 from zero feels like a scroll
//               view, and it also makes the 34 px commit threshold feel like a
//               cliff rather than an arrival.
//   MAGNETISM   as the travel approaches the commit line the slate accelerates
//               INTO the destination — the ratio rises from 0.55 to 0.97. This is
//               the "snap as the card nears a target" the brief asks for, and it
//               is what makes the last 10 px of a flick feel like the target took
//               it rather than like the finger delivered it.
//   RESISTANCE  past the commit line the marginal follow collapses to 0.22. A
//               diagonal drag can travel a long way without committing (the
//               recogniser wants 1.4× dominance), and a slate that kept tracking
//               it would fly off the street while the child had said nothing.
//
// The three are continuous at the seam, which matters: a discontinuity in a
// follow curve is felt as a click even when it is only two pixels.
//
// ── and why NONE of this changes when a verdict commits ─────────────────────
//
// It cannot: `gesture.ts` zeroes its own live-drag accessors the instant it
// fires, so this module never sees the travel of a finger that has already
// spoken. That guard lives on the concept rather than at the call site
// deliberately, and this file relies on it.

/** Follow ratio at zero travel. Under 1, so the flick has weight. */
export const FOLLOW_BASE = 0.55

/** Extra follow the slate gains as it arrives at its destination. */
export const FOLLOW_SNAP = 0.42

/** Marginal follow past the commit line. The rubber band. */
export const FOLLOW_RUBBER = 0.22

/** The most the slate tilts as it is thrown, in radians. A card, not a door. */
export const TILT_MAX = 0.085

/** How many echoes trail a moving slate, and how far back the last one sits. */
export const TRAIL_MAX = 4
const TRAIL_REACH = 0.34

/**
 * The commit distance, made safe to divide by.
 *
 * `Math.max(1, NaN)` is `NaN`, which is the trap: a canvas whose bounding rect has
 * not settled yet reports a zero or a NaN width for one frame, `commitDistance`
 * passes it straight through, and every coordinate this module produces from it is
 * a NaN handed to `fillRect` — where it silently draws nothing rather than
 * throwing. `scene.test.ts` sweeps for non-finite arguments for the same reason.
 */
const safeCommit = (commitPx: number): number =>
  Number.isFinite(commitPx) && commitPx > 1 ? commitPx : 1

/**
 * How far the slate has actually moved, given how far the finger has.
 *
 * Signed, and always the same sign as `dy` — a slate that led its finger, or lagged
 * behind it in the wrong direction, would be a bug a child feels as the game
 * arguing with them.
 */
export function followOffset(dy: number, commitPx: number): number {
  const c = safeCommit(commitPx)
  const mag = Math.abs(dy)
  // Squared, so magnetism arrives LATE. Linear here would make the first few
  // pixels of a tap-that-slipped feel snatched at.
  const near = Math.min(1, mag / c)
  const within = Math.min(mag, c) * (FOLLOW_BASE + FOLLOW_SNAP * near * near)
  const past = Math.max(0, mag - c) * FOLLOW_RUBBER
  return Math.sign(dy) * (within + past)
}

/**
 * How close the slate is to being taken by its destination, 0..1.
 *
 * Not the recogniser's `pull`, which is clamped and linear. This is the eased
 * version the LOOK is driven from: the glow, the mark, the trail and the tilt all
 * ride it, so they arrive together rather than each on its own curve.
 */
export function magnetism(dy: number, commitPx: number): number {
  const near = Math.min(1, Math.abs(dy) / safeCommit(commitPx))
  return Number.isFinite(near) ? near * near : 0
}

/**
 * The tilt, in radians, signed with the direction of travel.
 *
 * `reduced` is a branch, not a degradation: reduced motion still gets the follow
 * and the glow, it simply does not get a rotating object.
 */
export function tiltFor(dy: number, commitPx: number, reduced: boolean): number {
  if (reduced) return 0
  return Math.sign(dy) * magnetism(dy, commitPx) * TILT_MAX
}

/**
 * The echoes behind a moving slate, nearest first.
 *
 * Each is `{ back, alpha }`: how far back along the travel it sits, in the same
 * units as `followOffset`, and how solid it is. An empty array below a threshold,
 * so a resting slate has no smear under it and reduced motion has none ever.
 */
export function trailFor(
  dy: number,
  commitPx: number,
  reduced: boolean,
): readonly { readonly back: number; readonly alpha: number }[] {
  if (reduced) return []
  const offset = followOffset(dy, commitPx)
  // Below a few pixels a trail is not motion blur, it is a fringe on a static
  // object. `TAP_SLOP_PX` is the same idea in the recogniser.
  if (Math.abs(offset) < 10) return []
  const strength = magnetism(dy, commitPx)
  const n = Math.max(1, Math.round(TRAIL_MAX * strength))
  const out: { back: number; alpha: number }[] = []
  for (let i = 1; i <= n; i++) {
    const t = i / (TRAIL_MAX + 1)
    out.push({ back: -offset * TRAIL_REACH * t, alpha: 0.3 * strength * (1 - t) })
  }
  return out
}
