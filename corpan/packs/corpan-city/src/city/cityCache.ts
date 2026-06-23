import type { Scene } from "@babylonjs/core/scene"
import type { Mesh } from "@babylonjs/core/Meshes/mesh"
import { createBuildingPool, type BuildingPool } from "../world/buildings"
import {
  resolvePropPalette,
  buildTree,
  buildPalm,
  buildLamp,
  buildPlanter,
  buildBarrel,
  buildCrate,
  buildSack,
  buildSignpost,
  buildCart,
  buildStall,
  buildBench,
  buildTrough,
  type PropPalette,
} from "../world/props3d"
import type { SpeciesId } from "../world/composition"
import type { MaterialLibrary } from "../render/materials"
import { CityGroundSurfaces } from "./cityGround"

/**
 * city/cityCache.ts — the SHARED, CITY-LIFETIME caches that make chunk streaming
 * smooth. The whole hitch was per-chunk REPEATED heavy work: every streamed
 * chunk re-painted its façade DynamicTextures, rebuilt its building materials,
 * rebuilt a fresh prop master mesh per species, and painted a ground texture.
 * Identical work, over and over, every time a chunk crossed the horizon.
 *
 * This cache hoists ALL of that to CITY scope. Created ONCE in `mountCity`,
 * passed into every chunk build, freed ONCE on city dispose:
 *
 *   • FAÇADE POOL — one shared `BuildingPool` (materials + painted facade
 *     textures). A façade variant is painted + uploaded ONCE for the whole city;
 *     every chunk reuses it. (See buildings.ts `createBuildingPool`.)
 *
 *   • PROP MASTERS — one master mesh per (species, palette) for the whole city.
 *     A chunk does NOT rebuild geometry; it `clone()`s the master (geometry +
 *     materials are SHARED/refcounted — a clone is cheap) and thin-instances onto
 *     the clone. The clone is the chunk's own; the master is city-lifetime.
 *
 *   • GROUND SURFACES — the SHARED, TILEABLE city ground (Stage 3). There are
 *     exactly SIX ground materials for the whole city (cobble / flagstone / dirt /
 *     stone / grass / water), each a tiny tileable albedo+normal pair — a few MB
 *     total no matter how many chunks exist. A chunk builds cheap flat GEOMETRY
 *     that SELECTS these shared materials per non-overlapping cell (roads stay
 *     baked-IN as part of the one flat ground — the §2 z-fight rule). This
 *     replaced the old per-chunk baked composite texture (~129 distinct 512²
 *     bakes ≈ 180 MB) with shared materials + per-chunk geometry. See cityGround.ts.
 *
 * DISPOSAL CONTRACT (non-negotiable): everything in here is CITY-OWNED. A chunk's
 * dispose frees ONLY that chunk's own meshes / thin-instance buffers / ground
 * geometry — NEVER the shared pool, master meshes, or shared ground materials
 * (freeing a material another chunk still uses → corruption). The shared cache is
 * freed exactly once, on `cache.dispose()`, at city teardown.
 *
 * WORKER SEAM (forward-compat): texture PAINTING stays behind clear function
 * boundaries (`createBuildingPool` paints façades lazily). The Stage-3 ground no
 * longer paints per chunk at all — it's shared tileable materials + cheap
 * geometry — so the OffscreenCanvas worker stage only needs to relocate the
 * façade paint, without touching this cache's shape or the chunk builder.
 */

/* per-species low-poly mesh factories (same set the plaza dresser uses). */
type PropFactory = (scene: Scene, pal: PropPalette) => Mesh
const PROP_FACTORY: Record<SpeciesId, PropFactory> = {
  tree: buildTree,
  palm: buildPalm,
  lamp: buildLamp,
  planter: buildPlanter,
  barrel: buildBarrel,
  crate: buildCrate,
  sack: buildSack,
  signpost: buildSignpost,
  cart: buildCart,
  stall: buildStall,
  bench: buildBench,
  trough: (scene, pal) => buildTrough(scene, pal).mesh,
}

export interface CityCache {
  /** the shared, city-lifetime façade material+texture pool for buildings. */
  buildingPool: BuildingPool
  /** @internal A/B measurement flag — when true, callers must NOT share resources
   *  (used only by the `__WP_NO_CACHE` perf harness; never set in production). */
  noCache: boolean
  /** the prop palette resolved once for the whole city. */
  propPalette: PropPalette
  /**
   * Get-or-build the city-lifetime MASTER mesh for a prop species. The master is
   * hidden (never rendered itself); chunks `clone()` it (cheap — geometry +
   * materials are shared/refcounted) and thin-instance the clone. Master is freed
   * on city dispose.
   */
  propMaster: (species: SpeciesId) => Mesh
  /**
   * The SHARED, tileable ground materials (Stage 3). A chunk builds flat geometry
   * that references these six city-lifetime materials per non-overlapping cell —
   * no per-chunk baked texture. The materials are CITY-OWNED (freed once on
   * dispose); a chunk frees only its own ground geometry.
   */
  groundSurfaces: CityGroundSurfaces
  dispose: () => void
}

export function createCityCache(
  scene: Scene,
  lib: MaterialLibrary,
  palette?: Record<string, string>,
): CityCache {
  const buildingPool = createBuildingPool(scene)
  const propPalette = resolvePropPalette(palette)
  const propMasters = new Map<SpeciesId, Mesh>()
  // The shared, tileable ground materials (Stage 3) — six for the whole city,
  // backed by the same MaterialLibrary the buildings use.
  const groundSurfaces = new CityGroundSurfaces(lib)

  // TEMP A/B: __WP_NO_CACHE defeats every shared cache (fresh per call) so a
  // headless run can measure the OLD per-chunk-repeated cost for before/after.
  const noCache = !!(globalThis as { __WP_NO_CACHE?: boolean }).__WP_NO_CACHE

  const propMaster = (species: SpeciesId): Mesh => {
    if (noCache) {
      const fresh = PROP_FACTORY[species](scene, propPalette)
      fresh.setEnabled(false)
      fresh.isPickable = false
      return fresh
    }
    let m = propMasters.get(species)
    if (m) return m
    m = PROP_FACTORY[species](scene, propPalette)
    // the master itself never renders — chunks clone+instance it. Hidden but
    // kept alive so its geometry/materials stay resident for the whole city.
    m.setEnabled(false)
    m.isPickable = false
    propMasters.set(species, m)
    return m
  }

  return {
    buildingPool,
    noCache,
    propPalette,
    propMaster,
    groundSurfaces,
    dispose: () => {
      // free EVERYTHING city-owned, exactly once.
      buildingPool.dispose()
      for (const m of propMasters.values()) m.dispose(false, true)
      propMasters.clear()
      groundSurfaces.dispose() // materials are owned by the MaterialLibrary
    },
  }
}
