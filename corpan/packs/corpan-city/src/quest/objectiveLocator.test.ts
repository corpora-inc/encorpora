import { describe, it, expect } from "vitest"
import { locateObjective, type LiveFocusable } from "./objectiveLocator"

/** A live focusable at a fixed point (the live position the beacon tracks). */
const fx = (anchorId: string, x: number, z: number): LiveFocusable => ({
  anchorId,
  billboard: { root: { position: { x, z } } },
})

describe("objectiveLocator — where the objective NPC actually stands", () => {
  it("returns null when there is no active objective anchor", () => {
    expect(locateObjective(null, [], () => null)).toBeNull()
    expect(locateObjective(undefined, [fx("plaza", 0, 12)], () => ({ x: 0, z: 0 }))).toBeNull()
  })

  it("prefers the stationed NPC's LIVE position over the static anchor", () => {
    const focusables = [fx("crowd:1", 5, 5), fx("plaza", 0.8, 12.4), fx("market", 30, -10)]
    // anchor point fallback would say (0,12); the NPC hovers at (0.8,12.4) → use that.
    const p = locateObjective("plaza", focusables, () => ({ x: 0, z: 12 }))
    expect(p).toEqual({ x: 0.8, z: 12.4 })
  })

  it("falls back to the static anchor point when no NPC is stationed there", () => {
    const focusables = [fx("crowd:1", 5, 5)]
    const p = locateObjective("fountain", focusables, (id) =>
      id === "fountain" ? { x: 0, z: 0 } : null,
    )
    expect(p).toEqual({ x: 0, z: 0 })
  })

  it("returns null when neither an NPC nor a known anchor resolves", () => {
    expect(locateObjective("nowhere", [fx("plaza", 0, 12)], () => null)).toBeNull()
  })
})
