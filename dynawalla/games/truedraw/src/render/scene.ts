// The street.
//
// Everything about this renderer is subtraction. There are no particles, no
// glow layers, no confetti, no colour that means "correct". There is a dust
// plane, a slate, a caller, and the people who have gathered to watch — and for
// most of every round none of them move at all.
//
// The one bright event in the game is the slate lighting, and it is a light
// change rather than a motion: the engraved statement goes from unlit stone to
// cold celestial, the brass frame catches it, and that is the go signal. Total
// stillness, then a slate-flash. Restraint as the whole design.

import { safeInsets, safeRect, type Insets } from "../../../../packs/shared/game-chrome/index.ts"
import type { Outcome } from "../game/response.ts"
import type { Phase } from "../game/round.ts"
import type { Run } from "../game/run.ts"
import { SHOTS } from "../game/run.ts"
import type { Statement } from "../game/statement.ts"
import { correctionFor, digitCellWidth, layout, type Layout } from "./glyphs.ts"
import { layoutFor, type Layout as Street } from "./street.ts"
import {
  BRASS,
  BRASS_DIM,
  BRASS_LIT,
  CHALK_LIT,
  CHALK_UNLIT,
  CHALK_WRONG,
  DUST,
  DUST_LIT,
  FIGURE,
  FIGURE_RIM,
  HAZE,
  LAPIS,
  NIGHT,
  NIGHT_DEEP,
  SLATE_FONT,
  STONE,
  STONE_EDGE,
  STONE_RECESS,
  mix,
  withAlpha,
} from "./palette.ts"

export type SceneState = {
  readonly phase: Phase
  /** 0..1 through the current phase. */
  readonly progress: number
  readonly elapsedMs: number
  readonly statement: Statement | null
  readonly outcome: Outcome | null
  readonly run: Run
  readonly best: number
  readonly reduced: boolean
}

/**
 * How much light is left on the street when the draw window closes. Not zero:
 * the statement stays plainly legible to the last millisecond, because a child
 * who is still reading must never be reading in the dark.
 */
const WINDOW_FLOOR = 0.45

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t) * (1 - t)
const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t))

export class Scene {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private w = 0
  private h = 0
  private dpr = 1
  private street: Street

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext("2d", { alpha: false })
    if (!ctx) throw new Error("truedraw: no 2d context")
    this.ctx = ctx
    this.street = layoutFor(1, 1, safeRect(1, 1))
    this.resize()
  }

  /**
   * Where the readable things ended up. Exposed so the layout can be asserted
   * at every viewport the fleet has, through the same call the game makes at
   * resize — a clearance test that builds its own rectangle is a test of the
   * rectangle it built.
   */
  get layout(): Street {
    return this.street
  }

  /**
   * `insets` defaults to the live safe-area insets, which is what the game
   * passes. A test passes a device's insets instead, because a notch is the one
   * thing a headless canvas will never report.
   */
  resize(insets: Insets = safeInsets()): void {
    const rect = this.canvas.getBoundingClientRect()
    // A zero-sized parent happens for one frame during mount; refusing to
    // divide by it is cheaper than guarding every call site.
    this.w = Math.max(1, Math.round(rect.width))
    this.h = Math.max(1, Math.round(rect.height))
    this.dpr = Math.min(3, globalThis.devicePixelRatio || 1)
    this.canvas.width = Math.round(this.w * this.dpr)
    this.canvas.height = Math.round(this.h * this.dpr)
    this.street = layoutFor(this.w, this.h, safeRect(this.w, this.h, insets))
  }

  draw(state: SceneState): void {
    const { ctx } = this
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.w, this.h)

    const horizon = this.street.horizon
    this.drawSky(horizon)
    this.drawGround(horizon, state)
    this.drawWitnesses(horizon, state)
    this.drawCaller(horizon, state)
    this.drawSlate(state)
    this.drawShots(state)
    this.drawTally(state)
  }

  // ── ground and sky ──────────────────────────────────────────────────────

  private drawSky(horizon: number): void {
    const { ctx } = this
    const sky = ctx.createLinearGradient(0, 0, 0, horizon)
    sky.addColorStop(0, NIGHT_DEEP)
    sky.addColorStop(0.72, NIGHT)
    sky.addColorStop(1, HAZE)
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, this.w, horizon)
  }

  private drawGround(horizon: number, state: SceneState): void {
    const { ctx } = this
    const lit = this.litness(state)
    const ground = ctx.createLinearGradient(0, horizon, 0, this.h)
    ground.addColorStop(0, mix(DUST, DUST_LIT, lit * 0.7))
    ground.addColorStop(1, NIGHT_DEEP)
    ctx.fillStyle = ground
    ctx.fillRect(0, horizon, this.w, this.h - horizon)

    // The horizon itself: one hairline of lapis where the dust meets the sky.
    ctx.fillStyle = withAlpha(LAPIS, 0.5 + lit * 0.3)
    ctx.fillRect(0, horizon - 1, this.w, 1)
  }

  // ── the people ──────────────────────────────────────────────────────────

  /**
   * The crowd. One witness steps out of the haze per call made, and none of
   * them ever steps back: this is the run's tally drawn as people, and a tally
   * that could shrink would be the loss-aversion loop the product bans.
   *
   * A masher's street therefore stays empty, which is the entire point.
   */
  private drawWitnesses(horizon: number, state: SceneState): void {
    const { ctx } = this
    const count = Math.min(14, state.run.calls)
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const rank = Math.floor(i / 2)
      // Deterministic scatter: the same call count always draws the same
      // street, so nothing shimmers between frames.
      const jitter = ((i * 2654435761) % 1000) / 1000
      const spread = 0.16 + rank * 0.075 + jitter * 0.05
      const x = this.w * (0.5 + side * spread)
      const depth = 1 - Math.min(0.55, rank * 0.09 + jitter * 0.06)
      const height = this.h * 0.1 * depth
      const y = horizon + this.h * 0.012 * (1 - depth) * 3
      ctx.globalAlpha = 0.34 + depth * 0.4
      this.figure(x, y, height, 0, 0)
      ctx.globalAlpha = 1
    }
  }

  /** The caller: still by default, bowing when you correctly let a lie stand. */
  private drawCaller(horizon: number, state: SceneState): void {
    const height = this.h * 0.155
    const x = this.w * 0.5
    const y = horizon + this.h * 0.008

    let lean = 0
    let arm = 0
    if (state.outcome === "bow" && !state.reduced) {
      // Down, held, and back up — the whole of it inside the verdict.
      const t = state.phase === "verdict" ? state.progress : 1
      lean = 0.42 * Math.sin(Math.PI * clamp01(t) ** 0.85)
    }
    if (state.outcome === "slow") {
      // The caller draws. One motion, and it is over before you look up.
      const t = state.phase === "verdict" ? easeOut(clamp01(state.progress * 3.2)) : 1
      arm = t
    }
    this.figure(x, y, height, lean, arm, state.outcome === "bow" ? this.litness(state) : 0)
  }

  /**
   * A silhouette. Deliberately faceless and deliberately made of the same three
   * strokes as everything else on the street — the character in this product is
   * an automaton drawn in the material language of the instruments, never a
   * mascot.
   */
  private figure(x: number, y: number, height: number, lean: number, arm: number, rim = 0): void {
    const { ctx } = this
    const w = height * 0.3
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(lean)

    ctx.fillStyle = FIGURE
    ctx.beginPath()
    // A tapered coat: wide at the hem, narrow at the shoulder.
    ctx.moveTo(-w * 0.62, 0)
    ctx.lineTo(-w * 0.34, -height * 0.72)
    ctx.lineTo(w * 0.34, -height * 0.72)
    ctx.lineTo(w * 0.62, 0)
    ctx.closePath()
    ctx.fill()

    ctx.beginPath()
    ctx.arc(0, -height * 0.82, height * 0.11, 0, Math.PI * 2)
    ctx.fill()

    if (arm > 0) {
      ctx.strokeStyle = FIGURE
      ctx.lineWidth = Math.max(2, height * 0.075)
      ctx.lineCap = "round"
      ctx.beginPath()
      ctx.moveTo(w * 0.28, -height * 0.62)
      const reach = -Math.PI * 0.5 * arm
      ctx.lineTo(w * 0.28 + Math.cos(reach) * height * 0.34, -height * 0.62 + Math.sin(reach) * height * 0.34)
      ctx.stroke()
    }

    // One brass hairline down the lit side. The only thing that distinguishes
    // the caller from the crowd, and it is a rim light, not a costume.
    ctx.strokeStyle = withAlpha(rim > 0 ? BRASS_LIT : FIGURE_RIM, 0.55 + rim * 0.35)
    ctx.lineWidth = 1.25
    ctx.beginPath()
    ctx.moveTo(-w * 0.62, 0)
    ctx.lineTo(-w * 0.34, -height * 0.72)
    ctx.stroke()
    ctx.restore()
  }

  // ── the slate ───────────────────────────────────────────────────────────

  /**
   * How lit the street is: 0 while it is still, 1 the instant the slate catches.
   *
   * The rise is 90 ms and it does not travel, pulse or repeat — the cue is a
   * light change, which is the whole of the juice budget spent in one place.
   *
   * Then it **cools**, back to `WINDOW_FLOOR` by the moment the window closes.
   * That is the clock, and it is the only one: no bar, no ring, no countdown,
   * nothing that moves. The beat is legible because the light is going out of
   * it, which is what a child feels rather than reads.
   */
  private litness(state: SceneState): number {
    if (state.phase === "call") {
      const rise = clamp01(state.elapsedMs / 90)
      const window = state.statement?.windowMs ?? 2000
      const cool = clamp01((state.elapsedMs - 90) / Math.max(1, window - 90))
      return rise * (1 - (1 - WINDOW_FLOOR) * cool)
    }
    if (state.phase === "verdict" || state.phase === "clear") {
      // A wrong draw changes nothing, and that includes the light. The street
      // stays exactly as dim as the window left it while the round runs out.
      return state.outcome === "wild" ? WINDOW_FLOOR : 1
    }
    if (state.phase === "over") return 1
    return 0
  }

  private slateBox(state: SceneState): { x: number; y: number; w: number; h: number; a: number } {
    // Where the slate stands is `street.ts`'s business — inside the safe area
    // and clear of the host's corners. All that happens here is the raise and
    // the clear, which are motion about that rest position.
    const { x, y, w, h } = this.street.slate

    let drop = 0
    let a = 1
    if (state.phase === "raise") {
      const t = state.reduced ? 1 : easeOut(state.progress)
      drop = (1 - t) * h * 1.5
      a = state.reduced ? state.progress : t
    } else if (state.phase === "clear") {
      const t = state.reduced ? 0 : easeOut(state.progress)
      drop = t * h * 1.5
      a = 1 - (state.reduced ? state.progress : t)
    } else if (state.phase === "idle") {
      a = 0
    }
    return { x, y: y + drop, w, h, a }
  }

  private drawSlate(state: SceneState): void {
    const { ctx } = this
    const box = this.slateBox(state)
    if (box.a <= 0.001) return
    const lit = this.litness(state)

    ctx.save()
    ctx.globalAlpha = box.a

    // The stone.
    const face = ctx.createLinearGradient(0, box.y, 0, box.y + box.h)
    face.addColorStop(0, mix(STONE, STONE_EDGE, 0.35 + lit * 0.25))
    face.addColorStop(1, STONE_RECESS)
    ctx.fillStyle = face
    ctx.fillRect(box.x, box.y, box.w, box.h)

    // The brass frame. Two rules, one bright and one in shadow, so the frame
    // reads as a machined edge rather than as a border.
    ctx.strokeStyle = mix(BRASS_DIM, BRASS_LIT, lit)
    ctx.lineWidth = 2
    ctx.strokeRect(box.x + 1, box.y + 1, box.w - 2, box.h - 2)
    ctx.strokeStyle = withAlpha(BRASS, 0.22 + lit * 0.3)
    ctx.lineWidth = 1
    ctx.strokeRect(box.x + 5.5, box.y + 5.5, box.w - 11, box.h - 11)

    if (state.phase === "over") this.drawLedger(box, state)
    else this.drawStatement(box, state, lit)

    ctx.restore()
  }

  private faceFor(box: { w: number; h: number }, text: string): { px: number; layout: Layout } {
    const { ctx } = this
    const inner = box.w - box.h * 0.5
    let px = box.h * 0.42
    for (let pass = 0; pass < 3; pass++) {
      ctx.font = `${String(Math.round(px))}px ${SLATE_FONT}`
      const l = layout(ctx, text, digitCellWidth(ctx))
      if (l.width <= inner) return { px, layout: l }
      px *= (inner / l.width) * 0.98
    }
    ctx.font = `${String(Math.round(px))}px ${SLATE_FONT}`
    return { px, layout: layout(ctx, text, digitCellWidth(ctx)) }
  }

  private drawStatement(
    box: { x: number; y: number; w: number; h: number },
    state: SceneState,
    lit: number,
  ): void {
    const statement = state.statement
    if (!statement) return
    const { ctx } = this
    const { px, layout: l } = this.faceFor(box, statement.text)
    const originX = box.x + (box.w - l.width) / 2
    const baseY = box.y + box.h / 2 + px * 0.35

    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"

    const correcting = state.outcome === "bow" && (state.phase === "verdict" || state.phase === "clear")
    const correction = correcting ? correctionFor(l, statement.claimed, statement.answer) : null
    // The roll starts a beat into the bow: the caller acknowledges you first,
    // and only then does the slate admit it was wrong.
    const rollT = correcting
      ? clamp01(((state.phase === "verdict" ? state.progress : 1) - 0.24) / 0.5)
      : 0

    const chalk = mix(CHALK_UNLIT, CHALK_LIT, lit)
    // Every alpha below is set *from* this rather than multiplied into the
    // context. A running `*=` / `/=` pair looks equivalent and is not: at the
    // end of the cross-fade the multiplier is zero, the division cannot undo
    // it, and everything drawn afterwards — including the corrected numeral the
    // fade exists to reveal — is drawn fully transparent.
    const base = ctx.globalAlpha

    for (let i = 0; i < l.cells.length; i++) {
      const cell = l.cells[i]
      if (!cell) continue
      const rolling = correction?.rolls.find((r) => r.index === i)
      const inClaim = correction !== null && i >= correction.start
      const fading = inClaim && rollT > 0 && !correction.canRoll

      if (rolling && rollT > 0) {
        this.rollDigit(cell.x + originX, baseY, cell.w, px, rolling.from, rolling.to, rollT, state.reduced, chalk)
        continue
      }
      if (fading) {
        // Lengths differ, so there is no column to roll in. The wrong value
        // fades out where it stands and the right one fades in over it.
        ctx.globalAlpha = base * (1 - rollT)
        this.glyph(cell.ch, cell.x + originX, baseY, cell.w, CHALK_WRONG)
        ctx.globalAlpha = base
        continue
      }
      this.glyph(cell.ch, cell.x + originX, baseY, cell.w, chalk)
    }

    if (correction !== null && !correction.canRoll && rollT > 0) {
      const corrected = `${statement.expression} = ${statement.answer}`
      const fixed = this.faceFor(box, corrected)
      const fx = box.x + (box.w - fixed.layout.width) / 2
      ctx.globalAlpha = base * rollT
      for (const cell of fixed.layout.cells) {
        this.glyph(cell.ch, cell.x + fx, baseY, cell.w, chalk)
      }
      ctx.globalAlpha = base
    }

    if (state.outcome === "hit" && (state.phase === "verdict" || state.phase === "clear")) {
      this.drawStrike(box, state)
    }
  }

  /** One glyph, centred in its cell so digits sit on the tabular grid. */
  private glyph(ch: string, x: number, baseY: number, cellW: number, colour: string): void {
    const { ctx } = this
    const w = ctx.measureText(ch).width
    ctx.fillStyle = colour
    ctx.fillText(ch, x + (cellW - w) / 2, baseY)
  }

  /**
   * The correction: a wrong digit rolls up out of its cell and the right one
   * rolls in behind it, like a counter wheel. It is clipped to the cell, so the
   * statement never reflows and nothing moves outside the recess.
   *
   * Reduced motion takes the same event as a cross-fade in place — a branch,
   * not a degradation. The child still watches the slate correct itself.
   */
  private rollDigit(
    x: number,
    baseY: number,
    cellW: number,
    px: number,
    from: string,
    to: string,
    t: number,
    reduced: boolean,
    colour: string,
  ): void {
    const { ctx } = this
    if (reduced) {
      const alpha = ctx.globalAlpha
      ctx.globalAlpha = alpha * (1 - t)
      this.glyph(from, x, baseY, cellW, CHALK_WRONG)
      ctx.globalAlpha = alpha * t
      this.glyph(to, x, baseY, cellW, colour)
      ctx.globalAlpha = alpha
      return
    }
    const e = easeInOut(t)
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, baseY - px * 1.02, cellW, px * 1.3)
    ctx.clip()
    this.glyph(from, x, baseY - e * px * 1.25, cellW, CHALK_WRONG)
    this.glyph(to, x, baseY + (1 - e) * px * 1.25, cellW, colour)
    ctx.restore()
  }

  /** A single incision across the face. Cut once, then still. */
  private drawStrike(box: { x: number; y: number; w: number; h: number }, state: SceneState): void {
    const { ctx } = this
    const t = state.phase === "verdict" ? clamp01(state.progress / 0.3) : 1
    const e = state.reduced ? 1 : easeOut(t)
    const inset = box.h * 0.22
    const x0 = box.x + inset
    const y0 = box.y + box.h - inset
    const x1 = box.x + box.w - inset
    const y1 = box.y + inset
    ctx.strokeStyle = withAlpha(BRASS_LIT, 0.5 * (state.reduced ? t : 1))
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x0 + (x1 - x0) * e, y0 + (y1 - y0) * e)
    ctx.stroke()
  }

  // ── the ledger ──────────────────────────────────────────────────────────

  /**
   * The run, over. One numeral: how many calls you made.
   *
   * There is no percentage here and there never will be. A child shown "50%"
   * reads a passing grade; a child shown "3" reads three.
   */
  private drawLedger(box: { x: number; y: number; w: number; h: number }, state: SceneState): void {
    const { ctx } = this
    const px = box.h * 0.52
    ctx.font = `${String(Math.round(px))}px ${SLATE_FONT}`
    ctx.textAlign = "center"
    ctx.textBaseline = "alphabetic"
    ctx.fillStyle = CHALK_LIT
    const t = clamp01(state.elapsedMs / 420)
    ctx.globalAlpha *= state.reduced ? t : easeOut(t)
    ctx.fillText(String(state.run.calls), box.x + box.w / 2, box.y + box.h * 0.6)

    if (state.best > 0) {
      const small = Math.round(box.h * 0.15)
      ctx.font = `${String(small)}px ${SLATE_FONT}`
      ctx.fillStyle = withAlpha(BRASS, 0.75)
      ctx.fillText(`BEST ${String(state.best)}`, box.x + box.w / 2, box.y + box.h * 0.86)
    }
  }

  // ── the hud, such as it is ──────────────────────────────────────────────

  /** Three brass pips. A spent one is an empty ring, and it goes out in silence. */
  private drawShots(state: SceneState): void {
    const { ctx } = this
    // Before a run starts there is nothing on the street but the caller and
    // three loaded shots, breathing. That is the whole instruction: one tap.
    if (state.phase === "idle") {
      ctx.globalAlpha = state.reduced ? 0.7 : 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(state.elapsedMs / 620))
    }
    // The shots are the only resource in the game, so they travel with the
    // slate: inside the safe area, under the host's corners, never under a
    // rounded corner of the glass.
    const { pip: r, pipGap: gap, shots } = this.street
    const cx = shots.x + shots.w / 2
    const y = shots.y + shots.h / 2
    for (let i = 0; i < SHOTS; i++) {
      const x = cx + (i - (SHOTS - 1) / 2) * gap
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      if (i < state.run.shots) {
        ctx.fillStyle = BRASS
        ctx.fill()
      } else {
        ctx.strokeStyle = withAlpha(BRASS_DIM, 0.7)
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
  }

  /** The tally: how many calls, in brass, small, above everything. */
  private drawTally(state: SceneState): void {
    if (state.phase === "idle" || state.phase === "over") return
    const { ctx } = this
    const { tally, tallyPx } = this.street
    ctx.font = `${String(tallyPx)}px ${SLATE_FONT}`
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    ctx.fillStyle = withAlpha(BRASS, state.run.calls > 0 ? 0.8 : 0.3)
    ctx.fillText(String(state.run.calls), tally.x + tally.w / 2, tally.y)
  }
}
