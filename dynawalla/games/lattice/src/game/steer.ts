// WHAT A THUMB MEANS — input shaping for the left stick.
//
// The founder's second note was "the ship moves around too wildly … I'd like
// the ship to be a little bit smoother and easier to control", on Android.
//
// One half of that is the ship's own dynamics and lives in `arena.ts`. The other
// half is here, and it is the difference between a stick that reports a
// direction and a stick that reports an *intent*. Both of the shipped virtual
// sticks fed `(dx / 64, dy / 64)` straight into `setMove`, which has two
// problems a nine-year-old's thumb finds immediately:
//
//   1. **No dead zone.** A thumb resting on glass is never still. Every pixel of
//      tremor was full-authority thrust in whatever direction the tremor went,
//      so the ship never sat still and never quite went where it was pointed.
//   2. **A linear ramp.** Full thrust arrived 64 pixels from where the thumb
//      landed and half thrust at 32, so the useful part of the stick — the slow,
//      accurate part, the part you line up on a mote with — was about a
//      centimetre wide and shared with everything else.
//
// So: a dead zone, then a curve that leaves the first half of the stick's travel
// under a quarter of the authority, then a hard clamp at full deflection. The
// direction is never touched — only the magnitude — because a curve that bends the
// direction is a stick that lies about where the child pointed.
//
// This module is pure arithmetic on two numbers, and it is here rather than in
// `mount.ts` so it can be tested without a canvas. It shapes the *thumb* only:
// `WASD` already produces a unit direction with no tremor in it and no ramp to
// bend, and the mouse is an aim rather than a throttle, so neither of them wants
// a dead zone. `Arena.setMove` is what all three go through, and it guards the
// same non-finite input from the other side.

/** How far a virtual stick travels to reach full deflection, in CSS pixels. */
export const STICK_RANGE = 64

/**
 * The fraction of the range that means "nothing".
 *
 * A tenth of 64px is about 1.5mm on a phone, which is under the tremor of a
 * resting thumb and well under the 44px touch target the rest of the pack is
 * laid out to.
 */
export const DEAD_ZONE = 0.1

/**
 * The response curve's exponent.
 *
 * With the dead zone, `1.8` puts the stick at 4% authority a quarter of the way
 * out, 23% at half, 56% at three quarters and 100% at the edge — against a
 * straight line's 25/50/75/100. Chosen rather than 2 because a pure square makes
 * the last quarter of the stick feel like all of it, and rather than 1.4 because
 * the whole complaint is that the middle of the stick had too much in it.
 */
export const CURVE = 1.8

export type Stick = { readonly x: number; readonly y: number }

const ZERO: Stick = { x: 0, y: 0 }

/**
 * A thumb's offset from where it landed, as a move vector of magnitude 0..1.
 *
 * Non-finite in is `ZERO` out and not `NaN` out. That is not decoration: the
 * arena integrates this vector, so one `NaN` would put the ship's position
 * beyond recovery for the rest of the session, silently, and every collision
 * test afterwards would be false. See `Arena.setMove`, which guards the same
 * thing from the other side.
 */
export function shapeStick(dx: number, dy: number, range = STICK_RANGE): Stick {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(range) || range <= 0) {
    return ZERO
  }
  const magnitude = Math.hypot(dx, dy) / range
  if (magnitude <= DEAD_ZONE) return ZERO
  // Rescaled off the dead zone rather than measured from the centre, so the
  // first pixel past the dead zone is the smallest nudge and not a step.
  const past = Math.min(1, (magnitude - DEAD_ZONE) / (1 - DEAD_ZONE))
  const gain = Math.pow(past, CURVE) / magnitude
  return { x: dx / range * gain, y: dy / range * gain }
}
