/**
 * world/facadePaint.ts — the PURE canvas2D façade painter, extracted from
 * buildings.ts so it can run in EITHER context:
 *   • the main thread (the synchronous fallback, exactly as before), and
 *   • an OffscreenCanvas Web Worker (Stage 3), painting off the main thread and
 *     returning an `ImageBitmap` the main thread cheaply uploads to a texture.
 *
 * NOTHING here touches Babylon or the DOM — only a 2D drawing context (which can
 * be a `CanvasRenderingContext2D` OR an `OffscreenCanvasRenderingContext2D`).
 * That purity is the whole point: the worker and the main thread paint a façade
 * pixel-identically from the same code, so moving the paint off-thread can never
 * change how a building looks.
 *
 * This is a straight MOVE of buildings.ts's façade drawing (drawFacade + its
 * paper/window/door helpers + the tiny colour helpers it needs). buildings.ts
 * re-imports `drawFacade` from here, so there is one source of truth.
 */

export type BuildingKind = "house" | "shop" | "inn" | "chapel" | "workshop" | "market-hall"

export type RGB = { r: number; g: number; b: number }

/** a 2D context that may be DOM- or Offscreen-backed (both satisfy this subset). */
type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x)
const mixRgb = (a: RGB, b: RGB, t: number): RGB => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
})
export const rgbToCss = (c: RGB): string =>
  `rgb(${Math.round(clamp01(c.r) * 255)},${Math.round(clamp01(c.g) * 255)},${Math.round(clamp01(c.b) * 255)})`
export const shade = (c: RGB, t: number): RGB =>
  t >= 0 ? mixRgb(c, { r: 1, g: 1, b: 1 }, t) : mixRgb(c, { r: 0, g: 0, b: 0 }, -t)

/** person height in world units (door sizing reads from it). Kept in sync with
 *  buildings.ts H_P (a façade-only constant). */
const H_P = 2.6

export interface FacadeSpec {
  kind: BuildingKind
  storeys: number
  windowsPerRow: number
  stucco: RGB
  trim: RGB
  hasDoor: boolean
  arched: boolean
  variant: number
  /** glass colour — cool lit-cyan for the night city, soft blue for daylight. */
  glass?: string
  /** night city: skip the colonial flower-boxes (kept warm-day only). */
  noFlowers?: boolean
  /** the building's WORLD body height (wu) so the door lands at a fixed world
   *  height on cottages AND towers alike. */
  bodyWorldH?: number
}

/* ----------------------------------------------------- paper-cutout drawing */

/** torn-paper rounded rect outline (deterministic wobble), matches cutoutArt. */
function tornRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number, amp = 1.6) {
  const rr = Math.min(r, w / 2, h / 2)
  const steps = 40
  const cx = x + w / 2
  const cy = y + h / 2
  ctx.beginPath()
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2
    const ux = Math.cos(t)
    const uy = Math.sin(t)
    const k = 1 - rr / Math.min(w, h)
    const sx = Math.sign(ux) * Math.pow(Math.abs(ux), 1 - k * 0.6)
    const sy = Math.sign(uy) * Math.pow(Math.abs(uy), 1 - k * 0.6)
    const j = Math.sin(t * 9.3 + cx * 0.7) * Math.cos(t * 5.1 + cy * 0.3) * amp
    const px = cx + sx * (w / 2 + j)
    const py = cy + sy * (h / 2 + j)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

export function rounded(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** a paper piece: drop shadow + cream deckle + fill + gentle sheen. */
export function paper(
  ctx: Ctx2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | CanvasGradient,
  opts: { torn?: boolean; deckle?: number; shadow?: number } = {},
) {
  const deckle = opts.deckle ?? 5
  const t = opts.torn ?? true
  ctx.save()
  ctx.shadowColor = "rgba(28,20,12,0.30)"
  ctx.shadowBlur = opts.shadow ?? 7
  ctx.shadowOffsetX = 1.5
  ctx.shadowOffsetY = 4
  ctx.fillStyle = "rgba(255,250,240,1)"
  if (t) tornRect(ctx, x - deckle, y - deckle, w + deckle * 2, h + deckle * 2, r + deckle)
  else rounded(ctx, x - deckle, y - deckle, w + deckle * 2, h + deckle * 2, r + deckle)
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = fill
  if (t) tornRect(ctx, x, y, w, h, r, 1.1)
  else rounded(ctx, x, y, w, h, r)
  ctx.fill()

  ctx.save()
  if (t) tornRect(ctx, x, y, w, h, r, 1.1)
  else rounded(ctx, x, y, w, h, r)
  ctx.clip()
  const sh = ctx.createLinearGradient(0, y, 0, y + h)
  sh.addColorStop(0, "rgba(255,255,255,0.16)")
  sh.addColorStop(0.5, "rgba(255,255,255,0)")
  sh.addColorStop(1, "rgba(20,12,6,0.14)")
  ctx.fillStyle = sh
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4)
  ctx.restore()
}

/** a shuttered window painted onto the facade canvas. */
function drawWindow(ctx: Ctx2D, x: number, y: number, w: number, h: number, trim: RGB, glass: string, flowers = true) {
  const trimCss = rgbToCss(trim)
  // recessed frame
  paper(ctx, x, y, w, h, w * 0.08, trimCss, { deckle: 3, shadow: 4 })
  // glass
  const inset = w * 0.14
  paper(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, w * 0.04, glass, { torn: false, deckle: 0, shadow: 0 })
  // muntins (cross bars)
  ctx.strokeStyle = trimCss
  ctx.lineWidth = Math.max(1.5, w * 0.045)
  ctx.beginPath()
  ctx.moveTo(x + w / 2, y + inset)
  ctx.lineTo(x + w / 2, y + h - inset)
  ctx.moveTo(x + inset, y + h * 0.5)
  ctx.lineTo(x + w - inset, y + h * 0.5)
  ctx.stroke()
  // open shutters flanking it
  const sw = w * 0.26
  const shFill = shade(trim, 0.12)
  paper(ctx, x - sw * 0.7, y, sw, h, w * 0.05, rgbToCss(shFill), { deckle: 2, shadow: 3 })
  paper(ctx, x + w - sw * 0.3, y, sw, h, w * 0.05, rgbToCss(shFill), { deckle: 2, shadow: 3 })
  // slats on shutters
  ctx.strokeStyle = "rgba(0,0,0,0.18)"
  ctx.lineWidth = 1.5
  for (let i = 1; i < 4; i++) {
    const yy = y + (h / 4) * i
    ctx.beginPath()
    ctx.moveTo(x - sw * 0.7, yy)
    ctx.lineTo(x - sw * 0.7 + sw, yy)
    ctx.moveTo(x + w - sw * 0.3, yy)
    ctx.lineTo(x + w - sw * 0.3 + sw, yy)
    ctx.stroke()
  }
  // A restrained window-box under the sill — a believable detail, not a candy
  // toy. Muted blooms, smaller, fewer; reads as a real planted ledge.
  if (!flowers) return
  paper(ctx, x + w * 0.12, y + h, w * 0.76, h * 0.14, w * 0.04, rgbToCss(shade(trim, -0.12)), { deckle: 2, shadow: 2 })
  for (const fx of [0.3, 0.7]) {
    ctx.fillStyle = "#9e5b4e" // muted brick-rose, not fire-engine red
    ctx.beginPath()
    ctx.arc(x + w * fx, y + h + h * 0.03, w * 0.038, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#6f7d49" // sage greenery
    ctx.beginPath()
    ctx.arc(x + w * fx + w * 0.05, y + h + h * 0.05, w * 0.03, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** a framed door (street side). */
function drawDoor(ctx: Ctx2D, x: number, y: number, w: number, h: number, trim: RGB, arched: boolean) {
  // stone surround
  paper(ctx, x - w * 0.12, y - h * 0.04, w * 1.24, h * 1.04, w * 0.1, rgbToCss(shade(trim, 0.3)), { deckle: 3, shadow: 5 })
  // door leaf
  const r = arched ? w * 0.5 : w * 0.08
  paper(ctx, x, y, w, h, r, rgbToCss(trim), { deckle: 2, shadow: 3 })
  // planks
  ctx.strokeStyle = "rgba(0,0,0,0.22)"
  ctx.lineWidth = Math.max(1.5, w * 0.03)
  for (let i = 1; i < 3; i++) {
    ctx.beginPath()
    ctx.moveTo(x + (w / 3) * i, y + (arched ? h * 0.12 : 0))
    ctx.lineTo(x + (w / 3) * i, y + h)
    ctx.stroke()
  }
  // knob
  ctx.fillStyle = "#e8c54a"
  ctx.beginPath()
  ctx.arc(x + w * 0.82, y + h * 0.55, w * 0.06, 0, Math.PI * 2)
  ctx.fill()
}

/* ------------------------------------------------------------ facade canvas */

/** paint a full wall facade (stucco base + windows + optional door). */
export function drawFacade(ctx: Ctx2D, W: number, H: number, s: FacadeSpec) {
  // stucco base with a subtle painterly wash + plinth
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, rgbToCss(shade(s.stucco, 0.05)))
  g.addColorStop(1, rgbToCss(shade(s.stucco, -0.08)))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // stone plinth band along the bottom
  ctx.fillStyle = rgbToCss(shade(s.stucco, -0.16))
  ctx.fillRect(0, H * 0.88, W, H * 0.12)
  // faint vertical brush streaks → aged stucco
  ctx.strokeStyle = "rgba(120,90,60,0.06)"
  ctx.lineWidth = 2
  for (let i = 0; i < 9; i++) {
    const x = (W / 9) * (i + 0.5) + Math.sin(i * 3.1) * 6
    ctx.beginPath()
    ctx.moveTo(x, H * 0.06)
    ctx.lineTo(x, H * 0.84)
    ctx.stroke()
  }

  const glass = s.glass ?? "#9fc3cf"
  const rows = s.storeys
  const cols = s.windowsPerRow
  const topPad = H * (s.kind === "chapel" ? 0.14 : 0.1)
  const botPad = H * 0.18
  const rowSpan = (H - topPad - botPad) / rows
  const winH = rowSpan * 0.6
  const winW = (W / cols) * 0.46

  // ---- the DOOR is a real, character-scaled opening at the facade base ----
  // Compute the door's painted footprint up front so the window grid can carve a
  // CLEAR KEEP-OUT around it (the old code skipped one hard-coded centre cell,
  // which broke for even `cols` — the door is centred on the WALL, not a column —
  // and for tall doors that rise into the row above; windows then crowded / over-
  // painted the doorway). We skip ANY window whose cell overlaps the door box +
  // margin, across ALL rows, so no pane ever lands on or beside the door.
  let doorBox: { x0: number; x1: number; y0: number } | null = null
  if (s.hasDoor) {
    const bodyWorldH = s.bodyWorldH ?? H_P * 2.5
    const targetDoorWorldH = H_P * 1.2 // a person visibly fits through
    const doorH = Math.min(rowSpan * 1.7, (targetDoorWorldH / bodyWorldH) * H)
    const doorW = Math.min((W / cols) * 0.74, doorH * 0.62)
    const doorX = (W - doorW) / 2
    // sit the door on the plinth band (bottom of the wall) — base at H*0.985.
    const doorY = H * 0.985 - doorH
    drawDoor(ctx, doorX, doorY, doorW, doorH, s.trim, s.arched)
    // drawDoor's STONE SURROUND paints out to [x - 0.12w, x + 1.12w] horizontally
    // and starts at y - 0.04h; the door leaf adds nothing wider. Add a comfortable
    // clear margin (a fraction of a cell) so windows don't even crowd the surround.
    const clear = (W / cols) * 0.28
    doorBox = {
      x0: doorX - doorW * 0.12 - clear,
      x1: doorX + doorW * 1.12 + clear,
      y0: doorY - doorH * 0.04, // anything whose cell dips below this is over the door
    }
  }

  // ---- windows: a tidy grid that never overlaps (or crowds) the door bay ----
  for (let row = 0; row < rows; row++) {
    const cy = topPad + rowSpan * row + (rowSpan - winH) / 2
    for (let col = 0; col < cols; col++) {
      const cellX = (W / cols) * col + (W / cols - winW) / 2
      // KEEP-OUT: skip a window if its painted span overlaps the door box
      // horizontally AND the window's bottom reaches into the door's vertical
      // extent. This carves the door clear on EVERY building width (even cols →
      // door between two columns) and height (tall door → upper rows too).
      // The window's TRUE painted span is wider than [cellX, cellX+winW]: drawWindow
      // flanks it with shutters out to ~[cellX - 0.18·winW, cellX + 1.08·winW], so
      // we test that fuller span — a shutter must not graze the door either.
      if (doorBox) {
        const winLeft = cellX - winW * 0.18
        const winRight = cellX + winW * 1.08
        const winBottom = cy + winH
        const overlapsX = winRight > doorBox.x0 && winLeft < doorBox.x1
        const reachesDoorY = winBottom > doorBox.y0
        if (overlapsX && reachesDoorY) continue
      }
      drawWindow(ctx, cellX, cy, winW, winH, s.trim, glass, !s.noFlowers && row < rows - 1)
    }
  }
}
