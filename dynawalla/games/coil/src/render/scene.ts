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
import type { HintState } from "../game/hint.ts"
import type { Round } from "../game/round.ts"
import { coilOf, linkValue } from "../game/place.ts"
import { COURSE } from "../game/session.ts"
import { SLAG_CELLS } from "../game/board.ts"
import { safeInsets } from "../../../../packs/shared/game-chrome/index.ts"
import { type Layout, type Lane, cellAt, labelX, viewLayout } from "./layout.ts"
import { KIND_DUST, KIND_FILING, KIND_SPARK, Particles } from "./particles.ts"
import {
  BONE,
  BRASS,
  BRASS_DARK,
  BRASS_HOT,
  CELESTIAL,
  CELESTIAL_DIM,
  EMBER,
  EMBER_TEXT,
  GROOVE,
  INK,
  SLAG as SLAG_COLOUR,
  SLAG_EDGE,
  SLAG_TEXT,
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
  /** 0..1 fade on the hint, decayed by the caller. Never a countdown. */
  hint: number
  /** What the hint is currently saying, or `null` when it is saying nothing. */
  hintState: HintState | null
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
  /**
   * What `resize` last actually rebuilt for, so a no-op resize stays a no-op.
   *
   * The insets are part of this key, not just the size. Turning a notched phone
   * from landscape-left to landscape-right changes neither `w`, `h` nor `dpr`
   * but swaps `insets.left` and `insets.right` 59↔0 — and the memo would have
   * held the old layout, leaving the carved problem under the help control that
   * had moved to the other side. `insets.ts` warns about exactly this: a game
   * that reads them once is correct until the first rotation.
   */
  private sized = { w: 0, h: 0, insets: "" }

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
    const insets = safeInsets()
    const key = `${String(insets.top)},${String(insets.right)},${String(insets.bottom)},${String(insets.left)}`
    // A `ResizeObserver` fires on every frame of a window drag and on every
    // rotation animation step. Rasterising the lattice — a full-page offscreen
    // canvas of a hundred stars — on each of those is how a mid-range tablet
    // loses its frame budget to a gesture that changed nothing.
    if (
      width === this.sized.w &&
      height === this.sized.h &&
      key === this.sized.insets &&
      dpr === this.dpr
    ) {
      return this.layout
    }
    this.dpr = dpr
    this.sized = { w: width, h: height, insets: key }
    this.canvas.width = Math.round(width * dpr)
    this.canvas.height = Math.round(height * dpr)
    this.layout = viewLayout(width, height, insets)
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
      ctx.fillStyle = withAlpha(BONE, 0.8)
      ctx.font = font(Math.min(20, h * 0.3))
      ctx.textAlign = "center"
      ctx.fillText("the alley is quiet", x + w / 2, y + h / 2)
      ctx.restore()
      return
    }

    const demandText = String(round.demand)
    const head = round.prompt.endsWith(demandText)
      ? round.prompt.slice(0, round.prompt.length - demandText.length)
      : `${round.prompt} → `

    // Size from the string that is actually drawn, not from `round.prompt`.
    // On the fallback branch above, `head` gains three characters and the
    // demand again — which the character count never knew about, so a long
    // problem ran off the right of the recess and under the help control. The
    // measure is the only honest fit: guess a size, then shrink it until what
    // will be painted fits between the walls of the recess.
    const inset = Math.min(12, w * 0.06)
    const room = Math.max(1, w - inset * 2)
    let size = Math.min((w / Math.max(6, head.length + demandText.length)) * 1.9, h * 0.5)
    ctx.font = numerals(size)
    const wanted = ctx.measureText(head).width + ctx.measureText(demandText).width
    if (wanted > room) {
      size = Math.max(9, (size * room) / wanted)
      ctx.font = numerals(size)
    }
    const headW = ctx.measureText(head).width
    const demandW = ctx.measureText(demandText).width
    const startX = x + Math.max(inset, (w - headW - demandW) / 2)
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
    // The one line that is the whole rule of the game, and it was the least
    // legible type on the screen: `BONE_DIM` at 0.85 on the lit recess measures
    // 2.45:1. A child who cannot read the rule has, in the founder's words, "no
    // idea what I'm doing". Same size, same place, an ink that is actually there.
    ctx.fillStyle = withAlpha(BONE, 0.85)
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
        ctx.fillStyle = withAlpha(BONE, 0.8)
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
      ctx.fillStyle = withAlpha(BONE, 0.7)
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
    this.drawHint(s, lane)

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
    ctx.fillStyle = SLAG_TEXT
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

  /**
   * The hint, on the lane, in the machine's own vocabulary.
   *
   * It is drawn HERE and not in the gauge, and that is the fix for *"hints don't
   * fit on mobile."* The shipped hint was a line of text — `2×10  5×1` — laid
   * into an 82px panel with no measurement at all; on the founder's handset it
   * ran out of the gauge, across the SHEAR lever and off the glass. The lane is
   * a grid this game already fits to every viewport it supports, so a hint drawn
   * on it cannot overflow: it occupies cells, and the cells are the layout.
   *
   * It is also the better picture. Ghost links hovering over the tail of the
   * child's own chain say *these are the links that have to come off* and let
   * them be compared one against one — which is exactly the moment the borrow
   * becomes visible, because the ghosts do not line up.
   */
  private drawHint(s: SceneState, lane: Lane): void {
    const hint = s.hintState
    if (!hint || hint.stage < 1 || s.hint <= 0.01 || s.links.length === 0) return
    const { ctx } = this
    const tail = this.cellForLink(s, s.links.length - 1)
    if (tail < 0) return

    ctx.save()
    ctx.globalAlpha = s.hint
    const unit = lane.unit * 0.74

    // 1. THE SHAPE. The demand, as a chain of its own, laid in the empty cells
    //    that follow the child's tail.
    //
    //    In the cells AFTER the tail and not hovering over it, which was the
    //    first thing tried: a ghost lifted off the lane needs about 1.2 units of
    //    clearance to sit clear of a tower, and the row pitch can be as little
    //    as 2.6 — so on a short lane the ghost either overlapped the links it was
    //    meant to be compared with or climbed out of the lane rectangle
    //    altogether. The grid already fits every viewport this game supports;
    //    borrowing cells from it is the one placement that cannot overflow.
    const want = coilOf(hint.demand)
    for (let k = 0; k < want.length; k++) {
      const cell = tail + 1 + k
      if (cell >= lane.capacity) break
      const c = cellAt(lane, cell)
      drawLink(ctx, c.x, c.y, unit, want[k] as number, 0.5)
    }

    // 2. THE CHANGE. The link that has to be opened, ringed, with the ten-for-one
    //    it yields written under it. Numerals and a multiplication sign: the
    //    whole subject of the game is that ten of one place is one of the next,
    //    and no sentence says it better than `10×1` under a drum.
    if (hint.stage >= 2 && hint.plan.breakIndex >= 0) {
      const cell = this.cellForLink(s, hint.plan.breakIndex)
      if (cell >= 0 && cell < lane.capacity) {
        const c = cellAt(lane, cell)
        ctx.strokeStyle = withAlpha(CELESTIAL, 0.8)
        ctx.lineWidth = 1.6
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.arc(c.x, c.y, lane.unit * 0.92, 0, TAU)
        ctx.stroke()
        ctx.setLineDash([])

        const place = s.links[hint.plan.breakIndex] as number
        const label = `10×${String(linkValue(place - 1))}`
        const size = Math.max(9, lane.unit * 0.78)
        ctx.font = numerals(size, 700)
        ctx.textAlign = "left"
        ctx.textBaseline = "middle"
        // Measured and clamped into the lane. A label at the far column would
        // otherwise hang off the same edge the old hint hung off.
        ctx.fillStyle = CELESTIAL
        ctx.fillText(label, labelX(lane, c.x, ctx.measureText(label).width), c.y + lane.rowPitch * 0.36)
      }
    }

    // 3. THE PLACE. A ghost of the jaws on the joint to put them on next — the
    //    link to open while there is one, and the joint to cut at once there is
    //    not. Live: it moves the instant a link is cracked.
    if (hint.stage >= 3) {
      const cell = this.cellForLink(s, hint.plan.aim)
      if (cell >= 0 && cell < lane.capacity) {
        const here = cellAt(lane, cell)
        const prev = cellAt(lane, Math.max(0, cell - 1))
        const jx = cell === 0 ? here.x - lane.pitch * 0.5 : (here.x + prev.x) / 2
        const jy = cell === 0 ? here.y : (here.y + prev.y) / 2
        ctx.globalAlpha = s.hint * 0.55
        ctx.strokeStyle = CELESTIAL
        ctx.lineWidth = 2
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(jx, jy - lane.rowPitch * 0.46)
        ctx.lineTo(jx, jy + lane.rowPitch * 0.46)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
    ctx.restore()
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
    // Brightness, not hue, carries "there is something to melt" — because the
    // ground under both of these labels is the panel's own ember gradient, and
    // orange type on it measured 1.92:1 while the idle reading measured 1.15:1.
    ctx.fillStyle = withAlpha(EMBER_TEXT, s.slag > 0 ? 1 : 0.72)
    ctx.font = font(Math.min(15, f.h * 0.26), 700)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("FURNACE", f.x + f.w / 2, f.y + f.h * 0.36)
    ctx.font = numerals(Math.min(19, f.h * 0.3), 700)
    ctx.fillStyle = withAlpha(EMBER_TEXT, s.slag > 0 ? 1 : 0.8)
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
    // The rect comes from the layout now. It used to be worked out here, as
    // `shear.x − (furnace.x + furnace.w) − 24`, and given up on below 60px —
    // which on a narrow safe rectangle silently deleted the only panel that
    // answers "what am I holding". `layout.ts` shares the lever row between the
    // three panels instead, and `chrome.test.ts` puts a floor under this one.
    const { x, y, w, h } = L.gauge
    if (w <= 0) return

    ctx.save()
    ctx.fillStyle = withAlpha(STONE_DEEP, 0.72)
    roundRect(ctx, x, y, w, h, 8)
    ctx.fill()
    // The affordance, and the only one this needs: when there is more hint to be
    // had, the panel that gives it brightens. No button, no word, no badge.
    const more = s.hintState?.more ?? false
    ctx.strokeStyle = withAlpha(CELESTIAL_DIM, more ? 0.45 + s.hint * 0.5 : 0.45)
    ctx.lineWidth = more ? 1.2 + s.hint * 1.1 : 1.2
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

    // 4. THE NUMBER — the last picture, and the only one that is a numeral.
    //
    // The doc comment above is right that the gauge must never print this during
    // play, and it is exactly wrong for a child who has been stuck for a minute
    // and asked for help twice with their thumb. So it arrives here and only
    // here: what the jaws are holding, over what the wall wants. The rule the
    // gauge protects — that reading the places is the child's job — is protected
    // by this being the FOURTH thing the hint says, not by never saying it.
    //
    // Fitted to the panel, because that is the defect this whole change is
    // about: the shipped hint was type laid into this rect without measuring it.
    const hint = s.hintState
    if (hint && hint.stage >= 4 && s.hint > 0.01) {
      const line = `${String(hint.holding)} / ${String(hint.demand)}`
      let size = Math.min(h * 0.3, 20)
      ctx.font = numerals(size, 700)
      const room = w - 12
      const wide = ctx.measureText(line).width
      if (wide > room && wide > 0) {
        size = Math.max(9, size * (room / wide))
        ctx.font = numerals(size, 700)
      }
      ctx.globalAlpha = s.hint
      ctx.fillStyle = hint.holding === hint.demand ? CELESTIAL : BONE
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(line, x + w / 2, y + h * 0.82)
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
