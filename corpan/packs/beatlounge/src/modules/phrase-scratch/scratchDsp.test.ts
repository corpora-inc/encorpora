import { describe, expect, it } from "vitest"
import {
  blockFriction,
  clampPlayhead,
  cubicSample,
  linearSample,
  renderInertiaBlock,
  renderPositionBlock,
} from "./scratchDsp"

/** A ramp buffer where data[i] === i — makes interpolation trivially checkable. */
const ramp = (n: number): Float32Array => {
  const d = new Float32Array(n)
  for (let i = 0; i < n; i++) d[i] = i
  return d
}

describe("linearSample (interpolated read of one wave)", () => {
  const d = ramp(8) // [0,1,2,...,7]
  it("an integer index reads the exact sample (needle = one exact moment)", () => {
    expect(linearSample(d, 3)).toBe(3)
    expect(linearSample(d, 0)).toBe(0)
  })
  it("a fractional index interpolates linearly between neighbours", () => {
    expect(linearSample(d, 3.5)).toBeCloseTo(3.5, 10)
    expect(linearSample(d, 2.25)).toBeCloseTo(2.25, 10)
  })
  it("past the end → silence, never a wrap to the start", () => {
    expect(linearSample(d, 100)).toBe(0)
  })
  it("before the start → silence", () => {
    expect(linearSample(d, -100)).toBe(0)
  })
  it("an empty buffer reads silence", () => {
    expect(linearSample(new Float32Array(0), 2)).toBe(0)
  })
})

describe("cubicSample (lower-alias interpolation)", () => {
  const d = ramp(8)
  it("integer index reads the exact sample", () => {
    expect(cubicSample(d, 4)).toBeCloseTo(4, 10)
  })
  it("interpolates a linear ramp exactly (Catmull-Rom is exact on a line)", () => {
    expect(cubicSample(d, 3.5)).toBeCloseTo(3.5, 6)
  })
  it("out of range → silence, no wrap", () => {
    expect(cubicSample(d, 50)).toBe(0)
    expect(cubicSample(d, -50)).toBe(0)
  })
})

describe("clampPlayhead (NO wrap — a real record runs off)", () => {
  it("clamps to [0, length]", () => {
    expect(clampPlayhead(-5, 10)).toBe(0)
    expect(clampPlayhead(99, 10)).toBe(10)
    expect(clampPlayhead(4, 10)).toBe(4)
  })
})

describe("renderPositionBlock (finger-driven scrub of the single playhead)", () => {
  it("a STATIC target (playhead==target) holds one exact sample across the block", () => {
    const data = ramp(32)
    const out = new Float32Array(8)
    const res = renderPositionBlock(data, out, 5, 5)
    expect(res.increment).toBe(0)
    // Every output sample is data[5] — the needle parked on one exact moment.
    for (const v of out) expect(v).toBe(5)
    expect(res.playhead).toBe(5)
  })
  it("advances the playhead linearly toward the target (emergent forward rate)", () => {
    const data = ramp(64)
    const out = new Float32Array(8)
    const res = renderPositionBlock(data, out, 0, 8) // increment = 1/sample
    expect(res.increment).toBeCloseTo(1, 10)
    expect(out[0]).toBeCloseTo(0, 10)
    expect(out[4]).toBeCloseTo(4, 10)
    expect(res.playhead).toBe(8)
  })
  it("a target BEHIND the playhead reads the wave BACKWARDS (reverse scratch)", () => {
    const data = ramp(64)
    const out = new Float32Array(8)
    const res = renderPositionBlock(data, out, 16, 8) // increment = -1/sample
    expect(res.increment).toBeCloseTo(-1, 10)
    expect(out[0]).toBeCloseTo(16, 10)
    expect(out[1]).toBeCloseTo(15, 10)
    expect(res.playhead).toBe(8)
  })
  it("clamps the target at the run-off (no wrap past the end)", () => {
    const data = ramp(16)
    const out = new Float32Array(4)
    const res = renderPositionBlock(data, out, 14, 1000)
    expect(res.playhead).toBe(16) // == length, clamped
  })
})

describe("renderInertiaBlock (released coast slows + stops the audio)", () => {
  const stop = 0.02
  it("integrates the playhead by velocity per sample", () => {
    const data = ramp(64)
    const out = new Float32Array(8)
    const res = renderInertiaBlock(data, out, 0, 1, 1 /*no friction*/, stop)
    expect(out[0]).toBeCloseTo(0, 6)
    expect(out[1]).toBeCloseTo(1, 6)
    expect(res.playhead).toBeGreaterThan(0)
  })
  it("decays the velocity across the block (friction)", () => {
    const data = ramp(256)
    const out = new Float32Array(64)
    const res = renderInertiaBlock(data, out, 0, 2, 0.5 /*half retained*/, stop)
    expect(Math.abs(res.velocity)).toBeLessThan(2)
  })
  it("a tiny velocity outputs SILENCE (a held record, not a frozen DC tone)", () => {
    const data = ramp(64)
    const out = new Float32Array(8).fill(9)
    const res = renderInertiaBlock(data, out, 4, stop / 2, 1, stop)
    for (const v of out) expect(v).toBe(0)
    expect(res.velocity).toBe(0)
  })
  it("stops DEAD at the run-off (clamps, zeroes the tail — no wrap)", () => {
    const data = ramp(16)
    const out = new Float32Array(32)
    const res = renderInertiaBlock(data, out, 14, 1, 1, stop)
    expect(res.velocity).toBe(0)
    expect(res.playhead).toBe(16)
    // The tail after hitting the edge is silence.
    expect(out[out.length - 1]).toBe(0)
  })
  it("a reverse coast moves the playhead backward and stops at the lead-in", () => {
    const data = ramp(32)
    const out = new Float32Array(16)
    const res = renderInertiaBlock(data, out, 4, -1, 1, stop)
    expect(res.playhead).toBe(0)
    expect(res.velocity).toBe(0)
  })
})

describe("blockFriction", () => {
  it("retains the per-second fraction over a one-second block", () => {
    expect(blockFriction(0.12, 48000, 48000)).toBeCloseTo(0.12, 8)
  })
  it("a smaller block retains MORE (less time elapsed)", () => {
    const small = blockFriction(0.12, 128, 48000)
    const big = blockFriction(0.12, 4096, 48000)
    expect(small).toBeGreaterThan(big)
  })
})
