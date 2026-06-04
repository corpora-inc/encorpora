import type { Scene } from "@babylonjs/core/scene"
import { Vector3 } from "@babylonjs/core/Maths/math"
import type { Anchor as TopologyAnchor } from "@world-plaza/contracts"
import { MaterialLibrary } from "../render/materials"
import type { CityLayout, CityAnchor } from "./layout"
import { findAnchor } from "./layout"
import { createStreamManager, type StreamManager } from "./stream"
import { createStreamingCollision, type StreamingCollision } from "./collision"
import { createCityCache, type CityCache } from "./cityCache"

/**
 * city/mountCity.ts — the PUBLIC API the orchestrator (game.ts) swaps in for the
 * current `renderScene(topology)` + `buildPlazaObstacleField(topology)` mount.
 *
 *   mountCity(scene, { layout, getCameraPos }) => {
 *     update(dt),        // drive from the frame loop: streams chunks by proximity
 *     getCollision(),    // the ObstacleField the player/crowd consume (streams)
 *     getAnchors(),      // generic landmark anchors as contract-shaped Anchors
 *     getSpawn(),        // the plaza spawn { x, z }
 *     dispose(),         // free every streamed chunk + the material library
 *   }
 *
 * It owns a shared `MaterialLibrary` (the dimensional PBR roof/stone/cobble
 * surfaces — same as the plaza Look), a `StreamManager` (background full-city
 * warm + build-once + proximity visibility), and a `StreamingCollision` facade
 * (an `ObstacleField` whose obstacle set is rebuilt from the NEAR chunks). The
 * streaming manager calls back into collision on every NEAR-set change, so the
 * obstacle field always matches the chunks around the player without the
 * controller ever re-capturing it.
 */

export interface MountCityOptions {
  layout: CityLayout
  /** the camera/player ground position each frame (the streaming origin). */
  getCameraPos: () => Vector3
  /** scene palette (warm Antigua key by default); flows to ground + buildings. */
  palette?: Record<string, string>
  /** streaming radii / budget overrides (defaults tuned in stream.ts). */
  stream?: {
    /** NEAR radius: chunks within it are rendered + collidable (build-once; far
     *  chunks are kept built but disabled). `activeRadius` is a back-compat alias. */
    visibilityRadius?: number
    /** @deprecated back-compat alias for `visibilityRadius`. */
    activeRadius?: number
    /** @deprecated no longer used — chunks are never disposed during play. */
    disposeRadius?: number
    /** @deprecated no longer used — chunks are never disposed during play. */
    disposesPerTick?: number
    /** per-FRAME wall-clock budget (ms) for the time-sliced chunk build queue. */
    frameBudgetMs?: number
    passInterval?: number
  }
}

export interface MountedCity {
  /** drive from the frame loop: streams chunks in/out by camera proximity. */
  update: (dt: number) => void
  /** the streaming ObstacleField the player + crowd consume (stable reference). */
  getCollision: () => StreamingCollision
  /** generic landmark anchors, in the contract `Anchor` shape (id/role/kind/…). */
  getAnchors: () => TopologyAnchor[]
  /** look up one anchor by canonical id (`harbor`, `station`, …). */
  getAnchor: (id: string) => CityAnchor | undefined
  /** the player spawn (plaza center). */
  getSpawn: () => { x: number; z: number }
  dispose: () => void
}

/** Map a generic CityAnchor kind → the contract's coarse render `role`. */
function anchorRole(kind: CityAnchor["kind"]): TopologyAnchor["role"] {
  switch (kind) {
    case "spawn":
      return "spawn"
    case "vendor":
      return "vendor"
    case "npc_station":
      return "npc_station"
    case "bench":
      return "bench"
    case "portal":
    case "docks":
      return "portal"
    case "fountain":
    case "landmark":
    case "decor":
    default:
      return "decor"
  }
}

/** Map a generic CityAnchor kind → the typed contract `AnchorKind` (for quests/
 * map/special-NPC binding). Only emit kinds the contract enum knows. */
function anchorKind(kind: CityAnchor["kind"]): TopologyAnchor["kind"] {
  switch (kind) {
    case "spawn":
      return "spawn"
    case "vendor":
      return "vendor"
    case "npc_station":
      return "npc_station"
    case "docks":
      return "docks"
    case "fountain":
      return "fountain"
    case "portal":
      return "portal"
    case "bench":
      return "bench"
    case "decor":
      return "decor"
    case "landmark":
    default:
      return "landmark"
  }
}

export function mountCity(scene: Scene, opts: MountCityOptions): MountedCity {
  const { layout, getCameraPos, palette } = opts

  // Shared PBR surface library (warm Antigua key) — buildings reuse terracotta/
  // stone; chunk grounds bake cobble/flagstone/dirt from the same swatches.
  const lib = new MaterialLibrary(scene, palette)

  // SHARED, CITY-LIFETIME caches — the smooth-streaming spine. The façade
  // material+texture pool, the per-species prop master meshes, and the baked
  // chunk grounds are all created ONCE here and reused by every streamed chunk,
  // then freed ONCE on city dispose. This is what kills the per-chunk hitch (the
  // old builder repainted façades / rebuilt prop masters / repainted ground on
  // EVERY chunk). Chunks now only build cheap geometry + thin-instance buffers
  // against these shared resources; they NEVER free anything in here.
  const cache: CityCache = createCityCache(scene, lib, palette)

  // The stable collision facade the controller captures once.
  const collision = createStreamingCollision()

  const stream: StreamManager = createStreamManager({
    scene,
    layout,
    getCameraPos,
    cache,
    lib,
    palette,
    // every time the active chunk set changes, rebuild collision from it.
    onActiveChange: (active) => collision.setActiveChunks(active),
    ...opts.stream,
  })

  // contract-shaped anchors (computed once — the layout's anchors are static).
  const contractAnchors: TopologyAnchor[] = layout.anchors.map((a) => ({
    id: a.id,
    role: anchorRole(a.kind),
    kind: anchorKind(a.kind),
    x: a.x,
    z: a.z,
    ...(a.facing != null ? { facing: a.facing } : {}),
  }))

  return {
    update: (dt) => stream.update(dt),
    getCollision: () => collision,
    getAnchors: () => contractAnchors,
    getAnchor: (id) => findAnchor(layout, id),
    getSpawn: () => layout.spawn,
    dispose: () => {
      // order matters: tear down streamed chunks FIRST (they reference the shared
      // cache + lib), THEN free the city-owned shared resources exactly once.
      stream.dispose()
      cache.dispose()
      lib.dispose()
    },
  }
}
