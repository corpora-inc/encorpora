// The street.
//
// Everything about this renderer is still subtraction. There are no particles, no
// glow layers, no confetti, no colour that means "correct". There is a dust plane,
// a slate, a caller, the people who have gathered to watch, a chute above and a bag
// below — and for most of every round none of them move at all.
//
// What is new is the one thing the game was missing: **the slate follows your
// finger.** A flick down carries it towards the bag; a flick up carries it towards
// the chute; whichever destination you are heading for lights as you commit to it,
// and past the threshold the slate leaves in that direction and does not come back.
// A card you have thrown is gone before your hand stops. That is the whole of the
// added juice and it is all in `slateBox` and `drawGutters`.

import { safeInsets, safeRect, type Insets } from "../../../../packs/shared/game-chrome/index.ts"
import type { Call, Outcome } from "../game/response.ts"
import { isCorrect } from "../game/response.ts"
import { exitOf, type Phase } from "../game/round.ts"
import type { Run } from "../game/run.ts"
import { crowdOf, SHOTS } from "../game/run.ts"
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

/** What the finger is doing right now. Null when nothing is touching the glass. */
export type Drag = {
  /** Vertical travel in CSS pixels. Down is positive. */
  readonly dy: number
  /** 0..1 towards committing. Clamped by the recogniser, so the slate cannot fly. */
  readonly pull: number
  /** The verdict this travel is heading towards, or null while it is ambiguous. */
  readonly heading: Call | null
}

export type SceneState = {
  readonly phase: Phase
  /** 0..1 through the current phase. */
  readonly progress: number
  readonly elapsedMs: number
  readonly statement: Statement | null
  readonly outcome: Outcome | null
  readonly run: Run
  /** Coins the last settled call was worth. Signed. Drawn as coins in flight. */
  readonly coins: number
  readonly best: number
  readonly reduced: boolean
  readonly drag: Drag | null
  /**
   * The host or the manual has something over the frame. The slate stands, blank.
   *
   * Same rule as the lead-in: a statement a child can read but cannot answer is
   * free thinking time that the reaction clock — which now drives both the bag and
   * the difficulty — would have silently subtracted out of itself.
   */
  readonly masked?: boolean
}

/**
 * How much light is left on the street when the window closes. Not zero: the
 * statement stays plainly legible to the last millisecond, because a child who is
 * still reading must never be reading in the dark.
 */
const WINDOW_FLOOR = 0.45

/** How far the slate travels per pixel of finger. Under 1, so the flick has weight. */
const DRAG_FOLLOW = 0.55

/** The most the slate tilts as it is thrown, in radians. A card, not a door. */
const DRAG_TILT = 0.05

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
   * Where the readable things ended up. Exposed so the layout can be asserted at
   * every viewport the fleet has, through the same call the game makes at resize —
   * a clearance test that builds its own rectangle is a test of the rectangle it
   * built.
   */
  get layout(): Street {
    return this.street
  }

  /**
   * `insets` defaults to the live safe-area insets, which is what the game passes.
   * A test passes a device's insets instead, because a notch is the one thing a
   * headless canvas will never report.
   */
  resize(insets: Insets = safeInsets()): void {
    const rect = this.canvas.getBoundingClientRect()
    // A zero-sized parent happens for one frame during mount; refusing to divide
    // by it is cheaper than guarding every call site.
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
    this.drawGutters(state)
    this.drawSlate(state)
    this.drawShots(state)
    this.drawBag(state)
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
   * The crowd. One witness steps out of the haze per correct call, and none of them
   * ever steps back: a tally that could shrink would be the loss-aversion loop the
   * product bans. The BAG can fall — that is the founder's economy and it is the
   * score. The crowd is the other thing, and it is construction.
   */
  private drawWitnesses(horizon: number, state: SceneState): void {
    const { ctx } = this
    const count = crowdOf(state.run)
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const rank = Math.floor(i / 2)
      // Deterministic scatter: the same call count always draws the same street,
      // so nothing shimmers between frames.
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

  /** The caller: still by default, bowing when you spot a counterfeit. */
  private drawCaller(horizon: number, state: SceneState): void {
    const height = this.h * 0.155
    const x = this.w * 0.5
    const y = horizon + this.h * 0.008

    let lean = 0
    if (state.outcome === "spot" && !state.reduced) {
      // Down, held, and back up — the whole of it inside the verdict.
      const t = state.phase === "verdict" ? state.progress : 1
      lean = 0.42 * Math.sin(Math.PI * clamp01(t) ** 0.85)
    }
    this.figure(x, y, height, lean, 0, state.outcome === "spot" ? this.litness(state) : 0)
  }

  /**
   * A silhouette. Deliberately faceless and deliberately made of the same three
   * strokes as everything else on the street — the character in this product is an
   * automaton drawn in the material language of the instruments, never a mascot.
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
      ctx.lineTo(
        w * 0.28 + Math.cos(reach) * height * 0.34,
        -height * 0.62 + Math.sin(reach) * height * 0.34,
      )
      ctx.stroke()
    }

    // One brass hairline down the lit side. The only thing that distinguishes the
    // caller from the crowd, and it is a rim light, not a costume.
    ctx.strokeStyle = withAlpha(rim > 0 ? BRASS_LIT : FIGURE_RIM, 0.55 + rim * 0.35)
    ctx.lineWidth = 1.25
    ctx.beginPath()
    ctx.moveTo(-w * 0.62, 0)
    ctx.lineTo(-w * 0.34, -height * 0.72)
    ctx.stroke()
    ctx.restore()
  }

  // ── the two destinations ────────────────────────────────────────────────

  /**
   * The chute above and the mouth of the bag below, and how far you have pulled
   * towards each.
   *
   * This is the affordance, and it is the reason a child does not have to be told
   * the controls twice: as soon as a finger moves at all, the direction it is moving
   * lights up. Nothing here is a button and nothing here is touched — the gesture
   * happens on the slate. They are destinations.
   */
  private drawGutters(state: SceneState): void {
    const { ctx } = this
    if (state.phase === "idle" || state.phase === "over") return
    const drag = state.drag
    const lit = this.litness(state)
    const { chute, bag } = this.street

    for (const [call, box] of [
      ["toss", chute],
      ["keep", { x: bag.x, y: bag.y, w: bag.w, h: bag.h * 0.22 }],
    ] as const) {
      const pulling = drag !== null && drag.heading === call ? drag.pull : 0
      const resting = drag !== null && drag.heading === null ? Math.min(0.35, drag.pull) : 0
      const glow = Math.max(pulling, resting) * lit
      // Three chevrons pointing the way out. At rest they are almost invisible;
      // under a committing finger they are the brightest thing after the slate.
      const rows = 3
      const up = call === "toss"
      ctx.strokeStyle = withAlpha(BRASS_LIT, 0.06 + glow * 0.72)
      ctx.lineWidth = 1 + glow * 1.4
      for (let r = 0; r < rows; r++) {
        const t = (r + 0.5) / rows
        const y = box.y + box.h * (up ? 1 - t : t)
        const spread = box.w * (0.06 + 0.05 * t)
        const rise = box.h * 0.22
        ctx.beginPath()
        ctx.moveTo(box.x + box.w / 2 - spread, y + (up ? rise : -rise))
        ctx.lineTo(box.x + box.w / 2, y)
        ctx.lineTo(box.x + box.w / 2 + spread, y + (up ? rise : -rise))
        ctx.stroke()
      }
    }
  }

  // ── the slate ───────────────────────────────────────────────────────────

  /**
   * How lit the street is: 0 while the slate is blank, 1 the instant the statement
   * is cut in.
   *
   * The rise is 90 ms and it does not travel, pulse or repeat. Then it **cools**,
   * back to `WINDOW_FLOOR` by the moment the window closes. That is the clock, and
   * it is the only one: no bar, no ring, no countdown, nothing that moves.
   *
   * A WRONG VERDICT REGAINS NO LIGHT. The street stays exactly as dim as the window
   * left it, in both directions — banking a counterfeit and throwing away good money
   * are equally unacknowledged. A lapse is the same: nothing brightens for a window
   * nobody touched, and nothing dims either.
   */
  private litness(state: SceneState): number {
    if (state.phase === "call") {
      const rise = clamp01(state.elapsedMs / 90)
      const window = state.statement?.windowMs ?? 2000
      const cool = clamp01((state.elapsedMs - 90) / Math.max(1, window - 90))
      return rise * (1 - (1 - WINDOW_FLOOR) * cool)
    }
    if (state.phase === "verdict" || state.phase === "clear") {
      if (state.outcome === null) return 1
      return isCorrect(state.outcome) ? 1 : WINDOW_FLOOR
    }
    if (state.phase === "over") return 1
    return 0
  }

  /**
   * Where the slate is, how transparent it is, and how far it has been thrown.
   *
   * Three motions, and only the third is new:
   *
   *   raise    up out of the dust, blank
   *   clear    away — DOWNWARD into the bag if you kept it, UPWARD out of frame if
   *            you threw it. `exitOf` owns that sign, so the rule lives with the
   *            outcomes rather than in the renderer.
   *   call     following the finger, at `DRAG_FOLLOW` of its travel, with a tilt.
   */
  private slateBox(state: SceneState): {
    x: number
    y: number
    w: number
    h: number
    a: number
    tilt: number
  } {
    // Where the slate stands is `street.ts`'s business — inside the safe area and
    // clear of the host's corners.
    const { x, y, w, h } = this.street.slate

    let drop = 0
    let a = 1
    let tilt = 0
    if (state.phase === "raise") {
      const t = state.reduced ? 1 : easeOut(state.progress)
      drop = (1 - t) * h * 1.5
      a = state.reduced ? state.progress : t
    } else if (state.phase === "clear") {
      const t = state.reduced ? 0 : easeOut(state.progress)
      drop = t * h * 1.8 * exitOf(state.outcome)
      a = 1 - (state.reduced ? state.progress : t)
    } else if (state.phase === "idle") {
      a = 0
    } else if (state.phase === "call" && state.drag !== null) {
      drop = state.drag.dy * DRAG_FOLLOW
      tilt = state.reduced ? 0 : clamp01(state.drag.pull) * DRAG_TILT * Math.sign(state.drag.dy)
    }
    return { x, y: y + drop, w, h, a, tilt }
  }

  private drawSlate(state: SceneState): void {
    const { ctx } = this
    const box = this.slateBox(state)
    if (box.a <= 0.001) return
    const lit = this.litness(state)

    ctx.save()
    ctx.globalAlpha = box.a
    if (box.tilt !== 0) {
      // Rotate about the slate's own centre, so a thrown card pivots rather than
      // swinging on a hinge somewhere off screen.
      const cx = box.x + box.w / 2
      const cy = box.y + box.h / 2
      ctx.translate(cx, cy)
      ctx.rotate(box.tilt)
      ctx.translate(-cx, -cy)
    }

    // The stone.
    const face = ctx.createLinearGradient(0, box.y, 0, box.y + box.h)
    face.addColorStop(0, mix(STONE, STONE_EDGE, 0.35 + lit * 0.25))
    face.addColorStop(1, STONE_RECESS)
    ctx.fillStyle = face
    ctx.fillRect(box.x, box.y, box.w, box.h)

    // The brass frame. Two rules, one bright and one in shadow, so the frame reads
    // as a machined edge rather than as a border.
    ctx.strokeStyle = mix(BRASS_DIM, BRASS_LIT, lit)
    ctx.lineWidth = 2
    ctx.strokeRect(box.x + 1, box.y + 1, box.w - 2, box.h - 2)
    ctx.strokeStyle = withAlpha(BRASS, 0.22 + lit * 0.3)
    ctx.lineWidth = 1
    ctx.strokeRect(box.x + 5.5, box.y + 5.5, box.w - 11, box.h - 11)

    if (state.phase === "over") this.drawLedger(box, state)
    // Blank through `raise` and `still`. The statement is cut in when the window
    // opens and not one millisecond before: it used to be legible for up to 1.15 s
    // of unanswerable lead-in, and every reaction time this game measures had that
    // lead-in silently subtracted out of it. See `statement.stillFor`.
    else if (state.phase !== "raise" && state.phase !== "still" && state.masked !== true) {
      this.drawStatement(box, state, lit)
    }

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

    const correcting =
      state.outcome === "spot" && (state.phase === "verdict" || state.phase === "clear")
    const correction = correcting ? correctionFor(l, statement.claimed, statement.answer) : null
    // The roll starts a beat into the bow: the caller acknowledges you first, and
    // only then does the slate admit it was wrong.
    const rollT = correcting
      ? clamp01(((state.phase === "verdict" ? state.progress : 1) - 0.24) / 0.5)
      : 0

    const chalk = mix(CHALK_UNLIT, CHALK_LIT, lit)
    // Every alpha below is set *from* this rather than multiplied into the context.
    // A running `*=` / `/=` pair looks equivalent and is not: at the end of the
    // cross-fade the multiplier is zero, the division cannot undo it, and everything
    // drawn afterwards — including the corrected numeral the fade exists to reveal —
    // is drawn fully transparent.
    const base = ctx.globalAlpha

    for (let i = 0; i < l.cells.length; i++) {
      const cell = l.cells[i]
      if (!cell) continue
      const rolling = correction?.rolls.find((r) => r.index === i)
      const inClaim = correction !== null && i >= correction.start
      const fading = inClaim && rollT > 0 && !correction.canRoll

      if (rolling && rollT > 0) {
        this.rollDigit(
          cell.x + originX,
          baseY,
          cell.w,
          px,
          rolling.from,
          rolling.to,
          rollT,
          state.reduced,
          chalk,
        )
        continue
      }
      if (fading) {
        // Lengths differ, so there is no column to roll in. The wrong value fades
        // out where it stands and the right one fades in over it.
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

    if (state.outcome === "bank" && (state.phase === "verdict" || state.phase === "clear")) {
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
   * The correction: a wrong digit rolls up out of its cell and the right one rolls
   * in behind it, like a counter wheel. It is clipped to the cell, so the statement
   * never reflows and nothing moves outside the recess.
   *
   * Reduced motion takes the same event as a cross-fade in place — a branch, not a
   * degradation. The child still watches the slate correct itself.
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

  /** A single incision across the face: the stamp on a claim you banked. */
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
   * The run, over. One numeral: the bag.
   *
   * There is no percentage here and there never will be. A child shown "50%" reads
   * a passing grade; a child shown a bag of coins reads a bag of coins.
   */
  private drawLedger(
    box: { x: number; y: number; w: number; h: number },
    state: SceneState,
  ): void {
    const { ctx } = this
    const px = box.h * 0.52
    ctx.font = `${String(Math.round(px))}px ${SLATE_FONT}`
    ctx.textAlign = "center"
    ctx.textBaseline = "alphabetic"
    ctx.fillStyle = CHALK_LIT
    const t = clamp01(state.elapsedMs / 420)
    ctx.globalAlpha *= state.reduced ? t : easeOut(t)
    ctx.fillText(String(state.run.bag), box.x + box.w / 2, box.y + box.h * 0.6)

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
    // Before a run starts there is nothing on the street but the caller and three
    // loaded shots, breathing.
    if (state.phase === "idle") {
      ctx.globalAlpha = state.reduced ? 0.7 : 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(state.elapsedMs / 620))
    }
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

  /**
   * THE BAG. The score, and the only number on the street during play.
   *
   * The coins in flight are the whole of the feedback for a wrong verdict: nothing
   * sounds, nothing buzzes, nothing flashes and the caller does not move — coins
   * simply come back out of the bag and go. `energy.ts` holds that line.
   */
  private drawBag(state: SceneState): void {
    if (state.phase === "idle") return
    const { ctx } = this
    const { bag } = this.street
    const cx = bag.x + bag.w / 2
    const lip = bag.y + bag.h * 0.22
    const full = clamp01(state.run.bag / 240)

    // A bag: a straight lip, and a body that swells with what is in it.
    ctx.strokeStyle = withAlpha(BRASS_DIM, 0.55)
    ctx.lineWidth = 1.25
    ctx.beginPath()
    ctx.moveTo(bag.x + bag.w * 0.22, lip)
    ctx.lineTo(bag.x + bag.w * 0.78, lip)
    ctx.stroke()

    const belly = bag.w * (0.3 + full * 0.16)
    ctx.beginPath()
    ctx.moveTo(bag.x + bag.w * 0.26, lip)
    ctx.bezierCurveTo(
      cx - belly,
      lip + bag.h * 0.34,
      cx - belly * 0.72,
      bag.y + bag.h,
      cx,
      bag.y + bag.h,
    )
    ctx.bezierCurveTo(
      cx + belly * 0.72,
      bag.y + bag.h,
      cx + belly,
      lip + bag.h * 0.34,
      bag.x + bag.w * 0.74,
      lip,
    )
    ctx.strokeStyle = withAlpha(BRASS, 0.3 + full * 0.4)
    ctx.stroke()

    // The count. Brass, inside the bag, and it is the score.
    ctx.font = `${String(this.street.bagPx)}px ${SLATE_FONT}`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = withAlpha(BRASS_LIT, state.run.bag > 0 ? 0.9 : 0.34)
    ctx.fillText(String(state.run.bag), cx, bag.y + bag.h * 0.64)

    this.drawCoins(state)
  }

  /**
   * Coins in flight, during the verdict only.
   *
   * Into the bag when the call was right, out of it and away when it was wrong. The
   * count is the size of the call, so a fast correct keep visibly pays more than a
   * slow one — the speed bonus is a thing a child can SEE rather than a number they
   * are told.
   */
  private drawCoins(state: SceneState): void {
    if (state.phase !== "verdict" && state.phase !== "clear") return
    if (state.coins === 0) return
    const { ctx } = this
    const { bag, slate } = this.street
    const inbound = state.coins > 0
    // FEWER coins leave than arrive, always. `energy.ts` holds "being wrong is never
    // more interesting than being right" on duration × movers × loudness, and a loss
    // that sprayed six coins where a win sprayed five would break the same rule at the
    // level of the pixels: a wrong verdict costs more coins than a right one earns, so
    // a count proportional to the amount would make the loss the bigger event.
    const n = inbound
      ? Math.max(3, Math.min(8, Math.round(state.coins / 2)))
      : COINS_OUT
    const t = state.phase === "verdict" ? clamp01(state.progress) : 1
    const e = state.reduced ? t : easeOut(t)
    const from = { x: slate.x + slate.w / 2, y: slate.y + slate.h / 2 }
    const to = { x: bag.x + bag.w / 2, y: bag.y + bag.h * 0.55 }
    const r = Math.max(2, bag.w * 0.045)

    for (let i = 0; i < n; i++) {
      // Staggered, so they arrive as a handful rather than as one object.
      const stagger = clamp01((e - i * 0.06) / 0.7)
      if (stagger <= 0) continue
      const lane = ((i % 2 === 0 ? -1 : 1) * (1 + Math.floor(i / 2))) / (n + 1)
      const spread = bag.w * 0.5 * lane
      let x: number
      let y: number
      let alpha: number
      if (inbound) {
        x = from.x + (to.x - from.x) * stagger + spread * (1 - stagger)
        y = from.y + (to.y - from.y) * stagger
        alpha = 0.85 * (1 - stagger * 0.35)
      } else {
        // Out of the bag and away downwards, off the bottom of the frame.
        x = to.x + spread * stagger
        y = to.y + (this.h - to.y) * stagger
        alpha = 0.7 * (1 - stagger)
      }
      ctx.globalAlpha = Math.max(0, alpha)
      ctx.fillStyle = inbound ? BRASS_LIT : BRASS_DIM
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}

/**
 * How many coins a loss shows leaving the bag.
 *
 * Fixed, and fewer than the smallest win puts in — see `drawCoins`.
 */
const COINS_OUT = 2
