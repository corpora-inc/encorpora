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
  scene: worldScene,
})

// #60 — the FAILING scenario is the player standing AT a market (a cluster of
// vendor anchors), where stall-keepers used to mob you. Expose the vendor cluster
// so a probe can teleport the player into the densest market and measure crowding
// + persona variety there, not just at the bare origin.
const vendors = layout.anchors.filter((a) => a.kind === "vendor")
function densestVendor(): { x: number; z: number } {
  let best = vendors[0] ?? { x: 0, z: 0 }
  let bestN = -1
  for (const v of vendors) {
    const n = vendors.filter((o) => Math.hypot(o.x - v.x, o.z - v.z) < 12).length
    if (n > bestN) { bestN = n; best = v }
  }
  return { x: best.x, z: best.z }
}

// drive the sim with a fixed dt; the follow-camera tracks the player so a
// screenshot frames whatever spot the probe teleports the player to (#60 market).
let warm = 0
let camYaw = 0
world.onFrame((dt: number) => {
  city.update(dt)
  pop.update(dt, PLAYER)
  world.setCameraTarget(new Vector3(PLAYER.x, 0, PLAYER.z), camYaw)
  warm += dt
})
world.start()

interface Hooks {
  warmedMs: () => number
  spread: () => { count: number; insideKeepout: number; min: number; mean: number }
  gotoMarket: () => { x: number; z: number }
  setPlayer: (x: number, z: number) => void
  personaVariety: () => { figures: number; archetypes: number; names: number; sample: string[] }
}
;(window as unknown as { __wpPop: Hooks }).__wpPop = {
  warmedMs: () => Math.round(warm * 1000),
  // teleport the player into the densest market cluster (the #60 failing spot).
  gotoMarket: () => { const m = densestVendor(); PLAYER.x = m.x; PLAYER.z = m.z; return m },
  setPlayer: (x: number, z: number) => { PLAYER.x = x; PLAYER.z = z },
  // override the follow-cam yaw so a screenshot can sweep to where the dispersed
  // crowd actually stands (strollers wake in the rear/side arc, out of the lens).
  setCamYaw: (yaw: number) => { camYaw = yaw },
  // read every ENABLED ambient figure's lazily-built persona (engaging the `role`
  // getter) and count distinct archetypes/names — proves a MIXED populace, not clones.
  personaVariety: () => {
    const fs = pop.focusables.filter((f) => Math.abs(f.billboard.root.position.x) < 1e5)
    const archs = new Set<string>(); const names = new Set<string>(); const sample: string[] = []
    for (const f of fs) {
      const r = f.role as { archetype?: string; name?: string }
      if (r.archetype) archs.add(r.archetype)
      if (r.name) names.add(r.name)
      if (sample.length < 14) sample.push(`${r.archetype ?? "?"}:${r.name ?? "?"}`)
    }
    return { figures: fs.length, archetypes: archs.size, names: names.size, sample }
  },
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
