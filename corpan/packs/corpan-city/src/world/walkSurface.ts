import type { Scene } from "@babylonjs/core/scene"

/**
 * world/walkSurface.ts — a tiny per-scene registry of RAISED WALK SURFACES (#40).
 *
 * The world's collision is flat 2D (XZ); it has no height. A raised structure like
 * the arch bridge therefore needs a way to tell the movement system "the ground is
 * at Y=h here" so the player + NPCs walk OVER it instead of under it.
 *
 * Rather than thread a height callback through game.ts by hand (a manual wire that
 * is easy to forget — and forgetting it leaves the bridge un-walkable, the exact
 * #40 regression), a surface REGISTERS itself here when built and DEREGISTERS on
 * dispose. The player controller + crowd query `walkSurfaceHeight(scene, x, z)`
 * each frame and get the lift for free — so the moment `buildBridge` runs (it
 * already does), the bridge is walkable, with no orchestrator change required.
 *
 * Surfaces are keyed per-scene (so a scene teardown can't leak into the next), and
 * the height returned is the MAX over all registered surfaces at (x,z) — overlaps
 * resolve to the highest deck, and a point on no surface is plain ground (0).
 */

export type HeightSampler = (x: number, z: number) => number

const byScene = new WeakMap<Scene, Set<HeightSampler>>()

/** Register a raised walk-surface height sampler for a scene. Returns a disposer
 *  that removes it (call from the owning structure's dispose). */
export function registerWalkSurface(scene: Scene, sampler: HeightSampler): () => void {
  let set = byScene.get(scene)
  if (!set) byScene.set(scene, (set = new Set()))
  set.add(sampler)
  return () => {
    const s = byScene.get(scene)
    if (s) {
      s.delete(sampler)
      if (s.size === 0) byScene.delete(scene)
    }
  }
}

/** The walk-surface Y at (x,z): the MAX height over all registered surfaces, else
 *  0 (flat ground). Cheap — the registered set is tiny (a bridge or two). */
export function walkSurfaceHeight(scene: Scene, x: number, z: number): number {
  const set = byScene.get(scene)
  if (!set || set.size === 0) return 0
  let h = 0
  for (const sampler of set) {
    const y = sampler(x, z)
    if (y > h) h = y
  }
  return h
}
