import { describe, it, expect } from "vitest"
import { dotsModel, WITHIN_STEP, CLUSTER_STEP } from "./dots"
import type { Cycle } from "../core"

const cycle = (groups: number[], unit: Cycle["unit"] = 8): Cycle => ({
  id: "t",
  name: "t",
  groups,
  unit,
})

describe("dotsModel", () => {
  it("emits one dot per pulse with the group's color role", () => {
    const m = dotsModel(cycle([2, 3]))
    expect(m.dots).toHaveLength(5)
    expect(m.dots.map((d) => d.role)).toEqual(["two", "two", "three", "three", "three"])
    expect(m.dots.map((d) => d.groupIndex)).toEqual([0, 0, 1, 1, 1])
  })

  it("spaces dots by a constant step within a cluster and a larger step between", () => {
    const m = dotsModel(cycle([2, 3]))
    // positions: 0, 1, then a cluster jump of 2 to 3, then 4, 5
    expect(m.dots.map((d) => d.pos)).toEqual([0, 1, 3, 4, 5])
    // within-cluster gaps are WITHIN_STEP, the boundary gap is CLUSTER_STEP
    expect(m.dots[1].pos - m.dots[0].pos).toBe(WITHIN_STEP)
    expect(m.dots[2].pos - m.dots[1].pos).toBe(CLUSTER_STEP)
    expect(m.dots[3].pos - m.dots[2].pos).toBe(WITHIN_STEP)
  })

  it("makes a three-cluster wider than a two-cluster for free", () => {
    const m = dotsModel(cycle([2, 3]))
    const two = m.dots.filter((d) => d.groupIndex === 0)
    const three = m.dots.filter((d) => d.groupIndex === 1)
    const twoWidth = two[two.length - 1].pos - two[0].pos
    const threeWidth = three[three.length - 1].pos - three[0].pos
    expect(threeWidth).toBeGreaterThan(twoWidth)
  })

  it("holds constant spacing across an arbitrary cycle like [5, 7, 2]", () => {
    const m = dotsModel(cycle([5, 7, 2]))
    for (let i = 1; i < m.dots.length; i++) {
      const gap = m.dots[i].pos - m.dots[i - 1].pos
      const expected = m.dots[i].isGroupHead ? CLUSTER_STEP : WITHIN_STEP
      expect(gap).toBe(expected)
    }
  })

  it("is empty for an empty cycle", () => {
    const m = dotsModel(cycle([]))
    expect(m.dots).toEqual([])
    expect(m.span).toBe(0)
  })
})
