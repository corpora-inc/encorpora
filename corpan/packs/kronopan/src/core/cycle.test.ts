import { describe, it, expect } from "vitest"
import {
  isValidGroup,
  validateCycle,
  isPlayable,
  totalPulses,
  groupCount,
  additiveSignature,
  collapsedSignature,
  subdivide,
  type Cycle,
} from "./cycle"

const cycle = (groups: number[], unit: Cycle["unit"] = 8): Cycle => ({
  id: "t",
  name: "t",
  groups,
  unit,
})

describe("isValidGroup", () => {
  it("accepts positive integers of any size, not just 2 and 3", () => {
    expect(isValidGroup(1)).toBe(true)
    expect(isValidGroup(2)).toBe(true)
    expect(isValidGroup(3)).toBe(true)
    expect(isValidGroup(5)).toBe(true)
    expect(isValidGroup(7)).toBe(true)
    expect(isValidGroup(13)).toBe(true)
  })

  it("rejects zero, negatives, and non-integers", () => {
    expect(isValidGroup(0)).toBe(false)
    expect(isValidGroup(-2)).toBe(false)
    expect(isValidGroup(1.5)).toBe(false)
    expect(isValidGroup(Number.NaN)).toBe(false)
    expect(isValidGroup(Number.POSITIVE_INFINITY)).toBe(false)
  })
})

describe("validateCycle", () => {
  it("treats an arbitrary combination like [5, 7, 2] as valid and playable", () => {
    const v = validateCycle(cycle([5, 7, 2]))
    expect(v.valid).toBe(true)
    expect(v.playable).toBe(true)
    expect(v.errors).toEqual([])
  })

  it("treats an empty cycle as valid but not playable (transient edit state)", () => {
    const v = validateCycle(cycle([]))
    expect(v.valid).toBe(true)
    expect(v.playable).toBe(false)
    expect(v.errors).toEqual([])
    expect(isPlayable(cycle([]))).toBe(false)
  })

  it("reports the index of any invalid group", () => {
    const v = validateCycle(cycle([2, 0, 3]))
    expect(v.valid).toBe(false)
    expect(v.playable).toBe(false)
    expect(v.errors).toHaveLength(1)
    expect(v.errors[0]).toContain("group 1")
  })
})

describe("derived quantities", () => {
  it("totalPulses sums the groups", () => {
    expect(totalPulses(cycle([2, 2, 3, 2, 2]))).toBe(11)
    expect(totalPulses(cycle([]))).toBe(0)
  })

  it("groupCount counts the groups", () => {
    expect(groupCount(cycle([3, 2, 2]))).toBe(3)
  })

  it("additiveSignature is the additive figure, not the collapsed fraction", () => {
    expect(additiveSignature(cycle([3, 2, 2]))).toBe("3+2+2")
  })

  it("collapsedSignature reads total over unit", () => {
    expect(collapsedSignature(cycle([3, 2, 2], 8))).toBe("7/8")
    expect(collapsedSignature(cycle([2, 2, 3, 2, 2], 16))).toBe("11/16")
  })
})

describe("subdivide", () => {
  it("leaves twos, threes, and lone pulses unchanged", () => {
    expect(subdivide(1)).toEqual([1])
    expect(subdivide(2)).toEqual([2])
    expect(subdivide(3)).toEqual([3])
  })

  it("breaks an even group into all twos", () => {
    expect(subdivide(4)).toEqual([2, 2])
    expect(subdivide(6)).toEqual([2, 2, 2])
    expect(subdivide(8)).toEqual([2, 2, 2, 2])
  })

  it("breaks an odd group into a three and the rest twos, preserving the total", () => {
    expect(subdivide(5)).toEqual([3, 2])
    expect(subdivide(7)).toEqual([3, 2, 2])
    expect(subdivide(9)).toEqual([3, 2, 2, 2])
    for (const n of [4, 5, 6, 7, 9, 11]) {
      expect(subdivide(n).reduce((a, b) => a + b, 0)).toBe(n)
    }
  })
})
