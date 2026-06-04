import type { Obstacle, ObstacleField } from "../world/collision"
import { createObstacleField } from "../world/collision"
import { FOUNTAIN_BASE_RADIUS } from "../world/fountain"
import type { CityChunk, CityWaterRect, CityWallRect } from "./layout"

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
 *   • the plaza FOUNTAIN as one big circle (from the `fountain` anchor);
 *   • WATER box obstacles per chunk water rect (#30) — the river is non-walkable,
 *     so the SAME field the crowd/population/props test against (`field.blocked`)
 *     now reports the river as solid: nobody and nothing spawns on the water, and
 *     the player is walled at the shoreline. The bridge deck is the one gap, so a
 *     water rect with a `bridgeGap` is split into a LEFT + RIGHT box around the
 *     walkable corridor (never blocking the crossing itself).
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
  // WATER (#30) — the river is non-walkable. Each chunk water rect becomes a box
  // obstacle so the placement field reports it as solid; a rect crossed by the
  // bridge deck is split into the land-side boxes flanking the walkable corridor.
  for (const w of chunk.water) out.push(...waterBoxes(w))
  // WALLS (#32) — the perimeter rampart. Each segment becomes a box obstacle
  // (split around any walkable gate) so the player meets a designed edge.
  for (const w of chunk.walls) out.push(...wallBoxes(w))
  return out
}

/**
 * Turn one chunk's water rect into the box obstacle(s) that make it non-walkable.
 * Normally one box covering the whole rect; when a `bridgeGap` cuts a walkable
 * deck through it, we emit a LEFT box and a RIGHT box flanking the corridor so the
 * crossing stays open. A box obstacle's `resolve` slides a body along the OUTSIDE
 * face, so the player/crowd are stopped at the shoreline (or the deck edge) — they
 * never enter the water, and placement sampling (`field.blocked`) rejects it too.
 */
function waterBoxes(w: CityWaterRect): Obstacle[] {
  const z0 = Math.min(w.z0, w.z1)
  const z1 = Math.max(w.z0, w.z1)
  const x0 = Math.min(w.x0, w.x1)
  const x1 = Math.max(w.x0, w.x1)
  const cz = (z0 + z1) / 2
  const hd = (z1 - z0) / 2
  if (hd <= 0) return []
  const box = (bx0: number, bx1: number): Obstacle | null => {
    if (bx1 - bx0 <= 0.01) return null
    return { kind: "box", x: (bx0 + bx1) / 2, z: cz, hw: (bx1 - bx0) / 2, hd }
  }
  if (!w.bridgeGap) {
    const b = box(x0, x1)
    return b ? [b] : []
  }
  // carve the deck corridor [g0,g1] out of [x0,x1] → left + right land-side boxes.
  const [g0, g1] = w.bridgeGap[0] <= w.bridgeGap[1] ? w.bridgeGap : [w.bridgeGap[1], w.bridgeGap[0]]
  const out: Obstacle[] = []
  const left = box(x0, Math.min(g0, x1))
  const right = box(Math.max(g1, x0), x1)
  if (left) out.push(left)
  if (right) out.push(right)
  return out
}

/**
 * Turn one chunk's perimeter wall segment into the box obstacle(s) that wall the
 * world edge (#32). A north/south wall runs along X (gate splits it in X); an
 * east/west wall runs along Z (gate splits it in Z). Same OUTSIDE-face slide as
 * water, so the player is stopped AT the rampart and nothing spawns past it; the
 * gate gap stays walkable so an avenue can pass through.
 */
function wallBoxes(w: CityWallRect): Obstacle[] {
  const x0 = Math.min(w.x0, w.x1)
  const x1 = Math.max(w.x0, w.x1)
  const z0 = Math.min(w.z0, w.z1)
  const z1 = Math.max(w.z0, w.z1)
  // long axis: X for north/south ramparts, Z for east/west.
  const longX = w.side === "north" || w.side === "south"
  const box = (a0: number, a1: number): Obstacle | null => {
    // a0,a1 are the LONG-axis interval; the short axis is the full thickness.
    if (a1 - a0 <= 0.01) return null
    return longX
      ? { kind: "box", x: (a0 + a1) / 2, z: (z0 + z1) / 2, hw: (a1 - a0) / 2, hd: (z1 - z0) / 2 }
      : { kind: "box", x: (x0 + x1) / 2, z: (a0 + a1) / 2, hw: (x1 - x0) / 2, hd: (a1 - a0) / 2 }
  }
  const lo = longX ? x0 : z0
  const hi = longX ? x1 : z1
  if (!w.gateGap) {
    const b = box(lo, hi)
    return b ? [b] : []
  }
  const [g0, g1] = w.gateGap[0] <= w.gateGap[1] ? w.gateGap : [w.gateGap[1], w.gateGap[0]]
  const out: Obstacle[] = []
  const a = box(lo, Math.min(g0, hi))
  const b = box(Math.max(g1, lo), hi)
  if (a) out.push(a)
  if (b) out.push(b)
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
