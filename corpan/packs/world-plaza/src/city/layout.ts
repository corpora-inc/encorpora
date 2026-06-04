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

/* ------------------------------------------------------------------ water */

/**
 * A per-chunk WATER rectangle — the open-water footprint that falls inside one
 * chunk. It is the COLLISION + PLACEMENT truth for "this is the river, not land":
 * collision.ts turns each into a box obstacle (so the crowd/population/props are
 * kept on the LAND side and the player is walled at the shoreline), and the
 * generator paints the matching blue ground over the same rect so what you SEE
 * lines up with what you can't walk into.
 *
 * `bridgeGap`, when present, is the X-interval of the bridge deck CARVED OUT of
 * this water rect — the one corridor you CAN cross. collision.ts splits the water
 * box around it (left box + right box) so the deck stays walkable while the rest
 * of the river blocks. (Pure data; world coords.)
 */
export interface CityWaterRect {
  x0: number
  x1: number
  z0: number
  z1: number
  /** [gx0, gx1] world-X interval of the walkable bridge deck cut through this rect. */
  bridgeGap?: [number, number]
}

/**
 * The city's WATER feature as a whole — the single source of truth the generator,
 * collision, layout, and the bridge structure all read so they never drift.
 *
 * The river is a BAND along +Z, NOT water-to-the-edge (#32 crafted boundary):
 *   land … `bankZ` (near riverwalk) … `waterZ` (near water edge) … RIVER …
 *   `farBankZ` (far quay edge) … far-bank district … sea wall … world edge.
 *
 * So `[bankZ, waterZ)` and `[farBankZ, farPromZ)` are the walkable near/far quays;
 * `[waterZ, farBankZ)` is the open river (non-walkable, blocked in the collider).
 * `bridgeX ± bridgeHalfW` is the single crossing corridor left open in the
 * collider AND the deck the bridge structure (world-fix #29) is built on, so
 * "cross the bridge" arrives at the FAR BANK (more city), never the map edge.
 */
export interface CityWater {
  /** world-Z of the NEAR water edge; [waterZ, farBankZ) is open river. */
  waterZ: number
  /** world-Z where the near-side riverwalk promenade starts (bankZ < waterZ). */
  bankZ: number
  /** world-Z of the FAR water edge; z ≥ this is far-bank land (the river ends). */
  farBankZ: number
  /** world-Z where the far-bank promenade ends and far-bank buildings start
   *  (farBankZ < farPromZ). The band [farBankZ, farPromZ) is the far quay. */
  farPromZ: number
  /** center X of the bridge crossing corridor. */
  bridgeX: number
  /** half-width of the walkable bridge corridor carved through the river collider. */
  bridgeHalfW: number
}

/* ------------------------------------------------------------------ walls */

/**
 * A per-chunk WALL segment — a stretch of the perimeter rampart that falls inside
 * one chunk, modelled as an axis-aligned thin box. It is the COLLISION + PLACEMENT
 * truth for "the world ends in a designed wall here, not fog" (#32): collision.ts
 * turns each into a box obstacle so the player is stopped at the rampart (never
 * walks off into the void) and nothing spawns on/past it, and `world/cityWall.ts`
 * builds the matching rampart mesh from the SAME segments so collider ↔ wall line
 * up. A `gateGap`, when present, is the interval (along the wall's long axis) of a
 * walkable GATE opening carved out of the collider. (Pure data; world coords.)
 */
export interface CityWallRect {
  x0: number
  x1: number
  z0: number
  z1: number
  /** which world edge this segment guards (for mesh facing + dressing). */
  side: "north" | "south" | "east" | "west"
  /** [g0, g1] interval (world coords on the wall's LONG axis) of a walkable gate. */
  gateGap?: [number, number]
}

/**
 * The crafted world BOUNDARY (#32). The +Z edge is the river/sea (handled by
 * `CityWater`); the other three land edges get a perimeter RAMPART with GATES so
 * the player meets an intentional wall, never a raw edge. `inset` is how far the
 * wall sits inside the world bounds (leaving a thin no-man's strip the wall mesh
 * occupies). `gates` are the walkable openings (an avenue passes through each).
 */
export interface CityBoundary {
  /** distance the rampart sits inside `bounds` on each walled edge. */
  inset: number
  /** thickness (world units) of the rampart box. */
  thickness: number
  /** the gate openings, as {side, center} on each walled edge. */
  gates: Array<{ side: "south" | "east" | "west"; center: number; halfWidth: number }>
}

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
  /**
   * Open-water footprints inside this chunk — the non-walkable river. collision.ts
   * turns each into box obstacle(s) (splitting around any `bridgeGap`) so people,
   * props, and the player are kept off the water. Empty for inland chunks.
   */
  water: CityWaterRect[]
  /**
   * Perimeter rampart segments inside this chunk — the crafted world edge (#32).
   * collision.ts turns each into a box obstacle (splitting around any `gateGap`)
   * so the player meets a designed wall, never a raw edge, and nothing spawns
   * past it. `world/cityWall.ts` builds the rampart mesh from the same segments.
   * Empty for interior chunks.
   */
  walls: CityWallRect[]
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
  /** the river/water feature (near/far banks, river band, bridge corridor). */
  water: CityWater
  /** the crafted world boundary (#32): perimeter rampart inset + gates. */
  boundary: CityBoundary
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
