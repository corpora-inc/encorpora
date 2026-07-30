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
import { fmt, rank } from '../core/ladder.ts'
import { running } from '../core/mouth.ts'
import { FORM_GLYPH } from '../core/target.ts'
import { isMouthColumn } from '../ui/chrome.ts'
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
} from './palette.ts'
import { FONT_STACK, SPRITE_SCALE, SpriteBook } from './sprites.ts'

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
  /** The region the one mouth lives in. Disjoint from `gridRect` by construction. */
  mouthStrip: Rect
  /** true when the mouth is a panel down the right instead of a bar along the bottom */
  mouthColumn: boolean
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
 * Portrait puts the mouth along the bottom under the thumbs. Landscape turns it
 * into a panel down the right, which is the only way a tablet or a desktop stops
 * looking like a phone screenshot with grey bars beside it — and it hands the whole
 * reclaimed width back to the shelf.
 *
 * There is ONE mouth. There used to be up to five vents, each with its own prompt
 * and its own row of answer pills, and the founder's verdict was "two vents too
 * just seems like sort of extra useless" and "why do I even care about the vents
 * actually?". One wide socket a seven-year-old can hit with a polyp in flight beats
 * a row of narrow ones — and everything the row used to cost in width and height
 * goes back to the shelf, which is the "more room for a bigger board" he asked for.
 *
 * `area` is the region of the stage the game may put readable things in — see
 * `ui/chrome.ts`, `stageAreaFor`. It is REQUIRED, deliberately, and not optional: a
 * caller that forgets it gets a shelf and a mouth laid out to the raw canvas edges,
 * which on a phone held wide puts the socket under the sensor housing. The only way
 * to notice that is on a device. Required, forgetting it does not compile.
 *
 * `mouthPad` is how far the mouth is held off each side edge, so a polyp let go over
 * one of the two bottom-corner stage buttons does not go down it —
 * `MOUTH_END_PAD` in `ui/chrome.ts`.
 *
 * The WATER is not laid out against `area` and must not be. The gradient, the light
 * shafts and every particle run to the glass edges and under the rounded corners,
 * which is the whole reason the document asks for `viewport-fit=cover`.
 */
export function computeLayout(
  w: number,
  h: number,
  dpr: number,
  b: Board,
  area: Rect,
  mouthPad = 0,
): Layout {
  // Padding scales off the SHORTER side of the stage, not the width. A phone
  // held sideways is wide and barely 160px tall; charging it 22px of margin
  // top and bottom because it happens to be 568px across is how a notched
  // small phone ended up unable to draw a legible starting shelf at all.
  const pad = Math.max(8, Math.min(22, Math.min(w, h) * 0.03))
  // The same predicate `ui/chrome.ts` places the two stage buttons with. Imported
  // rather than repeated: two answers to "is the mouth on the right?" is how a mute
  // button ends up inside the mouth.
  const mouthColumn = isMouthColumn(w, h)
  const right = area.x + area.w
  const bottom = area.y + area.h
  // The mouth is placed FIRST and the shelf is given what is left. Doing it in
  // this order is the whole point: the two regions are disjoint by construction,
  // not by an offset that happens to work on one device.
  let board: Rect
  let mouthStrip: Rect
  if (mouthColumn) {
    const cw = Math.max(150, Math.min(260, area.w * 0.22))
    mouthStrip = {
      x: right - cw - pad * 0.5,
      y: area.y + pad,
      // `mouthPad` comes off the BOTTOM here: the two stage buttons live inside the
      // column's footprint in landscape.
      h: Math.max(60, area.h - pad * 2 - mouthPad),
      w: cw,
    }
    board = {
      x: area.x + pad,
      y: area.y + pad,
      w: Math.max(1, mouthStrip.x - pad - (area.x + pad)),
      h: area.h - pad * 2,
    }
  } else {
    const mouthH = Math.max(92, Math.min(150, area.h * 0.17))
    const top = area.y + pad * 0.6
    const side = area.x + pad + mouthPad
    mouthStrip = {
      x: side,
      y: bottom - mouthH,
      w: Math.max(60, right - pad - mouthPad - side),
      h: mouthH - pad * 0.5,
    }
    board = {
      x: area.x + pad,
      y: top,
      w: area.w - pad * 2,
      h: Math.max(1, mouthStrip.y - pad - top),
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
    mouthStrip,
    mouthColumn,
  }
}

/** The platform's minimum touch target, and the mouth is one — you drop onto it. */
export const MOUTH_MIN = 44

/**
 * Where the mouth sits.
 *
 * Pure, and out here rather than inside `Game`, so a test can ask for the very
 * rectangle the child sees and check it against the shelf and against the two
 * stage buttons. The WHOLE rect is the drop target — a polyp let go anywhere on it
 * goes in — so this, not the socket circle inside it, is what has to clear 44px.
 */
export function mouthRect(l: Layout): Rect {
  const strip = l.mouthStrip
  if (l.mouthColumn) {
    const h = Math.max(MOUTH_MIN, Math.min(strip.h, 320))
    return { x: strip.x, y: strip.y + (strip.h - h) / 2, w: strip.w, h }
  }
  return { ...strip }
}

/** Where the `n`th fed polyp is drawn inside the mouth. */
export function fedSlotRect(r: Rect, index: number, slots: number): Rect {
  const n = Math.max(1, slots)
  // The row of slots takes the left two thirds; the running total takes the right.
  const zone = l2(r)
  const w = zone.w / n
  return { x: zone.x + w * index, y: zone.y, w, h: zone.h }
}

/** The part of the mouth that holds the fed polyps. */
function l2(r: Rect): Rect {
  const inset = Math.min(10, r.h * 0.1)
  const w = r.w * 0.62
  return { x: r.x + inset, y: r.y + inset, w: w - inset, h: r.h - inset * 2 }
}

/** The part of the mouth that shows the running total. */
export function totalRect(r: Rect): Rect {
  const inset = Math.min(10, r.h * 0.1)
  const x = r.x + r.w * 0.62
  return { x, y: r.y + inset, w: r.x + r.w - inset - x, h: r.h - inset * 2 }
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
  /** Kept for the same reason as `area`: `relayout` must not need telling twice. */
  private mouthPad = 0
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
    this.layout = { w: 1, h: 1, dpr: 1, board: { x: 0, y: 0, w: 1, h: 1 }, cell: 20, gap: 4, originX: 0, originY: 0, gridRect: { x: 0, y: 0, w: 1, h: 1 }, mouthStrip: { x: 0, y: 0, w: 1, h: 1 }, mouthColumn: false }
  }

  destroy(): void {
    this.water.remove()
    this.glow.remove()
    this.sharp.remove()
    this.book.clear()
  }

  resize(
    w: number,
    h: number,
    dpr: number,
    b: Board,
    tier: State['tier'],
    area: Rect,
    mouthPad = 0,
  ): void {
    this.mouthPad = mouthPad
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
    this.layout = computeLayout(w, h, dpr, b, area, mouthPad)
    this.waterGrad = null
    this.gradKey = ''
  }

  relayout(b: Board): void {
    const l = this.layout
    this.layout = computeLayout(l.w, l.h, l.dpr, b, this.area, this.mouthPad)
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
    this.drawMouth(sg, gg, s, t)

    waves.draw(gg, 1)
    particles.draw(gg, this.book, 1)
    if (budget.caustics) this.drawTopLight(gg, s, t)

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

  /* ------------------------------------------------------------------ mouth */

  /**
   * THE MOUTH. One socket, the fed polyps in a row beside it, and the running
   * total of what is in there.
   *
   * The child reads the target off the band at the top and reads what they have
   * built off this. The two ends of one sentence, and nothing between them — the
   * old vent strip carried a prompt, a ghost silhouette, a charge ring, a tier
   * chevron row, a COLD badge and a row of four answer pills, all at once.
   */
  private drawMouth(
    sg: CanvasRenderingContext2D,
    gg: CanvasRenderingContext2D,
    s: State,
    t: number,
  ): void {
    const r = s.mouthRect
    if (r.w <= 0 || r.h <= 0) return
    const target = s.target
    const shakeX = s.mouthShake > 0 ? Math.sin(t * 60) * s.mouthShake * 9 : 0
    const hue = target ? rampAt(rank(target.value)) : TIDE
    const body = s.mouthShake > 0.02 ? mix(hue, DANGER, 0.55) : hue
    const targeted = s.drag.active && s.drag.overMouth

    sg.save()
    sg.translate(r.x + shakeX, r.y)

    // the socket's shell
    const grad = sg.createLinearGradient(0, 0, 0, r.h)
    grad.addColorStop(0, rgba(mix(shelfColour(s.bloom), body, 0.3), 0.94))
    grad.addColorStop(1, rgba(mix(INK, body, 0.16), 0.96))
    roundRect(sg, 0, 0, r.w, r.h, Math.min(20, r.h * 0.24))
    sg.fillStyle = grad
    sg.fill()
    sg.lineWidth = targeted ? 3.6 : 1.6
    sg.strokeStyle = rgba(targeted ? lift(body, 0.6) : body, targeted ? 0.95 : 0.44 + s.mouthFlash * 0.5)
    sg.stroke()
    sg.restore()

    // the fed polyps, in order, at the size the shelf draws them
    const slots = Math.max(1, s.mouth.slots)
    const glyph = target ? FORM_GLYPH[target.form] : '+'
    for (let i = 0; i < slots; i++) {
      const box = fedSlotRect(r, i, slots)
      const cx = box.x + box.w / 2
      const cy = box.y + box.h / 2
      const fed = s.mouth.fed[i]
      const dragged = s.drag.active && s.drag.fedIdx === i
      if (!fed || dragged) {
        // an empty slot: a dashed socket, so a child can SEE how many will fit
        sg.save()
        sg.setLineDash([box.h * 0.12, box.h * 0.1])
        sg.lineWidth = 2
        sg.strokeStyle = rgba(lift(body, 0.4), 0.34)
        sg.beginPath()
        sg.arc(cx, cy, Math.min(box.w, box.h) * 0.32, 0, Math.PI * 2)
        sg.stroke()
        sg.restore()
      } else {
        const cell = Math.min(box.w * 0.62, box.h * 0.66)
        const size = cell * SPRITE_SCALE
        const born = ease.outBack(Math.min(1, fed.born), 2.6)
        const breathe = 1 + 0.03 * Math.sin(t * 2.2 + fed.phase * 6.28)
        const fh = rampAt(rank(fed.value))
        const haloR = cell * 0.95
        const img = this.book.glow(fh, haloR * 2)
        gg.globalAlpha = 0.3 * born
        gg.drawImage(img, cx - haloR, cy - haloR, haloR * 2, haloR * 2)
        gg.globalAlpha = 1
        sg.save()
        sg.translate(cx, cy)
        sg.scale(born * breathe, born * breathe)
        sg.drawImage(this.book.polyp(fed.value, cell), -size / 2, -size / 2, size, size)
        sg.restore()
      }
      // the operator between the slots
      if (i < slots - 1) {
        sg.font = `900 ${Math.min(20, box.h * 0.3)}px ${FONT_STACK}`
        sg.textAlign = 'center'
        sg.textBaseline = 'middle'
        sg.fillStyle = rgba(CHALK, 0.6)
        sg.fillText(glyph, box.x + box.w, cy)
      }
    }

    // the running total — what the child has made so far
    const tot = totalRect(r)
    const value = target ? running(s.mouth, target.form) : null
    sg.save()
    roundRect(sg, tot.x, tot.y, tot.w, tot.h, Math.min(14, tot.h * 0.3))
    sg.fillStyle = rgba(INK, 0.6)
    sg.fill()
    sg.strokeStyle = rgba(lift(body, 0.3), 0.28)
    sg.lineWidth = 1
    sg.stroke()
    const text = value === null ? '?' : fmt(value)
    let fs = Math.min(tot.h * 0.6, tot.w * 0.42)
    sg.textAlign = 'center'
    sg.textBaseline = 'middle'
    for (let i = 0; i < 10; i++) {
      sg.font = `900 ${fs}px ${FONT_STACK}`
      if (sg.measureText(text).width <= tot.w * 0.82) break
      fs *= 0.9
    }
    // Near the target and still under it, the total warms towards the target's
    // own colour. Over it, nothing warms — but the mouth has already resolved by
    // then, so a child never sees an overshoot sitting there being scolded.
    const close = target && value !== null && value <= target.value
    sg.fillStyle = rgba(close ? lift(hue, 0.5) : CHALK, 0.95)
    sg.fillText(text, tot.x + tot.w / 2, tot.y + tot.h / 2)
    sg.restore()

    // the flash into the bloom layer
    const gr = Math.min(r.w, r.h) * (0.7 + s.mouthFlash * 3)
    const img = this.book.glow(body, gr * 2)
    gg.globalAlpha = 0.18 + s.mouthFlash * 0.8
    gg.drawImage(img, r.x + r.w / 2 - gr, r.y + r.h / 2 - gr, gr * 2, gr * 2)
    gg.globalAlpha = 1
  }

  /* ------------------------------------------------------------------- misc */

  private drawDrag(
    sg: CanvasRenderingContext2D,
    gg: CanvasRenderingContext2D,
    s: State,
    _t: number,
  ): void {
    const d = s.drag
    if (!d.active) return
    const l = this.layout
    // The drag carries its own value: a polyp pulled back OUT of the mouth has
    // no cell on the shelf to look it up from.
    const value = d.cell >= 0 ? (at(s.board, d.cell)?.value ?? d.value) : d.value
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
