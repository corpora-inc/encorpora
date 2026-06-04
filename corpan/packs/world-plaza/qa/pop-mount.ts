/**
 * QA harness for ambient population dispersal (#24: NPCs gather on the player).
 * Mounts createPopulation with a STATIONARY player at origin, drives update() for
 * a while, and reports how strollers spread vs the player (min/mean distance, count
 * inside the keepout). A converging crowd → many inside keepout + low mean; a
 * dispersed crowd → few/none inside keepout + a healthy mean.
 */
import { Vector3 } from "@babylonjs/core/Maths/math"
import { Scene as WorldSceneSchema } from "@world-plaza/contracts"
import sceneJson from "../content/scenes/antigua-grand.json"
import { createWorldEngine } from "../src/world/engine"
import { generateCity, mountCity } from "../src/city"
import { createPopulation } from "../src/city/population"

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
const layout = generateCity()
const PLAYER = { x: 0, z: 0 }
const city = mountCity(scene, { layout, getCameraPos: () => new Vector3(PLAYER.x, 1.5, PLAYER.z), palette: worldScene.palette as Record<string, string> })
const pop = createPopulation(scene, {
  layout,
  obstacles: city.getCollision(),
  palette: worldScene.palette as Record<string, string>,
})

// drive the sim with a fixed dt; player stays at origin.
let warm = 0
world.onFrame((dt: number) => {
  city.update(dt)
  pop.update(dt, PLAYER)
  warm += dt
})
world.start()

interface Hooks {
  warmedMs: () => number
  spread: () => { count: number; insideKeepout: number; min: number; mean: number }
}
;(window as unknown as { __wpPop: Hooks }).__wpPop = {
  warmedMs: () => Math.round(warm * 1000),
  spread: () => {
    // read every enabled ambient cutout's ground position via the focus handles.
    const fs = pop.focusables.filter((f) => Math.abs(f.billboard.root.position.x) < 1e5)
    const dists = fs.map((f) => Math.hypot(f.billboard.root.position.x - PLAYER.x, f.billboard.root.position.z - PLAYER.z))
    const KEEPOUT = 7
    return {
      count: dists.length,
      insideKeepout: dists.filter((d) => d < KEEPOUT).length,
      min: dists.length ? Math.round(Math.min(...dists) * 10) / 10 : -1,
      mean: dists.length ? Math.round((dists.reduce((a, b) => a + b, 0) / dists.length) * 10) / 10 : -1,
    }
  },
}
