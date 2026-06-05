import type { Scene } from "@babylonjs/core/scene"
import type { Vector3 } from "@babylonjs/core/Maths/math"
import type { MaterialLibrary } from "../render/materials"
import { beginChunkMesh, type ChunkBuilder, type ChunkMesh } from "./chunkMesh"
import type { CityCache } from "./cityCache"
import { type CityChunk, type CityLayout, distSqToBounds } from "./layout"

/**
 * city/stream.ts — the STREAMING MANAGER. Build the whole city in the background
 * under a per-frame budget, KEEP every built chunk for the session, and toggle
 * each chunk's render visibility by camera proximity. Keeps the live draw-call /
 * near-chunk count logged for verification.
 *
 * BACKGROUND FULL-CITY WARM + BUILD-ONCE (the smoothness spine)
 * ------------------------------------------------------------
 * The old loop built only the nearby RING and DISPOSED chunks you walked away
 * from — so returning REBUILT them = another hitch — and it built ALL of a
 * chunk's buildings in one step (~45ms = the visible jank). Now:
 *   • EVERY chunk of the whole city is enqueued for building, ordered
 *     NEAREST-TO-CAMERA first and RE-PRIORITIZED each pass (re-sort the
 *     not-yet-built queue by distance — 64 items, cheap), so your vicinity always
 *     builds first and the rest of the city fills in within ~15-20s of play.
 *   • Every FRAME (`update(dt)`), we drain the build queue under a per-frame TIME
 *     BUDGET (`frameBudgetMs`, ~5ms): step the fine-grained `ChunkBuilder` (each
 *     step builds the ground, ONE building, or a small prop batch) until the
 *     budget is spent, then resume next frame. No single step exceeds ~5ms, so a
 *     cold chunk spreads over several frames and NONE of them spikes.
 *   • A built chunk is NEVER disposed during play (build-once). When it's far we
 *     DISABLE its root (`setVisible(false)` → skipped in render + frustum cull);
 *     when within the visibility radius we re-enable it. Only `mountCity`
 *     teardown disposes anything.
 *
 * The heavy REPEATED work is already gone (shared CityCache: façade pool painted
 * once, prop masters cloned, ground baked once per distinct layout), so each
 * sub-build is now cheap; the per-building time-slice is the guarantee that even
 * a warmup-cold chunk can't blow a frame.
 *
 * COLLISION + the NEAR set. The player only collides with — and only needs
 * visible — the chunks within `visibilityRadius`. `onActiveChange` fires with
 * that NEAR set (not all 64 built chunks), so collision rebuilds stay cheap.
 *
 * WHY proximity, not frustum, for VISIBILITY LIFETIME: you turn the camera
 * constantly, so frustum-gating chunk visibility would pop scenery in/out as you
 * look around. We toggle by DISTANCE (stable) and let Babylon's per-frame frustum
 * culling skip rendering enabled-but-offscreen chunks.
 */

export interface StreamOptions {
  scene: Scene
  layout: CityLayout
  /** camera ground position each pass (the streaming origin). */
  getCameraPos: () => Vector3
  /** the shared, city-lifetime caches (façade pool, prop masters, ground bakes). */
  cache: CityCache
  /** shared world PBR material library (buildings reuse roof/stone surfaces). */
  lib?: MaterialLibrary
  /** scene palette (warm Antigua key by default). */
  palette?: Record<string, string>
  /** called whenever the NEAR (visible/collidable) chunk set changes — collision
   *  rebuilds from it. This is the chunks within `visibilityRadius`, NOT all 64
   *  built chunks (the player only collides nearby). */
  onActiveChange?: (active: CityChunk[]) => void
  /**
   * Chunks whose AABB is within this world distance are ENABLED (rendered +
   * collidable); beyond it they're disabled (kept built, skipped in render). The
   * player's NEAR set. Alias `activeRadius` is accepted for back-compat.
   */
  visibilityRadius?: number
  /** @deprecated back-compat alias for `visibilityRadius`. */
  activeRadius?: number
  /** @deprecated no longer used — chunks are never disposed during play. */
  disposeRadius?: number
  /** @deprecated no longer used — chunks are never disposed during play. */
  disposesPerTick?: number
  /** per-FRAME wall-clock budget (ms) for stepping the chunk build queue. */
  frameBudgetMs?: number
  /** seconds between coarse proximity passes (re-sort queue + retoggle vis). */
  passInterval?: number
}

export interface StreamManager {
  /** drive from the frame loop (dt seconds): runs the coarse pass on its cadence
   *  (re-sort queue by distance, toggle near/far visibility) AND drains the build
   *  queue under the per-frame budget. */
  update: (dt: number) => void
  /** the NEAR (visible/collidable) chunks — the set the player collides with. */
  activeChunks: () => CityChunk[]
  dispose: () => void
}

export function createStreamManager(opts: StreamOptions): StreamManager {
  const {
    scene,
    layout,
    getCameraPos,
    cache,
    lib,
    palette,
    onActiveChange,
    // The NEAR set: chunks within this distance are rendered + collidable. ~150u
    // ≈ 1.6 chunks of city around you, enough to cover what's on screen at the
    // follow-cam's depth while keeping the collision rebuild lean. `activeRadius`
    // is the back-compat alias.
    // 165 (was 150): push the load boundary OUT so a chunk's near edge appears at
    // ~107u — deep enough in the atmospheric fog (below) that it EMERGES from haze
    // instead of hard-popping into clear view. ~1.2× resident chunks; still lean.
    visibilityRadius = opts.activeRadius ?? 165,
    // ~5ms/frame for chunk building leaves the rest of a 16.6ms frame for render +
    // game logic. With the per-building fine-grained builder each step is sub-5ms,
    // so the budget spreads a cold chunk over several frames and never spikes.
    frameBudgetMs = 5,
    passInterval = 0.12,
  } = opts

  // EVERY built chunk's meshes (kept for the session — build-once, never disposed
  // during play). Visibility is toggled per-chunk by proximity.
  const built = new Map<string, ChunkMesh>()
  // chunks currently mid-build (fine-grained), keyed so we never double-enqueue.
  const building = new Map<string, ChunkBuilder>()
  // keys still needing build steps. Re-sorted nearest-first each pass so the
  // player's vicinity always builds before the far city.
  const queue: string[] = []

  const chunkByKey = new Map<string, CityChunk>()
  for (const c of layout.chunks) chunkByKey.set(c.key, c)

  // Seed the queue with the WHOLE city (background full-city warm). Order is set
  // by the first pass's re-sort; create the builders lazily as they reach the
  // head so we don't allocate 64 builders up front.
  for (const c of layout.chunks) queue.push(c.key)

  const visRSq = visibilityRadius * visibilityRadius
  let sinceLastPass = passInterval // run immediately on the first update

  // which built chunks are currently ENABLED (near). Drives the NEAR-set notify.
  const enabled = new Set<string>()

  // tracked so we only log/notify when the NEAR set or draw count actually changes.
  let lastSig = ""
  let lastDraws = -1

  /** the NEAR (visible/collidable) chunks — what collision + QA consume. */
  const activeChunks = (): CityChunk[] => {
    const out: CityChunk[] = []
    for (const key of enabled) {
      const c = chunkByKey.get(key)
      if (c) out.push(c)
    }
    return out
  }

  const nearDraws = (): number => {
    let n = 0
    for (const key of enabled) {
      const m = built.get(key)
      if (m) n += m.drawCount
    }
    return n
  }

  const notify = () => {
    const sig = [...enabled].sort().join("|")
    const draws = nearDraws()
    if (sig !== lastSig || draws !== lastDraws) {
      lastSig = sig
      lastDraws = draws
      onActiveChange?.(activeChunks())
      console.log(
        `[world-plaza/city] near chunks ${enabled.size}/${built.size} built ` +
          `(${layout.chunks.length} total)  near-draws ${draws}  ` +
          `building ${building.size} queued ${queue.length} (frame budget ${frameBudgetMs}ms)`,
      )
    }
  }

  /** cheap coarse pass: re-sort the build queue nearest-first, then toggle each
   *  built chunk's visibility by the NEAR radius (no disposal — build-once). */
  const pass = () => {
    const cam = getCameraPos()
    const cx = cam.x
    const cz = cam.z

    // 1) RE-PRIORITIZE the not-yet-built queue nearest-first so the player's
    //    vicinity always builds before the far city. 64 items — cheap.
    if (queue.length > 1) {
      queue.sort((ka, kb) => {
        const ca = chunkByKey.get(ka)!
        const cb = chunkByKey.get(kb)!
        return distSqToBounds(ca.bounds, cx, cz) - distSqToBounds(cb.bounds, cx, cz)
      })
    }

    // 2) toggle visibility on every BUILT chunk by the NEAR radius. Built chunks
    //    are never disposed — far ones are just disabled (skipped in render +
    //    frustum culling); near ones enabled. Track the NEAR set for collision.
    let changed = false
    for (const [key, mesh] of built) {
      const c = chunkByKey.get(key)
      const near = !!c && distSqToBounds(c.bounds, cx, cz) <= visRSq
      const wasEnabled = enabled.has(key)
      if (near && !wasEnabled) {
        mesh.setVisible(true)
        enabled.add(key)
        changed = true
      } else if (!near && wasEnabled) {
        mesh.setVisible(false)
        enabled.delete(key)
        changed = true
      }
    }

    if (changed) notify()
  }

  /** drain the build queue under the per-frame time budget. */
  const drain = () => {
    if (!queue.length) return
    const deadline = performance.now() + frameBudgetMs
    let completed = false
    // step the head builder; create it lazily on first touch (the queue holds the
    // whole city, so we don't pre-allocate 64 builders). A builder that completes
    // promotes its chunk to `built`; we always do at least one step so progress is
    // guaranteed even on a tight frame.
    do {
      const key = queue[0]
      // RESILIENT BUILD STEP. A single chunk's build sub-step must NEVER throw out
      // of the per-frame `update` — that would kill the whole streaming loop and
      // leave the city blank (gray ground, no roads, no scenery: the §3 cascade).
      // We isolate each step: any throw is logged LOUDLY (repo rule — never
      // silent) and the offending chunk is dropped from the queue so the rest of
      // the city still builds. One bad chunk can't blank the world.
      try {
        let b = building.get(key)
        if (!b) {
          const c = chunkByKey.get(key)
          if (!c) {
            queue.shift()
            continue
          }
          b = beginChunkMesh(scene, c, { cache, lib, palette, baseSurface: layout.baseSurfaceByZone[c.zone] })
          building.set(key, b)
        }
        const done = b.step()
        if (done) {
          queue.shift()
          building.delete(key)
          const mesh = b.result()
          // NEW chunks start DISABLED; the next pass enables them if they're near.
          // (A newly-built far chunk should not render until it's in the NEAR set.)
          mesh.setVisible(false)
          built.set(key, mesh)
          completed = true
        }
      } catch (e) {
        console.error(`[world-plaza/city] chunk ${key} build step threw → dropping it (city keeps building)`, e)
        // drop the doomed chunk + dispose whatever half-built it left behind.
        queue.shift()
        const half = building.get(key)
        if (half) {
          building.delete(key)
          try {
            half.dispose()
          } catch (de) {
            console.error(`[world-plaza/city] chunk ${key} half-build dispose threw`, de)
          }
        }
      }
    } while (queue.length && performance.now() < deadline)

    if (completed) {
      // a freshly-built chunk may be inside the NEAR radius right now (e.g. the
      // one you're standing in) — run a pass so it enables + collision picks it up
      // this frame instead of waiting for the next cadence tick.
      pass()
    }
  }

  const update = (dt: number) => {
    sinceLastPass += dt
    if (sinceLastPass >= passInterval) {
      sinceLastPass = 0
      pass()
    }
    // drain EVERY frame (not just on a pass) so the background warm makes steady
    // progress and stays inside the per-frame budget.
    drain()
  }

  return {
    update,
    activeChunks,
    dispose: () => {
      // Only city teardown disposes anything (build-once everywhere else).
      for (const m of built.values()) m.dispose()
      built.clear()
      for (const b of building.values()) b.dispose()
      building.clear()
      enabled.clear()
      queue.length = 0
    },
  }
}
