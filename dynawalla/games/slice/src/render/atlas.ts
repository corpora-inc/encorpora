// Pre-baked sprites. Nothing here runs on the hot path.
//
// Two things Canvas2D is slow at are `shadowBlur` and building a gradient per
// draw. Both are done ONCE here, into offscreen canvases, and the frame loop
// only ever calls `drawImage`. That is the whole reason a 3200-particle ULTRA
// frame is affordable in 2D.

import { font, NUM_FONT } from "./palette.ts"

type Canvas = HTMLCanvasElement | OffscreenCanvas

function make(w: number, h: number): { c: Canvas; g: CanvasRenderingContext2D } {
  const c = document.createElement("canvas")
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
  const g = c.getContext("2d")
  if (!g) throw new Error("slice: 2D context unavailable")
  return { c, g }
}

/** A soft additive dot. One per colour; drawn with `lighter`. */
export class DotAtlas {
  private cache = new Map<string, Canvas>()
  readonly size = 48

  get(color: string): Canvas {
    const hit = this.cache.get(color)
    if (hit) return hit
    const s = this.size
    const { c, g } = make(s, s)
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    // A hot white-ish core inside the tint reads as *light*, not as a coloured
    // disc, which is what makes an additive particle field feel like sparks.
    grad.addColorStop(0, "rgba(255,255,255,0.95)")
    grad.addColorStop(0.22, color)
    grad.addColorStop(0.55, color.startsWith("#") ? `${color}55` : color)
    grad.addColorStop(1, "rgba(0,0,0,0)")
    g.fillStyle = grad
    g.fillRect(0, 0, s, s)
    this.cache.set(color, c)
    return c
  }
}

/** A hard-edged shard for glass/iron debris — a triangle, not a dot. */
export class ShardAtlas {
  private cache = new Map<string, Canvas>()
  readonly size = 24

  get(color: string): Canvas {
    const hit = this.cache.get(color)
    if (hit) return hit
    const s = this.size
    const { c, g } = make(s, s)
    g.fillStyle = color
    g.beginPath()
    g.moveTo(s * 0.5, s * 0.06)
    g.lineTo(s * 0.94, s * 0.86)
    g.lineTo(s * 0.06, s * 0.72)
    g.closePath()
    g.fill()
    this.cache.set(color, c)
    return c
  }
}

/**
 * Numerals, pre-rendered once each.
 *
 * The legibility rule this class exists to keep: near-white fill, heavy
 * geometric sans, and a **dark outline plus a dark drop shadow** so the numeral
 * survives on top of a bright flesh colour, on top of the bloom layer, on top
 * of anything. Rendered at 3× the largest on-screen size and downsampled, which
 * is cheaper than re-rasterising text every frame and sharper than 1×.
 */
export class NumeralAtlas {
  private cache = new Map<string, { c: Canvas; w: number; h: number }>()
  private order: string[] = []
  private readonly base = 96
  private readonly cap = 320

  get(text: string): { c: Canvas; w: number; h: number } {
    const hit = this.cache.get(text)
    if (hit) return hit

    const px = this.base
    const probe = make(4, 4).g
    probe.font = font(NUM_FONT, px)
    const m = probe.measureText(text)
    const pad = px * 0.34
    const w = Math.ceil(m.width + pad * 2)
    const h = Math.ceil(px * 1.25 + pad * 2)

    const { c, g } = make(w, h)
    g.font = font(NUM_FONT, px)
    g.textAlign = "center"
    g.textBaseline = "middle"
    const cx = w / 2
    const cy = h / 2

    // Outline first, wide, so the fill sits inside a dark keyline at any scale.
    g.lineJoin = "round"
    g.miterLimit = 2
    g.strokeStyle = "rgba(6,4,12,0.92)"
    g.lineWidth = px * 0.22
    g.strokeText(text, cx, cy)
    g.strokeStyle = "rgba(6,4,12,0.75)"
    g.lineWidth = px * 0.1
    g.strokeText(text, cx, cy)

    g.fillStyle = "#fffdf6"
    g.fillText(text, cx, cy)

    // A one-pixel warm rim on the top edge: the lamps are above.
    g.globalCompositeOperation = "source-atop"
    const rim = g.createLinearGradient(0, cy - px * 0.62, 0, cy + px * 0.62)
    rim.addColorStop(0, "rgba(255,224,170,0.55)")
    rim.addColorStop(0.5, "rgba(255,255,255,0)")
    rim.addColorStop(1, "rgba(110,60,160,0.35)")
    g.fillStyle = rim
    g.fillRect(0, 0, w, h)
    g.globalCompositeOperation = "source-over"

    const entry = { c, w, h }
    this.cache.set(text, entry)
    this.order.push(text)
    if (this.order.length > this.cap) {
      const evict = this.order.shift()
      if (evict !== undefined) this.cache.delete(evict)
    }
    return entry
  }
}

/** A soft under-glow disc used behind numerals and lanterns. */
export class HaloAtlas {
  private cache = new Map<string, Canvas>()
  readonly size = 128

  get(color: string): Canvas {
    const hit = this.cache.get(color)
    if (hit) return hit
    const s = this.size
    const { c, g } = make(s, s)
    const grad = g.createRadialGradient(s / 2, s / 2, s * 0.06, s / 2, s / 2, s / 2)
    grad.addColorStop(0, color)
    grad.addColorStop(0.35, `${color}77`)
    grad.addColorStop(1, "rgba(0,0,0,0)")
    g.fillStyle = grad
    g.fillRect(0, 0, s, s)
    this.cache.set(color, c)
    return c
  }
}

export type Atlases = {
  dot: DotAtlas
  shard: ShardAtlas
  numeral: NumeralAtlas
  halo: HaloAtlas
}

export function createAtlases(): Atlases {
  return {
    dot: new DotAtlas(),
    shard: new ShardAtlas(),
    numeral: new NumeralAtlas(),
    halo: new HaloAtlas(),
  }
}
