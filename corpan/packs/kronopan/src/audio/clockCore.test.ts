import { describe, it, expect } from "vitest"
import {
  secondsPerPulse,
  positionAt,
  timeForPulse,
  reanchorTempo,
  collectWindow,
  rolesForCycle,
  playsAt,
  planWindow,
  type Anchor,
} from "./clockCore"
import type { Cycle } from "../core"

const cycle = (groups: number[], unit: Cycle["unit"] = 8): Cycle => ({
  id: "t",
  name: "t",
  groups,
  unit,
})

describe("secondsPerPulse", () => {
  it("treats tempo as the pulse rate, independent of the notated unit", () => {
    expect(secondsPerPulse(120)).toBeCloseTo(0.5, 12) // 120 pulses per minute
    expect(secondsPerPulse(60)).toBeCloseTo(1, 12)
    expect(secondsPerPulse(240)).toBeCloseTo(0.25, 12)
  })
})

describe("positionAt / timeForPulse", () => {
  const a: Anchor = { anchorPulse: 0, anchorTime: 10, secondsPerPulse: 0.25 }

  it("advances one pulse per secondsPerPulse", () => {
    expect(positionAt(a, 10)).toBeCloseTo(0, 12)
    expect(positionAt(a, 10.25)).toBeCloseTo(1, 12)
    expect(positionAt(a, 10.5)).toBeCloseTo(2, 12)
    expect(positionAt(a, 10.375)).toBeCloseTo(1.5, 12)
  })

  it("is the exact inverse of timeForPulse", () => {
    for (const p of [0, 1, 2.5, 7, 11.5]) {
      expect(positionAt(a, timeForPulse(a, p))).toBeCloseTo(p, 12)
    }
  })
})

describe("reanchorTempo (phase preserving)", () => {
  it("keeps the current position identical across a tempo change", () => {
    const a: Anchor = { anchorPulse: 0, anchorTime: 0, secondsPerPulse: 0.25 }
    const now = 1.1 // mid-pulse
    const before = positionAt(a, now)
    const b = reanchorTempo(a, now, secondsPerPulse(90))
    expect(positionAt(b, now)).toBeCloseTo(before, 12)
    // but the rate has actually changed going forward
    expect(b.secondsPerPulse).not.toBeCloseTo(a.secondsPerPulse, 6)
    expect(positionAt(b, now + b.secondsPerPulse)).toBeCloseTo(before + 1, 12)
  })
})

describe("collectWindow", () => {
  const a: Anchor = { anchorPulse: 0, anchorTime: 0, secondsPerPulse: 0.25 }

  it("returns only pulses whose time is inside the lookahead window", () => {
    // window [0, 0.1): only pulse 0 at t=0
    const w = collectWindow(a, 0, 0, 0.1)
    expect(w.pulses).toEqual([0])
    expect(w.next).toBe(1)
  })

  it("advances across ticks emitting every pulse exactly once, in order", () => {
    // Mirror the real scheduler: wake every 25ms, look 100ms ahead. Because the
    // lookahead is far larger than the wake interval, every pulse is caught well
    // before `now` reaches it, so none is ever dropped as late.
    const seen: number[] = []
    let next = 0
    for (let now = 0; now <= 1; now += 0.025) {
      const w = collectWindow(a, next, now, 0.1)
      seen.push(...w.pulses)
      next = w.next
    }
    expect(seen[0]).toBe(0)
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBe(seen[i - 1] + 1) // contiguous, no gaps, no repeats
    }
    expect(seen).toContain(3) // reached at least a full second of pulses
  })

  it("skips already-late pulses instead of emitting them", () => {
    // start scheduling from pulse 0 but now is already at t=0.6 (past pulses 0,1,2)
    const w = collectWindow(a, 0, 0.6, 0.1)
    expect(w.pulses).toEqual([]) // pulse 3 is at 0.75, outside [0.6,0.7)
    expect(w.next).toBe(3) // and we resume from 3, not from a stale 0
  })
})

describe("rolesForCycle", () => {
  it("marks the downbeat, group heads, and plain pulses", () => {
    expect(rolesForCycle(cycle([2, 2, 3]))).toEqual([
      "downbeat",
      "pulse",
      "group-head",
      "pulse",
      "group-head",
      "pulse",
      "pulse",
    ])
  })
})

describe("playsAt (density nesting)", () => {
  it("cycle plays only the downbeat", () => {
    expect(playsAt("downbeat", "cycle")).toBe(true)
    expect(playsAt("group-head", "cycle")).toBe(false)
    expect(playsAt("pulse", "cycle")).toBe(false)
  })
  it("group-heads adds the group heads", () => {
    expect(playsAt("downbeat", "group-heads")).toBe(true)
    expect(playsAt("group-head", "group-heads")).toBe(true)
    expect(playsAt("pulse", "group-heads")).toBe(false)
  })
  it("pulse plays every pulse role", () => {
    expect(playsAt("downbeat", "pulse")).toBe(true)
    expect(playsAt("group-head", "pulse")).toBe(true)
    expect(playsAt("pulse", "pulse")).toBe(true)
  })
})

describe("planWindow", () => {
  const a: Anchor = { anchorPulse: 0, anchorTime: 0, secondsPerPulse: 0.25 }
  const c = cycle([2, 2, 3]) // total 7
  const roles = rolesForCycle(c)

  it("at cycle density, only the downbeat sounds across a whole cycle", () => {
    // one whole cycle is 7 pulses * 0.25 = 1.75s; a 1.7s window covers pulses
    // 0..6 and stops just short of the next downbeat at 1.75s
    const { clicks } = planWindow(a, 0, 0, 1.7, roles, 7, "cycle")
    expect(clicks).toHaveLength(1)
    expect(clicks[0].role).toBe("downbeat")
    expect(clicks[0].time).toBeCloseTo(0, 12)
  })

  it("at pulse density, every pulse sounds with its own role", () => {
    const { clicks } = planWindow(a, 0, 0, 1.7, roles, 7, "pulse")
    expect(clicks.map((c) => c.role)).toEqual([
      "downbeat",
      "pulse",
      "group-head",
      "pulse",
      "group-head",
      "pulse",
      "pulse",
    ])
    expect(clicks[2].time).toBeCloseTo(0.5, 12) // pulse index 2 at 2*0.25
  })

  it("at subdivision density, adds a soft tick halfway between pulses", () => {
    // one pulse window: pulse 0 plus its half-pulse tick
    const { clicks } = planWindow(a, 0, 0, 0.2, roles, 7, "subdivision")
    expect(clicks).toHaveLength(2)
    expect(clicks[0].role).toBe("downbeat")
    expect(clicks[0].time).toBeCloseTo(0, 12)
    expect(clicks[1].role).toBe("subdivision")
    expect(clicks[1].time).toBeCloseTo(0.125, 12)
  })

  it("wraps roles across cycle boundaries", () => {
    // schedule the pulse right after one full cycle: absolute pulse 7 is the
    // next downbeat.
    const { clicks } = planWindow(a, 7, timeForPulseHelper(a, 7), 0.1, roles, 7, "pulse")
    expect(clicks[0].role).toBe("downbeat")
  })

  it("plans nothing for an empty cycle without dividing by zero", () => {
    const { clicks, next } = planWindow(a, 0, 0, 1, [], 0, "pulse")
    expect(clicks).toEqual([])
    expect(next).toBe(0)
  })
})

// tiny local helper so the boundary test reads clearly
function timeForPulseHelper(a: Anchor, p: number): number {
  return timeForPulse(a, p)
}
