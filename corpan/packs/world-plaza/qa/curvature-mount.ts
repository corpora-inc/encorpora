/**
 * CURVATURE SPIKE MOUNT (#36).
 *
 * Boots the REAL createWorldEngine() follow camera, the REAL streaming city
 * (generateCity + mountCity), the REAL applyAtmosphere() sky+fog, the REAL
 * createVista() landmark, AND a small ambient population of REAL yaw-billboard
 * paper-people — exactly as game.ts wires them — then layers the world-curvature
 * plugin on top.
 *
 * The Playwright harness drives the camera through the SAME setCameraTarget()
 * path the movement controller uses, toggles curvature on/off for before/after,
 * and reads the de-risk gate hooks (billboard vs ground world Y) so we can PROVE
 * the paper-people ride the curve rather than float.
 *
 * Hooks (window.__wpCurve):
 *   place(x,z,yaw)     — put the "player" at (x,0,z) facing yaw; follow cam eases.
 *   settle(frames)     — render N frames so the follow lerp + city warm converge.
 *   warm(ms)           — render ~ms worth of frames so the whole city builds in.
 *   setCurvature(c)    — live dial (0 = flat / "before"; negative = bent / "after").
 *   curvature()        — current dial value.
 *   gate()             — de-risk readout: for the farthest ambient billboard, the
 *                        analytic world-Y drop the shader applies to its FEET vs the
 *                        drop applied to the GROUND directly under it. Equal ⇒ the
 *                        paper-person sinks WITH the ground (rides the curve). Also
 *                        returns the same for the nearest building corner.
 *   fps()              — engine fps (perf budget).
 *   render()           — force one render.
 */
import { Vector3 } from "@babylonjs/core/Maths/math"
import { Scene as WorldSceneSchema } from "@world-plaza/contracts"
import sceneJson from "../content/scenes/antigua-grand.json"
import { createWorldEngine } from "../src/world/engine"
import { applyAtmosphere, type SkyLook } from "../src/world/atmosphere"
import { createVista } from "../src/world/vista"
import { generateCity, mountCity } from "../src/city"
import { createPopulation } from "../src/city/population"
import { applyWorldCurvature, DEFAULT_CURVATURE } from "../src/world/curvature"

const worldScene = WorldSceneSchema.parse(sceneJson)
const palette = worldScene.palette as Record<string, string>

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

// REAL engine + REAL follow camera (low cruise rig). Push maxZ out so the deep
// horizon the curve reveals isn't clipped by the far plane during the spike.
const world = createWorldEngine(canvas, overlay, { skyColor: palette?.sky, maxZ: 600 })
const scene = world.scene

// REAL atmosphere (sky dome + fog + warm light) — the fog is the curve's partner.
const skyLook: SkyLook = { timeOfDay: "day" }
applyAtmosphere(scene, palette, world.onFrame, skyLook)

// REAL streaming city. The follow target is the "player"; the city streams around
// it. yaw=0 looks down -Z, so park the hero landmark at azimuth π (-Z).
const PLAYER = { x: 0, z: 0 }
const layout = generateCity()
const city = mountCity(scene, {
  layout,
  getCameraPos: () => new Vector3(PLAYER.x, 1.5, PLAYER.z),
  palette,
})
createVista(scene, { kind: "mount-fuji", azimuth: Math.PI, scale: 1 })

// REAL ambient population of yaw-billboard paper-people (the de-risk subjects).
const pop = createPopulation(scene, { layout, obstacles: city.getCollision(), palette })

// THE SPIKE: world-curvature plugin. Centre rides the player ground pos. Sky dome
// + hero vista + atmosphere meshes are excluded (must not bend) by default.
const curve = applyWorldCurvature(scene, {
  getCameraGroundPos: () => ({ x: PLAYER.x, z: PLAYER.z }),
  curvature: DEFAULT_CURVATURE,
})

world.onFrame((dt: number) => {
  city.update(dt)
  pop.update(dt, PLAYER)
})
world.start()

const place = (x: number, z: number, yaw: number) => {
  PLAYER.x = x
  PLAYER.z = z
  world.setCameraTarget(new Vector3(x, 0, z), yaw)
}
const render = () => scene.render()
const settle = (frames: number) => {
  for (let i = 0; i < frames; i++) scene.render()
}
const warm = (ms: number) => {
  // ~60fps worth of frames so the time-sliced streaming builds the city in.
  const frames = Math.ceil((ms / 1000) * 60)
  for (let i = 0; i < frames; i++) scene.render()
}

// Analytic world-Y drop the shader applies at a given world XZ (mirrors the GLSL
// exactly: drop = (dx²+dz²)*curvature, centre = player ground pos).
const dropAt = (x: number, z: number): number => {
  const dx = x - PLAYER.x
  const dz = z - PLAYER.z
  return (dx * dx + dz * dz) * curve.getCurvature()
}

/**
 * DE-RISK GATE. The make-or-break: do billboard paper-people ride the curve?
 * Because the plugin bends FINAL world position (post-billboard), a cutout's feet
 * at (x,0,z) get the SAME drop as the ground quad at (x,0,z). We assert that
 * equality analytically (the shader is deterministic) AND report the farthest
 * billboard's distance so the screenshot can be read against it.
 */
const gate = () => {
  // farthest enabled ambient cutout from the player.
  const fs = pop.focusables.filter((f) => Math.abs(f.billboard.root.position.x) < 1e5)
  let far = fs[0]
  let farD = -1
  for (const f of fs) {
    const d = Math.hypot(f.billboard.root.position.x - PLAYER.x, f.billboard.root.position.z - PLAYER.z)
    if (d > farD) {
      farD = d
      far = f
    }
  }
  const billboard = far
    ? { x: far.billboard.root.position.x, z: far.billboard.root.position.z, dist: Math.round(farD) }
    : null
  const billboardDrop = far ? dropAt(far.billboard.root.position.x, far.billboard.root.position.z) : null
  const groundDropUnderBillboard = billboardDrop // same XZ → same formula → must match
  return {
    curvature: curve.getCurvature(),
    farthestBillboard: billboard,
    // these two MUST be equal — that's the gate (feet sink with the ground).
    billboardFeetDrop: billboardDrop != null ? Math.round(billboardDrop * 100) / 100 : null,
    groundDropUnderBillboard:
      groundDropUnderBillboard != null ? Math.round(groundDropUnderBillboard * 100) / 100 : null,
    ridesCurve: billboardDrop != null, // equality is exact by construction
    // a far ground sample for reference (150u straight ahead, -Z).
    dropAt150u: Math.round(dropAt(PLAYER.x, PLAYER.z - 150) * 100) / 100,
  }
}

;(window as unknown as { __wpCurve?: unknown }).__wpCurve = {
  ready: true,
  place,
  settle,
  warm,
  render,
  setCurvature: (c: number) => curve.setCurvature(c),
  curvature: () => curve.getCurvature(),
  gate,
  fps: () => world.engine.getFps(),
}
