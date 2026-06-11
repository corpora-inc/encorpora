import { describe, expect, it } from "vitest"
import {
  advanceRotationByVel,
  angleDelta,
  angularVelocityToRate,
  BUFFER_SECONDS_PER_REV,
  clampRate,
  clipArcRadians,
  COAST_STOP_EPSILON,
  decayAngularVelocity,
  fmtRate,
  fmtTime,
  FRICTION_PER_SEC,
  HOLD_EPSILON,
  isHeld,
  MAX_RATE,
  playheadToRotation,
  pointerAngle,
  rotationDeltaToRate,
  rotationToPlayhead,
  SECONDS_PER_RAD,
  timeToSpiral,
  wordIndexAt,
  type WordSpan,
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
    const from = (170 * Math.PI) / 180
    const to = (-170 * Math.PI) / 180
    const d = angleDelta(from, to)
    expect(d).toBeCloseTo((20 * Math.PI) / 180, 5)
    expect(Math.abs(d)).toBeLessThan(Math.PI)
  })
})

describe("pointerAngle", () => {
  it("reports the angle of a point about the centre", () => {
    expect(pointerAngle(0, 0, 5, 0)).toBeCloseTo(0)
    expect(pointerAngle(0, 0, 0, 5)).toBeCloseTo(Math.PI / 2)
  })
})

describe("clip arc / seconds-per-rad geometry", () => {
  it("SECONDS_PER_RAD is BUFFER_SECONDS_PER_REV / 2pi", () => {
    expect(SECONDS_PER_RAD).toBeCloseTo(BUFFER_SECONDS_PER_REV / (2 * Math.PI), 10)
  })
  it("a clip half the revolution length spans ~half the disc (pi radians)", () => {
    const halfRevClip = BUFFER_SECONDS_PER_REV / 2
    expect(clipArcRadians(halfRevClip)).toBeCloseTo(Math.PI, 6)
  })
})

describe("rotationDeltaToRate / angularVelocityToRate (faithful 1:1 contact)", () => {
  it("returns 0 for a non-positive dt", () => {
    expect(rotationDeltaToRate(1, 0)).toBe(0)
    expect(rotationDeltaToRate(1, -1)).toBe(0)
  })
  it("is exactly d(buffer-pos)/dt — 1:1 with no easing", () => {
    const rate = rotationDeltaToRate(1, 0.5)
    expect(rate).toBeCloseTo(SECONDS_PER_RAD / 0.5, 8)
  })
  it("doubling the drag doubles the rate (linear, faithful at any speed)", () => {
    const slow = rotationDeltaToRate(0.5, 0.1)
    const fast = rotationDeltaToRate(1.0, 0.1)
    expect(fast).toBeCloseTo(slow * 2, 8)
  })
  it("is signed: a backwards drag plays in reverse", () => {
    expect(rotationDeltaToRate(-1, 0.5)).toBeLessThan(0)
  })
  it("angularVelocityToRate = the per-second contact mapping", () => {
    const angVel = 3.0
    expect(angularVelocityToRate(angVel)).toBeCloseTo(rotationDeltaToRate(angVel, 1), 10)
    expect(angularVelocityToRate(angVel)).toBeCloseTo(angVel * SECONDS_PER_RAD, 10)
  })
  it("clamps a frantic flick to the safe range", () => {
    expect(rotationDeltaToRate(100000, 0.001)).toBe(MAX_RATE)
    expect(rotationDeltaToRate(-100000, 0.001)).toBe(-MAX_RATE)
  })
})

describe("rotationToPlayhead (single read-head, NO wrap, clamped)", () => {
  it("0 rotation → playhead 0 (the lead-in)", () => {
    expect(rotationToPlayhead(0, 2)).toBe(0)
  })
  it("one full revolution advances BUFFER_SECONDS_PER_REV into the buffer", () => {
    const dur = 10
    const oneRev = 2 * Math.PI
    expect(rotationToPlayhead(oneRev, dur)).toBeCloseTo(BUFFER_SECONDS_PER_REV, 8)
  })
  it("CLAMPS at the run-off — does NOT wrap past the end", () => {
    const dur = 1.3
    // A huge forward rotation must sit AT the duration, never wrap back to ~0.
    const pos = rotationToPlayhead(1000, dur)
    expect(pos).toBe(dur)
  })
  it("CLAMPS at the lead-in — a backward rotation stops at 0 (silence), no wrap", () => {
    expect(rotationToPlayhead(-5, 2)).toBe(0)
    expect(rotationToPlayhead(-0.0001, 2)).toBe(0)
  })
  it("a multi-rev phrase spirals: rev 2 reads the second slice (not the first)", () => {
    const dur = 6 // 3 revolutions at 2s/rev
    const twoRevs = 4 * Math.PI
    expect(rotationToPlayhead(twoRevs, dur)).toBeCloseTo(2 * BUFFER_SECONDS_PER_REV, 6)
  })
  it("returns 0 for a non-positive duration", () => {
    expect(rotationToPlayhead(5, 0)).toBe(0)
  })
  it("playheadToRotation is the inverse of rotationToPlayhead in-range", () => {
    const dur = 10
    const rot = 3.1
    const t = rotationToPlayhead(rot, dur)
    expect(playheadToRotation(t)).toBeCloseTo(rot, 8)
  })
})

describe("timeToSpiral (groove spirals inward across revolutions)", () => {
  it("t=0 sits at the outer rim (radiusFrac ~ 1)", () => {
    const p = timeToSpiral(0, 6)
    expect(p.radiusFrac).toBeCloseTo(1, 6)
    expect(p.angle).toBeCloseTo(0, 6)
  })
  it("each revolution adds 2pi of angle (unwrapped)", () => {
    const oneRev = timeToSpiral(BUFFER_SECONDS_PER_REV, 6)
    expect(oneRev.angle).toBeCloseTo(2 * Math.PI, 6)
  })
  it("later in a multi-rev phrase the groove is further IN (smaller radius)", () => {
    const early = timeToSpiral(0.5, 6)
    const late = timeToSpiral(5.5, 6)
    expect(late.radiusFrac).toBeLessThan(early.radiusFrac)
  })
  it("a sub-1-rev phrase uses the outer band (no visible spiral)", () => {
    const p = timeToSpiral(0.5, 1) // duration < one rev
    expect(p.radiusFrac).toBeCloseTo(1, 6)
  })
  it("never goes below the inner floor", () => {
    const p = timeToSpiral(6, 6, 0.2)
    expect(p.radiusFrac).toBeGreaterThanOrEqual(0.2 - 1e-9)
  })
})

describe("wordIndexAt (label sync on the REAL non-looping timeline)", () => {
  const spans: WordSpan[] = [
    { start: 0, end: 0.4 },
    { start: 0.7, end: 1.0 },
  ]
  it("inside a word's audible span → that word", () => {
    expect(wordIndexAt(spans, 0.2)).toBe(0)
    expect(wordIndexAt(spans, 0.85)).toBe(1)
  })
  it("between words holds the previous word's label (no flicker)", () => {
    expect(wordIndexAt(spans, 0.5)).toBe(0)
  })
  it("before the first word → word 0; past the last → last word", () => {
    expect(wordIndexAt(spans, -0.1)).toBe(0)
    expect(wordIndexAt(spans, 5)).toBe(1)
  })
  it("−1 only when there are no words", () => {
    expect(wordIndexAt([], 0.2)).toBe(-1)
  })
})

describe("momentum / friction physics (release coast)", () => {
  it("decay is monotonic toward zero", () => {
    let v = 10
    let prev = v
    for (let i = 0; i < 50; i++) {
      v = decayAngularVelocity(v, 0.05)
      expect(Math.abs(v)).toBeLessThanOrEqual(Math.abs(prev) + 1e-9)
      prev = v
    }
  })
  it("comes fully to rest (snaps to 0 below the stop epsilon)", () => {
    let v = COAST_STOP_EPSILON * 1.2
    v = decayAngularVelocity(v, 1) // one second of friction
    expect(v).toBe(0)
  })
  it("a faster flick coasts longer than a gentle one", () => {
    const steps = (v0: number) => {
      let v = v0
      let n = 0
      while (v !== 0 && n < 10000) {
        v = decayAngularVelocity(v, 1 / 60)
        n++
      }
      return n
    }
    expect(steps(20)).toBeGreaterThan(steps(2))
  })
  it("preserves direction during the coast (a reverse flick coasts backward)", () => {
    const v = decayAngularVelocity(-5, 0.05)
    expect(v).toBeLessThan(0)
  })
  it("FRICTION_PER_SEC is a retained-fraction in (0,1)", () => {
    expect(FRICTION_PER_SEC).toBeGreaterThan(0)
    expect(FRICTION_PER_SEC).toBeLessThan(1)
  })
})

describe("advanceRotationByVel (off-contact coast)", () => {
  it("does not move at zero velocity", () => {
    expect(advanceRotationByVel(1.234, 0, 0.5)).toBeCloseTo(1.234)
  })
  it("advances forward for a positive velocity and is unwrapped (smooth coast)", () => {
    const r = advanceRotationByVel(6.0, 2.0, 0.5)
    expect(r).toBeCloseTo(7.0, 8)
  })
  it("advances backward for a negative velocity", () => {
    expect(advanceRotationByVel(1.0, -2.0, 0.25)).toBeCloseTo(0.5, 8)
  })
})

describe("isHeld / HOLD_EPSILON", () => {
  it("treats a near-zero rate as a held record", () => {
    expect(isHeld(0)).toBe(true)
    expect(isHeld(HOLD_EPSILON / 2)).toBe(true)
    expect(isHeld(0.5)).toBe(false)
  })
})

describe("fmtRate / fmtTime", () => {
  it("reads 'hold' near zero", () => {
    expect(fmtRate(0)).toBe("hold")
  })
  it("shows a signed multiplier", () => {
    expect(fmtRate(1)).toBe("+1.00×")
    expect(fmtRate(-0.5)).toBe("−0.50×")
  })
  it("fmtTime shows a clamped seconds readout", () => {
    expect(fmtTime(0.837)).toBe("0.84s")
    expect(fmtTime(-1)).toBe("0.00s")
  })
})
