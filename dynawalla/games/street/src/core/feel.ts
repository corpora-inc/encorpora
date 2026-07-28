// Timings, and the one number the design document names out loud.
//
// Reduced motion is a **branch**, not a degradation (`EXPERIENCE_DESIGN.md`).
// The reduced table below keeps every beat that carries information — the crack
// still travels, the ring-off still holds the mob still long enough to read the
// remainder — and removes travel and particles. Nothing gets shorter than the
// time it takes to read what happened.

/**
 * The crack runs at **2400 px/s**. Straight out of the design entry, and the
 * reason a landing seam feels like a decision that already happened rather than
 * an animation you wait for: across a 900 px street that is 375 ms, and across
 * a 320 px phone it is 133 ms.
 *
 * It is a *speed*, not a duration, which is the whole point — the crack takes
 * as long as the street is wide, so a big mob's break is visibly a longer event
 * than a small one's on the same screen.
 */
export const CRACK_PX_PER_S = 2400

/** How long a crack across `px` of street takes, in milliseconds. */
export function crackMs(px: number): number {
  return (Math.max(0, px) / CRACK_PX_PER_S) * 1000
}

export type Timing = {
  /** The mob walking on at the top of a wave. */
  readonly approach: number
  /** Held after the crack lands, so the new rectangle is read before input reopens. */
  readonly settle: number
  /** A refused seam. Long enough to count the remainder standing in the gap. */
  readonly ringoff: number
  /** Fists off locked arms. Short: being wrong is never the interesting frame. */
  readonly bounce: number
  /** One rank going down. */
  readonly fall: number
  /** The street empty, before the shutter comes down. */
  readonly clear: number
  /** The shutter rolling down, and rolling up again. */
  readonly shutterDown: number
  readonly shutterUp: number
  /** A rivet caving in. */
  readonly rivet: number
  /** Being shoved back a block. */
  readonly shove: number
}

export const TIMING: Timing = {
  approach: 620,
  settle: 260,
  // The longest thing that is not a reward, because it is the most informative:
  // the mob stands split into groups with the remainder over, and then closes.
  ringoff: 720,
  bounce: 240,
  fall: 190,
  clear: 700,
  shutterDown: 420,
  shutterUp: 520,
  rivet: 260,
  shove: 900,
}

export const TIMING_REDUCED: Timing = {
  approach: 260,
  settle: 200,
  // Unchanged. There is no travel in standing still to reduce, and shortening
  // it would take away the only chance to read the remainder.
  ringoff: 720,
  bounce: 200,
  fall: 120,
  clear: 360,
  shutterDown: 200,
  shutterUp: 240,
  rivet: 200,
  shove: 420,
}

/**
 * The largest step the clock takes in one frame.
 *
 * A backgrounded tab hands back a delta of minutes. Letting that through would
 * run a whole wave while the child was looking at something else. Clamping
 * means time nearly stops when frames stop, which is the only fair reading of
 * "they were not here" — and it is a different mechanism from `pause`, which is
 * the host telling us so explicitly.
 */
export const MAX_STEP_MS = 120
