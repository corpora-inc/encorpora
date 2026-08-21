import { describe, it, expect } from "vitest"
import {
  isValidGroup,
  validateCycle,
  isPlayable,
  totalPulses,
  groupCount,
  additiveSignature,
  collapsedSignature,
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
