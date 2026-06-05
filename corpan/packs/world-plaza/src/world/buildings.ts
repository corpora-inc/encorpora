import type { Scene } from "@babylonjs/core/scene"
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder"
import { Mesh } from "@babylonjs/core/Meshes/mesh"
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData"
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer"
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture"
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial"
import type { Material } from "@babylonjs/core/Materials/material"
import { Color3, Vector3 } from "@babylonjs/core/Maths/math"
import type { MaterialLibrary } from "../render/materials"
import { drawFacade, paper, rounded, type FacadeSpec } from "./facadePaint"
import { createFacadePainter, type FacadePainter } from "./facadePainter"

/**
 * buildings.ts — PREMIUM colonial paper-cutout buildings for World Plaza.
 *
 * Replaces sceneRenderer's inline terracotta box with a varied, lovable town of
 * 3D stucco buildings in the warm "Antigua 1770" key. Each collision blocker
 * becomes a handsome building chosen (by `kinds` hint or deterministically by
 * seed+index) from a family of KINDS — house / shop / inn / chapel / workshop /
 * market-hall — each with its own silhouette, roof form, and street furniture.
 *
 * DESIGN GOALS
 *  • Reads great from an orbiting 3rd-person follow camera (these are real 3D
 *    volumes, not billboards) AT MULTIPLE ANGLES — so all four walls are dressed.
 *  • Paper-cutout charm: warm stucco palette family, terracotta/tiled roofs,
 *    framed shuttered windows + a street-facing door, awnings, hanging signs,
 *    balconies, stoops. The fine detail lives in DynamicTexture FACADE DECALS
 *    (painted in the torn-paper style) blitted onto the wall faces — cheap.
 *  • Hand-made variety: a deterministic per-building RNG nudges height, hue,
 *    window count, trim — so a street looks built, not stamped.
 *
 * PERFORMANCE (target: 20+ buildings @ 60fps on a phone)
 *  • Every building's solid geometry (walls + roof + chimney + parapet + dome)
 *    is built from cheap boxes/cylinders/prisms then MERGED into ONE mesh with
 *    multiMultiMaterials → a single mesh object per building, a handful of
 *    submeshes sharing a SMALL pool of materials.
 *  • Materials are SHARED + cached by quantized key (stucco hue bucket, roof
 *    kind). A town of 20 buildings uses ~6–10 materials total, not 20×N.
 *  • Facade textures are cached by (kind, footprint bucket, variant) so similar
 *    shops on a street reuse one texture+material.
 *  • Every static mesh calls freezeWorldMatrix(); roots are frozen too.
 *  • A soft contact shadow disc per building (one shared dark material).
 *
 * Draw-call budget: ~1 merged building mesh (1–4 submesh draws) + 1 shadow +
 * 1–2 facade-decal planes per building. With shared materials the GPU batches
 * aggressively; measured well under the per-frame budget for a full plaza.
 */

/* --------------------------------------------------------------- public API */

export interface BuildingsHandle {
  /** the parent node holding every building; useful for bulk transforms. */
  root: Mesh
  dispose: () => void
}

export interface Blocker {
  x: number
  z: number
  w: number
  d: number
}

export type BuildingKind = "house" | "shop" | "inn" | "chapel" | "workshop" | "market-hall"

/**
 * A CITY-LIFETIME shared façade cache: the `MatPool` (materials) + `TexPool`
 * (painted DynamicTextures) live for the whole city, NOT per chunk. A façade
 * variant (its cache key: kind × footprint-bucket × variant × palette) is
 * painted + uploaded ONCE and reused by every chunk that needs it.
 *
 * DISPOSAL CONTRACT (critical): a `BuildingPool` is owned by the CITY. It is
 * created once (`createBuildingPool`) and freed once (`pool.dispose()`) on CITY
 * teardown. `createBuildings` called WITH a `pool` NEVER disposes it — a chunk's
 * `dispose` frees only that chunk's own meshes, leaving the shared textures/
 * materials intact for the other chunks still using them.
 */
export interface BuildingPool {
  /** @internal shared material cache (kind/hue/roof keyed). */
  mats: MatPool
  /** @internal shared facade-texture cache (kind/footprint/variant keyed). */
  texs: TexPool
  /** free the shared materials + textures — call ONCE on city dispose. */
  dispose: () => void
}

/**
 * Create the shared, city-lifetime façade cache. Pass the returned pool to every
 * `createBuildings` call (one per chunk) via `opts.pool` so all chunks share one
 * set of painted façade textures + materials. Dispose it ONLY on city teardown.
 */
export function createBuildingPool(scene: Scene): BuildingPool {
  const mats = new MatPool(scene, "wp-bldg")
  // ONE façade painter (OffscreenCanvas worker) for the whole city — façade paints
  // run off the main thread when supported, else fall back to a main-thread paint.
  const painter = createFacadePainter()
  const texs = new TexPool(scene, "wp-bldg", painter)
  return {
    mats,
    texs,
    dispose: () => {
      mats.dispose()
      texs.dispose()
      painter.dispose()
    },
  }
}

export interface CreateBuildingsOpts {
  palette?: Record<string, string>
  /** door/portal anchors used to orient each building's street-facing door. */
  doors?: Array<{ x: number; z: number; facing?: number }>
  /**
   * SHARED city-lifetime façade cache (materials + textures). When supplied, the
   * façade variants are painted ONCE for the whole city and reused across chunks,
   * and this call's `dispose` frees ONLY its own building meshes — never the
   * shared pool (the city owns + frees that). When ABSENT (standalone previews),
   * a private pool is created and disposed with this handle.
   */
  pool?: BuildingPool
  /** per-blocker kind hint (parallel to `blockers`); falls back to seed choice. */
  kinds?: string[]
  seed?: number
  /**
   * Shared PBR surface library (from the Look). When present, the solid
   * BODY WALLS, ROOFS, and STONE use the dimensional normal-mapped PBR surfaces
   * (terracotta tile / stucco / ashlar) for a richer, lit read; the painted
   * paper-cutout facade decals (windows/doors/signs) still ride on top. When
   * absent (standalone previews), buildings fall back to the flat StandardMaterial
   * pool so the module still works in isolation.
   */
  materials?: MaterialLibrary
  /**
   * Scene-driven building SKIN token. The SAME footprints/blockers render under
   * a different art key:
   *   • "antigua-stucco" (or absent) — the warm colonial stucco/terracotta/
   *     sloped-roof look (the default).
   *   • "tokyo-neon" — taller, cooler glass/concrete blocks with flat roofs and
   *     emissive neon trim + signage. Same blockers, divergent skin.
   * This is THE building half of Scene divergence (Antigua 1770 ⇄ Tokyo 2050):
   * collisions/layout are identical, only the rendered skin flips.
   */
  buildingStyle?: string
}

const KINDS: BuildingKind[] = ["house", "shop", "inn", "chapel", "workshop", "market-hall"]

/* ----------------------------------------------------------- human scale */

/**
 * CHARACTER WORLD HEIGHT (H_p). The grounded paper-cutout plane is 2.6 world
 * units tall (render/cutout.ts `PLANE_H`), and the painted figure fills nearly
 * all of it, so a person reads as ≈2.6 wu standing on the ground.
 *
 * This is the FIXED reference the whole town is scaled to. We never shrink the
 * character (it's the readable HD-2D yardstick) — instead buildings, storeys and
 * doors are sized as MULTIPLES of H_p so the world fits the people who walk it.
 *
 * Targets (the believability/proportions gate):
 *   • a ground-floor DOOR  ≈ 1.15–1.3 × H_p  (a person visibly fits through)
 *   • a single STOREY      ≈ 1.45–1.6 × H_p
 *   • a 2-storey building   ≈ 3–4 × H_p, downtown towers taller still.
 */
const H_P = 2.6
/** base world height of ONE storey, before per-building jitter + style scale. */
const STOREY_BASE = H_P * 1.46 // ≈ 3.8 wu — a storey a person clears comfortably

/* ----------------------------------------------------------- building style */

export type BuildingStyleId = "antigua-stucco" | "tokyo-neon"

/**
 * A building STYLE is the small set of knobs that flip the whole town between
 * eras WITHOUT touching footprints/collisions:
 *   • palette defaults (wall/roof/trim/stone/accent) when the Scene palette is
 *     silent on a key — warm stucco vs cool glass/concrete;
 *   • proportions (storey height, how tall blocks read);
 *   • roof policy (sloped/varied vs flat tech roofs);
 *   • neon — emissive trim + signage glow for the night city.
 */
interface BuildingStyle {
  id: BuildingStyleId
  /** palette key → fallback hex, used only when the Scene palette omits it. */
  defaults: {
    building: string
    buildingAlt: string
    roof: string
    trim: string
    stone: string
    accent: string
  }
  /** vertical scale on storey height — Tokyo towers read taller. */
  storeyScale: number
  /** force every roof flat (tech rooftops) when true. */
  flatRoofs: boolean
  /** neon city: emissive trim bands, glowing signs, cool glass. */
  neon: boolean
}

const STYLES: Record<BuildingStyleId, BuildingStyle> = {
  "antigua-stucco": {
    id: "antigua-stucco",
    defaults: {
      building: "#e7d4ad",
      buildingAlt: "#dcc59a",
      roof: "#b05a3c",
      trim: "#7a4a2c",
      stone: "#d8cdb8",
      accent: "#c46b4a",
    },
    storeyScale: 1,
    flatRoofs: false,
    neon: false,
  },
  "tokyo-neon": {
    id: "tokyo-neon",
    defaults: {
      // cool glass/concrete blocks under a night sky
      building: "#26304a",
      buildingAlt: "#1d2740",
      roof: "#10182b",
      trim: "#3de0ff", // cyan neon trim
      stone: "#2a3350",
      accent: "#ff4ddb", // magenta neon accent
    },
    storeyScale: 1.55,
    flatRoofs: true,
    neon: true,
  },
}

function resolveStyle(token?: string): BuildingStyle {
  if (token === "tokyo-neon") return STYLES["tokyo-neon"]
  return STYLES["antigua-stucco"]
}

/* ------------------------------------------------------------------- colour */

type RGB = { r: number; g: number; b: number }

const hexToRgb = (hex: string): RGB => {
  const c = Color3.FromHexString(hex)
  return { r: c.r, g: c.g, b: c.b }
}
const rgbToCss = (c: RGB): string =>
  `rgb(${Math.round(clamp01(c.r) * 255)},${Math.round(clamp01(c.g) * 255)},${Math.round(clamp01(c.b) * 255)})`
const rgbToColor3 = (c: RGB): Color3 => new Color3(clamp01(c.r), clamp01(c.g), clamp01(c.b))
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
const mixRgb = (a: RGB, b: RGB, t: number): RGB => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
})
const shade = (c: RGB, t: number): RGB =>
  t >= 0 ? mixRgb(c, { r: 1, g: 1, b: 1 }, t) : mixRgb(c, { r: 0, g: 0, b: 0 }, -t)

/** small deterministic RNG (mulberry32) keyed per building. */
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

/* ------------------------------------------------------------- warm palette */

interface Palette {
  stucco: RGB // warm wall base
  stuccoAlt: RGB // a second wall family for variety
  roof: RGB // terracotta
  trim: RGB // door/shutter wood
  stone: RGB // chapel / parapet stone
  accent: RGB // awnings / signs pop
}

/** pull a colour toward its own grey (luminance) by t — calms candy saturation. */
const desat = (c: RGB, t: number): RGB => {
  const l = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b
  return mixRgb(c, { r: l, g: l, b: l }, t)
}

function resolvePalette(p: Record<string, string> | undefined, style: BuildingStyle): Palette {
  const d = style.defaults
  let accent = hexToRgb(p?.accent ?? d.accent)
  let trim = hexToRgb(p?.trim ?? d.trim)
  const building = hexToRgb(p?.building ?? p?.wall ?? d.building)
  // BELIEVABILITY: the warm daytime town reads better with restrained accents.
  // Over-saturated scene accents (bright candy orange) and a cool teal trim look
  // toy-ish next to the stucco; gently desaturate so awnings/shutters feel like
  // weathered paint, not plastic. (Skipped for the neon night skin, which WANTS
  // its electric trim.)
  if (!style.neon) {
    accent = desat(accent, 0.26)
    trim = desat(trim, 0.18)
  }
  return {
    stucco: building,
    stuccoAlt: hexToRgb(p?.buildingAlt ?? d.buildingAlt),
    roof: hexToRgb(p?.roof ?? d.roof),
    trim,
    stone: hexToRgb(p?.stone ?? d.stone),
    accent,
  }
}

/* per-building stucco hue, bucketed so similar buildings share a material. */
function stuccoFor(pal: Palette, r: () => number): { rgb: RGB; bucket: number } {
  // pick between the two wall families, then nudge warmth within a few buckets
  const family = r() < 0.5 ? pal.stucco : pal.stuccoAlt
  const bucket = Math.floor(r() * 4) // 0..3
  const warmth = (bucket - 1.5) * 0.06
  const rgb = shade(mixRgb(family, { r: 0.96, g: 0.82, b: 0.58 }, Math.max(0, warmth)), warmth * 0.4)
  const key = (family === pal.stucco ? 0 : 1) * 4 + bucket
  return { rgb, bucket: key }
}

/* ------------------------------------------------------ material cache pool */

class MatPool {
  private cache = new Map<string, StandardMaterial>()
  constructor(private scene: Scene, private tag: string) {}
  solid(key: string, rgb: RGB, emissive = 0.34): StandardMaterial {
    const ck = `s:${key}`
    const hit = this.cache.get(ck)
    if (hit) return hit
    const m = new StandardMaterial(`${this.tag}-${ck}`, this.scene)
    m.diffuseColor = rgbToColor3(rgb)
    m.emissiveColor = rgbToColor3(rgb).scale(emissive) // lift flats so the sun adds shape, not gloom
    m.specularColor = new Color3(0, 0, 0)
    m.freeze()
    this.cache.set(ck, m)
    return m
  }
  /** a pure-emissive "neon" material — glows the same colour unlit (night city). */
  neon(key: string, rgb: RGB, gain = 1.6): StandardMaterial {
    const ck = `n:${key}`
    const hit = this.cache.get(ck)
    if (hit) return hit
    const m = new StandardMaterial(`${this.tag}-${ck}`, this.scene)
    const c = rgbToColor3(rgb)
    m.diffuseColor = new Color3(0, 0, 0)
    m.emissiveColor = c.scale(gain) // > 1 → blooms toward white-hot core under tonemap
    m.specularColor = new Color3(0, 0, 0)
    m.disableLighting = true // neon ignores the sun; it IS the light
    m.freeze()
    this.cache.set(ck, m)
    return m
  }
  /** material backed by a (cached) DynamicTexture facade; alpha for decals. */
  textured(key: string, tex: DynamicTexture, alpha: boolean): StandardMaterial {
    const ck = `t:${key}`
    const hit = this.cache.get(ck)
    if (hit) return hit
    const m = new StandardMaterial(`${this.tag}-${ck}`, this.scene)
    m.diffuseTexture = tex
    if (alpha) {
      m.diffuseTexture.hasAlpha = true
      m.useAlphaFromDiffuseTexture = true
    }
    m.emissiveColor = new Color3(0.5, 0.5, 0.5)
    m.specularColor = new Color3(0, 0, 0)
    // facades are flat planes on building faces; after MergeMeshes the winding
    // can face either way, so keep both sides drawn (the wall behind is opaque).
    m.backFaceCulling = false
    m.freeze()
    this.cache.set(ck, m)
    return m
  }
  has(prefix: "s" | "t", key: string): boolean {
    return this.cache.has(`${prefix}:${key}`)
  }
  get(prefix: "s" | "t", key: string): StandardMaterial | undefined {
    return this.cache.get(`${prefix}:${key}`)
  }
  dispose() {
    for (const m of this.cache.values()) {
      const dt = m.diffuseTexture
      m.dispose()
      dt?.dispose()
    }
    this.cache.clear()
  }
}

/* a separate cache for facade textures, keyed independently of materials. */
class TexPool {
  private cache = new Map<string, DynamicTexture>()
  private disposed = false
  constructor(private scene: Scene, private tag: string, private painter?: FacadePainter) {}

  /** SYNCHRONOUS main-thread paint (used for the small one-off sign/awning
   *  textures, and as the façade fallback when the worker isn't available). */
  get(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void): DynamicTexture {
    const hit = this.cache.get(key)
    if (hit) return hit
    const tex = new DynamicTexture(`${this.tag}-fx-${this.cache.size}`, { width: w, height: h }, this.scene, true)
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
    ctx.clearRect(0, 0, w, h)
    draw(ctx, w, h)
    tex.update()
    this.cache.set(key, tex)
    return tex
  }

  /**
   * Get-or-paint a FAÇADE texture. Stage 3: when the OffscreenCanvas worker is
   * available, the texture is created BLANK immediately (so the building's
   * geometry/material flow is unchanged — it always gets a real texture back NOW)
   * and the actual canvas2D paint runs OFF the main thread; when the worker
   * returns the `ImageBitmap` a few frames later we blit it in + update (a cheap
   * GPU upload, never the paint). The façade is briefly blank stucco until then —
   * but each variant is painted ONCE for the whole city, so it's a one-time,
   * sub-second fill on first appearance. Without worker support we paint inline
   * exactly as before (no behaviour change).
   */
  getFacade(key: string, w: number, h: number, spec: FacadeSpec): DynamicTexture {
    const hit = this.cache.get(key)
    if (hit) return hit
    // No worker → synchronous main-thread paint (identical to the old path).
    if (!this.painter || !this.painter.supported) {
      return this.get(key, w, h, (c, ww, hh) => drawFacade(c, ww, hh, spec))
    }
    // Worker path: blank texture now, fill on bitmap arrival.
    const tex = new DynamicTexture(`${this.tag}-fx-${this.cache.size}`, { width: w, height: h }, this.scene, true)
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
    // prime with the façade's stucco base so a not-yet-painted wall reads as wall,
    // not a transparent hole, in the (sub-second) window before the bitmap lands.
    ctx.fillStyle = rgbToCss(spec.stucco)
    ctx.fillRect(0, 0, w, h)
    tex.update()
    this.cache.set(key, tex)
    this.painter
      .paintFacade(w, h, spec)
      .then((bitmap) => {
        // The worker resolves async; the world may have been torn down (exit to
        // Corpán home) in the meantime. Touching `tex.update()` on a disposed
        // engine throws `_getEngine() is null`. Bail if we've been disposed.
        if (this.disposed) {
          bitmap?.close?.()
          return
        }
        if (!bitmap) {
          // worker failed for this paint → fall back to a main-thread paint so the
          // façade is never left as the blank prime.
          ctx.clearRect(0, 0, w, h)
          drawFacade(ctx, w, h, spec)
          tex.update()
          return
        }
        // cheap GPU-side upload: blit the worker's bitmap into the texture canvas.
        try {
          ctx.clearRect(0, 0, w, h)
          ;(ctx as unknown as { drawImage: (b: ImageBitmap, x: number, y: number) => void }).drawImage(bitmap, 0, 0)
          tex.update()
        } catch (e) {
          console.error("[world-plaza/buildings] façade bitmap upload failed", e)
        }
        bitmap.close?.()
      })
      .catch((e) => {
        if (this.disposed) return
        console.error("[world-plaza/buildings] façade worker paint rejected → main-thread fallback", e)
        ctx.clearRect(0, 0, w, h)
        drawFacade(ctx, w, h, spec)
        tex.update()
      })
    return tex
  }

  dispose() {
    this.disposed = true
    for (const t of this.cache.values()) t.dispose()
    this.cache.clear()
  }
}

/* ----------------------------------------------------- paper-cutout drawing */
//
// The façade painter (tornRect / rounded / paper / drawWindow / drawDoor /
// drawFacade + FacadeSpec) now lives in the PURE `facadePaint.ts` module so it
// can run in an OffscreenCanvas worker OR on the main thread (Stage 3 — moving
// the paint off the main thread for the startup-spike + mobile headroom). It is
// imported above. The small one-off `drawSign`/`drawAwning` textures below are
// painted on the main thread (tiny, not worth a worker round-trip) and reuse the
// shared `paper`/`rounded` helpers from the same module.

/* a hanging shop sign drawn on its own little alpha plane. */
function drawSign(ctx: CanvasRenderingContext2D, w: number, h: number, board: string, glyph: string) {
  ctx.clearRect(0, 0, w, h)
  // bracket arm
  ctx.strokeStyle = "#3b2a1a"
  ctx.lineWidth = w * 0.03
  ctx.beginPath()
  ctx.moveTo(w * 0.08, h * 0.08)
  ctx.lineTo(w * 0.5, h * 0.18)
  ctx.stroke()
  // hanging board
  paper(ctx, w * 0.2, h * 0.22, w * 0.6, h * 0.5, w * 0.06, board, { deckle: 4, shadow: 6 })
  // painted glyph (a simple cup/loaf/bed/cross suggestion via a shape)
  ctx.fillStyle = "rgba(40,28,16,0.85)"
  ctx.font = `bold ${Math.floor(h * 0.32)}px Georgia, serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(glyph, w * 0.5, h * 0.48)
}

/* awning strip (striped, scalloped) for shops/inns, drawn on alpha plane. */
function drawAwning(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string) {
  ctx.clearRect(0, 0, w, h)
  const ah = h * 0.62
  paper(ctx, 0, 0, w, ah, w * 0.02, accent, { torn: false, deckle: 3, shadow: 5 })
  ctx.save()
  rounded(ctx, 0, 0, w, ah, w * 0.02)
  ctx.clip()
  ctx.fillStyle = "rgba(255,255,255,0.82)"
  const stripes = 8
  for (let i = 0; i < stripes; i += 2) ctx.fillRect((w / stripes) * i, 0, w / stripes, ah)
  ctx.restore()
  // scalloped lower edge
  ctx.fillStyle = accent
  const scal = 9
  for (let i = 0; i < scal; i++) {
    ctx.beginPath()
    ctx.arc((w / scal) * (i + 0.5), ah, w / scal / 2, 0, Math.PI)
    ctx.fill()
  }
}

/* facade canvas (FacadeSpec + drawFacade) → moved to facadePaint.ts (worker-able). */

/* ------------------------------------------------------- geometry: prisms */

let guid = 0

/** a triangular gable prism (extruded triangle) running along X (ridge on Z?). */
function gablePrism(scene: Scene, name: string, len: number, halfBase: number, height: number, alongX: boolean): Mesh {
  // triangle cross-section in the plane perpendicular to the ridge
  const m = new Mesh(name, scene)
  const positions: number[] = []
  const indices: number[] = []
  const normals: number[] = []
  // cross-section verts: left-base, right-base, apex (y up)
  // we build two end caps + sides
  const L = len / 2
  // along X: ridge runs along X; cross-section in (z,y)
  const cs = (sign: number): [number, number, number][] =>
    alongX
      ? [
          [sign * L, 0, -halfBase],
          [sign * L, 0, halfBase],
          [sign * L, height, 0],
        ]
      : [
          [-halfBase, 0, sign * L],
          [halfBase, 0, sign * L],
          [0, height, sign * L],
        ]
  const a = cs(-1)
  const b = cs(1)
  const push = (p: [number, number, number]) => positions.push(p[0], p[1], p[2])
  // two triangular caps
  a.forEach(push)
  b.forEach(push)
  indices.push(0, 1, 2) // -cap
  indices.push(5, 4, 3) // +cap (reversed winding)
  // three quad sides connecting a[i]->a[i+1] to b
  const quad = (i: number, j: number) => {
    const ai = i,
      aj = j,
      bi = i + 3,
      bj = j + 3
    indices.push(ai, bj, bi, ai, aj, bj)
  }
  quad(0, 1)
  quad(1, 2)
  quad(2, 0)
  VertexData.ComputeNormals(positions, indices, normals)
  // flat UVs (roof is a solid colour material — UVs just keep the attribute set
  // consistent so this prism can MERGE with boxes/cylinders, which carry UVs).
  // We seed planar UVs (along the ridge length vs up the slope) here; the caller
  // rescales them to world-space tiling via projectRoofUVs so the terracotta
  // tile size is consistent across roofs.
  const uvs: number[] = []
  for (let i = 0; i < positions.length / 3; i++) {
    const px = positions[i * 3]
    const py = positions[i * 3 + 1]
    const pz = positions[i * 3 + 2]
    const u = alongX ? px : pz // along the ridge
    const v = py // up the slope (rows of tiles)
    uvs.push(u, v)
  }
  // Double-side the roof. The raised cruise-cam now sees the eaves' UNDERSIDES
  // and the triangular GABLE end-caps; a single-sided prism leaves those faces
  // back-face-culled → the roof reads see-through from below and the gable looks
  // uncovered. Append a mirrored copy (same positions, negated normals, reversed
  // winding) so every roof face is solid from both sides. Cheap (roofs only).
  const vCount = positions.length / 3
  const backPositions = positions.slice()
  const backNormals = normals.map((n) => -n)
  const backUvs = uvs.slice()
  const backIndices: number[] = []
  for (let k = 0; k < indices.length; k += 3) {
    backIndices.push(indices[k] + vCount, indices[k + 2] + vCount, indices[k + 1] + vCount)
  }
  positions.push(...backPositions)
  normals.push(...backNormals)
  uvs.push(...backUvs)
  indices.push(...backIndices)
  const vd = new VertexData()
  vd.positions = positions
  vd.indices = indices
  vd.normals = normals
  vd.uvs = uvs
  vd.applyToMesh(m)
  return m
}

/* one terracotta "tile cell" ≈ this many world units (roof tile size). */
const ROOF_WORLD = 1.0

/**
 * Rescale a roof's seeded UVs (gablePrism emits world-unit UVs) so the
 * terracotta texture tiles at a consistent world density. `lenU`/`lenV` are the
 * world extents the seeded UVs span.
 */
function projectRoofUVs(mesh: Mesh, lenU: number, lenV: number) {
  const uvs = mesh.getVerticesData(VertexBuffer.UVKind)
  if (!uvs) return
  // seeded UVs are already in world units (px / py); just divide by tile size.
  for (let i = 0; i < uvs.length; i++) uvs[i] /= ROOF_WORLD
  mesh.updateVerticesData(VertexBuffer.UVKind, uvs)
  void lenU
  void lenV
}

/** scale a built-in mesh's 0..1 UVs to world-space tile density via bbox size. */
function bakeWorldUVs(mesh: Mesh) {
  const uvs = mesh.getVerticesData(VertexBuffer.UVKind)
  if (!uvs) return
  mesh.computeWorldMatrix(true)
  const bb = mesh.getBoundingInfo().boundingBox
  const ext = bb.extendSize
  const su = Math.max(1, (ext.x * 2 * (mesh.scaling.x || 1)) / ROOF_WORLD)
  const sv = Math.max(1, (ext.z * 2 * (mesh.scaling.z || 1)) / ROOF_WORLD)
  for (let i = 0; i < uvs.length; i += 2) {
    uvs[i] *= su
    uvs[i + 1] *= sv
  }
  mesh.updateVerticesData(VertexBuffer.UVKind, uvs)
}

/* ----------------------------------------------------------- one building */

interface BuiltKindParams {
  storeys: number
  roof: "gabled" | "hipped" | "flat" | "dome"
  windowsPerRow: number
  awning: boolean
  sign: string | null // glyph or null
  balcony: boolean
  parapet: boolean
}

function paramsFor(kind: BuildingKind, r: () => number, style: BuildingStyle): BuiltKindParams {
  const base = paramsForBase(kind, r)
  if (style.flatRoofs) {
    // Tokyo: every block gets a flat tech rooftop, but keep the parapet on the
    // market hall and ADD parapets to taller blocks so they read as city towers.
    return { ...base, roof: "flat", parapet: base.parapet || base.storeys >= 2 }
  }
  return base
}

function paramsForBase(kind: BuildingKind, r: () => number): BuiltKindParams {
  switch (kind) {
    case "chapel":
      return { storeys: 1, roof: "dome", windowsPerRow: 2, awning: false, sign: "✚", balcony: false, parapet: false }
    case "inn": {
      // mid-rise hotels: 3–5 storeys, the taller ones flat-roofed (city blocks).
      const storeys = r() < 0.45 ? 3 : r() < 0.8 ? 4 : 5
      return { storeys, roof: storeys >= 4 ? "flat" : "hipped", windowsPerRow: 3, awning: true, sign: "🛏", balcony: true, parapet: storeys >= 4 }
    }
    case "shop": {
      // 2–4 storeys: ground-floor shopfront, apartments above (a real high street).
      const storeys = r() < 0.4 ? 2 : r() < 0.78 ? 3 : 4
      return { storeys, roof: storeys >= 4 ? "flat" : r() < 0.5 ? "gabled" : "hipped", windowsPerRow: storeys >= 3 ? 3 : 2, awning: true, sign: "☕", balcony: storeys >= 3 && r() < 0.5, parapet: storeys >= 4 }
    }
    case "workshop": {
      const storeys = r() < 0.45 ? 1 : r() < 0.85 ? 2 : 3
      return { storeys, roof: storeys >= 3 ? "flat" : "gabled", windowsPerRow: 2, awning: false, sign: "⚒", balcony: false, parapet: storeys >= 3 }
    }
    case "market-hall": {
      // a grand single hall, or a taller arcade block downtown.
      const tall = r() < 0.35
      return { storeys: tall ? 3 : 1, roof: "flat", windowsPerRow: 4, awning: !tall, sign: null, balcony: false, parapet: true }
    }
    case "house":
    default: {
      // townhouses: 2–4 storeys, the tallest reading as a narrow city terrace.
      const storeys = r() < 0.45 ? 2 : r() < 0.82 ? 3 : 4
      return { storeys, roof: storeys >= 4 ? "flat" : r() < 0.5 ? "gabled" : "hipped", windowsPerRow: 2, awning: false, sign: null, balcony: storeys >= 3 && r() < 0.45, parapet: storeys >= 4 }
    }
  }
}

/* facing: which wall (+x,-x,+z,-z) the door/front should be on. We pick the
 * wall whose outward normal best points toward the nearest door anchor (and,
 * failing that, toward the plaza centre at 0,0). Returns the yaw the building
 * "front" faces and the side index. */
function frontFacing(b: Blocker, doors: Array<{ x: number; z: number; facing?: number }> | undefined): { dir: Vector3; side: "px" | "nx" | "pz" | "nz" } {
  // candidate outward directions
  const cands: Array<{ dir: Vector3; side: "px" | "nx" | "pz" | "nz" }> = [
    { dir: new Vector3(1, 0, 0), side: "px" },
    { dir: new Vector3(-1, 0, 0), side: "nx" },
    { dir: new Vector3(0, 0, 1), side: "pz" },
    { dir: new Vector3(0, 0, -1), side: "nz" },
  ]
  // target point: nearest door anchor, else origin
  let target = new Vector3(0, 0, 0)
  if (doors && doors.length) {
    let best = Infinity
    for (const d of doors) {
      const dist = (d.x - b.x) ** 2 + (d.z - b.z) ** 2
      if (dist < best) {
        best = dist
        target = new Vector3(d.x, 0, d.z)
      }
    }
  }
  const to = new Vector3(target.x - b.x, 0, target.z - b.z)
  if (to.lengthSquared() < 1e-4) to.set(-b.x, 0, -b.z) // toward origin
  to.normalize()
  let best = cands[0]
  let bestDot = -Infinity
  for (const c of cands) {
    const dot = c.dir.x * to.x + c.dir.z * to.z
    if (dot > bestDot) {
      bestDot = dot
      best = c
    }
  }
  return best
}

const sideYaw: Record<string, number> = { pz: 0, nz: Math.PI, px: Math.PI / 2, nx: -Math.PI / 2 }

function buildOne(
  scene: Scene,
  b: Blocker,
  kind: BuildingKind,
  pal: Palette,
  mats: MatPool,
  texs: TexPool,
  doors: Array<{ x: number; z: number; facing?: number }> | undefined,
  seed: number,
  parent: Mesh,
  lib: MaterialLibrary | undefined,
  style: BuildingStyle,
): Mesh[] {
  const r = rng(seed)
  const p = paramsFor(kind, r, style)
  const stucco = stuccoFor(pal, r)
  // Storey height keyed to the character (H_p): one storey ≈ 1.45–1.6 × H_p so a
  // person clears the ceiling. A small plinth/cornice band (≈0.2 × H_p) lifts the
  // ground floor onto its stone base. Taller buildings get marginally LEANER
  // storeys (a tower's floors aren't as lofty as a cottage's) so a 5-storey block
  // still reads as a believable city building, not a stack of barns.
  const leanForTall = p.storeys >= 3 ? 1 - (p.storeys - 2) * 0.06 : 1
  const storeyH = (STOREY_BASE + r() * 0.35) * leanForTall * style.storeyScale
  const bodyH = p.storeys * storeyH + H_P * 0.22
  const front = frontFacing(b, doors)
  const facadeWidth = front.side === "px" || front.side === "nx" ? b.d : b.w

  // ---- gather geometry pieces to MERGE (each gets a material applied first) ----
  const pieces: Mesh[] = []
  const extra: Mesh[] = [] // non-merged (textured-alpha decals, shadow)

  // body
  const body = MeshBuilder.CreateBox(`wp-b-${guid}`, { width: b.w, height: bodyH, depth: b.d }, scene)
  body.position.set(0, bodyH / 2, 0)
  const stuccoMat = mats.solid(`stucco${stucco.bucket}`, stucco.rgb)
  body.material = stuccoMat
  pieces.push(body)

  // ---- facade textures on the FRONT (and a simpler one on other walls) ----
  // Textures are STRETCHED over the plane (UV 0..1), so we don't need a unique
  // texture per exact footprint — we quantize into a few buckets so a street of
  // similar shops SHARES one texture+material. Variety still reads (kind, stucco
  // hue, storeys, window count, roof, trim all vary); the wall art is reused.
  // 256² (was 512²): these are mid-distance background walls in an HD-2D world —
  // 512 was 4× the GPU texture memory for no visible gain (the full-city façade
  // set went from ~190 MB → ~48 MB). Fixed aspect → plane stretch handles real
  // proportions.
  const texW = 256
  const texH = 256
  const widthBucket = facadeWidth >= 4 ? "w" : "n" // wide / narrow
  // bucket the world body height so cached facades paint a door sized to the
  // RIGHT building height (the door is computed from bodyWorldH). Coarse (0.5wu)
  // so a street of same-storey shops still shares one texture+material.
  const hBucket = Math.round(bodyH * 2)
  const facadeKey = `${kind}-${p.storeys}-${p.windowsPerRow}-${stucco.bucket}-${widthBucket}-${hBucket}`
  const spec: FacadeSpec = {
    kind,
    storeys: p.storeys,
    windowsPerRow: p.windowsPerRow,
    stucco: stucco.rgb,
    trim: pal.trim,
    hasDoor: true,
    arched: kind === "chapel" || kind === "inn",
    variant: 0,
    // Night city: cool lit-cyan windows + no colonial flower-boxes.
    glass: style.neon ? "#bff6ff" : undefined,
    noFlowers: style.neon,
    bodyWorldH: bodyH,
  }
  // Stage 3: route façade painting through the worker-aware pool (off-thread when
  // supported, main-thread fallback otherwise). Geometry/material flow unchanged —
  // `getFacade` always returns a real texture NOW.
  const frontTex = texs.getFacade(`front-${facadeKey}`, texW, texH, spec)
  const frontMat = mats.textured(`front-${facadeKey}`, frontTex, false)
  // side facade: same but no door
  const sideWidthBucket = (front.side === "px" || front.side === "nx" ? b.w : b.d) >= 4 ? "w" : "n"
  const sideKey = `${kind}-${p.storeys}-${p.windowsPerRow}-${stucco.bucket}-${sideWidthBucket}`
  const sideTex = texs.getFacade(`side-${sideKey}`, texW, texH, { ...spec, hasDoor: false })
  const sideMat = mats.textured(`side-${sideKey}`, sideTex, false)

  // helper to add a wall-face decal plane (proud 0.02)
  const addFace = (side: "px" | "nx" | "pz" | "nz", mat: StandardMaterial, ww: number) => {
    const plane = MeshBuilder.CreatePlane(`wp-f-${guid}`, { width: ww, height: bodyH }, scene)
    plane.material = mat
    const eps = 0.02
    switch (side) {
      case "pz":
        plane.position.set(0, bodyH / 2, b.d / 2 + eps)
        break
      case "nz":
        plane.position.set(0, bodyH / 2, -b.d / 2 - eps)
        plane.rotation.y = Math.PI
        break
      case "px":
        plane.position.set(b.w / 2 + eps, bodyH / 2, 0)
        plane.rotation.y = Math.PI / 2
        break
      case "nx":
        plane.position.set(-b.w / 2 - eps, bodyH / 2, 0)
        plane.rotation.y = -Math.PI / 2
        break
    }
    pieces.push(plane)
  }
  // front gets the door facade; the other 3 walls get the windowed side facade.
  const sides: Array<"px" | "nx" | "pz" | "nz"> = ["pz", "nz", "px", "nx"]
  for (const s of sides) {
    const isXWall = s === "px" || s === "nx"
    const ww = isXWall ? b.d : b.w
    addFace(s, s === front.side ? frontMat : sideMat, ww)
  }

  // ---- ROOF + STONE (PBR-surfaced, SEPARATE from the merged body) ----
  //
  // Z-FIGHTING — KILLED BY CONSTRUCTION. The old roofs sat with their BASE FACE
  // exactly at y=bodyH, coplanar with the body box TOP face → depth fight (the
  // "flat roof flicker"). And the flat roof was a single coplanar slab whose
  // edges fought the parapet boxes. Fixes, by construction:
  //   • Every roof is EMBEDDED: its base is dropped EMBED units BELOW bodyH so
  //     no roof face is ever coplanar with the body top. The overhang hides the
  //     seam; the body top is fully capped → no exposed coplanar pair.
  //   • The flat roof is no longer a bare slab: it gets a gentle CENTRE STEP
  //     (two stacked slabs of different footprint) so it reads as a real, tiered
  //     terrace, and the parapet sits ON TOP of the lower slab (its base above
  //     the slab top, never coplanar).
  //   • Roofs/stone are NOT merged into the body, so they carry their own real
  //     UVs for the terracotta/stone PBR tiling and keep independent depth.
  // Roofs get terracotta PBR; stone bits get the ashlar PBR (when a library is
  // supplied) — otherwise the flat StandardMaterial pool (standalone fallback).
  // tokyo-neon overrides the warm PBR terracotta/ashlar with cool flat concrete:
  // a night city has dark flat roofs + concrete parapets, not terracotta tile.
  const useWarmPBR = lib && !style.neon
  const roofMat: Material = useWarmPBR ? lib.get("terracotta") : mats.solid("roof", pal.roof)
  const stoneMat: Material = useWarmPBR ? lib.get("stone") : mats.solid("stone", pal.stone)
  const roofOverhang = 0.35
  const EMBED = 0.22 // how far a roof base is sunk below bodyH (kills coplanar fight)
  const roofPieces: Mesh[] = []
  if (p.roof === "gabled") {
    const ridgeAlongX = b.w >= b.d
    const len = (ridgeAlongX ? b.w : b.d) + roofOverhang * 2
    const halfBase = ((ridgeAlongX ? b.d : b.w) + roofOverhang * 2) / 2
    const rh = halfBase * 0.85
    const roof = gablePrism(scene, `wp-r-${guid}`, len, halfBase, rh, ridgeAlongX)
    roof.position.set(0, bodyH - EMBED, 0)
    roof.material = roofMat
    projectRoofUVs(roof, ridgeAlongX ? len : halfBase * 2, rh)
    roofPieces.push(roof)
  } else if (p.roof === "hipped") {
    const roof = MeshBuilder.CreateCylinder(`wp-r-${guid}`, { diameterTop: 0, diameterBottom: 1, height: 1, tessellation: 4 }, scene)
    const rw = b.w + roofOverhang * 2
    const rd = b.d + roofOverhang * 2
    const rh = Math.min(rw, rd) * 0.5
    roof.scaling.set(rw, rh, rd)
    roof.rotation.y = Math.PI / 4
    roof.position.set(0, bodyH - EMBED + rh / 2, 0)
    roof.material = roofMat
    bakeWorldUVs(roof) // cylinder caps/sides already carry UVs; just scale below
    roofPieces.push(roof)
  } else if (p.roof === "flat") {
    // TIERED terrace: a lower wide slab + a smaller raised centre step, so it is
    // a believable rooftop, not a flicker-prone single plane.
    const lowH = 0.2
    const low = MeshBuilder.CreateBox(`wp-r-${guid}`, { width: b.w + roofOverhang, height: lowH, depth: b.d + roofOverhang }, scene)
    low.position.set(0, bodyH - EMBED + lowH / 2, 0)
    low.material = roofMat
    roofPieces.push(low)
    const topH = 0.16
    const inset = 0.9
    const hi = MeshBuilder.CreateBox(`wp-r2-${guid}`, { width: Math.max(1, b.w - inset), height: topH, depth: Math.max(1, b.d - inset) }, scene)
    hi.position.set((r() - 0.5) * 0.6, bodyH - EMBED + lowH + topH / 2, (r() - 0.5) * 0.6)
    hi.material = roofMat
    roofPieces.push(hi)
    if (p.parapet) {
      const ph = 0.5
      const th = 0.22
      // parapet base sits ON the lower slab top (not coplanar with body top).
      const baseY = bodyH - EMBED + lowH
      const mk = (w: number, dd: number, x: number, z: number) => {
        const m = MeshBuilder.CreateBox(`wp-pp-${guid}`, { width: w, height: ph, depth: dd }, scene)
        m.position.set(x, baseY + ph / 2, z)
        m.material = stoneMat
        roofPieces.push(m)
      }
      const pw = b.w + roofOverhang
      const pd = b.d + roofOverhang
      mk(pw, th, 0, pd / 2 - th / 2)
      mk(pw, th, 0, -pd / 2 + th / 2)
      mk(th, pd, pw / 2 - th / 2, 0)
      mk(th, pd, -pw / 2 + th / 2, 0)
    }
  } else if (p.roof === "dome") {
    const base = MeshBuilder.CreateCylinder(`wp-r-${guid}`, { diameterTop: 0, diameterBottom: 1, height: 1, tessellation: 4 }, scene)
    const rw = b.w + roofOverhang
    const rd = b.d + roofOverhang
    const rh = Math.min(rw, rd) * 0.4
    base.scaling.set(rw, rh, rd)
    base.rotation.y = Math.PI / 4
    base.position.set(0, bodyH - EMBED + rh / 2, 0)
    base.material = roofMat
    roofPieces.push(base)
    const domeR = Math.min(b.w, b.d) * 0.3
    const dome = MeshBuilder.CreateSphere(`wp-dome-${guid}`, { diameter: domeR * 2, segments: 12, slice: 0.55 }, scene)
    dome.position.set(0, bodyH - EMBED + rh, 0)
    dome.material = stoneMat
    roofPieces.push(dome)
    const drum = MeshBuilder.CreateCylinder(`wp-drum-${guid}`, { diameter: domeR * 1.5, height: domeR * 0.5, tessellation: 12 }, scene)
    drum.position.set(0, bodyH - EMBED + rh - domeR * 0.2, 0)
    drum.material = stoneMat
    roofPieces.push(drum)
    const cbx = MeshBuilder.CreateBox(`wp-cx-${guid}`, { width: 0.07, height: domeR * 0.8, depth: 0.07 }, scene)
    cbx.position.set(0, bodyH - EMBED + rh + domeR * 0.9, 0)
    cbx.material = stoneMat
    roofPieces.push(cbx)
    const cby = MeshBuilder.CreateBox(`wp-cy-${guid}`, { width: domeR * 0.45, height: 0.07, depth: 0.07 }, scene)
    cby.position.set(0, bodyH - EMBED + rh + domeR * 0.95, 0)
    cby.material = stoneMat
    roofPieces.push(cby)
  }

  // ---- chimney (houses / workshops) — stone, separate ----
  if ((kind === "house" || kind === "workshop") && r() < 0.7) {
    const cw = 0.4
    const ch = 0.7 + r() * 0.4
    const chim = MeshBuilder.CreateBox(`wp-ch-${guid}`, { width: cw, height: ch, depth: cw }, scene)
    const ox = (r() - 0.5) * b.w * 0.4
    const oz = (r() - 0.5) * b.d * 0.4
    chim.position.set(ox, bodyH + ch / 2 + 0.3, oz)
    chim.material = stoneMat
    roofPieces.push(chim)
  }

  // ---- stoop / step at the door — stone, separate (sits proud of the ground) ----
  {
    const stepW = Math.min(facadeWidth * 0.4, 1.6)
    const step = MeshBuilder.CreateBox(`wp-st-${guid}`, { width: stepW, height: 0.18, depth: 0.5 }, scene)
    const fy = sideYaw[front.side]
    const out = new Vector3(Math.sin(fy), 0, Math.cos(fy))
    const half = front.side === "px" || front.side === "nx" ? b.w / 2 : b.d / 2
    step.position.set(out.x * (half + 0.25), 0.12, out.z * (half + 0.25))
    step.rotation.y = fy
    step.material = stoneMat
    roofPieces.push(step)
  }

  // Roof/stone meshes are parented to the building root and positioned at the
  // building origin (they were built in local space around 0,0). They keep their
  // own materials + UVs + depth — never merged with the body.
  for (const m of roofPieces) {
    m.parent = parent
    m.position.x += b.x
    m.position.z += b.z
    m.isPickable = false
    m.freezeWorldMatrix()
    extra.push(m)
  }

  // ---- merge all opaque pieces of THIS building into one mesh w/ submeshes ----
  const merged = Mesh.MergeMeshes(pieces, true, true, undefined, false, true)
  const buildingMeshes: Mesh[] = []
  if (merged) {
    merged.name = `wp-building-${guid}`
    merged.parent = parent
    merged.position.set(b.x, 0, b.z)
    merged.isPickable = false
    merged.freezeWorldMatrix()
    merged.alwaysSelectAsActiveMesh = false
    buildingMeshes.push(merged)
  }

  // ---- NEON TRIM (tokyo-neon only) — emissive bands + a vertical sign blade ----
  // Cheap glow that makes the SAME concrete block read as a night-city tower:
  //  • a thin horizontal neon band wrapping the parapet line (cyan trim);
  //  • a tall vertical neon "blade" sign down the street-facing corner.
  // These are unlit emissive boxes (disableLighting) so they pop at night and
  // never depend on the sun. Footprint is unchanged (bands hug the wall faces).
  if (style.neon) {
    const trimMat = mats.neon(`trim${stucco.bucket}`, pal.trim, 1.7)
    const accentMat = mats.neon(`accent`, pal.accent, 1.5)
    const bandH = 0.16
    const eps = 0.05
    // a band per storey ceiling line + a brighter crown band at the parapet.
    const lines: number[] = []
    for (let s = 1; s <= p.storeys; s++) lines.push(Math.min(bodyH - 0.1, s * storeyH))
    for (const y of lines) {
      const isCrown = y >= bodyH - storeyH - 0.05
      const m = isCrown ? trimMat : accentMat
      // four faces: two along X, two along Z
      const mkBand = (w: number, d: number, x: number, z: number) => {
        const band = MeshBuilder.CreateBox(`wp-nb-${guid}`, { width: w, height: bandH, depth: d }, scene)
        band.position.set(b.x + x, y, b.z + z)
        band.material = m
        band.isPickable = false
        band.parent = parent
        band.freezeWorldMatrix()
        extra.push(band)
      }
      const t = 0.08
      mkBand(b.w + eps * 2, t, 0, b.d / 2 + eps)
      mkBand(b.w + eps * 2, t, 0, -b.d / 2 - eps)
      mkBand(t, b.d + eps * 2, b.w / 2 + eps, 0)
      mkBand(t, b.d + eps * 2, -b.w / 2 - eps, 0)
    }
    // a vertical neon blade running up the street-facing front corner.
    {
      const fy = sideYaw[front.side]
      const out = new Vector3(Math.sin(fy), 0, Math.cos(fy))
      const tan = new Vector3(out.z, 0, -out.x)
      const half = (front.side === "px" || front.side === "nx" ? b.w / 2 : b.d / 2) + 0.06
      const along = (front.side === "px" || front.side === "nx" ? b.d / 2 : b.w / 2) - 0.25
      const blade = MeshBuilder.CreateBox(`wp-nv-${guid}`, { width: 0.14, height: bodyH * 0.8, depth: 0.14 }, scene)
      blade.position.set(
        b.x + out.x * half + tan.x * along,
        bodyH * 0.5,
        b.z + out.z * half + tan.z * along,
      )
      blade.material = accentMat
      blade.isPickable = false
      blade.parent = parent
      blade.freezeWorldMatrix()
      extra.push(blade)
    }
  }

  // ---- AWNING decal (alpha plane) over the front door, for shops/inns ----
  if (p.awning) {
    const aw = Math.min(facadeWidth * 0.7, b.w + b.d)
    const aTex = texs.get(`awning-${pal.accent.r.toFixed(2)}`, 256, 96, (c, w, h) => drawAwning(c, w, h, rgbToCss(pal.accent)))
    const aMat = mats.textured(`awning-${pal.accent.r.toFixed(2)}`, aTex, true)
    const plane = MeshBuilder.CreatePlane(`wp-aw-${guid}`, { width: aw, height: aw * 0.36 }, scene)
    plane.material = aMat
    const fy = sideYaw[front.side]
    const out = new Vector3(Math.sin(fy), 0, Math.cos(fy))
    const half = (front.side === "px" || front.side === "nx" ? b.w / 2 : b.d / 2) + 0.06
    plane.position.set(b.x + out.x * half, storeyH + 0.2, b.z + out.z * half)
    plane.rotation.x = -Math.PI / 4
    plane.rotation.y = fy
    plane.parent = parent
    plane.isPickable = false
    plane.freezeWorldMatrix()
    extra.push(plane)
  }

  // ---- hanging SIGN (alpha plane) for shops/inns/chapel/workshop ----
  if (p.sign) {
    const sTex = texs.get(`sign-${kind}`, 160, 160, (c, w, h) => drawSign(c, w, h, rgbToCss(shade(pal.accent, 0.1)), p.sign as string))
    const sMat = mats.textured(`sign-${kind}`, sTex, true)
    const sz = Math.min(1.0, facadeWidth * 0.4)
    const plane = MeshBuilder.CreatePlane(`wp-sg-${guid}`, { width: sz, height: sz }, scene)
    plane.material = sMat
    plane.billboardMode = Mesh.BILLBOARDMODE_Y
    const fy = sideYaw[front.side]
    const out = new Vector3(Math.sin(fy), 0, Math.cos(fy))
    const tan = new Vector3(out.z, 0, -out.x)
    const half = (front.side === "px" || front.side === "nx" ? b.w / 2 : b.d / 2) + 0.5
    plane.position.set(
      b.x + out.x * half + tan.x * facadeWidth * 0.28,
      storeyH * 1.3,
      b.z + out.z * half + tan.z * facadeWidth * 0.28,
    )
    plane.isPickable = false
    plane.parent = parent
    extra.push(plane)
  }

  // ---- BALCONY (inn/house): a small railed ledge under a 2nd-floor window ----
  if (p.balcony && p.storeys >= 2) {
    const balcMat = mats.solid("trim", pal.trim)
    const fy = sideYaw[front.side]
    const out = new Vector3(Math.sin(fy), 0, Math.cos(fy))
    const half = front.side === "px" || front.side === "nx" ? b.w / 2 : b.d / 2
    const bw = Math.min(facadeWidth * 0.5, 1.8)
    const floor = MeshBuilder.CreateBox(`wp-bf-${guid}`, { width: bw, height: 0.12, depth: 0.5 }, scene)
    floor.material = balcMat
    floor.rotation.y = fy
    floor.position.set(b.x + out.x * (half + 0.25), storeyH + 0.3, b.z + out.z * (half + 0.25))
    floor.parent = parent
    floor.freezeWorldMatrix()
    const rail = MeshBuilder.CreateBox(`wp-br-${guid}`, { width: bw, height: 0.45, depth: 0.06 }, scene)
    rail.material = balcMat
    rail.rotation.y = fy
    rail.position.set(b.x + out.x * (half + 0.48), storeyH + 0.5, b.z + out.z * (half + 0.48))
    rail.parent = parent
    rail.freezeWorldMatrix()
    extra.push(floor, rail)
  }

  // ---- soft contact shadow under the building ----
  {
    const sr = Math.max(b.w, b.d) * 0.62
    const shadow = MeshBuilder.CreateDisc(`wp-sh-${guid}`, { radius: sr, tessellation: 20 }, scene)
    shadow.rotation.x = Math.PI / 2
    shadow.position.set(b.x, 0.015, b.z)
    shadow.scaling.x = b.w / Math.max(b.w, b.d)
    shadow.scaling.y = b.d / Math.max(b.w, b.d)
    shadow.material = shadowMat(mats)
    shadow.isPickable = false
    shadow.parent = parent
    shadow.freezeWorldMatrix()
    extra.push(shadow)
  }

  guid++
  return [...buildingMeshes, ...extra]
}

function shadowMat(mats: MatPool): StandardMaterial {
  const hit = mats.get("s", "shadow")
  if (hit) return hit
  const m = mats.solid("shadow", { r: 0, g: 0, b: 0 }, 0)
  m.unfreeze()
  m.alpha = 0.2
  m.freeze()
  return m
}

/* ----------------------------------------------------------------- entry */

export function createBuildings(
  scene: Scene,
  blockers: Blocker[],
  opts: CreateBuildingsOpts = {},
): BuildingsHandle {
  const style = resolveStyle(opts.buildingStyle)
  const pal = resolvePalette(opts.palette, style)
  const baseSeed = opts.seed ?? 1337
  const root = new Mesh(`wp-buildings-root-${guid++}`, scene)
  // SHARED façade cache (city-lifetime) when supplied — painted once, reused by
  // every chunk. A private pool (standalone previews) is owned + freed by this
  // handle; a shared pool is owned + freed by the CITY (never here).
  const ownsPool = !opts.pool
  const pool = opts.pool ?? createBuildingPool(scene)
  const mats = pool.mats
  const texs = pool.texs
  const all: Mesh[] = []

  blockers.forEach((b, i) => {
    let kind: BuildingKind
    const hint = opts.kinds?.[i]
    if (hint && (KINDS as string[]).includes(hint)) {
      kind = hint as BuildingKind
    } else {
      // deterministic choice weighted toward houses/shops
      const rr = rng(baseSeed * 2654435761 + i * 40503)
      const pick = rr()
      kind =
        pick < 0.36 ? "house" : pick < 0.6 ? "shop" : pick < 0.74 ? "workshop" : pick < 0.86 ? "inn" : pick < 0.95 ? "market-hall" : "chapel"
    }
    const seed = (baseSeed ^ (i * 0x9e3779b1)) >>> 0
    const made = buildOne(scene, b, kind, pal, mats, texs, opts.doors, seed, root, opts.materials, style)
    all.push(...made)
  })

  root.freezeWorldMatrix()

  return {
    root,
    dispose: () => {
      // Free ONLY this call's own meshes. The shared façade pool's textures +
      // materials are city-lifetime — disposing them here would corrupt every
      // OTHER chunk that reuses the same façade variant. We pass
      // disposeMaterialAndTextures=false so shared mats/textures survive.
      for (const m of all) m.dispose(false, false)
      root.dispose(false, false)
      // Only a PRIVATE pool (standalone preview, no shared pool supplied) is
      // freed here; a shared/city pool is freed once on city dispose.
      if (ownsPool) pool.dispose()
    },
  }
}
