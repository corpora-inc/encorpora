import { describe, expect, it } from "vitest"
import {
  clampPlayhead,
  cubicSample,
  DEFAULT_RATE_SLEW,
  linearSample,
  renderRateBlock,
  wrapPlayhead,
} from "./scratchDsp"

/** A ramp buffer where data[i] === i — makes interpolation trivially checkable. */
const ramp = (n: number): Float32Array => {
  const d = new Float32Array(n)
  for (let i = 0; i < n; i++) d[i] = i
  return d
}

describe("wrapPlayhead (the phrase LOOPS — modulo length)", () => {
  it("wraps past the end back to the start", () => {
    expect(wrapPlayhead(0, 10)).toBe(0)
    expect(wrapPlayhead(10, 10)).toBe(0)
    expect(wrapPlayhead(12, 10)).toBe(2)
    expect(wrapPlayhead(25, 10)).toBe(5)
  })
  it("wraps past the start to the end (reverse spin loops)", () => {
    expect(wrapPlayhead(-1, 10)).toBe(9)
    expect(wrapPlayhead(-12, 10)).toBe(8)
  })
  it("guards a non-positive length", () => {
    expect(wrapPlayhead(5, 0)).toBe(0)
  })
})

describe("clampPlayhead (hard edge — retained, no wrap)", () => {
  it("clamps to [0, length]", () => {
    expect(clampPlayhead(-5, 10)).toBe(0)
    expect(clampPlayhead(99, 10)).toBe(10)
    expect(clampPlayhead(4, 10)).toBe(4)
  })
})

describe("linearSample (interpolated, LOOPING read of one wave)", () => {
  const d = ramp(8) // [0,1,2,...,7]
  it("an integer index reads the exact sample (needle = one exact moment)", () => {
    expect(linearSample(d, 3)).toBe(3)
    expect(linearSample(d, 0)).toBe(0)
  })
  it("a fractional index interpolates linearly between neighbours", () => {
    expect(linearSample(d, 3.5)).toBeCloseTo(3.5, 10)
    expect(linearSample(d, 2.25)).toBeCloseTo(2.25, 10)
  })
  it("past the end WRAPS to the start (the phrase loops)", () => {
    expect(linearSample(d, 8)).toBe(0) // wraps to index 0
    expect(linearSample(d, 16)).toBe(0)
  })
  it("at the seam interpolates between the last and the first sample", () => {
    // index 7.5 sits halfway between data[7]=7 and data[0]=0 → 3.5
    expect(linearSample(d, 7.5)).toBeCloseTo(3.5, 10)
  })
  it("a negative index wraps from the end", () => {
    expect(linearSample(d, -1)).toBe(7)
  })
  it("an empty buffer reads silence", () => {
    expect(linearSample(new Float32Array(0), 2)).toBe(0)
  })
})

describe("cubicSample (lower-alias interpolation, LOOPING)", () => {
  const d = ramp(8)
  it("integer index reads the exact sample", () => {
    expect(cubicSample(d, 4)).toBeCloseTo(4, 10)
  })
  it("interpolates a linear ramp exactly mid-buffer (Catmull-Rom is exact on a line)", () => {
    expect(cubicSample(d, 3.5)).toBeCloseTo(3.5, 6)
  })
  it("wraps modulo length (the phrase loops, no out-of-range silence)", () => {
    expect(cubicSample(d, 8)).toBeCloseTo(cubicSample(d, 0), 10)
  })
})

describe("renderRateBlock (CONTINUOUS-RATE integration — the engine)", () => {
  it("a CONSTANT rate advances the playhead LINEARLY every sample (no freeze)", () => {
    const data = ramp(64)
    const out = new Float32Array(8)
    // slew=1 → rate is already at target, constant 1 sample/sample.
    const res = renderRateBlock(data, out, 0, 1, 1, 1)
    expect(out[0]).toBeCloseTo(0, 6)
    expect(out[1]).toBeCloseTo(1, 6)
    expect(out[4]).toBeCloseTo(4, 6)
    expect(res.playhead).toBeCloseTo(8, 6)
    expect(res.rate).toBeCloseTo(1, 10)
  })
  it("keeps MOVING at the last rate with no new target (the anti-freeze fix)", () => {
    const data = ramp(64)
    const out = new Float32Array(16)
    // No "update": targetRate == rate. The playhead must keep advancing, not freeze.
    const res = renderRateBlock(data, out, 4, 0.5, 0.5, DEFAULT_RATE_SLEW)
    expect(res.playhead).toBeGreaterThan(4) // it MOVED across the block
    // Every sample differs from a single frozen value → not DC.
    expect(out[0]).not.toBe(out[8])
  })
  it("a NEGATIVE rate reads the wave BACKWARDS (reverse scratch)", () => {
    const data = ramp(64)
    const out = new Float32Array(8)
    const res = renderRateBlock(data, out, 16, -1, -1, 1)
    expect(out[0]).toBeCloseTo(16, 6)
    expect(out[1]).toBeCloseTo(15, 6)
    expect(res.playhead).toBeCloseTo(8, 6)
  })
  it("WRAPS at the end (loops) — does NOT clamp/run off", () => {
    const data = ramp(10)
    const out = new Float32Array(8)
    // start near the end, move forward → wraps back into the start
    const res = renderRateBlock(data, out, 8, 1, 1, 1)
    // playhead 8,9,(wrap)0,1,... ends at (8+8) mod 10 = 6
    expect(res.playhead).toBeCloseTo(6, 6)
    // a sample read at index 9.x then wraps to 0 — never reads out of range / silence
  })
  it("WRAPS at the start when moving backward (reverse loops)", () => {
    const data = ramp(10)
    const out = new Float32Array(8)
    const res = renderRateBlock(data, out, 2, -1, -1, 1)
    // 2,1,0,(wrap)9,8,... → (2-8) mod 10 = 4
    expect(res.playhead).toBeCloseTo(4, 6)
  })
  it("SLEWS the rate smoothly toward the target (one-pole, no jump)", () => {
    const data = ramp(256)
    const out = new Float32Array(64)
    // start at rate 0, target 4 → the rate rises gradually, not instantly.
    const res = renderRateBlock(data, out, 0, 0, 4, 0.02)
    expect(res.rate).toBeGreaterThan(0)
    expect(res.rate).toBeLessThan(4) // hasn't snapped to target in one block
  })
  it("rate 0 with target 0 is a HELD record — the playhead does not move (silence-flat)", () => {
    const data = ramp(64)
    const out = new Float32Array(8)
    const res = renderRateBlock(data, out, 5, 0, 0, DEFAULT_RATE_SLEW)
    expect(res.playhead).toBeCloseTo(5, 10)
    expect(res.rate).toBeCloseTo(0, 10)
    // It reads ONE exact sample (data[5]) — but that's the held groove, and the deck
    // gain/Hold path mutes it. Importantly the playhead is parked, not garbled.
    for (const v of out) expect(v).toBe(5)
  })
  it("spin rate 1.0 plays at NATURAL speed (one sample per output-sample)", () => {
    const data = ramp(128)
    const out = new Float32Array(32)
    const res = renderRateBlock(data, out, 0, 1, 1, 1)
    expect(res.playhead).toBeCloseTo(32, 6) // 32 samples in 32 output-samples = 1.0×
  })
  it("an empty buffer is silent and safe", () => {
    const out = new Float32Array(8).fill(9)
    const res = renderRateBlock(new Float32Array(0), out, 0, 1, 1, 1)
    for (const v of out) expect(v).toBe(0)
    expect(res.playhead).toBe(0)
    expect(res.rate).toBe(0)
  })
})
