/**
 * The progression, and what drives it.
 *
 * ## The currency is gone
 *
 * This file used to hold an idle-game economy: `ventRate`, `assayPayout`,
 * `flowAfter`, `ventCost`, `growCost`, `upwellCost`, an essence counter, a
 * per-second readout and a multiplier pill. The founder played it for hours:
 *
 *   "the top is sort of useless too .. the score number doesn't even show, the
 *    4.7M/sec, the essence, the flowx2 .. none of that even really makes sense or
 *    seems to do anything"
 *
 * He was right about all three, and about the two that *did* do something the
 * answer was that what they did was not worth the glass. Written out, because
 * deleting a subsystem should be argued rather than announced:
 *
 *   * **flow** (`×2 FLOW`) multiplied a payout of a currency with nothing to buy
 *     that a child could feel, and its only visible behaviour was to *reset on a
 *     wrong answer* — a penalty wearing a reward's clothes. Deleted outright.
 *   * **the rate** (`▲ 4.7M / sec`) was real: it was the essence accrual, and the
 *     offline haul was computed from it. Nobody can act on it. Deleted.
 *   * **essence** was real too — it priced UPWELL, AWAKEN, DEEPEN and OVERCHARGE,
 *     and its order of magnitude drove both the polyp size band and how bright
 *     the water was. So the two things it genuinely drove are kept and rehomed
 *     onto **DEPTH**, which is the number of targets the child has bloomed. That
 *     is a count of maths done, it needs no readout to be legible (the reef gets
 *     brighter and the shelf gets bigger), and it cannot be farmed by idling.
 *
 * Of the four purchases: AWAKEN bought a second vent, which is the thing being
 * deleted; OVERCHARGE bought a bigger number; UPWELL bought polyps the vent now
 * emits toward the target anyway; and DEEPEN bought board space the founder asked
 * for outright ("more room for a bigger board could be pretty nice"), so it is
 * now **earned by blooming** rather than bought. DISSOLVE was already free and
 * stays free — it is the escape hatch, and a child who cannot afford the way out
 * of a stuck board has been handed a losing position.
 *
 * Pure. No time source, no randomness, no rendering.
 */

import { FORMS, type Form } from './target.ts'

/* ------------------------------------------------------------------- depth */

/**
 * How many blooms until the shelf grows one more file.
 *
 * Five is often enough that a child sees it happen inside a first session and
 * rare enough that it stays an event. Growth is capped by what the glass can draw
 * legibly — see `render/renderer.ts`, `shelfCap` — so this is a pace, not a
 * promise.
 */
export const GROW_EVERY = 5

/** How many times the shelf should have grown by `depth` blooms. */
export function growthsAt(depth: number): number {
  return Math.max(0, Math.floor(depth / GROW_EVERY))
}

/**
 * The base rung new polyps arrive on, from depth.
 *
 * At bloom one a child merges 1s and 5s; forty blooms in they are merging 96s and
 * 448s. The arithmetic gets harder because the *world* got bigger, which is the
 * only difficulty ramp that never reads as punishment.
 */
export function baseStepFor(depth: number): number {
  return Math.max(0, Math.min(9, Math.floor(depth / 6)))
}

/**
 * How bright the world is, 0..1. Drives the whole escalation: the abyss starts
 * near black and ends as a blazing reef.
 */
export function bloomLevel(depth: number): number {
  return Math.max(0, Math.min(1, depth / 45))
}

/**
 * Which operator forms are unlocked at `depth`.
 *
 * The escalation the founder asked for, in the order the curriculum teaches it —
 * and a form is only ever *offered*, never forced: `target.ts` refuses a form the
 * number cannot express, so a child who has unlocked division still sees a plain
 * `18` whenever eighteen has no clean division route.
 */
export const FORM_UNLOCK: Readonly<Record<Form, number>> = {
  sum: 0,
  minus: 10,
  times: 22,
  over: 34,
}

export function formsAt(depth: number): Form[] {
  return FORMS.filter((f) => depth >= FORM_UNLOCK[f])
}

/** How many polyps a `sum` target may be built from. Two, then three. */
export function sumSlotsAt(depth: number): number {
  return depth < 6 ? 2 : 3
}

/* --------------------------------------------------------------- difficulty */

/**
 * What to ask the host for, on the 1..10 ladder-index scale it already reads
 * from this pack (see `toUnit` in `packs/shared/game-host`).
 *
 * Depth is the only input, because depth counts targets the child actually
 * bloomed. It climbs one rung every four blooms and stops at 10.
 */
export function difficultyAt(depth: number): number {
  return Math.max(1, Math.min(DIFFICULTY_CAP, 1 + Math.floor(depth / 8)))
}

/**
 * The rungs an operator form is asked BELOW the plain one, and why that is not a
 * dodge.
 *
 * A target is answered with polyps, so the size of the *number on the band* and the
 * size of the *polyps that make it* are not the same thing, and which way they
 * differ depends entirely on the operator:
 *
 *     18  = 16 + 2       the polyps are about as big as the target
 *     15  = 16 − 1       the same
 *     48  = 8 × 6        the polyps are much SMALLER than the target
 *     15  = 30 ÷ 2       the polyps are much BIGGER than the target
 *
 * So asking the host for a four-figure number and then dressing it as a division
 * would demand a five-figure dividend off a shelf that has none, and asking for one
 * and dressing it as a product would hand a child two two-digit factors and call it
 * hard. The offsets keep the *polyps* in the band the depth intends, which is where
 * the child's work actually is.
 *
 * It is also what makes the rare forms appear at all. Measured over 2..3000, only
 * 74 integers admit a division route and they are almost all small; with no offset
 * the first run put `over` at 0.0% of 3,580 targets and then 0.3% of 5,336 — a form
 * a child never meets is a form that was not built.
 */
export const FORM_RUNGS: Readonly<Record<Form, number>> = { sum: 0, minus: 0, times: 2, over: 3 }

/** What to ask the host for, given the form the game wants to dress it in. */
export function difficultyFor(depth: number, form: Form): number {
  return Math.max(1, difficultyAt(depth) - FORM_RUNGS[form])
}

/** The ceiling for that request. Same rule as `maxDifficultyAt`, same reason. */
export function maxDifficultyFor(depth: number, form: Form): number {
  return Math.max(2, Math.min(DIFFICULTY_CAP, difficultyFor(depth, form) + 1))
}

/**
 * The rung this game stops asking above, and why it is not 10.
 *
 * Measured, over the eight-strain ladder, for how many integers in a band are a
 * sum of at most three polyp values:
 *
 *        1..2,000   100.0%
 *    2,000..5,000    96.8%
 *    5,000..10,000   81.4%
 *   10,000..20,000   62.5%
 *   20,000..60,000   39.7%
 *
 * So a target above a few thousand is a target this board mostly cannot build,
 * and the founder's `58042 + 968` sits in the 39.7% band. **This game declines
 * the top of the curriculum's ladder rather than putting up numbers it cannot
 * honour** — a stated limitation, not an accident, and the honest one: the
 * alternative is what shipped.
 *
 * Difficulty for the child does not come from magnitude anyway. `1024 = 512 +
 * 512` is trivial and `987 = 768 + 208 + 11` is not; the work is in the
 * decomposition and in the operator form, and both of those keep escalating well
 * past this rung.
 */
export const DIFFICULTY_CAP = 7

/**
 * The ceiling, on the same scale.
 *
 * One rung above the request so the host still has room to serve a spread, and
 * never above `DIFFICULTY_CAP` — see the note there for the measurement it comes
 * from. The ceiling used to be `CAP + 1`, which is rung 8, whose operands are four
 * digits each: that let five-figure targets through at 0.1% of asks, and a
 * five-figure target is the exact thing the founder photographed.
 */
export function maxDifficultyAt(depth: number): number {
  return Math.max(2, Math.min(DIFFICULTY_CAP, difficultyAt(depth) + 1))
}

/**
 * How many digits a target should have at this depth, for the candidate score.
 * One digit at the start, four by the time the ceiling is reached.
 */
export function wantDigitsAt(depth: number): number {
  return Math.max(1, Math.min(4, 1 + Math.floor(depth / 12)))
}

/* ---------------------------------------------------------------- emissions */

/**
 * How often the reef coughs a polyp onto the shelf, in ms.
 *
 * Faster as the reef deepens, floored at 1.4 s so the shelf never fills faster
 * than a child can merge.
 */
export function emitPeriodMs(depth: number): number {
  return Math.max(1400, Math.round(4200 - depth * 60))
}

/**
 * How fast the reef coughs out the polyps it OWES — the halves that make the
 * current target buildable.
 *
 * Deliberately much faster than the ordinary cadence, because a target the shelf
 * cannot yet answer is a target the child is waiting on. Measured on the first
 * shipped build of this design, 41.5% of targets went up needing stocking; at the
 * ordinary 4.2 s cadence a four-polyp debt is seventeen seconds of a child looking
 * at a number they cannot make, which reads exactly like the old vents did — "it's
 * easier just to ignore the vents".
 *
 * At 320 ms the same debt is settled in about a second, and what is left is the
 * part that should take time: the merging.
 */
export const STOCK_PERIOD_MS = 320

/**
 * How many polyps a bloom throws onto the shelf.
 *
 * This is the reward that is *material*: more life to merge. It replaces a payout
 * in a currency nobody could spend.
 */
export function bloomYield(depth: number): number {
  return Math.min(7, 3 + Math.floor(depth / 8))
}

/* ------------------------------------------------------------------ offline */

/** Eight hours. Past this the reef stops growing, so nobody feels obliged. */
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000
/** Below this, nothing happened. Coming back after ten seconds must not nag. */
export const OFFLINE_MIN_MS = 45 * 1000

/**
 * How many polyps grew on the shelf while the tablet was shut.
 *
 * The pack is called `merge-idle` and its whole subject is a reef that keeps going
 * while you are away, so the away time is still paid — but it is paid in
 * **polyps**, not in a number, and it is collected by *being there*. There is no
 * gate, no card and no question on the way back in.
 *
 * The old return path was a modal with a prompt and four answer pills — the second
 * game on the same screen, arriving before the child had touched anything. Gone.
 */
/**
 * The most polyps a return can ever be worth: about half a big shelf.
 *
 * A hard cap, not a rate. Without one, eight hours came out at 1,371 polyps — a
 * number a test caught before a child did, and which the shelf would have silently
 * thrown most of away. What a return should feel like is "the reef grew while I was
 * gone", and half a shelf of new life says that; a thousand emissions into a
 * seventy-cell board says nothing at all.
 */
export const OFFLINE_MAX_POLYPS = 40

export function offlineGrowth(elapsedMs: number, depth: number): number {
  if (elapsedMs < OFFLINE_MIN_MS) return 0
  const ms = Math.min(elapsedMs, OFFLINE_CAP_MS)
  const period = emitPeriodMs(depth)
  // Away time runs at a twelfth of the rate the reef runs at while it is watched,
  // and stops at the cap. A gift, not a strategy.
  return Math.max(1, Math.min(OFFLINE_MAX_POLYPS, Math.floor(ms / (period * 12))))
}
