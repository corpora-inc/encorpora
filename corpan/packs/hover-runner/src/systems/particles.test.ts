import { describe, it, expect } from "vitest"
import { createScreenShake } from "./particles"

// Regression coverage for the #438 PR-6 screen-shake rework. The old impl used
// a separate setInterval(16ms): it was not frame-rate independent and it
// dropped a second trigger while a shake was already running. The new impl is
// driven by the render loop's dt and stacks energy on each trigger.
describe("createScreenShake (delta-timed, stackable)", () => {
  it("starts at rest with a zero offset", () => {
    const { shakeOffset } = createScreenShake()
    expect(shakeOffset.x).toBe(0)
    expect(shakeOffset.y).toBe(0)
    expect(shakeOffset.z).toBe(0)
  })

  it("produces a non-zero offset after a trigger + update", () => {
    const { shakeOffset, trigger, update } = createScreenShake()
    trigger()
    update(0.016)
    const magnitude =
      Math.abs(shakeOffset.x) + Math.abs(shakeOffset.y) + Math.abs(shakeOffset.z)
    expect(magnitude).toBeGreaterThan(0)
  })

  it("decays back to exactly rest after enough time", () => {
    const { shakeOffset, trigger, update } = createScreenShake()
    trigger()
    // Advance ~1s in 16ms steps; energy half-life is 90ms, so this is many
    // half-lives and must reach the rest snap-to-zero branch.
    for (let i = 0; i < 60; i++) update(0.016)
    expect(shakeOffset.x).toBe(0)
    expect(shakeOffset.y).toBe(0)
    expect(shakeOffset.z).toBe(0)
  })

  it("is frame-rate independent: same wall-clock decay regardless of step size", () => {
    // Decay one shake to the SAME total elapsed time (~96ms ≈ one half-life)
    // at 16ms steps (~60fps) vs 8ms steps (~120fps), then measure the residual
    // energy via mean |x| over many micro-steps. exp(dt) decay is exact under
    // step subdivision, so both rates must land on the same residual energy.
    // The old setInterval impl could not — it only ticked every ~16ms wall
    // time, so a 120Hz frame saw a stale offset on alternate frames.
    const residualEnergy = (step: number) => {
      const s = createScreenShake()
      s.trigger()
      const elapsed = 0.096
      const steps = Math.round(elapsed / step)
      for (let i = 0; i < steps; i++) s.update(step)
      // Sample residual energy: E[|x|] = energy/2 over many ~0-dt frames.
      let sum = 0
      const N = 4000
      for (let i = 0; i < N; i++) {
        s.update(1e-6)
        sum += Math.abs(s.shakeOffset.x)
      }
      return (sum / N) * 2 // back out energy from mean|x|
    }

    const e60 = residualEnergy(0.016)
    const e120 = residualEnergy(0.008)
    expect(e60).toBeGreaterThan(0)
    expect(e120).toBeGreaterThan(0)
    // Within ~12% of each other (Monte-Carlo noise on 4000 samples + the tiny
    // residual decay of the sampling loop). Frame-rate independence proven.
    const ratio = e60 / e120
    expect(ratio).toBeGreaterThan(0.88)
    expect(ratio).toBeLessThan(1.12)
  })

  it("stacks: a second trigger while shaking adds energy (does not drop it)", () => {
    // Drive each shake with near-zero dt so decay is negligible, then sample
    // the mean |x| over many frames. With dt≈0 the offset is uniform on
    // [-energy, +energy], so E[|x|] = energy/2 — a stable, deterministic-ish
    // proxy for the underlying energy (law of large numbers over 4000 samples).
    const meanAbsX = (kicks: number) => {
      const s = createScreenShake()
      for (let k = 0; k < kicks; k++) s.trigger()
      let sum = 0
      const N = 4000
      for (let i = 0; i < N; i++) {
        s.update(1e-6) // negligible decay
        sum += Math.abs(s.shakeOffset.x)
      }
      return sum / N
    }

    const single = meanAbsX(1) // energy ~0.08  → mean|x| ~0.04
    const stacked = meanAbsX(2) // energy ~0.16  → mean|x| ~0.08

    // The two-trigger shake is meaningfully stronger. Under the old
    // `if (shakeActive) return` early-out the second trigger was a no-op, so
    // these would have been equal. We assert a clear separation (≥40% larger)
    // with generous margin for the small remaining Monte-Carlo noise.
    expect(stacked).toBeGreaterThan(single * 1.4)
  })
})
