import * as THREE from "three"

/**
 * The numeral atlas — a signed distance field.
 *
 * Legibility is the one thing in this game that is not allowed to lose to
 * ornament, and the first version of this file lost. It stamped a coverage
 * bitmap into a canvas and let the GPU minify it. On a desktop that is fine.
 * On a 390px phone the same glyph lands twenty pixels tall, the mip chain
 * averages a two-texel stroke down to a grey smear, and what a child actually
 * saw was a hairline ghost of a numeral floating on top of a blown-out bloom
 * highlight. Screenshotted, measured, unarguable: in a game whose whole pitch
 * is telling 3,418 from 3,481 at a glance, the numbers were unreadable on the
 * primary target.
 *
 * A distance field does not have that failure mode. What is stored is not ink
 * but *distance to the nearest edge*, which is a smooth, low-frequency signal:
 * bilinear sampling of it at any scale reconstructs the same iso-contour, so
 * the glyph keeps its exact weight and shape whether it is 120 pixels tall or
 * twelve. The antialias width is computed analytically from the on-screen size
 * rather than guessed, so there is no mip chain and no smear.
 *
 * The same field also gives us the dark plate for free. A plate is just the
 * glyph dilated, and a dilated glyph is the *same distance field read at a
 * different iso-level*. One channel, one texture fetch, two shapes: the white
 * numeral at d = 0.5 and a near-black backing slab at d = PAD. That plate is
 * what lets a white numeral survive sitting on a bloom-white core, and because
 * it is derived from distance it stays exactly as thick, relative to the
 * glyph, at every size.
 */

export const GLYPHS = "0123456789-×÷+?" as const
/**
 * Derived, not written down. It was hard-coded to 16 against a 15-character
 * set, so the atlas carried one cell that was never rasterised into and
 * `indexOf`'s fallback pointed straight at it: an unknown character rendered
 * as a blank rather than as the `?` the set ends with.
 */
export const GLYPH_COUNT = GLYPHS.length

const CELL_W = 136
const CELL_H = 176
const FONT_PX = 104
/**
 * Distance range encoded in the byte, in atlas pixels: the stored value is
 * 0.5 at the glyph edge, 1.0 at SPREAD/2 inside, 0.0 at SPREAD/2 outside.
 */
const SPREAD = 44
/** How far the dark plate is dilated past the glyph edge, in atlas pixels. */
const PAD_PX = 10
/**
 * A second, wider and softer iso — separation from a very bright core.
 *
 * MUST stay comfortably inside SPREAD/2. At exactly SPREAD/2 the iso lands on
 * 0.0, which is also the value the field clamps to everywhere outside the
 * glyph, so `smoothstep` straddles it and the "aura" renders as a 50%-opaque
 * grey RECTANGLE over the whole cell. Screenshotted at 390px: every numeral
 * sat in a grey box and adjacent boxes double-darkened into a checkerboard.
 */
const AURA_PX = 15

const FONT_STACK = `900 ${FONT_PX}px ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`

export type Atlas = {
  texture: THREE.Texture
  /** Quad height in units of cap height — sizes are quoted as CAP HEIGHT. */
  cellPerCap: number
  /** Quad aspect, width over height. */
  cellAspect: number
  /** Tabular advance width, in units of cap height. */
  advance: number
  /** Iso value of the dark plate. */
  padIso: number
  /** Iso value of the wider, softer aura. */
  auraIso: number
  /**
   * Atlas pixels per cell height, divided by the distance spread. Multiply by
   * (1 / on-screen quad height in pixels) to get the exact antialias width in
   * field units — no derivatives, no mip guessing.
   */
  aaK: number
  indexOf(ch: string): number
}

// ---------------------------------------------------------------------------
// Exact Euclidean distance transform (Felzenszwalb & Huttenlocher, O(n)).
// ---------------------------------------------------------------------------

/** Large but FINITE. An infinite seed makes the parabola test evaluate 0/0. */
const FAR = 1e10

function edt1d(f: Float64Array, d: Float64Array, v: Int32Array, z: Float64Array, n: number): void {
  let k = 0
  v[0] = 0
  z[0] = -FAR
  z[1] = FAR
  for (let q = 1; q < n; q++) {
    let s = 0
    for (;;) {
      const vk = v[k] as number
      s = ((f[q] as number) + q * q - ((f[vk] as number) + vk * vk)) / (2 * q - 2 * vk)
      if (k > 0 && s <= (z[k] as number)) k--
      else break
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = FAR
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while ((z[k + 1] as number) < q) k++
    const vk = v[k] as number
    d[q] = (q - vk) * (q - vk) + (f[vk] as number)
  }
}

/** Squared distance from every pixel to the nearest `mask` pixel. */
function edt2d(mask: Uint8Array, w: number, h: number, out: Float64Array): void {
  const n = Math.max(w, h)
  const f = new Float64Array(n)
  const d = new Float64Array(n)
  const v = new Int32Array(n)
  const z = new Float64Array(n + 1)

  for (let p = 0; p < w * h; p++) out[p] = mask[p] ? 0 : FAR

  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = out[y * w + x] as number
    edt1d(f, d, v, z, h)
    for (let y = 0; y < h; y++) out[y * w + x] = d[y] as number
  }
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) f[x] = out[row + x] as number
    edt1d(f, d, v, z, w)
    for (let x = 0; x < w; x++) out[row + x] = d[x] as number
  }
}

// ---------------------------------------------------------------------------

export function buildAtlas(): Atlas {
  const w = CELL_W * GLYPH_COUNT
  const h = CELL_H

  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("[arena] 2d context unavailable for the numeral atlas")
  ctx.clearRect(0, 0, w, h)
  ctx.font = FONT_STACK
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = "#fff"

  // Cap height is measured, not assumed: it is the unit every on-screen size in
  // this game is quoted in, so a "14px numeral" really is fourteen pixels of
  // ink and the minimum-size rule means what it says.
  const probe = ctx.measureText("8")
  const capPx = Math.max(1, probe.actualBoundingBoxAscent)
  const advancePx = Math.max(probe.width, ctx.measureText("0").width)
  const baseline = h / 2 + capPx / 2

  for (let i = 0; i < GLYPHS.length; i++) {
    ctx.fillText(GLYPHS[i] as string, i * CELL_W + CELL_W / 2, baseline)
  }

  const img = ctx.getImageData(0, 0, w, h).data
  const np = w * h
  const cov = new Float32Array(np)
  const inside = new Uint8Array(np)
  const outside = new Uint8Array(np)
  for (let p = 0; p < np; p++) {
    const a = (img[p * 4 + 3] as number) / 255
    cov[p] = a
    inside[p] = a > 0.5 ? 1 : 0
    outside[p] = a > 0.5 ? 0 : 1
  }

  const dOut = new Float64Array(np) // distance to ink, for pixels outside
  const dIn = new Float64Array(np) // distance to background, for pixels inside
  edt2d(inside, w, h, dOut)
  edt2d(outside, w, h, dIn)

  const data = new Uint8Array(np * 4)
  for (let p = 0; p < np; p++) {
    const a = cov[p] as number
    let sd: number
    if (a > 0.02 && a < 0.98) {
      // On an antialiased edge the coverage IS the sub-pixel distance, and it
      // is far more accurate than a distance transform of a hard threshold.
      sd = a - 0.5
    } else if (a > 0.5) {
      sd = Math.sqrt(dIn[p] as number) - 0.5
    } else {
      sd = -(Math.sqrt(dOut[p] as number) - 0.5)
    }
    const v = Math.round(255 * Math.max(0, Math.min(1, 0.5 + sd / SPREAD)))
    const o = p * 4
    data[o] = v
    data[o + 1] = v
    data[o + 2] = v
    data[o + 3] = 255
  }

  const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType)
  // No mip chain on purpose. A distance field is low-frequency; bilinear
  // minification of it reconstructs the same edge, whereas a mip chain of a
  // coverage bitmap is exactly the thing that ate these numerals on a phone.
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.colorSpace = THREE.NoColorSpace
  texture.needsUpdate = true

  const index = new Map<string, number>()
  for (let i = 0; i < GLYPHS.length; i++) index.set(GLYPHS[i] as string, i)

  return {
    texture,
    cellPerCap: CELL_H / capPx,
    cellAspect: CELL_W / CELL_H,
    // Tabular, with a hair of tracking. Tight enough that the plates of
    // neighbouring digits merge into one continuous slab — which is exactly
    // what a four-digit number wants behind it — and loose enough that the
    // digits themselves never touch.
    advance: (advancePx + FONT_PX * 0.10) / capPx,
    padIso: 0.5 - PAD_PX / SPREAD,
    auraIso: 0.5 - AURA_PX / SPREAD,
    aaK: CELL_H / SPREAD,
    indexOf(ch: string) {
      // An unknown character is a `?`, which is what the glyph set ends with
      // and the reason it is in there at all.
      return index.get(ch) ?? index.get("?") ?? 0
    },
  }
}
