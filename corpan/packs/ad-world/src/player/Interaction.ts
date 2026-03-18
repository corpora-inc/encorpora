import { Ray } from "@babylonjs/core/Culling/ray"
import { Color3 } from "@babylonjs/core/Maths/math.color"
import type { Scene } from "@babylonjs/core/scene"
import type { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera"
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import type { Billboard } from "../scene/Billboards"
import type { HostApi } from "../../../shared/sdk/types"

const INTERACT_DISTANCE = 12
const HIGHLIGHT_PULSE_SPEED = 3
const AD_COOLDOWN_MS = 30_000

export type InteractionSystem = {
  isTargeting: boolean
  update: () => void
  triggerAd: () => void
  dispose: () => void
}

export const createInteractionSystem = (
  scene: Scene,
  camera: UniversalCamera,
  billboards: Billboard[],
  hud: HTMLElement,
  hostApi: HostApi,
): InteractionSystem => {
  let targetedBillboard: Billboard | null = null
  let highlightTime = 0
  let lastAdTime = 0

  const crosshair = hud.querySelector(".aw-crosshair") as HTMLElement | null

  const system: InteractionSystem = {
    isTargeting: false,

    triggerAd() {
      if (!targetedBillboard) return

      const now = Date.now()
      if (now - lastAdTime < AD_COOLDOWN_MS) {
        console.log("[Ad World] Ad cooldown active, skipping")
        return
      }
      lastAdTime = now

      if (hostApi.showRewarded) {
        hostApi.showRewarded().then((r) => {
          console.log("[Ad World] Rewarded ad result:", r)
        }).catch((err: unknown) => {
          console.error("[Ad World] Rewarded ad error:", err)
        })
      } else if (hostApi.showInterstitial) {
        hostApi.showInterstitial().then((r) => {
          console.log("[Ad World] Interstitial ad result:", r)
        }).catch((err: unknown) => {
          console.error("[Ad World] Interstitial ad error:", err)
        })
      } else {
        console.warn("[Ad World] No ad provider available")
      }
    },

    update() {
      highlightTime += scene.getEngine().getDeltaTime() / 1000

      // Cast ray from camera center
      const ray = new Ray(camera.position.clone(), camera.getForwardRay().direction, INTERACT_DISTANCE)

      let closestBillboard: Billboard | null = null
      let closestDist = Infinity

      for (const bb of billboards) {
        const hit = ray.intersectsMesh(bb.frame)
        if (hit.hit && hit.distance < closestDist) {
          closestDist = hit.distance
          closestBillboard = bb
        }
      }

      // Update targeting
      if (closestBillboard !== targetedBillboard) {
        // Un-highlight previous
        if (targetedBillboard) {
          const mat = targetedBillboard.frame.material as StandardMaterial
          const cfg = targetedBillboard.config
          mat.emissiveColor = new Color3(cfg.color.r, cfg.color.g, cfg.color.b)
        }
        targetedBillboard = closestBillboard
      }

      system.isTargeting = targetedBillboard !== null

      // Highlight targeted billboard with pulse
      if (targetedBillboard) {
        const mat = targetedBillboard.frame.material as StandardMaterial
        const cfg = targetedBillboard.config
        const pulse = 0.7 + 0.3 * Math.sin(highlightTime * HIGHLIGHT_PULSE_SPEED)
        mat.emissiveColor = new Color3(
          cfg.color.r * pulse + (1 - pulse) * 1,
          cfg.color.g * pulse + (1 - pulse) * 1,
          cfg.color.b * pulse + (1 - pulse) * 1,
        )

        if (crosshair) {
          crosshair.classList.add("aw-crosshair--target")
        }
      } else {
        if (crosshair) {
          crosshair.classList.remove("aw-crosshair--target")
        }
      }
    },

    dispose() {
      scene.getEngine().getRenderingCanvas()?.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown)
    },
  }

  // Desktop click/tap handler — trigger ad on targeted billboard
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    if (targetedBillboard) {
      system.triggerAd()
    }
  }

  // Escape key — no-op now (no active billboard state)
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      // reserved for future use
    }
  }

  scene.getEngine().getRenderingCanvas()?.addEventListener("pointerdown", onPointerDown)
  window.addEventListener("keydown", onKeyDown)

  return system
}
