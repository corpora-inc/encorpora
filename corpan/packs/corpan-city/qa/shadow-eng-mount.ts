// Does createWorldEngine's SCENE support a basic shadow? Use createWorldEngine
// for the engine/scene/camera, then add ONLY a box+ground+sun+shadowgen (no
// city, no atmosphere, no cinematic pipeline). Isolates whether the engine's
// scene/camera setup is what defeats shadow projection.
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Color3, Vector3 } from "@babylonjs/core/Maths/math"
import { createWorldEngine } from "../src/world/engine"
import { applyAtmosphere } from "../src/world/atmosphere"

const root = document.createElement("div")
root.className = "wp-root"
const canvas = document.createElement("canvas")
canvas.className = "wp-canvas"
const overlay = document.createElement("div")
overlay.className = "wp-overlay"
root.appendChild(canvas)
root.appendChild(overlay)
document.body.appendChild(root)

const world = createWorldEngine(canvas, overlay, {})
const scene = world.scene
applyAtmosphere(scene, undefined, world.onFrame) // ADD atmosphere — does it break shadows?

// Use the REAL cinematic rig (its golden sun + lazy ShadowGenerator) — this
// proves the PIPELINE'S OWN shadows cast in the integrated scene.
scene.environmentIntensity = 0 // off so the test floor isn't IBL-flooded (visibility only)

const cam = new ArcRotateCamera("c2", -Math.PI / 3, 1.0, 20, new Vector3(0, 1, 1), scene)
cam.inputs.clear()
scene.activeCamera = cam
// feed the framed point as the follow target so the cinematic shadow frustum
// centers here (the engine's loop drives cinematic.update(followPos)).
world.onFrame(() => world.setCameraTarget(new Vector3(0, 1, 1), 0))

const ground = MeshBuilder.CreateGround("g2", { width: 24, height: 24 }, scene)
const gm = new StandardMaterial("gm2", scene)
gm.diffuseColor = new Color3(0.8, 0.75, 0.6)
gm.maxSimultaneousLights = 8
ground.material = gm
ground.receiveShadows = true

const box = MeshBuilder.CreateBox("b2", { size: 3, height: 5 }, scene)
box.position.y = 2.5
const bm = new StandardMaterial("bm2", scene)
bm.diffuseColor = new Color3(0.85, 0.4, 0.3)
box.material = bm

// Register the box with the CINEMATIC pipeline's generator (the real seam).
world.registerShadowCaster(box)
gm.markAsDirty(2 /* MATERIAL_LightDirtyFlag */) // ground compiles WITH the shadow sampler

import("@babylonjs/core/scene").then(({ Scene }) => {
  scene.fogMode = Scene.FOGMODE_NONE
})

world.start()
;(window as unknown as { __wpEng?: { ready: boolean; tod?: (n: string) => void } }).__wpEng = {
  ready: true,
  tod: (n) => world.setTimeOfDay(n as never),
}
