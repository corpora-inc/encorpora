/**
 * QA harness for the river bridge (#29). Mounts buildBridge over a water plane +
 * ground at the real layout.water heights, under the real engine lighting, and
 * exposes camera hooks for the screenshotter. Verifies: raised deck, parapets,
 * arches + piers, water visibly BENEATH the deck, ramps onto the banks.
 */
import { Vector3, Color3 } from "@babylonjs/core/Maths/math"
import { Scene as WorldSceneSchema } from "@world-plaza/contracts"
import sceneJson from "../content/scenes/antigua-grand.json"
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { createWorldEngine } from "../src/world/engine"
import { applyAtmosphere } from "../src/world/atmosphere"
import { buildBridge } from "../src/world/bridge"

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
applyAtmosphere(scene, worldScene.palette, world.onFrame)

// Real river heights from generateCity: bankZ=294, waterZ=310, farBankZ=344, farPromZ=356.
const nearZ = 294
const farZ = 356
const waterZ = 310
const farBankZ = 344

// ground (land) at y=0 on both banks.
const groundMat = new StandardMaterial("ground", scene)
groundMat.diffuseColor = Color3.FromHexString(worldScene.palette?.ground ?? "#d9c7a3")
groundMat.specularColor = new Color3(0, 0, 0)
const ground = MeshBuilder.CreateGround("ground", { width: 120, height: 120, subdivisions: 1 }, scene)
ground.position.set(0, 0, (nearZ + farZ) / 2)
ground.material = groundMat

// water plane across the river band [waterZ, farBankZ] at y≈0.07.
const waterMat = new StandardMaterial("water", scene)
waterMat.diffuseColor = Color3.FromHexString("#5a96b0")
waterMat.emissiveColor = Color3.FromHexString("#3a6f88")
waterMat.specularColor = new Color3(0.2, 0.25, 0.3)
const water = MeshBuilder.CreateGround("water", { width: 120, height: farBankZ - waterZ + 8, subdivisions: 1 }, scene)
water.position.set(0, 0.07, (waterZ + farBankZ) / 2)
water.material = waterMat

const bridge = buildBridge(scene, {
  x: 0,
  nearZ,
  farZ,
  halfWidth: 7,
  waterY: 0.07,
  palette: worldScene.palette as Record<string, string>,
})
void bridge

world.start()

const cam = new ArcRotateCamera("cam", -Math.PI / 2, 1.15, 60, new Vector3(0, 3, (nearZ + farZ) / 2), scene)
cam.fov = 0.7
cam.minZ = 0.1
cam.maxZ = 600
cam.inputs.clear()
scene.activeCamera = cam

;(window as unknown as { __wpBridge: unknown }).__wpBridge = {
  setView: (alpha: number, beta: number, radius: number, ty: number, tz: number) => {
    cam.alpha = alpha
    cam.beta = beta
    cam.radius = radius
    cam.target = new Vector3(0, ty, tz)
  },
  meshCount: () => scene.meshes.filter((m) => m.name.includes("wp-bridge")).length,
}
