// The street.
//
// Most of this renderer is still subtraction. There is a dust plane, a slate, a
// caller, the people who have gathered to watch, a chute at the top of the frame
// and a hoard at the bottom — and for most of every round none of them move.
//
// What the founder's playtest changed is what happens at the two moments that
// matter, and how the slate behaves under a finger.
//
// ── THE MATHS MOMENT IS THE ONLY MOMENT ─────────────────────────────────────
//
// Everything expensive in this file fires on a CORRECT RETRIEVAL — a claim judged
// rightly — and on nothing else. Not on a collision, not on a streak, not on a
// window opening, not on a menu. `flourish.ts` draws one of four celebrations per
// correct call so the twentieth does not look like the first.
//
// ── A MISS COMPLETES THE SUM ────────────────────────────────────────────────
//
// The old renderer's rule was that a wrong verdict "adds no mark, no light and no
// colour" — the coins drained and nothing else happened. That was written to avoid
// punishing a child and it succeeded, but it also meant the single most teachable
// second in the game was spent showing them nothing.
//
// A miss now finishes the sum in front of the child, in `ACCENT`, held long enough
// to read, in one of three ways. Never red, never the word WRONG, never an
// adjective attached to the child. `games/stack` is the fleet's reference and this
// is the same behaviour in this game's material. The reaction is still strictly
// smaller than a celebration — `game/energy.ts` proves it against the numbers.
//
// ── THE SLATE FOLLOWS THE FINGER, WITH WEIGHT ───────────────────────────────
//
// `drag.ts` owns the curve: weight at the start, magnetism into the destination,
// a rubber band past the commit line, a tilt and an echo trail. All of it pure and
// driven to the pixel by `drag.test.ts`.

import { safeInsets, safeRect, type Insets } from "../../../../packs/shared/game-chrome/index.ts"
import { commitDistance } from "../game/gesture.ts"
import type { Call, Outcome } from "../game/response.ts"
import { isCorrect, isMiss } from "../game/response.ts"
import { exitOf, type Phase } from "../game/round.ts"
import type { Run } from "../game/run.ts"
import { crowdOf, SHOTS } from "../game/run.ts"
import type { Statement } from "../game/statement.ts"
import { followOffset, magnetism, tiltFor, trailFor } from "./drag.ts"
import { defaultFlourish, type Flourish } from "./flourish.ts"
import { correctionFor, digitCellWidth, layout, type Layout } from "./glyphs.ts"
import { hintFor, markGlow, type Hint } from "./hint.ts"
import { layoutFor, type Layout as Street } from "./street.ts"
import {
  ACCENT,
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
   * The celebration or the miss reveal this verdict drew, from `flourish.ts`.
   *
   * Null on a frame with no verdict on it, and null on a lapse. A verdict frame
   * that somehow arrives without one — a resume, a re-render — falls back to
   * `defaultFlourish`, because a correct call that celebrated nothing would be the
   * worse failure by a distance.
   */
  readonly flourish?: Flourish | null
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

/** Share of the miss verdict spent completing the sum. The rest is the HOLD. */
const REVEAL_SHARE = 0.45

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t) * (1 - t)
const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
const clamp01 = (t: number): number => Math.max(0, Math.min(1, t))

/** Deterministic per-element jitter. No `Math.random` anywhere in a frame. */
const jitter = (i: number, salt: number): number =>
  ((Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453) % 1 + 1) % 1

export class Scene {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private w = 0
  private h = 0
  private dpr = 1
  private commit = 34
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
    // The same threshold the recogniser is built with, so the magnetism arrives
    // exactly where the verdict does rather than near it.
    this.commit = commitDistance(this.w, this.h)
  }

  draw(state: SceneState): void {
    const { ctx } = this
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.clearRect(0, 0, this.w, this.h)

    const hint = hintFor({
      phase: state.phase,
      elapsedMs: state.elapsedMs,
      reduced: state.reduced,
      ...(state.masked === undefined ? {} : { masked: state.masked }),
      dragging: state.drag !== null,
      calls: state.run.calls,
    })

    const horizon = this.street.horizon
    this.drawSky(horizon)
    this.drawGround(horizon, state)
    this.drawWitnesses(horizon, state)
    this.drawCaller(horizon, state)
    this.drawDestinations(state, hint)
    this.drawGhost(hint)
    this.drawSlate(state)
    this.drawCelebration(state)
    this.drawShots(state)
    this.drawHoard(state)
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
   * product bans. The HOARD can fall — that is the founder's economy and it is the
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
      const scatter = ((i * 2654435761) % 1000) / 1000
      const spread = 0.16 + rank * 0.075 + scatter * 0.05
      const x = this.w * (0.5 + side * spread)
      const depth = 1 - Math.min(0.55, rank * 0.09 + scatter * 0.06)
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
   * THE CHUTE at the top and the MOUTH OF THE HOARD at the bottom, the chevrons
   * that point into each, and the two marks that are the whole of the instructions:
   * `≠` above, `=` below.
   *
   * Nothing here is a button and nothing here is touched — the gesture happens on
   * the slate. They are destinations, and they light as soon as a finger commits
   * towards one, which is why the controls do not have to be explained twice.
   *
   * The marks are STROKED, not typed. Partly because two rules and a slash are the
   * same three-stroke material language as everything else on the street; partly
   * because a glyph drawn as text at 14 px on a 320 px phone is at the mercy of
   * whatever serif the device felt like substituting.
   */
  private drawDestinations(state: SceneState, hint: Hint | null): void {
    const { ctx } = this
    if (state.phase === "idle" || state.phase === "over") return
    const drag = state.drag
    const lit = Math.max(0.55, this.litness(state))
    const { chuteFlow, chuteMark, hoardFlow, hoardMark } = this.street

    for (const [call, flow, mark] of [
      ["toss", chuteFlow, chuteMark],
      ["keep", hoardFlow, hoardMark],
    ] as const) {
      const heading = drag !== null && drag.heading === call
      const pull = heading ? magnetism(drag.dy, this.commit) : 0
      const resting = drag !== null && drag.heading === null ? Math.min(0.3, drag.pull) : 0
      const glow = markGlow(true, Math.max(pull, resting), hint, hint?.call === call) * lit
      const up = call === "toss"

      // Three chevrons pointing the way out, on the side nearest the slate.
      ctx.strokeStyle = withAlpha(BRASS_LIT, 0.05 + glow * 0.5)
      ctx.lineWidth = 1 + glow * 1.6
      for (let r = 0; r < 3; r++) {
        const t = (r + 0.5) / 3
        const y = flow.y + flow.h * (up ? 1 - t : t)
        const spread = flow.w * (0.06 + 0.05 * t)
        const rise = flow.h * 0.3
        ctx.beginPath()
        ctx.moveTo(flow.x + flow.w / 2 - spread, y + (up ? rise : -rise))
        ctx.lineTo(flow.x + flow.w / 2, y)
        ctx.lineTo(flow.x + flow.w / 2 + spread, y + (up ? rise : -rise))
        ctx.stroke()
      }

      this.drawMark(mark, call, glow)
    }
  }

  /**
   * `≠` on the chute, `=` on the hoard.
   *
   * Two rules, and a slash through the top one when the answer is "it does not".
   * UP IS `≠`, DOWN IS `=` — the founder's "intuitive up == false, down == true",
   * said in the notation the child is already reading on the slate, in no language
   * at all.
   */
  private drawMark(box: { x: number; y: number; w: number; h: number }, call: Call, glow: number): void {
    const { ctx } = this
    const px = this.street.markPx
    const half = px * 0.42
    const cx = box.x + box.w / 2
    // Centred in its own band. `street.ts` put that band beyond the chevrons, at
    // the far end of the destination, where nothing else is drawn.
    const cy = box.y + box.h / 2
    const gap = px * 0.17

    ctx.strokeStyle = withAlpha(BRASS_LIT, 0.12 + glow * 0.72)
    ctx.lineWidth = Math.max(1.5, px * 0.09)
    ctx.lineCap = "round"
    for (const dy of [-gap, gap]) {
      ctx.beginPath()
      ctx.moveTo(cx - half, cy + dy)
      ctx.lineTo(cx + half, cy + dy)
      ctx.stroke()
    }
    if (call === "toss") {
      ctx.beginPath()
      ctx.moveTo(cx - half * 0.5, cy + gap * 2.2)
      ctx.lineTo(cx + half * 0.5, cy - gap * 2.2)
      ctx.stroke()
    }
  }

  /**
   * THE GHOST — the second teacher, and the one that only exists until it is not
   * needed.
   *
   * A hollow copy of the slate drifts towards the `=`, fades, then towards the
   * `≠`, and fades. It shows the two MOVES and never the answer: a ghost that
   * leaned the way the current statement ought to go would be the game answering
   * the round, and the learner model would take the credit for it.
   *
   * `hint.ts` decides whether there is one at all — there is not, after the child's
   * first correct call, or while a finger is down, or before they have hesitated.
   */
  private drawGhost(hint: Hint | null): void {
    if (!hint || hint.alpha <= 0.001) return
    const { ctx } = this
    const { slate, chute, bag } = this.street
    const reach =
      hint.call === "keep" ? (bag.y - (slate.y + slate.h)) * 0.62 : -(slate.y - (chute.y + chute.h)) * 0.62
    const dy = reach * hint.drift
    ctx.save()
    ctx.globalAlpha = hint.alpha * 0.7
    ctx.strokeStyle = withAlpha(BRASS_LIT, 0.8)
    ctx.lineWidth = 2
    ctx.strokeRect(slate.x + 6, slate.y + dy + 6, slate.w - 12, slate.h - 12)
    ctx.restore()
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
   * A WRONG VERDICT REGAINS NO LIGHT, and that has not changed even though a miss
   * now shows the child something. The street stays exactly as dim as the window
   * left it; the completed sum carries its own legibility because it is drawn in
   * `ACCENT` rather than in chalk. A lapse is the same: nothing brightens for a
   * window nobody touched, and nothing dims either.
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
   *   raise    up out of the dust, blank
   *   clear    away — DOWNWARD into the hoard if you kept it, UPWARD out of frame
   *            if you threw it. `exitOf` owns that sign, so the rule lives with the
   *            outcomes rather than in the renderer.
   *   call     following the finger through `drag.ts`'s curve, with a tilt.
   */
  private slateBox(state: SceneState): {
    x: number
    y: number
    w: number
    h: number
    a: number
    tilt: number
    dragging: boolean
  } {
    // Where the slate stands is `street.ts`'s business — inside the safe area and
    // clear of the host's corners.
    const { x, y, w, h } = this.street.slate

    let drop = 0
    let a = 1
    let tilt = 0
    let dragging = false
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
      drop = followOffset(state.drag.dy, this.commit)
      tilt = tiltFor(state.drag.dy, this.commit, state.reduced)
      dragging = true
    }
    return { x, y: y + drop, w, h, a, tilt, dragging }
  }

  private drawSlate(state: SceneState): void {
    const { ctx } = this
    const box = this.slateBox(state)
    if (box.a <= 0.001) return
    const lit = this.litness(state)

    // The echoes go down first, so the slate itself is always the solid thing.
    if (box.dragging && state.drag) {
      const echoes = trailFor(state.drag.dy, this.commit, state.reduced)
      for (const echo of echoes) {
        ctx.strokeStyle = withAlpha(BRASS_LIT, echo.alpha)
        ctx.lineWidth = 1.25
        ctx.strokeRect(box.x + 2, box.y + echo.back + 2, box.w - 4, box.h - 4)
      }
    }

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
    // as a machined edge rather than as a border. Under a committing finger the
    // outer rule takes the destination's own light: the card knows where it is going.
    const pull = box.dragging && state.drag ? magnetism(state.drag.dy, this.commit) : 0
    ctx.strokeStyle = mix(mix(BRASS_DIM, BRASS_LIT, lit), BRASS_LIT, pull)
    ctx.lineWidth = 2 + pull * 1.2
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

  /**
   * The verdict currently on the slate, resolved to something drawable.
   *
   * A verdict frame with no flourish on it — a resume, a re-render, a host that
   * paused across the settle — falls back rather than showing nothing.
   */
  private flourishOf(state: SceneState): Flourish | null {
    if (state.phase !== "verdict" && state.phase !== "clear") return null
    if (state.outcome === null) return null
    if (state.flourish && state.flourish.outcome === state.outcome) return state.flourish
    return defaultFlourish(state.outcome)
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

    const flourish = this.flourishOf(state)
    const spotting = state.outcome === "spot" && flourish !== null
    const missing = state.outcome !== null && isMiss(state.outcome) && flourish !== null
    const correcting = spotting || missing
    const correction = correcting ? correctionFor(l, statement.claimed, statement.answer) : null

    // ── the two clocks the reveal can run on ──────────────────────────────
    //
    // A SPOT starts a beat into the caller's bow: the street acknowledges the child
    // first, and only then does the slate admit it was wrong.
    //
    // A MISS starts immediately and finishes inside `REVEAL_SHARE` of the verdict,
    // because the remainder is the HOLD — the seconds the completed sum stands
    // still and is read. That is the entire point of the miss reveal and it is why
    // the miss beat is the longest non-celebratory one in `round.ts`.
    const phaseT = state.phase === "verdict" ? state.progress : 1
    const rollT = spotting
      ? clamp01((phaseT - 0.2) / 0.45)
      : missing
        ? clamp01(phaseT / REVEAL_SHARE)
        : 0

    // A miss completes the sum in the ACCENT. Never red, and there is no red in the
    // palette to reach for. A spot keeps the cold chalk: it is a celebration, and
    // the celebration's own colour is the light, not the ink.
    const chalk = mix(CHALK_UNLIT, CHALK_LIT, lit)
    const truth = missing ? ACCENT : chalk
    // Every alpha below is set *from* this rather than multiplied into the context.
    // A running `*=` / `/=` pair looks equivalent and is not: at the end of the
    // cross-fade the multiplier is zero, the division cannot undo it, and everything
    // drawn afterwards — including the corrected numeral the fade exists to reveal —
    // is drawn fully transparent.
    const base = ctx.globalAlpha

    // "recut" always cross-fades the whole statement, even when the columns would
    // have rolled. That is what makes it a different animation and not a re-skin.
    const recut = missing && flourish?.kind === "recut"
    const canRoll = correction !== null && correction.canRoll && !recut
    // "drop" inverts the wheel: the true value falls in from above while the claim
    // slides out below it.
    const rollDir = flourish?.kind === "drop" ? -1 : 1

    /**
     * ── THE WHOLE LINE CROSS-FADES, NOT JUST THE CLAIM ────────────────────
     *
     * The trap, and it shipped: `715 + 620 = 335` and `715 + 620 = 1335` are
     * different WIDTHS, so they are centred at different origins. Fading out only
     * the claimed value and drawing the corrected statement over it therefore
     * draws the shared prefix TWICE, at two x positions a few pixels apart, both
     * fully opaque — a doubled, unreadable smear exactly where the child is
     * supposed to read the answer. It was invisible while both halves were the
     * same chalk grey and became obvious the moment the truth was drawn in the
     * accent.
     *
     * So when there is no column to roll, the ENTIRE statement dissolves and the
     * entire corrected one is cut in AFTER it — sequentially, not on top of it.
     * A true cross-fade of two differently-centred lines is legible at neither end
     * and a doubled ghost in the middle, which is what the founder was looking at.
     * The two envelopes overlap by a tenth, where both are under 0.2 alpha, so it
     * does not read as a blink.
     */
    const dissolving = correction !== null && !canRoll && rollT > 0
    const outT = 1 - clamp01(rollT / 0.5)
    const inT = clamp01((rollT - 0.45) / 0.55)
    const corrected = dissolving ? this.faceFor(box, `${statement.expression} = ${statement.answer}`) : null
    const correctedX = corrected ? box.x + (box.w - corrected.layout.width) / 2 : originX

    for (let i = 0; i < l.cells.length; i++) {
      const cell = l.cells[i]
      if (!cell) continue
      const rolling = canRoll ? correction?.rolls.find((r) => r.index === i) : undefined
      const inClaim = correction !== null && i >= correction.start

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
          truth,
          rollDir,
        )
        continue
      }
      if (dissolving) {
        if (outT <= 0.001) continue
        ctx.globalAlpha = base * outT
        this.glyph(cell.ch, cell.x + originX, baseY, cell.w, inClaim ? CHALK_WRONG : chalk)
        ctx.globalAlpha = base
        continue
      }
      this.glyph(cell.ch, cell.x + originX, baseY, cell.w, missing && rollT > 0 ? truth : chalk)
    }

    if (corrected && inT > 0.001) {
      ctx.globalAlpha = base * inT
      for (const cell of corrected.layout.cells) {
        this.glyph(cell.ch, cell.x + correctedX, baseY, cell.w, truth)
      }
      ctx.globalAlpha = base
    }

    // The rule under a completed sum: the accent saying "this is the number", and
    // the only mark a miss ever puts on the slate. It is drawn under whichever
    // line is arriving, so it cannot be a hair wider or narrower than the sum.
    // It rides in with whichever envelope the truth is arriving on, so it never
    // underlines a line that has not been cut in yet.
    const ruleT = dissolving ? inT : rollT
    if (missing && ruleT > 0.001) {
      const full = corrected?.layout.width ?? l.width
      const width = full * (state.reduced ? 1 : easeOut(ruleT))
      const ruleY = baseY + px * 0.32
      ctx.strokeStyle = withAlpha(ACCENT, 0.28 + 0.42 * ruleT)
      ctx.lineWidth = Math.max(1.5, px * 0.05)
      ctx.beginPath()
      ctx.moveTo(correctedX, ruleY)
      ctx.lineTo(correctedX + width, ruleY)
      ctx.stroke()
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
   * The correction: a wrong digit rolls out of its cell and the right one rolls in
   * behind it, like a counter wheel. It is clipped to the cell, so the statement
   * never reflows and nothing moves outside the recess.
   *
   * `dir` is `+1` for the wheel (the claim rides up, the truth arrives from below)
   * and `-1` for the drop (the truth falls in from above). Two of the three miss
   * variants are that one sign.
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
    dir: number,
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
    this.glyph(from, x, baseY - dir * e * px * 1.25, cellW, CHALK_WRONG)
    this.glyph(to, x, baseY + dir * (1 - e) * px * 1.25, cellW, colour)
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

  // ── the celebrations ────────────────────────────────────────────────────

  /**
   * ONE OF FOUR, on a correct call, and never on anything else.
   *
   * This is the whole of the founder's "make the animations captivating", and the
   * reason it is four rather than one is his sentence before it: the same reward
   * twenty times running stops being a reward. `flourish.ts` draws which, from the
   * run's seeded RNG, and never the same one twice in a row.
   *
   * Reduced motion keeps every element and takes away the travel — the elements
   * stand at their final positions and fade. A branch, not a deletion: a child who
   * needs reduced motion still gets told they were right.
   */
  private drawCelebration(state: SceneState): void {
    const flourish = this.flourishOf(state)
    if (!flourish || state.outcome === null || !isCorrect(state.outcome)) return
    const { ctx } = this
    const t = clamp01(state.phase === "verdict" ? state.progress : 1)
    const e = state.reduced ? 1 : easeOut(t)
    // A single envelope for every variant, so no two celebrations disagree about
    // when the moment is over.
    const fade = state.reduced ? 1 - t : Math.sin(Math.PI * clamp01(t)) ** 0.6
    if (fade <= 0.001) return
    const { slate } = this.street
    const cx = slate.x + slate.w / 2
    const cy = slate.y + slate.h / 2
    const spin = flourish.spin

    switch (flourish.kind) {
      case "rays":
        this.rays(cx, cy, slate, e, fade, spin)
        break
      case "shower":
        this.shower(cx, cy, e, fade, spin)
        break
      case "bloom":
        this.bloom(e, fade, spin)
        break
      default:
        this.rings(cx, cy, slate, e, fade, spin)
        break
    }

    // Common to all four: the frame takes the light. It is what ties the variants
    // together as one game's celebration rather than four unrelated effects.
    ctx.strokeStyle = withAlpha(BRASS_LIT, 0.5 * fade)
    ctx.lineWidth = 2 + 2 * fade
    ctx.strokeRect(slate.x - 2, slate.y - 2, slate.w + 4, slate.h + 4)
    ctx.strokeStyle = withAlpha(CHALK_LIT, 0.22 * fade)
    ctx.lineWidth = 1
    ctx.strokeRect(slate.x - 6, slate.y - 6, slate.w + 12, slate.h + 12)
  }

  /** Rings of brass leaving the slate, with a scatter of sparks inside them. */
  private rings(cx: number, cy: number, slate: { w: number }, e: number, fade: number, spin: number): void {
    const { ctx } = this
    const reach = slate.w * 0.9
    for (let i = 0; i < 5; i++) {
      const lag = clamp01((e - i * 0.09) / 0.8)
      if (lag <= 0) continue
      const r = Math.max(1, slate.w * 0.18 + reach * lag)
      ctx.strokeStyle = withAlpha(BRASS_LIT, 0.4 * fade * (1 - lag))
      ctx.lineWidth = 2.5 * (1 - lag) + 0.5
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = withAlpha(CHALK_LIT, 0.16 * fade * (1 - lag))
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2)
      ctx.stroke()
    }
    this.sparks(cx, cy, e, fade, spin, 12, slate.w * 0.7)
  }

  /** Spokes of cold light: the slate was lit from behind for a moment. */
  private rays(cx: number, cy: number, slate: { w: number }, e: number, fade: number, spin: number): void {
    const { ctx } = this
    const n = 14
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 + spin * Math.PI * 2
      const inner = slate.w * (0.2 + 0.5 * e)
      const outer = inner + slate.w * 0.3 * (1 - e * 0.5) * (0.6 + jitter(i, spin) * 0.8)
      ctx.strokeStyle = withAlpha(i % 2 === 0 ? BRASS_LIT : CHALK_LIT, 0.34 * fade)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner)
      ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer)
      ctx.stroke()
    }
    this.sparks(cx, cy, e, fade, spin, 8, slate.w * 0.55)
  }

  /** A handful of coins lofted over the top of the hoard, arriving late. */
  private shower(cx: number, cy: number, e: number, fade: number, spin: number): void {
    const { ctx } = this
    const { bag } = this.street
    const to = { x: bag.x + bag.w / 2, y: bag.y + bag.h * 0.4 }
    const r = Math.max(2, bag.w * 0.04)
    for (let i = 0; i < 14; i++) {
      const lag = clamp01((e - i * 0.035) / 0.75)
      if (lag <= 0) continue
      const lane = (jitter(i, spin) - 0.5) * 2
      const x = cx + (to.x - cx) * lag + lane * bag.w * 0.9 * (1 - lag)
      // A real arc: up first, then down into the hoard.
      const y = cy + (to.y - cy) * lag - Math.sin(Math.PI * lag) * bag.h * 0.9
      ctx.fillStyle = withAlpha(BRASS_LIT, 0.8 * fade * (1 - lag * 0.3))
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    for (let i = 0; i < 6; i++) {
      const lag = clamp01((e - i * 0.1) / 0.7)
      if (lag <= 0) continue
      ctx.strokeStyle = withAlpha(BRASS_LIT, 0.3 * fade * (1 - lag))
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(to.x, to.y, bag.w * 0.3 * lag, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  /** The lamps in the haze flare and motes rise off the crowd. */
  private bloom(e: number, fade: number, spin: number): void {
    const { ctx } = this
    const horizon = this.street.horizon
    for (let i = 0; i < 18; i++) {
      const lag = clamp01((e - jitter(i, spin) * 0.3) / 0.8)
      if (lag <= 0) continue
      const x = this.w * (0.06 + jitter(i, spin + 1) * 0.88)
      const y = horizon - this.h * 0.22 * lag + this.h * 0.02 * jitter(i, spin + 2)
      ctx.fillStyle = withAlpha(i % 3 === 0 ? CHALK_LIT : BRASS_LIT, 0.55 * fade * (1 - lag))
      ctx.beginPath()
      ctx.arc(x, y, Math.max(1, this.h * 0.004 * (1 - lag * 0.5)), 0, Math.PI * 2)
      ctx.fill()
    }
    for (let i = 0; i < 4; i++) {
      const lag = clamp01((e - i * 0.12) / 0.7)
      if (lag <= 0) continue
      ctx.strokeStyle = withAlpha(BRASS_LIT, 0.22 * fade * (1 - lag))
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, horizon - this.h * 0.05 * lag)
      ctx.lineTo(this.w, horizon - this.h * 0.05 * lag)
      ctx.stroke()
    }
  }

  private sparks(
    cx: number,
    cy: number,
    e: number,
    fade: number,
    spin: number,
    n: number,
    reach: number,
  ): void {
    const { ctx } = this
    for (let i = 0; i < n; i++) {
      const angle = jitter(i, spin) * Math.PI * 2
      const d = reach * (0.3 + jitter(i, spin + 3) * 0.7) * e
      ctx.fillStyle = withAlpha(BRASS_LIT, 0.6 * fade)
      ctx.beginPath()
      ctx.arc(cx + Math.cos(angle) * d, cy + Math.sin(angle) * d, Math.max(1, reach * 0.02), 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // ── the ledger ──────────────────────────────────────────────────────────

  /**
   * The run, over. One numeral: the hoard.
   *
   * There is no percentage here and there never will be. A child shown "50%" reads
   * a passing grade; a child shown a pile of coins reads a pile of coins.
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
   * THE HOARD, locked to the bottom of the glass. The keep pile, the coin count,
   * and the score — the only number on the street during play.
   *
   * It is a PILE now rather than a bag: one card edge per correct call, stacking up
   * out of the bottom of the frame. The founder asked for the keep pile to be at
   * the bottom of the screen and this is what is at the bottom of it.
   *
   * The coins in flight are most of the feedback for a wrong verdict: coins come
   * back out of the hoard and go, and the slate finishes the sum. Nothing flashes
   * red, nothing buzzes, and `energy.ts` holds that line.
   */
  private drawHoard(state: SceneState): void {
    if (state.phase === "idle") return
    const { ctx } = this
    const { bag, lipY, countY, pileY, cardH } = this.street
    const cx = bag.x + bag.w / 2

    // The pile. One edge per correct call, up to a dozen — a stack a child can see
    // getting taller without it ever needing a number to say so.
    const cards = Math.min(CARDS_MAX, state.run.calls)
    const step = Math.max(cardH * 1.15, (bag.y + bag.h - pileY) / CARDS_MAX)
    for (let i = 0; i < cards; i++) {
      const y = bag.y + bag.h - step * (i + 1)
      const inset = bag.w * 0.06 * (i / CARDS_MAX)
      ctx.strokeStyle = withAlpha(BRASS, 0.24 + 0.4 * (i / CARDS_MAX))
      ctx.lineWidth = 1
      ctx.strokeRect(bag.x + inset, y, bag.w - inset * 2, cardH)
    }

    // The lip of the pile: a straight brass rule the cards land on.
    ctx.strokeStyle = withAlpha(BRASS_DIM, 0.55)
    ctx.lineWidth = 1.25
    ctx.beginPath()
    ctx.moveTo(bag.x + bag.w * 0.06, lipY)
    ctx.lineTo(bag.x + bag.w * 0.94, lipY)
    ctx.stroke()

    // The count. Brass, on the pile, and it is the score.
    ctx.font = `${String(this.street.bagPx)}px ${SLATE_FONT}`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = withAlpha(BRASS_LIT, state.run.bag > 0 ? 0.9 : 0.34)
    ctx.fillText(String(state.run.bag), cx, countY)

    this.drawCoins(state)
  }

  /**
   * Coins in flight, during the verdict only.
   *
   * Into the hoard when the call was right, out of it and away when it was wrong.
   * The count is the size of the call, so a fast correct keep visibly pays more than
   * a slow one — the speed bonus is a thing a child can SEE rather than a number
   * they are told.
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
        // Out of the hoard and away downwards, off the bottom of the frame.
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
 * How many coins a loss shows leaving the hoard.
 *
 * Fixed, and fewer than the smallest win puts in — see `drawCoins`.
 */
const COINS_OUT = 2

/**
 * The tallest the keep pile ever gets.
 *
 * It stops growing rather than shrinking the cards, because a pile that rescaled
 * itself would be a pile that looks the same after two calls as after forty — and
 * the whole reason it is a pile is that a child can see it getting taller.
 */
const CARDS_MAX = 12
