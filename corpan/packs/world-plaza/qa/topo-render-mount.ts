/**
 * TOPOLOGY RENDER MOUNT — renders a GENERATED topology through the REAL stylized
 * world look (`selectLook("stylized")` → buildRoads/bakeGround + buildings +
 * composition dressing), proving the generator's output is walkable + premium +
 * z-fight-free with the FROZEN composition.ts consumed UNCHANGED.
 *
 * The archetype + seed are read from the URL (?archetype=harbor&seed=1770). The
 * Scene skin is SYNTHESIZED at runtime (generated topologies ship no scene file):
 * a generic role→sprite map over the antigua palette, so every anchor dresses.
 *
 * Test hooks (window.__wpTopo): setTopDown/setGrazing/setWalk/pan/render — same
 * shape as road-flicker-mount so the harness can grab frames + screenshots.
 */
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera"
import { Vector3 } from "@babylonjs/core/Maths/math"
import { Scene as WorldSceneSchema, type RoomTopology } from "@world-plaza/contracts"
import { generateTopology, type LayoutArchetype, ALL_ARCHETYPES } from "../src/world/topologyGen"
import { createWorldEngine } from "../src/world/engine"
import { applyAtmosphere } from "../src/world/atmosphere"
import { selectLook } from "../src/render/worldLook"
import antiguaScene from "../content/scenes/antigua-grand.json"

const params = new URLSearchParams(location.search)
const archetype = (params.get("archetype") ?? "harbor") as LayoutArchetype
const seed = Number(params.get("seed") ?? 1770)
if (!ALL_ARCHETYPES.includes(archetype)) {
  console.error(`[wp/topo] unknown archetype "${archetype}", falling back to harbor`)
}

const { topology, stats } = generateTopology({
  archetype: ALL_ARCHETYPES.includes(archetype) ? archetype : "harbor",
  seed,
})
console.log(`[wp/topo] ${archetype} seed=${seed}:`, JSON.stringify(stats))

/* ---- synthesize a Scene skin over the generated topology ---- */
function synthScene(t: RoomTopology) {
  const palette = (antiguaScene as { palette?: Record<string, string> }).palette
  const anchorSkins: Record<string, { spriteRef: { url: string } }> = {}
  const npcSkins: Record<string, { spriteRef: { url: string }; voiceHint?: string }> = {}
  for (const a of t.anchors) {
    const url =
      a.kind === "fountain"
        ? "placeholder:fountain"
        : a.role === "bench"
          ? "placeholder:bench"
          : a.role === "portal"
            ? "placeholder:house"
            : a.role === "vendor"
              ? "placeholder:stall"
              : a.role === "npc_station"
                ? "placeholder:cafe"
                : "placeholder:lamp"
    anchorSkins[a.id] = { spriteRef: { url } }
    if (a.role === "vendor")
      npcSkins[a.id] = { spriteRef: { url: "placeholder:npc-vendor" }, voiceHint: "es-MX" }
    else if (a.role === "npc_station")
      npcSkins[a.id] = { spriteRef: { url: "placeholder:npc-resident" }, voiceHint: "es-ES" }
  }
  return WorldSceneSchema.parse({
    id: `synth-${archetype}`,
    topologyId: t.id,
    setting: { place: "Generated", era: "—", mood: `${archetype} layout` },
    themeId: "paper",
    narrativeBlurb: `A procedurally generated ${archetype} town.`,
    anchorSkins,
    npcSkins,
    palette,
    sky: { horizon: palette?.sky, fog: 0.5, timeOfDay: "day" },
  })
}

const worldScene = synthScene(topology)

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

const look = selectLook("stylized")
look.build(scene, topology, worldScene, world.onFrame)

const cam = new ArcRotateCamera("wp-topo-cam", Math.PI / 2, 1.2, 60, new Vector3(0, 0, 0), scene)
cam.fov = 0.7
cam.minZ = 0.1
cam.maxZ = 320
cam.inputs.clear()
scene.activeCamera = cam

function set(alpha: number, beta: number, radius: number, target: Vector3) {
  cam.alpha = alpha
  cam.beta = beta
  cam.radius = radius
  cam.setTarget(target)
}

// Hooks mirror road-flicker-mount EXACTLY (same camera setups + names) so the
// z-fight proof harness (qa/topo-flicker.mjs) can drive a GENERATED topology
// through the identical grazing/top-down pan-and-count test.
const hooks = {
  // road-flicker-shaped grazing/top-down probes over the SAME baked ground.
  setGrazingStreet() {
    set(Math.PI / 2, 1.46, 30, new Vector3(0, 0, 6))
  },
  setGrazingPlaza() {
    set(Math.PI * 0.5, 1.5, 16, new Vector3(0, 0, 0))
  },
  setTopDown() {
    set(Math.PI / 2, 0.001, 34, new Vector3(0, 0, 0))
  },
  setWalk() {
    set(Math.PI / 2, 1.4, 9, new Vector3(0, 0.2, 10))
  },
  // wide showcase shots for the render driver.
  setTopDownWide() {
    set(Math.PI / 2, 0.001, 150, new Vector3(0, 0, 0))
  },
  setHero() {
    set(Math.PI * 0.62, 1.05, 64, new Vector3(0, 0, 0))
  },
  pan(d: number) {
    cam.alpha += d
  },
  render() {
    scene.render()
  },
  ready: true,
}
;(window as unknown as { __wpTopo?: unknown; __wpRoad?: unknown }).__wpTopo = hooks
// also expose under __wpRoad so the road-flicker measurement harness works verbatim.
;(window as unknown as { __wpRoad?: unknown }).__wpRoad = hooks

world.start()
