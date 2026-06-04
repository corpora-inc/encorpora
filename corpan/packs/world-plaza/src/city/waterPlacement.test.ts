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
  const { waterZ, bankZ, farBankZ, bridgeX } = layout.water

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
})

describe.each([
  ["generated city", generateCity()],
  ["stub city", stubCity()],
])("world boundary (#32) — %s", (_name, layout) => {
  it("every wall-segment chunk reads BLOCKED along the rampart (off the gate)", () => {
    const field = fullField(layout)
    let probes = 0
    let blocked = 0
    for (const ch of layout.chunks) {
      for (const w of ch.walls) {
        const x0 = Math.min(w.x0, w.x1)
        const x1 = Math.max(w.x0, w.x1)
        const z0 = Math.min(w.z0, w.z1)
        const z1 = Math.max(w.z0, w.z1)
        const cx = (x0 + x1) / 2
        const cz = (z0 + z1) / 2
        const longX = w.side === "north" || w.side === "south"
        const lo = longX ? x0 : z0
        const hi = longX ? x1 : z1
        for (let a = lo + 1; a <= hi - 1; a += 4) {
          // skip the gate interval.
          if (w.gateGap && a > w.gateGap[0] - 1 && a < w.gateGap[1] + 1) continue
          probes++
          const px = longX ? a : cx
          const pz = longX ? cz : a
          if (field.blocked(px, pz, AGENT_R)) blocked++
        }
      }
    }
    expect(probes).toBeGreaterThan(0)
    expect(blocked).toBe(probes)
  })

  it("leaves each GATE walkable (you can pass through)", () => {
    const field = fullField(layout)
    let gates = 0
    let open = 0
    for (const ch of layout.chunks) {
      for (const w of ch.walls) {
        if (!w.gateGap) continue
        gates++
        const longX = w.side === "north" || w.side === "south"
        const mid = (w.gateGap[0] + w.gateGap[1]) / 2
        const cz = (Math.min(w.z0, w.z1) + Math.max(w.z0, w.z1)) / 2
        const cx = (Math.min(w.x0, w.x1) + Math.max(w.x0, w.x1)) / 2
        const px = longX ? mid : cx
        const pz = longX ? cz : mid
        if (!field.blocked(px, pz, AGENT_R)) open++
      }
    }
    if (gates > 0) expect(open).toBe(gates)
  })

})

describe("world boundary (#32) — generated city full perimeter", () => {
  const layout = generateCity()
  it("covers all three land edges (S/E/W) + the sea wall — no raw edge", () => {
    const sides = new Set(layout.chunks.flatMap((c) => c.walls).map((w) => w.side))
    for (const s of ["south", "east", "west", "north"] as const) expect(sides.has(s)).toBe(true)
  })
  it("the sea wall leaves the bridge mouth open", () => {
    const field = fullField(layout)
    const { bridgeX } = layout.water
    // the sea wall is the +Z rampart; its gate is the bridge mouth.
    const seaWall = layout.chunks.flatMap((c) => c.walls).find((w) => w.side === "north" && w.gateGap)
    expect(seaWall).toBeTruthy()
    const cz = (seaWall!.z0 + seaWall!.z1) / 2
    expect(field.blocked(bridgeX, cz, AGENT_R)).toBe(false)
  })
})

/** north edge of the city (the far water edge). */
function maxZ(layout: CityLayout): number {
  return layout.bounds.maxZ
}
