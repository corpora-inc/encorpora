/**
 * CAMERA & VISTA PROOF MOUNT.
 *
 * Boots the REAL createWorldEngine() follow camera (NOT a friendly test camera),
 * the REAL stylized world look, the REAL applyAtmosphere() sky+fog, and the REAL
 * createVista() landmark — exactly as game.ts wires them. The Playwright harness
 * drives the camera through the SAME setCameraTarget() path the movement
 * controller uses, so what we screenshot is what the player sees.
 *
 * Test hooks (window.__wpCam):
 *   place(x, z, yaw)  — put the "player" at (x,0,z) facing yaw; the follow cam
 *                       eases toward it. Returns immediately; call settle().
 *   settle(frames)    — render N frames so the follow lerp converges.
 *   setLandmark(kind) — rebuild the vista with a given kind (mount-fuji,
 *                       cathedral, eiffel, skyline, volcano) + a night flag.
 *   camY()            — current camera eye height (proves "low").
 *   freeLook(x,y,z,az) — park a controlled cruise-style camera (parallax proof).
 *   fps()             — engine fps (perf budget).
 *   render()          — force one render.
 */
import { Vector3 } from "@babylonjs/core/Maths/math"
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera"
import { RoomTopology, Scene as WorldSceneSchema } from "@corpan-city/contracts"
import topologyJson from "../content/topologies/plaza-grand.json"
import sceneJson from "../content/scenes/antigua-grand.json"
import { createWorldEngine } from "../src/world/engine"
import { applyAtmosphere, type SkyLook } from "../src/world/atmosphere"
import { createVista, type LandmarkLook } from "../src/world/vista"
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

// REAL engine + REAL follow camera (low cruise rig defaults).
const world = createWorldEngine(canvas, overlay, { skyColor: worldScene.palette?.sky })
const scene = world.scene

// Day sky look (warm Antigua) by default; setLandmark can flip to night.
let skyLook: SkyLook = { timeOfDay: "day" }
let atmo = applyAtmosphere(scene, worldScene.palette, world.onFrame, skyLook)

// Real world look (roads → baked ground → buildings → dressing).
const look = selectLook("stylized")
look.build(scene, topology, worldScene, world.onFrame)

// Default landmark on the horizon the follow camera looks toward. The follow
// controller's yaw=0 faces -Z (forward = (-sin,-cos)), so the player looks down
// -Z and the landmark lives at azimuth=π (-Z). Hero scale.
const FACING_AZ = Math.PI
let vista = createVista(scene, { kind: "mount-fuji", azimuth: FACING_AZ, scale: 1 })

world.start()

const place = (x: number, z: number, yaw: number) => {
  world.setCameraTarget(new Vector3(x, 0, z), yaw)
}

const render = () => scene.render()

const settle = (frames: number) => {
  for (let i = 0; i < frames; i++) scene.render()
}

const setLandmark = (look: Partial<LandmarkLook> & { kind: string }, sky?: SkyLook) => {
  vista?.dispose()
  if (sky) {
    atmo.dispose()
    skyLook = sky
    atmo = applyAtmosphere(scene, worldScene.palette, world.onFrame, skyLook)
  }
  vista = createVista(scene, { azimuth: FACING_AZ, scale: 1, ...look })
}


// A SEPARATE, fully-controlled camera for the parallax PROOF. The engine keeps
// repositioning world.camera every frame; by making THIS camera active, the
// follow loop can't clobber our controlled pose. Mirrors the real cruise rig
// (same low-ish eye + flat gaze) but lets us park it precisely + slide it.
const freeCam = new UniversalCamera("wp-freecam", new Vector3(0, 6, 0), scene)
freeCam.fov = world.camera.fov
freeCam.minZ = world.camera.minZ
freeCam.maxZ = world.camera.maxZ
freeCam.inputs.clear()

// eyeX/eyeZ = camera position; look toward azimuth `az` at a slightly-up target
// so the horizon sits mid-frame and a grounded landmark rises above it.
const freeLook = (eyeX: number, eyeY: number, eyeZ: number, az: number) => {
  scene.activeCamera = freeCam
  freeCam.position.set(eyeX, eyeY, eyeZ)
  freeCam.setTarget(new Vector3(eyeX + Math.sin(az) * 200, eyeY + 6, eyeZ + Math.cos(az) * 200))
}
const useFollowCam = () => {
  scene.activeCamera = world.camera
}

// Toggle building visibility so we can confirm the landmark is on the horizon
// even before Agent B opens up the (currently dense) map.
const hideTown = (hide: boolean) => {
  // Hide everything EXCEPT the sky dome, the vista landmark, and the ground, so
  // the landmark is isolated on the horizon for an unambiguous proof shot.
  for (const m of scene.meshes) {
    const n = m.name
    if (n.includes("dome") || n.startsWith("wp-vista") || n.includes("ground")) continue
    m.setEnabled(!hide)
  }
}

;(window as unknown as { __wpCam?: unknown }).__wpCam = {
  ready: true,
  place,
  settle,
  setLandmark,
  freeLook,
  useFollowCam,
  hideTown,
  render,
  camY: () => world.camera.position.y,
  fps: () => world.engine.getFps(),
  debug: () => {
    if (!vista) return { vista: null }
    const m = vista.root
    return {
      pos: m.position.asArray(),
      enabled: m.isEnabled(),
      visibility: m.visibility,
      inFrustum: scene.activeCamera ? scene.activeCamera.isInFrustum(m) : null,
      activeCam: scene.activeCamera?.name,
      matAlpha: (m.material as any)?.alpha,
      boundingMax: m.getBoundingInfo().boundingBox.maximumWorld.asArray(),
    }
  },
}
