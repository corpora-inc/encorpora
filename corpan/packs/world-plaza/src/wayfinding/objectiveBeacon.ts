import type { Scene } from "@babylonjs/core/scene"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Color3 } from "@babylonjs/core/Maths/math"

/**
 * objectiveBeacon — the UNMISSABLE "talk to THIS person" marker.
 *
 * THE OWNER'S RECURRING PAIN: "I got to the fountain, I stand on the star, and
 * NOTHING happens. Shouldn't there be a special NPC there to help me?" The
 * objective NPC IS stationed at the step's anchor — but it looks exactly like the
 * 28 wandering townsfolk, so you can't tell which one to walk up to. The road
 * arrow points you to the right PLACE; this beacon points you to the right
 * PERSON, standing over their head from across the plaza.
 *
 * It is a three-part, self-lit, warm-accent marker that hovers above the objective
 * NPC's LIVE position (the NPC gently hovers near its anchor, so the beacon
 * tracks it, not a static point):
 *   • a tall vertical SHAFT of light (a billboarded column) you can see over
 *     rooftops from anywhere in the plaza — the "here!" pillar.
 *   • a bobbing downward CHEVRON just above the head ("this one").
 *   • a soft ground RING at the feet (the star you stand on, but attached to the
 *     person, not the floor — so the two can never disagree).
 *
 * Each part is the repo's canonical ADDITIVE glow card (the lamp-halo recipe in
 * dressing.ts `makeGlowSpecies`): a warm rgba texture whose alpha is FEATHERED to
 * zero at every edge, drawn self-lit with ADD blend — so it reads as LIGHT, never
 * an opaque slab or a black box. Depth-write OFF + render-last so it never
 * z-fights the world or hides behind a building (it draws THROUGH — intentional:
 * a wayfinding beacon you can see from anywhere). Gentle breathing pulse (static
 * under reduced motion).
 *
 * Pure consumer (mirrors roadArrow): the orchestrator injects `getTarget()` (the
 * objective NPC's live world point, or null when there's no active objective /
 * the NPC isn't placed) and `isSuppressed()` (true while a dialogue or challenge
 * owns the screen — hide the clutter), and ticks `update(dt)` in the frame loop.
 */

export interface ObjectiveBeaconOptions {
  /**
   * The objective NPC's LIVE ground point (it hovers near its anchor), or null
   * when there is no active objective or no NPC is stationed there. The beacon
   * shows ONLY when this is non-null.
   */
  getTarget: () => { x: number; z: number } | null
  /**
   * True while a dialogue/challenge/vignette owns the screen — the beacon hides
   * (you're already talking to them; no need to shout). Optional → never
   * suppressed.
   */
  isSuppressed?: () => boolean
  /** accent colour (Scene.palette.accent) so the beacon matches the world. */
  accent?: string
}

export interface ObjectiveBeaconHandle {
  /** drive from the frame loop: repositions + pulses the beacon over the NPC. */
  update: (dt: number) => void
  dispose: () => void
}

/** Height of the head the chevron/shaft sit above (paper-people are ~2u tall). */
const HEAD_Y = 2.35
/** The light shaft rises this far above the head — visible over rooftops. */
const SHAFT_H = 5.4
const SHAFT_W = 0.9
/** Chevron quad size (world units), bobbing just over the head. */
const CHEVRON_SIZE = 1.25
/** Ground ring size at the feet. */
const RING_SIZE = 2.4

const hex = (s: string | undefined, fallback: string): Color3 =>
  Color3.FromHexString(s ?? fallback)

/** Warm RGB triplet for the painter (the accent, lightened toward a hot core). */
interface Warm {
  /** the accent itself, e.g. "230,138,60". */
  base: string
  /** a brighter, whiter version for the hot core, e.g. "255,224,170". */
  core: string
}

/**
 * The recipe is the repo's canonical ADDITIVE glow card (dressing.ts
 * `makeGlowSpecies`): paint the texture in WARM rgba with the alpha FEATHERED to
 * zero at every edge (never a solid fill), drive it through
 * `useAlphaFromDiffuseTexture` + ADD blend, so the lit areas read as LIGHT and the
 * transparent areas add NOTHING (no gray slab, no black box). Additive blooms
 * hard, so cores stay modest + fall off fast.
 */

/** A soft vertical light column: warm core, feathering to nothing at every edge. */
function paintShaft(ctx: CanvasRenderingContext2D, w: number, h: number, warm: Warm): void {
  ctx.clearRect(0, 0, w, h)
  // Vertical falloff (alpha): brightest just above the head (canvas bottom),
  // fading to 0 at the very top — never a solid column.
  const v = ctx.createLinearGradient(0, h, 0, 0)
  v.addColorStop(0, `rgba(${warm.base},0.0)`) // the very base feathers in
  v.addColorStop(0.12, `rgba(${warm.base},0.5)`)
  v.addColorStop(0.5, `rgba(${warm.base},0.28)`)
  v.addColorStop(1, `rgba(${warm.base},0.0)`)
  ctx.fillStyle = v
  ctx.fillRect(0, 0, w, h)
  // Horizontal falloff: bright hot core down the centre, transparent at the sides
  // (so the column is a soft beam, not a flat-edged plank). Multiply keeps the
  // product alpha = vertical × horizontal, feathered on all four sides.
  ctx.globalCompositeOperation = "destination-in"
  const hgrad = ctx.createLinearGradient(0, 0, w, 0)
  hgrad.addColorStop(0, "rgba(0,0,0,0)")
  hgrad.addColorStop(0.5, "rgba(0,0,0,1)")
  hgrad.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = hgrad
  ctx.fillRect(0, 0, w, h)
  ctx.globalCompositeOperation = "source-over"
  // A hot near-white core stripe down the centre for body (additive, modest).
  const core = ctx.createLinearGradient(0, 0, w, 0)
  core.addColorStop(0, `rgba(${warm.core},0)`)
  core.addColorStop(0.5, `rgba(${warm.core},0.5)`)
  core.addColorStop(1, `rgba(${warm.core},0)`)
  ctx.globalCompositeOperation = "lighter"
  ctx.fillStyle = core
  ctx.fillRect(w * 0.32, 0, w * 0.36, h)
  ctx.globalCompositeOperation = "source-over"
}

/** A glowing downward chevron ("▼ this one"), a warm fill with a soft halo. */
function paintChevron(ctx: CanvasRenderingContext2D, w: number, h: number, warm: Warm): void {
  ctx.clearRect(0, 0, w, h)
  ctx.save()
  ctx.translate(w / 2, h / 2)
  // soft warm halo so the silhouette feathers (additive → the halo reads as glow).
  ctx.shadowColor = `rgba(${warm.base},0.9)`
  ctx.shadowBlur = w * 0.14
  ctx.fillStyle = `rgba(${warm.core},0.95)`
  ctx.beginPath()
  // a thick chevron pointing DOWN (tip at +y / canvas bottom).
  const halfW = w * 0.3
  const topY = -h * 0.24
  const tipY = h * 0.3
  const thick = h * 0.18
  ctx.moveTo(-halfW, topY)
  ctx.lineTo(0, tipY)
  ctx.lineTo(halfW, topY)
  ctx.lineTo(halfW - thick * 0.6, topY)
  ctx.lineTo(0, tipY - thick)
  ctx.lineTo(-halfW + thick * 0.6, topY)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/** A soft glowing ring (radial annulus), feathered to nothing inside and out. */
function paintRing(ctx: CanvasRenderingContext2D, w: number, h: number, warm: Warm): void {
  ctx.clearRect(0, 0, w, h)
  const cx = w / 2
  const cy = h / 2
  const outer = w * 0.46
  const g = ctx.createRadialGradient(cx, cy, outer * 0.5, cx, cy, outer)
  g.addColorStop(0, `rgba(${warm.base},0.0)`) // transparent centre
  g.addColorStop(0.62, `rgba(${warm.base},0.45)`)
  g.addColorStop(0.78, `rgba(${warm.core},0.55)`) // brightest at the ring itself
  g.addColorStop(1, `rgba(${warm.base},0.0)`) // soft outer feather
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, outer, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * Build the canonical ADDITIVE-glow material (mirrors dressing.ts
 * `makeGlowSpecies`): the warm rgba texture drives BOTH colour and alpha
 * (`useAlphaFromDiffuseTexture`), self-lit (`emissiveColor` white + lighting
 * disabled), ADD blend so it reads as LIGHT (never an opaque slab / black box),
 * depth-write off + render-last so the beacon shows through the world.
 */
function makeBeaconMat(
  scene: Scene,
  name: string,
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number, warm: Warm) => void,
  size: { w: number; h: number },
  warm: Warm,
): { mat: StandardMaterial; tex: DynamicTexture } {
  const tex = new DynamicTexture(`${name}-tex`, size, scene, true)
  tex.hasAlpha = true
  paint(tex.getContext() as unknown as CanvasRenderingContext2D, size.w, size.h, warm)
  tex.update()
  const mat = new StandardMaterial(`${name}-mat`, scene)
  mat.diffuseTexture = tex
  mat.useAlphaFromDiffuseTexture = true // the texture's alpha is the silhouette
  mat.emissiveColor = new Color3(1, 1, 1) // self-lit — the warm colour comes from the texture
  mat.disableLighting = true
  mat.specularColor = new Color3(0, 0, 0)
  mat.alphaMode = 1 // ALPHA_ADD — reads as glowing light, not a wall
  mat.backFaceCulling = false
  mat.disableDepthWrite = true // never z-fight; draw THROUGH the world (a beacon)
  mat.alpha = 0
  return { mat, tex }
}

export function createObjectiveBeacon(
  scene: Scene,
  opts: ObjectiveBeaconOptions,
): ObjectiveBeaconHandle {
  const accent = hex(opts.accent, "#e08a3c")
  const reduced =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
  // The warm palette for the painter: the accent itself, plus a brighter, whiter
  // "core" (the accent lifted ~55% toward white) for the hot centre of the glow.
  const r = Math.round(accent.r * 255)
  const g = Math.round(accent.g * 255)
  const b = Math.round(accent.b * 255)
  const lift = (c: number) => Math.round(c + (255 - c) * 0.55)
  const warm: Warm = {
    base: `${r},${g},${b}`,
    core: `${lift(r)},${lift(g)},${lift(b)}`,
  }

  // ── the light SHAFT (vertical billboard column) ──────────────────────────
  const shaftBuilt = makeBeaconMat(scene, "wp-obj-shaft", paintShaft, { w: 128, h: 512 }, warm)
  const shaft: Mesh = MeshBuilder.CreatePlane(
    "wp-obj-shaft",
    { width: SHAFT_W, height: SHAFT_H },
    scene,
  )
  shaft.material = shaftBuilt.mat
  shaft.billboardMode = Mesh.BILLBOARDMODE_Y // spins about Y to face the camera (a column)
  shaft.isPickable = false
  shaft.renderingGroupId = 3 // render LAST so the beacon is always visible
  // A billboarded column's bounds rotate each frame; skip the frustum test so it
  // never pops out when the camera is off-axis (it's cheap — three small quads).
  shaft.alwaysSelectAsActiveMesh = true
  shaft.setEnabled(false)

  // ── the bobbing CHEVRON (always faces camera, just above the head) ───────
  const chevBuilt = makeBeaconMat(scene, "wp-obj-chev", paintChevron, { w: 256, h: 256 }, warm)
  const chevron: Mesh = MeshBuilder.CreatePlane("wp-obj-chev", { size: CHEVRON_SIZE }, scene)
  chevron.material = chevBuilt.mat
  chevron.billboardMode = Mesh.BILLBOARDMODE_ALL // always faces the camera flat
  chevron.isPickable = false
  chevron.renderingGroupId = 3
  chevron.alwaysSelectAsActiveMesh = true
  chevron.setEnabled(false)

  // ── the ground RING (flat halo at the feet) ──────────────────────────────
  const ringBuilt = makeBeaconMat(scene, "wp-obj-ring", paintRing, { w: 256, h: 256 }, warm)
  const ring: Mesh = MeshBuilder.CreatePlane("wp-obj-ring", { size: RING_SIZE }, scene)
  ring.material = ringBuilt.mat
  ring.rotation.x = Math.PI / 2 // lie flat on the ground
  ring.position.y = 0.06 // a hair above the road (never coplanar — §2 z-fight rule)
  ring.isPickable = false
  ring.renderingGroupId = 0 // the ring DOES sit on the ground (group 0, depth-write off)
  ring.setEnabled(false)

  const setEnabled = (on: boolean) => {
    if (shaft.isEnabled() !== on) shaft.setEnabled(on)
    if (chevron.isEnabled() !== on) chevron.setEnabled(on)
    if (ring.isEnabled() !== on) ring.setEnabled(on)
  }

  let phase = 0
  let bob = 0

  const update = (dt: number) => {
    const target = opts.getTarget()
    const suppressed = opts.isSuppressed?.() ?? false
    if (!target || suppressed) {
      if (shaft.isEnabled()) setEnabled(false)
      return
    }
    if (!shaft.isEnabled()) setEnabled(true)

    // Position all three parts over the NPC's live point.
    shaft.position.x = target.x
    shaft.position.z = target.z
    shaft.position.y = HEAD_Y + SHAFT_H / 2 // base at the head, rising up
    chevron.position.x = target.x
    chevron.position.z = target.z
    ring.position.x = target.x
    ring.position.z = target.z

    // breathing pulse + a gentle chevron bob (static under reduced motion).
    let breathe = 1
    if (!reduced) {
      phase = (phase + dt / 1.5) % 1 // ~1.5s loop
      breathe = 0.7 + 0.3 * Math.sin(phase * Math.PI * 2)
      bob = (bob + dt / 1.1) % 1
      chevron.position.y = HEAD_Y + 0.55 + 0.18 * Math.sin(bob * Math.PI * 2)
    } else {
      chevron.position.y = HEAD_Y + 0.55
    }

    shaftBuilt.mat.alpha = 0.5 * breathe
    chevBuilt.mat.alpha = 0.92 * (0.78 + 0.22 * breathe) // chevron stays bold + readable
    ringBuilt.mat.alpha = 0.5 * breathe
  }

  return {
    update,
    dispose: () => {
      for (const b of [shaftBuilt, chevBuilt, ringBuilt]) {
        b.mat.dispose()
        b.tex.dispose()
      }
      shaft.dispose()
      chevron.dispose()
      ring.dispose()
    },
  }
}
