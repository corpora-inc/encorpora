import { describe, it, expect } from "vitest"
import { resolveStepUp } from "./controller"

/**
 * The bridge side-climb guard: you can step DOWN freely and step UP at most one
 * "step" per frame. The raised deck (~3u) is only reachable via its ramp, whose
 * per-frame rise (~0.07u at MOVE_SPEED/60fps) is well under the step — so the ramp
 * works while walking into the deck's SIDE (an instant ~3u lift) is blocked.
 */
describe("resolveStepUp — bridge side-climb guard", () => {
  it("stays put on flat ground", () => {
    expect(resolveStepUp(0, 0)).toEqual({ groundY: 0, blocked: false })
  })

  it("accepts a small step up (ramp, gradual)", () => {
    expect(resolveStepUp(0, 0.07)).toEqual({ groundY: 0.07, blocked: false })
  })

  it("accepts stepping DOWN any amount (walking off / down the ramp)", () => {
    expect(resolveStepUp(3, 0)).toEqual({ groundY: 0, blocked: false })
  })

  it("BLOCKS a sudden lift onto the deck side (~3u jump)", () => {
    expect(resolveStepUp(0, 3)).toEqual({ groundY: 0, blocked: true })
  })

  it("BLOCKS a lift just over the step threshold, accepts just under", () => {
    expect(resolveStepUp(0, 0.6).blocked).toBe(false) // exactly the step → ok
    expect(resolveStepUp(0, 0.61).blocked).toBe(true) // over → blocked
  })

  it("ramp: gradual per-frame rises reach the deck unblocked", () => {
    let g = 0
    for (let i = 0; i < 200 && g < 3.0; i++) {
      const target = Math.min(g + 0.072, 3.0) // ramp delta at MOVE_SPEED / 60fps
      const r = resolveStepUp(g, target)
      expect(r.blocked).toBe(false)
      g = r.groundY
    }
    expect(g).toBeCloseTo(3.0)
  })
})
