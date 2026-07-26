// Squash and stretch, anticipation, follow-through.
//
// Three of Disney's twelve principles, and the only three that matter for a
// screen you tap. All three are about the same thing: a shape that changes
// instantly reads as a redraw, and a shape that deforms reads as a thing.
//
// ## Volume conservation is what separates squash from "scale wobble"
//
// If a thing stretches to 1.3× along Y it must contract to 1/√1.3 ≈ 0.877 on X
// and Z. Skip that and the object simply grows and shrinks, which reads as a
// zoom, not as an impact. The kit computes the cross-axis scale rather than
// letting callers pass one, because passing one is how it gets forgotten.
//
// ## Anticipation is the cheapest 60 ms in animation
//
// A thing that is about to move fast first moves a little the *other* way. 60–
// 80 ms of wind-up makes the release read as twice as fast for free, because
// the eye measures the release against the wind-up rather than against rest.
// It also — importantly here — costs nothing on the answer path: the verdict
// has already painted, and the anticipation belongs to the *flourish*, which is
// a tail.
//
// ## Follow-through is the spring's overshoot, not a second animation
//
// A single under-damped spring gives wind-up, release and settle in one
// integrator with no sequencing and, crucially, no state machine to leave
// half-finished when the child interrupts. `settle()` is one call.

import { Spring1D } from "./spring.ts"
import { ANTICIPATE, POP } from "./ease.ts"
import { CH_UI, type Tweens } from "./tween.ts"

export interface ScaleLike {
  x: number
  y: number
  z: number
}

/**
 * A spring-driven squash-and-stretch channel for one object.
 *
 * `s` is displacement from neutral, not a scale: `0` is rest, `+0.3` is
 * stretched 30% along the primary axis, `−0.2` is squashed 20%. Impulses
 * compose additively, which is what makes rapid repeated hits build rather
 * than fight.
 */
export class Squash {
  private readonly spring: Spring1D
  /** Which axis stretches. `1` = Y (the default: things land and squash down). */
  axis: 0 | 1 | 2 = 1

  /** Output scale, rewritten in place each frame. */
  readonly scale: ScaleLike = { x: 1, y: 1, z: 1 }
  intensity = 1

  /**
   * @param frequencyHz 11–16 Hz is the impact band. Below 8 it reads as jelly.
   * @param zeta 0.35–0.5 gives one clear overshoot — the follow-through.
   */
  constructor(frequencyHz = 13, zeta = 0.4) {
    this.spring = new Spring1D(frequencyHz, zeta)
  }

  /**
   * Hit it. `amount` is **peak deformation**: `punch(0.16)` reaches 1.16× along
   * the axis (and 1/√1.16 across it) at the peak, then follows through.
   *
   * Positive stretches first, negative squashes first — a landing is negative,
   * a launch is positive.
   *
   * The peak normalisation is not cosmetic. The first build multiplied by a
   * hand-picked 26 and a tier asking for 16% got 3%; every punch in the table
   * was five times weaker than it read. See `Spring1D.impulseForPeak`.
   */
  punch(amount: number): void {
    this.spring.impulse(this.spring.impulseForPeak(amount) * this.intensity)
  }

  /** Set the deformation directly, e.g. from a held charge-up. */
  set(displacement: number): void {
    this.spring.set(displacement)
  }

  update(dtMs: number): void {
    const s = this.spring.update(dtMs)
    const along = 1 + s
    // Guard: a large impulse at a clamped 50 ms step can drive `along` negative,
    // which mirrors the mesh through itself and reads as a graphical fault.
    const safe = along < 0.05 ? 0.05 : along
    const cross = 1 / Math.sqrt(safe)
    if (this.axis === 1) {
      this.scale.x = cross
      this.scale.y = safe
      this.scale.z = cross
    } else if (this.axis === 0) {
      this.scale.x = safe
      this.scale.y = cross
      this.scale.z = cross
    } else {
      this.scale.x = cross
      this.scale.y = cross
      this.scale.z = safe
    }
  }

  applyTo(obj: { scale: ScaleLike }, base = 1): void {
    obj.scale.x = this.scale.x * base
    obj.scale.y = this.scale.y * base
    obj.scale.z = this.scale.z * base
  }

  settle(): void {
    this.spring.settle()
    this.scale.x = 1
    this.scale.y = 1
    this.scale.z = 1
  }

  isAtRest(): boolean {
    return this.spring.isAtRest()
  }

  /** For DOM prototypes. Non-uniform scale, so the volume rule still holds. */
  cssTransform(): string {
    return `scale(${this.scale.x.toFixed(4)},${this.scale.y.toFixed(4)})`
  }
}

/** Timings for the scripted pop. Named so they can be cited, not re-guessed. */
export const ANTICIPATION_MS = 70
export const RELEASE_MS = 220

/**
 * The scripted three-beat pop: wind-up, release with overshoot, settle.
 *
 * Use this when the thing must be *choreographed* — a UI element entering, a
 * number seating into a slot — and the spring when it must be *reactive*.
 * Runs on `CH_UI` so a freeze frame never stalls an element's entrance.
 *
 * Returns the total duration so a caller can schedule against it. The wind-up
 * is deliberately shallow (`0.9`): deeper reads as a stagger, not a wind-up.
 */
export function pop(
  tweens: Tweens,
  obj: { scale: ScaleLike },
  peak = 1.25,
  windupMs = ANTICIPATION_MS,
  releaseMs = RELEASE_MS,
): number {
  // Three beats. The peak has to be inside a tween's *range* to be reached —
  // an overshoot ease over a 0.9→1.0 range overshoots by 10% of 0.1, which is
  // invisible. This is the mistake that makes scripted pops look limp.
  const fast = releaseMs * 0.35
  const rest = releaseMs - fast
  tweens.to2(obj, "scale", 1, 0.9, windupMs, ANTICIPATE, {
    channel: CH_UI,
    applier: uniformScale,
  })
  tweens.to2(obj, "scale", 0.9, peak, fast, POP, {
    channel: CH_UI,
    delayMs: windupMs,
    applier: uniformScale,
  })
  tweens.to2(obj, "scale", peak, 1, rest, "outElastic", {
    channel: CH_UI,
    delayMs: windupMs + fast,
    applier: uniformScale,
  })
  return windupMs + releaseMs
}

/** Hoisted so `pop` allocates no closure per call. */
function uniformScale(o: object, _key: string, v: number): void {
  const s = (o as { scale: ScaleLike }).scale
  s.x = v
  s.y = v
  s.z = v
}
