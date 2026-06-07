/**
 * QA harness for #59 — camera near/under MARKET STALLS + awnings (the FAILING
 * scenario, not open ground). Mounts the real engine, a cluster of thin-instanced
 * market stalls (as the city builds them) + a couple of buildings, a bright player
 * marker, and lets the screenshotter jam the camera INTO a stall roof and assert
 * the player stays visible (the boom pulls out + occluders fade).
 */
import { Vector3, Color3, Matrix, Quaternion } from "@babylonjs/core/Maths/math"
import { Scene as WorldSceneSchema } from "@corpan-city/contracts"
import sceneJson from "../content/scenes/antigua-grand.json"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import "@babylonjs/core/Meshes/thinInstanceMesh"
import { createWorldEngine } from "../src/world/engine"
import { applyAtmosphere } from "../src/world/atmosphere"
import { createCameraFade } from "../src/world/cameraFade"
import { isCameraOccluder as isOcc } from "../src/world/cameraOcclusion"
import { createBuildings, type Blocker } from "../src/world/buildings"
import { buildStall, resolvePropPalette } from "../src/world/props3d"
import { MaterialLibrary } from "../src/render/materials"

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

// A GROUND plane so the shot reads like the real world (without it the camera
// stares at bare sky and there's no horizon to anchor the scene). Named with the
// ground prefix so `isCameraOccluder` correctly ignores it.
const ground = MeshBuilder.CreateGround("wp-city-ground-qa", { width: 120, height: 120 }, scene)
const gMat = new StandardMaterial("wp-city-ground-qa-mat", scene)
gMat.diffuseColor = Color3.FromHexString("#b9a487")
gMat.specularColor = Color3.Black()
ground.material = gMat
ground.position.y = 0

// A TALL building directly BEHIND the player (in the camera's trail at +z) so the
// follow camera would sit INSIDE it without the boom — the failing scenario — plus
// flanking ones for context.
const blockers: Blocker[] = [
  { x: 0, z: 16, w: 12, d: 10 }, // the one the camera trails into
  { x: -12, z: 10, w: 7, d: 6 },
  { x: 12, z: 10, w: 7, d: 6 },
]
createBuildings(scene, blockers, { palette: worldScene.palette, materials: lib })

// MARKET STALLS — thin-instanced exactly as the city does. A dense row BEHIND the
// player (at +z) so the follow camera (which trails the player at +z when facing
// yaw=0) wants to sit INSIDE a stall — the exact failing scenario. Plus stalls
// around for context.
const pal = resolvePropPalette(worldScene.palette as Record<string, string>)
const stallMaster = buildStall(scene, pal)
stallMaster.setEnabled(false)
const stallClone = stallMaster.clone("wp-city-prop-stall-0,0", null) as Mesh
stallClone.makeGeometryUnique?.()
stallClone.setEnabled(true)
const spots: [number, number][] = [[-3, 9], [0, 9], [3, 9], [-3, 12], [0, 12], [3, 12]]
const buf = new Float32Array(spots.length * 16)
spots.forEach(([x, z], i) =>
  Matrix.Compose(new Vector3(1, 1, 1), Quaternion.RotationAxis(Vector3.Up(), 0), new Vector3(x, 0, z)).copyToArray(buf, i * 16),
)
stallClone.thinInstanceSetBuffer("matrix", buf, 16, true)
stallClone.thinInstanceRefreshBoundingInfo(false)

// a bright player marker.
const pMat = new StandardMaterial("wp-cut-player", scene) // wp-cut-* = excluded from occluders
pMat.emissiveColor = Color3.FromHexString("#e0392b")
pMat.disableLighting = true
const player = MeshBuilder.CreateCylinder("wp-cut-player-body", { height: 1.8, diameter: 0.7 }, scene)
player.material = pMat
let px = 0, pz = 5 // just in front of the stall row at z=9 (camera trails into it)
player.position.set(px, 0.9, pz)

const cameraFade = createCameraFade(scene, world.camera, () => ({ x: px, z: pz }))
world.onFrame(() => cameraFade.update(0.016))
world.start()

;(window as unknown as { __wpCam: unknown }).__wpCam = {
  // move the player + drive the follow cam (yaw faces the camera toward the stalls)
  setPlayer: (x: number, z: number, yaw: number) => {
    px = x; pz = z
    player.position.set(x, 0.9, z)
    world.setCameraTarget(new Vector3(x, 0, z), yaw)
  },
  camY: () => world.camera.globalPosition.y,
  // DIRECT measure of "camera buried in opaque geometry" (#59): is the camera eye
  // inside ANY occluder's world AABB (a small skin)? Must be FALSE always.
  insideOccluder: () => {
    const eye = world.camera.globalPosition
    const SKIN = 0.3
    for (const m of scene.meshes) {
      if (!isOcc(m)) continue
      const bb = m.getBoundingInfo().boundingBox
      const lo = bb.minimumWorld, hi = bb.maximumWorld
      if (
        eye.x >= lo.x - SKIN && eye.x <= hi.x + SKIN &&
        eye.y >= lo.y - SKIN && eye.y <= hi.y + SKIN &&
        eye.z >= lo.z - SKIN && eye.z <= hi.z + SKIN
      ) return { inside: true, mesh: m.name, eyeY: +eye.y.toFixed(2) }
    }
    return { inside: false, eyeY: +eye.y.toFixed(2) }
  },
  // diagnostic: report eye, the player's projected screen pixel, and the
  // visibility of every stall / building (so we can see the fade dissolve them).
  probe: () => {
    const eye = world.camera.globalPosition
    const w = canvas.width, h = canvas.height
    const sp = Vector3.Project(
      new Vector3(px, 0.9, pz),
      Matrix.Identity(),
      scene.getTransformMatrix(),
      world.camera.viewport.toGlobal(w, h),
    )
    const occ: Array<{ n: string; vis: number; ti: number }> = []
    for (const m of scene.meshes) {
      if (/stall|building/.test(m.name))
        occ.push({ n: m.name, vis: +m.visibility.toFixed(2), ti: (m as Mesh).thinInstanceCount ?? -1 })
    }
    return {
      eye: { x: +eye.x.toFixed(2), y: +eye.y.toFixed(2), z: +eye.z.toFixed(2) },
      player: { x: px, z: pz },
      playerScreen: { x: Math.round(sp.x), y: Math.round(sp.y), w, h },
      occ,
    }
  },
}
