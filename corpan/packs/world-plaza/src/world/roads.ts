import type { Scene as BabylonScene } from "@babylonjs/core/scene"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
// Side-effect imports register the builders we call (tree-shaken core only
// registers a Create* method when its builder module is loaded).
import "@babylonjs/core/Meshes/Builders/groundBuilder"
import "@babylonjs/core/Meshes/Builders/torusBuilder"
import type { Mesh } from "@babylonjs/core/Meshes/mesh"
import { Vector3 } from "@babylonjs/core/Maths/math"
import type { RoomTopology } from "@world-plaza/contracts"
import type { MaterialLibrary, GroundRegion } from "../render/materials"
import { bakeGround } from "../render/materials"

/**
 * buildRoads — the GROUND for a topology.
 *
 * Z-FIGHTING: GONE BY CONSTRUCTION (the real fix, not an offset)
 * --------------------------------------------------------------
 * The flicker was depth-buffer z-fighting between FOUR near-coplanar ground
 * planes — base dirt, cobble street strips, door aprons, and the plaza disc, all
 * sitting at y≈0. Earlier attempts stacked tiny Y offsets (0.0/0.03/0.045/0.06)
 * plus escalating polygon `zOffset` (-2…-6). That is a band-aid: a 0.03-unit Y
 * gap projects to SUB-PIXEL depth at grazing angles, so the depth buffer still
 * tosses a coin, and polygon offset is resolution/angle dependent — it cannot be
 * made robust across all camera angles. That is exactly why it kept coming back.
 *
 * The correct, permanent fix is to have exactly ONE ground mesh. We paint the
 * whole road network INTO a single composited ground texture (`bakeGround`):
 * dirt everywhere, cobble where the streets/aprons go, flagstone in the plaza
 * disc — all baked into ONE albedo + ONE normal map on ONE `CreateGround` mesh.
 * With one floor polygon at one depth there is physically nothing to z-fight, at
 * ANY angle, forever. No Y tiers. No zOffset. The streets are literally part of
 * the ground surface, derived from the SAME street recipe the map generator uses.
 *
 * SHIMMER: handled on the texture side — the baked ground texture has mipmaps ON
 * + anisotropicFilteringLevel 16 + trilinear sampling, so cobble at a grazing
 * distance resolves instead of sparkling.
 *
 * The only mesh that stands apart is the plaza's stone RING — a real torus (a
 * tube standing proud of the ground, genuinely 3D, never coplanar), so it cannot
 * fight the ground and is fine to keep as its own mesh.
 */

export interface Roads {
  dispose: () => void
}

/* ---- shared layout recipe (kept in sync with scripts/genMap.mjs AND
 *      src/world/composition.ts — all three MUST agree on the grid so the baked
 *      cobble strips, the generated streets, and the avenue dressing line up). */

const STREET_W = 5
const ROAD_MARGIN = 4
const MIN_BLOCK = 16
const PITCH = MIN_BLOCK + STREET_W // 21

/** plazaR mirrors genMap: clamp(size*0.1, 8, 14). */
function plazaRadiusFor(size: number): number {
  return Math.max(8, Math.min(14, size * 0.1))
}

function deriveAxisLines(bounds: RoomTopology["bounds"]): number[] {
  const size = Math.min(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ)
  const half = size / 2
  const usable = half - ROAD_MARGIN
  const plazaR = plazaRadiusFor(size)
  const ring0 = plazaR + STREET_W / 2 + MIN_BLOCK / 2
  const pos = new Set<number>([0])
  for (let r = 0; r < 8; r++) {
    const p = Math.round((ring0 + r * PITCH) * 100) / 100
    if (p > usable + 0.01) break
    pos.add(p)
    pos.add(-p)
  }
  return [...pos].sort((a, b) => a - b)
}

/** one cobble "cell" ≈ this many world units (controls stone size on streets). */
const COBBLE_WORLD = 2.4
const FLAG_WORLD = 4.0
const DIRT_WORLD = 6.0

/* ---- public API ---- */

export function buildRoads(
  scene: BabylonScene,
  topology: RoomTopology,
  _lib: MaterialLibrary,
  palette?: Record<string, string>,
): Roads {
  const meshes: Mesh[] = []
  const disposers: Array<() => void> = []

  const { minX, maxX, minZ, maxZ } = topology.bounds
  const w = maxX - minX
  const d = maxZ - minZ
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2

  // The single ground plane is square and slightly oversized so the town never
  // shows a hard edge. The bake covers exactly this square.
  const baseW = w + 8
  const baseD = d + 8
  const groundSpan = Math.max(baseW, baseD)
  const gMinX = cx - groundSpan / 2
  const gMaxX = cx + groundSpan / 2
  const gMinZ = cz - groundSpan / 2
  const gMaxZ = cz + groundSpan / 2

  // ---- compose the ground regions (dirt base + streets + aprons + plaza) ----
  const regions: GroundRegion[] = []

  // cobble street strips along every axis line.
  const axis = deriveAxisLines(topology.bounds)
  const span = Math.min(w, d) - ROAD_MARGIN * 2 + STREET_W
  for (const a of axis) {
    regions.push({ kind: "rect", surface: "cobble", cx: a, cz, w: STREET_W, d: span, metersPerTile: COBBLE_WORLD })
    regions.push({ kind: "rect", surface: "cobble", cx, cz: a, w: span, d: STREET_W, metersPerTile: COBBLE_WORLD })
  }

  // short cobble aprons under each door (portal).
  for (const anchor of topology.anchors) {
    if (anchor.role !== "portal") continue
    regions.push({
      kind: "rect",
      surface: "cobble",
      cx: anchor.x,
      cz: anchor.z,
      w: 3,
      d: 3,
      metersPerTile: COBBLE_WORLD,
    })
  }

  // grand plaza floor — flagstone disc at the centre (painted OVER the streets
  // that cross it, so the plaza reads as one continuous flagstone field).
  const size = Math.min(w, d)
  const plazaR = plazaRadiusFor(size)
  regions.push({ kind: "disc", surface: "flagstone", cx, cz, r: plazaR, metersPerTile: FLAG_WORLD })

  // bake the ONE ground texture + material.
  const ground = bakeGround(scene, palette, {
    bounds: { minX: gMinX, maxX: gMaxX, minZ: gMinZ, maxZ: gMaxZ },
    base: { surface: "dirt", metersPerTile: DIRT_WORLD },
    regions,
  })
  disposers.push(ground.dispose)

  // the SINGLE ground mesh — square, covering the whole baked texture 1:1.
  const floor = MeshBuilder.CreateGround(
    "wp-ground",
    { width: groundSpan, height: groundSpan },
    scene,
  )
  floor.position = new Vector3(cx, 0, cz)
  floor.isPickable = false
  floor.material = ground.material
  floor.freezeWorldMatrix()
  meshes.push(floor)

  // ---- the one genuinely-3D ground feature: the plaza stone ring (a torus, a
  //      tube standing PROUD of the ground — never coplanar, cannot z-fight). ----
  const stoneMat = _lib.get("stone")
  const ring = MeshBuilder.CreateTorus(
    "wp-plaza-ring",
    { diameter: plazaR * 2, thickness: 0.4, tessellation: 56 },
    scene,
  )
  ring.position = new Vector3(cx, 0.09, cz)
  ring.isPickable = false
  ring.material = stoneMat
  ring.freezeWorldMatrix()
  meshes.push(ring)

  return {
    dispose: () => {
      for (const m of meshes) m.dispose(false, false)
      for (const dz of disposers) dz()
      // shared library materials (e.g. stone) are owned by the MaterialLibrary.
    },
  }
}
