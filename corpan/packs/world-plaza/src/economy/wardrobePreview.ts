import { Engine } from "@babylonjs/core/Engines/engine"
import { Scene } from "@babylonjs/core/scene"
import { Color3, Color4, Vector3 } from "@babylonjs/core/Maths/math"
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera"
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight"
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight"
import "@babylonjs/core/Materials/standardMaterial"
import type { AvatarSpec } from "@world-plaza/contracts"
import { create3DFigure, type Figure3D } from "../character/figure3d"
import { createAnimator, type Animator } from "../character/animator"
import { avatarToCharacterSpec } from "../character/characterSpec"

/**
 * wardrobePreview — the LIVE 3D portrait for the wardrobe stage.
 *
 * The wardrobe used to preview the player as the flat 2D paper-doll (`drawDoll`).
 * Here we render the SAME character the world shows: the player's `AvatarSpec`
 * resolved to a `CharacterSpec` and built through the real `create3DFigure`
 * (the `bubble3d` look behind the `CharacterLook` seam), lit like the world and
 * gently turning so the outfit reads in the round. One character system — the
 * wardrobe portrait IS the in-world body, not a separate illustration.
 *
 * It is a tiny self-contained Babylon engine (its own canvas), torn down on
 * `dispose()`. `setAvatar` rebuilds the figure in place when the player changes
 * a garment, so the portrait tracks every tap with no world reload.
 */

export interface WardrobePreview {
  /** Rebuild the figure for a new avatar (cheap: dispose + recreate the body). */
  setAvatar(avatar: AvatarSpec): void
  dispose(): void
}

/**
 * Mount a 3D character portrait into `canvas`. Returns null if WebGL can't be
 * acquired (the caller keeps the 2D doll as a graceful fallback).
 */
export function createWardrobePreview(
  canvas: HTMLCanvasElement,
  avatar: AvatarSpec,
): WardrobePreview | null {
  let engine: Engine
  try {
    engine = new Engine(canvas, true, {
      antialias: true,
      preserveDrawingBuffer: true,
      // a soft warm clear that matches the wardrobe stage gradient
      alpha: true,
      premultipliedAlpha: false,
    })
  } catch (e) {
    console.error("[wp/wardrobePreview] WebGL unavailable, falling back to 2D doll:", e)
    return null
  }

  const scene = new Scene(engine)
  // transparent clear so the warm `.wp-wardrobe-stage` gradient shows through.
  scene.clearColor = new Color4(0, 0, 0, 0)

  // Frame the WHOLE standing figure (feet→head), a touch above mid-body so it
  // reads as a flattering full-length portrait, not a cropped bust. The figure
  // stands ~2 units tall (figure3d H≈2.3); a narrower FOV + ~4u radius fills the
  // tall portrait pane with the body without fisheye distortion.
  const camera = new ArcRotateCamera(
    "wpCam",
    -Math.PI / 2,
    Math.PI / 2.18,
    4.2,
    new Vector3(0, 1.0, 0),
    scene,
  )
  camera.fov = 0.62
  camera.minZ = 0.05
  camera.lowerRadiusLimit = 3.4
  camera.upperRadiusLimit = 5.6
  camera.wheelDeltaPercentage = 0.02
  // let the player spin the figure with a drag, but never pitch it past the
  // poles (keep it standing) and never dolly past the stage.
  camera.lowerBetaLimit = Math.PI / 3.2
  camera.upperBetaLimit = Math.PI / 1.95
  camera.attachControl(canvas, true)

  // Daylight in the spirit of the world engine — warm key + soft fill.
  const hemi = new HemisphericLight("wpHemi", new Vector3(0, 1, 0), scene)
  hemi.intensity = 0.92
  hemi.diffuse = new Color3(1, 0.98, 0.92)
  hemi.groundColor = new Color3(0.58, 0.5, 0.4)
  const sun = new DirectionalLight("wpSun", new Vector3(-0.5, -1, 0.4), scene)
  sun.intensity = 0.85
  sun.diffuse = new Color3(1, 0.95, 0.84)

  let fig: Figure3D | null = null
  let anim: Animator | null = null

  const build = (av: AvatarSpec) => {
    fig?.dispose()
    const spec = avatarToCharacterSpec(av, "player-local")
    fig = create3DFigure(scene, spec, { shadowAlpha: 0.18 })
    fig.setGroundPos(0, 0, 0)
    anim = createAnimator(fig, spec)
    anim.setState("idle")
  }
  build(avatar)

  // A slow idle turn so the outfit reads in the round; the player can grab and
  // spin (camera drag) — we only auto-rotate while they aren't dragging.
  let dragging = false
  canvas.addEventListener("pointerdown", () => (dragging = true))
  const stopDrag = () => (dragging = false)
  window.addEventListener("pointerup", stopDrag)

  scene.onBeforeRenderObservable.add(() => {
    const dt = engine.getDeltaTime() / 1000
    anim?.update(dt)
    if (!dragging) camera.alpha -= dt * 0.32 // gentle showcase spin
  })

  engine.runRenderLoop(() => scene.render())
  const onResize = () => engine.resize()
  window.addEventListener("resize", onResize)
  // Babylon's drawing buffer defaults to 300×150; size it to the CSS box so the
  // figure isn't squashed/cropped. A ResizeObserver keeps it correct as the
  // sheet animates open and across breakpoints.
  let ro: ResizeObserver | null = null
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => engine.resize())
    ro.observe(canvas)
  }
  // an immediate resize for the first frame (the observer may fire a tick later).
  requestAnimationFrame(() => engine.resize())

  return {
    setAvatar: (av: AvatarSpec) => build(av),
    dispose: () => {
      ro?.disconnect()
      window.removeEventListener("resize", onResize)
      window.removeEventListener("pointerup", stopDrag)
      fig?.dispose()
      scene.dispose()
      engine.dispose()
    },
  }
}
