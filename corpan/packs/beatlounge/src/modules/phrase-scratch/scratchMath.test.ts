import { describe, expect, it } from "vitest"
import {
  advanceRotation,
  angleDelta,
  angularVelocityToRate,
  clampRate,
  easeRate,
  fmtRate,
  HOLD_EPSILON,
  isHeld,
  MAX_RATE,
  pointerAngle,
  RATE_GAIN,
} from "./scratchMath"

describe("clampRate", () => {
  it("passes through in-range rates", () => {
    expect(clampRate(0)).toBe(0)
    expect(clampRate(1.5)).toBe(1.5)
    expect(clampRate(-2)).toBe(-2)
  })
  it("clamps to ±MAX_RATE", () => {
    expect(clampRate(99)).toBe(MAX_RATE)
    expect(clampRate(-99)).toBe(-MAX_RATE)
  })
  it("treats non-finite as 0 (never feeds NaN/Infinity to the audio node)", () => {
    expect(clampRate(NaN)).toBe(0)
    expect(clampRate(Infinity)).toBe(0)
    expect(clampRate(-Infinity)).toBe(0)
  })
})

describe("angleDelta", () => {
  it("is the plain difference within range", () => {
    expect(angleDelta(0, 1)).toBeCloseTo(1)
    expect(angleDelta(1, 0)).toBeCloseTo(-1)
  })
  it("wraps across the +/-pi seam so a sweep stays continuous (no rate spike)", () => {
    // 170deg -> -170deg is really a +20deg forward step, not a -340deg jump.
    const from = (170 * Math.PI) / 180
    const to = (-170 * Math.PI) / 180
    const d = angleDelta(from, to)
    expect(d).toBeCloseTo((20 * Math.PI) / 180, 5)
    expect(Math.abs(d)).toBeLessThan(Math.PI)
  })
})

describe("pointerAngle", () => {
  it("reports the angle of a point about the centre", () => {
    // point directly to the right of centre -> 0 rad
    expect(pointerAngle(0, 0, 5, 0)).toBeCloseTo(0)
    // directly below (y down) -> +pi/2
    expect(pointerAngle(0, 0, 0, 5)).toBeCloseTo(Math.PI / 2)
  })
})

describe("angularVelocityToRate", () => {
  it("maps a one-rotation-per-second sweep near unity at the default gain", () => {
    // 2*pi rad/s * RATE_GAIN(=1/2pi) = 1.0
    expect(angularVelocityToRate(2 * Math.PI)).toBeCloseTo(1, 5)
  })
  it("is signed: a backwards sweep gives a negative (reverse) rate", () => {
    expect(angularVelocityToRate(-2 * Math.PI)).toBeCloseTo(-1, 5)
  })
  it("clamps a frantic flick to the safe range", () => {
    expect(angularVelocityToRate(100 * Math.PI)).toBe(MAX_RATE)
    expect(angularVelocityToRate(-100 * Math.PI)).toBe(-MAX_RATE)
  })
  it("respects a custom gain", () => {
    expect(angularVelocityToRate(1, 2)).toBeCloseTo(2)
  })
  it("RATE_GAIN is the documented 1/2pi", () => {
    expect(RATE_GAIN).toBeCloseTo(1 / (2 * Math.PI), 10)
  })
})

describe("easeRate", () => {
  it("moves toward the target without overshooting (smooth = click-free)", () => {
    const next = easeRate(0, 1, 0.016, 0.04)
    expect(next).toBeGreaterThan(0)
    expect(next).toBeLessThan(1)
  })
  it("converges to the target over many steps", () => {
    let r = 0
    for (let i = 0; i < 200; i++) r = easeRate(r, 1, 0.016, 0.04)
    expect(r).toBeCloseTo(1, 3)
  })
  it("passes smoothly THROUGH zero forward->reverse (no discontinuity)", () => {
    // From +1 easing toward -1: the path crosses zero monotonically, never jumps.
    let r = 1
    let prev = r
    let crossed = false
    for (let i = 0; i < 300; i++) {
      r = easeRate(r, -1, 0.016, 0.04)
      // monotonic decrease (no skip / oscillation through zero)
      expect(r).toBeLessThanOrEqual(prev + 1e-9)
      if (prev > 0 && r <= 0) crossed = true
      prev = r
    }
    expect(crossed).toBe(true)
    expect(r).toBeCloseTo(-1, 3)
  })
  it("returns the target immediately when tau<=0", () => {
    expect(easeRate(0.5, 3, 0.016, 0)).toBe(3)
  })
})

describe("isHeld / HOLD_EPSILON", () => {
  it("treats a near-zero rate as a held record", () => {
    expect(isHeld(0)).toBe(true)
    expect(isHeld(HOLD_EPSILON / 2)).toBe(true)
    expect(isHeld(0.5)).toBe(false)
  })
})

describe("advanceRotation", () => {
  it("does not move when the rate is zero (held record)", () => {
    expect(advanceRotation(1, 0, 0.5)).toBeCloseTo(1)
  })
  it("turns forward for a positive rate and stays within 0..2pi", () => {
    const r = advanceRotation(0, 1, 0.5)
    expect(r).toBeGreaterThan(0)
    expect(r).toBeLessThan(2 * Math.PI)
  })
  it("turns backward for a negative rate (reverse scratch)", () => {
    const r = advanceRotation(0.5, -1, 0.2)
    // wrapped into 0..2pi, a backward step from 0.5 lands near the top of the range
    expect(r).toBeGreaterThan(Math.PI)
  })
})

describe("fmtRate", () => {
  it("reads 'hold' near zero", () => {
    expect(fmtRate(0)).toBe("hold")
  })
  it("shows a signed multiplier", () => {
    expect(fmtRate(1)).toBe("+1.00×")
    expect(fmtRate(-0.5)).toBe("−0.50×")
  })
})
