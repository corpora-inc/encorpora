/**
 * QA harness for the STREAMING city ground (src/city/cityGround.ts via mountCity)
 * — the path the live game actually uses, NOT the old composeDressing/bakeGround
 * path the composition harness exercises. Uses the REAL createWorldEngine (same
 * camera rig + hemi/sun lighting as the game) so lighting can't be blamed, then
 * `mountCity` with the generated CityLayout, drives `update()` so the streaming
 * build runs, and exposes window hooks for the Playwright screenshotter. This
 * reproduces the embedded "gray ground / no roads" (webkit ≈ WKWebView).
 */
import { Vector3 } from "@babylonjs/core/Maths/math"
import { RoomTopology, Scene as WorldSceneSchema } from "@world-plaza/contracts"
import sceneJson from "../content/scenes/antigua-grand.json"
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera"
import { createWorldEngine } from "../src/world/engine"
import { applyAtmosphere } from "../src/world/atmosphere"
import { generateCity, mountCity } from "../src/city"

// ?noatmo=1 skips the skybox+fog (used while isolating the gray-ground cause).
const qs = new URLSearchParams(location.search)

const worldScene = WorldSceneSchema.parse(sceneJson)

const root = document.createElement("div")
root.className = "wp-root"
const canvas = document.createElement("canvas")
canvas.className = "wp-canvas"
canvas.id = "wp-canvas"
const overlay = document.createElement("div")
overlay.className = "wp-overlay"
root.appendChild(canvas)
root.appendChild(overlay)
document.body.appendChild(root)

const world = createWorldEngine(canvas, overlay, { skyColor: worldScene.palette?.sky })
const scene = world.scene
// ?noatmo=1 → skip the skybox + fog, to isolate a render-order/depth-clear cause
// for the invisible ground (the documented World-Plaza renderingGroupId lesson).
if (qs.get("noatmo") !== "1") applyAtmosphere(scene, worldScene.palette, world.onFrame)

let camPos = new Vector3(0, 1.5, 0)
const city = mountCity(scene, {
  layout: generateCity(),
  getCameraPos: () => camPos,
  palette: worldScene.palette as Record<string, string> | undefined,
})

// drive the streaming build every frame (aggressively at boot).
let warm = 0
world.onFrame((dt: number) => {
  for (let i = 0; i < 8; i++) city.update(dt)
  warm += dt
})

const cam = new ArcRotateCamera("wp-ground-cam", -Math.PI / 2, 1.0, 24, new Vector3(0, 0, 0), scene)
cam.fov = 0.7
cam.minZ = 0.1
cam.maxZ = 800
cam.inputs.clear()
scene.activeCamera = cam

// start the engine render loop (createWorldEngine does NOT auto-start it).
world.start()

const set = (alpha: number, beta: number, radius: number, t: Vector3) => {
  cam.alpha = alpha
  cam.beta = beta
  cam.radius = radius
  cam.setTarget(t)
  camPos = new Vector3(t.x, 1.5, t.z)
}

interface Hooks {
  setView: (alpha: number, beta: number, radius: number, tx: number, tz: number) => void
  lookDownAt: (tx: number, tz: number, height: number) => void
  warmedMs: () => number
  groundMeshCount: () => number
  diag: () => unknown
}
;(window as unknown as { __wpGround: Hooks }).__wpGround = {
  setView: (alpha, beta, radius, tx, tz) => {
    set(alpha, beta, radius, new Vector3(tx, 0, tz))
  },
  // frame straight down at a small ground patch centred on (tx,tz): camera high
  // above, looking down, narrow span → ground fills the whole frame.
  lookDownAt: (tx: number, tz: number, height: number) => {
    camPos = new Vector3(tx, 1.5, tz)
    cam.target = new Vector3(tx, 0, tz)
    cam.alpha = -Math.PI / 2
    cam.beta = 0.001
    cam.radius = height
  },
  warmedMs: () => Math.round(warm * 1000),
  groundMeshCount: () => scene.meshes.filter((m) => m.name.includes("wp-city-ground")).length,
  diag: () => {
    const gm = scene.meshes.filter((m) => m.name.includes("wp-city-ground"))
    const enabled = gm.filter((m) => m.isEnabled())
    const m0 = enabled[0]
    const mat = m0?.material as unknown as {
      getClassName?: () => string
      albedoTexture?: { isReady?: () => boolean; getSize?: () => { width: number; height: number }; name?: string; getContext?: () => CanvasRenderingContext2D; coordinatesIndex?: number }
      albedoColor?: { r: number; g: number; b: number }
    }
    const at = mat?.albedoTexture
    // sample the albedo DynamicTexture's backing canvas pixel variance (is it
    // actually painted, or blank?).
    let texStd = -1
    let texMean = -1
    try {
      const ctx = at?.getContext?.()
      const sz = at?.getSize?.()
      if (ctx && sz) {
        const d = ctx.getImageData(0, 0, Math.min(64, sz.width), Math.min(64, sz.height)).data
        let n = 0, s = 0, s2 = 0
        for (let i = 0; i < d.length; i += 4) { const l = d[i]; s += l; s2 += l * l; n++ }
        texMean = Math.round(s / n)
        texStd = Math.round(Math.sqrt(s2 / n - (s / n) * (s / n)))
      }
    } catch (e) { texStd = -2 }
    const geom = enabled.slice(0, 3).map((m) => {
      const bb = m.getBoundingInfo?.()?.boundingBox
      const p = m.getAbsolutePosition()
      return {
        name: m.name,
        absPos: { x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z) },
        verts: m.getTotalVertices(),
        faces: m.getTotalIndices() / 3,
        bbMin: bb ? { x: Math.round(bb.minimumWorld.x), y: Math.round(bb.minimumWorld.y), z: Math.round(bb.minimumWorld.z) } : null,
        bbMax: bb ? { x: Math.round(bb.maximumWorld.x), y: Math.round(bb.maximumWorld.y), z: Math.round(bb.maximumWorld.z) } : null,
        isReady: m.isReady?.(),
        visible: m.visibility,
        enabled: m.isEnabled(),
        inFrustum: scene.activeCamera ? scene.activeCamera.isInFrustum(m) : null,
        parentName: m.parent?.name,
        wmFrozen: (m as unknown as { _isWorldMatrixFrozen?: boolean })._isWorldMatrixFrozen,
      }
    })
    return {
      total: gm.length,
      enabled: enabled.length,
      lights: scene.lights.map((l) => `${l.getClassName()} i=${l.intensity.toFixed(2)}`),
      geom,
      sampleMat: mat?.getClassName?.(),
      albedoTexName: at?.name,
      albedoReady: at?.isReady?.(),
      albedoSize: at?.getSize?.(),
      albedoCoordIndex: at?.coordinatesIndex,
      albedoCanvasMean: texMean,
      albedoCanvasStd: texStd, // >8 = painted; ~0 = blank
      hasUV: m0?.isVerticesDataPresent?.("uv"),
      albedoColor: mat?.albedoColor,
    }
  },
}
