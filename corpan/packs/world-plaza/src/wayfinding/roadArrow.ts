import type { Scene } from "@babylonjs/core/scene"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import type { Mesh } from "@babylonjs/core/Meshes/mesh"
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Color3 } from "@babylonjs/core/Maths/math"

/**
 * roadArrow — a SUBTLE, muted wayfinding hint: a soft arrow that lies on the road
 * a few steps ahead of the player, pointing toward the NEXT objective. Elegant,
 * never nagging:
 *   • It only appears when there's an active objective AND it's far enough to be
 *     worth pointing at — within ~14u (you've basically arrived) it fades out.
 *   • It's low-opacity, unlit, warm-accent — reads as a painted floor marker, not
 *     a HUD shout. A very gentle breathing pulse (opt-out under reduced motion).
 *   • It floats 8cm above the ground (NOT coplanar) with depth-write off, so it
 *     never z-fights the baked road at any grazing angle (the §2 lesson).
 *   • Straight-line bearing to the objective (not a path) — enough to orient
 *     without a minimap stare; the minimap handles the rest.
 *
 * Pure consumer: the orchestrator injects `getPlayer()` and `getTarget()` (the
 * current objective's world point, or null) and ticks `update(dt)` in the frame
 * loop. No world/scene coupling beyond the one flat mesh it owns.
 */

export interface RoadArrowOptions {
  /** live player ground position + facing (radians). */
  getPlayer: () => { x: number; z: number; facing: number }
  /** the current objective's world point, or null when there's nothing to point at. */
  getTarget: () => { x: number; z: number } | null
  /** accent colour (Scene.palette.accent) so the hint matches the world. */
  accent?: string
}

export interface RoadArrowHandle {
  /** drive from the frame loop: repositions/aims/fades the hint. */
  update: (dt: number) => void
  dispose: () => void
}

const NEAR_FADE = 14 // within this many units of the objective, the hint fades out
const AHEAD = 4.5 // how far ahead of the player the marker sits (world units)
const SIZE = 3.2 // arrow quad size (world units)
const BASE_ALPHA = 0.42 // muted — a floor marker, not a HUD shout

const hex = (s: string | undefined, fallback: string): Color3 =>
  Color3.FromHexString(s ?? fallback)

/** Paint a single tapered arrow (pointing toward +Y of the canvas) with soft edges. */
function paintArrow(ctx: CanvasRenderingContext2D, w: number, h: number, css: string): void {
  ctx.clearRect(0, 0, w, h)
  ctx.save()
  ctx.translate(w / 2, h / 2)
  // soft outer glow so the edges feather into the road
  ctx.shadowColor = css
  ctx.shadowBlur = w * 0.06
  ctx.fillStyle = css
  ctx.beginPath()
  // a chevron-headed arrow, tip toward -y (top of canvas → world forward)
  const tip = -h * 0.42
  const wing = h * -0.02
  const halfHead = w * 0.32
  const halfShaft = w * 0.12
  const tail = h * 0.4
  ctx.moveTo(0, tip)
  ctx.lineTo(halfHead, wing)
  ctx.lineTo(halfShaft, wing)
  ctx.lineTo(halfShaft, tail)
  ctx.lineTo(-halfShaft, tail)
  ctx.lineTo(-halfShaft, wing)
  ctx.lineTo(-halfHead, wing)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

export function createRoadArrow(scene: Scene, opts: RoadArrowOptions): RoadArrowHandle {
  const accent = hex(opts.accent, "#e08a3c")
  const reduced =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

  const tex = new DynamicTexture("wp-roadarrow-tex", { width: 256, height: 256 }, scene, true)
  tex.hasAlpha = true
  const c = tex.getContext() as unknown as CanvasRenderingContext2D
  const cssAccent = `rgb(${Math.round(accent.r * 255)},${Math.round(accent.g * 255)},${Math.round(
    accent.b * 255,
  )})`
  paintArrow(c, 256, 256, cssAccent)
  tex.update()

  const mat = new StandardMaterial("wp-roadarrow-mat", scene)
  mat.diffuseTexture = tex
  mat.opacityTexture = tex
  mat.emissiveColor = new Color3(1, 1, 1) // self-lit so it reads on any ground
  mat.disableLighting = true
  mat.specularColor = new Color3(0, 0, 0)
  mat.backFaceCulling = false
  mat.disableDepthWrite = true // never punch a depth hole → no z-fight with the road
  mat.alpha = 0

  const plane: Mesh = MeshBuilder.CreatePlane("wp-roadarrow", { size: SIZE }, scene)
  plane.material = mat
  plane.rotation.x = Math.PI / 2 // lie flat on the ground (face up)
  plane.position.y = 0.08 // a hair above the road, not coplanar
  plane.isPickable = false
  plane.renderingGroupId = 0
  plane.setEnabled(false)

  let phase = 0

  const update = (dt: number) => {
    const target = opts.getTarget()
    if (!target) {
      if (plane.isEnabled()) plane.setEnabled(false)
      return
    }
    const pl = opts.getPlayer()
    const dxw = target.x - pl.x
    const dzw = target.z - pl.z
    const dist = Math.hypot(dxw, dzw)
    if (dist < NEAR_FADE) {
      // arrived (or basically) — don't nag.
      if (plane.isEnabled()) plane.setEnabled(false)
      return
    }
    if (!plane.isEnabled()) plane.setEnabled(true)

    const bearing = Math.atan2(dxw, dzw) // world yaw toward the objective (+z forward)
    // sit a few steps ahead of the player ALONG the bearing — the hint leads you.
    plane.position.x = pl.x + Math.sin(bearing) * AHEAD
    plane.position.z = pl.z + Math.cos(bearing) * AHEAD
    // the painted arrow points toward canvas -Y; with the plane lying flat that is
    // world +z, so rotate.y by the bearing to aim it at the objective.
    plane.rotation.y = bearing

    // gentle breathing so it reads as "alive" without flashing; static if reduced.
    if (reduced) {
      mat.alpha = BASE_ALPHA
    } else {
      phase = (phase + dt / 1.8) % 1 // ~1.8s loop
      const breathe = 0.82 + 0.18 * Math.sin(phase * Math.PI * 2)
      mat.alpha = BASE_ALPHA * breathe
    }
    // fade in over the last few units before NEAR_FADE so it dissolves on arrival.
    const fade = Math.min(1, (dist - NEAR_FADE) / 8)
    mat.alpha *= fade
  }

  return {
    update,
    dispose: () => {
      plane.dispose()
      mat.dispose()
      tex.dispose()
    },
  }
}
