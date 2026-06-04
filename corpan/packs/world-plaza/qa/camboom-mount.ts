/**
 * QA harness for #25 camera-boom collision. Mounts the REAL world engine + a row
 * of buildings, drives the follow camera via setCameraTarget (as the player
 * controller does), and lets the screenshotter place the player against a wall so
 * the boom would otherwise clip the building behind. Reports the camera eye + the
 * nearest building AABB so we can assert the eye stays OUTSIDE buildings.
 */
import { Vector3 } from "@babylonjs/core/Maths/math"
import { RoomTopology, Scene as WorldSceneSchema } from "@world-plaza/contracts"
import topologyJson from "../content/topologies/plaza-grand.json"
import sceneJson from "../content/scenes/antigua-grand.json"
import { createWorldEngine } from "../src/world/engine"
import { applyAtmosphere } from "../src/world/atmosphere"
import { createBuildings, type Blocker } from "../src/world/buildings"
import { MaterialLibrary } from "../src/render/materials"

void topologyJson
const topology = RoomTopology.parse(topologyJson)
void topology
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
const lib = new MaterialLibrary(scene, worldScene.palette)
// a few buildings around the origin so the player can stand against one.
const blockers: Blocker[] = [
  { x: 0, z: -6, w: 8, d: 6 },
  { x: -10, z: -6, w: 8, d: 6 },
  { x: 10, z: -6, w: 8, d: 6 },
]
createBuildings(scene, blockers, { palette: worldScene.palette, materials: lib })
world.start()

let px = 0
let pz = 0
let yaw = 0
world.onFrame(() => world.setCameraTarget(new Vector3(px, 0, pz), yaw))

interface Hooks {
  setPlayer: (x: number, z: number, yaw: number) => void
  probe: () => unknown
}
;(window as unknown as { __wpCam: Hooks }).__wpCam = {
  setPlayer: (x, z, y) => {
    px = x
    pz = z
    yaw = y
  },
  probe: () => {
    const eye = world.camera.globalPosition
    // nearest building AABB containment test
    let insideAny = false
    let nearest = Infinity
    for (const m of scene.meshes) {
      if (!m.name.startsWith("wp-building-")) continue
      const bb = m.getBoundingInfo().boundingBox
      const mn = bb.minimumWorld
      const mx = bb.maximumWorld
      if (eye.x > mn.x && eye.x < mx.x && eye.y > mn.y && eye.y < mx.y && eye.z > mn.z && eye.z < mx.z) insideAny = true
      const cx = Math.max(mn.x, Math.min(eye.x, mx.x))
      const cz = Math.max(mn.z, Math.min(eye.z, mx.z))
      nearest = Math.min(nearest, Math.hypot(eye.x - cx, eye.z - cz))
    }
    return {
      eye: { x: Math.round(eye.x * 10) / 10, y: Math.round(eye.y * 10) / 10, z: Math.round(eye.z * 10) / 10 },
      player: { x: px, z: pz, yaw },
      boomLen: Math.round(Math.hypot(eye.x - px, eye.z - pz) * 10) / 10,
      insideAnyBuilding: insideAny,
      distToNearestBuilding: Math.round(nearest * 100) / 100,
    }
  },
}
