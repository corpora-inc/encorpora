import { describe, it, expect } from "vitest"
import { barsModel, colorRoleForLength } from "./bars"
import type { Cycle } from "../core"

const cycle = (groups: number[], unit: Cycle["unit"] = 8): Cycle => ({
  id: "t",
  name: "t",
  groups,
  unit,
})

describe("colorRoleForLength", () => {
  it("maps twos, threes, and four-or-more to distinct roles", () => {
    expect(colorRoleForLength(2)).toBe("two")
    expect(colorRoleForLength(3)).toBe("three")
    expect(colorRoleForLength(4)).toBe("many")
    expect(colorRoleForLength(7)).toBe("many")
    expect(colorRoleForLength(1)).toBe("many")
  })
})

describe("barsModel", () => {
  it("carries proportional widths and color roles per group", () => {
    const m = barsModel(cycle([2, 3]))
    expect(m.groups.map((g) => g.role)).toEqual(["two", "three"])
    expect(m.groups[0].widthFraction).toBeCloseTo(2 / 5, 12)
    expect(m.groups[1].widthFraction).toBeCloseTo(3 / 5, 12)
  })

  it("places hairlines only at interior pulse divisions, not group edges", () => {
    // [2, 3] over 5 pulses. Pulse start fractions: 0, 1/5, 2/5, 3/5, 4/5.
    // Group heads are at 0 (pulse 0) and 2/5 (pulse 2); the interior divisions
    // are 1/5 (inside group 0) and 3/5, 4/5 (inside group 1).
    const m = barsModel(cycle([2, 3]))
    expect(m.hairlines).toHaveLength(3)
    expect(m.hairlines[0]).toBeCloseTo(1 / 5, 12)
    expect(m.hairlines[1]).toBeCloseTo(3 / 5, 12)
    expect(m.hairlines[2]).toBeCloseTo(4 / 5, 12)
  })

  it("is empty for an empty cycle", () => {
    const m = barsModel(cycle([]))
    expect(m.groups).toEqual([])
    expect(m.hairlines).toEqual([])
  })
})
