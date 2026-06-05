import type { Scene } from "@babylonjs/core/scene"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Color3 } from "@babylonjs/core/Maths/math"

/**
 * objectiveBeacon — the premium, UNMISSABLE "talk to THIS person" marker.
 *
 * The objective NPC is stationed at the active step's anchor but looks like any of
 * the 28 wandering townsfolk; the road arrow points to the right PLACE, this
 * beacon points to the right PERSON, hovering over their head from across the
 * plaza. It tracks the NPC's LIVE position (they gently hover near the anchor).
 *
 * DESIGN: a designed, warm-accent floating MAP PIN — a rounded teardrop with a
 * gem eye — bobbing + gently swaying above the head, with a downward CHEVRON
 * beneath it ("this one"), a soft glow HALO behind the pin, and a pulsing ground
 * RING at the feet. All warm-accent (NOT white). Depth-write OFF + render-last so
 * the beacon shows THROUGH the world (a wayfinding marker you see from anywhere).
 * Gentle pulse + bob + sway (static under reduced motion).
 *
 * THE BUG THAT COST THREE ROUNDS (gray slab → white pillar → black box): the
 * DynamicTexture was constructed with `{ w, h }` instead of `{ width, height }`,
 * so the canvas was undefined-sized and the paint went nowhere — leaving a
 * garbage/opaque-black texture. With `{ width, height }` the painters' warm rgba
 * art renders crisply. Lesson: a beacon that won't render is almost always the
 * TEXTURE (size/paint), not the blend mode.
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

/** Head height the marker sits above (paper-people are ~2u tall). */
const HEAD_Y = 2.35
/** The pin floats this far above the head; the chevron sits just under it. */
const PIN_Y = HEAD_Y + 1.6
const PIN_SIZE = 2.0
const HALO_SIZE = 3.4 // soft additive glow behind the pin
const CHEVRON_SIZE = 1.15
const RING_SIZE = 2.6

const hex = (s: string | undefined, fallback: string): Color3 =>
  Color3.FromHexString(s ?? fallback)

/**
 * Warm RGB triplets for the ADDITIVE painters, derived from the scene accent.
 * Kept SATURATED (never near-white): additive blending already brightens, so a
 * white core washes the whole marker out to the "transparent white pillar" the
 * owner disliked. `hot` is only a GENTLE lift so the gem reads as a highlight.
 */
interface Warm {
  /** the accent itself, e.g. "230,138,60". */
  base: string
  /** a deeper, more saturated accent for body/contrast. */
  deep: string
  /** a gently lifted warm highlight (NOT white) for the gem + sheen. */
  hot: string
}

/* --------------------------------------------------------------- painters */

/**
 * A designed MAP PIN: a rounded teardrop body in the warm accent with a darker
 * rim for definition, a bright gem "eye", and a soft top sheen — drawn on a
 * transparent canvas so STANDARD alpha keeps the warm colour (no white-wash). The
 * tip points DOWN (at the person). Canvas: tip near the bottom, bulb up top.
 */
function paintPin(ctx: CanvasRenderingContext2D, w: number, h: number, warm: Warm): void {
  ctx.clearRect(0, 0, w, h)
  const cx = w / 2
  const bulbCy = h * 0.4 // centre of the round head
  const bulbR = w * 0.3
  const tipY = h * 0.9 // the point at the bottom

  // soft drop shadow so the pin reads as a solid object floating over the world.
  ctx.save()
  ctx.shadowColor = "rgba(40,20,0,0.35)"
  ctx.shadowBlur = w * 0.05
  ctx.shadowOffsetY = h * 0.012

  // pin body: a teardrop = a circle (the head) + two tangent lines down to the tip.
  ctx.beginPath()
  const a = Math.asin(bulbR / (tipY - bulbCy)) // tangent angle from centre to tip
  ctx.arc(cx, bulbCy, bulbR, Math.PI / 2 + a, Math.PI / 2 - a, false) // the head arc
  ctx.lineTo(cx, tipY) // down to the point
  ctx.closePath()

  // warm fill with a vertical sheen (lighter at the top of the bulb).
  const fill = ctx.createLinearGradient(0, bulbCy - bulbR, 0, tipY)
  fill.addColorStop(0, `rgba(${warm.hot},1)`)
  fill.addColorStop(0.32, `rgba(${warm.base},1)`)
  fill.addColorStop(1, `rgba(${warm.deep},1)`)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.restore()

  // a crisp darker rim for definition against any background.
  ctx.lineWidth = w * 0.035
  ctx.strokeStyle = `rgba(${warm.deep},0.9)`
  ctx.stroke()

  // the gem "eye" — a bright inset disc with a hot highlight (the focal point).
  const gemR = bulbR * 0.5
  const gem = ctx.createRadialGradient(cx - gemR * 0.3, bulbCy - gemR * 0.3, gemR * 0.1, cx, bulbCy, gemR)
  gem.addColorStop(0, `rgba(${warm.hot},1)`) // warm highlight (NOT white — additive blooms)
  gem.addColorStop(0.55, `rgba(${warm.base},0.96)`)
  gem.addColorStop(1, `rgba(${warm.deep},0.92)`)
  ctx.beginPath()
  ctx.arc(cx, bulbCy, gemR, 0, Math.PI * 2)
  ctx.fillStyle = gem
  ctx.fill()
}

/** A soft round warm HALO (additive glow behind the pin). Alpha feathered to 0. */
function paintHalo(ctx: CanvasRenderingContext2D, w: number, h: number, warm: Warm): void {
  ctx.clearRect(0, 0, w, h)
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
  g.addColorStop(0, `rgba(${warm.hot},0.5)`)
  g.addColorStop(0.32, `rgba(${warm.base},0.26)`)
  g.addColorStop(0.6, `rgba(${warm.base},0.07)`)
  g.addColorStop(1, `rgba(${warm.base},0)`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

/** A solid downward CHEVRON ("▼ this one") in the warm accent, with a dark rim. */
function paintChevron(ctx: CanvasRenderingContext2D, w: number, h: number, warm: Warm): void {
  ctx.clearRect(0, 0, w, h)
  ctx.save()
  ctx.translate(w / 2, h / 2)
  const halfW = w * 0.32
  const topY = -h * 0.22
  const tipY = h * 0.3
  const thick = h * 0.2
  ctx.beginPath()
  ctx.moveTo(-halfW, topY)
  ctx.lineTo(0, tipY)
  ctx.lineTo(halfW, topY)
  ctx.lineTo(halfW - thick * 0.62, topY)
  ctx.lineTo(0, tipY - thick)
  ctx.lineTo(-halfW + thick * 0.62, topY)
  ctx.closePath()
  ctx.fillStyle = `rgba(${warm.base},1)`
  ctx.shadowColor = "rgba(40,20,0,0.3)"
  ctx.shadowBlur = w * 0.03
  ctx.fill()
  ctx.lineWidth = w * 0.02
  ctx.strokeStyle = `rgba(${warm.deep},0.9)`
  ctx.stroke()
  ctx.restore()
}

/** A warm glowing RING (radial annulus), feathered to nothing inside and out. */
function paintRing(ctx: CanvasRenderingContext2D, w: number, h: number, warm: Warm): void {
  ctx.clearRect(0, 0, w, h)
  const cx = w / 2
  const cy = h / 2
  const outer = w * 0.46
  const g = ctx.createRadialGradient(cx, cy, outer * 0.55, cx, cy, outer)
  g.addColorStop(0, `rgba(${warm.base},0.0)`)
  g.addColorStop(0.66, `rgba(${warm.base},0.4)`)
  g.addColorStop(0.8, `rgba(${warm.hot},0.6)`) // brightest at the ring
  g.addColorStop(1, `rgba(${warm.base},0.0)`)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, outer, 0, Math.PI * 2)
  ctx.fill()
}

/* --------------------------------------------------------------- material */

/**
 * Build a self-lit, draw-through beacon material. Two modes:
 *
 *  • `glow:true` (halo, ring) — ADDITIVE (`alphaMode=1`): reads as soft LIGHT.
 *  • `glow:false` (pin, chevron) — the PROVEN CRISP-CUTOUT recipe (mirrors
 *    `render/cutout.ts`, which renders crisp 2D art every frame): NO explicit
 *    `alphaMode` (so `useAlphaFromDiffuseTexture` does normal alpha blending — the
 *    COMBINE experiment that set `alphaMode=2` rendered the quad INVISIBLE), and
 *    `mat.alpha` starts at 1. So the designed warm shape stays CRISP + keeps its
 *    colour (no additive white-wash), while still drawing through the world.
 *
 * Both: `disableDepthWrite` + `renderingGroupId 3` (set by the caller) so the
 * beacon shows over the world; self-lit (`emissiveColor` white + lighting off) so
 * the warm colour comes straight from the texture at any time of day.
 */
function makeMat(
  scene: Scene,
  name: string,
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number, warm: Warm) => void,
  size: { w: number; h: number },
  warm: Warm,
  glow: boolean,
): { mat: StandardMaterial; tex: DynamicTexture } {
  // NB: DynamicTexture wants `{ width, height }` — passing `{ w, h }` yields an
  // undefined-sized canvas → paint goes nowhere → an opaque BLACK quad (the bug).
  const tex = new DynamicTexture(`${name}-tex`, { width: size.w, height: size.h }, scene, true)
  tex.hasAlpha = true
  paint(tex.getContext() as unknown as CanvasRenderingContext2D, size.w, size.h, warm)
  tex.update()
  const mat = new StandardMaterial(`${name}-mat`, scene)
  mat.diffuseTexture = tex
  mat.useAlphaFromDiffuseTexture = true
  mat.emissiveColor = new Color3(1, 1, 1) // self-lit — warm colour comes from the texture
  mat.disableLighting = true
  mat.specularColor = new Color3(0, 0, 0)
  mat.backFaceCulling = false
  mat.disableDepthWrite = true // draw THROUGH the world — never z-fight
  if (glow) {
    mat.alphaMode = 2 // ALPHA_COMBINE — standard blend; the halo's own alpha feathers
    mat.transparencyMode = StandardMaterial.MATERIAL_ALPHABLEND
    mat.alpha = 0 // pulsed up in update()
  } else {
    // crisp shape: STANDARD alpha blend so the warm colour stays crisp + the
    // transparent texels are TRANSPARENT (not the black box that omitting the
    // transparencyMode produced under disableDepthWrite). Both the blend mode AND
    // the transparency mode must be set or `useAlphaFromDiffuseTexture` renders
    // the quad opaque-black.
    mat.alphaMode = 2 // ALPHA_COMBINE
    mat.transparencyMode = StandardMaterial.MATERIAL_ALPHABLEND
    mat.alpha = 1
  }
  return { mat, tex }
}

export function createObjectiveBeacon(
  scene: Scene,
  opts: ObjectiveBeaconOptions,
): ObjectiveBeaconHandle {
  const accent = hex(opts.accent, "#e08a3c")
  const reduced =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
  const r = Math.round(accent.r * 255)
  const g = Math.round(accent.g * 255)
  const b = Math.round(accent.b * 255)
  const lift = (c: number, t: number) => Math.round(c + (255 - c) * t)
  const deepen = (c: number, t: number) => Math.round(c * (1 - t))
  const warm: Warm = {
    base: `${r},${g},${b}`,
    deep: `${deepen(r, 0.3)},${deepen(g, 0.3)},${deepen(b, 0.3)}`,
    hot: `${lift(r, 0.3)},${lift(g, 0.3)},${lift(b, 0.3)}`, // gentle — NOT white
  }

  // ── soft HALO behind the pin (additive glow) ──────────────────────────────
  const haloBuilt = makeMat(scene, "wp-obj-halo", paintHalo, { w: 256, h: 256 }, warm, true)
  const halo: Mesh = MeshBuilder.CreatePlane("wp-obj-halo", { size: HALO_SIZE }, scene)
  halo.material = haloBuilt.mat
  halo.billboardMode = Mesh.BILLBOARDMODE_ALL
  halo.isPickable = false
  halo.renderingGroupId = 3
  halo.alwaysSelectAsActiveMesh = true
  halo.setEnabled(false)

  // ── the designed PIN (solid warm, standard alpha so it stays warm) ────────
  const pinBuilt = makeMat(scene, "wp-obj-pin", paintPin, { w: 256, h: 256 }, warm, false)
  const pin: Mesh = MeshBuilder.CreatePlane("wp-obj-pin", { size: PIN_SIZE }, scene)
  pin.material = pinBuilt.mat
  // Face the camera about Y only, so the pin keeps its upright "map-pin" pose and
  // we can gently turn it for life without it tumbling.
  pin.billboardMode = Mesh.BILLBOARDMODE_Y
  pin.isPickable = false
  pin.renderingGroupId = 3
  pin.alwaysSelectAsActiveMesh = true
  pin.setEnabled(false)

  // ── the downward CHEVRON ("this one") ─────────────────────────────────────
  const chevBuilt = makeMat(scene, "wp-obj-chev", paintChevron, { w: 256, h: 256 }, warm, false)
  const chevron: Mesh = MeshBuilder.CreatePlane("wp-obj-chev", { size: CHEVRON_SIZE }, scene)
  chevron.material = chevBuilt.mat
  chevron.billboardMode = Mesh.BILLBOARDMODE_ALL
  chevron.isPickable = false
  chevron.renderingGroupId = 3
  chevron.alwaysSelectAsActiveMesh = true
  chevron.setEnabled(false)

  // ── the ground RING at the feet ───────────────────────────────────────────
  const ringBuilt = makeMat(scene, "wp-obj-ring", paintRing, { w: 256, h: 256 }, warm, true)
  const ring: Mesh = MeshBuilder.CreatePlane("wp-obj-ring", { size: RING_SIZE }, scene)
  ring.material = ringBuilt.mat
  ring.rotation.x = Math.PI / 2 // lie flat on the ground
  ring.position.y = 0.06 // a hair above the road (never coplanar — §2 z-fight rule)
  ring.isPickable = false
  ring.renderingGroupId = 0
  ring.setEnabled(false)

  const parts = [halo, pin, chevron, ring]
  const setEnabled = (on: boolean) => {
    for (const m of parts) if (m.isEnabled() !== on) m.setEnabled(on)
  }

  let phase = 0
  let bob = 0
  let spin = 0

  const update = (dt: number) => {
    const target = opts.getTarget()
    const suppressed = opts.isSuppressed?.() ?? false
    if (!target || suppressed) {
      if (pin.isEnabled()) setEnabled(false)
      return
    }
    if (!pin.isEnabled()) setEnabled(true)

    for (const m of parts) {
      m.position.x = target.x
      m.position.z = target.z
    }

    // bob the pin + chevron together; pulse the halo/ring; slow-spin the pin.
    let breathe = 1
    let lift = 0
    if (!reduced) {
      phase = (phase + dt / 1.6) % 1
      breathe = 0.72 + 0.28 * Math.sin(phase * Math.PI * 2)
      bob = (bob + dt / 1.3) % 1
      lift = 0.14 * Math.sin(bob * Math.PI * 2)
      spin = (spin + dt * 0.6) % (Math.PI * 2)
      pin.rotation.y = 0.32 * Math.sin(spin) // a gentle sway, not a full tumble
    }
    pin.position.y = PIN_Y + lift
    halo.position.y = PIN_Y + lift
    chevron.position.y = HEAD_Y + 0.5 + lift

    // The designed shapes stay near-opaque (so they read crisp); the glow pulses.
    pinBuilt.mat.alpha = 1
    chevBuilt.mat.alpha = 0.96
    haloBuilt.mat.alpha = 0.55 * breathe
    ringBuilt.mat.alpha = 0.5 * breathe
  }

  return {
    update,
    dispose: () => {
      for (const b of [haloBuilt, pinBuilt, chevBuilt, ringBuilt]) {
        b.mat.dispose()
        b.tex.dispose()
      }
      for (const m of parts) m.dispose()
    },
  }
}
