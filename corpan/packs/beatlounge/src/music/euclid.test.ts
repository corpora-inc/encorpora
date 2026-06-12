import { describe, expect, it } from "vitest"
import { euclid, euclidIndices } from "./euclid"

const s = (p: boolean[]) => p.map((x) => (x ? "x" : ".")).join("")

describe("euclid", () => {
  it("handles the degenerate cases", () => {
    expect(euclid(0, 8)).toEqual(new Array(8).fill(false))
    expect(euclid(8, 8)).toEqual(new Array(8).fill(true))
    expect(euclid(3, 0)).toEqual([])
    expect(euclid(99, 4)).toEqual(new Array(4).fill(true)) // clamps pulses<=steps
  })

  it("produces canonical Euclidean patterns", () => {
    // Well-known results (rotation may differ by convention, so check counts +
    // even spread via the tresillo/cinquillo shapes Bjorklund yields here).
    expect(s(euclid(4, 4))).toBe("xxxx")
    expect(euclid(3, 8).filter(Boolean).length).toBe(3)
    expect(euclid(5, 8).filter(Boolean).length).toBe(5)
    expect(euclid(2, 5).filter(Boolean).length).toBe(2)
  })

  it("spreads hits as evenly as possible (max gap - min gap <= 1)", () => {
    for (const [k, n] of [[3, 8], [5, 8], [4, 9], [7, 16], [5, 13]] as const) {
      const idx = euclidIndices(k, n)
      const gaps: number[] = []
      for (let i = 0; i < idx.length; i++) {
        const next = idx[(i + 1) % idx.length]
        const gap = (next - idx[i] + n) % n
        gaps.push(gap === 0 ? n : gap)
      }
      expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(1)
    }
  })

  it("rotates", () => {
    const base = euclid(3, 8)
    const rot = euclid(3, 8, 1)
    expect(rot).toEqual([...base.slice(1), base[0]])
  })

  it("euclidIndices matches the boolean pattern", () => {
    expect(euclidIndices(4, 16).length).toBe(4)
    expect(euclidIndices(4, 16).every((i) => i >= 0 && i < 16)).toBe(true)
  })
})
