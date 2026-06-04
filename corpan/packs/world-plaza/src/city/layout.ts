import type { SpeciesId } from "../world/composition"

/**
 * city/layout.ts — the CityLayout DATA MODEL for "Corpan City": a much larger,
 * believable little metropolis (target ~8–16× the current plaza footprint),
 * partitioned into a GRID OF SPATIAL CHUNKS so it can be streamed in/out by
 * camera proximity instead of built all at once.
 *
 * WHY A DATA MODEL (not just meshes)
 * ----------------------------------
 * Everything here is PLAIN, SERIALIZABLE DATA (no Babylon, no DOM). The same way
 * the existing world reads a `RoomTopology` and renders it (buildings.ts +
 * roads.ts + dressing.ts), the city reads a `CityLayout` and the STREAMING
 * MANAGER (stream.ts) renders only the chunks near the camera. Keeping the layout
 * pure means:
 *   • the generator (generateCity) is deterministic + testable with zero GPU;
 *   • collision (collision.ts here) can be derived from the same data the meshes
 *     are built from, so colliders always line up with what you see;
 *   • a chunk can be (de)serialized, cached, or shipped as content later.
 *
 * SPATIAL CHUNKS
 * --------------
 * The world is a square of side `worldSize`, sliced into a `gridDim × gridDim`
 * grid of square chunks of side `chunkSize`. Chunk (gx, gz) owns ONLY the
 * features whose footprint CENTER falls inside it. Each chunk therefore has a
 * tight, known world AABB — the streaming manager activates a chunk when the
 * camera is within `activeRadius` of that AABB and disposes it beyond a (larger)
 * `disposeRadius`, with hysteresis so a chunk on the boundary doesn't thrash.
 *
 * ZONES ARE PURELY VISUAL/SPATIAL VARIETY — NEVER LEARNING DOMAINS.
 * A chunk's `zone` only tells the renderer/generator how to dress that patch of
 * city (a harbor looks different from a park). Gameplay content (quests, NPCs,
 * vocab) is NOT bound to a zone; it can happen anywhere. Landmark ANCHORS are
 * generic + data-driven (`harbor`, `station`, `market`, …) so the quest-content
 * agent targets them by stable id, not by zone.
 */

/* ------------------------------------------------------------------ zones */

/**
 * A ZONE is a visual/spatial flavour for a patch of city. It drives building
 * KIND weighting, height/density, and prop dressing for the chunks tagged with
 * it. It carries NO gameplay/learning meaning — a "market" zone is just where
 * the city looks like a market, not a "shopping vocabulary" lesson.
 */
export type CityZoneId =
  | "plaza" // the civic heart (spawn) — low, open, monumental
  | "downtown" // dense mixed commercial blocks, taller
  | "residential" // calmer houses + gardens, lower + greener
  | "market" // stalls, carts, awnings, low market halls
  | "harbor" // docks/quays at the water edge, warehouses
  | "park" // open green: trees, benches, few/no buildings
  | "station" // the transit hub — a long shed + forecourt
  | "civic" // hospital / institutional blocks (broad, calm)
  | "industrial" // workshops + warehouses near the rail/harbor

/* --------------------------------------------------------------- features */

/** A building footprint within a chunk (local concept — world coords). The same
 * shape the buildings.ts `Blocker` consumes, plus authoring hints. */
export interface CityBuilding {
  x: number
  z: number
  w: number
  d: number
  /** building KIND hint for buildings.ts (house/shop/inn/chapel/workshop/market-hall). */
  kind: string
  /** door/front anchor the building faces (street side). */
  door?: { x: number; z: number }
}

/** A placed prop (tree, lamp, bench, stall…) — mirrors composition.Placement so
 * the streaming dresser can thin-instance it directly. */
export interface CityProp {
  species: SpeciesId
  x: number
  z: number
  scale: number
  yaw?: number
  shadow: number
}

/**
 * A baked GROUND region for a chunk: a rect or disc of a named surface painted
 * INTO the chunk's single ground texture (roads are BAKED, never overlaid — the
 * §2 z-fight rule). Mirrors render/materials.GroundRegion's geometry but is
 * stored as pure data so a chunk can bake its own ground lazily on stream-in.
 */
export type CitySurface = "cobble" | "flagstone" | "dirt" | "stone" | "grass" | "water"

export type CityGroundRegion =
  | { kind: "rect"; surface: CitySurface; cx: number; cz: number; w: number; d: number; metersPerTile: number }
  | { kind: "disc"; surface: CitySurface; cx: number; cz: number; r: number; metersPerTile: number }

/* ----------------------------------------------------------- anchors */

/**
 * A generic, stable landmark/POI anchor. `id` is canonical + targetable by the
 * quest-content agent (`harbor`, `station`, `market`, `hospital`, `plaza`,
 * `bridge_n`…). `kind` is a coarse semantic for map legends; it is NOT a learning
 * domain. `facing` (radians) orients an NPC/marker placed here.
 */
export interface CityAnchor {
  id: string
  kind:
    | "spawn"
    | "landmark"
    | "vendor"
    | "npc_station"
    | "docks"
    | "fountain"
    | "portal"
    | "bench"
    | "decor"
  x: number
  z: number
  facing?: number
  /** human label for the map legend (English; localized downstream). */
  label?: string
}

/* ------------------------------------------------------------------ chunk */

/** Axis-aligned world bounds of a chunk (or the whole city). */
export interface CityBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/**
 * One spatial chunk — the unit the streaming manager instantiates/disposes. It
 * owns every feature whose center lands inside its `bounds`. A chunk is cheap to
 * carry as data; its meshes are built only while it is active.
 */
export interface CityChunk {
  /** grid coordinate (column, row) in the chunk grid. */
  gx: number
  gz: number
  /** stable key `"gx,gz"` used for pooling/lookup. */
  key: string
  /** tight world AABB of this chunk. */
  bounds: CityBounds
  /** dominant visual zone for dressing this chunk. */
  zone: CityZoneId
  buildings: CityBuilding[]
  props: CityProp[]
  /** baked ground regions painted over this chunk's dirt/grass base. */
  ground: CityGroundRegion[]
  /** generic landmark anchors that live in this chunk. */
  anchors: CityAnchor[]
}

/* ------------------------------------------------------------------ city */

/**
 * The whole city: a grid of chunks plus the global facts the renderer/collision/
 * streaming need (bounds, chunk geometry, the spawn, the union of anchors, and
 * the base ground surfaces so a chunk knows what to fill under its features).
 */
export interface CityLayout {
  /** canonical scene/topology id for this world. */
  id: "corpan-city"
  seed: number
  /** full-city world bounds. */
  bounds: CityBounds
  /** side length of one square chunk (world units). */
  chunkSize: number
  /** chunks per axis (gridDim × gridDim total). */
  gridDim: number
  chunks: CityChunk[]
  /** flattened convenience: every anchor across all chunks (generic ids). */
  anchors: CityAnchor[]
  /** the player spawn (the plaza center). */
  spawn: { x: number; z: number }
  /** base ground fill per zone so a chunk bakes the right substrate under roads. */
  baseSurfaceByZone: Record<CityZoneId, CitySurface>
}

/* --------------------------------------------------------------- helpers */

/** chunk lookup key from grid coords. */
export const chunkKey = (gx: number, gz: number): string => `${gx},${gz}`

/** which chunk grid cell a world point falls in (clamped to the grid). */
export function chunkCoordFor(layout: CityLayout, x: number, z: number): { gx: number; gz: number } {
  const gx = clampGrid(Math.floor((x - layout.bounds.minX) / layout.chunkSize), layout.gridDim)
  const gz = clampGrid(Math.floor((z - layout.bounds.minZ) / layout.chunkSize), layout.gridDim)
  return { gx, gz }
}

const clampGrid = (v: number, dim: number): number => (v < 0 ? 0 : v >= dim ? dim - 1 : v)

/** the world-space center of a chunk cell. */
export function chunkCenter(layout: CityLayout, gx: number, gz: number): { x: number; z: number } {
  return {
    x: layout.bounds.minX + (gx + 0.5) * layout.chunkSize,
    z: layout.bounds.minZ + (gz + 0.5) * layout.chunkSize,
  }
}

/**
 * Squared distance from a point to a chunk's AABB (0 inside). Used by the
 * streaming manager to rank chunks by camera proximity without a sqrt per chunk.
 */
export function distSqToBounds(b: CityBounds, x: number, z: number): number {
  const dx = x < b.minX ? b.minX - x : x > b.maxX ? x - b.maxX : 0
  const dz = z < b.minZ ? b.minZ - z : z > b.maxZ ? z - b.maxZ : 0
  return dx * dx + dz * dz
}

/** Find an anchor by its canonical id across the whole city. */
export function findAnchor(layout: CityLayout, id: string): CityAnchor | undefined {
  return layout.anchors.find((a) => a.id === id)
}
