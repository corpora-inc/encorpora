// Drawing primitives and the palette.
//
// THE REGISTER: a working smithy at two in the morning. Everything is either
// cold iron or it is glowing, and the only light in the room comes from metal
// that is too hot to touch. No cards, no gradients-as-decoration, no rounded
// friendly anything — panels are stamped plate with a bevel, type is stencilled
// on, and the one soft thing on screen is the fire.
//
// Colour never carries meaning alone. Affordable rows also gain a filled
// chevron and a raised bevel; sealed rows also carry chain links; hot vs cold
// is also a size and a texture difference.

export const PAL = {
  void: "#07050a",
  soot: "#100c12",
  iron: "#252a33",
  ironLo: "#171b22",
  ironHi: "#39414e",
  rim: "#5a6577",
  ember: "#ff2d00",
  hot: "#ff7a12",
  bright: "#ffbc4a",
  white: "#fff4dc",
  gold: "#ffce54",
  cold: "#63e0ff",
  coldLo: "#1b3a4a",
  ink: "#0a0709",
  dim: "#7c8494",
  text: "#e8e2d6",
} as const

export type Surface = {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  w: number
  h: number
  dpr: number
  resize(): boolean
  destroy(): void
}

export function makeSurface(host: HTMLElement): Surface {
  const canvas = document.createElement("canvas")
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block"
  host.appendChild(canvas)
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true })
  if (!ctx) throw new Error("2d context unavailable")

  const s: Surface = {
    canvas,
    ctx,
    w: 0,
    h: 0,
    // Capped at 2: a 3x phone display triples fill cost for a difference no one
    // can see on a glowing particle, and this game is fill-bound.
    dpr: Math.min(2, globalThis.devicePixelRatio || 1),
    resize() {
      const r = host.getBoundingClientRect()
      const w = Math.max(1, Math.round(r.width))
      const h = Math.max(1, Math.round(r.height))
      const dpr = Math.min(2, globalThis.devicePixelRatio || 1)
      if (w === s.w && h === s.h && dpr === s.dpr) return false
      s.w = w
      s.h = h
      s.dpr = dpr
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      return true
    },
    destroy() {
      canvas.remove()
    },
  }
  s.resize()
  return s
}

/** A stamped-plate corner: 45-degree chamfers, not radii. Industrial, not soft. */
export function chamferRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  c: number,
): void {
  const cc = Math.min(c, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + cc, y)
  ctx.lineTo(x + w - cc, y)
  ctx.lineTo(x + w, y + cc)
  ctx.lineTo(x + w, y + h - cc)
  ctx.lineTo(x + w - cc, y + h)
  ctx.lineTo(x + cc, y + h)
  ctx.lineTo(x, y + h - cc)
  ctx.lineTo(x, y + cc)
  ctx.closePath()
}

let plateTex: CanvasPattern | null = null

/** Hammered iron: dents and grain, generated once and reused as a pattern. */
function platePattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (plateTex) return plateTex
  const size = 160
  const c = document.createElement("canvas")
  c.width = size
  c.height = size
  const g = c.getContext("2d")
  if (!g) return null
  g.fillStyle = PAL.iron
  g.fillRect(0, 0, size, size)
  // Hammer dents.
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = 6 + Math.random() * 16
    const grad = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r)
    grad.addColorStop(0, "rgba(255,255,255,0.045)")
    grad.addColorStop(0.55, "rgba(0,0,0,0.05)")
    grad.addColorStop(1, "rgba(0,0,0,0)")
    g.fillStyle = grad
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
  }
  // Fine grain.
  const img = g.getImageData(0, 0, size, size)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const nz = (Math.random() - 0.5) * 14
    d[i] += nz
    d[i + 1] += nz
    d[i + 2] += nz
  }
  g.putImageData(img, 0, 0)
  plateTex = ctx.createPattern(c, "repeat")
  return plateTex
}

export type PlateOpts = {
  /** 0 = cold iron, 1 = white hot. Drives the emissive rim. */
  heat?: number
  chamfer?: number
  /** Raised plates read as pressable; sunken ones as slots. */
  sunken?: boolean
  tint?: string
  alpha?: number
  rimColor?: string
  rimWidth?: number
}

export function plate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  o: PlateOpts = {},
): void {
  const c = o.chamfer ?? Math.min(10, h * 0.22)
  const heat = o.heat ?? 0
  ctx.save()
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha

  chamferRect(ctx, x, y, w, h, c)
  const pat = platePattern(ctx)
  ctx.fillStyle = o.tint ?? PAL.iron
  ctx.fill()
  if (pat && !o.tint) {
    ctx.save()
    ctx.clip()
    ctx.translate(x % 160, y % 160)
    ctx.fillStyle = pat
    ctx.fillRect(-x - 160, -y - 160, w + 480, h + 480)
    ctx.restore()
  }

  // Vertical light: a plate lit from above.
  chamferRect(ctx, x, y, w, h, c)
  const grad = ctx.createLinearGradient(0, y, 0, y + h)
  if (o.sunken) {
    grad.addColorStop(0, "rgba(0,0,0,0.42)")
    grad.addColorStop(0.5, "rgba(0,0,0,0.08)")
    grad.addColorStop(1, "rgba(255,255,255,0.05)")
  } else {
    grad.addColorStop(0, "rgba(255,255,255,0.09)")
    grad.addColorStop(0.55, "rgba(0,0,0,0.05)")
    grad.addColorStop(1, "rgba(0,0,0,0.34)")
  }
  ctx.fillStyle = grad
  ctx.fill()

  if (heat > 0) {
    // The metal itself glowing through, from the bottom up.
    chamferRect(ctx, x, y, w, h, c)
    const hg = ctx.createLinearGradient(0, y + h, 0, y)
    hg.addColorStop(0, `rgba(255,80,0,${0.5 * heat})`)
    hg.addColorStop(0.45, `rgba(255,150,30,${0.28 * heat})`)
    hg.addColorStop(1, `rgba(255,220,140,${0.06 * heat})`)
    ctx.fillStyle = hg
    ctx.fill()
  }

  chamferRect(ctx, x, y, w, h, c)
  ctx.lineWidth = o.rimWidth ?? 1.5
  ctx.strokeStyle =
    o.rimColor ??
    (heat > 0.02
      ? `rgba(255,${140 + 90 * heat | 0},${60 + 140 * heat | 0},${0.35 + 0.6 * heat})`
      : "rgba(120,132,150,0.34)")
  ctx.stroke()
  ctx.restore()
}

const glowCache = new Map<string, HTMLCanvasElement>()

function glowSprite(color: string, size = 128): HTMLCanvasElement {
  const key = `${color}@${size}`
  const hit = glowCache.get(key)
  if (hit) return hit
  const c = document.createElement("canvas")
  c.width = size
  c.height = size
  const g = c.getContext("2d")
  if (g) {
    const r = size / 2
    const grad = g.createRadialGradient(r, r, 0, r, r, r)
    grad.addColorStop(0, color.replace("ALPHA", "0.95"))
    grad.addColorStop(0.22, color.replace("ALPHA", "0.5"))
    grad.addColorStop(0.55, color.replace("ALPHA", "0.14"))
    grad.addColorStop(1, color.replace("ALPHA", "0"))
    g.fillStyle = grad
    g.fillRect(0, 0, size, size)
  }
  glowCache.set(key, c)
  return c
}

/** Additive bloom blit. Cheap: one drawImage against a cached radial. */
export function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha = 1,
): void {
  if (alpha <= 0.002 || radius <= 0) return
  const s = glowSprite(color)
  const prevOp = ctx.globalCompositeOperation
  // Compose with whatever alpha the caller is already fading at, and PUT IT
  // BACK. Resetting to 1 here made every glowing label ignore the overlay
  // fade it was drawn inside — the panel faded in from nothing while its text
  // sat there at full strength.
  const prevAlpha = ctx.globalAlpha
  ctx.globalCompositeOperation = "lighter"
  ctx.globalAlpha = Math.min(1, alpha) * prevAlpha
  ctx.drawImage(s, x - radius, y - radius, radius * 2, radius * 2)
  ctx.globalAlpha = prevAlpha
  ctx.globalCompositeOperation = prevOp
}

export const GLOW_HOT = "rgba(255,140,40,ALPHA)"
export const GLOW_WHITE = "rgba(255,240,210,ALPHA)"
export const GLOW_GOLD = "rgba(255,205,84,ALPHA)"
export const GLOW_COLD = "rgba(99,224,255,ALPHA)"

export type TextOpts = {
  size: number
  color?: string
  align?: CanvasTextAlign
  baseline?: CanvasTextBaseline
  mono?: boolean
  weight?: number
  tracking?: number
  alpha?: number
  /** Draws a soft additive halo behind the glyphs. */
  glowColor?: string
  glowRadius?: number
}

export function text(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  o: TextOpts,
): void {
  ctx.save()
  const family = o.mono
    ? `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace`
    : `ui-sans-serif, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
  ctx.font = `${o.weight ?? (o.mono ? 800 : 900)} ${o.size}px ${family}`
  ctx.textAlign = o.align ?? "left"
  ctx.textBaseline = o.baseline ?? "alphabetic"
  if (o.tracking !== undefined && "letterSpacing" in ctx) {
    ;(ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      `${o.tracking}px`
  }
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha
  if (o.glowColor) {
    const w = ctx.measureText(str).width
    glow(
      ctx,
      x + (ctx.textAlign === "center" ? 0 : ctx.textAlign === "right" ? -w / 2 : w / 2),
      y - o.size * 0.34,
      o.glowRadius ?? o.size * 1.5,
      o.glowColor,
      0.55,
    )
  }
  ctx.fillStyle = o.color ?? PAL.text
  ctx.fillText(str, x, y)
  ctx.restore()
}

export function measure(
  ctx: CanvasRenderingContext2D,
  str: string,
  size: number,
  mono = false,
  tracking = 0,
): number {
  ctx.save()
  const family = mono
    ? `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace`
    : `ui-sans-serif, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
  ctx.font = `${mono ? 800 : 900} ${size}px ${family}`
  if ("letterSpacing" in ctx) {
    ;(ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${tracking}px`
  }
  const w = ctx.measureText(str).width
  ctx.restore()
  return w
}

/** A filled progress chevron strip — the "N more to double" indicator. */
export function pips(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  filled: number,
  total: number,
  color: string,
): void {
  const gap = Math.max(1.5, w * 0.012)
  const pw = (w - gap * (total - 1)) / total
  for (let i = 0; i < total; i++) {
    const px = x + i * (pw + gap)
    ctx.beginPath()
    ctx.moveTo(px, y + h)
    ctx.lineTo(px + pw * 0.32, y)
    ctx.lineTo(px + pw, y)
    ctx.lineTo(px + pw * 0.68, y + h)
    ctx.closePath()
    ctx.fillStyle = i < filled ? color : "rgba(255,255,255,0.09)"
    ctx.fill()
  }
}
