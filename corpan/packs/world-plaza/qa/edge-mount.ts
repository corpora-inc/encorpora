/**
 * QA harness for the WORLD-EDGE dressing (env-art, task #32 visual half): docked
 * BOATS (src/world/harborBoats.ts) + later the distant SKYLINE / horizon haze +
 * gate banners. Mounts the REAL streaming city (`?city=1`, default ON here since
 * the edge is only meaningful in the full world) under the REAL engine + warm
 * atmosphere, reads the river band + boundary from `layout.water`/`layout.boundary`
 * (places' canonical seam), lays the dressing along it exactly as game.ts will,
 * and exposes window hooks for the Playwright screenshotter.
 *
 * Resilient to a teammate's mid-edit of the city generator (guards generateCity +
 * city.update; logs loudly, never silent) so this domain's geometry is always
 * verifiable.
 */
import { Vector3 } from "@babylonjs/core/Maths/math"
import { Scene as WorldSceneSchema } from "@world-plaza/contracts"
import sceneJson from "../content/scenes/corpan-city.json"
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera"
import { createWorldEngine } from "../src/world/engine"
import { applyAtmosphere } from "../src/world/atmosphere"
import { generateCity, mountCity } from "../src/city"
import { buildHarborBoats } from "../src/world/harborBoats"

const qs = new URLSearchParams(location.search)
const worldScene = WorldSceneSchema.parse(sceneJson)
const palette = worldScene.palette as Record<string, string> | undefined

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

type Layout = ReturnType<typeof generateCity>
type Water = { waterZ: number; bankZ: number; farBankZ: number; farPromZ: number; bridgeX: number; bridgeHalfW: number }
let layout: Layout
try {
  layout = generateCity()
} catch (e) {
  console.error("[qa/edge] generateCity threw — fallback layout:", e)
  const half = 380
  layout = {
    bounds: { minX: -half, maxX: half, minZ: -half, maxZ: half },
    anchors: [],
    water: { waterZ: 310, bankZ: 294, farBankZ: 344, farPromZ: 356, bridgeX: 0, bridgeHalfW: 7 },
  } as unknown as Layout
}
const water = (layout as unknown as { water?: Water }).water ?? { waterZ: 310, bankZ: 294, farBankZ: 344, farPromZ: 356, bridgeX: 0, bridgeHalfW: 7 }

const useCity = qs.get("city") !== "0" // default ON (the edge needs the full world)
let camPos = new Vector3(0, 1.5, water.waterZ - 14)
const city = useCity
  ? mountCity(scene, { layout, getCameraPos: () => camPos, palette })
  : null

let warm = 0
let cityOk = !!city
world.onFrame((dt: number) => {
  if (cityOk && city) {
    try {
      for (let i = 0; i < 8; i++) city.update(dt)
    } catch (e) {
      cityOk = false
      console.error("[qa/edge] city.update threw — geometry continues without city:", e)
    }
  }
  warm += dt
})

// the docked-boats dressing (the thing under test).
const boats = buildHarborBoats(scene, {
  waterZ: water.waterZ,
  farBankZ: water.farBankZ,
  bounds: layout.bounds,
  bridge: { x: water.bridgeX, halfWidth: water.bridgeHalfW },
  palette,
  reducedMotion: qs.get("reduce") === "1",
})
world.onFrame((dt) => boats.update(dt))

const cam = new ArcRotateCamera("wp-edge-cam", -Math.PI / 2, 1.0, 24, new Vector3(0, 0, water.waterZ), scene)
cam.fov = 0.7
cam.minZ = 0.1
cam.maxZ = 1400
cam.inputs.clear()
scene.activeCamera = cam
world.start()

const set = (alpha: number, beta: number, radius: number, tx: number, tz: number) => {
  cam.setTarget(new Vector3(tx, 0.5, tz)) // setTarget RECOMPUTES a/b/r → first
  cam.alpha = alpha
  cam.beta = beta
  cam.radius = radius
  camPos = new Vector3(tx, 1.5, tz)
}

;(window as unknown as { __wpScene: typeof scene }).__wpScene = scene
;(window as unknown as { __wpEdge: unknown }).__wpEdge = {
  setView: (a: number, b: number, r: number, tx: number, tz: number) => set(a, b, r, tx, tz),
  water: () => water,
  diag: () => {
    const bm = scene.meshes.filter((m) => m.name.includes("wp-boats"))
    return {
      boatMeshes: bm.length,
      names: bm.map((m) => m.name),
      thinCounts: bm.map((m) => (m as unknown as { thinInstanceCount?: number }).thinInstanceCount ?? 0),
      totalVerts: bm.reduce((s, m) => s + m.getTotalVertices(), 0),
      water,
    }
  },
  warmedMs: () => Math.round(warm * 1000),
}
