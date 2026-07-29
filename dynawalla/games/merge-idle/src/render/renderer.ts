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
  ventStrip: Rect
  /** true when the vents run down the right-hand side instead of along the bottom */
  ventColumn: boolean
}

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
  const pad = Math.max(8, Math.min(22, w * 0.03))
  const ventColumn = w / Math.max(1, h) > 1.15
  const right = area.x + area.w
  const bottom = area.y + area.h
  let board: Rect
  let ventStrip: Rect
  if (ventColumn) {
    const cw = Math.max(190, Math.min(300, area.w * 0.26))
    board = { x: area.x + pad, y: area.y + pad, w: area.w - cw - pad * 2.5, h: area.h - pad * 2 }
    ventStrip = { x: right - cw - pad * 0.5, y: area.y + pad, w: cw, h: area.h - pad * 2 }
  } else {
    const ventH = Math.max(104, Math.min(180, area.h * 0.21))
    board = { x: area.x + pad, y: area.y + pad * 0.6, w: area.w - pad * 2, h: area.h - ventH - pad * 1.6 }
    ventStrip = { x: area.x + pad, y: bottom - ventH, w: area.w - pad * 2, h: ventH - pad * 0.5 }
  }
  const gap = Math.max(3, Math.min(9, Math.min(board.w, board.h) * 0.018))
  const cell = Math.max(
    18,
    Math.min((board.w - gap * (b.cols - 1)) / b.cols, (board.h - gap * (b.rows - 1)) / b.rows),
  )
  const gridW = cell * b.cols + gap * (b.cols - 1)
  const gridH = cell * b.rows + gap * (b.rows - 1)
  return {
    w,
    h,
    dpr,
    board,
    cell,
    gap,
    originX: board.x + (board.w - gridW) / 2,
    originY: board.y + (board.h - gridH) / 2,
    ventStrip,
    ventColumn,
  }
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
    this.layout = { w: 1, h: 1, dpr: 1, board: { x: 0, y: 0, w: 1, h: 1 }, cell: 20, gap: 4, originX: 0, originY: 0, ventStrip: { x: 0, y: 0, w: 1, h: 1 }, ventColumn: false }
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

    // the rock the whole shelf sits on
    sg.save()
    roundRect(
      sg,
      l.originX - l.gap * 2.2,
      l.originY - l.gap * 2.2,
      b.cols * stride - l.gap + l.gap * 4.4,
      b.rows * stride - l.gap + l.gap * 4.4,
      l.cell * 0.34,
    )
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
        const plateH = r.h * 0.36
        roundRect(sg, r.w * 0.06, r.h * 0.1, r.w * 0.88, plateH, plateH * 0.28)
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
