import type { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera"
import type { HostApi } from "../../../shared/sdk/types"

const COOLDOWN_MS = 60_000 // 60 seconds between interstitials
const ZONE_RADIUS = 15 // Distance from origin before triggering

export type InterstitialTrigger = {
  update: () => void
}

/**
 * Fires interstitial ads when the player crosses zone boundaries.
 * Simple ring-based trigger: interstitial shows when player moves far enough
 * from the last trigger point, with a cooldown to prevent spam.
 */
export const createInterstitialTrigger = (
  hostApi: HostApi,
  camera: UniversalCamera,
): InterstitialTrigger => {
  let lastTriggerTime = 0
  let lastTriggerX = 0
  let lastTriggerZ = 0
  let showing = false

  const update = () => {
    if (!hostApi.showInterstitial || showing) return

    const now = Date.now()
    if (now - lastTriggerTime < COOLDOWN_MS) return

    const dx = camera.position.x - lastTriggerX
    const dz = camera.position.z - lastTriggerZ
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist >= ZONE_RADIUS) {
      lastTriggerTime = now
      lastTriggerX = camera.position.x
      lastTriggerZ = camera.position.z
      showing = true

      hostApi.showInterstitial().then(() => {
        showing = false
      }).catch(() => {
        showing = false
      })
    }
  }

  return { update }
}
