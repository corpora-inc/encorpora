import { Engine } from "@babylonjs/core/Engines/engine"
import { Scene } from "@babylonjs/core/scene"
import type { HostApi, StackConfig } from "../../shared/sdk/types"
import { createEnvironment } from "./scene/Environment"
import { createBillboardSystem } from "./scene/Billboards"
import { createAtmosphere } from "./scene/Atmosphere"
import { createFirstPersonController } from "./player/FirstPersonController"
import { createInteractionSystem } from "./player/Interaction"
import { createMobileHud } from "./player/MobileHud"
import { createBillboardAdManager } from "./ads/BillboardAdManager"
import { createInterstitialTrigger } from "./ads/InterstitialTrigger"
import { BILLBOARD_LAYOUT } from "./ads/AdSlotConfig"
import { resolveAdConfig } from "../../shared/ad/adConfig"

export type World = {
  dispose: () => void
}

export const createWorld = (
  container: HTMLElement,
  hostApi: HostApi,
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

  // Setup first-person camera FIRST (pipeline needs an active camera)
  const controller = createFirstPersonController(scene, canvas)

  // Setup environment (ground, sky, fog, lighting, post-processing)
  createEnvironment(scene, engine, canvas)

  // Create billboard meshes with HtmlMesh for ads
  const billboards = createBillboardSystem(scene, BILLBOARD_LAYOUT, container)

  // Create atmosphere effects (particles, ambient details)
  createAtmosphere(scene)

  // Setup interaction (raycast tap on billboards → AdMob trigger)
  const interaction = createInteractionSystem(scene, controller.camera, billboards, hud, hostApi)

  // Mobile HUD — joystick visual + interact button
  const mobileHud = createMobileHud(hud)

  // Wire interact button to ad trigger
  const interactBtn = hud.querySelector(".aw-interact-btn") as HTMLElement | null
  if (interactBtn) {
    interactBtn.addEventListener("pointerdown", () => interaction.triggerAd())
  }

  // Load ads into billboard HtmlMesh instances (GPT on web, placeholders otherwise)
  const adConfig = resolveAdConfig()
  const adManager = createBillboardAdManager(billboards, adConfig.gptNetwork)

  // Show native AdMob banner on mobile
  if (hostApi.showBanner) {
    hostApi.showBanner({ position: "bottom", size: "banner" }).catch(() => {
      // Banner not available (desktop) — no-op
    })
  }

  // Interstitial triggers at zone boundaries
  const interstitialTrigger = createInterstitialTrigger(hostApi, controller.camera)

  // Start render loop
  engine.runRenderLoop(() => {
    const dt = engine.getDeltaTime() / 1000
    controller.update(dt)
    interaction.update()
    mobileHud.updateJoystick(controller.touchState)
    mobileHud.setTargeting(interaction.isTargeting)
    interstitialTrigger.update()
    scene.render()
  })

  // Handle window resize
  const onResize = () => engine.resize()
  window.addEventListener("resize", onResize)

  const dispose = () => {
    window.removeEventListener("resize", onResize)
    if (hostApi.hideBanner) {
      hostApi.hideBanner().catch(() => {})
    }
    mobileHud.dispose()
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
