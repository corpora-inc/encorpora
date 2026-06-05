import type { Expression } from "./characterSpec"

/**
 * FigurePose — the per-frame animation channels the animator feeds a 3D figure
 * via its optional `setPose(pose)` hook. It is a SUPERSET of the flat-cutout
 * `Pose` (characterArt): the face channels (mouth/blink/emotion…) drive the
 * painted head texture, and the BODY channels (stride/lean/sway/head*) drive real
 * 3D limb + head motion that a flat billboard never had.
 *
 * The flat cutout ignores all of this (it has no `setPose`); only the 3D figure
 * consumes it, so adding channels here is always additive + safe.
 */
export interface FigurePose {
  /* ── face (painted onto the head texture) ── */
  /** 0 closed .. 1 wide — talk mouth open amount. */
  mouth?: number
  /** 0..1 — blink (1 = eyes shut). */
  blink?: number
  /** a transient emotion blended over the resting expression. */
  emotion?: Expression
  /** 0..1 blend of `emotion` over the resting expression. */
  emotionAmt?: number
  /** 0..1 momentary brow raise (talk emphasis / surprise). */
  browRaise?: number

  /* ── body (real 3D limb + posture motion) ── */
  /** -1..1 stride phase — swings arms/legs in a believable gait. */
  stride?: number
  /** forward lean (radians) — leaning into a walk. */
  lean?: number
  /** body roll (radians) — idle weight-shift sway. */
  sway?: number
  /** -1..1 right-arm raise (wave/gesture). */
  rightArm?: number
  /** -1..1 left-arm raise. */
  leftArm?: number
  /** head yaw (radians) — idle look-around. */
  headYaw?: number
  /** head tilt/roll (radians) — talk/curiosity flavour. */
  headTilt?: number
  /** head nod/pitch (radians). */
  headNod?: number
}
