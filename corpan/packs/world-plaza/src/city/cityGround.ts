import type { Scene } from "@babylonjs/core/scene"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData"
import { TransformNode } from "@babylonjs/core/Meshes/transformNode"
import type { Material } from "@babylonjs/core/Materials/material"
import { MaterialLibrary, type SurfaceName } from "../render/materials"
import type { CityChunk, CitySurface, CityGroundRegion } from "./layout"

/**
 * city/cityGround.ts — the SHARED, TILEABLE ground for Corpan City.
 *
 * THE STAGE-3 MEMORY FIX. The previous ground baked one UNIQUE composite texture
 * per distinct chunk layout (cobble roads + plaza/park discs + water composited
 * into a single 512² albedo + normal). Because every chunk's road/disc geometry
 * differs by its world position, that produced ~129 distinct 512² bakes ≈ 180 MB
 * — the dominant memory cost.
 *
 * The fix: a chunk's ground is no longer a baked texture. It is GEOMETRY that
 * SELECTS from a small set of SHARED, TILEABLE surface materials. There are
 * exactly SIX ground materials for the WHOLE city (cobble / flagstone / dirt /
 * stone / grass / water), each a tiny tileable albedo+normal pair — a few MB
 * total, regardless of how many chunks exist. A chunk builds, per surface, a flat
 * mesh whose UVs tile that shared texture at the surface's `metersPerTile`, so a
 * cobble street is the same stone size everywhere and the plaza flagstone matches
 * the standalone plaza.
 *
 * THE §2 Z-FIGHT RULE IS PRESERVED. Roads are STILL part of the ground, never an
 * offset overlay. We keep exactly ONE flat depth: the chunk is partitioned into
 * NON-OVERLAPPING rectangular cells (cut at every road/water/bridge rect edge,
 * plus a uniform background grid so plaza/park DISCS read curved). Each cell is
 * assigned the TOPMOST surface at its center (last region wins — identical to the
 * old painter order), then all cells of one surface are MERGED into one mesh.
 * Cells tile the plane and never overlap, so there is nothing to z-fight — at any
 * angle — without a single Y tier or polygon offset.
 *
 * SHARED, CITY-OWNED. `CityGroundSurfaces` is created once per city and freed once
 * on dispose. A chunk's ground meshes reference these shared materials and are
 * disposed with the chunk (the materials survive — never freed per chunk).
 */

/** Map a city surface to the shared `MaterialLibrary` surface that renders it.
 *  grass + water are now FIRST-CLASS surfaces (one fixed material each) — no more
 *  per-chunk palette recolor, which is exactly what let every chunk share. */
function surfaceName(s: CitySurface): SurfaceName {
  return s // CitySurface ⊆ SurfaceName now (cobble/flagstone/dirt/stone/grass/water)
}

/**
 * CityGroundSurfaces — the shared, city-lifetime tileable ground materials. One
 * PBR material per `CitySurface`, lazily built on first use and reused by every
 * chunk. Backed by the same `MaterialLibrary` the buildings use, so the cobble /
 * stone here is pixel-identical to the cobble / stone elsewhere.
 */
export class CityGroundSurfaces {
  private cache = new Map<CitySurface, Material>()
  constructor(private lib: MaterialLibrary) {}

  /** get-or-build the shared tileable material for a city surface. */
  get(s: CitySurface): Material {
    let m = this.cache.get(s)
    if (m) return m
    m = this.lib.get(surfaceName(s))
    this.cache.set(s, m)
    return m
  }

  /** materials are owned by the MaterialLibrary; nothing chunk-local to free. */
  dispose() {
    this.cache.clear()
  }
}

/* --------------------------------------------------------- partition + build */

type Rect = { minX: number; maxX: number; minZ: number; maxZ: number }

/** uniform background grid step (world units) so DISCS (plaza/park) read curved.
 *  Roads add their own exact cut lines on top, so straight road edges stay crisp
 *  regardless of this. ~5u gives a soft disc edge under the cruise cam. */
const GRID_STEP = 5

/** test a point against a region (chunk-LOCAL coords, region already local). */
function hits(region: CityGroundRegion, x: number, z: number): boolean {
  if (region.kind === "rect") {
    return (
      x >= region.cx - region.w / 2 &&
      x <= region.cx + region.w / 2 &&
      z >= region.cz - region.d / 2 &&
      z <= region.cz + region.d / 2
    )
  }
  const dx = x - region.cx
  const dz = z - region.cz
  return dx * dx + dz * dz <= region.r * region.r
}

/** sorted unique cut positions on one axis: chunk edges + uniform grid + every
 *  rect-region edge (clamped to the chunk) so straight road edges land exactly. */
function cutLines(min: number, max: number, edges: number[]): number[] {
  const set = new Set<number>()
  const q = (v: number) => Math.round(v * 100) / 100
  set.add(q(min))
  set.add(q(max))
  for (let v = min; v < max; v += GRID_STEP) set.add(q(v))
  for (const e of edges) if (e > min + 1e-3 && e < max - 1e-3) set.add(q(e))
  return [...set].sort((a, b) => a - b)
}

/**
 * Partition the chunk into non-overlapping cells and group them by surface. Each
 * cell is the topmost surface at its center (last region wins; base otherwise).
 * Adjacent same-surface cells stay as separate quads but are merged into one
 * VertexData per surface, so the chunk emits at most one mesh per distinct
 * surface used.
 */
function partition(
  bounds: Rect,
  baseSurface: CitySurface,
  regions: CityGroundRegion[],
): Map<CitySurface, Rect[]> {
  // collect rect-region edges (local) so road/water strips get crisp cut lines.
  const xEdges: number[] = []
  const zEdges: number[] = []
  for (const r of regions) {
    if (r.kind !== "rect") continue
    xEdges.push(r.cx - r.w / 2, r.cx + r.w / 2)
    zEdges.push(r.cz - r.d / 2, r.cz + r.d / 2)
  }
  const xs = cutLines(bounds.minX, bounds.maxX, xEdges)
  const zs = cutLines(bounds.minZ, bounds.maxZ, zEdges)

  const bySurface = new Map<CitySurface, Rect[]>()
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      const x0 = xs[i]
      const x1 = xs[i + 1]
      const z0 = zs[j]
      const z1 = zs[j + 1]
      const cx = (x0 + x1) / 2
      const cz = (z0 + z1) / 2
      // topmost surface at the cell center: last matching region wins, else base.
      let surf: CitySurface = baseSurface
      for (const r of regions) if (hits(r, cx, cz)) surf = r.surface
      let arr = bySurface.get(surf)
      if (!arr) bySurface.set(surf, (arr = []))
      arr.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 })
    }
  }
  return bySurface
}

/** the meters-per-tile a surface tiles at (matches the old bake densities). */
function tileFor(surface: CitySurface, regions: CityGroundRegion[], baseMPT: number): number {
  // a region carries its own metersPerTile; pick the first region of this surface
  // (they're uniform per surface in a chunk), else the base density.
  for (const r of regions) if (r.surface === surface) return r.metersPerTile
  return baseMPT
}

/**
 * Build a merged flat-quad mesh (one per surface) for a chunk's ground. Quads
 * sit at y=0, UVs tile the shared surface texture at `metersPerTile`. World
 * coordinates are LOCAL to the chunk; the returned root is positioned at the
 * chunk center by the caller.
 */
export interface ChunkGround {
  root: TransformNode
  /** total ground meshes built (one per distinct surface used). */
  meshCount: number
  dispose: () => void
}

export function buildChunkGround(
  scene: Scene,
  chunk: CityChunk,
  baseSurface: CitySurface,
  baseMetersPerTile: number,
  surfaces: CityGroundSurfaces,
): ChunkGround {
  const b = chunk.bounds
  const cx = (b.minX + b.maxX) / 2
  const cz = (b.minZ + b.maxZ) / 2
  // regions in chunk-LOCAL coords (centered on the chunk center).
  const regions: CityGroundRegion[] = chunk.ground.map((g) =>
    g.kind === "rect"
      ? { ...g, cx: g.cx - cx, cz: g.cz - cz }
      : { ...g, cx: g.cx - cx, cz: g.cz - cz },
  )
  const w = b.maxX - b.minX
  const d = b.maxZ - b.minZ
  const localBounds: Rect = { minX: -w / 2, maxX: w / 2, minZ: -d / 2, maxZ: d / 2 }

  const root = new TransformNode(`wp-city-ground-${chunk.key}`, scene)
  root.position.set(cx, 0, cz)

  const bySurface = partition(localBounds, baseSurface, regions)
  const meshes: Mesh[] = []

  for (const [surface, cells] of bySurface) {
    const mpt = tileFor(surface, regions, baseMetersPerTile)
    const inv = 1 / mpt // UV repeats per world unit (world-tiled so tiles align)
    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    let v = 0
    for (const c of cells) {
      // four corners (XZ plane at y=0, facing +Y). UV = worldXZ / metersPerTile so
      // the texture tiles continuously across cells of the same surface.
      const x0 = c.minX
      const x1 = c.maxX
      const z0 = c.minZ
      const z1 = c.maxZ
      positions.push(x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1)
      for (let k = 0; k < 4; k++) normals.push(0, 1, 0)
      uvs.push(x0 * inv, z0 * inv, x1 * inv, z0 * inv, x1 * inv, z1 * inv, x0 * inv, z1 * inv)
      indices.push(v, v + 2, v + 1, v, v + 3, v + 2)
      v += 4
    }
    const mesh = new Mesh(`wp-city-ground-${chunk.key}-${surface}`, scene)
    const vd = new VertexData()
    vd.positions = positions
    vd.normals = normals
    vd.uvs = uvs
    vd.indices = indices
    vd.applyToMesh(mesh)
    mesh.parent = root
    mesh.isPickable = false
    mesh.material = surfaces.get(surface)
    mesh.freezeWorldMatrix()
    meshes.push(mesh)
  }

  return {
    root,
    meshCount: meshes.length,
    dispose: () => {
      // free ONLY this chunk's geometry — the shared materials survive.
      for (const m of meshes) m.dispose(false, false)
      root.dispose()
    },
  }
}
