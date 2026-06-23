/**
 * CINEMATIC RENDERING PROOF MOUNT.
 *
 * Boots the REAL Corpan City renderer — `createWorldEngine` (which now owns the
 * cinematic pipeline: golden-hour sun + contact shadows + IBL + ACES/bloom post),
 * the REAL streamed `mountCity`, and the REAL `applyAtmosphere` — over the actual
 * generated city. Then it:
 *
 *   • registers the streamed city's building/prop meshes as SHADOW CASTERS via
 *     the engine's `registerShadowCaster` seam (the same call game.ts will make),
 *     and flags the ground as a receiver, so shadows actually land in-frame;
 *   • exposes an ArcRotateCamera under test control + a `window.__wpCine` hook so
 *     the Playwright harness can frame the plaza wide, a low golden sun-angle, and
 *     toggle the WHOLE pipeline OFF for a true BEFORE/AFTER comparison.
 *
 * Test hooks (window.__wpCine):
 *   wide()            — over-the-shoulder wide of the plaza + town.
 *   lowSun()          — low camera into the raking sun (long shadows + bloom).
 *   topish()          — high 3/4 to read shadow grounding across the town.
 *   setPipeline(on)   — disable/enable the cinematic post + shadows + IBL (BEFORE).
 *   registerCasters() — (re)scan streamed meshes + opt them into shadows.
 *   fps()             — instantaneous fps sample.
 *   render()          — force one render.
 */
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera"
import { Vector3 } from "@babylonjs/core/Maths/math"
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh"
import { Scene as WorldSceneSchema } from "@corpan-city/contracts"
import sceneJson from "../content/scenes/antigua-grand.json"
import { createWorldEngine } from "../src/world/engine"
import { applyAtmosphere } from "../src/world/atmosphere"
import { generateCity, mountCity } from "../src/city"

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
applyAtmosphere(scene, worldScene.palette, world.onFrame, worldScene.sky)

// Real generated, streamed city (same path as game.ts).
const citySeed = Array.from(worldScene.id).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)
const layout = generateCity(citySeed)

// ArcRotate camera under test control. We point the city's streaming origin at
// the camera target so chunks load around what we're framing.
const focus = new Vector3(0, 0, 0)
const cam = new ArcRotateCamera("wp-cine-cam", Math.PI * 0.7, 1.15, 26, focus.clone(), scene)
cam.fov = 0.62
cam.minZ = 0.5
cam.maxZ = 400
cam.inputs.clear()
scene.activeCamera = cam

const city = mountCity(scene, {
  layout,
  getCameraPos: () => cam.target, // stream around the framed point
  palette: worldScene.palette,
})

// Drive streaming each frame.
world.onFrame((dt) => city.update(dt))
// The engine's render loop drives `cinematic.update(followPos)` (the player pos
// in-game). This harness has no player, so feed the FRAMED point in as the
// follow target — that's what centers the player-local shadow frustum on what we
// shoot.
world.onFrame(() => world.setCameraTarget(cam.target, 0))

/* ---- shadow-caster registration: the seam game.ts will use ----
 * Opt streamed building/prop meshes in as casters; flag ground meshes as
 * receivers. We classify by name (ground/road/water/sky never cast) so the
 * shadow map stays cheap (only the upright town geometry).
 */
// Real streamed-city mesh names (verified): buildings `wp-building-*`, props
// `wp-city-prop-{species}-*` (thin-instance masters), grounds `wp-city-ground-*`.
const GROUND = /wp-city-ground|ground|road|plaza|flagstone|cobble/i
// The shadow-defining casters: merged building geometry + the structural prop
// species (one caster per thin-instance master covers all its instances). We opt
// EVERY building in, plus the props that visibly ground a town. The ground
// receives. This is exactly the seam game.ts will call per streamed mesh.
const CASTER_BUILDING = /wp-building|build|wall|roof|house|tower|chapel|bridge/i
const CASTER_PROP = /wp-city-prop-(tree|palm|lamp|stall|cart|bench|signpost|planter|kiosk|statue|fountain|boat)/i
let registered = 0
function registerCasters() {
  const ct = cam.target
  // Only register casters NEAR the framed point — the lead's real integration
  // registers per-near-chunk so the shadow frustum (auto-fit to casters) stays
  // tight and the map stays crisp + cheap. Mirror that here.
  const NEAR2 = 55 * 55
  for (const m of scene.meshes) {
    const mesh = m as AbstractMesh
    const n = mesh.name || ""
    if (GROUND.test(n)) {
      mesh.receiveShadows = true
      // ground compiled before the shadow generator existed → recompile WITH the
      // shadow sampler (the exact step game.ts must do when flagging receivers).
      mesh.material?.markAsDirty(2 /* MATERIAL_LightDirtyFlag */)
      continue
    }
    if (mesh.getTotalVertices() === 0) continue
    if (CASTER_BUILDING.test(n) || CASTER_PROP.test(n)) {
      const c = mesh.getBoundingInfo().boundingBox.centerWorld
      const dx = c.x - ct.x
      const dz = c.z - ct.z
      if (dx * dx + dz * dz > NEAR2) continue
      world.registerShadowCaster(mesh)
      registered++
    }
  }
}

let lastT = performance.now()
;(window as unknown as { __wpCine?: unknown }).__wpCine = {
  // CLOSE eye-level hero on a built block at the plaza's north edge: building
  // facades + their cast shadows fill the frame (close enough that the whole
  // neighborhood is fully streamed, no haze/streaming ambiguity).
  wide() {
    focus.set(0, 5, 46) // a building block ~46u north of plaza center
    cam.alpha = Math.PI * 1.5 // look straight north (+Z) at the facades
    cam.beta = 1.32 // slightly above eye-level
    cam.radius = 22
    cam.setTarget(focus.clone())
  },
  // low into the raking sun — long facade + ground shadows stretch toward the
  // camera; bloom on the sunlit roof ridges. Sun FROM (-0.42,-0.62,0.66).
  lowSun() {
    focus.set(0, 4, 44)
    cam.alpha = Math.PI * 1.34 // face back toward the sun azimuth (front-left)
    cam.beta = 1.44 // low → long raking shadows
    cam.radius = 20
    cam.setTarget(focus.clone())
  },
  // 3/4 over the built block to read how shadows GROUND each building.
  topish() {
    focus.set(0, 2, 44)
    cam.alpha = Math.PI * 1.4
    cam.beta = 0.92
    cam.radius = 40
    cam.setTarget(focus.clone())
  },
  // DETERMINISTIC hero: a FIXED world-space 3/4 looking down the +Z avenue toward
  // the building ring (~z 40-60 from the plaza). Same coords every call, so a
  // BEFORE/AFTER captured around it is a true apples-to-apples comparison (no
  // streaming-dependent re-aim). Streams around the look-at via setCameraTarget.
  fixedHero() {
    focus.set(6, 5, 50)
    cam.setPosition(new Vector3(-14, 13, 18)) // up + back-left, looking NE down the avenue
    cam.setTarget(focus.clone())
    world.setCameraTarget(focus.clone(), 0)
  },
  // BEFORE/AFTER: kill the whole cinematic look (post + shadows + IBL + key).
  setPipeline(on: boolean) {
    const c = world.cinematic
    c.rendering.imageProcessingEnabled = on
    c.rendering.bloomEnabled = on
    c.rendering.fxaaEnabled = on
    const sm = c.getShadowGenerator().getShadowMap()
    if (sm) sm.renderList = on ? sm.renderList : []
    c.sun.setEnabled(on)
    c.fill.setEnabled(on)
    // Restore the engine's basic flat lights so OFF looks like the old prototype.
    const hemi = scene.getLightByName("hemi")
    const baseSun = scene.getLightByName("sun")
    if (hemi) hemi.setEnabled(!on), (hemi.intensity = on ? 0.18 : 0.85)
    if (baseSun) baseSun.setEnabled(!on), (baseSun.intensity = on ? 0 : 0.5)
    scene.environmentIntensity = on ? 0.85 : 0
  },
  registerCasters() {
    registerCasters()
    return registered
  },
  ssao: () => world.cinematic.ssaoEnabled,
  // how many building meshes are actually in the scene (streaming health).
  builtCount: () => scene.meshes.filter((m) => /wp-building/i.test(m.name)).length,
  // Aim the camera at an ACTUAL streamed building cluster near the plaza edge,
  // from a low hero angle, so the frame is GUARANTEED to contain real facades +
  // their cast shadows (no guessing world coords / streaming ambiguity).
  frameHero(elevDeg = 14, dist = 20, faceSun = false) {
    const builds = scene.meshes.filter(
      (m) => /wp-building/i.test(m.name) && m.getTotalVertices() > 0 && m.isEnabled(),
    )
    if (!builds.length) return false
    // pick the building cluster nearest the plaza spawn (z≈12), so it's central +
    // fully streamed. Average a few near ones for a stable look-at.
    builds.sort((a, b) => {
      const pa = a.getBoundingInfo().boundingBox.centerWorld
      const pb = b.getBoundingInfo().boundingBox.centerWorld
      const da = pa.x * pa.x + (pa.z - 12) * (pa.z - 12)
      const db = pb.x * pb.x + (pb.z - 12) * (pb.z - 12)
      return da - db
    })
    const seed = builds[0].getBoundingInfo().boundingBox.centerWorld
    let cxp = 0, czp = 0, n = 0
    for (const b of builds) {
      const p = b.getBoundingInfo().boundingBox.centerWorld
      if (Math.hypot(p.x - seed.x, p.z - seed.z) < 18) { cxp += p.x; czp += p.z; n++ }
    }
    cxp /= n; czp /= n
    // Look AT the cluster a touch above its base.
    focus.set(cxp, 4, czp)
    // Place the camera at an explicit world offset. Default: stand toward the
    // PLAZA side of the cluster so we see the facades; faceSun: stand on the
    // sun-lit side so the cast shadows rake AWAY from camera across open cobble
    // (clearly readable). Sun comes FROM (-0.42,-0.62,0.66) → lit side is -X,+Z.
    let ox: number, oz: number
    if (faceSun) {
      // camera on the sunlit side, low → long shadows fall toward +X,-Z, visible.
      ox = -0.42, oz = 0.66
    } else {
      // camera between plaza-center and cluster, looking outward at the facades.
      const len = Math.hypot(cxp, czp) || 1
      ox = -cxp / len, oz = -czp / len
    }
    const olen = Math.hypot(ox, oz) || 1
    ox /= olen; oz /= olen
    const horiz = Math.cos((elevDeg * Math.PI) / 180) * dist
    const vert = Math.sin((elevDeg * Math.PI) / 180) * dist
    cam.setPosition(
      new Vector3(cxp + ox * horiz, 4 + vert, czp + oz * horiz),
    )
    cam.setTarget(focus.clone())
    return true
  },
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
