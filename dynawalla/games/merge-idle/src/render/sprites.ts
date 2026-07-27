/**
 * Every polyp is drawn once into an offscreen canvas and then blitted. A frame
 * costs one `drawImage` per polyp instead of a dozen gradient fills, which is
 * what buys 60fps on the low tier while still letting each polyp be genuinely
 * elaborate — rings, rim light, caustic speckle, a dark lens and a numeral.
 *
 * Breathing, squash and rotation are applied at blit time by the transform, so
 * nothing is ever re-rasterised during play. The cache is keyed by
 * `value|sizePx` and cleared on resize.
 */

import { rank, silhouetteOf, fmt, type Silhouette } from '../core/ladder.ts'
import { CHALK, LENS, lift, rampAt, rgba, type Rgb } from './palette.ts'

export const FONT_STACK =
  '"SF Pro Rounded", ui-rounded, "Nunito", "Avenir Next", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

/** Sprite is drawn into a box this many times the cell size, to hold the glow. */
export const SPRITE_SCALE = 1.62

type Cache = Map<string, HTMLCanvasElement>

export class SpriteBook {
  private polypCache: Cache = new Map()
  private glowCache: Cache = new Map()
  private dpr = 1

  setDpr(dpr: number): void {
    if (dpr !== this.dpr) {
      this.dpr = dpr
      this.clear()
    }
  }

  clear(): void {
    this.polypCache.clear()
    this.glowCache.clear()
  }

  get size(): number {
    return this.polypCache.size + this.glowCache.size
  }

  /** A polyp sprite sized for a cell of `cellPx` CSS pixels. */
  polyp(value: number, cellPx: number): HTMLCanvasElement {
    const q = Math.round(cellPx)
    const key = `${value}|${q}`
    const hit = this.polypCache.get(key)
    if (hit) return hit
    if (this.polypCache.size > 96) this.polypCache.clear()
    const made = drawPolyp(value, q, this.dpr)
    this.polypCache.set(key, made)
    return made
  }

  /** A soft additive blob used for glows and particles. Keyed by colour + size. */
  glow(colour: Rgb, px: number): HTMLCanvasElement {
    const q = Math.round(px)
    const key = `${colour[0]},${colour[1]},${colour[2]}|${q}`
    const hit = this.glowCache.get(key)
    if (hit) return hit
    if (this.glowCache.size > 128) this.glowCache.clear()
    const made = drawGlow(colour, q, this.dpr)
    this.glowCache.set(key, made)
    return made
  }
}

function makeCanvas(px: number, dpr: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(px * dpr))
  c.height = Math.max(1, Math.ceil(px * dpr))
  const g = c.getContext('2d')
  if (!g) throw new Error('merge-idle: 2d context unavailable for a sprite')
  g.scale(dpr, dpr)
  return { c, g }
}

function drawGlow(colour: Rgb, px: number, dpr: number): HTMLCanvasElement {
  const { c, g } = makeCanvas(px, dpr)
  const r = px / 2
  const grad = g.createRadialGradient(r, r, 0, r, r, r)
  grad.addColorStop(0, rgba(colour, 0.95))
  grad.addColorStop(0.28, rgba(colour, 0.42))
  grad.addColorStop(0.62, rgba(colour, 0.11))
  grad.addColorStop(1, rgba(colour, 0))
  g.fillStyle = grad
  g.fillRect(0, 0, px, px)
  return c
}

/** The silhouette outline, centred at (cx,cy) with body radius `r`. */
function silhouettePath(
  g: CanvasRenderingContext2D,
  kind: Silhouette,
  cx: number,
  cy: number,
  r: number,
): void {
  g.beginPath()
  switch (kind) {
    case 'ring': {
      g.arc(cx, cy, r, 0, Math.PI * 2)
      break
    }
    case 'lobed': {
      const lobes = 7
      for (let i = 0; i <= 180; i++) {
        const t = (i / 180) * Math.PI * 2
        const rr = r * (0.86 + 0.14 * Math.cos(t * lobes))
        const x = cx + Math.cos(t) * rr
        const y = cy + Math.sin(t) * rr
        if (i === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.closePath()
      break
    }
    case 'spiked': {
      const spikes = 12
      for (let i = 0; i < spikes * 2; i++) {
        const t = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2
        const rr = i % 2 === 0 ? r : r * 0.63
        const x = cx + Math.cos(t) * rr
        const y = cy + Math.sin(t) * rr
        if (i === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.closePath()
      break
    }
    case 'starred': {
      const arms = 5
      for (let i = 0; i <= 240; i++) {
        const t = (i / 240) * Math.PI * 2 - Math.PI / 2
        const wave = Math.cos(t * arms)
        const rr = r * (0.6 + 0.4 * Math.sign(wave) * Math.abs(wave) ** 0.55)
        const x = cx + Math.cos(t) * rr
        const y = cy + Math.sin(t) * rr
        if (i === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.closePath()
      break
    }
  }
}

function drawPolyp(value: number, cellPx: number, dpr: number): HTMLCanvasElement {
  const px = Math.ceil(cellPx * SPRITE_SCALE)
  const { c, g } = makeCanvas(px, dpr)
  const cx = px / 2
  const cy = px / 2
  const body = cellPx * 0.44
  const r = rank(value)
  const hue = rampAt(r)
  const bright = lift(hue, 0.55)
  const kind = silhouetteOf(value)

  // 1 — the halo the water carries away from it
  const halo = g.createRadialGradient(cx, cy, body * 0.4, cx, cy, px / 2)
  halo.addColorStop(0, rgba(hue, 0.5))
  halo.addColorStop(0.42, rgba(hue, 0.16))
  halo.addColorStop(1, rgba(hue, 0))
  g.fillStyle = halo
  g.fillRect(0, 0, px, px)

  // 2 — an outer membrane, a touch larger than the body, very soft
  g.save()
  silhouettePath(g, kind, cx, cy, body * 1.16)
  g.fillStyle = rgba(hue, 0.2)
  g.fill()
  g.restore()

  // 3 — the body itself, lit from above
  g.save()
  silhouettePath(g, kind, cx, cy, body)
  g.clip()
  const flesh = g.createRadialGradient(cx, cy - body * 0.42, body * 0.1, cx, cy, body * 1.25)
  flesh.addColorStop(0, rgba(bright, 1))
  flesh.addColorStop(0.42, rgba(hue, 0.98))
  flesh.addColorStop(1, rgba([hue[0] >> 1, hue[1] >> 1, hue[2] >> 1] as Rgb, 0.98))
  g.fillStyle = flesh
  g.fillRect(0, 0, px, px)

  // caustic speckle so no two rungs read as flat plastic
  g.globalAlpha = 0.16
  g.fillStyle = rgba(bright, 1)
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + (value % 7)
    const rr = body * (0.28 + ((i * 37) % 60) / 100)
    g.beginPath()
    g.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, body * 0.055, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
  g.restore()

  // 4 — rim light: a bright thin edge, brightest at the top
  g.save()
  silhouettePath(g, kind, cx, cy, body)
  g.lineWidth = Math.max(1.2, cellPx * 0.028)
  const rim = g.createLinearGradient(cx, cy - body, cx, cy + body)
  rim.addColorStop(0, rgba(lift(hue, 0.85), 0.95))
  rim.addColorStop(0.55, rgba(bright, 0.35))
  rim.addColorStop(1, rgba(hue, 0.12))
  g.strokeStyle = rim
  g.stroke()
  g.restore()

  // 5 — the dark lens. Legibility lives here: the numeral never sits on the hue.
  const lensR = body * 0.72
  g.save()
  g.beginPath()
  g.ellipse(cx, cy, lensR, lensR * 0.9, 0, 0, Math.PI * 2)
  const lensGrad = g.createRadialGradient(cx, cy - lensR * 0.3, lensR * 0.1, cx, cy, lensR)
  lensGrad.addColorStop(0, rgba(LENS, 0.9))
  lensGrad.addColorStop(1, rgba(LENS, 0.98))
  g.fillStyle = lensGrad
  g.fill()
  g.strokeStyle = rgba(hue, 0.5)
  g.lineWidth = Math.max(1, cellPx * 0.016)
  g.stroke()
  g.restore()

  // 6 — the numeral, fitted to the lens so 1,024 reads as well as 4 does
  const label = fmt(value)
  const maxW = lensR * 1.68
  let fontPx = cellPx * 0.34
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  for (let i = 0; i < 8; i++) {
    g.font = `900 ${fontPx}px ${FONT_STACK}`
    if (g.measureText(label).width <= maxW) break
    fontPx *= 0.88
  }
  g.fillStyle = rgba(hue, 0.55)
  g.fillText(label, cx, cy + Math.max(1, cellPx * 0.018))
  g.fillStyle = rgba(CHALK, 1)
  g.fillText(label, cx, cy)

  // 7 — one specular pinprick so it reads as wet
  g.beginPath()
  g.ellipse(cx - body * 0.34, cy - body * 0.52, body * 0.17, body * 0.1, -0.5, 0, Math.PI * 2)
  g.fillStyle = rgba([255, 255, 255], 0.4)
  g.fill()

  return c
}

/** A ghost outline the vent shows for the polyp it is asking for. */
export function drawGhost(
  g: CanvasRenderingContext2D,
  kind: Silhouette,
  cx: number,
  cy: number,
  r: number,
  colour: Rgb,
  alpha: number,
): void {
  g.save()
  g.setLineDash([r * 0.32, r * 0.24])
  g.lineWidth = Math.max(1.5, r * 0.11)
  g.strokeStyle = rgba(colour, alpha)
  silhouettePath(g, kind, cx, cy, r)
  g.stroke()
  g.restore()
}
