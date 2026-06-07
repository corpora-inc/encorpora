/**
 * charcloseup — a dedicated CHARACTER CRAFT harness. Mounts a row of
 * `create3DFigure` characters under a controllable ArcRotate camera + soft
 * daylight (hemi + directional, matching the world engine), and drives each
 * figure's animator through idle/walk/talk so the seam, proportions, and
 * animation can be inspected from a TRUE front shot and grazing/3-4/back angles.
 *
 * Exposes `window.__charCam` so the playwright driver can snap clean,
 * repeatable angles without fighting the game's follow camera.
 */
import { Engine } from "@babylonjs/core/Engines/engine"
import { Scene } from "@babylonjs/core/scene"
import { Color3, Color4, Vector3 } from "@babylonjs/core/Maths/math"
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera"
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight"
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import "@babylonjs/core/Materials/standardMaterial"
import { create3DFigure } from "../src/character/figure3d"
import { createAnimator } from "../src/character/animator"
import { generateCharacter, ANTIGUA_1770 } from "../src/character/characterGen"
import { avatarToCharacterSpec } from "../src/character/characterSpec"

const canvas = document.createElement("canvas")
canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%"
document.body.appendChild(canvas)
document.body.style.cssText = "margin:0;height:100%;overflow:hidden;background:#cfe6ee"

const engine = new Engine(canvas, true, { antialias: true })
const scene = new Scene(engine)
scene.clearColor = new Color4(0.81, 0.9, 0.93, 1)

const camera = new ArcRotateCamera("cam", -Math.PI / 2, Math.PI / 2.35, 7, new Vector3(0, 1.2, 0), scene)
camera.minZ = 0.05
camera.wheelDeltaPercentage = 0.02
camera.attachControl(canvas, true)

// Daylight identical-in-spirit to the world engine.
const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene)
hemi.intensity = 0.85
hemi.diffuse = new Color3(1, 0.98, 0.92)
hemi.groundColor = new Color3(0.5, 0.46, 0.4)
const sun = new DirectionalLight("sun", new Vector3(-0.4, -1, 0.35), scene)
sun.intensity = 0.9
sun.diffuse = new Color3(1, 0.96, 0.86)

// ground
const ground = MeshBuilder.CreateGround("g", { width: 30, height: 30 }, scene)
const gmat = new StandardMaterial("gmat", scene)
gmat.diffuseColor = new Color3(0.78, 0.72, 0.6)
gmat.specularColor = new Color3(0, 0, 0)
ground.material = gmat

// The PLAYER spec (the dressed otter from other harnesses) + a few NPCs.
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

const specs = [
  playerSpec,
  generateCharacter("baker", "antigua-7", ANTIGUA_1770),
  generateCharacter("", "antigua-22", ANTIGUA_1770),
  generateCharacter("vendor", "antigua-41", ANTIGUA_1770),
  generateCharacter("", "antigua-88", ANTIGUA_1770),
]

const animators: ReturnType<typeof createAnimator>[] = []
const states: ("idle" | "walk" | "talk")[] = ["idle", "walk", "talk", "idle", "walk"]

specs.forEach((spec, i) => {
  const fig = create3DFigure(scene, spec, { pickTag: `c${i}` })
  const x = (i - (specs.length - 1) / 2) * 1.9
  fig.setGroundPos(x, 0, 0)
  const anim = createAnimator(fig, spec)
  const st = states[i]
  anim.setState(st)
  if (st === "walk") anim.setSpeed(0.8)
  if (st === "talk") anim.talk(true)
  animators.push(anim)
})

let last = performance.now()
engine.runRenderLoop(() => {
  const now = performance.now()
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  for (const a of animators) a.update(dt)
  scene.render()
})
window.addEventListener("resize", () => engine.resize())

// Camera control hook for the driver.
;(window as unknown as { __charCam?: unknown }).__charCam = {
  set(alpha: number, beta: number, radius: number, ty = 1.2, tx = 0) {
    // setTarget() RESETS radius (Babylon ArcRotate gotcha) — so target FIRST,
    // then alpha/beta/radius, so the requested framing actually sticks.
    camera.setTarget(new Vector3(tx, ty, 0))
    camera.alpha = alpha
    camera.beta = beta
    camera.radius = radius
  },
  ready: true,
}

