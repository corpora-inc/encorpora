// The street, drawn.
//
// Canvas 2D, one pass, no allocation in the hot path beyond the layout object.
// The layout is computed from the frame and **returned**, because the hit
// regions and the drawn shapes have to be the same rectangles: a stud that is
// drawn in one place and struck in another is the bug that makes a child think
// the game is lying to them.
//
// Two things here are load-bearing rather than decorative.
//
//   * **The mob is a rectangle and the rectangle is the arithmetic.** `ranks`
//     rows of `size` bodies. When a seam lands the same bodies rearrange into
//     `ranks × size / k` rows of `k`, and nobody leaves. The child is looking
//     at `12 = 4 × 3` because they made it.
//   * **Iron versus steel.** A rank whose size is composite is drawn as cast
//     iron, dark and locked. A rank whose size is prime is steel: cooler,
//     brighter, and lit from the side. The child can see which mobs their fists
//     work on before they swing, and that reading *is* a primality judgement.

import type { Crowd } from "../game/crowd.ts"
import type { Phase } from "../game/street.ts"
import type { Shutter } from "../game/shutter.ts"
import { PALETTE, alpha, face, label } from "./palette.ts"
import { bar, isPrime } from "../game/factor.ts"
import { PUSH_MAX } from "../game/push.ts"

export type Rect = { x: number; y: number; w: number; h: number }

export type Layout = {
  readonly width: number
  readonly height: number
  /** Tapping anywhere in here swings. */
  readonly mob: Rect
  /** One per stud on the bar, in the order `bar(size)` returns them. */
  readonly studs: ReadonlyArray<{ readonly k: number; readonly rect: Rect }>
  /** One per rivet while the plate is down. */
  readonly rivets: ReadonlyArray<{ readonly index: number; readonly rect: Rect }>
}

export type Frame = {
  readonly phase: Phase
  readonly progress: number
  readonly crowd: Crowd
  readonly shutter: Shutter | null
  /** 0..1 — how far the mob has leaned in. */
  readonly pressure: number
  readonly pushMarks: number
  readonly blocks: number
  readonly best: number
  readonly waveOfBlock: number
  readonly wavesPerBlock: number
  /** The stud lit as a hint after a shove-back. `0` when none is standing. */
  readonly hintSeam: number
  /** The stud last struck, and what it left over. Drives the ring-off drawing. */
  readonly lastSeam: number
  readonly lastRemainder: number
  readonly clean: boolean
  readonly reduced: boolean
}

const MIN_TOUCH = 44

/** Rank-to-rank spacing, as a multiple of the body cell. A body is 1.5 cells tall. */
const ROW_PITCH = 1.55

export class Scene {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private dpr = 1
  private w = 0
  private h = 0
  private layoutCache: Layout | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("street: no 2d context")
    this.ctx = ctx
    this.resize()
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect()
    const dpr = Math.min(3, (globalThis.devicePixelRatio as number | undefined) ?? 1)
    this.w = Math.max(1, Math.round(rect.width || 360))
    this.h = Math.max(1, Math.round(rect.height || 640))
    this.dpr = dpr
    this.canvas.width = Math.round(this.w * dpr)
    this.canvas.height = Math.round(this.h * dpr)
    this.layoutCache = null
  }

  get width(): number {
    return this.w
  }

  /**
   * The rectangles the frame will be drawn into, and the ones input reads.
   *
   * Recomputed whenever the rank size or the plate changes, because the bar
   * narrows to `bar(size)`: a rank of five never shows a nine, so the studs
   * move.
   */
  layout(frame: Frame): Layout {
    const w = this.w
    const h = this.h
    const pad = Math.round(Math.min(20, w * 0.045))

    // The bar sits on the bottom. It grows rows until every stud clears a 44 px
    // target — a smaller stud on a phone is a stud a child misses, and a missed
    // stud reads as "that number did not work".
    const studs = bar(frame.crowd.size)
    const cols = Math.max(1, Math.min(6, Math.floor((w - pad * 2 + 8) / (MIN_TOUCH + 8))))
    const rows = Math.max(1, Math.ceil(studs.length / cols))
    const cellW = (w - pad * 2 - (cols - 1) * 8) / cols
    const cellH = Math.max(MIN_TOUCH, Math.min(64, (h * 0.24 - (rows - 1) * 8) / rows))
    const barH = rows * cellH + (rows - 1) * 8
    const barTop = h - pad - barH

    const placed: Array<{ k: number; rect: Rect }> = []
    for (let i = 0; i < studs.length; i++) {
      const r = Math.floor(i / cols)
      const c = i % cols
      // The last row is centred, so a bar of eight does not read as a bar of
      // six with two stragglers.
      const inRow = Math.min(cols, studs.length - r * cols)
      const rowW = inRow * cellW + (inRow - 1) * 8
      const x0 = (w - rowW) / 2
      placed.push({
        k: studs[i] as number,
        rect: { x: x0 + c * (cellW + 8), y: barTop + r * (cellH + 8), w: cellW, h: cellH },
      })
    }

    const hudH = Math.round(Math.min(96, h * 0.14))
    const streetTop = hudH
    const streetH = Math.max(80, barTop - pad - streetTop)
    const mob: Rect = { x: pad, y: streetTop, w: w - pad * 2, h: streetH }

    const rivets: Array<{ index: number; rect: Rect }> = []
    const plate = frame.shutter
    if (plate) {
      const n = plate.rivets.length
      const rcols = n <= 2 ? n : 2
      const rrows = Math.ceil(n / rcols)
      const gap = 12
      const rw = Math.min(180, (mob.w - (rcols - 1) * gap) / rcols)
      const rh = Math.max(MIN_TOUCH, Math.min(78, (mob.h * 0.46 - (rrows - 1) * gap) / rrows))
      const gridW = rcols * rw + (rcols - 1) * gap
      const x0 = mob.x + (mob.w - gridW) / 2
      const y0 = mob.y + mob.h * 0.44
      for (let i = 0; i < n; i++) {
        const r = Math.floor(i / rcols)
        const c = i % rcols
        rivets.push({
          index: i,
          rect: { x: x0 + c * (rw + gap), y: Math.min(y0 + r * (rh + gap), h - rh - 4), w: rw, h: rh },
        })
      }
    }

    const out: Layout = { width: w, height: h, mob, studs: placed, rivets }
    this.layoutCache = out
    return out
  }

  /** The last layout drawn. Input reads this; it is never null after a frame. */
  get lastLayout(): Layout | null {
    return this.layoutCache
  }

  draw(frame: Frame): Layout {
    const ctx = this.ctx
    const layout = this.layout(frame)
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.w, this.h)

    this.drawStreet(frame)
    this.drawHud(frame, layout)

    const plateDown =
      frame.phase === "shutter-down" || frame.phase === "shutter" || frame.phase === "rivet" || frame.phase === "shutter-up"
    if (plateDown && frame.shutter) this.drawShutter(frame, layout)
    else this.drawMob(frame, layout)

    this.drawBar(frame, layout)
    return layout
  }

  // -------------------------------------------------------------- ground --

  private drawStreet(frame: Frame): void {
    const ctx = this.ctx
    const g = ctx.createLinearGradient(0, 0, 0, this.h)
    g.addColorStop(0, PALETTE.sky)
    g.addColorStop(0.55, PALETTE.skyLow)
    g.addColorStop(1, PALETTE.ground)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, this.w, this.h)

    // The furnace door down the far end. It is the light source, it is the only
    // saturated thing on screen, and it breathes with the push: the closer the
    // mob is, the more of the street it blocks.
    const cx = this.w * 0.5
    const cy = this.h * 0.2
    const r = Math.max(40, this.w * 0.42) * (1 - frame.pressure * 0.35)
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    glow.addColorStop(0, alpha(PALETTE.emberHot, 0.2))
    glow.addColorStop(0.4, alpha(PALETTE.ember, 0.09))
    glow.addColorStop(1, alpha(PALETTE.emberDeep, 0))
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, this.w, this.h)

    // Cobble courses, thinning with distance. Structure, not texture noise.
    ctx.strokeStyle = PALETTE.groundLine
    ctx.lineWidth = 1
    for (let i = 1; i <= 7; i++) {
      const t = i / 8
      const y = this.h * (0.42 + t * t * 0.58)
      ctx.globalAlpha = 0.25 + t * 0.35
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(this.w, y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  // ----------------------------------------------------------------- hud --

  private drawHud(frame: Frame, layout: Layout): void {
    const ctx = this.ctx
    const pad = layout.mob.x
    const top = Math.round(Math.min(96, this.h * 0.14))

    // The tally lamp: how many are still standing, and how wide a rank is. The
    // two numbers the whole game is about, and the only numerals up here.
    const standing = frame.crowd.ranks * frame.crowd.size
    ctx.textBaseline = "middle"
    ctx.textAlign = "left"
    ctx.fillStyle = PALETTE.chalk
    ctx.font = face(Math.round(top * 0.42))
    ctx.fillText(String(standing), pad, top * 0.44)

    ctx.font = label(Math.round(top * 0.17))
    ctx.fillStyle = PALETTE.chalkDim
    ctx.globalAlpha = 0.8
    const w = ctx.measureText(String(standing)).width
    void w
    ctx.fillText(
      frame.crowd.ranks > 1 ? `${frame.crowd.ranks} × ${frame.crowd.size}` : "IN THE STREET",
      pad,
      top * 0.72,
    )
    ctx.globalAlpha = 1

    // Blocks cleared. A count of finished things, and it never goes down.
    ctx.textAlign = "right"
    ctx.fillStyle = PALETTE.brass
    ctx.font = face(Math.round(top * 0.3))
    ctx.fillText(String(frame.blocks), this.w - pad, top * 0.42)
    ctx.font = label(Math.round(top * 0.15))
    ctx.fillStyle = PALETTE.chalkDim
    ctx.globalAlpha = 0.7
    ctx.fillText(frame.best > frame.blocks ? `BLOCKS · BEST ${frame.best}` : "BLOCKS", this.w - pad, top * 0.68)
    ctx.globalAlpha = 1

    // The push, as notches between the far end and you.
    const nx = pad
    const ny = top * 0.92
    const nw = (this.w - pad * 2) / PUSH_MAX
    for (let i = 0; i < PUSH_MAX; i++) {
      const lit = i < frame.pushMarks
      ctx.fillStyle = lit ? PALETTE.ember : PALETTE.ironDark
      ctx.globalAlpha = lit ? 0.75 : 0.5
      ctx.fillRect(nx + i * nw + 1, ny, nw - 3, 2)
    }
    ctx.globalAlpha = 1
  }

  // ----------------------------------------------------------------- mob --

  private drawMob(frame: Frame, layout: Layout): void {
    const ctx = this.ctx
    const { crowd } = frame
    if (crowd.ranks === 0 && frame.phase !== "fall" && frame.phase !== "clear") return

    const area = layout.mob
    // Leaning in: the mob occupies more of the street as the push builds.
    const lean = frame.pressure * area.h * 0.16
    const top = area.y + area.h * 0.16 + lean

    const prime = isPrime(crowd.size)
    const ringoff = frame.phase === "ringoff" && frame.lastSeam > 1
    const groups = ringoff ? Math.floor(crowd.size / frame.lastSeam) : 0
    const remainder = ringoff ? frame.lastRemainder : 0

    // A rank is a row, and **every rank is on screen**. The body size is taken
    // from whichever of the two constraints bites — the width of the widest
    // rank or the height of the whole stack — because a mob with a rank clipped
    // off the bottom is a rectangle that does not say what it says. Twelve
    // ranks of two has to read as twelve ranks of two.
    const perRow = crowd.size
    const gapCount = ringoff ? groups : 0
    const rows = Math.max(1, crowd.ranks)
    const usable = area.w * 0.92 - gapCount * 10
    const fromWidth = usable / Math.max(1, perRow)
    const fromHeight = (area.h * 0.72) / rows / ROW_PITCH
    const cell = Math.max(4, Math.min(34, Math.min(fromWidth, fromHeight)))
    const rowH = cell * ROW_PITCH

    for (let r = 0; r < crowd.ranks; r++) {
      const rowWidth = perRow * cell + gapCount * 10
      let x = area.x + (area.w - rowWidth) / 2
      const y = top + r * rowH
      for (let i = 0; i < perRow; i++) {
        if (ringoff && frame.lastSeam > 0 && i > 0 && i % frame.lastSeam === 0 && i / frame.lastSeam <= groups) {
          x += 10
        }
        // The remainder: the bodies standing outside the groups the refused
        // seam tried to make. `groups * seam + remainder === size`, so this is
        // the tail of the rank and it is drawn hot.
        const over = ringoff && i >= crowd.size - remainder
        this.drawBody(x, y, cell, prime, over, frame)
        x += cell
      }
    }

    // The crack: a hot line along every new seam, travelling at 2400 px/s. The
    // machine already turned that speed into this phase's duration, so the
    // progress here *is* the crack's position.
    if (frame.phase === "crack") {
      const reach = area.x + area.w * Math.min(1, frame.progress * 1.35)
      ctx.strokeStyle = PALETTE.emberHot
      ctx.lineWidth = frame.reduced ? 1.5 : 2.5
      ctx.globalAlpha = frame.reduced ? 0.7 : 1 - Math.max(0, frame.progress - 0.7) / 0.3
      for (let r = 1; r < crowd.ranks; r++) {
        const y = top + r * rowH - rowH * 0.14
        ctx.beginPath()
        ctx.moveTo(area.x, y)
        ctx.lineTo(reach, y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
  }

  /**
   * One body.
   *
   * Iron when the rank is composite — locked, dark, arms in. Steel when it is
   * prime — upright, lit, and takeable. `over` is a body standing outside the
   * groups a refused seam tried to make: the remainder, drawn as the thing it
   * is rather than named.
   */
  private drawBody(x: number, y: number, cell: number, prime: boolean, over: boolean, frame: Frame): void {
    const ctx = this.ctx
    const w = cell * 0.78
    const h = cell * 1.5
    const body = over ? PALETTE.ember : prime ? PALETTE.steel : PALETTE.iron
    const lit = over ? PALETTE.emberHot : prime ? PALETTE.steelLit : PALETTE.ironLit

    ctx.globalAlpha = frame.phase === "clear" ? 0.35 : 1
    // Torso: a shouldered slab, not a rounded cartoon.
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.moveTo(x + cell * 0.11, y + h * 0.34)
    ctx.lineTo(x + cell * 0.11 + w, y + h * 0.34)
    ctx.lineTo(x + cell * 0.11 + w * 0.86, y + h)
    ctx.lineTo(x + cell * 0.11 + w * 0.14, y + h)
    ctx.closePath()
    ctx.fill()
    // Head.
    ctx.beginPath()
    ctx.arc(x + cell * 0.11 + w * 0.5, y + h * 0.19, w * 0.29, 0, Math.PI * 2)
    ctx.fill()
    // The lit edge. One stroke, from the furnace end of the street.
    ctx.strokeStyle = lit
    ctx.globalAlpha *= 0.55
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + cell * 0.11 + w * 0.06, y + h * 0.36)
    ctx.lineTo(x + cell * 0.11 + w * 0.18, y + h * 0.96)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  // ------------------------------------------------------------- shutter --

  private drawShutter(frame: Frame, layout: Layout): void {
    const ctx = this.ctx
    const plate = frame.shutter
    if (!plate) return
    const area = layout.mob

    // How far down the plate hangs. Down phase rolls in, up phase rolls out.
    const t =
      frame.phase === "shutter-down"
        ? frame.progress
        : frame.phase === "shutter-up"
          ? 1 - frame.progress
          : 1
    const h = area.h * t
    if (h <= 1) return

    ctx.save()
    ctx.beginPath()
    ctx.rect(area.x, area.y, area.w, h)
    ctx.clip()

    ctx.fillStyle = PALETTE.wall
    ctx.fillRect(area.x, area.y, area.w, area.h)
    // Corrugations. A roller shutter is a stack of slats and that is the only
    // texture it needs.
    ctx.strokeStyle = PALETTE.wallLine
    ctx.lineWidth = 1
    const slat = Math.max(8, area.h / 22)
    for (let y = area.y; y < area.y + area.h; y += slat) {
      ctx.beginPath()
      ctx.moveTo(area.x, y)
      ctx.lineTo(area.x + area.w, y)
      ctx.stroke()
    }

    // The problem, chalked.
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = PALETTE.chalk
    const size = Math.min(area.w * 0.13, area.h * 0.14)
    ctx.font = face(size)
    ctx.fillText(plate.prompt, area.x + area.w / 2, area.y + area.h * 0.24)

    for (const { index, rect } of layout.rivets) {
      const rivet = plate.rivets[index]
      if (!rivet) continue
      const caving = frame.phase === "rivet" && rivet.dead
      this.drawRivet(rect, rivet.text, rivet.dead, caving ? frame.progress : 1, plate.open)
    }

    ctx.restore()
  }

  private drawRivet(rect: Rect, text: string, dead: boolean, t: number, open: boolean): void {
    const ctx = this.ctx
    const r = Math.min(rect.h, rect.w) * 0.22
    ctx.globalAlpha = dead ? 0.28 + 0.2 * (1 - t) : 1
    ctx.fillStyle = dead ? PALETTE.ironDark : PALETTE.brassDark
    this.roundRect(rect.x, rect.y, rect.w, rect.h, r)
    ctx.fill()
    ctx.fillStyle = dead ? PALETTE.iron : PALETTE.brass
    this.roundRect(rect.x, rect.y, rect.w, rect.h - 3, r)
    ctx.fill()

    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = dead ? PALETTE.ironLit : open ? PALETTE.emberHot : "#241a08"
    ctx.font = face(Math.min(rect.h * 0.46, rect.w * 0.34))
    ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2 - 1)
    ctx.globalAlpha = 1
  }

  // ----------------------------------------------------------------- bar --

  private drawBar(frame: Frame, layout: Layout): void {
    const ctx = this.ctx
    const plateDown =
      frame.phase === "shutter-down" || frame.phase === "shutter" || frame.phase === "rivet"
    if (plateDown) return

    for (const { k, rect } of layout.studs) {
      const hinted = frame.hintSeam === k
      const ringing = frame.phase === "ringoff" && frame.lastSeam === k
      const struck = frame.phase === "crack" && frame.lastSeam === k

      ctx.globalAlpha = frame.phase === "melee" ? 1 : 0.72
      ctx.fillStyle = PALETTE.brassDark
      this.roundRect(rect.x, rect.y, rect.w, rect.h, 5)
      ctx.fill()
      ctx.fillStyle = struck ? PALETTE.emberHot : ringing ? PALETTE.iron : hinted ? PALETTE.brassLit : PALETTE.brass
      this.roundRect(rect.x, rect.y, rect.w, rect.h - 3, 5)
      ctx.fill()

      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillStyle = ringing ? PALETTE.ironLit : "#241a08"
      ctx.font = face(Math.min(rect.h * 0.5, rect.w * 0.5))
      ctx.fillText(String(k), rect.x + rect.w / 2, rect.y + rect.h / 2 - 1)
      ctx.globalAlpha = 1
    }
  }

  /** `roundRect` with a manual fallback: an old WebView has the arcs but not it. */
  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.ctx as CanvasRenderingContext2D & {
      roundRect?: (x: number, y: number, w: number, h: number, r: number) => void
    }
    ctx.beginPath()
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, w, h, r)
      return
    }
    const rad = Math.max(0, Math.min(r, Math.min(w, h) / 2))
    ctx.moveTo(x + rad, y)
    ctx.lineTo(x + w - rad, y)
    ctx.arc(x + w - rad, y + rad, rad, -Math.PI / 2, 0)
    ctx.lineTo(x + w, y + h - rad)
    ctx.arc(x + w - rad, y + h - rad, rad, 0, Math.PI / 2)
    ctx.lineTo(x + rad, y + h)
    ctx.arc(x + rad, y + h - rad, rad, Math.PI / 2, Math.PI)
    ctx.lineTo(x, y + rad)
    ctx.arc(x + rad, y + rad, rad, Math.PI, -Math.PI / 2)
    ctx.closePath()
  }
}

/** Whether a point is inside a rectangle. Input's only geometry. */
export function hit(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
}
