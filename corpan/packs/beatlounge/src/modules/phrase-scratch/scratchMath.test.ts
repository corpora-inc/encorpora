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
  FRICTION_PER_SEC,
  HOLD_EPSILON,
  isHeld,
  MAX_RATE,
  pointerAngle,
  rotationDeltaToRate,
  rotationToBufferPos,
  SECONDS_PER_RAD,
  SPIN_ANG_VEL,
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

describe("word-spans-half-disc mapping", () => {
  it("SECONDS_PER_RAD is BUFFER_SECONDS_PER_REV / 2pi", () => {
    expect(SECONDS_PER_RAD).toBeCloseTo(BUFFER_SECONDS_PER_REV / (2 * Math.PI), 10)
  })
  it("a clip half the revolution length spans ~half the disc (pi radians)", () => {
    const halfRevClip = BUFFER_SECONDS_PER_REV / 2
    expect(clipArcRadians(halfRevClip)).toBeCloseTo(Math.PI, 6)
  })
  it("a ~1s padded word slot spans roughly half the record at the chosen rev", () => {
    // BUFFER_SECONDS_PER_REV is tuned ≈ 2s so a ~1s word slot ≈ half a turn.
    const wordSlotSec = 1.0
    const arc = clipArcRadians(wordSlotSec)
    expect(arc).toBeGreaterThan(Math.PI * 0.6) // clearly more than a small arc
    expect(arc).toBeLessThan(Math.PI * 1.4)
  })
})

describe("rotationDeltaToRate / angularVelocityToRate (faithful 1:1 contact)", () => {
  it("returns 0 for a non-positive dt", () => {
    expect(rotationDeltaToRate(1, 0)).toBe(0)
    expect(rotationDeltaToRate(1, -1)).toBe(0)
  })
  it("is exactly d(buffer-pos)/dt — 1:1 with no easing", () => {
    // Drag 1 radian over 0.5s → bufferDelta = SECONDS_PER_RAD; rate = that / 0.5.
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
    expect(rotationDeltaToRate(1000, 0.001)).toBe(MAX_RATE)
    expect(rotationDeltaToRate(-1000, 0.001)).toBe(-MAX_RATE)
  })
})

describe("rotationToBufferPos", () => {
  it("0 rotation → position 0", () => {
    expect(rotationToBufferPos(0, 2)).toBe(0)
  })
  it("wraps into [0, loopSeconds)", () => {
    const loop = 1.3
    const pos = rotationToBufferPos(1000, loop)
    expect(pos).toBeGreaterThanOrEqual(0)
    expect(pos).toBeLessThan(loop)
  })
  it("a negative rotation wraps to a positive position (reverse scrub)", () => {
    const pos = rotationToBufferPos(-0.1, 2)
    expect(pos).toBeGreaterThan(0)
    expect(pos).toBeLessThan(2)
  })
  it("returns 0 for a non-positive loop length", () => {
    expect(rotationToBufferPos(5, 0)).toBe(0)
  })
})

describe("wordIndexAt (label sync; inter-word gap is silent)", () => {
  // Two words on a gapped, looped timeline: [0,0.4] word0, gap, [0.7,1.0] word1, gap.
  const spans: WordSpan[] = [
    { start: 0, end: 0.4 },
    { start: 0.7, end: 1.0 },
  ]
  const loop = 1.3 // 1.0 + a trailing gap
  it("inside a word's audible span → that word", () => {
    expect(wordIndexAt(spans, 0.2, loop)).toBe(0)
    expect(wordIndexAt(spans, 0.85, loop)).toBe(1)
  })
  it("in the gap after a word holds that word's label (no flicker)", () => {
    expect(wordIndexAt(spans, 0.5, loop)).toBe(0) // gap between word0 and word1
    expect(wordIndexAt(spans, 1.15, loop)).toBe(1) // gap after the last word
  })
  it("wraps the position into the loop", () => {
    expect(wordIndexAt(spans, 0.2 + loop, loop)).toBe(0)
  })
  it("−1 only when there are no words", () => {
    expect(wordIndexAt([], 0.2, loop)).toBe(-1)
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
    // FRICTION_PER_SEC keeps only a fraction per second → below epsilon → 0.
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
    expect(r).toBeCloseTo(7.0, 8) // 6.0 + 2.0*0.5, NOT wrapped into 0..2pi
  })
  it("advances backward for a negative velocity", () => {
    expect(advanceRotationByVel(1.0, -2.0, 0.25)).toBeCloseTo(0.5, 8)
  })
})

describe("SPIN_ANG_VEL", () => {
  it("is the angular velocity that plays the snippet once per revolution-period", () => {
    // one whole BUFFER_SECONDS_PER_REV per 2pi radians → SECONDS_PER_RAD * SPIN = 1
    expect(angularVelocityToRate(SPIN_ANG_VEL)).toBeCloseTo(1, 6)
  })
})

describe("isHeld / HOLD_EPSILON", () => {
  it("treats a near-zero rate as a held record", () => {
    expect(isHeld(0)).toBe(true)
    expect(isHeld(HOLD_EPSILON / 2)).toBe(true)
    expect(isHeld(0.5)).toBe(false)
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
