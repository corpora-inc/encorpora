import { describe, it, expect } from "vitest"
import { delaySeconds } from "./createEffect"
import { defaultEffectParams } from "./params"
import { bindTempoSource, getBpm } from "./tempo"
import { MAX_DELAY_SECONDS } from "./noteLengths"

describe("delay — tempo sync", () => {
  it("defaults to a dotted quarter (sync = '1/4.')", () => {
    expect(defaultEffectParams("delay").sync).toBe("1/4.")
  })

  it("a synced delay time tracks the BPM (recomputes on tempo change)", () => {
    const p = defaultEffectParams("delay") // dotted quarter
    expect(delaySeconds(p, 96)).toBeCloseTo(0.9375, 6) // dotted 1/4 @ 96
    expect(delaySeconds(p, 120)).toBeCloseTo(0.75, 6) // faster → shorter
    expect(delaySeconds(p, 60)).toBeCloseTo(1.5, 6) // slower → longer
  })

  it("a quarter-note sync recomputes per tempo", () => {
    const p = { ...defaultEffectParams("delay"), sync: "1/4" }
    expect(delaySeconds(p, 120)).toBeCloseTo(0.5, 6)
    expect(delaySeconds(p, 90)).toBeCloseTo(0.6667, 3)
  })

  it("free mode uses the raw seconds and ignores BPM", () => {
    const p = { ...defaultEffectParams("delay"), sync: "free", delayTime: 0.42 }
    expect(delaySeconds(p, 96)).toBe(0.42)
    expect(delaySeconds(p, 200)).toBe(0.42)
  })

  it("clamps a long synced note to the delay's max headroom", () => {
    const p = { ...defaultEffectParams("delay"), sync: "1/1" } // whole note
    expect(delaySeconds(p, 60)).toBe(MAX_DELAY_SECONDS) // 4s → clamped to 3s
  })
})

describe("ambient tempo source", () => {
  it("returns the bound BPM, guarding non-positive / NaN", () => {
    bindTempoSource(() => 132)
    expect(getBpm()).toBe(132)
    bindTempoSource(() => 0)
    expect(getBpm()).toBe(120)
    bindTempoSource(() => Number.NaN)
    expect(getBpm()).toBe(120)
    bindTempoSource(() => 120) // restore
  })
})
