/**
 * Standalone visual preview for src/world/dressing.ts.
 *
 * Builds a minimal "plaza-grand"-shaped topology (a fountain square ringed by
 * buildings, with streets, benches, vendors, portals and a couple of street
 * gaps for bunting), a flat checker ground, an orbit camera, daylight, and then
 * calls dressWorld() exactly as the orchestrator will. Open at
 *   http://localhost:5174/qa/preview-dressing.html
 * Drag to orbit; the camera also auto-orbits so a headless screenshot at any
 * moment shows the dressed town.
 */
import { Engine } from "@babylonjs/core/Engines/engine"
import { Scene } from "@babylonjs/core/scene"
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera"
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight"
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture"
import { Color3, Color4, Vector3 } from "@babylonjs/core/Maths/math"
import "@babylonjs/core/Materials/standardMaterial"
import type { RoomTopology } from "@world-plaza/contracts"
import { dressWorld } from "../src/world/dressing"
import grandTopology from "../content/topologies/plaza-grand.json"

const canvas = document.getElementById("c") as HTMLCanvasElement
const engine = new Engine(canvas, true, { antialias: true })
const scene = new Scene(engine)
scene.clearColor = new Color4(0.75, 0.88, 0.91, 1)

const cam = new ArcRotateCamera("cam", Math.PI / 2.4, Math.PI / 3.1, 34, new Vector3(0, 1, 0), scene)
cam.attachControl(canvas, true)
cam.lowerRadiusLimit = 10
cam.upperRadiusLimit = 70

const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene)
hemi.intensity = 0.9
hemi.diffuse = new Color3(1, 0.98, 0.92)
hemi.groundColor = new Color3(0.5, 0.46, 0.4)
const sun = new DirectionalLight("sun", new Vector3(-0.4, -1, 0.3), scene)
sun.intensity = 0.5

// checker ground
const gtex = new DynamicTexture("g", { width: 256, height: 256 }, scene, false)
const gctx = gtex.getContext() as unknown as CanvasRenderingContext2D
for (let y = 0; y < 8; y++)
  for (let x = 0; x < 8; x++) {
    gctx.fillStyle = (x + y) % 2 ? "#cdb892" : "#d9c7a3"
    gctx.fillRect(x * 32, y * 32, 32, 32)
  }
gtex.update()

const params = new URLSearchParams(location.search)
const useGrand = params.get("grand") === "1"

// ---- sample topology (mini "plaza-grand") OR the real big map (?grand=1) ----
const sampleTopology: RoomTopology = {
  id: "plaza-grand",
  bounds: { minX: -26, maxX: 26, minZ: -26, maxZ: 26 },
  spawns: [{ x: 0, z: 10 }],
  blockers: [
    // ring of shops around the square, with street gaps between some
    { x: -10, z: -12, w: 6, d: 5 },
    { x: -1, z: -14, w: 6, d: 5 },
    { x: 9, z: -12, w: 6, d: 5 },
    { x: 15, z: -2, w: 5, d: 6 },
    { x: 15, z: 8, w: 5, d: 6 },
    { x: -15, z: -2, w: 5, d: 6 },
    { x: -15, z: 8, w: 5, d: 6 },
    { x: -9, z: 16, w: 6, d: 5 },
    { x: 4, z: 17, w: 6, d: 5 },
    // fountain plinth blocker (decor — not a building)
    { x: 0, z: 0, w: 5, d: 5 },
  ],
  anchors: [
    { id: "fountain", role: "decor", x: 0, z: 0 },
    { id: "bench-a", role: "bench", x: -6, z: 4, facing: 0 },
    { id: "bench-b", role: "bench", x: 6, z: 4, facing: Math.PI },
    { id: "vendor-fruit", role: "vendor", x: -8, z: -5, facing: 1.2 },
    { id: "vendor-cloth", role: "vendor", x: 8, z: -5, facing: -1.2 },
    { id: "cafe", role: "npc_station", x: -15, z: 8, facing: 1.57 },
    { id: "tailor", role: "npc_station", x: 15, z: 8, facing: -1.57 },
    { id: "door-north", role: "portal", x: -1, z: -11, facing: 0 },
    { id: "door-west", role: "portal", x: -12, z: 8, facing: 1.57 },
  ],
}

const topology = (useGrand ? (grandTopology as RoomTopology) : sampleTopology)

// ground sized to the topology bounds
const span = Math.max(topology.bounds.maxX - topology.bounds.minX, topology.bounds.maxZ - topology.bounds.minZ) + 8
;(gtex as unknown as { uScale: number; vScale: number }).uScale = span / 7.5
;(gtex as unknown as { uScale: number; vScale: number }).vScale = span / 7.5
const ground = MeshBuilder.CreateGround("ground", { width: span, height: span }, scene)
const gmat = new StandardMaterial("gmat", scene)
gmat.diffuseTexture = gtex
gmat.specularColor = new Color3(0, 0, 0)
ground.material = gmat
cam.radius = span * 0.62

// render the building blockers as simple boxes (the real buildings come from
// another agent; here we just want collision context for placement).
const wallMat = new StandardMaterial("wall", scene)
wallMat.diffuseColor = Color3.FromHexString("#e7d4ad")
wallMat.specularColor = new Color3(0, 0, 0)
const roofMat = new StandardMaterial("roof", scene)
roofMat.diffuseColor = Color3.FromHexString("#c46b4a")
roofMat.specularColor = new Color3(0, 0, 0)
for (const b of topology.blockers) {
  if (b.x === 0 && b.z === 0) continue // fountain handled by dressing
  const wall = MeshBuilder.CreateBox("b", { width: b.w, height: 3.2, depth: b.d }, scene)
  wall.position.set(b.x, 1.6, b.z)
  wall.material = wallMat
  const roof = MeshBuilder.CreateBox("r", { width: b.w + 0.6, height: 0.55, depth: b.d + 0.6 }, scene)
  roof.position.set(b.x, 3.5, b.z)
  roof.material = roofMat
}

const lean = new URLSearchParams(location.search).get("lean") === "1"

const onFrameCbs = new Set<(dt: number) => void>()
const onFrame = (cb: (dt: number) => void) => {
  onFrameCbs.add(cb)
  return () => onFrameCbs.delete(cb)
}

const dressing = dressWorld(scene, topology, {
  palette: { stone: "#bcc3bd", accent: "#c46b4a" },
  onFrame,
  seed: 1770,
  lean,
})

// expose counts for the harness
const instanceTotal = scene.meshes.reduce((n, m) => {
  const c = (m as unknown as { thinInstanceCount?: number }).thinInstanceCount ?? 0
  return n + (c > 0 ? c : 0)
}, 0)
;(window as unknown as { __wpDressing: unknown }).__wpDressing = {
  meshes: scene.meshes.length,
  thinInstances: instanceTotal,
  dispose: () => dressing.dispose(),
}

let auto = true
canvas.addEventListener("pointerdown", () => (auto = false))
engine.runRenderLoop(() => {
  const dt = Math.min(engine.getDeltaTime() / 1000, 0.05)
  for (const cb of onFrameCbs) cb(dt)
  if (auto) cam.alpha += dt * 0.15
  scene.render()
})
window.addEventListener("resize", () => engine.resize())
