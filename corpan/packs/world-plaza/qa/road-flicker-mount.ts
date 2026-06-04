/**
 * ROAD-FLICKER PROOF MOUNT.
 *
 * Builds the REAL stylized world look (roads/ground via buildRoads → bakeGround,
 * plus buildings + dressing) over the real plaza-grand topology, then puts an
 * ArcRotateCamera under TEST CONTROL so the Playwright harness can park at the
 * worst grazing angle over a long street + the plaza and slow-pan while we count
 * hard depth-flip / shimmer pixels. If the ground z-fought, this is where it
 * would scream.
 *
 * Test hooks (window.__wpRoad):
 *   setGrazingStreet()  — low grazing camera looking down a long N/S street.
 *   setGrazingPlaza()   — low grazing camera skimming across the plaza disc.
 *   setTopDown()        — straight-down (z-fight is angle-independent; proves it).
 *   pan(d)              — nudge camera alpha by `d` radians (slow pan).
 *   render()            — force one render (deterministic frame grabs).
 */
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera"
import { Vector3 } from "@babylonjs/core/Maths/math"
import { RoomTopology, Scene as WorldSceneSchema } from "@world-plaza/contracts"
import topologyJson from "../content/topologies/plaza-grand.json"
import sceneJson from "../content/scenes/antigua-grand.json"
import { createWorldEngine } from "../src/world/engine"
import { applyAtmosphere } from "../src/world/atmosphere"
import { selectLook } from "../src/render/worldLook"

const topology = RoomTopology.parse(topologyJson)
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

// Build the real look (this runs buildRoads → the single-mesh ground bake).
const look = selectLook("stylized")
look.build(scene, topology, worldScene, world.onFrame)

// ---- TEST CAMERA: an ArcRotateCamera we fully control, made active. ----
const cam = new ArcRotateCamera("wp-test-cam", Math.PI / 2, 1.2, 28, new Vector3(0, 0, 0), scene)
cam.fov = 0.7
cam.minZ = 0.1
cam.maxZ = 120
cam.inputs.clear()
scene.activeCamera = cam

function set(alpha: number, beta: number, radius: number, target: Vector3) {
  cam.alpha = alpha
  cam.beta = beta
  cam.radius = radius
  cam.setTarget(target)
}

// long N/S street sits on an axis line; the central cross is at x=0. Target a
// point partway down the street so a long cobble run recedes to the horizon.
const STREET_X = 0
;(window as unknown as { __wpRoad?: unknown }).__wpRoad = {
  // Grazing down a long cobble street — the classic flat-road flicker angle.
  setGrazingStreet() {
    // beta near PI/2 = camera almost at ground level → maximal grazing.
    set(Math.PI / 2, 1.46, 30, new Vector3(STREET_X, 0, 6))
  },
  // Grazing skim across the flagstone plaza + where streets meet it.
  setGrazingPlaza() {
    set(Math.PI * 0.5, 1.5, 16, new Vector3(0, 0, 0))
  },
  // Straight down — z-fight is angle-independent, so a clean top-down proves the
  // overlap is gone (not just hidden by an angle-tuned offset).
  setTopDown() {
    set(Math.PI / 2, 0.001, 34, new Vector3(0, 0, 0))
  },
  // True walking eye-level looking down a cobble street (close detail).
  setWalk() {
    // low radius + beta near grazing, target just ahead at ground level → the
    // cobbles fill the lower frame the way a walking player sees them.
    set(Math.PI / 2, 1.4, 9, new Vector3(0, 0.2, 10))
  },
  pan(d: number) {
    cam.alpha += d
  },
  render() {
    scene.render()
  },
  ready: true,
}

world.start()
