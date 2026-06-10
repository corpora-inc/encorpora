import { describe, expect, it } from "vitest"
import {
  PPQ,
  MAX_LOOP_TICKS,
  clampLoopTicks,
  gridTicks,
  quantizeTick,
  secondsPerTick,
  stepForTick,
  stepsInLoop,
  swingOffsetTicks,
  tickForStep,
  ticksPerBar,
  wrapTick,
  type Grid,
} from "./timing"

describe("timing — PPQ & grid math", () => {
  it("uses 960 PPQ", () => {
    expect(PPQ).toBe(960)
    expect(MAX_LOOP_TICKS).toBe(128 * 960)
  })

  it("lands every required subdivision on an integer tick", () => {
    const cases: [Grid, number][] = [
      [{ denominator: 1 }, 3840], // whole note
      [{ denominator: 2 }, 1920], // half
      [{ denominator: 4 }, 960], // quarter
      [{ denominator: 8 }, 480], // eighth
      [{ denominator: 16 }, 240], // sixteenth
      [{ denominator: 32 }, 120], // thirty-second
      [{ denominator: 8, triplet: true }, 320], // eighth triplet
      [{ denominator: 16, triplet: true }, 160], // sixteenth triplet (KEY)
      [{ denominator: 32, triplet: true }, 80], // thirty-second triplet
      [{ denominator: 8, dotted: true }, 720], // dotted eighth
      [{ denominator: 16, dotted: true }, 360], // dotted sixteenth
    ]
    for (const [grid, ticks] of cases) {
      expect(gridTicks(grid)).toBe(ticks)
      expect(Number.isInteger(gridTicks(grid))).toBe(true)
    }
  })

  it("maps steps <-> ticks losslessly", () => {
    const grid: Grid = { denominator: 16 }
    expect(tickForStep(0, grid)).toBe(0)
    expect(tickForStep(4, grid)).toBe(960) // one beat in
    expect(stepForTick(960, grid)).toBe(4)
    expect(stepForTick(tickForStep(15, grid), grid)).toBe(15)
  })

  it("quantizes to the nearest cell", () => {
    const grid: Grid = { denominator: 16 } // 240-tick cells
    expect(quantizeTick(119, grid)).toBe(0)
    expect(quantizeTick(121, grid)).toBe(240)
    expect(quantizeTick(961, grid)).toBe(960)
  })

  it("counts whole steps in a loop", () => {
    expect(stepsInLoop(PPQ * 4, { denominator: 16 })).toBe(16) // 1 bar of 16ths
    expect(stepsInLoop(PPQ * 4, { denominator: 16, triplet: true })).toBe(24)
  })

  it("computes seconds per tick from bpm", () => {
    // 120 bpm => quarter = 0.5s => tick = 0.5/960
    expect(secondsPerTick(120)).toBeCloseTo(0.5 / 960, 10)
  })

  it("computes ticks per bar for odd meters", () => {
    expect(ticksPerBar({ numerator: 4, denominator: 4 })).toBe(3840)
    expect(ticksPerBar({ numerator: 7, denominator: 8 })).toBe(3360)
    expect(ticksPerBar({ numerator: 3, denominator: 4 })).toBe(2880)
  })
})

describe("timing — swing", () => {
  const grid: Grid = { denominator: 16 } // 240-tick cells, half = 120
  it("leaves straight cells untouched", () => {
    expect(swingOffsetTicks(0, 0.5, grid)).toBe(0) // on-cell
    expect(swingOffsetTicks(2, 0.5, grid)).toBe(0) // on-cell
  })
  it("delays off cells by up to half a cell", () => {
    expect(swingOffsetTicks(1, 0, grid)).toBe(0) // no swing
    expect(swingOffsetTicks(1, 0.5, grid)).toBe(60) // 0.5 * 120
    expect(swingOffsetTicks(3, 1, grid)).toBe(120) // full half-cell
  })
})

describe("timing — loop bounds & wrap", () => {
  it("clamps loop length to [PPQ, MAX]", () => {
    expect(clampLoopTicks(10)).toBe(PPQ)
    expect(clampLoopTicks(MAX_LOOP_TICKS + 5000)).toBe(MAX_LOOP_TICKS)
    expect(clampLoopTicks(3840)).toBe(3840)
  })
  it("wraps ticks into the loop, including negatives", () => {
    expect(wrapTick(0, 3840)).toBe(0)
    expect(wrapTick(3840, 3840)).toBe(0)
    expect(wrapTick(4000, 3840)).toBe(160)
    expect(wrapTick(-160, 3840)).toBe(3680)
  })
})
