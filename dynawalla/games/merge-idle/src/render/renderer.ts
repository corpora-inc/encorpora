/**
 * Three stacked canvases:
 *
 *   water — opaque. Gradient, light shafts, caustics, vignette.
 *   glow  — HALF RESOLUTION, additive, CSS-blurred, composited with `screen`.
 *           Every halo and every particle goes here, which is why the reef
 *           blooms instead of looking like stickers, and why it is cheap: a
 *           quarter of the pixels and one GPU blur instead of `shadowBlur`.
 *   sharp — transparent. Sprites, numerals, vent chrome, floaters. Nothing
 *           blurred, because a numeral you cannot read is a bug.
 *
 * The whole stack is shaken together by translating each context, with the
 * water overscanned so the shake never exposes an edge.
 */

import {
  at,
  coords,
  type Board,
} from '../core/board.ts'
import { rank, silhouetteOf } from '../core/ladder.ts'
import { BUDGET, type State, type Rect } from '../core/state.ts'
import { ease } from '../fx/shake.ts'
import type { Floaters } from '../fx/floaters.ts'
import type { Particles, Shockwaves } from '../fx/particles.ts'
import {
  CHALK,
  DANGER,
  INK,
  lift,
  mix,
  rampAt,
  rgba,
  shelf as shelfColour,
  TIDE,
  waterDeep,
  waterHigh,
  type Rgb,
} from './palette.ts'
import { drawGhost, FONT_STACK, SPRITE_SCALE, SpriteBook } from './sprites.ts'

export type Layout = {
  w: number
  h: number
  dpr: number
  board: Rect
  cell: number
  gap: number
  originX: number
  originY: number
  /**
   * What the shelf actually COVERS: the grid grown by `POLYP_BLEED` on every
   * side, because a polyp is drawn larger than the cell that addresses it.
   * This — not the grid — is the rectangle the vents have to stay out of.
   */
  gridRect: Rect
  ventStrip: Rect
  /** true when the vents run down the right-hand side instead of along the bottom */
  ventColumn: boolean
}

/**
 * How far a polyp is drawn PAST the cell that addresses it, as a fraction of
 * the cell.
 *
 * A polyp sprite is `SPRITE_SCALE` (1.62) cells across and is centred on its
 * cell, so it reaches 0.31 of a cell beyond the cell box on every side. The
 * first version of this layout sized the grid as if a polyp were exactly its
 * cell and then left a single `pad` — 8 to 22px — between the grid's arithmetic
 * bottom and the vent strip. At every portrait phone size that gap was smaller
 * than the bleed, so the bottom row's polyps reached into the strip, and the
 * vents (drawn AFTER the polyps, with a 0.95-alpha chimney) painted over them.
 *
 * The fix is not a z-order or an opacity: the grid is sized so that its DRAWN
 * extent fits the region left over after the vents take theirs. `gridRect` is
 * that extent, and `layout.test.ts` asserts it never meets a vent.
 */
export const POLYP_BLEED = (SPRITE_SCALE - 1) / 2

/**
 * How far the rock the shelf sits on is drawn past the grid, in gaps.
 *
 * `drawShelf` rounds a plate `gap * 2.2` outside the cells on every side. On a
 * small cell that lip is WIDER than the polyp bleed, so reserving only the
 * bleed would leave the rock itself lapping over the vents — the same bug one
 * layer down. Whichever of the two is larger is what gets reserved.
 */
export const SHELF_LIP = 2.2

/**
 * The smallest cell whose numeral a child can still read. `shelfCap` refuses to
 * grow a shelf past this; it is not enforced during layout, because clamping a
 * cell UP does not create room, it only pushes the shelf onto the vents.
 */
export const LEGIBLE_CELL = 18
/**
 * Purely so the arithmetic cannot reach zero. Deliberately far below anything
 * playable: a floor high enough to matter is a floor that makes the shelf
 * overflow its region instead of fitting it, which is the bug this file is
 * about. A shelf that lands here is one carried in from a much bigger screen
 * and it will be tiny until the child rotates back or DEEPEN is re-capped —
 * unpleasant, but readable-and-wrong beats erased-by-a-vent.
 */
const MIN_CELL = 1

/**
 * Portrait stacks the vents along the bottom under the thumbs. Landscape turns
 * them into a column down the right, which is the only way a tablet or a
 * desktop stops looking like a phone screenshot with grey bars beside it — and
 * it hands the whole reclaimed width back to the shelf.
 *
 * `area` is the region of the stage the game may put readable things in — see
 * `ui/chrome.ts`, `stageAreaFor`. It is REQUIRED, deliberately, and not
 * optional: a caller that forgets it gets a shelf and a column of vents laid
 * out to the raw canvas edges, which on a phone held wide puts the vent that
 * holds the question under the sensor housing. The only way to notice that is
 * on a device. Required, forgetting it does not compile.
 *
 * The WATER is not laid out against `area` and must not be. The gradient, the
 * light shafts and every particle run to the glass edges and under the rounded
 * corners, which is the whole reason the document asks for `viewport-fit=cover`
 * in the first place.
 */
export function computeLayout(w: number, h: number, dpr: number, b: Board, area: Rect): Layout {
  // Padding scales off the SHORTER side of the stage, not the width. A phone
  // held sideways is wide and barely 160px tall; charging it 22px of margin
  // top and bottom because it happens to be 568px across is how a notched
  // small phone ended up unable to draw a legible starting shelf at all.
  const pad = Math.max(8, Math.min(22, Math.min(w, h) * 0.03))
  const ventColumn = w / Math.max(1, h) > 1.15
  const right = area.x + area.w
  const bottom = area.y + area.h
  // The vents are placed FIRST and the shelf is given what is left. Doing it in
  // this order is the whole point: the two regions are disjoint by
  // construction, not by an offset that happens to work on one device.
  let board: Rect
  let ventStrip: Rect
  if (ventColumn) {
    const cw = Math.max(190, Math.min(300, area.w * 0.26))
    ventStrip = { x: right - cw - pad * 0.5, y: area.y + pad, w: cw, h: area.h - pad * 2 }
    board = {
      x: area.x + pad,
      y: area.y + pad,
      w: Math.max(1, ventStrip.x - pad - (area.x + pad)),
      h: area.h - pad * 2,
    }
  } else {
    const ventH = Math.max(104, Math.min(180, area.h * 0.21))
    const top = area.y + pad * 0.6
    ventStrip = { x: area.x + pad, y: bottom - ventH, w: area.w - pad * 2, h: ventH - pad * 0.5 }
    board = {
      x: area.x + pad,
      y: top,
      w: area.w - pad * 2,
      h: Math.max(1, ventStrip.y - pad - top),
    }
  }
  const gap = Math.max(3, Math.min(9, Math.min(board.w, board.h) * 0.018))
  // Solve for a cell whose DRAWN grid fits `board`, not one whose cell boxes
  // do: a row of polyps is `rows + 2 * POLYP_BLEED` cells tall on screen.
  //
  // There used to be an 18px floor here, which sounds protective and is not:
  // it does not create room, it only makes the shelf overflow the region it
  // was given — downward, onto the vents, which then paint over it. A shelf
  // too big for the glass (a save carried over from a tablet, or a rotation)
  // has to get SMALLER. `shelfCap` below is what stops the game growing into
  // that state in the first place; MIN_CELL exists only so the arithmetic
  // cannot go to zero.
  const spread = 2 * POLYP_BLEED
  // The polyps' bleed scales with the cell; the rock's lip scales with the gap.
  // Solve for both and take the smaller cell, so whichever binds is honoured.
  const lipReserve = gap * SHELF_LIP * 2
  const cell = Math.max(
    MIN_CELL,
    Math.min(
      (board.w - gap * (b.cols - 1)) / (b.cols + spread),
      (board.h - gap * (b.rows - 1)) / (b.rows + spread),
      (board.w - gap * (b.cols - 1) - lipReserve) / b.cols,
      (board.h - gap * (b.rows - 1) - lipReserve) / b.rows,
    ),
  )
  const bleed = Math.max(cell * POLYP_BLEED, gap * SHELF_LIP)
  const gridW = cell * b.cols + gap * (b.cols - 1)
  const gridH = cell * b.rows + gap * (b.rows - 1)
  // Centred when there is slack, pinned to the top-left corner of `board` when
  // there is not. A shelf too big for the glass has nowhere good to go — the
  // vents are below in portrait and to the right in landscape — so it overflows
  // towards them from a known corner rather than from the middle, which at
  // least keeps the top-left of the shelf where the eye expects it. Only
  // reachable when MIN_CELL binds; `shelfCap` is what keeps the game out of
  // that state.
  const originX = board.x + bleed + Math.max(0, (board.w - gridW - bleed * 2) / 2)
  const originY = board.y + bleed + Math.max(0, (board.h - gridH - bleed * 2) / 2)
  return {
    w,
    h,
    dpr,
    board,
    cell,
    gap,
    originX,
    originY,
    gridRect: {
      x: originX - bleed,
      y: originY - bleed,
      w: gridW + bleed * 2,
      h: gridH + bleed * 2,
    },
    ventStrip,
    ventColumn,
  }
}

/**
 * Where each vent sits inside the strip.
 *
 * Pure, and out here rather than inside `Game`, so a test can ask for the very
 * rectangles the child sees and check them against the shelf. The whole rect is
 * the drop target — a polyp dragged anywhere onto a chimney is fed to it — so
 * this, not the little number plate, is what has to clear 44px.
 */
export function ventRects(l: Layout, n: number): Rect[] {
  const strip = l.ventStrip
  const count = Math.max(1, n)
  const out: Rect[] = []
  if (l.ventColumn) {
    const gap = Math.max(8, Math.min(16, strip.h * 0.02))
    const h = Math.min((strip.h - gap * (count - 1)) / count, 190)
    const top = strip.y + (strip.h - (h * count + gap * (count - 1))) / 2
    for (let i = 0; i < count; i++) out.push({ x: strip.x, y: top + i * (h + gap), w: strip.w, h })
    return out
  }
  const gap = Math.max(6, Math.min(12, strip.w * 0.02))
  const w = (strip.w - gap * (count - 1)) / count
  for (let i = 0; i < count; i++) out.push({ x: strip.x + i * (w + gap), y: strip.y, w, h: strip.h })
  return out
}

/**
 * The number plate on a chimney — the "pill" a child reads the target off.
 * A label, not a target: the drop zone is the whole vent.
 */
export function promptPlate(r: Rect): Rect {
  return { x: r.x + r.w * 0.06, y: r.y + r.h * 0.1, w: r.w * 0.88, h: r.h * 0.36 }
}

/**
 * The largest shelf this glass can hold with every polyp still legible.
 *
 * DEEPEN used to grow the shelf to a flat 7×9 on any screen. On the smallest
 * notched phone a 9-row shelf cannot be drawn above the vent band at a legible
 * cell, so it was drawn over it. Growth is capped by what fits instead — the
 * reflow the founder should never have to notice, rather than a collision he
 * would.
 */
export function shelfCap(l: Layout): { cols: number; rows: number } {
  const spread = 2 * POLYP_BLEED
  const lipReserve = l.gap * SHELF_LIP * 2
  // Both of the inequalities `computeLayout` minimises over, inverted. Solving
  // only the polyp one let the cap admit a shelf whose real cell came out
  // fractionally under LEGIBLE_CELL, because the rock's lip is what binds at
  // small cells.
  const fit = (extent: number): number =>
    Math.max(
      1,
      Math.min(
        Math.floor((extent + l.gap - LEGIBLE_CELL * spread) / (LEGIBLE_CELL + l.gap)),
        Math.floor((extent + l.gap - lipReserve) / (LEGIBLE_CELL + l.gap)),
      ),
    )
  return { cols: fit(l.board.w), rows: fit(l.board.h) }
}

/** The platform's minimum touch target, and a vent is one — you drop onto it. */
export const VENT_MIN = 44

/**
 * How many vents this shape of screen will ever hold.
 *
 * Bounded by the 44px drop minimum as well as by taste. A phone held wide has
 * barely 80px of stage between the band and the rail, and the old floor of two
 * vents split that into a pair of 37px chimneys — a target a seven-year-old
 * cannot hit with a polyp in flight. One vent that can be aimed at beats two
 * that cannot.
 */
export function ventCap(l: Layout): number {
  const strip = l.ventStrip
  if (l.ventColumn) {
    const gap = Math.max(8, Math.min(16, strip.h * 0.02))
    const fits = Math.floor((strip.h + gap) / (VENT_MIN + gap))
    return Math.max(1, Math.min(5, fits, Math.max(2, Math.floor(strip.h / 150))))
  }
  const gap = Math.max(6, Math.min(12, strip.w * 0.02))
  const fits = Math.floor((strip.w + gap) / (VENT_MIN + gap))
  const byWidth = l.w < 480 ? 2 : l.w < 760 ? 3 : l.w < 1100 ? 4 : 5
  return Math.max(1, Math.min(5, fits, byWidth))
}

export function cellCentre(l: Layout, b: Board, i: number): { x: number; y: number } {
  const { cx, cy } = coords(b, i)
  return {
    x: l.originX + cx * (l.cell + l.gap) + l.cell / 2,
    y: l.originY + cy * (l.cell + l.gap) + l.cell / 2,
  }
}

export function cellAtPoint(l: Layout, b: Board, x: number, y: number): number {
  const stride = l.cell + l.gap
  const cx = Math.floor((x - l.originX) / stride)
  const cy = Math.floor((y - l.originY) / stride)
  if (cx < 0 || cy < 0 || cx >= b.cols || cy >= b.rows) return -1
  // Generous hit box: the whole stride, not just the cell, so a fat finger
  // between two cells always resolves to the nearer one instead of nothing.
  return cy * b.cols + cx
}

function roundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  g.beginPath()
  g.moveTo(x + rr, y)
  g.arcTo(x + w, y, x + w, y + h, rr)
  g.arcTo(x + w, y + h, x, y + h, rr)
  g.arcTo(x, y + h, x, y, rr)
  g.arcTo(x, y, x + w, y, rr)
  g.closePath()
}

export class Renderer {
  readonly water: HTMLCanvasElement
  readonly glow: HTMLCanvasElement
  readonly sharp: HTMLCanvasElement
  private wg: CanvasRenderingContext2D
  private gg: CanvasRenderingContext2D
  private sg: CanvasRenderingContext2D
  private book = new SpriteBook()
  layout: Layout
  /** The stage's safe rectangle, kept so `relayout` does not have to be told twice. */
  private area: Rect = { x: 0, y: 0, w: 1, h: 1 }
  private glowScale = 0.5
  private waterGrad: CanvasGradient | null = null
  private gradKey = ''

  constructor(host: HTMLElement) {
    this.water = mk('ab-water')
    this.glow = mk('ab-glow')
    this.sharp = mk('ab-sharp')
    this.glow.style.mixBlendMode = 'screen'
    host.append(this.water, this.glow, this.sharp)
    this.wg = ctx(this.water)
    this.gg = ctx(this.glow)
    this.sg = ctx(this.sharp)
    this.layout = { w: 1, h: 1, dpr: 1, board: { x: 0, y: 0, w: 1, h: 1 }, cell: 20, gap: 4, originX: 0, originY: 0, gridRect: { x: 0, y: 0, w: 1, h: 1 }, ventStrip: { x: 0, y: 0, w: 1, h: 1 }, ventColumn: false }
  }

  destroy(): void {
    this.water.remove()
    this.glow.remove()
    this.sharp.remove()
    this.book.clear()
  }

  resize(w: number, h: number, dpr: number, b: Board, tier: State['tier'], area: Rect): void {
    const budget = BUDGET[tier]
    this.glowScale = budget.glowScale
    this.book.setDpr(dpr)
    this.book.clear()
    for (const [c, scale] of [
      [this.water, 1],
      [this.glow, this.glowScale],
      [this.sharp, 1],
    ] as const) {
      c.width = Math.max(1, Math.round(w * dpr * scale))
      c.height = Math.max(1, Math.round(h * dpr * scale))
      c.style.width = `${w}px`
      c.style.height = `${h}px`
    }
    this.glow.style.filter = budget.bloomLayer && budget.blurPx > 0 ? `blur(${budget.blurPx}px)` : 'none'
    this.glow.style.display = budget.bloomLayer ? 'block' : 'none'
    this.wg = ctx(this.water)
    this.gg = ctx(this.glow)
    this.sg = ctx(this.sharp)
    this.wg.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.gg.setTransform(dpr * this.glowScale, 0, 0, dpr * this.glowScale, 0, 0)
    this.sg.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.area = area
    this.layout = computeLayout(w, h, dpr, b, area)
    this.waterGrad = null
    this.gradKey = ''
  }

  relayout(b: Board): void {
    const l = this.layout
    this.layout = computeLayout(l.w, l.h, l.dpr, b, this.area)
    this.book.clear()
  }

  get sprites(): SpriteBook {
    return this.book
  }

  /* ------------------------------------------------------------------ frame */

  draw(
    s: State,
    t: number,
    shake: { ox: number; oy: number; rot: number; level: number },
    particles: Particles,
    waves: Shockwaves,
    floaters: Floaters,
  ): void {
    const l = this.layout
    const budget = BUDGET[s.tier]
    const { wg, gg, sg } = this

    wg.save()
    gg.save()
    sg.save()
    const cx = l.w / 2
    const cy = l.h / 2
    for (const [g, sc] of [
      [wg, 1],
      [gg, 1],
      [sg, 1],
    ] as const) {
      void sc
      g.translate(cx + shake.ox, cy + shake.oy)
      g.rotate(shake.rot)
      g.translate(-cx, -cy)
    }

    this.drawWater(wg, s, t)
    gg.clearRect(-80, -80, l.w + 160, l.h + 160)
    sg.clearRect(-80, -80, l.w + 160, l.h + 160)

    gg.globalCompositeOperation = 'lighter'

    this.drawShelf(sg, gg, s, t)
    this.drawPolyps(sg, gg, s, t)
    this.drawVents(sg, gg, s, t)

    waves.draw(gg, 1)
    particles.draw(gg, this.book, 1)
    if (budget.caustics) this.drawTopLight(gg, s, t)

    this.drawSwell(sg, gg, s, t)
    this.drawDrag(sg, gg, s, t)
    floaters.draw(sg, 1)
    if (s.crowded) this.drawCrowdBanner(sg, s, t)

    gg.globalCompositeOperation = 'source-over'
    wg.restore()
    gg.restore()
    sg.restore()
  }

  /* ------------------------------------------------------------------ water */

  private drawWater(g: CanvasRenderingContext2D, s: State, t: number): void {
    const l = this.layout
    const key = `${Math.round(s.bloom * 40)}|${Math.round(l.w)}|${Math.round(l.h)}`
    if (key !== this.gradKey || !this.waterGrad) {
      const grad = g.createLinearGradient(0, -60, 0, l.h + 60)
      const hi = waterHigh(s.bloom)
      const lo = waterDeep(s.bloom)
      grad.addColorStop(0, rgba(hi, 1))
      grad.addColorStop(0.34, rgba(mix(hi, lo, 0.62), 1))
      grad.addColorStop(1, rgba(lo, 1))
      this.waterGrad = grad
      this.gradKey = key
    }
    g.fillStyle = this.waterGrad
    g.fillRect(-80, -80, l.w + 160, l.h + 160)

    // shafts of far-off surface light
    const shafts = BUDGET[s.tier].caustics ? 4 : 2
    g.globalCompositeOperation = 'lighter'
    for (let i = 0; i < shafts; i++) {
      const px = ((i * 0.29 + 0.12 + Math.sin(t * 0.07 + i) * 0.05) % 1) * l.w
      const wgt = l.w * (0.1 + 0.05 * Math.sin(t * 0.11 + i * 2))
      const gr = g.createLinearGradient(px, 0, px + wgt * 0.4, l.h)
      const c = mix(waterHigh(s.bloom), [255, 255, 255], 0.35)
      gr.addColorStop(0, rgba(c, 0.09 + s.bloom * 0.05))
      gr.addColorStop(1, rgba(c, 0))
      g.fillStyle = gr
      g.beginPath()
      g.moveTo(px - wgt / 2, -20)
      g.lineTo(px + wgt / 2, -20)
      g.lineTo(px + wgt * 1.5, l.h + 20)
      g.lineTo(px + wgt * 0.4, l.h + 20)
      g.closePath()
      g.fill()
    }
    g.globalCompositeOperation = 'source-over'

    // vignette keeps the eye on the shelf
    const vg = g.createRadialGradient(l.w / 2, l.h * 0.42, l.h * 0.2, l.w / 2, l.h * 0.5, l.h * 0.92)
    vg.addColorStop(0, 'rgba(0,0,0,0)')
    vg.addColorStop(1, `rgba(0,0,0,${0.5 - s.bloom * 0.16})`)
    g.fillStyle = vg
    g.fillRect(-80, -80, l.w + 160, l.h + 160)
  }

  private drawTopLight(g: CanvasRenderingContext2D, s: State, t: number): void {
    const l = this.layout
    const c = mix(TIDE, [255, 255, 255], 0.4)
    for (let i = 0; i < 3; i++) {
      const x = ((i * 0.37 + t * 0.017) % 1.2 - 0.1) * l.w
      const r = l.w * (0.22 + 0.06 * Math.sin(t * 0.4 + i))
      const img = this.book.glow(c, r * 2)
      g.globalAlpha = 0.05 + s.bloom * 0.05
      g.drawImage(img, x - r, -r * 0.5, r * 2, r * 1.4)
    }
    g.globalAlpha = 1
  }

  /* ------------------------------------------------------------------ shelf */

  private drawShelf(
    sg: CanvasRenderingContext2D,
    gg: CanvasRenderingContext2D,
    s: State,
    t: number,
  ): void {
    const l = this.layout
    const b = s.board
    const base = shelfColour(s.bloom)
    const stride = l.cell + l.gap
    const r = l.cell * 0.26

    // The rock the whole shelf sits on — drawn to `gridRect`, the same
    // rectangle the layout reserved and the layout test checks against the
    // vents, so the two cannot drift apart.
    sg.save()
    const rock = l.gridRect
    roundRect(sg, rock.x, rock.y, rock.w, rock.h, l.cell * 0.34)
    const plate = sg.createLinearGradient(0, l.originY, 0, l.originY + b.rows * stride)
    plate.addColorStop(0, rgba(lift(base, 0.08), 0.55))
    plate.addColorStop(1, rgba(mix(base, INK, 0.55), 0.62))
    sg.fillStyle = plate
    sg.fill()
    sg.strokeStyle = rgba(lift(base, 0.4), s.crowded ? 0.1 : 0.22)
    sg.lineWidth = 1.5
    sg.stroke()
    sg.restore()

    for (let i = 0; i < b.cells.length; i++) {
      const { cx, cy } = coords(b, i)
      const x = l.originX + cx * stride
      const y = l.originY + cy * stride
      roundRect(sg, x, y, l.cell, l.cell, r)
      sg.fillStyle = rgba(mix(base, INK, 0.42), 0.72)
      sg.fill()
      sg.strokeStyle = rgba(lift(base, 0.5), 0.1)
      sg.lineWidth = 1
      sg.stroke()

      // a slow breathing shimmer so an empty shelf is never dead
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.9 + cx * 0.6 + cy * 0.9)
      if (!at(b, i)) {
        sg.globalAlpha = 0.05 + pulse * 0.05
        roundRect(sg, x + l.cell * 0.3, y + l.cell * 0.3, l.cell * 0.4, l.cell * 0.4, l.cell * 0.2)
        sg.fillStyle = rgba(lift(base, 0.85), 1)
        sg.fill()
        sg.globalAlpha = 1
      }
    }

    // drop target highlight
    const d = s.drag
    if (d.active && d.overCell >= 0) {
      const { cx, cy } = coords(b, d.overCell)
      const x = l.originX + cx * stride
      const y = l.originY + cy * stride
      const c = d.wouldMerge ? rampAt(rank(at(b, d.overCell)?.value ?? 1) + 3) : CHALK
      const p = 0.6 + 0.4 * Math.sin(t * 9)
      sg.save()
      roundRect(sg, x - 2, y - 2, l.cell + 4, l.cell + 4, r + 2)
      sg.strokeStyle = rgba(c, d.wouldMerge ? 0.55 + p * 0.45 : 0.4)
      sg.lineWidth = d.wouldMerge ? 3.5 : 2
      sg.stroke()
      sg.restore()
      if (d.wouldMerge) {
        const img = this.book.glow(c, l.cell * 2.4)
        gg.globalAlpha = 0.3 + p * 0.28
        gg.drawImage(img, x + l.cell / 2 - l.cell * 1.2, y + l.cell / 2 - l.cell * 1.2, l.cell * 2.4, l.cell * 2.4)
        gg.globalAlpha = 1
      }
    }
  }

  /* ----------------------------------------------------------------- polyps */

  private drawPolyps(
    sg: CanvasRenderingContext2D,
    gg: CanvasRenderingContext2D,
    s: State,
    t: number,
  ): void {
    const l = this.layout
    const b = s.board
    const size = l.cell * SPRITE_SCALE
    for (let i = 0; i < b.cells.length; i++) {
      const p = b.cells[i]
      if (!p) continue
      if (s.drag.active && s.drag.cell === i) continue
      const c = cellCentre(l, b, i)
      const born = ease.outBack(Math.min(1, p.born), 2.9)
      const breathe = 1 + 0.035 * Math.sin(t * 1.9 + p.phase * 6.28)
      const squash = 1 + p.squash * 0.55
      const sq = 1 - p.squash * 0.22
      const pinged = s.pinged === p.value ? 1 : 0
      const pingPulse = pinged ? 1 + 0.1 * Math.sin(t * 12) : 1
      const scale = born * breathe * pingPulse
      const hue = rampAt(rank(p.value))

      // halo into the glow layer
      const haloR = l.cell * (0.9 + p.squash * 0.9 + s.bloom * 0.12)
      const img = this.book.glow(hue, haloR * 2)
      gg.globalAlpha = (0.24 + p.squash * 0.6 + pinged * 0.3) * born
      gg.drawImage(img, c.x - haloR, c.y - haloR, haloR * 2, haloR * 2)
      gg.globalAlpha = 1

      const sprite = this.book.polyp(p.value, l.cell)
      sg.save()
      sg.translate(c.x, c.y)
      sg.scale(scale * squash, scale * sq)
      sg.drawImage(sprite, -size / 2, -size / 2, size, size)
      sg.restore()
    }
  }

  /* ------------------------------------------------------------------ vents */

  private drawVents(
    sg: CanvasRenderingContext2D,
    gg: CanvasRenderingContext2D,
    s: State,
    t: number,
  ): void {
    const now = performance.now()
    for (const v of s.vents) {
      const r = v.rect
      if (r.w <= 0) continue
      const cold = now < v.coldUntil
      const shakeX = v.shake > 0 ? Math.sin(now * 0.06) * v.shake * 9 : 0
      const answer = v.answerValue
      const hue = answer ? rampAt(rank(answer)) : TIDE
      const body = cold ? mix(hue, DANGER, 0.6) : hue
      const targeted = s.drag.active && s.drag.overVent === v.id

      sg.save()
      sg.translate(r.x + shakeX, r.y)

      // chimney
      const grad = sg.createLinearGradient(0, 0, 0, r.h)
      grad.addColorStop(0, rgba(mix(shelfColour(s.bloom), body, 0.34), 0.95))
      grad.addColorStop(1, rgba(mix(INK, body, 0.14), 0.95))
      roundRect(sg, 0, 0, r.w, r.h, Math.min(18, r.w * 0.12))
      sg.fillStyle = grad
      sg.fill()
      sg.lineWidth = targeted ? 3.4 : 1.6
      sg.strokeStyle = rgba(targeted ? lift(body, 0.6) : body, targeted ? 0.95 : 0.42 + v.glow * 0.5)
      sg.stroke()

      // mouth: the socket you drop into
      const mouthR = Math.min(r.h * 0.3, r.w * 0.19)
      const mx = r.w / 2
      const my = r.h - mouthR - r.h * 0.11
      sg.beginPath()
      sg.arc(mx, my, mouthR, 0, Math.PI * 2)
      const mg = sg.createRadialGradient(mx, my, 1, mx, my, mouthR)
      mg.addColorStop(0, rgba(INK, 0.95))
      mg.addColorStop(0.72, rgba(mix(INK, body, 0.22), 0.95))
      mg.addColorStop(1, rgba(body, 0.5))
      sg.fillStyle = mg
      sg.fill()

      // the ghost of the polyp it wants
      if (answer !== null) {
        const hinted = now > v.hintAt
        const kind = hinted ? silhouetteOf(answer) : 'ring'
        const a = 0.3 + 0.22 * Math.sin(t * 3.1) + (targeted ? 0.35 : 0)
        drawGhost(sg, kind, mx, my, mouthR * 0.72, lift(body, 0.5), Math.min(1, a))
        sg.font = `900 ${mouthR * 0.8}px ${FONT_STACK}`
        sg.textAlign = 'center'
        sg.textBaseline = 'middle'
        sg.fillStyle = rgba(lift(body, 0.7), 0.55)
        sg.fillText('?', mx, my + mouthR * 0.03)
      }

      // charge ring
      const period = 1
      void period
      const frac = Math.max(0, Math.min(1, 1 - v.emitMs / Math.max(1, v.emitMs + 1)))
      void frac
      sg.beginPath()
      sg.arc(mx, my, mouthR + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v.glow)
      sg.strokeStyle = rgba(lift(body, 0.45), 0.65)
      sg.lineWidth = 2.5
      sg.stroke()

      // the request
      const q = v.q
      if (q) {
        // Same arithmetic as `promptPlate`, in the vent's own coordinates —
        // that function is what the layout test measures.
        const plate = promptPlate(r)
        const plateH = plate.h
        roundRect(sg, plate.x - r.x, plate.y - r.y, plate.w, plateH, plateH * 0.28)
        sg.fillStyle = rgba(INK, 0.66)
        sg.fill()
        let fs = Math.min(plateH * 0.62, r.w * 0.2)
        sg.textAlign = 'center'
        sg.textBaseline = 'middle'
        for (let i = 0; i < 10; i++) {
          sg.font = `800 ${fs}px ${FONT_STACK}`
          if (sg.measureText(q.prompt).width <= r.w * 0.79) break
          fs *= 0.9
        }
        sg.fillStyle = rgba(cold ? mix(CHALK, DANGER, 0.5) : CHALK, cold ? 0.55 : 1)
        sg.fillText(q.prompt, r.w / 2, r.h * 0.1 + plateH / 2)
      }

      // tier chevrons — how deep this vent runs
      const chevrons = Math.min(9, v.tier)
      for (let i = 0; i < chevrons; i++) {
        const bx = r.w * 0.09 + i * Math.min(9, r.w * 0.055)
        sg.beginPath()
        sg.moveTo(bx, r.h - 7)
        sg.lineTo(bx + 4, r.h - 13)
        sg.lineTo(bx + 8, r.h - 7)
        sg.strokeStyle = rgba(lift(body, 0.5), 0.75)
        sg.lineWidth = 2
        sg.stroke()
      }

      if (cold) {
        sg.font = `800 ${Math.min(13, r.w * 0.09)}px ${FONT_STACK}`
        sg.textAlign = 'right'
        sg.fillStyle = rgba(DANGER, 0.9)
        sg.fillText('COLD', r.w - 8, r.h - 11)
      }
      sg.restore()

      // vent glow into the bloom layer
      const gr = mouthR * (2.4 + v.flash * 4)
      const img = this.book.glow(body, gr * 2)
      gg.globalAlpha = 0.2 + v.flash * 0.8 + v.glow * 0.2
      gg.drawImage(img, r.x + mx - gr, r.y + my - gr, gr * 2, gr * 2)
      gg.globalAlpha = 1

      // sigils, for the day the host hands us an answer that is not a polyp
      if (v.chips) this.drawChips(sg, gg, s, v.chips, r, body, t)
    }
  }

  private drawChips(
    sg: CanvasRenderingContext2D,
    gg: CanvasRenderingContext2D,
    s: State,
    chips: string[],
    r: Rect,
    body: Rgb,
    t: number,
  ): void {
    const n = chips.length
    const w = Math.min(r.w / n - 6, 72)
    const h = Math.min(w * 0.62, 38)
    const y = r.y - h - 10
    for (let i = 0; i < n; i++) {
      if (s.drag.active && s.drag.chipIdx === i && s.drag.chipVent >= 0) continue
      const x = r.x + (r.w / n) * i + (r.w / n - w) / 2
      roundRect(sg, x, y, w, h, h * 0.32)
      sg.fillStyle = rgba(mix(INK, body, 0.3), 0.94)
      sg.fill()
      sg.strokeStyle = rgba(body, 0.6)
      sg.lineWidth = 1.6
      sg.stroke()
      sg.font = `800 ${h * 0.5}px ${FONT_STACK}`
      sg.textAlign = 'center'
      sg.textBaseline = 'middle'
      sg.fillStyle = rgba(CHALK, 1)
      sg.fillText(chips[i] ?? '', x + w / 2, y + h / 2)
      const img = this.book.glow(body, w)
      gg.globalAlpha = 0.12 + 0.06 * Math.sin(t * 2 + i)
      gg.drawImage(img, x + w / 2 - w / 2, y + h / 2 - w / 2, w, w)
      gg.globalAlpha = 1
    }
  }

  /* ------------------------------------------------------------------- misc */

  private drawSwell(
    sg: CanvasRenderingContext2D,
    gg: CanvasRenderingContext2D,
    s: State,
    t: number,
  ): void {
    const sw = s.swell
    if (!sw) return
    const r = 30 + 5 * Math.sin(t * 3)
    const img = this.book.glow(TIDE, r * 4)
    gg.globalAlpha = 0.7
    gg.drawImage(img, sw.x - r * 2, sw.y - r * 2, r * 4, r * 4)
    gg.globalAlpha = 1
    sg.save()
    sg.beginPath()
    sg.arc(sw.x, sw.y, r, 0, Math.PI * 2)
    const g2 = sg.createRadialGradient(sw.x, sw.y - r * 0.4, r * 0.1, sw.x, sw.y, r)
    g2.addColorStop(0, rgba(lift(TIDE, 0.7), 0.95))
    g2.addColorStop(1, rgba(TIDE, 0.35))
    sg.fillStyle = g2
    sg.fill()
    sg.strokeStyle = rgba(CHALK, 0.75)
    sg.lineWidth = 2
    sg.stroke()
    sg.font = `900 ${r * 0.52}px ${FONT_STACK}`
    sg.textAlign = 'center'
    sg.textBaseline = 'middle'
    sg.fillStyle = rgba(INK, 0.9)
    sg.fillText('TIDE', sw.x, sw.y)
    sg.restore()
  }

  private drawDrag(
    sg: CanvasRenderingContext2D,
    gg: CanvasRenderingContext2D,
    s: State,
    _t: number,
  ): void {
    const d = s.drag
    if (!d.active) return
    const l = this.layout
    let value = 0
    if (d.cell >= 0) value = at(s.board, d.cell)?.value ?? 0
    else if (d.chipVent >= 0) value = d.chipValue
    if (!value) return
    const size = l.cell * SPRITE_SCALE * 1.16
    const hue = rampAt(rank(value))
    const gr = l.cell * 1.5
    const img = this.book.glow(hue, gr * 2)
    gg.globalAlpha = 0.55
    gg.drawImage(img, d.sx - gr, d.sy - gr, gr * 2, gr * 2)
    gg.globalAlpha = 1

    // shadow on the shelf below, which is what sells "lifted"
    sg.save()
    sg.globalAlpha = 0.34
    sg.fillStyle = '#000'
    sg.beginPath()
    sg.ellipse(d.sx + 4, d.sy + l.cell * 0.5, l.cell * 0.42, l.cell * 0.16, 0, 0, Math.PI * 2)
    sg.fill()
    sg.restore()

    const tilt = Math.max(-0.16, Math.min(0.16, (d.x - d.sx) * 0.008))
    sg.save()
    sg.translate(d.sx, d.sy)
    sg.rotate(tilt)
    sg.drawImage(this.book.polyp(value, l.cell), -size / 2, -size / 2, size, size)
    sg.restore()
  }

  private drawCrowdBanner(sg: CanvasRenderingContext2D, s: State, t: number): void {
    const l = this.layout
    const pulse = 0.5 + 0.5 * Math.sin(t * 3.4)
    const h = Math.min(46, l.h * 0.07)
    const y = l.board.y + 2
    sg.save()
    roundRect(sg, l.w * 0.12, y, l.w * 0.76, h, h * 0.32)
    sg.fillStyle = rgba(mix(INK, DANGER, 0.28), 0.9)
    sg.fill()
    sg.strokeStyle = rgba(DANGER, 0.5 + pulse * 0.5)
    sg.lineWidth = 2
    sg.stroke()
    sg.font = `800 ${h * 0.4}px ${FONT_STACK}`
    sg.textAlign = 'center'
    sg.textBaseline = 'middle'
    sg.fillStyle = rgba(CHALK, 1)
    sg.fillText('SHELF CROWDED — merge or dissolve', l.w / 2, y + h / 2)
    sg.restore()
    void s
  }
}

function mk(cls: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.className = cls
  return c
}

function ctx(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d', { alpha: c.className !== 'ab-water' })
  if (!g) throw new Error('merge-idle: could not get a 2d context')
  return g
}
