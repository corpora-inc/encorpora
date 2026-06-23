/**
 * QA harness for a single prop species (task #19: trough/planter render). Mounts
 * the prop EXACTLY as the city does — `buildXxx` master → clone() →
 * makeGeometryUnique() → thinInstanceSetBuffer — under the real createWorldEngine
 * lighting, so a screenshot shows precisely what the player sees. `?species=` picks
 * the prop. Exposes `__wpProp.setView` for the screenshotter.
 */
import { Vector3, Matrix, Quaternion } from "@babylonjs/core/Maths/math"
import { Scene as WorldSceneSchema } from "@corpan-city/contracts"
import sceneJson from "../content/scenes/antigua-grand.json"
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import "@babylonjs/core/Meshes/thinInstanceMesh"
import { createWorldEngine } from "../src/world/engine"
import { applyAtmosphere } from "../src/world/atmosphere"
import {
  resolvePropPalette,
  buildTrough,
  buildPlanter,
  buildBarrel,
  buildBench,
  type PropPalette,
} from "../src/world/props3d"

const qs = new URLSearchParams(location.search)
const species = qs.get("species") ?? "trough"

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
if (qs.get("noatmo") !== "1") applyAtmosphere(scene, worldScene.palette, world.onFrame)

const pal: PropPalette = resolvePropPalette(worldScene.palette as Record<string, string> | undefined)
const factory: Record<string, () => Mesh> = {
  trough: () => buildTrough(scene, pal).mesh,
  planter: () => buildPlanter(scene, pal),
  barrel: () => buildBarrel(scene, pal),
  bench: () => buildBench(scene, pal),
}
const master = (factory[species] ?? factory.trough)()
master.setEnabled(false)

// city path: clone → makeGeometryUnique → thin-instance a small grid.
const clone = master.clone(`prop-${species}`, null) as Mesh
clone.makeGeometryUnique()
clone.setEnabled(true)
clone.isPickable = false
const buf = new Float32Array(4 * 16)
let i = 0
for (const [x, z] of [[-2, 0], [2, 0], [0, -2], [0, 2]] as const) {
  Matrix.Compose(new Vector3(1, 1, 1), Quaternion.RotationAxis(Vector3.Up(), 0), new Vector3(x, 0, z)).copyToArray(buf, i * 16)
  i++
}
clone.thinInstanceSetBuffer("matrix", buf, 16, true)
clone.thinInstanceRefreshBoundingInfo(false)

world.start()

const cam = new ArcRotateCamera("wp-prop-cam", -Math.PI / 2.5, 1.15, 7, new Vector3(0, 0.4, 0), scene)
cam.fov = 0.7
cam.minZ = 0.05
cam.maxZ = 200
cam.inputs.clear()
scene.activeCamera = cam

interface Hooks {
  setView: (alpha: number, beta: number, radius: number) => void
  subMeshInfo: () => unknown
}
;(window as unknown as { __wpProp: Hooks }).__wpProp = {
  setView: (alpha, beta, radius) => {
    cam.alpha = alpha
    cam.beta = beta
    cam.radius = radius
  },
  subMeshInfo: () => ({
    species,
    masterSub: master.subMeshes.length,
    cloneSub: clone.subMeshes.length,
    cloneMat: clone.material?.getClassName?.(),
    thinCount: clone.thinInstanceCount,
  }),
}
