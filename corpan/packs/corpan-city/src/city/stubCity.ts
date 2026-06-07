import type { CityLayout, CityChunk, CityZoneId, CitySurface } from "./layout"
import { chunkKey } from "./layout"

/**
 * city/stubCity.ts — a tiny FIXED CityLayout for downstream agents/tests.
 *
 * This is the documented STUB for the city seam (mirrors the contracts-first
 * stub discipline in the playbook §1.2). It is small + deterministic so a
 * consumer can render, walk, derive collision, and target landmark anchors
 * WITHOUT running the full `generateCity`. It is a single 2×2 chunk grid (a 120u
 * square) with a plaza, a couple of buildings, a few props, and the canonical
 * landmark anchor ids present (so anchor-binding code can be exercised).
 *
 * It is NOT meant to look like the real city — it is the minimal shape that
 * satisfies the CityLayout contract for tests/early integration.
 */

const SIZE = 120
const CHUNK = 60
const HALF = SIZE / 2

const BASE_SURFACE_BY_ZONE: Record<CityZoneId, CitySurface> = {
  plaza: "flagstone",
  downtown: "dirt",
  residential: "dirt",
  market: "dirt",
  harbor: "stone",
  park: "grass",
  station: "stone",
  civic: "dirt",
  industrial: "stone",
  uptown: "dirt",
  financial: "flagstone",
  airport: "stone",
  cliff: "stone",
}

export function stubCity(): CityLayout {
  // 2×2 chunks. chunk (gx,gz) bounds: [minX..minX+CHUNK] × [minZ..minZ+CHUNK].
  const mk = (gx: number, gz: number, zone: CityZoneId, fill: Partial<CityChunk>): CityChunk => {
    const minX = -HALF + gx * CHUNK
    const minZ = -HALF + gz * CHUNK
    return {
      gx,
      gz,
      key: chunkKey(gx, gz),
      bounds: { minX, maxX: minX + CHUNK, minZ, maxZ: minZ + CHUNK },
      zone,
      buildings: fill.buildings ?? [],
      props: fill.props ?? [],
      ground: fill.ground ?? [],
      anchors: fill.anchors ?? [],
      water: fill.water ?? [],
      walls: fill.walls ?? [],
    }
  }

  const chunks: CityChunk[] = [
    // SW chunk: the plaza heart (spawn + fountain) + a flagstone disc.
    mk(0, 0, "plaza", {
      ground: [{ kind: "disc", surface: "flagstone", cx: 0, cz: 0, r: 18, metersPerTile: 4 }],
      props: [
        { species: "lamp", x: -8, z: -8, scale: 1, shadow: 0.5 },
        { species: "bench", x: 8, z: -8, scale: 1, shadow: 0.6 },
      ],
      anchors: [
        { id: "plaza", kind: "spawn", x: 0, z: 6, facing: 0, label: "Grand Plaza" },
        { id: "fountain", kind: "fountain", x: 0, z: 0, facing: 0, label: "Plaza Fountain" },
      ],
    }),
    // SE chunk: a market with one hall + stalls.
    mk(1, 0, "market", {
      buildings: [{ x: 40, z: -20, w: 12, d: 8, kind: "market-hall", door: { x: 40, z: -14 } }],
      props: [
        { species: "stall", x: 35, z: -12, scale: 1, shadow: 0.7 },
        { species: "cart", x: 45, z: -12, scale: 1, shadow: 0.7 },
      ],
      ground: [{ kind: "rect", surface: "cobble", cx: 40, cz: -28, w: 8, d: CHUNK, metersPerTile: 2.4 }],
      anchors: [{ id: "market", kind: "vendor", x: 40, z: -10, facing: 0, label: "Market Square" }],
    }),
    // NW chunk: a park + the hospital (civic) + the station anchor.
    mk(0, 1, "park", {
      buildings: [{ x: -25, z: 30, w: 14, d: 12, kind: "inn", door: { x: -25, z: 36 } }],
      props: [
        { species: "tree", x: -10, z: 25, scale: 1.1, shadow: 0.8 },
        { species: "tree", x: -16, z: 22, scale: 1, shadow: 0.8 },
      ],
      ground: [{ kind: "disc", surface: "grass", cx: -15, cz: 25, r: 24, metersPerTile: 8 }],
      anchors: [
        { id: "hospital", kind: "landmark", x: -25, z: 38, facing: 0, label: "City Hospital" },
        { id: "station", kind: "portal", x: -5, z: 50, facing: 0, label: "Central Station" },
      ],
    }),
    // NE chunk: the harbor + a bridge anchor.
    mk(1, 1, "harbor", {
      buildings: [{ x: 30, z: 24, w: 12, d: 10, kind: "workshop" }],
      props: [
        // cargo lined up on the LAND side of the bank (bankZ=28), never the river.
        { species: "barrel", x: 24, z: 24, scale: 1, shadow: 0.6 },
        { species: "crate", x: 30, z: 26, scale: 1, shadow: 0.6 },
      ],
      ground: [{ kind: "rect", surface: "water", cx: 30, cz: 48, w: CHUNK, d: 8, metersPerTile: 6 }],
      // river BAND z 44..52 (not water-to-edge); bridge corridor at x=5 open. Far
      // bank land 52..56, then a sea wall at z=56 (gate at the bridge mouth).
      water: [{ x0: 0, x1: HALF, z0: 44, z1: 52, bridgeGap: [0, 10] }],
      walls: [{ x0: 0, x1: HALF, z0: 55, z1: 57, side: "north", gateGap: [0, 10] }],
      anchors: [
        // docks + bridge approach sit on the walkable bank (bankZ=28), not the river.
        { id: "harbor", kind: "docks", x: 30, z: 26, facing: Math.PI, label: "Harbor Docks" },
        { id: "bridge_n", kind: "landmark", x: 5, z: 28, facing: 0, label: "North Bridge" },
        { id: "bridge_s", kind: "landmark", x: 5, z: 54, facing: Math.PI, label: "Far Bank" },
      ],
    }),
  ]

  const anchors = chunks.flatMap((c) => c.anchors)

  return {
    id: "corpan-city",
    seed: 1,
    bounds: { minX: -HALF, maxX: HALF, minZ: -HALF, maxZ: HALF },
    chunkSize: CHUNK,
    gridDim: 2,
    chunks,
    anchors,
    spawn: { x: 0, z: 6 },
    water: {
      waterZ: 44, bankZ: 28, farBankZ: 52, farPromZ: 54, bridgeX: 5, bridgeHalfW: 5,
      deck: { z0: 28, z1: 52, x: 5, halfW: 5 }, // bankZ → farBankZ at the bridge corridor
    },
    boundary: {
      inset: 4,
      thickness: 2,
      gates: [
        { side: "south", center: 0, halfWidth: 6 },
        { side: "west", center: 0, halfWidth: 6 },
        { side: "east", center: 0, halfWidth: 6 },
      ],
    },
    baseSurfaceByZone: BASE_SURFACE_BY_ZONE,
  }
}
