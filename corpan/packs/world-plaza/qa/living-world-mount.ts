/**
 * QA harness for the LIVING WORLD track — wide establishing shots of the plaza,
 * a walk-through past the market, and a landmark sightline. Mounts the REAL
 * streaming city (generateCity → mountCity → cityGround/chunkMesh) under the REAL
 * engine + atmosphere (warm sun, fog, post) so what we screenshot is what ships.
 *
 * Exposes window.__wpLW for the Playwright screenshotter: park the camera as an
 * over-the-shoulder hero shot at any (tx,tz) with alpha/beta/radius, look down,
 * read the anchor table, and a density probe (how many draw meshes are live).
 */
import { Vector3 } from "@babylonjs/core/Maths/math"
// side-effect: register the PostProcessRenderPipelineManager scene component so the
// cinematic DefaultRenderingPipeline can construct (main.ts pulls this in via other
// imports; a lean QA entry must request it explicitly or `new ...Manager()` is undefined).
import "@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent"
import { Scene as WorldSceneSchema } from "@world-plaza/contracts"
import sceneJson from "../content/scenes/antigua-grand.json"
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera"
import { createWorldEngine } from "../src/world/engine"
import { applyAtmosphere } from "../src/world/atmosphere"
import { generateCity, mountCity } from "../src/city"
import { buildSpecialPlaces } from "../src/world/specialPlaces"

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

let camPos = new Vector3(0, 1.5, 12)
const layout = generateCity()
const city = mountCity(scene, {
  layout,
  getCameraPos: () => camPos,
  palette: worldScene.palette as Record<string, string> | undefined,
})

// curated hero dressing (plaza ring + market bunting + the HERO clock tower) —
// the same call game.ts makes, so the harness verifies what ships.
const mk = layout.anchors.find((a) => a.id === "market")
buildSpecialPlaces(scene, {
  plaza: { x: 0, z: 0 },
  ...(mk ? { market: { x: mk.x, z: mk.z } } : {}),
  clockTower: { x: -25, z: -21 },
  palette: worldScene.palette as Record<string, string> | undefined,
})

// drive streaming at boot so chunks near camPos build fast (but not so hard we
// resident-load the whole 1520-wide map and crash the GPU process).
let warm = 0
world.onFrame((dt: number) => {
  for (let i = 0; i < 4; i++) city.update(dt)
  warm += dt
})

const cam = new ArcRotateCamera("wp-lw-cam", -Math.PI / 2, 1.1, 28, new Vector3(0, 0, 12), scene)
cam.fov = 0.78
cam.minZ = 0.1
cam.maxZ = 1200
cam.inputs.clear()
scene.activeCamera = cam
world.start()

const set = (alpha: number, beta: number, radius: number, t: Vector3) => {
  cam.alpha = alpha
  cam.beta = beta
  cam.radius = radius
  cam.setTarget(t)
  // park camPos at the camera EYE so the streamer keeps the chunks the camera
  // can actually see resident (looking across town needs the far chunks too).
  camPos = cam.globalPosition.clone()
}

interface Hooks {
  setView: (alpha: number, beta: number, radius: number, tx: number, ty: number, tz: number, fov?: number) => void
  lookDownAt: (tx: number, tz: number, height: number) => void
  warmedMs: () => number
  anchors: () => Array<{ id: string; x: number; z: number; label?: string }>
  /** density: live (enabled) draw-mesh count + breakdown by kind near camera. */
  density: () => {
    total: number
    buildings: number
    props: number
    ground: number
    propsBySpecies: Record<string, number>
  }
}
;(window as unknown as { __wpLW: Hooks }).__wpLW = {
  setView: (alpha, beta, radius, tx, ty, tz, fov) => {
    if (fov) cam.fov = fov
    set(alpha, beta, radius, new Vector3(tx, ty, tz))
  },
  lookDownAt: (tx, tz, height) => {
    camPos = new Vector3(tx, 1.5, tz)
    cam.target = new Vector3(tx, 0, tz)
    cam.alpha = -Math.PI / 2
    cam.beta = 0.001
    cam.radius = height
  },
  warmedMs: () => Math.round(warm * 1000),
  anchors: () =>
    layout.anchors.map((a) => ({ id: a.id, x: Math.round(a.x), z: Math.round(a.z), label: a.label })),
  density: () => {
    const enabled = scene.meshes.filter((m) => m.isEnabled() && m.isVisible !== false)
    let buildings = 0
    let props = 0
    let ground = 0
    const propsBySpecies: Record<string, number> = {}
    for (const m of enabled) {
      const n = m.name
      if (n.includes("wp-city-ground")) ground++
      else if (n.startsWith("wp-city-prop-")) {
        props++
        const sp = n.slice("wp-city-prop-".length).split("-")[0]
        propsBySpecies[sp] = (propsBySpecies[sp] ?? 0) + 1
      } else if (n.startsWith("wp-b-") && !m.parent) buildings++ // count building ROOTS only
    }
    return { total: enabled.length, buildings, props, ground, propsBySpecies }
  },
}
