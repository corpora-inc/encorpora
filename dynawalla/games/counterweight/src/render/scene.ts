// The weigh-house, drawn.
//
// One canvas, no DOM, no images and no fonts to load — nothing on the answer
// path waits for the world. Every frame is: the room, the day's tally, the beam
// with its two pans, the strain gauge, the rack, the stamp.
//
// **What the beam is allowed to say.** The far pan carries the chit and never its
// total. The near pan carries your brass. The beam carries the difference, and
// only near level does it carry it finely — see `sim/beam.ts`. Nothing on this
// canvas ever draws the goods' weight, and nothing draws it after a stamp
// either: the child is told *what they wrote*, which is the thing that is theirs.
//
// **AND NOTHING ON THIS CANVAS COUNTS DOWN.**
//
// There used to be a bar across the bottom that drained over the round and went
// red in its last 28%. The window it drained was generous and measured, and the
// founder still said "the action is rushed by the timer going down" — because a
// visible countdown is an anxiety cue however much time it grants. It is gone,
// along with the limit it was drawing. `games/claim` deleted its draining ring
// for the same reason, and the rule it wrote down holds here: **a clock may never
// take anything away from a child.**
//
// What is left in that row is the strain gauge, and the strain gauge is the
// opposite of a clock: it is empty until the child's own hands fill it, it drains
// while they wait, and it is entirely a report on what they just did.
//
// The abandonment guard in `game/guard.ts` is not readable from this directory at
// all — `guard.test.ts` scans every file in `render/` for the accessors that would
// let it be drawn, and fails if one appears. A guard a child can watch is a
// countdown with a different name.

import { RUN, type Bout, type Docket, type Verdict } from "../game/bout.ts"
import type { Column } from "../game/column.ts"
import type { Place } from "../game/places.ts"
import type { Beam } from "../sim/beam.ts"
import { beamEnds, hit, panRect, viewLayout, type Layout, type Rect } from "./layout.ts"
import { alpha, FACE_NUM, FACE_TEXT, font, mix, PALETTE } from "./palette.ts"
import { Sparks } from "./particles.ts"

export type SceneState = {
  readonly bout: Bout
  readonly beam: Beam
  readonly reduced: boolean
  readonly best: { scales: number; hold: number }
  /** Pillars pressed this frame, for the depressed look. */
  readonly pressed: ReadonlySet<string>
  readonly stampHeld: boolean
  /** Set while the host has a sheet over the frame. */
  readonly paused: boolean
  /** The split column on the far pan, or null when the chit would not split. */
  readonly column: Column | null
  readonly promptRaw: string
}

const VERDICT_WORD: Record<Verdict, string> = {
  true: "GOOD",
  short: "SHORT",
  over: "OVER",
  shear: "SHEARED",
  lapsed: "WENT BACK",
}

const VERDICT_HUE: Record<Verdict, string> = {
  true: PALETTE.seat,
  short: PALETTE.ember,
  over: PALETTE.ember,
  // Deliberately the dimmest brass in the palette and not the ember: nobody was
  // there, nothing was lost, and it must not read like a buzzer.
  lapsed: PALETTE.brassDim,
  shear: PALETTE.strain,
}

/**
 * Thousands separators, so a four-digit load reads at a glance.
 *
 * A THIN SPACE, not a plain one — deliberately, and it went missing once in a
 * rewrite. A full space at this size pushes `8 367` wider than the pan it is
 * centred in on a 320-point phone.
 */
function grouped(n: number): string {
  const sign = n < 0 ? "−" : ""
  return sign + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u2009")
}

function placeLabel(place: Place, dir: 1 | -1): string {
  return `${dir > 0 ? "+" : "−"}${grouped(place)}`
}

function roundRect(ctx: CanvasRenderingContext2D, r: Rect, radius: number): void {
  const k = Math.min(radius, r.w / 2, r.h / 2)
  ctx.beginPath()
  ctx.moveTo(r.x + k, r.y)
  ctx.lineTo(r.x + r.w - k, r.y)
  ctx.quadraticCurveTo(r.x + r.w, r.y, r.x + r.w, r.y + k)
  ctx.lineTo(r.x + r.w, r.y + r.h - k)
  ctx.quadraticCurveTo(r.x + r.w, r.y + r.h, r.x + r.w - k, r.y + r.h)
  ctx.lineTo(r.x + k, r.y + r.h)
  ctx.quadraticCurveTo(r.x, r.y + r.h, r.x, r.y + r.h - k)
  ctx.lineTo(r.x, r.y + k)
  ctx.quadraticCurveTo(r.x, r.y, r.x + k, r.y)
  ctx.closePath()
}

export class Scene {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private box: Layout
  private dpr = 1
  readonly sparks = new Sparks()
  private shakeMs = 0
  private shakeAmp = 0
  private flashMs = 0
  private flashHue: string = PALETTE.seat
  /**
   * Seconds since mount, for the waiting breath on the stamp.
   *
   * A phase of a sine and nothing else. It is not a fraction of anything, it has
   * no end, and it looks the same in the fortieth second of a round as in the
   * first — which is the whole difference between a breath and a countdown.
   */
  private time = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("counterweight: no 2d context")
    this.ctx = ctx
    this.box = viewLayout(1, 1)
    this.resize()
  }

  get layout(): Layout {
    return this.box
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect()
    const w = Math.max(1, Math.round(rect.width || 360))
    const h = Math.max(1, Math.round(rect.height || 640))
    this.dpr = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1))
    this.canvas.width = Math.round(w * this.dpr)
    this.canvas.height = Math.round(h * this.dpr)
    // Read fresh each resize, not once at mount: a rotation swaps top/bottom
    // with left/right, and Split View changes them without a rotation.
    this.box = viewLayout(w, h)
  }

  /** Which face, if any, is under this point. */
  pick(x: number, y: number): { kind: "face"; place: Place; dir: 1 | -1 } | { kind: "stamp" } | null {
    if (hit(this.box.stamp, x, y, this.box.unit * 0.5)) return { kind: "stamp" }
    for (const pillar of this.box.pillars) {
      if (hit(pillar.up, x, y, this.box.unit * 0.25)) {
        return { kind: "face", place: pillar.place, dir: 1 }
      }
      if (hit(pillar.down, x, y, this.box.unit * 0.25)) {
        return { kind: "face", place: pillar.place, dir: -1 }
      }
    }
    return null
  }

  /** Where a face sits, so sparks come off the plate that was struck. */
  faceCentre(place: Place, dir: 1 | -1): { x: number; y: number } {
    const pillar = this.box.pillars.find((p) => p.place === place)
    if (!pillar) return { x: this.box.w / 2, y: this.box.h / 2 }
    const r = dir > 0 ? pillar.up : pillar.down
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
  }

  shake(amplitude: number, ms: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, amplitude)
    this.shakeMs = Math.max(this.shakeMs, ms)
  }

  flash(hue: string, ms: number): void {
    this.flashHue = hue
    this.flashMs = Math.max(this.flashMs, ms)
  }

  advance(dtMs: number, reduced: boolean): void {
    if (!reduced) this.sparks.advance(dtMs)
    this.time += dtMs / 1000
    this.shakeMs = Math.max(0, this.shakeMs - dtMs)
    if (this.shakeMs === 0) this.shakeAmp = 0
    this.flashMs = Math.max(0, this.flashMs - dtMs)
  }

  draw(state: SceneState): void {
    const ctx = this.ctx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    if (this.shakeMs > 0 && !state.reduced) {
      const k = this.shakeMs / 90
      ctx.translate(Math.sin(this.shakeMs * 0.9) * this.shakeAmp * k, Math.cos(this.shakeMs * 1.3) * this.shakeAmp * k * 0.6)
    }

    this.drawRoom(state)
    this.drawHud(state)
    this.drawBeam(state)
    this.drawStrain(state)
    this.drawRack(state)
    this.drawStamp(state)
    if (!state.reduced) this.sparks.draw(ctx)
    this.drawFlash()
    if (state.paused) this.drawSheet()
  }

  // ---------------------------------------------------------------------------

  private drawRoom(state: SceneState): void {
    const ctx = this.ctx
    const { w, h } = this.box
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, PALETTE.nightDeep)
    sky.addColorStop(0.55, PALETTE.night)
    sky.addColorStop(1, PALETTE.yard)
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)

    // The brazier at the door, over the barrow. Reduced motion holds it still
    // rather than removing it — the light is the set, not an effect.
    const glow = ctx.createRadialGradient(
      w * 0.78,
      this.box.stage.y + this.box.stage.h * 0.3,
      0,
      w * 0.78,
      this.box.stage.y + this.box.stage.h * 0.3,
      Math.max(w, h) * 0.55,
    )
    const heat = state.reduced ? 0.06 : 0.06 + Math.abs(state.beam.angle) * 0.05
    glow.addColorStop(0, alpha(PALETTE.ember, heat))
    glow.addColorStop(1, alpha(PALETTE.ember, 0))
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)
  }

  private drawHud(state: SceneState): void {
    const ctx = this.ctx
    const { hud, unit } = this.box
    const day = state.bout.day

    ctx.textBaseline = "alphabetic"
    ctx.textAlign = "left"
    ctx.font = font(FACE_TEXT, unit * 0.86)
    ctx.fillStyle = PALETTE.inkDim
    ctx.fillText(`SCALE ${day.scale}`, hud.x, hud.y + unit * 0.95)

    ctx.textAlign = "right"
    ctx.fillStyle = PALETTE.inkFaint
    const tally = state.best.scales > 0 ? `BEST ${state.best.scales}` : "FIRST DAY"
    ctx.fillText(tally, hud.x + hud.w, hud.y + unit * 0.95)

    // The day's run. Centre is level; the goods' end is on the right.
    const barY = hud.y + unit * 1.6
    const barH = Math.max(4, unit * 0.5)
    const bar: Rect = { x: hud.x, y: barY, w: hud.w, h: barH }
    ctx.fillStyle = PALETTE.stone
    roundRect(ctx, bar, barH / 2)
    ctx.fill()

    const mid = hud.x + hud.w / 2
    const reach = (hud.w / 2) * (day.run / RUN)
    const ahead = day.run >= 0
    ctx.fillStyle = ahead ? PALETTE.seat : PALETTE.ember
    if (Math.abs(reach) > 0.5) {
      roundRect(
        ctx,
        { x: Math.min(mid, mid + reach), y: barY, w: Math.abs(reach), h: barH },
        barH / 2,
      )
      ctx.fill()
    }
    // The two stops and the centre notch.
    ctx.fillStyle = PALETTE.stoneEdge
    ctx.fillRect(mid - 1, barY - unit * 0.24, 2, barH + unit * 0.48)
  }

  private drawBeam(state: SceneState): void {
    const ctx = this.ctx
    const { fulcrum, unit } = this.box
    const angle = state.beam.angle
    // Positive margin is your side *down*: brass outweighing the goods pushes
    // your pan toward the floor, and your side is the left one.
    const tilt = -angle

    // The post.
    ctx.strokeStyle = PALETTE.stoneEdge
    ctx.lineWidth = Math.max(3, unit * 0.42)
    ctx.beginPath()
    ctx.moveTo(fulcrum.x, fulcrum.y)
    ctx.lineTo(fulcrum.x, this.box.stage.y + this.box.stage.h)
    ctx.stroke()

    // Shared with `layout.panExtent`, so the test that holds the pans inside the
    // safe area is measuring the geometry this frame actually draws.
    const { lx, ly, rx, ry } = beamEnds(this.box, tilt)

    // The beam. Ring shows as a hot rim along the steel.
    const ring = state.beam.ring
    ctx.lineCap = "round"
    ctx.strokeStyle = PALETTE.brassDim
    ctx.lineWidth = Math.max(5, unit * 0.62)
    ctx.beginPath()
    ctx.moveTo(lx, ly)
    ctx.lineTo(rx, ry)
    ctx.stroke()
    ctx.strokeStyle = mix(PALETTE.brass, PALETTE.brassBright, ring)
    ctx.lineWidth = Math.max(2, unit * 0.26)
    ctx.beginPath()
    ctx.moveTo(lx, ly)
    ctx.lineTo(rx, ry)
    ctx.stroke()

    // The fulcrum knuckle, and the index mark on it.
    ctx.fillStyle = PALETTE.brass
    ctx.beginPath()
    ctx.arc(fulcrum.x, fulcrum.y, unit * 0.52, 0, Math.PI * 2)
    ctx.fill()

    // **The reading is only true when the steel has stopped.** A struck beam is
    // travelling through every value between where it was and where it is going,
    // so the index lights only once it has come to rest — which is exactly what
    // makes "strike and squint" cost a settle each time instead of being free.
    if (state.beam.settled) {
      ctx.fillStyle = Math.abs(state.bout.margin) <= 1 ? PALETTE.seat : PALETTE.steelBright
      ctx.beginPath()
      ctx.arc(fulcrum.x, fulcrum.y, unit * 0.2, 0, Math.PI * 2)
      ctx.fill()
    }

    this.drawChain(lx, ly, this.box.panDrop)
    this.drawChain(rx, ry, this.box.panDrop)
    this.drawBrassPan(state, panRect(this.box, lx, ly))
    this.drawGoodsPan(state, panRect(this.box, rx, ry))
  }

  private drawChain(x: number, y: number, drop: number): void {
    const ctx = this.ctx
    ctx.strokeStyle = PALETTE.steelDim
    ctx.lineWidth = Math.max(1, this.box.unit * 0.12)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x, y + drop)
    ctx.stroke()
  }

  private drawBrassPan(state: SceneState, r: Rect): void {
    const ctx = this.ctx
    const { panW, panH, unit } = this.box
    const cx = r.x + r.w / 2
    ctx.fillStyle = alpha(PALETTE.stone, 0.94)
    roundRect(ctx, r, unit * 0.5)
    ctx.fill()
    ctx.strokeStyle = PALETTE.steelDim
    ctx.lineWidth = 1.5
    ctx.stroke()

    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = PALETTE.inkFaint
    ctx.font = font(FACE_TEXT, unit * 0.72)
    ctx.fillText("YOUR BRASS", cx, r.y + unit * 0.86)

    ctx.fillStyle = PALETTE.steelBright
    ctx.font = font(FACE_NUM, Math.min(unit * 2.5, panW / 3.1))
    ctx.fillText(grouped(state.bout.load), cx, r.y + panH * 0.62)
  }

  private drawGoodsPan(state: SceneState, r: Rect): void {
    const ctx = this.ctx
    const { panW, panH, unit } = this.box
    const cx = r.x + r.w / 2
    ctx.fillStyle = alpha(PALETTE.stone, 0.94)
    roundRect(ctx, r, unit * 0.5)
    ctx.fill()
    ctx.strokeStyle = PALETTE.emberDim
    ctx.lineWidth = 1.5
    ctx.stroke()

    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = PALETTE.inkFaint
    ctx.font = font(FACE_TEXT, unit * 0.72)
    ctx.fillText("THE GOODS", cx, r.y + unit * 0.86)

    // The chit. Two lines and a rule — and no total, ever. Right-aligned on a
    // tabular grid so the places line up, because lining the places up is the
    // whole skill this row of the graph is about.
    const size = Math.min(unit * 1.55, panW / 4.4)
    ctx.font = font(FACE_NUM, size)
    ctx.fillStyle = PALETTE.ink
    const right = r.x + panW - unit * 0.9
    ctx.textAlign = "right"
    const column = state.column
    if (column) {
      const top = r.y + panH * 0.46
      ctx.fillText(column.top, right, top)
      ctx.fillText(column.bottom, right, top + size * 1.12)
      ctx.textAlign = "left"
      ctx.fillStyle = PALETTE.emberBright
      ctx.fillText(column.glyph, r.x + unit * 0.9, top + size * 1.12)
      ctx.strokeStyle = PALETTE.inkFaint
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(r.x + unit * 0.8, top + size * 1.72)
      ctx.lineTo(right + size * 0.1, top + size * 1.72)
      ctx.stroke()
    } else {
      ctx.textAlign = "center"
      ctx.fillText(state.promptRaw, cx, r.y + panH * 0.62)
    }
  }

  /**
   * The strain in the steel, and **nothing else in this row**.
   *
   * The left two-thirds of this strip used to be the press-window clock: a bar
   * that drained over the round and turned ember in its last 28%. Both the bar
   * and the limit behind it are gone. What is here now fills only when the child
   * strikes and empties on its own while they think, so the only way to see it
   * move is to move it.
   */
  private drawStrain(state: SceneState): void {
    const ctx = this.ctx
    const { gauge, unit } = this.box

    ctx.fillStyle = PALETTE.stone
    roundRect(ctx, gauge, gauge.h / 2)
    ctx.fill()
    const load = state.bout.strain.load
    if (load > 0) {
      ctx.fillStyle = mix(PALETTE.brass, PALETTE.strain, load)
      roundRect(ctx, { ...gauge, w: Math.max(2, gauge.w * load) }, gauge.h / 2)
      ctx.fill()
    }
    ctx.textAlign = "right"
    ctx.textBaseline = "middle"
    ctx.font = font(FACE_TEXT, unit * 0.62)
    ctx.fillStyle = load > 0.72 ? PALETTE.strain : PALETTE.inkFaint
    ctx.fillText("STRAIN", gauge.x + gauge.w, gauge.y - unit * 0.62)
  }

  private drawRack(state: SceneState): void {
    const ctx = this.ctx
    const { unit } = this.box
    const live = state.bout.phase === "press" && !state.paused

    for (const pillar of this.box.pillars) {
      for (const dir of [1, -1] as const) {
        const r = dir > 0 ? pillar.up : pillar.down
        const key = `${pillar.place}:${dir}`
        const down = state.pressed.has(key)
        const cooling = state.bout.cooling(pillar.place)
        const base = dir > 0 ? PALETTE.stone : PALETTE.yard
        ctx.fillStyle = down ? mix(base, PALETTE.brass, 0.42) : base
        roundRect(ctx, r, unit * 0.42)
        ctx.fill()
        ctx.strokeStyle = live
          ? cooling
            ? PALETTE.stoneEdge
            : dir > 0
              ? PALETTE.brassDim
              : PALETTE.steelDim
          : PALETTE.stoneEdge
        ctx.lineWidth = down ? 2.4 : 1.4
        ctx.stroke()

        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.font = font(FACE_NUM, Math.min(unit * 1.05, r.w / 3.4))
        ctx.fillStyle = live ? (dir > 0 ? PALETTE.brassBright : PALETTE.steel) : PALETTE.inkFaint
        ctx.fillText(placeLabel(pillar.place, dir), r.x + r.w / 2, r.y + r.h / 2)
      }
    }
  }

  /**
   * The stamp, and the one moving thing left on the screen that is not the beam.
   *
   * While the round is open the rim **breathes** — a slow, wide pulse that says
   * the counter is holding still and waiting for you. It is a sine of the wall
   * clock: it does not shrink, it does not change colour as time passes, and it
   * looks identical in the fortieth second of a round and in the first. That is
   * the difference between a breath and a countdown, and it is deliberately
   * copied from `games/claim`'s gate halo, which replaced a draining ring for
   * exactly the reason this replaced a draining bar.
   */
  private drawStamp(state: SceneState): void {
    const ctx = this.ctx
    const { stamp, unit } = this.box
    const bout = state.bout
    const showing = bout.docket
    const waiting = bout.phase === "press" && !state.paused && !showing
    // Held at mid for a calmer screen. Nobody loses information to it, because
    // there is no information in it.
    const breath = !waiting ? 0 : state.reduced ? 0.5 : 0.5 + Math.sin(this.time * 1.7) * 0.5

    ctx.fillStyle = state.stampHeld ? mix(PALETTE.stone, PALETTE.seat, 0.3) : PALETTE.stone
    roundRect(ctx, stamp, unit * 0.5)
    ctx.fill()
    ctx.strokeStyle = showing
      ? VERDICT_HUE[showing.verdict]
      : waiting
        ? mix(PALETTE.brassDim, PALETTE.brassBright, breath * 0.55)
        : PALETTE.brassDim
    ctx.lineWidth = waiting ? 1.8 + breath * 1.4 : 1.8
    ctx.stroke()

    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    const cx = stamp.x + stamp.w / 2
    const cy = stamp.y + stamp.h / 2

    if (showing) {
      this.drawDocket(showing, cx, cy)
      return
    }
    if (bout.phase === "hang") {
      ctx.font = font(FACE_TEXT, unit * 1.0)
      ctx.fillStyle = PALETTE.inkFaint
      ctx.fillText(this.box.compact ? "NEXT LOT" : "THE NEXT LOT IS COMING ON", cx, cy)
      return
    }
    ctx.font = font(FACE_TEXT, unit * 1.22)
    ctx.fillStyle = PALETTE.brassBright
    ctx.fillText(this.box.compact ? "STAMP" : "STAMP THE DOCKET", cx, cy)
  }

  private drawDocket(showing: Docket, cx: number, cy: number): void {
    const ctx = this.ctx
    const unit = this.box.unit
    ctx.font = font(FACE_TEXT, unit * 1.22)
    ctx.fillStyle = VERDICT_HUE[showing.verdict]
    const compact = this.box.compact
    if (showing.verdict === "true") {
      ctx.fillText(compact ? "GOOD WEIGHT" : "GOOD WEIGHT — ONE OVER", cx, cy)
      return
    }
    if (showing.verdict === "shear") {
      ctx.fillText(compact ? "SHEARED" : "SHEARED — TOO MANY BLOWS", cx, cy)
      return
    }
    if (showing.verdict === "lapsed") {
      // No number. The brass on the pan was never a claim — the child never
      // stamped it — and printing it as one would be the screen scoring a round
      // the rules just decided not to score.
      ctx.fillText(compact ? "WENT BACK" : "THE LOT WENT BACK — NOTHING LOST", cx, cy)
      return
    }
    // What the child wrote, never what the goods weighed. The number they put on
    // the docket is theirs; the barrow's total stays the barrow's.
    const called = grouped(showing.asserted)
    ctx.fillText(
      compact
        ? `${VERDICT_WORD[showing.verdict]} · ${called}`
        : `${VERDICT_WORD[showing.verdict]} — YOU WROTE ${called}`,
      cx,
      cy,
    )
  }

  private drawFlash(): void {
    if (this.flashMs <= 0) return
    const ctx = this.ctx
    ctx.fillStyle = alpha(this.flashHue, (this.flashMs / 240) * 0.12)
    ctx.fillRect(0, 0, this.box.w, this.box.h)
  }

  private drawSheet(): void {
    // The host has something over the frame. The room is still there, dimmed,
    // and nothing under it is running.
    const ctx = this.ctx
    ctx.fillStyle = alpha(PALETTE.nightDeep, 0.55)
    ctx.fillRect(0, 0, this.box.w, this.box.h)
  }
}
