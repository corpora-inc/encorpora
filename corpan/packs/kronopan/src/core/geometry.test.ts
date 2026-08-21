import { describe, it, expect } from "vitest"
import {
  groupSpans,
  pulseMarks,
  wrapPulses,
  activeAt,
} from "./geometry"
import type { Cycle } from "./cycle"

const cycle = (groups: number[], unit: Cycle["unit"] = 8): Cycle => ({
  id: "t",
  name: "t",
  groups,
  unit,
})

describe("groupSpans (the proportionality invariant)", () => {
  it("gives a group of 3 exactly 1.5 times the width of a group of 2", () => {
    const spans = groupSpans(cycle([2, 3]))
    expect(spans[0].widthFraction).toBeCloseTo(2 / 5, 12)
    expect(spans[1].widthFraction).toBeCloseTo(3 / 5, 12)
    expect(spans[1].widthFraction / spans[0].widthFraction).toBeCloseTo(1.5, 12)
  })

  it("never lays groups out as equal-width slots", () => {
    // Three groups of different lengths must have three different widths. If any
    // layer were slotting them equally this would catch it.
    const spans = groupSpans(cycle([2, 3, 4]))
    const widths = spans.map((s) => s.widthFraction)
    expect(new Set(widths).size).toBe(3)
    expect(widths[0]).toBeCloseTo(2 / 9, 12)
    expect(widths[1]).toBeCloseTo(3 / 9, 12)
    expect(widths[2]).toBeCloseTo(4 / 9, 12)
  })

  it("lays spans end to end covering exactly [0, 1)", () => {
    const spans = groupSpans(cycle([2, 2, 3, 2, 2]))
    expect(spans[0].startFraction).toBe(0)
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i].startFraction).toBeCloseTo(spans[i - 1].endFraction, 12)
    }
    expect(spans[spans.length - 1].endFraction).toBeCloseTo(1, 12)
  })

  it("handles arbitrary large groups like [5, 7, 2]", () => {
    const spans = groupSpans(cycle([5, 7, 2]))
    expect(spans.map((s) => s.length)).toEqual([5, 7, 2])
    expect(spans[1].widthFraction).toBeCloseTo(7 / 14, 12)
  })

  it("returns nothing for an empty cycle", () => {
    expect(groupSpans(cycle([]))).toEqual([])
  })
})

describe("pulseMarks", () => {
  it("emits one mark per pulse with correct group membership", () => {
    const marks = pulseMarks(cycle([2, 3]))
    expect(marks).toHaveLength(5)
    expect(marks.map((m) => m.groupIndex)).toEqual([0, 0, 1, 1, 1])
    expect(marks.map((m) => m.indexInGroup)).toEqual([0, 1, 0, 1, 2])
  })

  it("marks group heads and the single cycle start", () => {
    const marks = pulseMarks(cycle([2, 3]))
    expect(marks.filter((m) => m.isGroupHead).map((m) => m.index)).toEqual([0, 2])
    expect(marks.filter((m) => m.isCycleStart).map((m) => m.index)).toEqual([0])
  })

  it("places dot centers half a pulse after each bar hairline (same numbers, one offset)", () => {
    const marks = pulseMarks(cycle([2, 3]))
    marks.forEach((m) => {
      expect(m.centerPulse).toBeCloseTo(m.startPulse + 0.5, 12)
      expect(m.centerFraction).toBeCloseTo((m.index + 0.5) / 5, 12)
    })
  })

  it("keeps a dot on the same hairline the bar mode uses", () => {
    // The dot's start (its cluster origin) is exactly the bar hairline fraction.
    // This is the guarantee that dots and bars line up across mode switches.
    const c = cycle([2, 2, 3, 2, 2])
    const marks = pulseMarks(c)
    marks.forEach((m) => {
      expect(m.startFraction).toBeCloseTo(m.index / 11, 12)
    })
  })

  it("returns nothing for an empty cycle", () => {
    expect(pulseMarks(cycle([]))).toEqual([])
  })
})

describe("wrapPulses", () => {
  it("folds positions back onto one cycle, including negatives", () => {
    const c = cycle([2, 2, 3]) // total 7
    expect(wrapPulses(0, c)).toBe(0)
    expect(wrapPulses(3.5, c)).toBeCloseTo(3.5, 12)
    expect(wrapPulses(7, c)).toBe(0)
    expect(wrapPulses(9, c)).toBe(2)
    expect(wrapPulses(-1, c)).toBe(6)
  })

  it("returns 0 for an empty cycle rather than dividing by zero", () => {
    expect(wrapPulses(3, cycle([]))).toBe(0)
  })
})

describe("activeAt", () => {
  it("locates the active pulse and group for a continuous position", () => {
    const c = cycle([2, 2, 3]) // pulses: g0[0,1] g1[2,3] g2[4,5,6]
    const a = activeAt(2.4, c)
    expect(a).not.toBeNull()
    expect(a!.pulseIndex).toBe(2)
    expect(a!.groupIndex).toBe(1)
    expect(a!.indexInGroup).toBe(0)
    expect(a!.isGroupHead).toBe(true)
    expect(a!.isCycleStart).toBe(false)
    expect(a!.phaseFraction).toBeCloseTo(2.4 / 7, 12)
  })

  it("wraps multi-cycle positions", () => {
    const c = cycle([2, 2, 3]) // total 7
    const a = activeAt(7 + 4.2, c)
    expect(a!.pulseIndex).toBe(4)
    expect(a!.groupIndex).toBe(2)
    expect(a!.indexInGroup).toBe(0)
  })

  it("flags the downbeat at the cycle start", () => {
    const a = activeAt(0, cycle([3, 2, 2]))
    expect(a!.pulseIndex).toBe(0)
    expect(a!.groupIndex).toBe(0)
    expect(a!.isCycleStart).toBe(true)
    expect(a!.isGroupHead).toBe(true)
  })

  it("clamps the exact-end edge back to the last pulse", () => {
    const c = cycle([2, 3]) // total 5
    // A position that lands exactly on the cycle length wraps to phase 0.
    const a = activeAt(5, c)
    expect(a!.pulseIndex).toBe(0)
    // A position a hair under the length stays on the last pulse.
    const b = activeAt(4.999999, c)
    expect(b!.pulseIndex).toBe(4)
    expect(b!.groupIndex).toBe(1)
  })

  it("returns null for an unplayable empty cycle", () => {
    expect(activeAt(0, cycle([]))).toBeNull()
  })
})
