import { Engine } from "@babylonjs/core/Engines/engine"
import { Scene } from "@babylonjs/core/scene"
import type { HostApi, StackConfig } from "../../shared/sdk/types"
import { createEnvironment } from "./scene/Environment"
import { createBillboardSystem } from "./scene/Billboards"
import { createAtmosphere } from "./scene/Atmosphere"
import { createFirstPersonController } from "./player/FirstPersonController"
import { createInteractionSystem } from "./player/Interaction"
import { createBillboardAdManager } from "./ads/BillboardAdManager"
import { BILLBOARD_LAYOUT } from "./ads/AdSlotConfig"
import { resolveAdConfig } from "../../shared/ad/adConfig"

export type World = {
  dispose: () => void
}

export const createWorld = (
  container: HTMLElement,
  _hostApi: HostApi,
  _stackConfig?: StackConfig,
): World => {
  // Create canvas
  const canvas = document.createElement("canvas")
  canvas.className = "aw-canvas"
  container.appendChild(canvas)

  // Create HUD overlay
  const hud = document.createElement("div")
  hud.className = "aw-hud"
  hud.innerHTML = `<div class="aw-crosshair">+</div>`
  container.appendChild(hud)

  // Initialize Babylon.js engine
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: true,
    antialias: true,
  })

  const scene = new Scene(engine)

  // Setup environment (ground, sky, fog, lighting, post-processing)
  createEnvironment(scene, engine, canvas)

  // Setup first-person camera and movement
  const controller = createFirstPersonController(scene, canvas)

  // Create billboard meshes with HtmlMesh for ads
  const billboards = createBillboardSystem(scene, BILLBOARD_LAYOUT)

  // Create atmosphere effects (particles, ambient details)
  createAtmosphere(scene)

  // Setup interaction (raycast tap on billboards)
  const interaction = createInteractionSystem(scene, controller.camera, billboards, hud)

  // Load real ads into billboard HtmlMesh instances
  const adConfig = resolveAdConfig()
  const adManager = createBillboardAdManager(billboards, adConfig.gptNetwork)

  // Start render loop
  engine.runRenderLoop(() => {
    const dt = engine.getDeltaTime() / 1000
    controller.update(dt)
    interaction.update()
    scene.render()
  })

  // Handle window resize
  const onResize = () => engine.resize()
  window.addEventListener("resize", onResize)

  const dispose = () => {
    window.removeEventListener("resize", onResize)
    adManager.dispose()
    interaction.dispose()
    engine.stopRenderLoop()
    scene.dispose()
    engine.dispose()
    canvas.remove()
    hud.remove()
  }

  return { dispose }
}
