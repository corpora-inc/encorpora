import type { Scene } from "@babylonjs/core/scene"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import { Color3 } from "@babylonjs/core/Maths/math"

/**
 * vista.ts — the SIGNATURE LANDMARK on the far horizon (Mount Fuji, the Eiffel
 * Tower, a colonial cathedral, a neon skyline…). This is the emotional payoff of
 * the larger, sparser map + the low cruise camera: a hero shape sitting FAR out
 * on the horizon line that you walk toward.
 *
 * Design choices (all in service of "feels FAR + stable"):
 *   • A single textured BILLBOARD silhouette — painted procedurally per `kind`
 *     onto a DynamicTexture. Cheap (one draw call, one texture), trivially
 *     extensible (add a painter to LANDMARK_PAINTERS).
 *   • Parked at a large FIXED world radius (FAR), well beyond play bounds and
 *     comfortably inside the camera far plane — never clips, never collides,
 *     never pickable. It does NOT ride the camera, so it has genuine but very
 *     SLOW parallax as the player crosses the (relatively tiny) map.
 *   • Base planted on the ground plane (y=0) so it reads as standing ON the
 *     horizon line, not floating.
 *   • Yaw-billboards so the silhouette always faces the player squarely; the
 *     painter bakes in atmospheric HAZE + tint so it reads as distant air, and
 *     fog is disabled on it (its haze is baked, so fog density never erases it).
 */

export interface LandmarkLook {
  kind: string // 'mount-fuji' | 'eiffel' | 'cathedral' | 'skyline' | 'volcano' | …
  tintHex?: string // base silhouette tint (atmospheric haze is layered on top)
  label?: string
  azimuth?: number // radians around the horizon, 0 = +Z (looking "north")
  scale?: number // relative size multiplier (1 = default hero size)
}

export interface Vista {
  root: Mesh
  dispose: () => void
}

/** Where the landmark lives. Far enough to feel like a horizon, inside maxZ. */
const VISTA_RADIUS = 360 // world units from origin (camera maxZ is 600)
/**
 * Hero silhouette HEIGHT in world units at scale=1. Tuned so that, parked at
 * VISTA_RADIUS with its BASE on the ground (horizon line), its top rises a
 * commanding amount above the horizon from a low cruise camera — a hero peak
 * that draws the eye, not a faint smudge. The WIDTH is derived per-kind from
 * its aspect ratio (a peak is wide, a tower is narrow).
 */
const VISTA_HEIGHT = 150
/** Texture vertical resolution; width scales with each kind's aspect. */
const TEX_H = 1024

let uid = 0

type Ctx = CanvasRenderingContext2D
/**
 * A painter draws a silhouette filling the [0..w, 0..h] canvas — TOP of the
 * structure near y=0, BASE planted at y=h. It should use the FULL canvas height
 * so the landmark reads at a consistent on-screen size regardless of kind.
 */
type LandmarkPainter = (ctx: Ctx, w: number, h: number, tint: Color3) => void

/** A landmark definition: its silhouette painter + intrinsic width:height. */
interface LandmarkDef {
  aspect: number // width / height of the silhouette (peak≈wide, tower≈narrow)
  paint: LandmarkPainter
}

const css = (c: Color3, a = 1): string =>
  `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`

const mix = (a: Color3, b: Color3, t: number): Color3 =>
  new Color3(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t)

// ---------------------------------------------------------------- painters ---
// Each painter draws a flat-ish silhouette grounded at the canvas bottom. Keep
// them simple: a couple of fills/strokes is plenty at horizon distance. To add
// a new landmark, write a painter and register it in LANDMARK_PAINTERS below.

/** Mount Fuji — a broad snow-capped cone. */
const paintMountFuji: LandmarkPainter = (ctx, w, h, tint) => {
  const baseY = h
  const peakX = w * 0.5
  const peakY = h * 0.06
  const halfBase = w * 0.49
  // body
  ctx.beginPath()
  ctx.moveTo(peakX - halfBase, baseY)
  // gentle concave Fuji flanks
  ctx.quadraticCurveTo(peakX - halfBase * 0.28, h * 0.42, peakX, peakY)
  ctx.quadraticCurveTo(peakX + halfBase * 0.28, h * 0.42, peakX + halfBase, baseY)
  ctx.closePath()
  ctx.fillStyle = css(tint)
  ctx.fill()
  // snow cap (lighter), with a jagged lower edge
  const snowY = h * 0.4
  const snow = mix(tint, new Color3(1, 1, 1), 0.7)
  ctx.beginPath()
  ctx.moveTo(peakX - halfBase * 0.34, snowY)
  ctx.quadraticCurveTo(peakX - halfBase * 0.18, h * 0.3, peakX, peakY)
  ctx.quadraticCurveTo(peakX + halfBase * 0.18, h * 0.3, peakX + halfBase * 0.34, snowY)
  // drips
  ctx.lineTo(peakX + halfBase * 0.22, snowY + h * 0.06)
  ctx.lineTo(peakX + halfBase * 0.08, snowY)
  ctx.lineTo(peakX - halfBase * 0.06, snowY + h * 0.07)
  ctx.lineTo(peakX - halfBase * 0.2, snowY)
  ctx.closePath()
  ctx.fillStyle = css(snow, 0.95)
  ctx.fill()
}

/** Volcano — Fuji's cousin with a flattened/notched crater + ember glow. */
const paintVolcano: LandmarkPainter = (ctx, w, h, tint) => {
  const baseY = h
  const cx = w * 0.5
  const rimY = h * 0.22
  const halfBase = w * 0.44
  const craterHalf = w * 0.1
  ctx.beginPath()
  ctx.moveTo(cx - halfBase, baseY)
  ctx.quadraticCurveTo(cx - halfBase * 0.3, h * 0.36, cx - craterHalf, rimY)
  ctx.lineTo(cx + craterHalf, rimY)
  ctx.quadraticCurveTo(cx + halfBase * 0.3, h * 0.36, cx + halfBase, baseY)
  ctx.closePath()
  ctx.fillStyle = css(tint)
  ctx.fill()
  // ember glow at the crater
  const glow = ctx.createRadialGradient(cx, rimY, 0, cx, rimY, craterHalf * 1.6)
  glow.addColorStop(0, "rgba(255,140,60,0.85)")
  glow.addColorStop(0.5, "rgba(255,90,40,0.35)")
  glow.addColorStop(1, "rgba(255,90,40,0)")
  ctx.fillStyle = glow
  ctx.fillRect(cx - craterHalf * 2, rimY - craterHalf * 1.6, craterHalf * 4, craterHalf * 2)
}

/** Eiffel Tower — a tapering lattice silhouette with the signature curve. */
const paintEiffel: LandmarkPainter = (ctx, w, h, tint) => {
  const cx = w * 0.5
  const baseY = h * 0.98
  const topY = h * 0.05
  // half-width as a function of height fraction (0 top → 1 base): flared legs.
  const halfAt = (t: number) => w * (0.02 + 0.26 * Math.pow(t, 1.9))
  ctx.fillStyle = css(tint)
  // outline (left up, right down) — the iconic concave flare
  ctx.beginPath()
  const N = 24
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const y = baseY + (topY - baseY) * t
    ctx.lineTo(cx - halfAt(1 - t), y)
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N
    const y = baseY + (topY - baseY) * t
    ctx.lineTo(cx + halfAt(1 - t), y)
  }
  ctx.closePath()
  ctx.fill()
  // two horizontal platforms (the first + second decks)
  ctx.fillStyle = css(mix(tint, new Color3(0, 0, 0), 0.15))
  const deck = (frac: number, hh: number) => {
    const t = frac
    const y = baseY + (topY - baseY) * t
    const half = halfAt(1 - t) * 1.15
    ctx.fillRect(cx - half, y - hh / 2, half * 2, hh)
  }
  deck(0.34, h * 0.018)
  deck(0.62, h * 0.014)
  // a tiny mast at the very top
  ctx.fillRect(cx - w * 0.006, topY - h * 0.03, w * 0.012, h * 0.03)
}

/** Antigua cathedral — a broad facade with TWIN baroque bell towers. */
const paintCathedral: LandmarkPainter = (ctx, w, h, tint) => {
  const baseY = h
  ctx.fillStyle = css(tint)
  // main body / nave
  const bodyTop = h * 0.5
  const bodyHalf = w * 0.3
  ctx.fillRect(w * 0.5 - bodyHalf, bodyTop, bodyHalf * 2, baseY - bodyTop)
  // central pediment
  ctx.beginPath()
  ctx.moveTo(w * 0.5 - bodyHalf, bodyTop)
  ctx.lineTo(w * 0.5, h * 0.38)
  ctx.lineTo(w * 0.5 + bodyHalf, bodyTop)
  ctx.closePath()
  ctx.fill()
  // twin towers
  const towerW = w * 0.13
  const towerTop = h * 0.2
  const tower = (cx: number) => {
    ctx.fillStyle = css(tint)
    ctx.fillRect(cx - towerW / 2, towerTop, towerW, baseY - towerTop)
    // domed cap
    ctx.beginPath()
    ctx.moveTo(cx - towerW / 2, towerTop)
    ctx.quadraticCurveTo(cx, towerTop - h * 0.09, cx + towerW / 2, towerTop)
    ctx.closePath()
    ctx.fill()
    // little cross/finial
    ctx.fillRect(cx - w * 0.004, towerTop - h * 0.12, w * 0.008, h * 0.045)
  }
  tower(w * 0.5 - bodyHalf * 0.78)
  tower(w * 0.5 + bodyHalf * 0.78)
  // a small central dome
  ctx.fillStyle = css(tint)
  ctx.beginPath()
  ctx.arc(w * 0.5, bodyTop, w * 0.07, Math.PI, 0)
  ctx.fill()
}

/** Neon skyline — a jagged ridge of high-rises with lit windows (Tokyo-2050). */
const paintSkyline: LandmarkPainter = (ctx, w, h, tint) => {
  const baseY = h
  // deterministic pseudo-random so the skyline is stable frame to frame.
  let s = 1337
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  const dark = mix(tint, new Color3(0, 0, 0), 0.35)
  let x = 0
  const accents = [
    new Color3(0.3, 1, 0.95), // cyan
    new Color3(1, 0.35, 0.8), // magenta
    new Color3(0.7, 0.5, 1), // violet
  ]
  while (x < w) {
    const bw = w * (0.04 + rnd() * 0.06)
    const bh = h * (0.28 + rnd() * 0.6)
    const top = baseY - bh
    ctx.fillStyle = css(mix(dark, tint, rnd() * 0.5))
    ctx.fillRect(x, top, bw + 1, bh)
    // lit windows
    const acc = accents[Math.floor(rnd() * accents.length)]
    const cols = Math.max(1, Math.floor(bw / (w * 0.018)))
    const rows = Math.max(2, Math.floor(bh / (h * 0.04)))
    for (let cI = 0; cI < cols; cI++) {
      for (let rI = 0; rI < rows; rI++) {
        if (rnd() > 0.4) continue
        const wx = x + (cI + 0.3) * (bw / cols)
        const wy = top + (rI + 0.3) * (bh / rows)
        ctx.fillStyle = css(acc, 0.5 + rnd() * 0.4)
        ctx.fillRect(wx, wy, bw / cols * 0.4, bh / rows * 0.35)
      }
    }
    x += bw + w * 0.006
  }
}

// Registry of landmark kinds. To add a new landmark: write a painter (fill the
// full canvas height, base at the bottom) and add one entry here with its
// intrinsic aspect (silhouette width ÷ height). Nothing else changes.
const LANDMARKS: Record<string, LandmarkDef> = {
  "mount-fuji": { aspect: 1.7, paint: paintMountFuji },
  volcano: { aspect: 1.7, paint: paintVolcano },
  eiffel: { aspect: 0.62, paint: paintEiffel },
  cathedral: { aspect: 1.55, paint: paintCathedral },
  skyline: { aspect: 3.4, paint: paintSkyline },
}

/** Kinds this vista layer can render (handy for authoring/validation). */
export const VISTA_KINDS = Object.keys(LANDMARKS)

const hex = (s: string | undefined, fallback: string): Color3 =>
  Color3.FromHexString(s ?? fallback)

/**
 * createVista — render the Scene's landmark on the far horizon. No-op (returns a
 * null-ish handle) when no landmark is authored. Atmospheric `hazeColor` (≈ the
 * sky horizon band) is baked into the silhouette so it reads as distant air and
 * never fights the fog.
 */
export function createVista(
  scene: Scene,
  landmark: LandmarkLook | undefined,
  opts: { hazeColor?: Color3 } = {},
): Vista | null {
  if (!landmark) return null
  const def = LANDMARKS[landmark.kind]
  if (!def) {
    console.warn(
      `[corpan-city] vista: unknown landmark kind "${landmark.kind}" — ` +
        `known: ${VISTA_KINDS.join(", ")}. Skipping.`,
    )
    return null
  }

  const id = `wp-vista-${uid++}`
  const tint = hex(landmark.tintHex, "#4a5f86") // hazy blue-grey default
  const haze = opts.hazeColor ?? hex(undefined, "#cfe2ea")

  // Bake atmospheric perspective: lean the silhouette tint toward the haze so it
  // sits "in the air", but keep enough CONTRAST that the silhouette clearly
  // reads against the pale horizon band (over-hazing makes it vanish). Distant
  // peaks are a soft blue-grey clearly DARKER than the sky — not sky-coloured.
  const airTint = mix(tint, haze, 0.14)

  // Canvas matches the kind's aspect so painters fill it; texels stay ~square.
  const texW = Math.round(TEX_H * def.aspect)
  const tex = new DynamicTexture(`${id}-tex`, { width: texW, height: TEX_H }, scene, true)
  tex.hasAlpha = true
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
  ctx.clearRect(0, 0, texW, TEX_H)
  def.paint(ctx, texW, TEX_H, airTint)
  // A soft haze wash over the lowest sliver — the base dissolves into the
  // horizon line so it never looks pasted-on (kept thin so it doesn't eat the
  // structure).
  const wash = ctx.createLinearGradient(0, TEX_H, 0, TEX_H * 0.82)
  wash.addColorStop(0, css(haze, 0.8))
  wash.addColorStop(1, css(haze, 0))
  ctx.globalCompositeOperation = "source-atop" // only over the silhouette
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, texW, TEX_H)
  ctx.globalCompositeOperation = "source-over"
  tex.update()

  const mat = new StandardMaterial(`${id}-mat`, scene)
  mat.diffuseTexture = tex
  mat.useAlphaFromDiffuseTexture = true
  mat.emissiveColor = new Color3(1, 1, 1) // self-lit (it's a distant flat)
  mat.disableLighting = true
  mat.specularColor = new Color3(0, 0, 0)
  mat.backFaceCulling = false
  mat.alpha = 0.97

  const scale = landmark.scale ?? 1
  const height = VISTA_HEIGHT * scale
  const width = height * def.aspect // kind-specific footprint (peak wide, tower narrow)

  const plane = MeshBuilder.CreatePlane(id, { width, height }, scene)
  plane.material = mat
  // Yaw-billboard so the silhouette always faces the player squarely.
  plane.billboardMode = Mesh.BILLBOARDMODE_Y

  // Park it far out on the horizon at the authored azimuth (0 = +Z). Base on the
  // ground plane → plane centre is half its height up.
  const az = landmark.azimuth ?? 0
  plane.position.set(Math.sin(az) * VISTA_RADIUS, height / 2, Math.cos(az) * VISTA_RADIUS)

  // Never interact: no pick, no collide; fog OFF (haze is baked) so density
  // can't erase the hero.
  plane.isPickable = false
  plane.checkCollisions = false
  plane.applyFog = false
  // Render in the SAME group as the world (group 0) so it shares ONE depth
  // buffer: the foreground town (closer) correctly OCCLUDES the distant vista.
  // (renderingGroupId 1 broke this — Babylon auto-clears depth between groups,
  // so a group-1 vista had no group-0 depth to test against and painted OVER the
  // buildings.) The sky dome is `infiniteDistance` (always at the far plane), so
  // it can never occlude the vista at radius 360. depth-WRITE off keeps the
  // transparent silhouette from punching a depth hole; depth-TEST stays on so
  // the town occludes it — a backdrop you walk in front of, never a wall.
  plane.renderingGroupId = 0
  mat.disableDepthWrite = true
  mat.needDepthPrePass = false

  return {
    root: plane,
    dispose: () => {
      plane.dispose()
      mat.dispose()
      tex.dispose()
    },
  }
}
