/**
 * SCENE-DIVERGENCE PROOF MOUNT.
 *
 * Builds the REAL stylized world over the REAL `plaza-grand` topology, then flips
 * the ACTIVE Scene between `antigua` (warm 1770 day) and `tokyo` (neon 2050
 * night) LIVE — re-skinning palette → ground/roads, `buildingStyle` → buildings,
 * `sky` → atmosphere — WITHOUT moving the topology. This is the money shot: the
 * SAME camera position, same footprints/colliders, two utterly different worlds.
 *
 * It uses the SAME `createSceneSwitcher` registry the app uses, and rebuilds via
 * exactly the orchestrator's path (renderScene + applyAtmosphere from a Scene),
 * so this proof exercises the production seam, not a bespoke one.
 *
 * Test hooks (window.__wpDiv):
 *   set("antigua"|"tokyo")  — flip the live scene + rebuild.
 *   toggle()                — cycle to the other scene.
 *   active()                — current scene key.
 *   setHero()               — park a low over-the-shoulder hero camera (the money shot angle).
 *   setTopDown()            — straight-down (proves identical footprints across scenes).
 *   render()                — force one render.
 */
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera"
import { Vector3 } from "@babylonjs/core/Maths/math"
import { RoomTopology } from "@world-plaza/contracts"
import topologyJson from "../content/topologies/plaza-grand.json"
import { createWorldEngine } from "../src/world/engine"
import { applyAtmosphere } from "../src/world/atmosphere"
import { renderScene } from "../src/scene/sceneRenderer"
import { createSceneSwitcher, SCENES, type SceneKey } from "../src/scene/sceneSwitch"

const topology = RoomTopology.parse(topologyJson)

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

// Engine boots once; only the WORLD + atmosphere are torn down/rebuilt on flip.
const world = createWorldEngine(canvas, overlay, { skyColor: SCENES.antigua.palette?.sky })
const babylon = world.scene

// ---- the world + atmosphere we tear down + rebuild on every scene flip ----
let worldHandle: { dispose: () => void } | null = null
let atmoHandle: { dispose: () => void } | null = null

function buildWorld(key: SceneKey) {
  const scene = SCENES[key]
  worldHandle?.dispose()
  atmoHandle?.dispose()
  // atmosphere reads scene.sky (day vs night) → this is what makes the sky flip.
  atmoHandle = applyAtmosphere(babylon, scene.palette ?? {}, world.onFrame, scene.sky)
  const rendered = renderScene(babylon, topology, scene, world.onFrame)
  worldHandle = { dispose: () => rendered.dispose() }
}

// boot in antigua, then hand the rebuild to the switcher (same as the app wiring).
buildWorld("antigua")
const switcher = createSceneSwitcher({
  initial: "antigua",
  rebuild: (_scene, key) => buildWorld(key),
})
switcher.bindKey("p")

// ---- TEST CAMERA: an ArcRotateCamera we fully control, made active. ----
const cam = new ArcRotateCamera("wp-div-cam", Math.PI / 2, 1.2, 28, new Vector3(0, 0, 0), babylon)
cam.fov = 0.7
cam.minZ = 0.1
cam.maxZ = 160
cam.inputs.clear()
babylon.activeCamera = cam

function set(alpha: number, beta: number, radius: number, target: Vector3) {
  cam.alpha = alpha
  cam.beta = beta
  cam.radius = radius
  cam.setTarget(target)
}

;(window as unknown as { __wpDiv?: unknown }).__wpDiv = {
  set(key: SceneKey) {
    switcher.set(key)
  },
  toggle() {
    return switcher.toggle()
  },
  active() {
    return switcher.active
  },
  // The MONEY SHOT: a low, over-the-shoulder hero camera looking OUT across the
  // town toward the far horizon (where the landmark sits). Same numbers for both
  // scenes → identical layout, divergent skin.
  setHero() {
    set(Math.PI / 2, 1.34, 26, new Vector3(0, 1.2, -2))
  },
  // Straight-down — identical footprints across scenes prove collisions unmoved.
  setTopDown() {
    set(Math.PI / 2, 0.001, 70, new Vector3(0, 0, 0))
  },
  render() {
    babylon.render()
  },
  ready: true,
}

world.start()
