import type { Scene } from "@babylonjs/core"
import { createAdSurface, type AdSurface } from "./AdSurface"
import type { AdSizeCategory } from "../ad/npcAd/types"
import { ENEMY_AD_SIZE_MAP, DEFAULT_AD_MAPPING } from "../ad/npcAd/adSizeMapping"

export type AdSurfacePool = {
  acquire: (sizeCategory?: AdSizeCategory) => AdSurface
  release: (surface: AdSurface) => void
  dispose: () => void
}

/** Key for sub-pool bucketing based on mesh dimensions */
const poolKey = (w: number, h: number) => `${w}x${h}`

export const createAdSurfacePool = (scene: Scene): AdSurfacePool => {
  const pools = new Map<string, AdSurface[]>()
  let nextId = 0

  const getPool = (key: string): AdSurface[] => {
    let p = pools.get(key)
    if (!p) {
      p = []
      pools.set(key, p)
    }
    return p
  }

  const acquire = (sizeCategory?: AdSizeCategory): AdSurface => {
    // Look up mesh dimensions from size category
    let meshWidth: number
    let meshHeight: number

    if (sizeCategory) {
      // Find a mapping that uses this size category
      const mapping = Object.values(ENEMY_AD_SIZE_MAP).find(
        (m) => m.sizeCategory === sizeCategory
      ) ?? DEFAULT_AD_MAPPING
      meshWidth = mapping.meshWidth
      meshHeight = mapping.meshHeight
    } else {
      meshWidth = DEFAULT_AD_MAPPING.meshWidth
      meshHeight = DEFAULT_AD_MAPPING.meshHeight
    }

    const key = poolKey(meshWidth, meshHeight)
    const pool = getPool(key)

    if (pool.length > 0) {
      const surface = pool.pop()!
      surface.mesh.setEnabled(true)
      return surface
    }

    return createAdSurface(scene, String(nextId++), { meshWidth, meshHeight })
  }

  const release = (surface: AdSurface) => {
    surface.mesh.setEnabled(false)
    surface.mesh.position.set(0, 100, 0) // Move off screen
    const key = poolKey(surface.meshWidth, surface.meshHeight)
    getPool(key).push(surface)
  }

  const dispose = () => {
    for (const pool of pools.values()) {
      for (const s of pool) {
        s.dispose()
      }
      pool.length = 0
    }
    pools.clear()
  }

  return { acquire, release, dispose }
}
