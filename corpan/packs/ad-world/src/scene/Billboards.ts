import { Color3 } from "@babylonjs/core/Maths/math.color"
import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import type { Scene } from "@babylonjs/core/scene"
import type { Mesh } from "@babylonjs/core/Meshes/mesh"
import { HtmlMeshRenderer } from "@babylonjs/addons/htmlMesh/htmlMeshRenderer"
import { HtmlMesh } from "@babylonjs/addons/htmlMesh/htmlMesh"
import type { BillboardConfig } from "../ads/AdSlotConfig"

export type Billboard = {
  id: string
  config: BillboardConfig
  frame: Mesh
  htmlMesh: HtmlMesh
  adDiv: HTMLDivElement
}

/**
 * Create the billboard system — neon-framed planes with HtmlMesh ad surfaces.
 */
export const createBillboardSystem = (
  scene: Scene,
  layout: BillboardConfig[],
): Billboard[] => {
  // Initialize HtmlMesh renderer — required for CSS3D transforms
  new HtmlMeshRenderer(scene)

  const billboards: Billboard[] = []

  for (const cfg of layout) {
    const name = `billboard-${cfg.id}`

    // Neon frame — slightly larger than the ad surface
    const frameW = cfg.width + 0.15
    const frameH = cfg.height + 0.15
    const frame = MeshBuilder.CreatePlane(`${name}-frame`, {
      width: frameW,
      height: frameH,
    }, scene)
    frame.position = new Vector3(cfg.x, cfg.y, cfg.z)
    frame.rotation = new Vector3(0, cfg.rotationY, 0)

    const frameMat = new StandardMaterial(`${name}-frameMat`, scene)
    frameMat.diffuseColor = Color3.Black()
    frameMat.emissiveColor = new Color3(cfg.color.r, cfg.color.g, cfg.color.b)
    frameMat.specularColor = Color3.Black()
    frameMat.alpha = 0.9
    frameMat.backFaceCulling = false
    frame.material = frameMat

    // HtmlMesh — the actual ad container
    const htmlMesh = new HtmlMesh(scene, name, {
      isCanvasOverlay: false,
    })

    const adDiv = document.createElement("div")
    adDiv.id = `aw-ad-${cfg.id}`
    adDiv.className = "aw-billboard-content"
    adDiv.style.width = "100%"
    adDiv.style.height = "100%"
    adDiv.style.background = "#0a0a0a"
    adDiv.style.border = "none"
    adDiv.style.overflow = "hidden"
    adDiv.style.display = "flex"
    adDiv.style.alignItems = "center"
    adDiv.style.justifyContent = "center"
    adDiv.style.color = "#333"
    adDiv.style.fontFamily = "monospace"
    adDiv.style.fontSize = "14px"
    adDiv.textContent = "LOADING AD..."

    htmlMesh.setContent(adDiv, cfg.width, cfg.height)
    htmlMesh.position = new Vector3(cfg.x, cfg.y, cfg.z)
    // Slightly in front of frame to prevent z-fighting
    const forward = new Vector3(0, 0, -0.02)
    forward.rotateByQuaternionAroundPointToRef(
      htmlMesh.rotationQuaternion ?? htmlMesh.rotation.toQuaternion(),
      Vector3.Zero(),
      forward,
    )
    htmlMesh.position.addInPlace(forward)
    htmlMesh.rotation = new Vector3(0, cfg.rotationY, 0)

    // Support pole / stand for ground-level billboards
    if (cfg.y > 1.5) {
      const poleHeight = cfg.y - cfg.height / 2
      if (poleHeight > 0.2) {
        const pole = MeshBuilder.CreateBox(`${name}-pole`, {
          width: 0.08,
          height: poleHeight,
          depth: 0.08,
        }, scene)
        pole.position = new Vector3(cfg.x, poleHeight / 2, cfg.z)
        const poleMat = new StandardMaterial(`${name}-poleMat`, scene)
        poleMat.diffuseColor = new Color3(0.05, 0.04, 0.06)
        poleMat.specularColor = Color3.Black()
        pole.material = poleMat
      }
    }

    billboards.push({ id: cfg.id, config: cfg, frame, htmlMesh, adDiv })
  }

  return billboards
}
