// **The reason mashing loses.**
//
// A steelyard is a bar of steel. Hang a weight on it and it rings, and a bar
// that is struck again while it is still ringing rings harder — the second blow
// arrives in phase with the first. Keep that up and the steel does not simply
// get loud; it shears.
//
// So every strike puts strain into the beam, and how much depends entirely on
// **when it lands**. A blow that arrives after the ring has died costs almost
// nothing. A blow that lands on top of the last one costs six times as much.
// Strain bleeds away on its own; past the shear limit the beam snaps and the
// round is over.
//
// The consequence, which is the design:
//
//   * A player who works the sum out and then strikes the eight or ten plates
//     their answer needs, a quarter-second apart, never comes close to the
//     limit.
//   * A player who mashes shears the beam in **under half a second**, before
//     they could have arrived anywhere by accident.
//   * A player who ignores the sum and hunts for the answer by watching which
//     way the beam leans has to wait for it to settle between probes, and the
//     round clock — not this — is what runs out on them.
//
// Every quantity here is an integer in strain units. That is not fussiness: the
// shear verdict is a comparison, a comparison on a float is a comparison that
// depends on frame timing, and "the beam snapped and I do not know why" is not
// something a child should ever be handed.

/** Strain a blow costs when the beam is already still. */
export const BASE_STRAIN = 2

/**
 * How long the ring lasts. A blow inside this window is in phase with the last
 * one and is charged for it, on a straight ramp from `BASE_STRAIN` at the edge
 * to `BASE_STRAIN + RESONANCE_MS / RESONANCE_DIVISOR` at zero gap.
 */
export const RESONANCE_MS = 220
export const RESONANCE_DIVISOR = 20

/**
 * Strain that bleeds out of the steel per second.
 *
 * Set from the worst case a *correct* player can face: the longest balanced plan
 * on this rack is around twenty-five blows, and twenty-five deliberate blows a
 * quarter-second apart must never shear the beam. Punishing the child who did
 * the arithmetic because their answer happened to need a lot of plates would be
 * the game lying about what it rewards.
 */
export const BLEED_PER_SEC = 6

export type StrainLimits = {
  /** Strain at or above which the beam shears. */
  readonly shearAt: number
}

/** What one blow costs, given the gap since the previous one. */
export function impulseFor(gapMs: number): number {
  const gap = Math.max(0, gapMs)
  if (gap >= RESONANCE_MS) return BASE_STRAIN
  return BASE_STRAIN + Math.floor((RESONANCE_MS - gap) / RESONANCE_DIVISOR)
}

/**
 * The beam's strain, in whole units, with the bleed accumulated in milliseconds
 * so that a 16 ms frame and a 4 ms frame reach the same number.
 */
export class Strain {
  private readonly limits: StrainLimits
  private value = 0
  private bleedMs = 0
  private sinceStrike = Number.POSITIVE_INFINITY
  private sheared = false

  constructor(limits: StrainLimits) {
    this.limits = limits
  }

  get level(): number {
    return this.value
  }

  /** 0..1 against the shear limit. The only float here, and it is for the dial. */
  get load(): number {
    return Math.max(0, Math.min(1, this.value / this.limits.shearAt))
  }

  get isSheared(): boolean {
    return this.sheared
  }

  advance(dtMs: number): void {
    if (dtMs <= 0) return
    this.sinceStrike = this.sinceStrike === Number.POSITIVE_INFINITY ? this.sinceStrike : this.sinceStrike + dtMs
    if (this.value <= 0) {
      this.bleedMs = 0
      return
    }
    this.bleedMs += dtMs
    const shed = Math.floor((this.bleedMs * BLEED_PER_SEC) / 1000)
    if (shed > 0) {
      this.value = Math.max(0, this.value - shed)
      this.bleedMs -= Math.floor((shed * 1000) / BLEED_PER_SEC)
    }
  }

  /**
   * Record a blow. Returns the strain it cost, so the renderer can flare the
   * beam in proportion and the audio can bite harder on a resonant one.
   */
  strike(): number {
    const impulse = impulseFor(this.sinceStrike)
    this.value += impulse
    this.sinceStrike = 0
    if (this.value >= this.limits.shearAt) this.sheared = true
    return impulse
  }
}
