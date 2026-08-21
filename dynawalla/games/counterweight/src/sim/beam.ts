// The beam itself: a real spring-and-damper, because the beam is the only
// instrument in the game that tells you anything.
//
// **What it reads, and what it deliberately will not read.** The beam's resting
// angle is a *saturating* function of the margin. Within a few units of level it
// has genuine gradation — you can feel one notch ahead differently from dead
// level — and past that it is hard against its stop and says nothing but "miles
// out". So it is a trim instrument, not an oracle: a player who has done the
// arithmetic gets confirmation, and a player who has not cannot bisect their way
// to a three-digit number through it.
//
// **The ring is the cost of a probe.** A blow sets the beam swinging, and a
// swinging beam has no reading — the angle is travelling through everything. So
// "strike and look" costs a settle, roughly a third of a second, every time. The
// window runs out on anyone doing that thirty times.
//
// **Reduced motion is a branch here, and only here.** The beam still moves,
// because the beam moving *is* the information; it is critically damped instead,
// so it travels to its reading and stops rather than ringing its way there. Same
// reading, same timing, no oscillation.

/** Radians at the stop. A beam against its stop is unmistakable. */
export const MAX_TILT = 0.42

/**
 * Units of margin per unit of tilt-shape. Small: the interesting region is the
 * handful of units either side of level, and everything past it is the stop.
 */
export const SENSITIVITY = 3

export type BeamTuning = {
  /** Spring constant, rad/s² per rad. */
  readonly stiffness: number
  /** Damping, per second. */
  readonly damping: number
  /** Angular velocity a blow imparts, rad/s per unit of strain. */
  readonly kick: number
}

export const TUNING: BeamTuning = { stiffness: 78, damping: 6.4, kick: 0.055 }

/**
 * Critically damped, no kick. `damping = 2√stiffness` is the boundary at which a
 * spring stops overshooting, so this is the same beam with the ring taken out
 * rather than a different beam.
 */
export const TUNING_REDUCED: BeamTuning = {
  stiffness: 78,
  damping: 2 * Math.sqrt(78),
  kick: 0,
}

/** Below this angular speed the beam is readable. */
export const SETTLE_OMEGA = 0.06

/** Where the beam wants to sit for a given margin. */
export function restAngle(margin: number): number {
  return MAX_TILT * Math.tanh(margin / SENSITIVITY)
}

export class Beam {
  private readonly tuning: BeamTuning
  private theta = 0
  private omega = 0
  private target = 0

  constructor(tuning: BeamTuning = TUNING) {
    this.tuning = tuning
  }

  /** Positive is your side down — you are ahead. */
  get angle(): number {
    return this.theta
  }

  get velocity(): number {
    return this.omega
  }

  /** True when the beam has stopped travelling and its reading can be trusted. */
  get settled(): boolean {
    return Math.abs(this.omega) < SETTLE_OMEGA
  }

  /** 0..1 — how much ring is left in the steel. Drives the shimmer and the drone. */
  get ring(): number {
    return Math.max(0, Math.min(1, Math.abs(this.omega) / 2.4))
  }

  /** The margin changed. */
  aim(margin: number): void {
    this.target = restAngle(margin)
  }

  /** A blow landed. `strength` is the strain it cost, so a hard blow rings hard. */
  hit(strength: number, direction: number): void {
    this.omega += this.tuning.kick * strength * Math.sign(direction || 1)
  }

  /** Slam to the stop and hold — the shear, and the pin. */
  slam(direction: number): void {
    this.theta = MAX_TILT * 1.5 * Math.sign(direction || 1)
    this.omega = 0
  }

  advance(dtMs: number): void {
    // Fixed sub-steps: an explicit integrator on a stiff spring goes unstable if
    // it is handed a 120 ms frame, and an unstable beam is a beam that flies off
    // the screen in front of a child.
    let left = Math.max(0, dtMs)
    while (left > 0) {
      const step = Math.min(left, 4)
      left -= step
      const dt = step / 1000
      const accel = -this.tuning.stiffness * (this.theta - this.target) - this.tuning.damping * this.omega
      this.omega += accel * dt
      this.theta += this.omega * dt
    }
  }

  /** Put the beam where it belongs with no travel. Used when a round opens. */
  settleTo(margin: number): void {
    this.target = restAngle(margin)
    this.theta = this.target
    this.omega = 0
  }
}
