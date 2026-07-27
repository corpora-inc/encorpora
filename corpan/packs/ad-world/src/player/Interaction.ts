import { Ray } from "@babylonjs/core/Culling/ray"
import { Color3 } from "@babylonjs/core/Maths/math.color"
import type { Scene } from "@babylonjs/core/scene"
import type { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera"
import type { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import type { Billboard } from "../scene/Billboards"

const INTERACT_DISTANCE = 12
const HIGHLIGHT_PULSE_SPEED = 3

export type InteractionSystem = {
  update: () => void
  dispose: () => void
}

export const createInteractionSystem = (
  scene: Scene,
  camera: UniversalCamera,
  billboards: Billboard[],
  hud: HTMLElement,
): InteractionSystem => {
  let targetedBillboard: Billboard | null = null
  let activeBillboard: Billboard | null = null
  let highlightTime = 0

  const crosshair = hud.querySelector(".aw-crosshair") as HTMLElement | null

  // Click/tap handler — activate targeted billboard's ad
  const onPointerDown = (e: PointerEvent) => {
    // Right click or middle click exits active billboard
    if (e.button !== 0 && activeBillboard) {
      deactivateBillboard()
      return
    }

    if (targetedBillboard && !activeBillboard) {
      activateBillboard(targetedBillboard)
    } else if (activeBillboard) {
      // Clicking while a billboard is active — deactivate
      deactivateBillboard()
    }
  }

  // Escape key deactivates
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && activeBillboard) {
      deactivateBillboard()
    }
  }

  scene.getEngine().getRenderingCanvas()?.addEventListener("pointerdown", onPointerDown)
  window.addEventListener("keydown", onKeyDown)

  const activateBillboard = (billboard: Billboard) => {
    activeBillboard = billboard
    // Enable pointer events on the ad div so user can click the actual ad
    billboard.adDiv.style.pointerEvents = "auto"
    billboard.adDiv.style.cursor = "pointer"

    if (crosshair) {
      crosshair.textContent = "[ ]"
      crosshair.classList.add("aw-crosshair--active")
    }
  }

  const deactivateBillboard = () => {
    if (activeBillboard) {
      activeBillboard.adDiv.style.pointerEvents = "none"
      activeBillboard.adDiv.style.cursor = "default"
      activeBillboard = null
    }

    if (crosshair) {
      crosshair.textContent = "+"
      crosshair.classList.remove("aw-crosshair--active")
    }
  }

  const update = () => {
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
      if (targetedBillboard && targetedBillboard !== activeBillboard) {
        const mat = targetedBillboard.frame.material as StandardMaterial
        const cfg = targetedBillboard.config
        mat.emissiveColor = new Color3(cfg.color.r, cfg.color.g, cfg.color.b)
      }
      targetedBillboard = closestBillboard
    }

    // Highlight targeted billboard with pulse
    if (targetedBillboard && !activeBillboard) {
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
  }

  const dispose = () => {
    scene.getEngine().getRenderingCanvas()?.removeEventListener("pointerdown", onPointerDown)
    window.removeEventListener("keydown", onKeyDown)
  }

  return { update, dispose }
}
