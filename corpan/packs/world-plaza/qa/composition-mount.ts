/**
 * COMPOSITION PROOF MOUNT.
 *
 * Builds the REAL stylized world look (roads/ground bake + buildings + the new
 * ZONED dressing) over the real ENLARGED plaza-grand topology, then puts an
 * ArcRotateCamera under test control so the Playwright harness can:
 *   • shoot a clean TOP-DOWN of the whole town (read the zones: plaza / market /
 *     avenues / green / thinning edges — no crowding);
 *   • shoot EYE-LEVEL down a long avenue (long, uncluttered sightlines);
 *   • read the composition plan (zone metadata + per-species counts) and a live
 *     fps sample.
 *
 * Test hooks (window.__wpComp):
 *   topDown()      — straight-down over the whole map.
 *   topDownTight() — top-down framed on the town core.
 *   avenue()       — eye-level looking down a long N/S avenue toward the horizon.
 *   plaza()        — eye-level over-the-shoulder across the central plaza.
 *   plan           — { zones, counts, total } from composeDressing.
 *   fps()          — instantaneous fps sample.
 *   render()       — force one render.
 */
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera"
import { Vector3 } from "@babylonjs/core/Maths/math"
import { RoomTopology, Scene as WorldSceneSchema } from "@world-plaza/contracts"
import topologyJson from "../content/topologies/plaza-grand.json"
import sceneJson from "../content/scenes/antigua-grand.json"
import { createWorldEngine } from "../src/world/engine"
import { applyAtmosphere } from "../src/world/atmosphere"
import { selectLook } from "../src/render/worldLook"
import { composeDressing } from "../src/world/composition"

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

const look = selectLook("stylized")
look.build(scene, topology, worldScene, world.onFrame)

// Recompute the plan the SAME way dressing.ts does, purely for inspection.
const plan = composeDressing(topology, {
  seed: 1770,
  caps: {
    trees: 120, palms: 12, lamps: 90, planters: 36, marketProps: 48,
    signposts: 28, carts: 2, stalls: 6, benches: 14, troughs: 2,
  },
})
const total = plan.placements.length

const b = topology.bounds
const cx = (b.minX + b.maxX) / 2
const cz = (b.minZ + b.maxZ) / 2
const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ)

const cam = new ArcRotateCamera("wp-comp-cam", Math.PI / 2, 0.001, span, new Vector3(cx, 0, cz), scene)
cam.fov = 0.7
cam.minZ = 0.1
cam.maxZ = span * 3
cam.inputs.clear()
scene.activeCamera = cam

function set(alpha: number, beta: number, radius: number, target: Vector3) {
  cam.alpha = alpha
  cam.beta = beta
  cam.radius = radius
  cam.setTarget(target)
}

let lastT = performance.now()
;(window as unknown as { __wpComp?: unknown }).__wpComp = {
  // whole-town top-down: zones must read as legible, no confetti pile. Framed
  // within the distance-fog range (the bare rim beyond fades to the horizon).
  topDown() {
    set(Math.PI / 2, 0.001, span * 0.62, new Vector3(cx, 0, cz))
  },
  // town-core top-down (zoom into the dense middle to inspect spacing).
  topDownTight() {
    set(Math.PI / 2, 0.001, span * 0.34, new Vector3(cx, 0, cz))
  },
  // eye-level down a long N/S avenue toward the horizon (sightline check).
  avenue() {
    // sit on the southern avenue, near ground, looking north up the long axis so
    // the tree-lined road recedes to the fogged horizon.
    set(-Math.PI / 2, 1.49, 30, new Vector3(0, 1.2, 20))
  },
  // over-the-shoulder across the plaza toward the far town + horizon.
  plaza() {
    set(Math.PI * 0.62, 1.46, 24, new Vector3(0, 1.0, 0))
  },
  plan: { zones: plan.zones, counts: plan.counts, total },
  fps() {
    const now = performance.now()
    const dt = now - lastT
    lastT = now
    return dt > 0 ? 1000 / dt : 0
  },
  render() {
    scene.render()
  },
  ready: true,
}

world.start()
