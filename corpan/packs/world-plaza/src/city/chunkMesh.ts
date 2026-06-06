import type { Scene } from "@babylonjs/core/scene"
import "@babylonjs/core/Meshes/thinInstanceMesh"
import { TransformNode } from "@babylonjs/core/Meshes/transformNode"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh"
import type { Material } from "@babylonjs/core/Materials/material"
import { Constants } from "@babylonjs/core/Engines/constants"
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

/**
 * The minimal shadow seam a chunk needs to opt its meshes into the sun's
 * directional shadow map. The engine (engine.ts / pipeline.ts) supplies this: a
 * `registerShadowCaster` (the lazy generator + receiver-flag path) and direct
 * access to the `ShadowGenerator` so a chunk can DE-register on stream-out
 * (keeping the auto-fit shadow box player-local + bounded). We type the
 * generator loosely (only the two methods we touch) so chunkMesh.ts stays free
 * of a hard Babylon ShadowGenerator import.
 */
export interface ChunkShadowApi {
  registerShadowCaster: (mesh: AbstractMesh) => void
  getShadowGenerator: () => {
    removeShadowCaster: (mesh: AbstractMesh, includeDescendants?: boolean) => unknown
  }
}

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
  /**
   * Opt this chunk's BUILDING meshes in as sun shadow CASTERS and flag its GROUND
   * meshes as RECEIVERS (so buildings throw real directional shadows onto the
   * plaza). Called by the stream manager when the chunk ENTERS the near set, and
   * `setShadows(api, false)` when it LEAVES — so the auto-fit shadow box stays
   * player-local + bounded (registering the whole 1520-wide map would be perf
   * death). Idempotent + safe before/after the shadow generator exists. Props are
   * deliberately NOT registered (airy thin-instanced scatter; casting from them is
   * costly + low-value — their existing contact shadows read fine).
   */
  setShadows: (api: ChunkShadowApi, on: boolean) => void
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
  // Shadow seam (track per chunk so the streamer can opt this chunk's buildings in
  // as casters / its ground in as receivers when it's NEAR, and pull them back out
  // when it's far — keeping the auto-fit shadow box player-local + bounded).
  const buildingMeshes: AbstractMesh[] = [] // sun shadow CASTERS (solid bodies + roofs)
  const groundMeshes: AbstractMesh[] = [] // sun shadow RECEIVERS (the flagstone/cobble)
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
    // The flat ground surfaces are the shadow RECEIVERS (buildings throw onto them).
    for (const m of g.root.getChildMeshes()) groundMeshes.push(m)
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
  // Every detail mesh built this chunk (roof caps, door steps, contact shadows,
  // awnings, signs, balconies) — accumulated across the per-building steps so a
  // single MERGE PASS (mergeBuildingDetails, run once after the last building)
  // can collapse the same-material groups into a few combined draws. The merged
  // opaque BODIES are kept separate (unique façade textures) + tracked for shadows.
  const chunkDetailMeshes: Mesh[] = []
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
    // Collect the merged opaque BODY (`wp-building-…`, which folds in the walls +
    // windows) as a shadow CASTER now — bodies are never merged (unique façade
    // textures). The ROOF masses (`wp-r-`/`wp-r2-`) become casters only AFTER the
    // chunk-level merge below combines them into one mesh (registering the
    // per-building caps then disposing them in the merge would leave dangling
    // caster refs). The swarm of small details (steps, awnings, signs, balconies,
    // chimneys, finials) is deliberately NOT cast — too tiny to read, and casting
    // each would balloon the per-frame shadow-map draw count.
    for (const m of handle.meshes) {
      if (m.name.startsWith("wp-building-")) buildingMeshes.push(m)
      else chunkDetailMeshes.push(m) // roof/step/shadow/awning/sign/balcony → merge pass
    }
    drawCount += 1
    bIndex++
    if (perfEnabled()) tBld += performance.now() - t
  }

  // ---- MERGE PASS: collapse the same-material building DETAIL meshes ----
  //
  // THE DRAW-CALL WIN. With ~6 buildings/chunk and ~15-20 near chunks, the per-
  // building detail meshes dominate the active-draw count: a roof CAP, a door
  // STEP, and a contact SHADOW per building were ~3 separate draws EACH — hundreds
  // of tiny draws that the merged opaque body (one per building, irreducible —
  // unique façade textures) does NOT incur. Every cap shares ONE roof material,
  // every step ONE stone material, every shadow ONE shadow material, so each group
  // folds into a SINGLE combined mesh per chunk: ~3·N draws → ~3 draws/chunk.
  //
  // Correctness it preserves:
  //   • PREFIXES the camera-occlusion + shadow systems key off: the combined roof
  //     keeps a `wp-r-` name (still a big shadow caster + camera occluder), so
  //     the boom/fade-by-prefix logic and the golden-hour silhouette are intact.
  //   • The DISSOLVE/z rules: pieces are merged in WORLD space (their frozen world
  //     transforms baked into one geometry), so nothing shifts; the combined mesh
  //     gets a tight world bbox + `freezeWorldMatrix` like its sources.
  //   • Disposal: merged sources are disposed by `MergeMeshes(...,disposeSource)`,
  //     and the building handle's own `dispose` skips already-disposed meshes
  //     (guarded), so nothing double-frees; the combined meshes are tracked here.
  //
  // Alpha decals (awnings `wp-aw-`, signs `wp-sg-`) are NOT merged: they're
  // transparent (merging would break per-mesh depth-sort) and far fewer. Balcony
  // bits (`wp-bf-`/`wp-br-`) stay too (different material + rare). The body stays
  // one-per-building (its texture is unique). Hero landmarks use a separate path.
  const mergeBuildingDetails = () => {
    const t = perfEnabled() ? performance.now() : 0
    // Group merge-eligible meshes by (name-class, material). Name-class keeps the
    // occlusion/shadow prefix meaningful; material is what MergeMeshes requires to
    // collapse into ONE draw (a single mesh with one material — no submeshes).
    const groups = new Map<string, { cls: string; mat: Material | null; list: Mesh[] }>()
    for (const m of chunkDetailMeshes) {
      if (m.isDisposed()) continue
      const cls = mergeClass(m.name)
      if (!cls) continue // not a merge-eligible detail (alpha decal, balcony, …)
      const mat = m.material ?? null
      const key = `${cls}::${mat ? mat.uniqueId : "none"}`
      let g = groups.get(key)
      if (!g) groups.set(key, (g = { cls, mat, list: [] }))
      g.list.push(m)
    }
    for (const [, g] of groups) {
      if (g.list.length < 2) continue // a lone piece: nothing to save by merging
      // MergeMeshes bakes each source's world transform into one geometry and
      // disposes the sources (disposeSource=true). single material → no submeshes.
      const combined = Mesh.MergeMeshes(g.list, true, true, undefined, false, false)
      if (!combined) continue
      combined.name = `${g.cls}-merged-${chunk.key}`
      combined.parent = root
      combined.isPickable = false
      // a combined chunk-spanning detail mesh is big + static; keep normal frustum
      // culling (its tight world bbox is correct) and freeze its matrix.
      combined.alwaysSelectAsActiveMesh = false
      combined.freezeWorldMatrix()
      disposers.push(() => {
        if (!combined.isDisposed()) combined.dispose(false, false) // shared mat survives
      })
      // The combined ROOF is a big silhouette caster — register it (its caps were
      // never individually registered; see buildOneBuilding).
      if (g.cls === "wp-r" || g.cls === "wp-r2") buildingMeshes.push(combined)
      // `drawCount` is the streamer's coarse per-chunk metric (it counts +1 per
      // BUILDING, not per detail mesh — the details were never added). So the merge
      // doesn't touch it; the real per-frame draw reduction is visible via
      // `__wpDraws`. We DO add +1 for the new combined mesh so a chunk that is ALL
      // details (no merged bodies, e.g. a pure-roof edge case) still reports ≥1.
      drawCount += 1
    }
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
  let shadowsOn = false // tracks whether this chunk is currently in the caster set

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
    setShadows: (api: ChunkShadowApi, on: boolean) => {
      if (disposed) return
      if (on === shadowsOn) return // idempotent
      shadowsOn = on
      if (on) {
        // Buildings become casters (registerShadowCaster also flags each as a
        // receiver — walls catch each other's shadows). Ground meshes are flagged
        // receivers directly + marked dirty so their material recompiles WITH the
        // shadow sampler (a material that already compiled before becoming a
        // receiver would render shadowless).
        for (const m of buildingMeshes) api.registerShadowCaster(m)
        for (const m of groundMeshes) {
          m.receiveShadows = true
          m.material?.markAsDirty(Constants.MATERIAL_LightDirtyFlag)
        }
      } else {
        // Far chunk: drop its buildings from the caster set so the auto-fit shadow
        // box stays player-local + bounded. We leave receiveShadows ON (cheap; the
        // sampler is already compiled and a far chunk is disabled in render anyway).
        const sg = api.getShadowGenerator()
        for (const m of buildingMeshes) sg.removeShadowCaster(m, false)
      }
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
        case 2: // MERGE pass — collapse same-material building details (one step).
          // Runs once after the last building. MergeMeshes on the chunk's roof/
          // step/shadow groups is a handful of geometry concats — comfortably under
          // the per-step budget for a normal chunk (≤~10 buildings).
          mergeBuildingDetails()
          stage = 3
          return false
        case 3: // props — one batch of species per step
          buildPropBatch()
          if (!propGroups || pIndex >= propGroups.length) {
            stage = 4
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


/**
 * The merge CLASS of a building detail mesh — the name prefix that groups
 * same-material pieces the chunk merge pass collapses into one draw, or `null`
 * for a piece that must stay separate. We merge the high-count, same-material,
 * static OPAQUE groups: roof caps/tiers (`wp-r-`/`wp-r2-`), the stone door STEP
 * (`wp-st-`), and the soft contact SHADOW disc (`wp-sh-`). We deliberately do NOT
 * merge alpha decals (awnings `wp-aw-`, signs `wp-sg-` — transparent, depth-sorted
 * per mesh) or the rarer balcony floor/rail (`wp-bf-`/`wp-br-`, different material,
 * few per chunk). The merge keys ALSO on material, so a `wp-r-` cap and a `wp-r2-`
 * tier (same terracotta) still combine, while neon/PBR variants never cross-merge.
 */
function mergeClass(name: string): string | null {
  if (name.startsWith("wp-r2-")) return "wp-r2"
  if (name.startsWith("wp-r-")) return "wp-r"
  if (name.startsWith("wp-st-")) return "wp-st"
  if (name.startsWith("wp-sh-")) return "wp-sh"
  if (name.startsWith("wp-pp-")) return "wp-pp" // parapet ring (fancy roofs)
  return null
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
