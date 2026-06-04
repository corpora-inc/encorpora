import type { Obstacle, ObstacleField } from "../world/collision"
import { createObstacleField } from "../world/collision"
import { FOUNTAIN_BASE_RADIUS } from "../world/fountain"
import type { CityChunk } from "./layout"

/**
 * city/collision.ts — the STREAMING collision field for Corpan City.
 *
 * The movement controller (movement/controller.ts) consumes an `ObstacleField`
 * with `blocked / resolve / pushOut / obstacles`. That field is built from a
 * STATIC obstacle list. The city streams chunks in/out, so its obstacle set
 * CHANGES as you walk. We keep the SAME consumer-facing shape but rebuild the
 * underlying field (cheap: a spatial-hash insert per obstacle) whenever the set
 * of ACTIVE chunks changes.
 *
 * WHY rebuild rather than mutate the grid: the existing `createObstacleField`
 * builds an immutable spatial hash. Rebuilding it from the active obstacle list
 * is O(active obstacles) and happens only on a chunk activation/deactivation
 * (a handful per second of walking), not per frame — well within budget. The
 * controller holds a STABLE `ObstacleField` facade (this module) whose methods
 * delegate to the current inner field, so streaming never swaps the object the
 * controller captured at construction.
 *
 * Each chunk contributes:
 *   • a BOX obstacle per building footprint (axis-aligned, half-extents);
 *   • CIRCLE obstacles for solid props (trees/benches/stalls/barrels/…) sized
 *     from the same per-species radii the plaza uses;
 *   • the plaza FOUNTAIN as one big circle (from the `fountain` anchor).
 */

/* per-species collision radius (mirrors world/collision.ts SPECIES_RADIUS so
 * city colliders match the plaza's feel). null = walk-through decor. */
const SPECIES_RADIUS: Record<string, number | null> = {
  bench: 1.0,
  stall: 1.5,
  cart: 1.2,
  trough: 1.0,
  tree: 0.55,
  palm: 0.6,
  barrel: 0.55,
  crate: 0.55,
  sack: 0.5,
  planter: 0.85,
  lamp: 0.35,
  signpost: 0.3,
}

/** Turn one chunk's features into collision obstacles. */
export function chunkObstacles(chunk: CityChunk): Obstacle[] {
  const out: Obstacle[] = []
  for (const b of chunk.buildings) {
    out.push({ kind: "box", x: b.x, z: b.z, hw: b.w / 2, hd: b.d / 2 })
  }
  for (const p of chunk.props) {
    const base = SPECIES_RADIUS[p.species]
    if (base == null || base <= 0) continue
    out.push({ kind: "circle", x: p.x, z: p.z, r: base * (p.scale || 1) })
  }
  // FOUNTAIN collider — RESTORED (MASTER_BACKLOG C5). The phantom collider was
  // removed because the `fountain` anchor had NO mesh, so it was an invisible
  // wall at spawn. Now `world/fountain.ts` builds a real stone basin there, so a
  // matching circle collider is correct again: it tracks the basin's footprint
  // (`FOUNTAIN_BASE_RADIUS`, the wall radius — a touch inside the lip so you can
  // brush the rim). We add it ONLY for the chunk that actually owns the fountain
  // anchor, so it streams in/out with that chunk exactly like the geometry.
  for (const a of chunk.anchors) {
    if (a.kind === "fountain") {
      out.push({ kind: "circle", x: a.x, z: a.z, r: FOUNTAIN_BASE_RADIUS })
    }
  }
  return out
}

/**
 * A STABLE ObstacleField facade whose backing field is rebuilt as chunks stream.
 * The controller captures this once; `setActiveChunks` swaps the inner field.
 */
export interface StreamingCollision extends ObstacleField {
  /** Rebuild the obstacle set from the currently-active chunks. */
  setActiveChunks: (chunks: CityChunk[]) => void
}

export function createStreamingCollision(): StreamingCollision {
  // start empty; the streaming manager calls setActiveChunks after the first
  // proximity pass. cell ~2× the largest common collider (stall ≈ 1.5 → ~6),
  // but city blocks are bigger so a slightly larger cell keeps buckets lean.
  let inner: ObstacleField = createObstacleField([], { cell: 8 })
  let activeKeys = ""

  const setActiveChunks = (chunks: CityChunk[]) => {
    // skip the rebuild when the active set is unchanged (sorted key signature).
    const keys = chunks.map((c) => c.key).sort().join("|")
    if (keys === activeKeys) return
    activeKeys = keys
    const obstacles: Obstacle[] = []
    for (const c of chunks) obstacles.push(...chunkObstacles(c))
    inner = createObstacleField(obstacles, { cell: 8 })
  }

  return {
    setActiveChunks,
    blocked: (x, z, r) => inner.blocked(x, z, r),
    resolve: (px, pz, nx, nz, r) => inner.resolve(px, pz, nx, nz, r),
    pushOut: (x, z, r) => inner.pushOut(x, z, r),
    // `obstacles` is a live getter on the facade so QA reads the current set.
    get obstacles() {
      return inner.obstacles
    },
  }
}
