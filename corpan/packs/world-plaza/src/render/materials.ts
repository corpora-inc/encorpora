import type { Scene } from "@babylonjs/core/scene"
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial"
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture"
import { Texture } from "@babylonjs/core/Materials/Textures/texture"
import { Color3 } from "@babylonjs/core/Maths/math"

/**
 * materials.ts — the shared PBR surface library for World Plaza's WORLD layer.
 *
 * GOAL: make the town read RICH, MODERN and DIMENSIONAL — real cobblestone
 * roads, terracotta-tiled roofs, stucco walls, flagstone plaza — while staying
 * inside a strict phone budget and keeping our warm "Antigua 1770" mood.
 *
 * HOW (the easy way, no asset dependencies):
 *  • Every surface is a `PBRMaterial` with a small, PROCEDURAL albedo texture
 *    AND a matching procedural NORMAL map painted into `<canvas>` (DynamicTexture).
 *    The normal map is what gives cobbles/tiles their relief under the sun —
 *    no extra geometry, no z-fighting, just lit bumps.
 *  • Textures are SMALL (256–512), MIP-mapped, and tile (uScale/vScale) so a
 *    single 512² cobble texture covers the whole street network.
 *  • Materials are SHARED through a per-scene cache (`MaterialLibrary`): the
 *    whole grand town uses ~6 world materials total, not one per mesh.
 *  • Metallic = 0 everywhere (this is a non-metal world); roughness is tuned
 *    per surface (wet-ish cobble a touch glossier than chalky stucco) so the
 *    sun produces soft, believable speculars instead of flat paper.
 *
 * NORMAL-MAP ENCODING. We paint a tangent-space normal map by hand: a flat
 * surface is rgb(128,128,255) (normal = +Z). We carve relief by darkening/
 * brightening the R (x-slope) and G (y-slope) channels around stone/tile edges.
 * Babylon reads it via `material.bumpTexture`. `invertNormalMapX/Y` are left
 * default (our convention matches Babylon's tangent frame for ground/roof
 * planes; verified visually).
 *
 * 3D-LOOK FORWARD-COMPAT. A future `create3DLook()` (full glTF/PBR) can import
 * THESE SAME materials for its untextured surfaces, or swap in image-based
 * albedo/normal/roughness maps behind the identical `PBRMaterial` — the Look
 * layer never assumes procedural sourcing, only that `MaterialLibrary` hands it
 * a ready PBR material by semantic name.
 */

export type SurfaceName =
  | "cobble" // street / road strips
  | "flagstone" // plaza floor
  | "dirt" // base ground under everything
  | "terracotta" // tiled roofs
  | "stucco" // building walls (shared base; buildings still vary hue via vertex/face mats)
  | "stone" // parapet / chapel / steps
  | "grass" // park / residential lawns (a soft mottled green)
  | "water" // harbour / dock water (a hazy calm blue)

export interface SurfaceTier {
  /** texture edge in px for albedo+normal. Lean phones get the smaller size. */
  texSize: number
  /** generate mipmaps (off on the very leanest tier to save memory). */
  mips: boolean
}

const FULL: SurfaceTier = { texSize: 512, mips: true }
const LEAN: SurfaceTier = { texSize: 256, mips: true }

export function pickTier(): SurfaceTier {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const small = Math.min(window.innerWidth, window.innerHeight) < 520
  return small || dpr < 2 ? LEAN : FULL
}

/* ----------------------------------------------------------------- colour */

const hexC = (s: string | undefined, fb: string): Color3 => Color3.FromHexString(s ?? fb)
const css = (c: Color3): string =>
  `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`
const mix = (a: Color3, b: Color3, t: number): Color3 =>
  new Color3(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t)
const shade = (c: Color3, t: number): Color3 =>
  t >= 0 ? mix(c, new Color3(1, 1, 1), t) : mix(c, new Color3(0, 0, 0), -t)

/* small deterministic RNG so a texture bakes identically every run. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ------------------------------------------------------- normal-map helpers */

/** soft radial bump into a normal canvas: a dome/dent of slope around (cx,cy). */
function stampBump(
  nctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  strength: number, // + = raised dome, - = dent
) {
  // Approximate a rounded bump by drawing 4 directional gradients (the slope
  // points outward on a dome). Cheap and reads great once lit.
  const steps = 10
  for (let i = steps; i >= 1; i--) {
    const f = i / steps
    const ax = rx * f
    const ay = ry * f
    // slope magnitude grows toward the rim of the dome
    const slope = strength * (1 - f) * 0.9
    // encode: edge facing +x brightens R, facing -x darkens R, etc. We fake an
    // even dome by painting a faint ring whose colour leans toward the average.
    const r = 128 + slope * 40
    const g = 128 + slope * 40
    nctx.fillStyle = `rgba(${Math.round(r)},${Math.round(g)},255,0.12)`
    nctx.beginPath()
    nctx.ellipse(cx, cy, ax, ay, 0, 0, Math.PI * 2)
    nctx.fill()
  }
}

/**
 * Carve a directional normal "groove" rectangle: the mortar lines between
 * stones/tiles. We darken one side (slope toward the groove) on the R or G
 * channel so the lit result shows a recessed seam.
 */
function grooveH(nctx: CanvasRenderingContext2D, x: number, y: number, w: number, depth: number) {
  // horizontal seam → slope in Y (G channel). top edge slopes -Y, bottom +Y.
  const g1 = nctx.createLinearGradient(0, y - depth, 0, y + depth)
  g1.addColorStop(0, "rgba(128,168,255,0.0)")
  g1.addColorStop(0.5, "rgba(128,92,255,0.55)")
  g1.addColorStop(1, "rgba(128,168,255,0.0)")
  nctx.fillStyle = g1
  nctx.fillRect(x, y - depth, w, depth * 2)
}
function grooveV(nctx: CanvasRenderingContext2D, x: number, y: number, h: number, depth: number) {
  const g1 = nctx.createLinearGradient(x - depth, 0, x + depth, 0)
  g1.addColorStop(0, "rgba(168,128,255,0.0)")
  g1.addColorStop(0.5, "rgba(92,128,255,0.55)")
  g1.addColorStop(1, "rgba(168,128,255,0.0)")
  nctx.fillStyle = g1
  nctx.fillRect(x - depth, y, depth * 2, h)
}

/* ------------------------------------------------------------- texture bakes */

interface Baked {
  albedo: DynamicTexture
  normal: DynamicTexture
}

/** the raw paint routine for one surface, drawing albedo + normal at size S. */
type SurfaceDraw = (a: CanvasRenderingContext2D, n: CanvasRenderingContext2D, S: number, flat: string) => void

/** a 2D canvas in the host DOM (offscreen — never attached). */
function makeCanvas(size: number): HTMLCanvasElement {
  const c = document.createElement("canvas")
  c.width = size
  c.height = size
  return c
}

/**
 * paintSwatch — run a surface's draw routine into a pair of plain offscreen
 * canvases (albedo + flat-primed normal). This is the SINGLE source of truth for
 * what each surface looks like; both the standalone PBR materials AND the baked
 * ground composite consume it, so the cobble on a street tile is pixel-identical
 * to the cobble baked into the ground.
 */
export interface Swatch {
  albedo: HTMLCanvasElement
  normal: HTMLCanvasElement
  size: number
}
function paintSwatch(size: number, draw: SurfaceDraw): Swatch {
  const flat = "rgb(128,128,255)"
  const albedo = makeCanvas(size)
  const normal = makeCanvas(size)
  const a = albedo.getContext("2d") as CanvasRenderingContext2D
  const n = normal.getContext("2d") as CanvasRenderingContext2D
  n.fillStyle = flat
  n.fillRect(0, 0, size, size)
  draw(a, n, size, flat)
  return { albedo, normal, size }
}

function bake(scene: Scene, name: string, tier: SurfaceTier, draw: SurfaceDraw): Baked {
  const S = tier.texSize
  const sw = paintSwatch(S, draw)
  const albedo = new DynamicTexture(`wp-mat-${name}-a`, { width: S, height: S }, scene, tier.mips)
  const normal = new DynamicTexture(`wp-mat-${name}-n`, { width: S, height: S }, scene, tier.mips)
  ;(albedo.getContext() as unknown as CanvasRenderingContext2D).drawImage(sw.albedo, 0, 0)
  ;(normal.getContext() as unknown as CanvasRenderingContext2D).drawImage(sw.normal, 0, 0)
  albedo.update(true)
  normal.update(true)
  albedo.wrapU = albedo.wrapV = Texture.WRAP_ADDRESSMODE
  normal.wrapU = normal.wrapV = Texture.WRAP_ADDRESSMODE
  return { albedo, normal }
}

/* --- COBBLESTONE: staggered rounded stones with deep mortar grooves --- */
function cobbleDraw(base: Color3, edge: Color3): SurfaceDraw {
  return (a, n, S) => {
    const r = rng(0xc0bb1e)
    a.fillStyle = css(shade(edge, -0.25)) // dark mortar base
    a.fillRect(0, 0, S, S)
    const cols = 7
    const cell = S / cols
    for (let row = -1; row <= cols; row++) {
      const off = (row & 1) * cell * 0.5
      for (let col = -1; col <= cols; col++) {
        const cx = col * cell + off + cell * 0.5
        const cy = row * cell + cell * 0.5
        const rx = cell * (0.34 + r() * 0.08)
        const ry = cell * (0.3 + r() * 0.08)
        // stone albedo: warm base, per-stone tint + soft top sheen
        const tint = shade(mix(base, edge, r() * 0.4), (r() - 0.5) * 0.18)
        a.fillStyle = css(tint)
        a.beginPath()
        a.ellipse(cx, cy, rx, ry, (r() - 0.5) * 0.5, 0, Math.PI * 2)
        a.fill()
        // top-light sheen on each stone
        const gl = a.createRadialGradient(cx, cy - ry * 0.4, 0, cx, cy, rx)
        gl.addColorStop(0, "rgba(255,250,238,0.22)")
        gl.addColorStop(1, "rgba(255,250,238,0)")
        a.fillStyle = gl
        a.beginPath()
        a.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
        a.fill()
        // NORMAL: each stone is a raised dome
        stampBump(n, cx, cy, rx, ry, 1)
      }
    }
    // deep mortar grooves on the normal map (recessed seams between rows/cols)
    for (let i = 0; i <= cols; i++) {
      grooveH(n, 0, i * cell, S, cell * 0.14)
      grooveV(n, i * cell, 0, S, cell * 0.14)
    }
  }
}

/* --- FLAGSTONE: big irregular slabs (plaza floor) --- */
function flagstoneDraw(base: Color3): SurfaceDraw {
  return (a, n, S) => {
    const r = rng(0xf1a65)
    a.fillStyle = css(shade(base, -0.22))
    a.fillRect(0, 0, S, S)
    const cols = 4
    const cell = S / cols
    for (let row = 0; row < cols; row++) {
      for (let col = 0; col < cols; col++) {
        const pad = cell * 0.06
        const jx = (r() - 0.5) * cell * 0.12
        const jy = (r() - 0.5) * cell * 0.12
        const x = col * cell + pad + jx
        const y = row * cell + pad + jy
        const w = cell - pad * 2
        const h = cell - pad * 2
        a.fillStyle = css(shade(base, (r() - 0.5) * 0.16))
        roundRect(a, x, y, w, h, cell * 0.12)
        a.fill()
        // subtle mottle
        for (let k = 0; k < 4; k++) {
          a.fillStyle = `rgba(${110 + ((r() * 40) | 0)},${100 + ((r() * 30) | 0)},${80},0.06)`
          a.beginPath()
          a.ellipse(x + r() * w, y + r() * h, cell * 0.1, cell * 0.08, 0, 0, Math.PI * 2)
          a.fill()
        }
        // gentle dome on normal + grooves around the slab
        stampBump(n, x + w / 2, y + h / 2, w * 0.5, h * 0.5, 0.5)
        grooveH(n, x - pad, y - pad, w + pad * 2, cell * 0.08)
        grooveH(n, x - pad, y + h + pad, w + pad * 2, cell * 0.08)
        grooveV(n, x - pad, y - pad, h + pad * 2, cell * 0.08)
        grooveV(n, x + w + pad, y - pad, h + pad * 2, cell * 0.08)
      }
    }
  }
}

/* --- TERRACOTTA TILE: overlapping barrel-tile rows for roofs --- */
function terracottaDraw(base: Color3): SurfaceDraw {
  return (a, n, S) => {
    const r = rng(0x7e44a)
    a.fillStyle = css(shade(base, -0.18))
    a.fillRect(0, 0, S, S)
    const rows = 8
    const rh = S / rows
    const tileW = rh * 1.15
    for (let row = 0; row < rows; row++) {
      const y = row * rh
      const off = (row & 1) * tileW * 0.5
      for (let col = -1; col * tileW < S + tileW; col++) {
        const x = col * tileW + off
        const tint = shade(base, (r() - 0.5) * 0.2)
        // barrel tile = a half-cylinder lobe; draw as a vertical rounded lobe
        const lg = a.createLinearGradient(x, 0, x + tileW, 0)
        lg.addColorStop(0, css(shade(tint, -0.28)))
        lg.addColorStop(0.5, css(shade(tint, 0.16)))
        lg.addColorStop(1, css(shade(tint, -0.28)))
        a.fillStyle = lg
        roundRect(a, x, y, tileW * 0.96, rh * 1.18, rh * 0.4)
        a.fill()
        // NORMAL: each barrel tile is a horizontal half-cylinder → slope in X.
        // left half slopes -X (R<128), right half +X (R>128).
        const ng = n.createLinearGradient(x, 0, x + tileW, 0)
        ng.addColorStop(0, "rgba(80,128,255,0.6)")
        ng.addColorStop(0.5, "rgba(128,128,255,0.6)")
        ng.addColorStop(1, "rgba(176,128,255,0.6)")
        n.fillStyle = ng
        roundRect(n, x, y, tileW * 0.96, rh * 1.18, rh * 0.4)
        n.fill()
      }
      // shadow line where the next row overlaps (recessed seam → bump in Y)
      grooveH(n, 0, y, S, rh * 0.16)
      a.fillStyle = "rgba(40,20,10,0.18)"
      a.fillRect(0, y, S, rh * 0.1)
    }
  }
}

/* --- STUCCO: chalky aged plaster, very subtle relief --- */
function stuccoDraw(base: Color3): SurfaceDraw {
  return (a, n, S) => {
    const r = rng(0x57acc0)
    const g = a.createLinearGradient(0, 0, 0, S)
    g.addColorStop(0, css(shade(base, 0.06)))
    g.addColorStop(1, css(shade(base, -0.08)))
    a.fillStyle = g
    a.fillRect(0, 0, S, S)
    // mottled aging + faint normal pits
    for (let i = 0; i < 240; i++) {
      const x = r() * S
      const y = r() * S
      const rr = 2 + r() * 6
      a.fillStyle = `rgba(${90 + ((r() * 60) | 0)},${70 + ((r() * 50) | 0)},${50},0.05)`
      a.beginPath()
      a.arc(x, y, rr, 0, Math.PI * 2)
      a.fill()
      if (r() < 0.5) stampBump(n, x, y, rr, rr, (r() - 0.5) * 0.5)
    }
  }
}

/* --- STONE: parapet / steps / chapel ashlar --- */
function stoneDraw(base: Color3): SurfaceDraw {
  return (a, n, S) => {
    const r = rng(0x570e)
    a.fillStyle = css(shade(base, -0.2))
    a.fillRect(0, 0, S, S)
    const rows = 6
    const rh = S / rows
    for (let row = 0; row < rows; row++) {
      const y = row * rh
      const off = (row & 1) * S * 0.18
      const cols = 4
      const cw = S / cols
      for (let col = -1; col <= cols; col++) {
        const x = col * cw + off
        a.fillStyle = css(shade(base, (r() - 0.5) * 0.14))
        roundRect(a, x + 2, y + 2, cw - 4, rh - 4, 3)
        a.fill()
        stampBump(n, x + cw / 2, y + rh / 2, cw * 0.45, rh * 0.4, 0.4)
      }
      grooveH(n, 0, y, S, rh * 0.1)
    }
  }
}

/* --- GRASS: soft mottled lawn (parks / residential greens) --- */
function grassDraw(base: Color3): SurfaceDraw {
  return (a, n, S) => {
    const r = rng(0x67a55)
    const g = a.createLinearGradient(0, 0, 0, S)
    g.addColorStop(0, css(shade(base, 0.08)))
    g.addColorStop(1, css(shade(base, -0.1)))
    a.fillStyle = g
    a.fillRect(0, 0, S, S)
    // mottled blades/patches + faint relief so the lawn isn't a flat slab.
    for (let i = 0; i < 360; i++) {
      const x = r() * S
      const y = r() * S
      const rr = 1.5 + r() * 5
      const t = (r() - 0.5) * 0.32
      a.fillStyle = css(shade(base, t))
      a.beginPath()
      a.ellipse(x, y, rr, rr * (0.5 + r() * 0.5), r() * Math.PI, 0, Math.PI * 2)
      a.fill()
      if (r() < 0.4) stampBump(n, x, y, rr, rr, (r() - 0.5) * 0.6)
    }
  }
}

/* --- WATER: calm hazy dock water (gentle horizontal ripple bands) --- */
function waterDraw(base: Color3): SurfaceDraw {
  return (a, n, S) => {
    const r = rng(0x4a7e2)
    const g = a.createLinearGradient(0, 0, 0, S)
    g.addColorStop(0, css(shade(base, 0.1)))
    g.addColorStop(1, css(shade(base, -0.14)))
    a.fillStyle = g
    a.fillRect(0, 0, S, S)
    // soft horizontal ripple streaks for a calm, glassy surface.
    const rows = 14
    const rh = S / rows
    for (let row = 0; row < rows; row++) {
      const y = row * rh + (r() - 0.5) * rh * 0.5
      const t = (r() - 0.5) * 0.18
      a.fillStyle = `${css(shade(base, t))}`
      a.globalAlpha = 0.35
      a.fillRect(0, y, S, rh * (0.4 + r() * 0.4))
      a.globalAlpha = 1
      // shallow sinusoid bump for a lazy swell on the normal map.
      grooveH(n, 0, y, S, rh * 0.22)
    }
    // a few bright glints
    for (let i = 0; i < 40; i++) {
      a.fillStyle = "rgba(255,255,255,0.10)"
      a.beginPath()
      a.ellipse(r() * S, r() * S, 1 + r() * 3, 1 + r() * 1.5, 0, 0, Math.PI * 2)
      a.fill()
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/* ----------------------------------- palette + per-surface tuning (shared) */

type Palette = Record<string, string> | undefined

/** Resolve the named palette colours once (shared by materials AND ground bake). */
function resolveColors(p: Palette) {
  return {
    roadBase: hexC(p?.road, "#b9a079"),
    roadEdge: hexC(p?.roadEdge, "#9c8462"),
    plaza: hexC(p?.plaza ?? p?.groundAlt, "#e3d3ad"),
    dirt: hexC(p?.ground, "#d9c7a3"),
    roof: hexC(p?.roof, "#b05a3c"),
    wall: hexC(p?.building ?? p?.wall, "#e7d4ad"),
    stone: hexC(p?.stone, "#d8cdb8"),
    // CITY surfaces — fixed, palette-overridable keys so a SINGLE shared grass /
    // water material serves the whole city (no per-chunk recolor → no per-chunk
    // bake). The defaults are the warm-key lawn green + calm dock blue the old
    // per-chunk palette produced.
    grass: hexC(p?.grass, "#7da25a"),
    water: hexC(p?.water, "#7fb3c4"),
  }
}

interface SurfaceSpec {
  draw: SurfaceDraw
  roughness: number
  normalScale: number
  bright: number
}

/** The single source of truth for "what surface N looks like" given a palette. */
function surfaceSpec(name: SurfaceName, p: Palette): SurfaceSpec {
  const c = resolveColors(p)
  switch (name) {
    case "cobble":
      return { draw: cobbleDraw(c.roadBase, c.roadEdge), roughness: 0.82, normalScale: 1.1, bright: 0.9 }
    case "flagstone":
      return { draw: flagstoneDraw(c.plaza), roughness: 0.8, normalScale: 0.7, bright: 0.92 }
    case "dirt":
      return { draw: stuccoDraw(c.dirt), roughness: 0.95, normalScale: 0.4, bright: 0.88 }
    case "terracotta":
      return { draw: terracottaDraw(c.roof), roughness: 0.58, normalScale: 1.3, bright: 1.08 }
    case "stucco":
      return { draw: stuccoDraw(c.wall), roughness: 0.9, normalScale: 0.5, bright: 0.95 }
    case "stone":
      return { draw: stoneDraw(c.stone), roughness: 0.85, normalScale: 0.7, bright: 0.96 }
    case "grass":
      return { draw: grassDraw(c.grass), roughness: 0.96, normalScale: 0.45, bright: 0.9 }
    case "water":
      // calmer + a touch glossier so the sun lays a soft sheen on the dock water.
      return { draw: waterDraw(c.water), roughness: 0.42, normalScale: 0.5, bright: 0.98 }
  }
}

/* common PBR tone tuning, identical for every world surface (warm diorama). */
function tunePBR(mat: PBRMaterial, spec: SurfaceSpec) {
  mat.bumpTexture!.level = spec.normalScale
  mat.metallic = 0
  mat.roughness = spec.roughness
  mat.emissiveColor = new Color3(0.018, 0.015, 0.012)
  mat.directIntensity = 0.62
  mat.environmentIntensity = 0
  mat.specularIntensity = 0.32
  mat.usePhysicalLightFalloff = false
  mat.albedoTexture!.coordinatesIndex = 0
  mat.albedoColor = new Color3(spec.bright, spec.bright * 0.985, spec.bright * 0.96)
}

/* ----------------------------------------------------------- the library */

interface MatEntry {
  mat: PBRMaterial
  baked: Baked
}

/**
 * MaterialLibrary — a per-scene cache of the shared PBR surfaces. Created once
 * by a Look, handed to roads/buildings/etc., disposed when the Look unmounts.
 *
 * Each material is a `PBRMaterial`:
 *   metallic = 0, roughness tuned per surface, albedoTexture + bumpTexture from
 *   the procedural bake, a faint emissive lift so deep shadow never goes black
 *   (keeps the warm diorama read), no environment texture (we light with the
 *   engine's hemi+sun rig — cheap, no IBL cost on phones).
 */
export class MaterialLibrary {
  private cache = new Map<SurfaceName, MatEntry>()
  private tier: SurfaceTier
  constructor(private scene: Scene, private palette: Record<string, string> | undefined, tier?: SurfaceTier) {
    this.tier = tier ?? pickTier()
  }

  private build(name: SurfaceName): MatEntry {
    const spec = surfaceSpec(name, this.palette)
    const baked = bake(this.scene, name, this.tier, spec.draw)
    const mat = new PBRMaterial(`wp-world-${name}`, this.scene)
    mat.albedoTexture = baked.albedo
    mat.bumpTexture = baked.normal
    tunePBR(mat, spec)
    return { mat, baked }
  }

  /** get-or-build a shared PBR material for a semantic surface. */
  get(name: SurfaceName): PBRMaterial {
    const hit = this.cache.get(name)
    if (hit) return hit.mat
    const e = this.build(name)
    this.cache.set(name, e)
    return e.mat
  }

  /**
   * Tiling helper. Because surfaces are tiled by world size, the consumer asks
   * for how many texture repeats it wants across a mesh of a given world size.
   * We DO NOT mutate the shared texture's uScale (that would affect every user);
   * instead each mesh sets its own UVs, OR — for ground planes that all want the
   * same density — the consumer can read `metersPerTile` and scale UVs. We expose
   * the texture so a consumer that owns the only user of a surface (e.g. plaza)
   * can set uScale directly.
   */
  texturesFor(name: SurfaceName): Baked {
    this.get(name)
    return this.cache.get(name)!.baked
  }

  dispose() {
    for (const e of this.cache.values()) {
      e.mat.dispose(true, true)
      e.baked.albedo.dispose()
      e.baked.normal.dispose()
    }
    this.cache.clear()
  }
}

/* ===================================================================== */
/* SINGLE-MESH GROUND BAKE — the permanent z-fight fix.                  */
/* ===================================================================== */

/**
 * A region of the ground, painted with a given surface. Coordinates are in
 * WORLD units (XZ); the bake maps them into the ground texture so a street is
 * the same cobble size everywhere.
 */
export type GroundRegion =
  | { kind: "rect"; surface: SurfaceName; cx: number; cz: number; w: number; d: number; metersPerTile: number }
  | { kind: "disc"; surface: SurfaceName; cx: number; cz: number; r: number; metersPerTile: number }

export interface GroundBakeInput {
  /** world bounds of the ground plane (matches the single ground mesh). */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  /** the base fill (dirt) everywhere, with its tiling. */
  base: { surface: SurfaceName; metersPerTile: number }
  /** painted on top of the base, in order (later wins). */
  regions: GroundRegion[]
  /** texels per WORLD unit in the baked ground texture (controls sharpness). */
  texelsPerUnit?: number
  /** hard cap on the baked texture edge (phone memory budget). */
  maxEdge?: number
}

export interface GroundBake {
  /** ONE PBR material carrying the whole composited ground (albedo + normal). */
  material: PBRMaterial
  albedo: DynamicTexture
  normal: DynamicTexture
  dispose: () => void
}

/**
 * bakeGround — composite the ENTIRE ground (dirt + every cobble street + the
 * flagstone plaza + door aprons) into ONE albedo texture and ONE normal texture,
 * then return ONE PBR material for ONE ground mesh.
 *
 * WHY THIS IS THE REAL FIX (not another offset). The flicker was z-fighting:
 * four near-coplanar ground planes (dirt/road/apron/plaza) fought for the depth
 * buffer, and the old Y-tier + zOffset stack only HID it at the angles that were
 * tested. By painting the road network INTO the single ground surface there is
 * exactly ONE floor polygon at exactly ONE depth — there is physically nothing
 * to z-fight, at ANY angle, forever. No Y tiers, no polygon offset.
 *
 * Shimmer at grazing distance is handled on the texture side: mipmaps ON +
 * anisotropicFilteringLevel 16 + TRILINEAR sampling.
 *
 * The look is preserved exactly: each region is filled with a tiled PATTERN of
 * the SAME procedural swatch the standalone material would use, so the cobble
 * here is pixel-identical to the cobble the material library bakes.
 */
export function bakeGround(scene: Scene, palette: Palette, input: GroundBakeInput, tier?: SurfaceTier): GroundBake {
  const t = tier ?? pickTier()
  const { minX, maxX, minZ, maxZ } = input.bounds
  const worldW = maxX - minX
  const worldD = maxZ - minZ
  // texels per world unit: enough that a ~2.4u cobble cell still shows its
  // stones, but lean enough that the whole-town ground stays in a phone's memory
  // budget (one albedo + one normal map, mipmapped). FULL ≈ 1.6k², LEAN ≈ 1.1k².
  const tpu = input.texelsPerUnit ?? (t === LEAN ? 13 : 18)
  const maxEdge = input.maxEdge ?? (t === LEAN ? 1536 : 2048)
  // square texture (keeps aspect by using the larger world span)
  const span = Math.max(worldW, worldD)
  const edge = Math.min(maxEdge, Math.max(1024, Math.round(span * tpu)))

  const albedoC = makeCanvas(edge)
  const normalC = makeCanvas(edge)
  const ac = albedoC.getContext("2d") as CanvasRenderingContext2D
  const nc = normalC.getContext("2d") as CanvasRenderingContext2D
  // world → texel: same scale on both axes (square texture covers `span`).
  const s = edge / span
  // world point (wx,wz) maps to texel: u = (wx-minX)*s, v = (wz-minZ)*s.
  // (note: a smaller world axis just leaves a margin painted with the base — the
  //  ground mesh is sized to `span` so this is exactly covered.)
  const tx = (wx: number) => (wx - minX) * s
  const tz = (wz: number) => (wz - minZ) * s

  // cache one swatch per surface so we don't re-bake.
  const swatches = new Map<SurfaceName, Swatch>()
  const swatchFor = (name: SurfaceName): Swatch => {
    let sw = swatches.get(name)
    if (!sw) {
      sw = paintSwatch(t.texSize, surfaceSpec(name, palette).draw)
      swatches.set(name, sw)
    }
    return sw
  }

  /**
   * Build a CanvasPattern whose stone size matches `metersPerTile` world units.
   * We pre-scale the swatch into a tile-sized canvas and use a plain "repeat"
   * pattern at native size — this is robust across engines (no reliance on the
   * patchily-supported `CanvasPattern.setTransform`) and keeps the stones crisp.
   */
  const tileCache = new Map<string, CanvasPattern>()
  function patternFor(
    ctx: CanvasRenderingContext2D,
    src: HTMLCanvasElement,
    metersPerTile: number,
    key: string,
  ): CanvasPattern {
    const hit = tileCache.get(key)
    if (hit) return hit
    // one swatch should cover `metersPerTile` world units → `metersPerTile * s`
    // texels in the ground texture. Pre-render the swatch at that size.
    const tilePx = Math.max(4, Math.round(metersPerTile * s))
    const tileC = makeCanvas(tilePx)
    const tctx = tileC.getContext("2d") as CanvasRenderingContext2D
    tctx.imageSmoothingEnabled = true
    tctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, tilePx, tilePx)
    const pattern = ctx.createPattern(tileC, "repeat")!
    tileCache.set(key, pattern)
    return pattern
  }

  function fillRegion(region: GroundRegion, albedo: boolean) {
    const ctx = albedo ? ac : nc
    const sw = swatchFor(region.surface)
    const src = albedo ? sw.albedo : sw.normal
    const key = `${region.surface}:${albedo ? "a" : "n"}:${region.metersPerTile}`
    const pattern = patternFor(ctx, src, region.metersPerTile, key)
    ctx.save()
    ctx.beginPath()
    if (region.kind === "rect") {
      const x = tx(region.cx - region.w / 2)
      const y = tz(region.cz - region.d / 2)
      ctx.rect(x, y, region.w * s, region.d * s)
    } else {
      ctx.ellipse(tx(region.cx), tz(region.cz), region.r * s, region.r * s, 0, 0, Math.PI * 2)
    }
    ctx.clip()
    ctx.fillStyle = pattern
    // pattern transform already carries scale; just fill the clipped area.
    ctx.fillRect(0, 0, edge, edge)
    ctx.restore()
  }

  // 1) base fill (dirt albedo + dirt normal) over the WHOLE texture.
  {
    const sw = swatchFor(input.base.surface)
    const layers: Array<[HTMLCanvasElement, CanvasRenderingContext2D, string]> = [
      [sw.albedo, ac, "a"],
      [sw.normal, nc, "n"],
    ]
    for (const [src, ctx, tag] of layers) {
      const key = `${input.base.surface}:${tag}:${input.base.metersPerTile}`
      const pattern = patternFor(ctx, src, input.base.metersPerTile, key)
      ctx.fillStyle = pattern
      ctx.fillRect(0, 0, edge, edge)
    }
  }
  // 2) every region on top (streets, aprons, plaza), albedo then normal.
  for (const region of input.regions) {
    fillRegion(region, true)
    fillRegion(region, false)
  }

  // upload to GPU textures (mipmaps ON for distance anti-shimmer).
  const albedo = new DynamicTexture(
    "wp-ground-albedo",
    { width: edge, height: edge },
    scene,
    true,
    Texture.TRILINEAR_SAMPLINGMODE,
  )
  const normal = new DynamicTexture(
    "wp-ground-normal",
    { width: edge, height: edge },
    scene,
    true,
    Texture.TRILINEAR_SAMPLINGMODE,
  )
  ;(albedo.getContext() as unknown as CanvasRenderingContext2D).drawImage(albedoC, 0, 0)
  ;(normal.getContext() as unknown as CanvasRenderingContext2D).drawImage(normalC, 0, 0)
  albedo.update(true)
  normal.update(true)
  // the ground mesh's UVs span 0..1 across `span`; we do NOT tile (the texture is
  // already the full world), so CLAMP avoids edge bleed.
  albedo.wrapU = albedo.wrapV = Texture.CLAMP_ADDRESSMODE
  normal.wrapU = normal.wrapV = Texture.CLAMP_ADDRESSMODE
  // KILL SHIMMER at grazing angles: max anisotropy (mipmaps already on).
  albedo.anisotropicFilteringLevel = 16
  normal.anisotropicFilteringLevel = 16

  const mat = new PBRMaterial("wp-ground", scene)
  mat.albedoTexture = albedo
  mat.bumpTexture = normal
  // tone: use the dirt surface's tuning as the base (the ground is mostly dirt;
  // cobble/flagstone bright deltas are tiny and the warm range holds for all).
  tunePBR(mat, surfaceSpec(input.base.surface, palette))
  // ground gets a touch MORE normal so the cobble relief still reads through one
  // shared map (the per-surface materials used normalScale ~1.1 for cobble).
  mat.bumpTexture.level = 0.85

  return {
    material: mat,
    albedo,
    normal,
    dispose: () => {
      mat.dispose(true, true)
      albedo.dispose()
      normal.dispose()
    },
  }
}
