// Springs, integrated exactly.
//
// A damped harmonic oscillator has a closed-form solution, so there is no
// reason to integrate one numerically — and three reasons not to:
//
//   1. Semi-implicit Euler drifts with frame rate. The same "pop" is visibly
//      different at 60 Hz and at 120 Hz, and an iPad Pro is 120 Hz. Springs are
//      where frame-rate-dependent feel usually hides, because it looks fine on
//      the machine it was tuned on.
//   2. A stiff spring at a 50 ms clamped step (see `MAX_DT_MS`) goes unstable
//      under Euler and throws the object across the screen. This form cannot.
//   3. `settleNow()` has to fast-forward everything to its rest state in one
//      frame. An integrator can only get there by iterating.
//
// The step below is an **exponential integrator**: it evaluates the analytic
// solution over exactly `dt` and re-bases. Because the system is linear it has
// the semi-group property, so one 16 ms step equals sixteen 1 ms steps to float
// precision. `spring.test.ts` asserts that, and it is the property that makes
// the kit frame-rate-independent.

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

/** A single-axis spring pulling toward `rest`. Zero allocation per step. */
export class Spring1D {
  /** Current value. Read this. */
  x = 0
  /** Current velocity, units per second. */
  v = 0
  rest = 0

  /** Natural frequency, rad/s. Higher = snappier. */
  omega: number
  /** Damping ratio. 1 = critically damped (no overshoot). <1 overshoots. */
  zeta: number

  /**
   * @param frequencyHz how fast it wants to oscillate. 4–8 Hz reads as
   *   "responsive UI"; 12–20 Hz reads as "impact recoil".
   * @param zeta 1 for a clean return, 0.35–0.6 for a visible bounce.
   */
  constructor(frequencyHz = 8, zeta = 1) {
    this.omega = 2 * Math.PI * frequencyHz
    this.zeta = clamp(zeta, 0, 4)
  }

  /** Kick it. This is how impacts enter the system: as velocity, not position. */
  impulse(dv: number): void {
    this.v += dv
  }

  /**
   * The velocity impulse that produces a peak displacement of exactly `peak`.
   *
   * Without this, "impulse strength" is an arbitrary number whose visible
   * result depends on the spring's frequency and damping — and it is wrong by a
   * large factor in a way that is invisible in code review. Measured on the
   * first build of this kit: a tier asking for a 16% scale punch produced a 3%
   * one, because an 18 Hz spring converts a unit of velocity into roughly
   * 0.004 units of displacement. Every tier's numbers were quietly meaningless.
   *
   * With it, a tier says `punch(0.16)` and gets 16%, and the tuning table is
   * readable by a designer rather than by whoever wrote the integrator.
   *
   * Derived from the analytic peak of the impulse response:
   *   under-damped   x(t) = (v/ωd)·e^(−ζωt)·sin(ωd·t), maximised at
   *                  t* = atan(ωd / ζω) / ωd
   *   critical       x(t) = v·t·e^(−ωt), maximised at t = 1/ω → peak = v/(ω·e)
   */
  impulseForPeak(peak: number): number {
    return peak / this.peakPerUnitImpulse()
  }

  /** Displacement produced by an impulse of 1. Computed once per call; cheap. */
  peakPerUnitImpulse(): number {
    const w = this.omega
    const z = this.zeta
    if (z >= 0.9999) {
      // Critical and over-damped both peak close to this; the over-damped case
      // is not used for impacts, so the critical form is the right answer here.
      return 1 / (w * Math.E)
    }
    const wd = w * Math.sqrt(1 - z * z)
    const tStar = Math.atan(wd / (z * w)) / wd
    return (1 / wd) * Math.exp(-z * w * tStar) * Math.sin(wd * tStar)
  }

  /** Snap to a value with no velocity. */
  set(x: number, v = 0): void {
    this.x = x
    this.v = v
  }

  /** Jump to rest. Used by `settleNow()`. */
  settle(): void {
    this.x = this.rest
    this.v = 0
  }

  /** True once the spring is visually done — lets callers stop paying for it. */
  isAtRest(epsilon = 0.0005): boolean {
    return Math.abs(this.x - this.rest) < epsilon && Math.abs(this.v) < epsilon * 60
  }

  /** Advance by `dtMs`. Exact for any dt. */
  update(dtMs: number): number {
    if (dtMs <= 0) return this.x
    const t = dtMs * 0.001
    const w = this.omega
    const z = this.zeta
    const x0 = this.x - this.rest
    const v0 = this.v

    if (z >= 0.9999 && z <= 1.0001) {
      // Critically damped: x(t) = (x0 + (v0 + w x0) t) e^(-w t)
      const e = Math.exp(-w * t)
      const b = v0 + w * x0
      this.x = this.rest + (x0 + b * t) * e
      this.v = (v0 - w * b * t) * e
    } else if (z < 1) {
      // Under-damped: the oscillating case. This is the one that feels alive.
      const wd = w * Math.sqrt(1 - z * z)
      const e = Math.exp(-z * w * t)
      const c = Math.cos(wd * t)
      const s = Math.sin(wd * t)
      const k = (v0 + z * w * x0) / wd
      this.x = this.rest + e * (x0 * c + k * s)
      this.v = e * (v0 * c - (x0 * (w * w) + z * w * v0) * (s / wd))
    } else {
      // Over-damped: two real roots. Slow and sure; used for camera follow.
      const r = w * Math.sqrt(z * z - 1)
      const r1 = -z * w + r
      const r2 = -z * w - r
      const c2 = (v0 - r1 * x0) / (r2 - r1)
      const c1 = x0 - c2
      const e1 = Math.exp(r1 * t)
      const e2 = Math.exp(r2 * t)
      this.x = this.rest + c1 * e1 + c2 * e2
      this.v = c1 * r1 * e1 + c2 * r2 * e2
    }
    return this.x
  }
}

/** Three independent springs. Convenience for position and scale kicks. */
export class Spring3D {
  readonly x: Spring1D
  readonly y: Spring1D
  readonly z: Spring1D

  constructor(frequencyHz = 8, zeta = 1) {
    this.x = new Spring1D(frequencyHz, zeta)
    this.y = new Spring1D(frequencyHz, zeta)
    this.z = new Spring1D(frequencyHz, zeta)
  }

  impulse(dx: number, dy: number, dz: number): void {
    this.x.impulse(dx)
    this.y.impulse(dy)
    this.z.impulse(dz)
  }

  update(dtMs: number): void {
    this.x.update(dtMs)
    this.y.update(dtMs)
    this.z.update(dtMs)
  }

  settle(): void {
    this.x.settle()
    this.y.settle()
    this.z.settle()
  }

  isAtRest(epsilon = 0.0005): boolean {
    return this.x.isAtRest(epsilon) && this.y.isAtRest(epsilon) && this.z.isAtRest(epsilon)
  }
}
