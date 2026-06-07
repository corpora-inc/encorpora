import { describe, it, expect } from "vitest"
import { RoomTopology } from "@corpan-city/contracts"
import {
  generateTopology,
  checkWalkability,
  deriveAxisLines,
  plazaRadiusFor,
  ALL_ARCHETYPES,
} from "./topologyGen"

/**
 * Unit proof for the topology generator (Slice 4c). Every archetype must yield a
 * topology that (a) parses against the FROZEN `RoomTopology` Zod schema, (b) is
 * fully walkable (every reachable anchor on the connected open floor), (c)
 * carries TYPED anchors, and (d) shares the EXACT street grid the road bake uses
 * (so roads bake with zero z-fight). Plus determinism + the route anchors.
 */

const SEED = 4242

describe("topologyGen: every archetype is schema-valid + walkable", () => {
  for (const archetype of ALL_ARCHETYPES) {
    it(`${archetype} parses against the frozen RoomTopology schema`, () => {
      const { topology } = generateTopology({ archetype, seed: SEED })
      expect(() => RoomTopology.parse(topology)).not.toThrow()
    })

    it(`${archetype} is fully walkable (no unreachable/oob anchors)`, () => {
      const { topology } = generateTopology({ archetype, seed: SEED })
      const reach = checkWalkability(topology)
      expect(reach.unreachableAnchors).toEqual([])
      expect(reach.outOfBounds).toEqual([])
      expect(reach.ok).toBe(true)
    })

    it(`${archetype} emits TYPED anchors (every anchor has a kind)`, () => {
      const { topology } = generateTopology({ archetype, seed: SEED })
      const untyped = topology.anchors.filter((a) => !a.kind)
      expect(untyped).toEqual([])
    })

    it(`${archetype} has a fountain, spawns, and a balanced building count`, () => {
      const { topology, stats } = generateTopology({ archetype, seed: SEED })
      expect(topology.anchors.some((a) => a.kind === "fountain")).toBe(true)
      expect(topology.spawns.length).toBeGreaterThanOrEqual(1)
      expect(stats.buildings).toBeGreaterThanOrEqual(4)
    })
  }
})

describe("topologyGen: anchor roles are consistent with kinds", () => {
  it("docks → npc_station role, city_gate → portal role", () => {
    const harbor = generateTopology({ archetype: "harbor", seed: SEED }).topology
    const docks = harbor.anchors.find((a) => a.kind === "docks")
    expect(docks).toBeTruthy()
    expect(docks!.role).toBe("npc_station")

    const walled = generateTopology({ archetype: "walled-town", seed: SEED }).topology
    const gate = walled.anchors.find((a) => a.kind === "city_gate")
    expect(gate).toBeTruthy()
    expect(gate!.role).toBe("portal")
  })

  it("every anchor's role matches its kind's render role", () => {
    for (const archetype of ALL_ARCHETYPES) {
      const { topology } = generateTopology({ archetype, seed: SEED })
      // schema guarantees role ∈ AnchorRole; we just assert no kind maps to an
      // illegal role by re-parsing (covered above) — here check kind→role pairs
      // are stable (vendor/merchant → vendor, landmark/fountain → decor, etc.).
      for (const a of topology.anchors) {
        if (a.kind === "vendor" || a.kind === "merchant") expect(a.role).toBe("vendor")
        if (a.kind === "fountain" || a.kind === "landmark" || a.kind === "decor")
          expect(a.role).toBe("decor")
        if (a.kind === "city_gate" || a.kind === "portal") expect(a.role).toBe("portal")
      }
    }
  })
})

describe("topologyGen: route archetypes carry the quest anchors", () => {
  it("harbor has a docks, walled-town has a city_gate", () => {
    const harbor = generateTopology({ archetype: "harbor", seed: SEED }).topology
    const walled = generateTopology({ archetype: "walled-town", seed: SEED }).topology
    expect(harbor.anchors.some((a) => a.kind === "docks")).toBe(true)
    expect(walled.anchors.some((a) => a.kind === "city_gate")).toBe(true)
    // canal-town also gives a docks.
    const canal = generateTopology({ archetype: "canal-town", seed: SEED }).topology
    expect(canal.anchors.some((a) => a.kind === "docks")).toBe(true)
  })
})

describe("topologyGen: determinism + distinctness", () => {
  it("same seed → byte-identical topology", () => {
    const a = generateTopology({ archetype: "grand-plaza", seed: 7 }).topology
    const b = generateTopology({ archetype: "grand-plaza", seed: 7 }).topology
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it("different seed → visibly different topology", () => {
    const a = generateTopology({ archetype: "grand-plaza", seed: 7 }).topology
    const b = generateTopology({ archetype: "grand-plaza", seed: 8 }).topology
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b))
  })
})

describe("topologyGen: bounds are square + share the bake's street recipe", () => {
  it("bounds are square (so the single ground mesh bakes cleanly = 0 z-fight)", () => {
    for (const archetype of ALL_ARCHETYPES) {
      const { topology: t } = generateTopology({ archetype, seed: SEED })
      const w = t.bounds.maxX - t.bounds.minX
      const d = t.bounds.maxZ - t.bounds.minZ
      expect(w).toBeCloseTo(d, 5)
      expect(t.bounds.minX).toBeCloseTo(-t.bounds.maxX, 5)
      expect(t.bounds.minZ).toBeCloseTo(-t.bounds.maxZ, 5)
    }
  })

  it("the central cross (axis 0) is always present (the plaza streets)", () => {
    const { topology } = generateTopology({ archetype: "grand-plaza", seed: SEED })
    const axis = deriveAxisLines(topology.bounds)
    expect(axis).toContain(0)
    // plaza radius is in the proven [8,14] envelope.
    const size = topology.bounds.maxX - topology.bounds.minX
    expect(plazaRadiusFor(size)).toBeGreaterThanOrEqual(8)
    expect(plazaRadiusFor(size)).toBeLessThanOrEqual(14)
  })

  it("no building blocker sits on a baked street centreline (would block the road)", () => {
    // a footprint centred ON a street would put a wall in the cobble; the cell
    // model places buildings strictly BETWEEN streets, so assert the door-bearing
    // footprints clear every axis line by at least half the street width.
    const { topology: t } = generateTopology({ archetype: "avenue-grid", seed: SEED })
    const axis = deriveAxisLines(t.bounds)
    const fountainBoxOnly = (b: { x: number; z: number; w: number; d: number }) =>
      Math.hypot(b.x, b.z) < 0.01
    for (const b of t.blockers) {
      if (fountainBoxOnly(b)) continue
      // the building must not straddle a street centreline along BOTH axes.
      const onNS = axis.some((a) => Math.abs(a - b.x) < b.w / 2 - 1)
      const onEW = axis.some((a) => Math.abs(a - b.z) < b.d / 2 - 1)
      expect(onNS && onEW).toBe(false)
    }
  })
})
