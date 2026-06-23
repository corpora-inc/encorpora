// @vitest-environment happy-dom
/**
 * Unit tests for the PURE, audio-free soundscape logic: footstep cadence math
 * and the master mute/volume persistence. The WebAudio bits of soundscape.ts
 * cannot be unit-tested in this (node/happy-dom) environment — there is no real
 * AudioContext — so we assert the non-audio contract here, and a human verifies
 * the actual SOUND via `qa/audio-test.html`.
 */
import { describe, it, expect, beforeEach } from "vitest"
import {
  stepInterval,
  createStepClock,
  loadMuted,
  saveMuted,
  loadVolume,
  saveVolume,
  clamp01,
  DEFAULT_VOLUME,
  MIN_STEP_SPEED,
  STEPS_PER_SEC_MAX,
  STEPS_PER_SEC_MIN,
  STORAGE_MUTED,
  STORAGE_VOLUME,
} from "./cadence"

describe("stepInterval — cadence math", () => {
  it("no steps below the standing threshold (silence at rest)", () => {
    expect(stepInterval(0)).toBeNull()
    expect(stepInterval(MIN_STEP_SPEED - 0.001)).toBeNull()
  })

  it("full speed → fastest cadence (STEPS_PER_SEC_MAX)", () => {
    expect(stepInterval(1)).toBeCloseTo(1 / STEPS_PER_SEC_MAX, 5)
  })

  it("just-moving speed → slowest moving cadence (near STEPS_PER_SEC_MIN)", () => {
    const i = stepInterval(MIN_STEP_SPEED)!
    // At the threshold the rate is ~STEPS_PER_SEC_MIN; interval is its inverse.
    expect(i).toBeGreaterThan(1 / STEPS_PER_SEC_MAX)
    expect(i).toBeLessThanOrEqual(1 / STEPS_PER_SEC_MIN + 0.01)
  })

  it("interval shrinks monotonically as speed rises (faster walk = quicker steps)", () => {
    const a = stepInterval(0.2)!
    const b = stepInterval(0.6)!
    const c = stepInterval(1.0)!
    expect(a).toBeGreaterThan(b)
    expect(b).toBeGreaterThan(c)
  })

  it("clamps out-of-range speed", () => {
    expect(stepInterval(5)).toBeCloseTo(1 / STEPS_PER_SEC_MAX, 5)
    expect(stepInterval(-1)).toBeNull()
  })
})

describe("createStepClock — discrete step firing", () => {
  it("fires no steps while standing still", () => {
    const clk = createStepClock()
    let total = 0
    for (let i = 0; i < 100; i++) total += clk.tick(0, 1 / 60)
    expect(total).toBe(0)
  })

  it("fires roughly STEPS_PER_SEC_MAX steps over one second at full speed", () => {
    const clk = createStepClock()
    let total = 0
    const dt = 1 / 240
    for (let i = 0; i < 240; i++) total += clk.tick(1, dt) // simulate 1 real second
    // ~2.6 steps/sec; allow a small boundary tolerance.
    expect(total).toBeGreaterThanOrEqual(2)
    expect(total).toBeLessThanOrEqual(3)
  })

  it("a slow walk fires fewer steps than a fast walk over the same time", () => {
    const run = (speed: number) => {
      const clk = createStepClock()
      let total = 0
      const dt = 1 / 240
      for (let i = 0; i < 240; i++) total += clk.tick(speed, dt)
      return total
    }
    expect(run(0.25)).toBeLessThan(run(1))
  })

  it("caps step backlog after a huge dt (tab refocus) — never spams", () => {
    const clk = createStepClock()
    const burst = clk.tick(1, 100) // 100 seconds in one frame
    expect(burst).toBeLessThanOrEqual(3)
  })

  it("resets phase when stopping so the next step doesn't fire instantly", () => {
    const clk = createStepClock()
    // accumulate most of an interval while moving…
    clk.tick(1, 1 / 240)
    clk.tick(1, 1 / 240)
    // …then stand still: the accumulator is reset.
    expect(clk.tick(0, 1 / 60)).toBe(0)
    // first frame after standing should NOT immediately fire from stale phase.
    expect(clk.tick(1, 1 / 240)).toBe(0)
  })
})

describe("clamp01", () => {
  it("clamps and survives NaN", () => {
    expect(clamp01(-3)).toBe(0)
    expect(clamp01(3)).toBe(1)
    expect(clamp01(0.4)).toBe(0.4)
    expect(clamp01(Number.NaN)).toBe(0)
  })
})

describe("mute / volume persistence", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("defaults: not muted, DEFAULT_VOLUME", () => {
    expect(loadMuted()).toBe(false)
    expect(loadVolume()).toBe(DEFAULT_VOLUME)
  })

  it("round-trips muted", () => {
    saveMuted(true)
    expect(localStorage.getItem(STORAGE_MUTED)).toBe("1")
    expect(loadMuted()).toBe(true)
    saveMuted(false)
    expect(loadMuted()).toBe(false)
  })

  it("round-trips + clamps volume", () => {
    saveVolume(0.3)
    expect(loadVolume()).toBeCloseTo(0.3, 3)
    saveVolume(2) // out of range
    expect(loadVolume()).toBe(1)
    saveVolume(-1)
    expect(loadVolume()).toBe(0)
  })

  it("persists volume as a stable string under the documented key", () => {
    saveVolume(0.55)
    expect(localStorage.getItem(STORAGE_VOLUME)).toBe("0.550")
  })

  it("falls back to default on a corrupt stored volume", () => {
    localStorage.setItem(STORAGE_VOLUME, "not-a-number")
    expect(loadVolume()).toBe(DEFAULT_VOLUME)
  })
})
