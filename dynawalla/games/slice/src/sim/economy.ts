// What an order pays, what a mistake costs, and how long a completed sum is
// held. Pure; `economy.test.ts` plays bots against it.
//
// ── THERE IS NO CLOCK ON ANY ARITHMETIC IN THIS GAME ────────────────────────
//
// The three functions that used to be the centre of this file — `moteSecondsFor`,
// `usableAnswerSeconds` and `marketHushSeconds` — are gone, and they were not
// tuned away, they were designed away. They sized an answering WINDOW, and the
// whole of MATH NINJA's arithmetic layer now has nothing to put a window on:
//
//   * the standing order never expires. The child holds it for as long as they
//     want, and unlimited thinking time is delivered by the generator RE-OFFERING
//     a needed numeral (`Director`'s offer invariant) rather than by a long
//     timer. Timers are the root cause `PACING_AUDIT_2026-07.md` found seventeen
//     times over, and a timer that is merely generous is still a timer;
//   * the bomb gate is the one modal question in the game and it has no timer of
//     any kind. Not a long one — none. The child has already stopped moving.
//
// So the cadence table below survives for one honest purpose: sizing how long a
// completed sum is HELD, which is a floor on the child's reading time rather
// than a ceiling on their thinking time. It is still monotone non-decreasing in
// difficulty, which is still the fleet invariant.

import {
  SECOND_GRADE_FLOW,
  revealMs,
  revealShown,
} from "../../../../packs/shared/game-pacing/index.ts"

/**
 * `EXPERIENCE_DESIGN.md`'s cadence table, in milliseconds. Instrumented p50/p90,
 * never shown to the child.
 */
export const CADENCE = {
  /** `7 × 8`. */
  fact: { p50: 2800, p90: 6000 },
  /** `47 + 25`, carry and all — the middle of what `pack.json` declares. */
  regroup: { p50: 6000, p90: 14000 },
  /** `5,001 − 2,798` — `dw.add.regroup.subtract-across-zero`, also declared. */
  wide: { p50: 16000, p90: 40000 },
} as const

const ANCHORS = [CADENCE.fact, CADENCE.regroup, CADENCE.wide] as const

/**
 * A candidate cannot be cut for this long after it is hoisted.
 *
 * It exists so the stroke that opens the tablet cannot also answer the question,
 * and it is real time the child does not have. Every window below is quoted
 * gross and *usable*, and the invariant is on the usable one.
 */
export const CANDIDATE_READ_LOCK_MS = 420

/** Host difficulty runs 1…10. */
export const MIN_DIFFICULTY = 1
export const MAX_DIFFICULTY = 10

/**
 * Where an item of this difficulty sits on the cadence table's axis, 1…3.
 *
 * Strictly non-decreasing in `difficulty`, which is what makes every window
 * derived from it non-decreasing too — the fleet invariant. A harder item may
 * never get less time than an easier one.
 */
export function comprehensionLoad(difficulty: number): number {
  const d = Math.max(MIN_DIFFICULTY, Math.min(MAX_DIFFICULTY, difficulty))
  return 1 + ((d - MIN_DIFFICULTY) / (MAX_DIFFICULTY - MIN_DIFFICULTY)) * 2
}

function interpolate(load: number, key: "p50" | "p90"): number {
  const clamped = Math.max(1, Math.min(3, load))
  const lo = Math.min(1, Math.max(0, Math.ceil(clamped) - 2))
  const t = clamped - (lo + 1)
  const a = ANCHORS[lo] ?? CADENCE.fact
  const b = ANCHORS[lo + 1] ?? CADENCE.wide
  return a[key] + (b[key] - a[key]) * t
}

/** Half the class is done by here. This is the beat, not the window. */
export function comprehensionP50Ms(difficulty: number): number {
  return interpolate(comprehensionLoad(difficulty), "p50")
}

/** Nine in ten are done by here. This is what a window has to be. */
export function comprehensionP90Ms(difficulty: number): number {
  return interpolate(comprehensionLoad(difficulty), "p90")
}

// ── verdicts ───────────────────────────────────────────────────────────────

/**
 * What happened.
 *
 * `fill` — an order completed. `overshoot` — the one miss in the game: a value
 * cut that is larger than the residual. There is no third verdict any more:
 * `timeout` is gone because nothing in MATH NINJA can time out.
 */
export type Verdict = "fill" | "overshoot"

export const FAVOUR_MAX = 4
export const FAVOUR_SECONDS = 9
export const LAMPS = 3

/**
 * Lamps a verdict costs. **Zero, for both.**
 *
 * A lamp is spent by exactly one thing: cutting a bomb, which is the one hazard
 * a child *chooses* to touch — and even then the gate hands it straight back for
 * a correct answer. Nothing about arithmetic may cost a life, and nothing about
 * being slow may cost anything at all.
 */
export function lampCost(verdict: Verdict): number {
  void verdict
  return 0
}

/**
 * Favour after a verdict. A fill climbs; an overshoot falls all the way to one.
 *
 * Favour multiplies everything, so an overshoot is still the most expensive
 * thing a child can do — and it costs no lamp, no points already banked and no
 * progress they had made. §4.8's distinction, which is the whole product:
 * mashing becomes a *bad* strategy without ever becoming a *punished* one.
 */
export function favourAfter(verdict: Verdict, favour: number): number {
  if (verdict === "fill") return Math.min(FAVOUR_MAX, favour + 1)
  return 1
}

/**
 * Whether a verdict is evidence about the child, fit to send to the ladder.
 *
 * Both are. What is NOT is a fruit that fell uncut — the same argument that used
 * to exempt a timeout: a numeral the child let go past is not a claim about
 * anything, and the mount never reports one.
 */
export function reportsToCurriculum(verdict: Verdict): boolean {
  void verdict
  return true
}

// ── what an order is worth ─────────────────────────────────────────────────

/**
 * What FILLING an order pays, before combo and favour multiply it.
 *
 * **Score comes from one source only: advancing or filling an order.** Not from
 * cutting. That single rule does most of the anti-mash work in this game,
 * because it converts mashing from *punished* — which the product's principles
 * forbid — into *worthless*, which is the only sanction this product is allowed
 * to apply. A cut that does not advance the order pays nothing at all, and there
 * is no volume of swiping that adds up to a number.
 *
 * The old build paid `10 + value * 0.9` per prime and `3 + value * 0.16` per
 * composite, unconditionally, which is why a pure-guesser bot scored 31,208
 * against a skilled bot's 31,190 over the same seventy seconds.
 */
export function orderValue(target: number): number {
  return Math.round(120 + Math.sqrt(Math.max(1, target)) * 60)
}

/** What one helpful cut pays on the way. Small — the fill is the event. */
export function advanceValue(target: number): number {
  return Math.round(orderValue(target) * 0.12)
}

/**
 * Filling in exactly three cuts is the founder's mock — `__ + __ + ___ = 33` —
 * and it is paid as an INCENTIVE rather than enforced as a constraint, which is
 * the house style. The elastic tail means a child is never told how many parts
 * to use; this is what makes three worth aiming at anyway.
 */
export const TIDY_CUTS = 3

export function tidyBonus(target: number, cuts: number): number {
  return cuts === TIDY_CUTS ? Math.round(orderValue(target) * 0.5) : 0
}

// ── the marinate beat ───────────────────────────────────────────────────────

/**
 * The shortest the completed sum may be held, in seconds.
 *
 * `revealMs` goes to zero at the ceiling, and zero would tear the sum off the
 * screen in the same frame it was drawn. THE GAVEL's `MIN_REVEAL_MS`, for the
 * same reason: the floor is the length of the beat, not a lesson.
 */
export const REVEAL_MIN_SECONDS = 0.9

/** Seconds the reveal takes to leave, once its dwell is up or it is dismissed. */
export const REVEAL_FADE_SECONDS = 0.45

/**
 * How long the completed sum stays up, given the flow controller's intensity.
 *
 * Not this game's curve: `packs/shared/game-pacing`'s, the one ARENA and THE
 * GAVEL already spend — `revealCalmMs × (1 − intensity)²`, patient at the calm
 * end and brief at the top, "because being held for it would be a punishment for
 * being good".
 *
 * **Intensity, not a stopwatch and no longer a proxy.** This used to ride
 * `revealIntensity(favour)`, which was itself a stand-in for the evidence signal
 * this game did not have. It has one now: `intensity` is the shared flow
 * controller's, computed out of orders filled and overshoots made, so the
 * patient version reaches exactly the children who are working and the brief one
 * exactly the children who are not.
 */
export function revealDwellSeconds(intensity: number): number {
  return Math.max(REVEAL_MIN_SECONDS, revealMs(SECOND_GRADE_FLOW, intensity) / 1000)
}

/**
 * How long the market is HELD while the completed sum is on screen, in seconds.
 *
 * `games/stack`'s rule, and the doctrine this whole batch is held to: **never
 * aim at one thing while reading another.** `stack/src/game/sim.ts:234` is the
 * reference — `holdLeft = Math.max(holdMs(floor)/1000, revealLeft)`. Here the
 * hold is `Director.quiet`, which already stops the market outright.
 *
 * Zero above the point the shared curve says the reveal is not worth showing at
 * all — skipping it is the reward for mastery, and it is what makes the top of
 * the spectrum feel like world-championship Fruit Ninja. A stroke ends the hold
 * early at every intensity, so a fast player is never held even when it is on.
 */
export function revealHoldSeconds(intensity: number): number {
  if (!revealShown(SECOND_GRADE_FLOW, intensity)) return 0
  return revealDwellSeconds(intensity)
}

/**
 * How long the BOMB GATE's completed sum is held, in seconds.
 *
 * The gate is the one modal question in the game and it has no timer; this is
 * the other end of the same beat — a floor on reading time rather than a ceiling
 * on thinking time. A harder item is held longer, which keeps the fleet's
 * monotone-non-decreasing invariant on the one function that still consults the
 * cadence table. Capped at six seconds because the child has just lost a lamp
 * and being sat still is not the lesson, and dismissible by a stroke regardless.
 */
export function gateHoldSeconds(difficulty: number, intensity: number): number {
  const patient = Math.min(6, comprehensionP50Ms(difficulty) / 1000)
  return Math.max(REVEAL_MIN_SECONDS, Math.max(patient, revealHoldSeconds(intensity)))
}
