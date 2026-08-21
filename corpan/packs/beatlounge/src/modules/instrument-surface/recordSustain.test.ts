import { describe, expect, it } from "vitest"
import type { Grid } from "../../model/document"
import { gridTicks } from "../../model/timing"
import { heldNoteDuration } from "./recordSustain"

const grid: Grid = { denominator: 16 } // 1/16 → 240 ticks at PPQ 960
const STEP = gridTicks(grid)

describe("heldNoteDuration — record sustain (#397)", () => {
  it("a tap (no elapsed time) stays one step — never a zero-length dot", () => {
    expect(heldNoteDuration(0, 0, grid, false)).toBe(STEP)
    expect(heldNoteDuration(480, 480, grid, true)).toBe(STEP)
  })

  it("a stopped transport (nowTick < 0) falls back to one step", () => {
    expect(heldNoteDuration(0, -1, grid, false)).toBe(STEP)
    expect(heldNoteDuration(0, -1, grid, true)).toBe(STEP)
  })

  it("free timing: the raw held length, floored at one step", () => {
    expect(heldNoteDuration(1000, 1000 + STEP * 3, grid, false)).toBe(STEP * 3)
    // held shorter than a step still floors to a step
    expect(heldNoteDuration(1000, 1000 + 10, grid, false)).toBe(STEP)
  })

  it("quantized: the held length rounds to whole steps", () => {
    // started at step 0, playhead ~3.4 steps in → 3 whole steps
    expect(heldNoteDuration(0, Math.round(STEP * 3.4), grid, true)).toBe(STEP * 3)
    // held within the same step → one step
    expect(heldNoteDuration(0, Math.round(STEP * 0.4), grid, true)).toBe(STEP)
    // start already on a step boundary (a quantized note's tick), 5 steps held
    expect(heldNoteDuration(STEP * 2, STEP * 7, grid, true)).toBe(STEP * 5)
  })
})
