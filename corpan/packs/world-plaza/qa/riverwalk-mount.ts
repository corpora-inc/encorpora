/**
 * QA harness for the RIVERWALK dressing (src/world/riverwalk.ts) — task #31's
 * visual half. Mounts the REAL streaming city ground (so the baked water +
 * cobble bank are present) under the REAL createWorldEngine lighting + warm
 * atmosphere, then lays the `buildRiverwalk` balustrade + richer water + lamps/
 * bollards along the +Z waterfront edge, EXACTLY as game.ts will. Exposes window
 * hooks so the Playwright screenshotter can frame the quay from a few angles.
 *
 * Edge data is read from `layout.water` (the canonical CityWater seam world-fix/
 * places added) with a graceful fallback to the bridge_n/harbor anchors so the
 * harness still renders if `water` isn't populated yet.
 */
import { Vector3 } from "@babylonjs/core/Maths/math"
import { Scene as WorldSceneSchema } from "@world-plaza/contracts"
import sceneJson from "../content/scenes/antigua-grand.json"
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera"
import { createWorldEngine } from "../src/world/engine"
import { applyAtmosphere } from "../src/world/atmosphere"
import { generateCity, mountCity } from "../src/city"
import { buildRiverwalk } from "../src/world/riverwalk"

const qs = new URLSearchParams(location.search)
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
if (qs.get("noatmo") !== "1") applyAtmosphere(scene, worldScene.palette, world.onFrame)

const palette = worldScene.palette as Record<string, string> | undefined

// generateCity is world-fix's domain and can throw mid-edit; guard it so the
// riverwalk (this domain) can always be verified. Fallback bounds mirror the
// generator's WORLD_SIZE/waterZ so the framing is realistic without it.
type Layout = ReturnType<typeof generateCity>
let layout: Layout
try {
  layout = generateCity()
} catch (e) {
  console.error("[qa/riverwalk] generateCity threw — using fallback layout:", e)
  const half = 380
  layout = {
    bounds: { minX: -half, maxX: half, minZ: -half, maxZ: half },
    anchors: [],
  } as unknown as Layout
}

const water = (layout as unknown as { water?: { waterZ: number; bankZ: number; farBankZ?: number; bridgeX: number; bridgeHalfW: number } }).water
const bridge = layout.anchors.find((a) => a.id === "bridge_n")
const harbor = layout.anchors.find((a) => a.id === "harbor")
const edgeZ = water?.waterZ ?? bridge?.z ?? layout.bounds.maxZ - 70
const farEdgeZ = water?.farBankZ
const gapX = water?.bridgeX ?? bridge?.x ?? 0
const gapHalf = water?.bridgeHalfW ?? 6

// ?city=1 mounts the REAL streaming city for in-context shots; default OFF so the
// riverwalk geometry can be verified deterministically without depending on the
// city generator (world-fix's domain, which is sometimes mid-edit and throws).
const useCity = qs.get("city") === "1"
let camPos = new Vector3(0, 1.5, edgeZ - 14)
const city = useCity
  ? mountCity(scene, { layout, getCameraPos: () => camPos, palette })
  : null

// drive the streaming build aggressively at boot so the waterfront is present.
// RESILIENCE: even with ?city=1 the generator can throw mid-edit; we catch + log
// loudly (never silent — repo rule) and fall back to the flat ground below.
let warm = 0
let cityOk = !!city
world.onFrame((dt: number) => {
  if (cityOk && city) {
    try {
      for (let i = 0; i < 8; i++) city.update(dt)
    } catch (e) {
      cityOk = false
      console.error("[qa/riverwalk] city.update threw — falling back to flat ground:", e)
    }
  }
  warm += dt
})

// Fallback PROMENADE + far-water context plane so the riverwalk is never floating
// in void if the city stream breaks (it sits UNDER the baked city ground at y=-0.02
// so it's hidden whenever the real ground is present). Cobble-toned for the quay.
{
  const { MeshBuilder } = await import("@babylonjs/core/Meshes/meshBuilder")
  const { StandardMaterial } = await import("@babylonjs/core/Materials/standardMaterial")
  const { Color3 } = await import("@babylonjs/core/Maths/math")
  const land = MeshBuilder.CreateGround("qa-fallback-land", { width: 900, height: 200 }, scene)
  land.position.set(0, -0.02, edgeZ - 100)
  const lm = new StandardMaterial("qa-fallback-landmat", scene)
  lm.diffuseColor = Color3.FromHexString("#b8a888")
  lm.emissiveColor = Color3.FromHexString("#b8a888").scale(0.3)
  lm.specularColor = new Color3(0, 0, 0)
  land.material = lm
  land.isPickable = false
}

// the riverwalk dressing along the +Z edge (the thing under test).
const riverwalk = buildRiverwalk(scene, {
  edgeZ,
  ...(farEdgeZ != null ? { farEdgeZ } : {}),
  bounds: layout.bounds,
  gap: { x: gapX, halfWidth: gapHalf },
  palette,
  reducedMotion: qs.get("reduce") === "1",
})
world.onFrame((dt) => riverwalk.update(dt))

const cam = new ArcRotateCamera("wp-rw-cam", -Math.PI / 2, 1.0, 24, new Vector3(0, 0, edgeZ - 8), scene)
cam.fov = 0.7
cam.minZ = 0.1
cam.maxZ = 1200
cam.inputs.clear()
scene.activeCamera = cam
world.start()

const set = (alpha: number, beta: number, radius: number, tx: number, tz: number) => {
  // setTarget RECOMPUTES alpha/beta/radius from the current position, so it must
  // come FIRST; then we impose the framing.
  cam.setTarget(new Vector3(tx, 0.5, tz))
  cam.alpha = alpha
  cam.beta = beta
  cam.radius = radius
  camPos = new Vector3(tx, 1.5, tz)
}

interface Hooks {
  setView: (alpha: number, beta: number, radius: number, tx: number, tz: number) => void
  edge: () => { edgeZ: number; gapX: number; gapHalf: number; usingWater: boolean }
  diag: () => unknown
  warmedMs: () => number
}
;(window as unknown as { __wpScene: typeof scene }).__wpScene = scene
;(window as unknown as { __wpRiver: Hooks }).__wpRiver = {
  setView: (alpha, beta, radius, tx, tz) => set(alpha, beta, radius, tx, tz),
  edge: () => ({ edgeZ, gapX, gapHalf, usingWater: !!water }),
  warmedMs: () => Math.round(warm * 1000),
  diag: () => {
    const rw = scene.meshes.filter((m) => m.name.includes("wp-riverwalk"))
    const bal = rw.find((m) => m.name.includes("baluster"))
    const bb = (m: { getBoundingInfo?: () => { boundingBox: { minimumWorld: Vector3; maximumWorld: Vector3 } } } | undefined) => {
      const i = m?.getBoundingInfo?.()
      return i ? { min: [Math.round(i.boundingBox.minimumWorld.x), +i.boundingBox.minimumWorld.y.toFixed(2), Math.round(i.boundingBox.minimumWorld.z)], max: [Math.round(i.boundingBox.maximumWorld.x), +i.boundingBox.maximumWorld.y.toFixed(2), Math.round(i.boundingBox.maximumWorld.z)] } : null
    }
    const cp = cam.position
    return {
      meshes: rw.length,
      names: rw.map((m) => m.name),
      thinCounts: rw.map((m) => (m as unknown as { thinInstanceCount?: number }).thinInstanceCount ?? 0),
      harbor: harbor ? { x: Math.round(harbor.x), z: Math.round(harbor.z) } : null,
      totalVerts: rw.reduce((s, m) => s + m.getTotalVertices(), 0),
      balusterBB: bb(bal as never),
      railBB: bb(rw.find((m) => m.name.includes("railcap")) as never),
      camPos: [Math.round(cp.x), +cp.y.toFixed(2), Math.round(cp.z)],
      camTarget: [Math.round(cam.target.x), +cam.target.y.toFixed(2), Math.round(cam.target.z)],
      camRadius: +cam.radius.toFixed(1),
      balDetail: (() => {
        if (!bal) return null
        const b = bal as unknown as {
          isEnabled: () => boolean
          visibility: number
          thinInstanceCount: number
          subMeshes: unknown[]
          material?: { getClassName?: () => string }
          thinInstanceGetWorldMatrices?: () => Array<{ m: Float32Array }>
        }
        const mats = b.thinInstanceGetWorldMatrices?.() ?? []
        const sample = mats.slice(0, 3).map((m) => [Math.round(m.m[12]), +m.m[13].toFixed(2), Math.round(m.m[14]), +m.m[0].toFixed(2)])
        return {
          enabled: b.isEnabled(),
          visibility: b.visibility,
          count: b.thinInstanceCount,
          subMeshes: b.subMeshes.length,
          mat: b.material?.getClassName?.(),
          sampleXYZScale: sample,
        }
      })(),
    }
  },
}
