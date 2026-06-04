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
 * DESIGN (v2 — the v1 additive "shaft" washed out to a transparent white pillar):
 * a designed, warm-accent floating MAP PIN — a rounded teardrop with a bright gem
 * eye — bobbing + slowly turning above the head, with a downward CHEVRON beneath
 * it ("this one") and a soft pulsing ground RING at the feet. The solid shapes use
 * STANDARD alpha (so the warm accent stays warm — no white-wash), each backed by a
 * separate soft ADDITIVE halo for glow. Depth-write OFF + render-last so the
 * beacon shows THROUGH the world (a wayfinding marker you see from anywhere).
 * Gentle pulse + bob + spin (static under reduced motion).
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
const PIN_Y = HEAD_Y + 1.35
const PIN_SIZE = 1.5
const HALO_SIZE = 2.7 // soft additive glow behind the pin
const CHEVRON_SIZE = 0.95
const RING_SIZE = 2.4

const hex = (s: string | undefined, fallback: string): Color3 =>
  Color3.FromHexString(s ?? fallback)

/** Warm RGB triplets for the painter, derived from the scene accent. */
interface Warm {
  /** the accent itself, e.g. "230,138,60". */
  base: string
  /** a deeper, saturated edge for the pin outline/contrast. */
  deep: string
  /** a bright hot highlight (accent lifted toward white) for the gem + sheen. */
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
  gem.addColorStop(0, "rgba(255,255,255,0.98)")
  gem.addColorStop(0.5, `rgba(${warm.hot},0.98)`)
  gem.addColorStop(1, `rgba(${warm.base},0.95)`)
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

const ALPHA_ADD = 1
const ALPHA_COMBINE = 2

/**
 * Self-lit, depth-write-off, render-last unlit material. `blend` picks the look:
 * COMBINE keeps the texture's warm colour (the designed solid shapes — pin,
 * chevron, ring); ADD makes a soft glow (the halo) that brightens the scene.
 */
function makeMat(
  scene: Scene,
  name: string,
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number, warm: Warm) => void,
  size: { w: number; h: number },
  warm: Warm,
  blend: typeof ALPHA_ADD | typeof ALPHA_COMBINE,
): { mat: StandardMaterial; tex: DynamicTexture } {
  const tex = new DynamicTexture(`${name}-tex`, size, scene, true)
  tex.hasAlpha = true
  paint(tex.getContext() as unknown as CanvasRenderingContext2D, size.w, size.h, warm)
  tex.update()
  const mat = new StandardMaterial(`${name}-mat`, scene)
  mat.diffuseTexture = tex
  mat.useAlphaFromDiffuseTexture = true
  mat.emissiveColor = new Color3(1, 1, 1) // self-lit — the warm colour is in the texture
  mat.disableLighting = true
  mat.specularColor = new Color3(0, 0, 0)
  mat.alphaMode = blend
  // MUST force ALPHABLEND transparency: with disableDepthWrite + a COMBINE blend
  // but no transparency mode, Babylon treats the material as OPAQUE and renders
  // the transparent texels as a BLACK box (the v2 regression). ALPHABLEND keys the
  // texture's alpha so only the painted shape shows. (ADD is inherently blended,
  // but setting it here too is harmless + explicit.)
  mat.transparencyMode = StandardMaterial.MATERIAL_ALPHABLEND
  mat.backFaceCulling = false
  mat.disableDepthWrite = true // draw THROUGH the world — never z-fight
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
  const r = Math.round(accent.r * 255)
  const g = Math.round(accent.g * 255)
  const b = Math.round(accent.b * 255)
  const lift = (c: number, t: number) => Math.round(c + (255 - c) * t)
  const deepen = (c: number, t: number) => Math.round(c * (1 - t))
  const warm: Warm = {
    base: `${r},${g},${b}`,
    deep: `${deepen(r, 0.42)},${deepen(g, 0.42)},${deepen(b, 0.42)}`,
    hot: `${lift(r, 0.6)},${lift(g, 0.6)},${lift(b, 0.6)}`,
  }

  // ── soft HALO behind the pin (additive glow) ──────────────────────────────
  const haloBuilt = makeMat(scene, "wp-obj-halo", paintHalo, { w: 256, h: 256 }, warm, ALPHA_ADD)
  const halo: Mesh = MeshBuilder.CreatePlane("wp-obj-halo", { size: HALO_SIZE }, scene)
  halo.material = haloBuilt.mat
  halo.billboardMode = Mesh.BILLBOARDMODE_ALL
  halo.isPickable = false
  halo.renderingGroupId = 3
  halo.alwaysSelectAsActiveMesh = true
  halo.setEnabled(false)

  // ── the designed PIN (solid warm, standard alpha so it stays warm) ────────
  const pinBuilt = makeMat(scene, "wp-obj-pin", paintPin, { w: 256, h: 256 }, warm, ALPHA_COMBINE)
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
  const chevBuilt = makeMat(scene, "wp-obj-chev", paintChevron, { w: 256, h: 256 }, warm, ALPHA_COMBINE)
  const chevron: Mesh = MeshBuilder.CreatePlane("wp-obj-chev", { size: CHEVRON_SIZE }, scene)
  chevron.material = chevBuilt.mat
  chevron.billboardMode = Mesh.BILLBOARDMODE_ALL
  chevron.isPickable = false
  chevron.renderingGroupId = 3
  chevron.alwaysSelectAsActiveMesh = true
  chevron.setEnabled(false)

  // ── the ground RING at the feet ───────────────────────────────────────────
  const ringBuilt = makeMat(scene, "wp-obj-ring", paintRing, { w: 256, h: 256 }, warm, ALPHA_ADD)
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
