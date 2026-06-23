import { describe, expect, it } from "vitest"
import { padChannelToLength } from "./scratchPad"

describe("padChannelToLength (rev-quantized loop padding + boundary fades)", () => {
  it("pads with trailing silence to the padded length", () => {
    const src = new Float32Array([1, 1, 1, 1])
    const out = padChannelToLength(src, 4, 8, 0) // no fade
    expect(out.length).toBe(8)
    // first 4 are the real audio, last 4 are silent pad.
    expect(Array.from(out)).toEqual([1, 1, 1, 1, 0, 0, 0, 0])
  })

  it("never reads past the real audio into the source's own tail", () => {
    const src = new Float32Array([2, 2, 2, 2, 9, 9]) // realLength=4 < src.length
    const out = padChannelToLength(src, 4, 8, 0)
    // sample 4,5 must be the SILENT pad, not the source's 9s.
    expect(out[4]).toBe(0)
    expect(out[5]).toBe(0)
  })

  it("bakes a fade-IN at the start and a fade-OUT into the pad (click-free seam)", () => {
    const n = 100
    const src = new Float32Array(n).fill(1)
    const fade = 10
    const out = padChannelToLength(src, n, n + 40, fade)
    // start ramps up from 0 → toward 1.
    expect(out[0]).toBe(0)
    expect(out[fade - 1]).toBeCloseTo((fade - 1) / fade, 6)
    expect(out[fade]).toBeCloseTo(1, 6) // past the fade-in, full level
    // end of the real audio ramps DOWN into the pad.
    expect(out[n - 1]).toBe(0)
    expect(out[n - fade]).toBeCloseTo((fade - 1) / fade, 6)
  })

  it("the fade-out is monotonic non-increasing across the boundary into silence", () => {
    const n = 80
    const src = new Float32Array(n).fill(1)
    const fade = 16
    const out = padChannelToLength(src, n, n + 32, fade)
    // From the start of the fade-out region to the first pad sample, levels only fall.
    let prev = Infinity
    for (let i = n - fade; i <= n; i++) {
      const v = i < out.length ? Math.abs(out[i]) : 0
      expect(v).toBeLessThanOrEqual(prev + 1e-9)
      prev = v
    }
    expect(Math.abs(out[n])).toBe(0) // first pad sample is pure silence
  })

  it("a fade longer than half the audio is clamped (never crosses itself)", () => {
    const src = new Float32Array([1, 1, 1, 1])
    // fade=10 but real=4 → clamped to 2; out stays finite and bounded.
    const out = padChannelToLength(src, 4, 8, 10)
    expect(out.length).toBe(8)
    for (const v of out) expect(Number.isFinite(v)).toBe(true)
  })
})
