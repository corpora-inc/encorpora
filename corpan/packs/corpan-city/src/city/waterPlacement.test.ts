import { describe, it, expect } from "vitest"
import { generateCity } from "./generateCity"
import { stubCity } from "./stubCity"
import { chunkObstacles } from "./collision"
import { createObstacleField } from "../world/collision"
import type { CityLayout } from "./layout"

/**
 * waterPlacement.test.ts — #30: NOBODY and NOTHING on the open water.
 *
 * The crowd, the ambient population, and the streamed props all share ONE truth:
 * the collision `ObstacleField`. Spawners reject any sample where `field.blocked`
 * is true. So "keep people/props off the river" reduces to "the river must be
 * `blocked` in the field". These tests prove exactly that, from the pure data:
 *   • every chunk that paints water also carries a water collision rect;
 *   • building the field from ALL chunks, a dense grid of probe points OVER the
 *     water reads `blocked` (placement would reject them) — except the bridge gap;
 *   • the riverwalk promenade band [bankZ, waterZ) stays WALKABLE (a real quay);
 *   • no generated prop sits on the water side of the bank (defense-in-depth).
 */

/** the field a spawner consults: every chunk's obstacles, like the NEAR set but
 *  unioned across the whole city so we can probe anywhere. */
function fullField(layout: CityLayout) {
  const obstacles = layout.chunks.flatMap((c) => chunkObstacles(c))
  return createObstacleField(obstacles, { cell: 8 })
}

/** the agent radius spawners test with (population/crowd AGENT_R ≈ 0.45). */
const AGENT_R = 0.45

describe.each([
  ["generated city", generateCity()],
  ["stub city", stubCity()],
])("water placement — %s", (_name, layout) => {
  const { waterZ, bankZ, bridgeX } = layout.water
  // both producers under test populate the river-band fields (optional in the
  // contract during the transition, but always present here).
  const farBankZ = layout.water.farBankZ!

  it("every water-painted chunk carries a water collision rect", () => {
    for (const ch of layout.chunks) {
      const paintsWater = ch.ground.some((g) => g.surface === "water")
      if (paintsWater) {
        expect(ch.water.length).toBeGreaterThan(0)
      }
    }
  })

  it("the open river reads BLOCKED across its whole span (placement rejects it)", () => {
    const field = fullField(layout)
    let probes = 0
    let blocked = 0
    // probe a dense grid INSIDE each authored water rect (the placement truth),
    // skipping the bridge corridor — every such point must read blocked.
    for (const ch of layout.chunks) {
      for (const w of ch.water) {
        const x0 = Math.min(w.x0, w.x1)
        const x1 = Math.max(w.x0, w.x1)
        const z0 = Math.min(w.z0, w.z1)
        const z1 = Math.max(w.z0, w.z1)
        for (let x = x0 + 3; x <= x1 - 3; x += 6) {
          if (Math.abs(x - bridgeX) < 14) continue // skip the crossing corridor
          for (let z = z0 + 2; z <= z1 - 2; z += 6) {
            probes++
            if (field.blocked(x, z, AGENT_R)) blocked++
          }
        }
      }
    }
    expect(probes).toBeGreaterThan(0)
    // EVERY off-bridge water probe must be blocked — nobody spawns on the river.
    expect(blocked).toBe(probes)
  })

  it("leaves the bridge corridor WALKABLE (you can cross)", () => {
    const field = fullField(layout)
    // a column of points straight up the bridge centre, across the water band.
    let open = 0
    for (let z = waterZ + 2; z <= maxZ(layout) - 2; z += 4) {
      if (!field.blocked(bridgeX, z, AGENT_R)) open++
    }
    expect(open).toBeGreaterThan(0)
  })

  it("keeps the riverwalk promenade band [bankZ, waterZ) walkable", () => {
    const field = fullField(layout)
    const { minX, maxX } = layout.bounds
    let probes = 0
    let walkable = 0
    // mid-band so we don't graze a quayside prop or the very water edge.
    const z = (bankZ + waterZ) / 2
    for (let x = minX + 8; x <= maxX - 8; x += 8) {
      probes++
      if (!field.blocked(x, z, AGENT_R)) walkable++
    }
    expect(probes).toBeGreaterThan(0)
    // the promenade is open ground — most of it must be walkable (a few props ok).
    expect(walkable / probes).toBeGreaterThan(0.7)
  })

  it("seeds NO prop IN THE RIVER BAND (near bank → far bank)", () => {
    // props are allowed on BOTH banks ([bankZ-ε] near quay, [farBankZ+] far quay);
    // only the open river [bankZ, farBankZ) must be clear.
    const inRiver = layout.chunks
      .flatMap((c) => c.props)
      .filter((p) => p.z > bankZ && p.z < farBankZ)
    expect(inRiver).toEqual([])
  })

  it("docks anchor + cargo sit on land, not the river", () => {
    const harbor = layout.anchors.find((a) => a.id === "harbor")
    if (harbor) expect(harbor.z).toBeLessThanOrEqual(waterZ)
  })

  it("the bridge ARRIVES at walkable far-bank land (not the edge)", () => {
    const field = fullField(layout)
    // a point just past the far water edge, on the bridge axis, must be walkable.
    const arrive = farBankZ + 2
    expect(field.blocked(bridgeX, arrive, AGENT_R)).toBe(false)
    // and a bridge_s anchor marks that far approach.
    const bs = layout.anchors.find((a) => a.id === "bridge_s")
    expect(bs).toBeTruthy()
    expect(bs!.z).toBeGreaterThanOrEqual(farBankZ)
  })

  it("water.deck spans bank→far-bank and BOTH ends land on walkable ground", () => {
    const deck = layout.water.deck
    expect(deck).toBeTruthy()
    // x/halfW agree with the collider corridor.
    expect(deck!.x).toBe(bridgeX)
    expect(deck!.halfW).toBe(layout.water.bridgeHalfW)
    // near end on the near quay, far end where the far bank's land starts — never
    // at the open-water edge (a ramp there would land in the river, world-fix's
    // correction). So z0 ≤ waterZ (near land) and z1 ≥ farBankZ (far land).
    expect(deck!.z0).toBeLessThanOrEqual(waterZ)
    expect(deck!.z1).toBeGreaterThanOrEqual(farBankZ)
    // and both deck endpoints are walkable in the field (solid promenade).
    const field = fullField(layout)
    expect(field.blocked(deck!.x, deck!.z0, AGENT_R)).toBe(false)
    expect(field.blocked(deck!.x, deck!.z1, AGENT_R)).toBe(false)
  })
})

describe("world boundary (#34 Phase 1) — generated city: sea-ringed island", () => {
  const layout = generateCity()

  it("any authored wall segment, where present, reads BLOCKED off the gate", () => {
    // Phase 1 has NO land ramparts (sea is the boundary), so walls may be empty.
    // This guards the wall path FOR IF a future producer re-adds land borders:
    // every off-gate rampart point must block. (Vacuously true when no walls.)
    const field = fullField(layout)
    let probes = 0
    let blocked = 0
    for (const ch of layout.chunks) {
      for (const w of ch.walls ?? []) {
        const longX = w.side === "north" || w.side === "south"
        const cx = (Math.min(w.x0, w.x1) + Math.max(w.x0, w.x1)) / 2
        const cz = (Math.min(w.z0, w.z1) + Math.max(w.z0, w.z1)) / 2
        const lo = longX ? Math.min(w.x0, w.x1) : Math.min(w.z0, w.z1)
        const hi = longX ? Math.max(w.x0, w.x1) : Math.max(w.z0, w.z1)
        for (let a = lo + 1; a <= hi - 1; a += 4) {
          if (w.gateGap && a > w.gateGap[0] - 1 && a < w.gateGap[1] + 1) continue
          probes++
          if (field.blocked(longX ? a : cx, longX ? cz : a, AGENT_R)) blocked++
        }
      }
    }
    expect(blocked).toBe(probes) // all-or-(vacuously)-none
  })

  it("the ISLAND is ringed by SEA — the S/E/W perimeter reads BLOCKED, not a raw edge", () => {
    const field = fullField(layout)
    // probe a ring WELL into the sea margin (≥ half a chunk inside each world edge)
    // on the three SEA edges — every one must block (you can't walk off the island).
    // The NORTH edge is the river waterfront + far bank (walkable by design — the
    // bridge crosses there), so it's covered by the water/deck tests, not here.
    const { minX, maxX, minZ } = layout.bounds
    const inset = layout.chunkSize * 0.5
    const chunkAt = (x: number, z: number) =>
      layout.chunks.find(
        (c) => x >= c.bounds.minX && x < c.bounds.maxX && z >= c.bounds.minZ && z < c.bounds.maxZ,
      )
    let probes = 0
    let blocked = 0
    // a deep-margin point is asserted ONLY if its chunk is sea-tagged (skip the
    // river-end straddle near +Z where the far bank reaches the W/E edge).
    const probe = (x: number, z: number) => {
      if (chunkAt(x, z)?.landKind !== "sea") return
      probes++
      if (field.blocked(x, z, AGENT_R)) blocked++
    }
    for (let x = minX + inset; x <= maxX - inset; x += layout.chunkSize) {
      probe(x, minZ + inset) // south edge (open sea)
    }
    // W/E edges: stop short of the river/far-bank band at +Z (that's the walkable
    // waterfront, not the sea boundary — covered by the water/deck tests).
    for (let z = minZ + inset; z < layout.water.waterZ - layout.chunkSize; z += layout.chunkSize) {
      probe(minX + inset, z) // west edge (open sea)
      probe(maxX - inset, z) // east edge (open sea)
    }
    expect(probes).toBeGreaterThan(0)
    expect(blocked).toBe(probes) // every sea-tagged perimeter point is solid
  })

  it("the S/E/W world edges are SEA (no walkable raw edge); corners too", () => {
    // the mid-edge chunks just inside the S/E/W world boundaries must be `sea`.
    // (North is the river waterfront/far bank, walkable — covered by water tests.)
    const { minX, maxX, minZ } = layout.bounds
    const at = (x: number, z: number) =>
      layout.chunks.find(
        (c) => x >= c.bounds.minX && x < c.bounds.maxX && z >= c.bounds.minZ && z < c.bounds.maxZ,
      )
    const m = (maxX + minX) / 2
    const edges = [
      at(m, minZ + 1), // south
      at(minX + 1, 0), // west
      at(maxX - 1, 0), // east
      at(minX + 1, minZ + 1), // SW corner
      at(maxX - 1, minZ + 1), // SE corner
    ]
    for (const e of edges) {
      expect(e).toBeTruthy()
      expect(e!.landKind).toBe("sea")
    }
  })
})

/** north edge of the city (the far water edge). */
function maxZ(layout: CityLayout): number {
  return layout.bounds.maxZ
}
