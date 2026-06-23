/**
 * Standalone preview harness for src/world/buildings.ts.
 *
 * Boots a minimal Babylon scene (engine + warm atmosphere) with a ground plane,
 * an ArcRotate orbit camera, and a STREET of premium buildings — one per kind
 * plus a couple of deterministic-by-seed ones — so the orbiting camera can show
 * every roof form and facade at multiple angles. Exposes `window.__wpBuildings`
 * hooks (set camera angle, read fps/draw-calls) for the Playwright screenshotter.
 *
 * This is QA-only; the live app keeps using sceneRenderer which will call
 * createBuildings() once the orchestrator wires it in.
 */

import { Engine } from "@babylonjs/core/Engines/engine"
import { Scene } from "@babylonjs/core/scene"
import { Color4, Color3, Vector3 } from "@babylonjs/core/Maths/math"
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera"
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight"
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight"
import "@babylonjs/core/Materials/standardMaterial"
import { createGround } from "../src/world/billboard"
import { applyAtmosphere } from "../src/world/atmosphere"
import { createBuildings, type Blocker } from "../src/world/buildings"
import { MaterialLibrary } from "../src/render/materials"

const palette: Record<string, string> = {
  sky: "#bfe0e8",
  ground: "#d9c7a3",
  groundAlt: "#cdb892",
  building: "#e7d4ad",
  buildingAlt: "#dcc59a",
  roof: "#b05a3c",
  trim: "#7a4a2c",
  stone: "#d8cdb8",
  accent: "#c46b4a",
}

const canvas = document.getElementById("wp-canvas") as HTMLCanvasElement
const dpr = Math.min(window.devicePixelRatio || 1, 2)
const engine = new Engine(canvas, dpr >= 2, { preserveDrawingBuffer: true, powerPreference: "high-performance" })
engine.setHardwareScalingLevel(1 / dpr)

const scene = new Scene(engine)
scene.clearColor = Color4.FromColor3(Color3.FromHexString(palette.sky))

const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene)
hemi.intensity = 0.85
hemi.diffuse = new Color3(1, 0.98, 0.92)
hemi.groundColor = new Color3(0.5, 0.46, 0.4)
const sun = new DirectionalLight("sun", new Vector3(-0.4, -1, 0.3), scene)
sun.intensity = 0.5
sun.position = new Vector3(20, 40, -20)

const camera = new ArcRotateCamera("orbit", -Math.PI / 2.4, Math.PI / 3.1, 26, new Vector3(0, 1.6, 0), scene)
camera.attachControl(canvas, true)
camera.lowerRadiusLimit = 8
camera.upperRadiusLimit = 60
camera.wheelDeltaPercentage = 0.02

// per-frame bus for atmosphere's vignette tracker
const frameCbs = new Set<(dt: number) => void>()
const onFrame = (cb: (dt: number) => void) => {
  frameCbs.add(cb)
  return () => frameCbs.delete(cb)
}

createGround(scene, palette, 60)
applyAtmosphere(scene, palette, onFrame)

// A street: one building of each kind, then a few seed-chosen, laid in a row +
// a back row, so the orbit shows fronts AND backs.
const kinds = ["chapel", "inn", "shop", "house", "workshop", "market-hall"]
const blockers: Blocker[] = []
const kindHints: string[] = []
const gap = 6.5
const frontZ = 4
// front row (doors face +z, toward the camera-side origin): 6 kinds
kinds.forEach((k, i) => {
  const x = (i - (kinds.length - 1) / 2) * gap
  const w = 3.2 + (i % 3) * 0.7
  const d = 3 + (i % 2) * 0.8
  blockers.push({ x, z: frontZ, w, d })
  kindHints.push(k)
})
// back row: seed-chosen (no hints) so we exercise the deterministic picker
for (let i = 0; i < 6; i++) {
  const x = (i - 2.5) * gap
  blockers.push({ x, z: -frontZ - 4, w: 3 + (i % 3) * 0.6, d: 2.8 + (i % 2) * 0.7 })
  kindHints.push("") // empty → falls back to seed pick
}

// door anchors at the plaza centre so doors orient toward (0,0)
const doors = blockers.map((b) => ({ x: b.x * 0.2, z: 0 }))

const lib = new MaterialLibrary(scene, palette)
const handle = createBuildings(scene, blockers, { palette, doors, kinds: kindHints, seed: 7, materials: lib })

engine.runRenderLoop(() => {
  const dt = Math.min(engine.getDeltaTime() / 1000, 0.05)
  for (const cb of frameCbs) cb(dt)
  scene.render()
})
window.addEventListener("resize", () => engine.resize())

// ---- QA hooks ----
;(window as unknown as Record<string, unknown>).__wpBuildings = {
  setAngle: (alpha: number, beta: number, radius: number) => {
    camera.alpha = alpha
    camera.beta = beta
    camera.radius = radius
  },
  fps: () => engine.getFps(),
  drawCalls: () => (engine as unknown as { drawCalls?: number }).drawCalls ?? -1,
  stats: () => ({
    fps: Math.round(engine.getFps()),
    drawCalls: (engine as unknown as { drawCalls?: number }).drawCalls ?? -1,
    meshes: scene.meshes.length,
    activeMeshes: scene.getActiveMeshes().length,
    materials: scene.materials.length,
    textures: scene.textures.length,
    verts: scene.getTotalVertices(),
    buildings: blockers.length,
  }),
  dispose: () => handle.dispose(),
}
;(window as unknown as Record<string, unknown>).__wpScene = scene
