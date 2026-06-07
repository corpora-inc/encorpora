/**
 * BEACON PROOF MOUNT — the objective beacon over a single character, in a clean
 * scene (no city, no population, no camera-fade), so we can screenshot the marker
 * design in isolation. Proves the beacon is a designed warm-accent marker (pin +
 * chevron + halo + ring), not a transparent white pillar.
 */
import { Vector3, Color3, Color4 } from "@babylonjs/core/Maths/math"
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera"
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Engine } from "@babylonjs/core/Engines/engine"
import { Scene } from "@babylonjs/core/scene"
import { createGroundedCutout } from "../src/render/cutout"
import { CHAR_TEX } from "../src/character/characterArt"
import { createObjectiveBeacon } from "../src/wayfinding/objectiveBeacon"

const canvas = document.getElementById("c") as HTMLCanvasElement
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })
const scene = new Scene(engine)
scene.clearColor = new Color4(0.78, 0.86, 0.78, 1) // warm-neutral daylight

const cam = new ArcRotateCamera("cam", Math.PI / 2.2, Math.PI / 2.6, 11, new Vector3(0, 2.6, 0), scene)
cam.attachControl(canvas, true)
new HemisphericLight("h", new Vector3(0.3, 1, 0.2), scene)

// a simple ground so the ring + character shadow read.
const ground = MeshBuilder.CreateGround("g", { width: 30, height: 30 }, scene)
const gm = new StandardMaterial("gm", scene)
gm.diffuseColor = new Color3(0.62, 0.55, 0.45)
gm.specularColor = new Color3(0, 0, 0)
ground.material = gm

// one character cutout = the objective NPC the beacon marks.
const cut = createGroundedCutout(scene, {
  w: CHAR_TEX.w,
  h: CHAR_TEX.h,
  draw: (ctx, w, h) => {
    // a plain warm paper-person silhouette so the beacon is the hero.
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = "#c98a5a"
    ctx.beginPath()
    ctx.roundRect(w * 0.32, h * 0.18, w * 0.36, h * 0.7, 14)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(w * 0.5, h * 0.2, w * 0.13, 0, Math.PI * 2)
    ctx.fillStyle = "#e0a878"
    ctx.fill()
  },
})
cut.setGroundPos(0, 0)
cut.pickMesh.isPickable = false

const beacon = createObjectiveBeacon(scene, {
  getTarget: () => ({ x: 0, z: 0 }),
  accent: "#e8a13c",
})

scene.onBeforeRenderObservable.add(() => beacon.update(engine.getDeltaTime() / 1000))
engine.runRenderLoop(() => scene.render())
addEventListener("resize", () => engine.resize())

// expose a render hook for the harness.
;(window as unknown as { __wpBeacon?: () => void }).__wpBeacon = () => scene.render()
