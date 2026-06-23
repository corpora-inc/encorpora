/**
 * STORE-ICON HERO MOUNT.
 *
 * Renders a clean, premium HERO FRAME of Corpan City for the 512×512 store icon
 * — the REAL game look, no HUD/joystick/phone chrome:
 *
 *   • the REAL cinematic engine (`createWorldEngine`: golden-hour sun + contact
 *     shadows + IBL + ACES/bloom post) + the REAL streamed `mountCity` over the
 *     actual generated city (same path as game.ts), so it IS the game's world
 *     (real 3D buildings + procedural props);
 *   • a foreground HERO paper/bubble-person (the dressed player) standing on the
 *     plaza, plus a couple of ambient HD-2D paper-people for life — the
 *     signature character look;
 *   • an ArcRotate camera under test control framing a pretty plaza/skyline.
 *
 * Test hooks (window.__wpIcon):
 *   hero()            — the deterministic hero framing for the icon.
 *   heroAlt()         — a second framing (lower, more skyline).
 *   heroPlaza()       — a third framing (tighter on the hero + fountain).
 *   registerCasters() — opt streamed meshes + the hero figure into shadows.
 *   builtCount()      — streamed-building count (streaming health).
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
import { createCharacterFigure } from "../src/character/figure"
import { createAnimator } from "../src/character/animator"
import { avatarToCharacterSpec } from "../src/character/characterSpec"
import { generateCharacter, ANTIGUA_1770 } from "../src/character/characterGen"

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

const focus = new Vector3(0, 0, 0)
const cam = new ArcRotateCamera("wp-icon-cam", Math.PI * 0.7, 1.15, 26, focus.clone(), scene)
cam.fov = 0.62
cam.minZ = 0.5
cam.maxZ = 400
cam.inputs.clear()
scene.activeCamera = cam

const city = mountCity(scene, {
  layout,
  getCameraPos: () => cam.target,
  palette: worldScene.palette,
})

world.onFrame((dt) => city.update(dt))
world.onFrame(() => world.setCameraTarget(cam.target, 0))

/* ---------------------------------------------------------- hero + crowd --
 * The dressed PLAYER (the signature otter look) stands on the plaza near the
 * fountain, facing the camera. A couple of ambient HD-2D paper-people give the
 * frame life. The player is the hero of the icon.
 */
const playerSpec = avatarToCharacterSpec(
  {
    base: "body-1",
    layers: [
      { slot: "face", itemId: "skin-tan", tint: "#e8b887" },
      { slot: "hair", itemId: "hair-short", tint: "#3a2415" },
      { slot: "top", itemId: "top-tunic", tint: "#c0532f" },
      { slot: "bottom", itemId: "bottom-trouser", tint: "#2f3d57" },
    ],
    palette: { skin: "#e8b887", hair: "#3a2415" },
  },
  "player-local",
)

// HERO — the player, the important character → the shipping 3D "bubble person".
const hero = createCharacterFigure(scene, playerSpec, { pickTag: "hero", look: "bubble3d" })
const heroAnim = createAnimator(hero, playerSpec)
heroAnim.setState("idle")

// A small ambient crowd — paper HD-2D townsfolk (cutout) for life in the plaza.
const crowdSpecs = [
  generateCharacter("baker", "antigua-7", ANTIGUA_1770),
  generateCharacter("vendor", "antigua-41", ANTIGUA_1770),
  generateCharacter("", "antigua-22", ANTIGUA_1770),
]
const crowd = crowdSpecs.map((spec, i) => {
  const fig = createCharacterFigure(scene, spec, { pickTag: `npc${i}`, look: "cutout" })
  const anim = createAnimator(fig, spec)
  anim.setState(i === 1 ? "talk" : "idle")
  if (i === 1) anim.talk(true)
  return { fig, anim }
})

// Animate idle breathing/talk so the frame isn't stiff.
world.onFrame((dt) => {
  heroAnim.update(dt)
  for (const c of crowd) c.anim.update(dt)
})

/* ---- shadow-caster registration (same classification as cinematic) ---- */
const GROUND = /wp-city-ground|ground|road|plaza|flagstone|cobble/i
const CASTER_BUILDING = /wp-building|build|wall|roof|house|tower|chapel|bridge/i
const CASTER_PROP = /wp-city-prop-(tree|palm|lamp|stall|cart|bench|signpost|planter|kiosk|statue|fountain|boat)/i
let registered = 0
function registerCasters() {
  const ct = cam.target
  const NEAR2 = 60 * 60
  for (const m of scene.meshes) {
    const mesh = m as AbstractMesh
    const n = mesh.name || ""
    if (GROUND.test(n)) {
      mesh.receiveShadows = true
      mesh.material?.markAsDirty(2)
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
  // The hero + crowd cast shadows too (grounds them on the plaza).
  for (const m of hero.root.getChildMeshes() as AbstractMesh[]) world.registerShadowCaster(m)
  for (const c of crowd) for (const m of c.fig.root.getChildMeshes() as AbstractMesh[]) world.registerShadowCaster(m)
}

;(window as unknown as { __wpIcon?: unknown }).__wpIcon = {
  // DETERMINISTIC ICON HERO: low 3/4 with the camera in FRONT of the hero on
  // the +Z side, looking back across the plaza toward the dense building ring at
  // -Z. The dressed player stands center-foreground FACING the camera (rot.y=0,
  // the documented camera-facing pose); a talking vendor + two strollers fill in
  // behind. Same coords every call. The city streams toward -Z (behind hero).
  hero() {
    // Hero centered, fully in frame with headroom; camera in front (+Z) at a
    // gentle 3/4 so we read the figure's face AND the city ring behind.
    hero.setGroundPos(0.0, 5.0)
    hero.setHeading?.(-0.28) // face +Z toward camera, turned a touch for a 3/4 read
    crowd[0].fig.setGroundPos(-4.2, 0.5) // companion at left, mid-ground
    crowd[0].fig.setHeading?.(-Math.PI * 0.1)
    crowd[1].fig.setGroundPos(4.6, 1.5) // talking vendor at right
    crowd[1].fig.setHeading?.(Math.PI * 0.25)
    crowd[2].fig.setGroundPos(0.4, -3.0) // stroller deeper in
    crowd[2].fig.setHeading?.(0.2)
    focus.set(0.0, 1.9, 4.0) // aim a touch lower so the hero's feet clear the frame
    cam.setPosition(new Vector3(-3.2, 3.7, 15.6)) // low, slightly left, in front, a bit further back
    cam.setTarget(focus.clone())
    world.setCameraTarget(new Vector3(0.0, 0, -10), 0) // stream the city behind the hero
  },
  // ALT — a touch higher + wider, more skyline + buildings, hero smaller.
  heroAlt() {
    hero.setGroundPos(1.0, 6.0)
    hero.setHeading?.(0)
    crowd[0].fig.setGroundPos(-3.6, 1.5)
    crowd[0].fig.setHeading?.(-Math.PI * 0.15)
    crowd[1].fig.setGroundPos(4.6, 2.5)
    crowd[1].fig.setHeading?.(Math.PI * 0.2)
    crowd[2].fig.setGroundPos(-1.6, -1.5)
    crowd[2].fig.setHeading?.(0)
    focus.set(0.4, 2.6, -1.0)
    cam.setPosition(new Vector3(-7.5, 5.6, 15.5))
    cam.setTarget(focus.clone())
    world.setCameraTarget(new Vector3(0.4, 0, -14), 0)
  },
  // PLAZA — tighter, near-portrait of the hero, warm, city softly behind.
  heroPlaza() {
    hero.setGroundPos(0.0, 5.0)
    hero.setHeading?.(-0.3)
    crowd[0].fig.setGroundPos(-3.2, 0.5)
    crowd[0].fig.setHeading?.(-Math.PI * 0.1)
    crowd[1].fig.setGroundPos(3.6, 1.5)
    crowd[1].fig.setHeading?.(Math.PI * 0.25)
    crowd[2].fig.setGroundPos(0.4, -3.0)
    crowd[2].fig.setHeading?.(0.2)
    focus.set(0.0, 2.2, 4.2)
    cam.setPosition(new Vector3(-2.4, 2.9, 11.5))
    cam.setTarget(focus.clone())
    world.setCameraTarget(new Vector3(0.0, 0, -8), 0)
  },
  registerCasters() {
    registerCasters()
    return registered
  },
  builtCount: () => scene.meshes.filter((m) => /wp-building/i.test(m.name)).length,
  render() {
    scene.render()
  },
  ready: true,
}

// Initial placement so the city streams around the hero from frame 0.
;(window as unknown as { __wpIcon: { hero: () => void } }).__wpIcon.hero()

world.start()
