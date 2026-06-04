import type { Scene } from "@babylonjs/core/scene"
import "@babylonjs/core/Meshes/thinInstanceMesh"
import { TransformNode } from "@babylonjs/core/Meshes/transformNode"
import type { Mesh } from "@babylonjs/core/Meshes/mesh"
import type { Matrix } from "@babylonjs/core/Maths/math"
import { createBuildings, type Blocker } from "../world/buildings"
import { instanceMatrix } from "../world/props3d"
import type { SpeciesId } from "../world/composition"
import type { MaterialLibrary } from "../render/materials"
import { buildChunkGround } from "./cityGround"
import type { CityCache } from "./cityCache"
import type { CityChunk, CityProp, CitySurface } from "./layout"

/**
 * city/chunkMesh.ts — instantiate ALL the meshes for ONE chunk, and dispose them
 * as a unit. This is what the streaming manager calls on activate/deactivate.
 *
 * SMOOTH STREAMING (the whole point of this rewrite). The old builder repeated
 * heavy work every chunk: it rebuilt building materials + repainted every façade
 * texture, built a FRESH prop master mesh per species, and painted a ground
 * DynamicTexture — ~130ms of hitch whenever a chunk crossed the horizon. Now ALL
 * that shared work lives in a CITY-LIFETIME `CityCache`:
 *   • GROUND  → SHARED tileable materials (cache.groundSurfaces); a chunk builds
 *     cheap flat geometry (one merged mesh per surface) referencing them — no
 *     per-chunk baked texture (Stage 3 memory fix).
 *   • BUILDINGS → the shared façade `BuildingPool` (painted once, reused), so a
 *     chunk's buildings just BUILD GEOMETRY against already-uploaded textures.
 *   • PROPS → clone the city-lifetime master mesh per species (geometry +
 *     materials shared/refcounted — a clone is cheap) and thin-instance onto it.
 *
 * TIME-SLICED at PER-BUILDING granularity. A chunk is built across many tiny
 * `beginChunkMesh().step()` calls: ground (one step) → buildings (AT MOST ONE
 * building per step) → props (a small batch of species per step). The old
 * coarse builder built ALL of a chunk's buildings in a SINGLE step (~45ms) →
 * one 45ms frame = a visible hitch the per-frame budget could not split. Now no
 * single step exceeds ~5ms, so the streaming manager spreads a chunk over as
 * many frames as it takes and NONE of them spikes.
 *
 * DRAW-CALL BUDGET (unchanged). Per active chunk: 1 ground + ~(buildings × 1–2
 * merged draws) + ~(distinct prop species, ≤12) thin-instanced draws.
 *
 * DISPOSAL CONTRACT. A chunk frees ONLY its own meshes / thin-instance buffers /
 * its stamped ground mesh. It NEVER frees the shared baked ground material, the
 * façade pool, or the prop masters — those are city-owned (cache.dispose()).
 */

export interface ChunkMesh {
  /** total draw-contributing meshes (ground + buildings + prop species). */
  drawCount: number
  /**
   * Toggle this chunk's render visibility WITHOUT disposing it. Built chunks are
   * kept for the whole session (build-once); when far from the camera we DISABLE
   * the root (`setEnabled(false)`) so Babylon skips it in render + frustum culling,
   * and re-enable it when near. This is the no-rebuild visibility lever — only
   * `mountCity` teardown ever calls `dispose`.
   */
  setVisible: (v: boolean) => void
  dispose: () => void
}

export interface BuildChunkOpts {
  cache: CityCache
  lib?: MaterialLibrary
  palette?: Record<string, string>
  baseSurface: CitySurface
}

/**
 * A time-sliceable chunk builder at PER-BUILDING granularity. Call `step()`
 * repeatedly (the streaming manager does this under a per-frame budget) until it
 * returns `true`; then read `result()` for the finished `ChunkMesh`. Each
 * `step()` does ONE tiny sub-build — the ground, then ONE building, then a small
 * batch of prop species — so no single call blocks a frame for long.
 */
export interface ChunkBuilder {
  /** do the next sub-build (one building, or a prop batch); true when finished. */
  step: () => boolean
  /** the finished chunk mesh (valid once `step()` has returned true). */
  result: () => ChunkMesh
  /** dispose whatever has been built so far (cancel a half-built chunk safely). */
  dispose: () => void
}

export function beginChunkMesh(scene: Scene, chunk: CityChunk, opts: BuildChunkOpts): ChunkBuilder {
  const { cache } = opts
  const root = new TransformNode(`wp-city-chunk-${chunk.key}`, scene)
  const disposers: Array<() => void> = []
  let drawCount = 0
  // Per-phase WORK time (excludes the idle frames BETWEEN time-sliced steps). The
  // reported TOTAL is the sum of actual build work for this chunk — the real
  // per-chunk cost — NOT the wall-clock span from enqueue to completion.
  let tGround = 0
  let tBld = 0
  let tProps = 0

  // ---- phase 0: ground (SHARED tileable materials; chunk builds cheap geometry)
  // Stage 3: no per-chunk baked texture. The chunk partitions its area into
  // non-overlapping cells and builds one merged flat mesh per surface, each
  // referencing a city-shared tileable material (roads BAKED-IN as part of the
  // one flat ground — the §2 z-fight rule). The shared materials survive; the
  // chunk frees only its own geometry.
  const buildGround = () => {
    const t = perfEnabled() ? performance.now() : 0
    // base ground density: grass tiles wider (8u) than warm street earth (6u).
    const baseMPT = opts.baseSurface === "grass" ? 8 : 6
    const g = buildChunkGround(scene, chunk, opts.baseSurface, baseMPT, cache.groundSurfaces)
    g.root.parent = root
    disposers.push(g.dispose) // shared materials survive
    drawCount += g.meshCount
    if (perfEnabled()) tGround = performance.now() - t
  }

  // ---- phase 1: buildings — ONE building per step (the anti-hitch core) ----
  //
  // The old builder built ALL of a chunk's buildings in a SINGLE step by handing
  // `createBuildings` the WHOLE blocker array — a chunk with ~6 buildings spent
  // ~45ms in that one call, blowing the frame. We now invoke `createBuildings`
  // with a SINGLE-element blocker array PER STEP, so each step builds exactly one
  // building (~5ms) and the chunk's buildings spread across consecutive frames.
  //
  // Façade textures still come from the shared city pool, so the per-building
  // cost is geometry + a cached-texture lookup — cheap. The doors anchor list is
  // computed once (cheap) and passed every call so each building still orients
  // its street-facing door correctly. The per-chunk seed is offset by the
  // building index so each single-building call picks the SAME kind/variant the
  // old whole-array call would have at that index (deterministic, identical look).
  const chunkSeed = (hashKey(chunk.key) ^ 0x9e3779b1) >>> 0
  const allDoors = chunk.buildings
    .filter((b) => b.door)
    .map((b) => ({ x: b.door!.x, z: b.door!.z }))
  // build state for the per-building loop.
  let bIndex = 0
  const buildOneBuilding = () => {
    const t = perfEnabled() ? performance.now() : 0
    const b = chunk.buildings[bIndex]
    const blocker: Blocker = { x: b.x, z: b.z, w: b.w, d: b.d }
    const handle = createBuildings(scene, [blocker], {
      palette: opts.palette,
      kinds: [b.kind],
      doors: allDoors,
      materials: opts.lib,
      // SHARED façade cache — painted once, reused. (A/B harness only:
      // __WP_NO_CACHE drops the shared pool so each chunk pays the old paint.)
      pool: cache.noCache ? undefined : cache.buildingPool,
      // seed offset by index → the single-building call reproduces the kind/
      // variant the old whole-chunk call gave building #bIndex (same look).
      seed: (chunkSeed + bIndex * 0x9e3779b1) >>> 0,
    })
    handle.root.parent = root
    disposers.push(handle.dispose) // frees only THIS building's meshes
    drawCount += 1
    bIndex++
    if (perfEnabled()) tBld += performance.now() - t
  }

  // ---- phase 2: props — clone the city master per species, thin-instance ----
  // Props are already cheap (master-clone, one thin-instanced draw per species);
  // we still batch a few species per step so a prop-dense chunk can't accidentally
  // spike a frame either. Grouping is computed once, lazily, on the first prop step.
  let propGroups: Array<[SpeciesId, CityProp[]]> | null = null
  let pIndex = 0
  const PROP_BATCH = 3 // species cloned per step (each clone is sub-ms)
  const buildPropBatch = () => {
    const t = perfEnabled() ? performance.now() : 0
    if (!propGroups) {
      const bySpecies = new Map<SpeciesId, CityProp[]>()
      for (const p of chunk.props) {
        let arr = bySpecies.get(p.species)
        if (!arr) bySpecies.set(p.species, (arr = []))
        arr.push(p)
      }
      propGroups = [...bySpecies.entries()]
    }
    const end = Math.min(pIndex + PROP_BATCH, propGroups.length)
    for (; pIndex < end; pIndex++) {
      const [species, list] = propGroups[pIndex]
      const master = cache.propMaster(species)
      // clone shares geometry + materials (refcounted); the clone is the chunk's
      // own thin-instance carrier and is disposed with the chunk.
      const mesh = master.clone(`wp-city-prop-${species}-${chunk.key}`, root) as Mesh
      // CRITICAL (the §2 invisible-props bug): a clone SHARES the master's
      // Geometry (Babylon clone calls `geometry.applyToMesh`). `thinInstanceSetBuffer`
      // writes the per-instance `world0..world3` vertex buffers into that SHARED
      // geometry (Mesh.setVerticesBuffer → _geometry.setVerticesBuffer). With many
      // chunks cloning the SAME master, each chunk's thin-instance buffer
      // OVERWRITES the previous chunk's on the one shared geometry — but each
      // chunk keeps its OWN per-mesh `instancesCount`. A chunk then issues a
      // `drawElementsInstanced` for N instances against a geometry whose `world*`
      // buffer was last written by a DIFFERENT chunk with fewer instances →
      // `glDrawElementsInstanced: Vertex buffer is not big enough` and the prop
      // draw is dropped (invisible trees/benches/etc.). It reproduces in
      // standalone too — it is NOT a headless artifact. Fix: give each chunk
      // clone its OWN geometry so its instance buffers can't be clobbered by a
      // sibling chunk. Materials stay shared/refcounted (copy keeps the same
      // material refs), so this only duplicates the cheap low-poly vertex data.
      mesh.makeGeometryUnique()
      mesh.setEnabled(true)
      mesh.isPickable = false
      const buf = new Float32Array(list.length * 16)
      list.forEach((p, i) => {
        const m: Matrix = instanceMatrix(p.x, 0, p.z, p.scale, p.yaw ?? 0)
        m.copyToArray(buf, i * 16)
      })
      mesh.thinInstanceSetBuffer("matrix", buf, 16, true)
      mesh.thinInstanceRefreshBoundingInfo(false)
      mesh.freezeWorldMatrix()
      // dispose the clone only (disposeMaterialAndTextures=false → shared mats of
      // the master survive for other chunks). thin-instance buffer dies with it.
      disposers.push(() => mesh.dispose(false, false))
      drawCount += 1
    }
    if (perfEnabled()) tProps += performance.now() - t
  }

  let disposed = false

  const finishLog = () => {
    if (!perfEnabled()) return
    const total = tGround + tBld + tProps
    console.log(
      `[wp/city/perf] chunk ${chunk.key} bld=${chunk.buildings.length} props=${chunk.props.length} | ` +
        `ground ${tGround.toFixed(0)}ms  buildings ${tBld.toFixed(0)}ms  ` +
        `props ${tProps.toFixed(0)}ms  TOTAL ${total.toFixed(0)}ms`,
    )
  }

  const chunkMesh: ChunkMesh = {
    get drawCount() {
      return drawCount
    },
    setVisible: (v: boolean) => {
      if (disposed) return
      // Toggle the chunk root only — disabling it skips the whole subtree in
      // render + frustum culling at ~zero cost, and re-enabling restores it
      // instantly (no rebuild). The meshes stay resident (build-once).
      root.setEnabled(v)
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      for (const dfn of disposers) dfn()
      root.dispose()
    },
  }

  // FINE-GRAINED STEP MACHINE. Stage 0 = ground (one step). Stage 1 = buildings,
  // ONE per step (the anti-hitch core — the old builder did all of them in one
  // step). Stage 2 = props, a small batch of species per step. Stage 3 = done.
  // Each step is bounded to ~5ms so the per-frame budget can never be blown by a
  // single call, no matter how dense the chunk.
  let stage = 0

  return {
    step: () => {
      if (disposed) return true
      switch (stage) {
        case 0: // ground
          buildGround()
          stage = 1
          return false
        case 1: // buildings — ONE per step (the anti-hitch core)
          if (bIndex < chunk.buildings.length) {
            buildOneBuilding()
            // stay in stage 1 until every building is built (one per step)
            return false
          }
          stage = 2
          return false
        case 2: // props — one batch of species per step
          buildPropBatch()
          if (!propGroups || pIndex >= propGroups.length) {
            stage = 3
            finishLog()
            return true
          }
          return false
        default:
          return true
      }
    },
    result: () => chunkMesh,
    dispose: () => chunkMesh.dispose(),
  }
}

/**
 * Build a chunk's meshes in one shot (no time-slicing). Kept for any non-streamed
 * caller; the streaming manager uses `beginChunkMesh` to spread the work.
 */
export function buildChunkMesh(scene: Scene, chunk: CityChunk, opts: BuildChunkOpts): ChunkMesh {
  const b = beginChunkMesh(scene, chunk, opts)
  while (!b.step()) {
    /* run all phases */
  }
  return b.result()
}

function perfEnabled(): boolean {
  return !!(globalThis as { __WP_CITY_PERF?: boolean }).__WP_CITY_PERF
}

/* small stable string hash for per-chunk seeds. */
function hashKey(key: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
