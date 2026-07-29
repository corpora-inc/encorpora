// Everything that is drawn, and nothing that is decided.
//
// The scene takes a snapshot and paints it. It holds no game state, judges
// nothing, and every animated quantity arrives as a number between zero and one
// that `mount.ts` decays — so `prefersReducedMotion` is a set of numbers pinned
// to their resting values rather than a second renderer.
//
// The register is the forge alley: carved stone, a girih lattice that is
// *structure* and not wallpaper (it is the wall the bricks are laid into), and
// exactly one cold light — the recess. Nothing glows for encouragement.

import type { Brick } from "../game/session.ts"
import type { Round } from "../game/round.ts"
import { coilOf, linkValue } from "../game/place.ts"
import { COURSE } from "../game/session.ts"
import { SLAG_CELLS } from "../game/board.ts"
import { type Layout, type Lane, cellAt, viewLayout } from "./layout.ts"
import { KIND_DUST, KIND_FILING, KIND_SPARK, Particles } from "./particles.ts"
import {
  BONE,
  BONE_DIM,
  BRASS,
  BRASS_DARK,
  BRASS_HOT,
  CELESTIAL,
  CELESTIAL_DIM,
  EMBER,
  EMBER_HOT,
  GROOVE,
  INK,
  SLAG as SLAG_COLOUR,
  SLAG_EDGE,
  STONE,
  STONE_DEEP,
  STONE_EDGE,
  STONE_LIT,
  font,
  linkBody,
  linkRim,
  numerals,
  withAlpha,
} from "./palette.ts"

export type Flight = {
  readonly links: readonly number[]
  readonly exact: boolean
  /** Where the piece was when the jaws closed. */
  readonly fromX: number
  readonly fromY: number
  /** 0 at the lane, 1 at the wall recess or the floor. */
  t: number
}

export type SceneState = {
  round: Round | null
  links: readonly number[]
  cut: number
  buried: number
  slag: number
  /** The cradle coil in `fill` mode: what the severed piece welds onto. */
  ingot: readonly number[]
  wall: readonly Brick[]
  exactCuts: number
  reduced: boolean
  /** Seconds since mount, for the few things that idle. */
  t: number
  /** 0..1, decayed by the caller. */
  aimPulse: number
  crackPulse: number
  seatPulse: number
  missPulse: number
  furnaceGlow: number
  shearPress: number
  whip: number
  /** 0..1 — the ghost of the demand, offered after a long hesitation. */
  hint: number
  flight: Flight | null
}

const TAU = Math.PI * 2

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

/** Places present in a run of links, biggest first, with their counts. */
function tally(links: readonly number[]): { place: number; n: number }[] {
  const counts = new Map<number, number>()
  for (const p of links) counts.set(p, (counts.get(p) ?? 0) + 1)
  return [...counts.entries()]
    .map(([place, n]) => ({ place, n }))
    .sort((a, b) => b.place - a.place)
}

/**
 * One link, drawn as its place.
 *
 * Silhouette first: a one is a bead, a ten is a ribbed drum, a hundred is a
 * pierced ring, and everything above is a notched tower with one notch per
 * place. A child can count the tens in a coil without reading a single colour.
 */
function drawLink(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  unit: number,
  place: number,
  alpha = 1,
  hot = 0,
): void {
  const body = linkBody(place)
  const rim = linkRim(place)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.lineWidth = Math.max(1, unit * 0.14)

  if (place === 0) {
    const r = unit * 0.44
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.arc(x, y, r, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = rim
    ctx.stroke()
    ctx.fillStyle = withAlpha(rim, 0.7)
    ctx.beginPath()
    ctx.arc(x - r * 0.3, y - r * 0.34, r * 0.28, 0, TAU)
    ctx.fill()
  } else if (place === 1) {
    const w = unit * 1.5
    const h = unit * 0.94
    ctx.fillStyle = body
    roundRect(ctx, x - w / 2, y - h / 2, w, h, h * 0.32)
    ctx.fill()
    ctx.strokeStyle = rim
    ctx.stroke()
    ctx.strokeStyle = withAlpha(INK, 0.45)
    ctx.lineWidth = Math.max(1, unit * 0.1)
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath()
      ctx.moveTo(x + i * w * 0.22, y - h * 0.3)
      ctx.lineTo(x + i * w * 0.22, y + h * 0.3)
      ctx.stroke()
    }
  } else if (place === 2) {
    const outer = unit * 0.66
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.arc(x, y, outer, 0, TAU)
    ctx.arc(x, y, outer * 0.46, 0, TAU, true)
    ctx.fill("evenodd")
    ctx.strokeStyle = rim
    ctx.beginPath()
    ctx.arc(x, y, outer, 0, TAU)
    ctx.stroke()
  } else {
    const notches = Math.min(6, place)
    const w = unit * 0.98
    const h = unit * 1.46
    ctx.fillStyle = body
    roundRect(ctx, x - w / 2, y - h / 2, w, h, unit * 0.16)
    ctx.fill()
    ctx.strokeStyle = rim
    ctx.stroke()
    ctx.fillStyle = withAlpha(INK, 0.5)
    for (let i = 0; i < notches; i++) {
      const ny = y - h / 2 + (h * (i + 0.8)) / (notches + 0.7)
      ctx.fillRect(x - w * 0.34, ny, w * 0.68, Math.max(1, unit * 0.1))
    }
  }

  if (hot > 0) {
    ctx.globalAlpha = alpha * hot
    ctx.strokeStyle = CELESTIAL
    ctx.lineWidth = Math.max(1.2, unit * 0.2)
    ctx.beginPath()
    ctx.arc(x, y, unit * 0.86, 0, TAU)
    ctx.stroke()
  }
  ctx.restore()
}

export class Scene {
  readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  readonly particles = new Particles()
  private lattice: HTMLCanvasElement | null = null
  layout: Layout
  private dpr = 1
  /** What `resize` last actually rebuilt for, so a no-op resize stays a no-op. */
  private sized = { w: 0, h: 0 }

  constructor(host: HTMLElement) {
    const canvas = document.createElement("canvas")
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block"
    host.appendChild(canvas)
    const ctx = canvas.getContext("2d", { alpha: false })
    if (!ctx) throw new Error("coil: no 2d context")
    this.canvas = canvas
    this.ctx = ctx
    this.layout = viewLayout(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight))
    this.resize(host.clientWidth, host.clientHeight)
  }

  resize(w: number, h: number): Layout {
    const width = Math.max(320, Math.round(w))
    const height = Math.max(360, Math.round(h))
    const dpr = Math.min(3, globalThis.devicePixelRatio || 1)
    // A `ResizeObserver` fires on every frame of a window drag and on every
    // rotation animation step. Rasterising the lattice — a full-page offscreen
    // canvas of a hundred stars — on each of those is how a mid-range tablet
    // loses its frame budget to a gesture that changed nothing.
    if (width === this.sized.w && height === this.sized.h && dpr === this.dpr) return this.layout
    this.dpr = dpr
    this.sized = { w: width, h: height }
    this.canvas.width = Math.round(width * dpr)
    this.canvas.height = Math.round(height * dpr)
    this.layout = viewLayout(width, height)
    this.lattice = this.buildLattice(width, height)
    return this.layout
  }

  destroy(): void {
    this.canvas.remove()
    this.lattice = null
  }

  /**
   * The girih lattice, rendered once per resize.
   *
   * Eight-point strapwork on a square grid — the wall the bricks go into, drawn
   * at the alpha of carved shadow rather than of decoration. Rasterised because
   * redrawing a hundred stars per frame is the kind of thing that costs a
   * mid-range tablet its frame budget for no visible gain.
   */
  private buildLattice(w: number, h: number): HTMLCanvasElement | null {
    const off = document.createElement("canvas")
    off.width = Math.round(w * this.dpr)
    off.height = Math.round(h * this.dpr)
    const c = off.getContext("2d")
    if (!c) return null
    c.scale(this.dpr, this.dpr)
    const g = Math.max(52, Math.min(w, h) / 7)
    c.strokeStyle = withAlpha(STONE_EDGE, 0.7)
    c.lineWidth = 1.2
    for (let y = -g; y < h + g; y += g) {
      for (let x = -g; x < w + g; x += g) {
        const cx = x + g / 2
        const cy = y + g / 2
        const r = g * 0.42
        c.beginPath()
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + Math.PI / 8
          const px = cx + Math.cos(a) * r
          const py = cy + Math.sin(a) * r
          if (i === 0) c.moveTo(px, py)
          else c.lineTo(px, py)
        }
        c.closePath()
        c.stroke()
        c.beginPath()
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU
          const px = cx + Math.cos(a) * r * 1.36
          const py = cy + Math.sin(a) * r * 1.36
          if (i === 0) c.moveTo(px, py)
          else c.lineTo(px, py)
        }
        c.closePath()
        c.stroke()
      }
    }
    return off
  }

  draw(s: SceneState): void {
    const { ctx } = this
    const L = this.layout
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)

    const sky = ctx.createLinearGradient(0, 0, 0, L.h)
    sky.addColorStop(0, STONE)
    sky.addColorStop(0.55, STONE_DEEP)
    sky.addColorStop(1, "#0f0a07")
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, L.w, L.h)
    if (this.lattice) {
      ctx.save()
      ctx.globalAlpha = 0.55
      ctx.drawImage(this.lattice, 0, 0, L.w, L.h)
      ctx.restore()
    }

    this.drawWall(s)
    this.drawLane(s)
    this.drawFlight(s)
    this.particles.draw(ctx)
    this.drawLevers(s)
  }

  // ---------------------------------------------------------------- the wall

  private drawWall(s: SceneState): void {
    const { ctx } = this
    const r = this.layout.wall
    ctx.save()
    ctx.fillStyle = STONE_LIT
    roundRect(ctx, r.x, r.y, r.w, r.h, 10)
    ctx.fill()
    ctx.strokeStyle = withAlpha(STONE_EDGE, 1)
    ctx.lineWidth = 2
    ctx.stroke()

    // The recess: the one cold light. It brightens as the pending cut
    // approaches the demand, which is the only continuous feedback in the game.
    //
    // Its rectangle comes from the layout, not from the wall, because it is the
    // one thing here that has to dodge the host's two corner controls — the
    // stone plate above may run under them, the carved problem may not. The
    // cradle still narrows it rightward to make room for the ingot, and the
    // ingot now sits INSIDE the recess rather than beside it, so it is clear of
    // the how-to-play control too.
    const cradle = s.round?.mode === "fill" && s.round.ingot > 0
    const rec = this.layout.recess
    const recessW = rec.w * (cradle ? 0.62 : 1)
    const glow = 0.24 + s.seatPulse * 0.5
    ctx.fillStyle = withAlpha(CELESTIAL_DIM, 0.12 + glow * 0.2)
    roundRect(ctx, rec.x, rec.y, recessW, rec.h, 8)
    ctx.fill()
    ctx.strokeStyle = withAlpha(CELESTIAL, 0.32 + s.seatPulse * 0.5)
    ctx.lineWidth = 1.5
    ctx.stroke()

    this.drawPrompt(s, rec.x, rec.y, recessW, rec.h)
    if (cradle) this.drawIngot(s, rec.x + rec.w * 0.82, rec.y + rec.h * 0.5, rec.w * 0.33)
    const cs = this.layout.courses
    this.drawCourses(s, cs.x, cs.y, cs.w, cs.h)
    ctx.restore()
  }

  /**
   * The problem, carved, with the demand lit.
   *
   * Two type sizes and one light. The glowing operand is the whole instruction
   * the game has: shear that much off. The operator is what tells you what the
   * machine will do with it, and it is drawn at the same size as the numbers
   * because it is not punctuation, it is the verb.
   */
  private drawPrompt(s: SceneState, x: number, y: number, w: number, h: number): void {
    const { ctx } = this
    const round = s.round
    ctx.save()
    ctx.textBaseline = "middle"
    if (!round) {
      ctx.fillStyle = BONE_DIM
      ctx.font = font(Math.min(20, h * 0.3))
      ctx.textAlign = "center"
      ctx.fillText("the alley is quiet", x + w / 2, y + h / 2)
      ctx.restore()
      return
    }

    const size = Math.min(w / Math.max(6, round.prompt.length) * 1.9, h * 0.5)
    ctx.font = numerals(size)
    const demandText = String(round.demand)
    const head = round.prompt.endsWith(demandText)
      ? round.prompt.slice(0, round.prompt.length - demandText.length)
      : `${round.prompt} → `
    const headW = ctx.measureText(head).width
    const demandW = ctx.measureText(demandText).width
    const startX = x + Math.max(12, (w - headW - demandW) / 2)
    const midY = y + h * 0.44

    ctx.textAlign = "left"
    ctx.fillStyle = withAlpha(BONE, 0.86)
    ctx.fillText(head, startX, midY)

    // The demand, lit from behind the wall.
    const pulse = s.reduced ? 0.72 : 0.72 + Math.sin(s.t * 2.1) * 0.12 + s.aimPulse * 0.2
    ctx.save()
    ctx.shadowColor = CELESTIAL
    ctx.shadowBlur = size * 0.5 * pulse
    ctx.fillStyle = CELESTIAL
    ctx.fillText(demandText, startX + headW, midY)
    ctx.restore()

    // One line, and it is the whole rule of the game. What happens to the piece
    // afterwards is not written down anywhere: in a take it leaves and the coil
    // that stays is the answer, in a fill it flies to the cradle and joins the
    // ingot, and a child learns which is which by watching it happen once.
    ctx.font = font(Math.max(10, size * 0.24), 600)
    ctx.fillStyle = withAlpha(BONE_DIM, 0.85)
    ctx.textAlign = "left"
    ctx.fillText("SHEAR OFF THE LIT NUMBER", startX, y + h * 0.86)
    ctx.restore()
  }

  /** The cradle: what the severed piece is about to be welded to. */
  private drawIngot(s: SceneState, cx: number, cy: number, w: number): void {
    const round = s.round
    if (!round || s.ingot.length === 0) return
    const { ctx } = this
    const groups = tally(s.ingot)
    ctx.save()
    ctx.fillStyle = withAlpha(STONE_DEEP, 0.6)
    roundRect(ctx, cx - w / 2, cy - w * 0.24, w, w * 0.48, 6)
    ctx.fill()
    ctx.strokeStyle = withAlpha(BRASS_DARK, 0.9)
    ctx.lineWidth = 1.5
    ctx.stroke()

    const unit = Math.min(11, w / 14)
    let px = cx - w / 2 + unit * 1.4
    for (const g of groups) {
      const shown = Math.min(g.n, 4)
      for (let i = 0; i < shown; i++) {
        drawLink(ctx, px, cy - unit * 0.2, unit, g.place, 0.95)
        px += unit * 1.25
      }
      if (g.n > shown) {
        ctx.fillStyle = BONE_DIM
        ctx.font = numerals(unit * 1.1, 600)
        ctx.textAlign = "left"
        ctx.textBaseline = "middle"
        ctx.fillText(`×${String(g.n)}`, px, cy - unit * 0.2)
        px += unit * 2.2
      }
      px += unit * 0.5
    }

    ctx.fillStyle = withAlpha(BONE, 0.9)
    ctx.font = numerals(w * 0.13, 700)
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    ctx.fillText(String(round.ingot), cx, cy + w * 0.1)
    ctx.restore()
  }

  /**
   * The wall the run builds. Never regresses: a miss costs slag, not a brick.
   */
  private drawCourses(s: SceneState, x: number, y: number, w: number, h: number): void {
    const { ctx } = this
    const perRow = COURSE
    const rows = 2
    const bw = w / perRow
    const bh = Math.min(h / rows, bw * 0.42)
    // Two courses: the one being laid, and the one under it. A course fills
    // left to right and is complete at eight, which is why `COURSE` is the same
    // constant the stopping point fires on.
    const inCourse = s.exactCuts === 0 ? 0 : ((s.exactCuts - 1) % perRow) + 1
    const laidPerRow = [Math.min(perRow, s.exactCuts - inCourse), inCourse]
    ctx.save()
    for (let row = 0; row < rows; row++) {
      const laidHere = laidPerRow[row] as number
      for (let i = 0; i < perRow; i++) {
        const bx = x + i * bw + (row % 2 === 1 ? bw * 0.16 : 0)
        const by = y + row * (bh + 3)
        const laid = i < laidHere
        ctx.fillStyle = laid ? withAlpha(BRASS, 0.82) : withAlpha(STONE_DEEP, 0.55)
        roundRect(ctx, bx, by, bw - 3, bh, 2)
        ctx.fill()
        if (laid) {
          // Only the brick that was just seated carries the light.
          const newest = row === rows - 1 && i === laidHere - 1
          ctx.strokeStyle = withAlpha(BRASS_HOT, newest ? s.seatPulse : 0.22)
          ctx.lineWidth = 1.2
          ctx.stroke()
        }
      }
    }
    const brick: Brick | undefined = s.wall[s.wall.length - 1]
    if (brick) {
      ctx.fillStyle = withAlpha(BONE_DIM, 0.7)
      ctx.font = numerals(Math.max(9, bh * 0.8), 600)
      ctx.textAlign = "right"
      ctx.textBaseline = "middle"
      ctx.fillText(String(brick.value), x + w, y + rows * (bh + 3) + bh * 0.4)
    }
    ctx.restore()
  }

  // ---------------------------------------------------------------- the lane

  /** Lane cell holding link `i`. Slag sits at the mouth and pushes the coil on. */
  cellForLink(s: SceneState, i: number): number {
    return s.slag * SLAG_CELLS + (i - s.buried)
  }

  private drawLane(s: SceneState): void {
    const { ctx } = this
    const lane = this.layout.lane

    // The groove the coil rides in.
    ctx.save()
    ctx.strokeStyle = GROOVE
    ctx.lineWidth = lane.unit * 1.9
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.beginPath()
    for (let i = 0; i < lane.capacity; i++) {
      const c = cellAt(lane, i)
      if (i === 0) ctx.moveTo(c.x, c.y)
      else ctx.lineTo(c.x, c.y)
    }
    ctx.stroke()
    ctx.strokeStyle = withAlpha(STONE_EDGE, 0.5)
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()

    this.drawSlag(s, lane)
    this.drawBuried(s, lane)
    this.drawCoil(s, lane)
    this.drawShear(s, lane)

    // A miss stains the lane with oxide for a quarter of a second. It is the
    // whole of the negative feedback: no flash, no shake, no sound of refusal —
    // just the colour of the thing that is now lying on your floor.
    if (s.missPulse > 0) {
      ctx.save()
      ctx.globalAlpha = s.missPulse * 0.22
      ctx.fillStyle = SLAG_COLOUR
      ctx.fillRect(lane.x, lane.y, lane.w, lane.h)
      ctx.restore()
    }
  }

  private drawSlag(s: SceneState, lane: Lane): void {
    if (s.slag <= 0) return
    const { ctx } = this
    ctx.save()
    for (let i = 0; i < s.slag * SLAG_CELLS; i++) {
      const c = cellAt(lane, i)
      const wob = Math.sin(i * 2.7) * lane.unit * 0.18
      ctx.fillStyle = SLAG_COLOUR
      ctx.beginPath()
      ctx.ellipse(c.x, c.y + wob, lane.unit * 0.82, lane.unit * 0.6, i * 0.7, 0, TAU)
      ctx.fill()
      ctx.strokeStyle = withAlpha(SLAG_EDGE, 0.75)
      ctx.lineWidth = 1.2
      ctx.stroke()
    }
    ctx.restore()
  }

  /** Links that no longer fit, crushed into the mouth. Dim, and unbreakable. */
  private drawBuried(s: SceneState, lane: Lane): void {
    if (s.buried <= 0) return
    const { ctx } = this
    const c = cellAt(lane, 0)
    ctx.save()
    ctx.globalAlpha = 0.5
    for (let i = 0; i < Math.min(s.buried, 8); i++) {
      const p = s.links[i] as number
      drawLink(ctx, c.x - lane.pitch * 0.7 + i * 2.6, c.y - lane.rowPitch * 0.62, lane.unit * 0.7, p, 0.7)
    }
    ctx.globalAlpha = 1
    ctx.fillStyle = withAlpha(SLAG_EDGE, 0.95)
    ctx.font = numerals(Math.max(10, lane.unit * 0.9), 700)
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    ctx.fillText(`${String(s.buried)} buried`, c.x + lane.pitch * 0.4, c.y - lane.rowPitch * 0.62)
    ctx.restore()
  }

  private drawCoil(s: SceneState, lane: Lane): void {
    const { ctx } = this
    for (let i = s.buried; i < s.links.length; i++) {
      const cell = this.cellForLink(s, i)
      if (cell >= lane.capacity) break
      const c = cellAt(lane, cell)
      const pending = i >= s.cut
      // The whip: the coil recoils away from the cut for a moment after a
      // shear, strongest at the free end and dying out towards the head.
      const wave =
        s.whip > 0
          ? Math.sin((i - s.cut) * 0.9 - s.whip * 9) *
            lane.unit *
            0.9 *
            s.whip *
            Math.min(1, Math.abs(i - s.cut) / 4)
          : 0
      const y = c.y + wave
      drawLink(
        ctx,
        c.x,
        y,
        lane.unit,
        s.links[i] as number,
        1,
        pending ? 0.35 + s.aimPulse * 0.5 : 0,
      )
      if (i === s.cut) {
        // The link the shear is parked on is the one that can be cracked open.
        const p = s.links[i] as number
        if (p > 0) {
          ctx.save()
          ctx.globalAlpha = s.reduced ? 0.55 : 0.5 + Math.sin(s.t * 3) * 0.18 + s.crackPulse * 0.4
          ctx.strokeStyle = CELESTIAL
          ctx.lineWidth = 1.4
          ctx.setLineDash([2, 3])
          ctx.beginPath()
          ctx.moveTo(c.x - lane.unit * 0.5, y - lane.unit * 0.7)
          ctx.lineTo(c.x + lane.unit * 0.2, y)
          ctx.lineTo(c.x - lane.unit * 0.35, y + lane.unit * 0.7)
          ctx.stroke()
          ctx.restore()
        }
      }
    }
  }

  /** The jaws, parked in the joint ahead of the cut. */
  private drawShear(s: SceneState, lane: Lane): void {
    if (s.links.length === 0) return
    const { ctx } = this
    const cell = this.cellForLink(s, s.cut)
    if (cell >= lane.capacity) return
    const here = cellAt(lane, cell)
    const prev = cellAt(lane, Math.max(0, cell - 1))
    const jx = cell === 0 ? here.x - lane.pitch * 0.5 : (here.x + prev.x) / 2
    const jy = cell === 0 ? here.y : (here.y + prev.y) / 2
    const open = lane.unit * (0.95 - s.shearPress * 0.7)

    ctx.save()
    ctx.strokeStyle = withAlpha(CELESTIAL, 0.5 + s.aimPulse * 0.4)
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(jx, jy - lane.rowPitch * 0.42)
    ctx.lineTo(jx, jy + lane.rowPitch * 0.42)
    ctx.stroke()

    ctx.fillStyle = CELESTIAL
    for (const sign of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(jx - lane.unit * 0.5, jy + sign * (open + lane.unit * 0.5))
      ctx.lineTo(jx + lane.unit * 0.5, jy + sign * (open + lane.unit * 0.5))
      ctx.lineTo(jx, jy + sign * open)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }

  // ------------------------------------------------------------- the flight

  private drawFlight(s: SceneState): void {
    const f = s.flight
    if (!f) return
    const { ctx } = this
    const lane = this.layout.lane
    const from = { x: f.fromX, y: f.fromY }
    const wall = this.layout.wall
    const to = f.exact
      ? { x: wall.x + wall.w * 0.5, y: wall.y + wall.h * 0.82 }
      : { x: lane.x + lane.w * 0.2, y: lane.y + lane.h + lane.unit }
    const t = Math.min(1, Math.max(0, f.t))
    const ease = f.exact ? 1 - (1 - t) ** 3 : t * t
    const x = from.x + (to.x - from.x) * ease
    const y = from.y + (to.y - from.y) * ease - (f.exact ? Math.sin(t * Math.PI) * lane.h * 0.3 : 0)

    ctx.save()
    ctx.globalAlpha = 1 - t * 0.35
    const unit = lane.unit * (1 - t * 0.45)
    const shown = Math.min(f.links.length, 12)
    for (let i = 0; i < shown; i++) {
      drawLink(ctx, x + (i - shown / 2) * unit * 1.1, y, unit, f.links[i] as number, 1, f.exact ? 0.4 : 0)
    }
    ctx.restore()
  }

  // ------------------------------------------------------------- the levers

  private drawLevers(s: SceneState): void {
    const { ctx } = this
    const L = this.layout
    this.drawGauge(s)

    // FURNACE — melts the lane, costs the coil, reports nothing.
    const f = L.furnace
    ctx.save()
    const heat = 0.25 + s.furnaceGlow * 0.75
    const grad = ctx.createLinearGradient(f.x, f.y + f.h, f.x, f.y)
    grad.addColorStop(0, withAlpha(EMBER, 0.15 + heat * 0.5))
    grad.addColorStop(1, withAlpha(STONE_DEEP, 0.9))
    ctx.fillStyle = grad
    roundRect(ctx, f.x, f.y, f.w, f.h, 8)
    ctx.fill()
    ctx.strokeStyle = withAlpha(EMBER, 0.45 + s.furnaceGlow * 0.5)
    ctx.lineWidth = 1.6
    ctx.stroke()
    ctx.fillStyle = s.slag > 0 ? EMBER_HOT : withAlpha(EMBER_HOT, 0.4)
    ctx.font = font(Math.min(15, f.h * 0.26), 700)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("FURNACE", f.x + f.w / 2, f.y + f.h * 0.36)
    ctx.font = numerals(Math.min(19, f.h * 0.3), 700)
    ctx.fillStyle = s.slag > 0 ? EMBER : withAlpha(BONE_DIM, 0.6)
    ctx.fillText(`${String(s.slag)} slag`, f.x + f.w / 2, f.y + f.h * 0.7)
    ctx.restore()

    // SHEAR — the commit, and the only thing in the game that spends an item.
    const r = L.shear
    ctx.save()
    const press = s.shearPress
    const y = r.y + press * 6
    ctx.fillStyle = withAlpha(BRASS_DARK, 0.55)
    roundRect(ctx, r.x, r.y + 8, r.w, r.h - 8, 10)
    ctx.fill()
    const face = ctx.createLinearGradient(r.x, y, r.x, y + r.h)
    face.addColorStop(0, withAlpha(BRASS_HOT, 0.9 - press * 0.25))
    face.addColorStop(1, BRASS)
    ctx.fillStyle = face
    roundRect(ctx, r.x, y, r.w, r.h - 10, 10)
    ctx.fill()
    ctx.strokeStyle = withAlpha(INK, 0.5)
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = INK
    ctx.font = font(Math.min(20, r.h * 0.3), 700)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("SHEAR", r.x + r.w / 2, y + (r.h - 10) / 2)
    ctx.restore()
  }

  /**
   * The gauge: what the shear is holding, as places rather than as a numeral.
   *
   * Never a number. If it printed "25" the child would nudge until the digits
   * matched and the place value would be the machine's job instead of theirs —
   * so the gauge draws two drums and five beads and lets the reading be the
   * work. That reading is the skill `dw.add.column.*` is named for.
   */
  private drawGauge(s: SceneState): void {
    const { ctx } = this
    const L = this.layout
    const x = L.furnace.x + L.furnace.w + 12
    const w = L.shear.x - x - 12
    if (w < 60) return
    const y = L.levers.y
    const h = L.levers.h

    ctx.save()
    ctx.fillStyle = withAlpha(STONE_DEEP, 0.72)
    roundRect(ctx, x, y, w, h, 8)
    ctx.fill()
    ctx.strokeStyle = withAlpha(CELESTIAL_DIM, 0.45)
    ctx.lineWidth = 1.2
    ctx.stroke()

    const piece = s.links.slice(s.cut)
    const groups = tally(piece)
    const unit = Math.min(h * 0.26, 15)
    let px = x + unit * 1.6
    const cy = y + h * 0.46
    for (const g of groups) {
      // Countable while there is anything to count, and a multiplier once there
      // is not: nine drums are read by counting them, sixteen ones are not.
      if (g.n <= 10) {
        for (let i = 0; i < g.n; i++) {
          if (px > x + w - unit * 3) break
          drawLink(ctx, px, cy, unit, g.place, 1, 0.25)
          px += unit * 1.32
        }
      } else {
        drawLink(ctx, px, cy, unit, g.place, 1, 0.25)
        px += unit * 1.4
        ctx.fillStyle = BONE
        ctx.font = numerals(unit * 1.25, 700)
        ctx.textAlign = "left"
        ctx.textBaseline = "middle"
        ctx.fillText(`×${String(g.n)}`, px, cy)
        px += ctx.measureText(`×${String(g.n)}`).width + unit * 0.4
      }
      px += unit * 0.9
    }

    // The hint: the demand's own shape, ghosted, offered only after the child
    // has been still for a while. It never costs anything and never hurries.
    if (s.hint > 0 && s.round) {
      ctx.globalAlpha = s.hint * 0.5
      ctx.fillStyle = CELESTIAL
      ctx.font = font(Math.max(10, h * 0.17), 600)
      ctx.textAlign = "left"
      ctx.textBaseline = "middle"
      const want = tally(coilOf(s.round.demand))
        .map((g) => `${String(g.n)}×${String(linkValue(g.place))}`)
        .join("  ")
      ctx.fillText(want, x + unit * 1.4, y + h * 0.82)
      ctx.globalAlpha = 1
    }
    ctx.restore()
  }

  // ------------------------------------------------------------- emitters

  burstCrack(x: number, y: number): void {
    this.particles.emit(KIND_FILING, x, y, 14, 190, BRASS_HOT)
  }

  burstSeat(x: number, y: number): void {
    this.particles.emit(KIND_SPARK, x, y, 12, 150, CELESTIAL)
  }

  burstSlag(x: number, y: number): void {
    this.particles.emit(KIND_DUST, x, y, 9, 70, SLAG_EDGE)
  }

  burstFurnace(x: number, y: number): void {
    this.particles.emit(KIND_SPARK, x, y, 20, 200, EMBER, Math.PI * 0.8, -Math.PI / 2)
  }
}
