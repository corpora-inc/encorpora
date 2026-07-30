// What a question costs, what it pays, and how long the child gets.
//
// This used to be five constants and three `if`s scattered through a 2,000-line
// `mount.ts`, which is why nothing noticed that they added up to a game where
// **the winning move was to never answer**:
//
//   * a wrong lantern cost a lamp;
//   * a timeout cost nothing but a point of favour;
//   * and the window was 4.2 s, of which 0.42 s is spent under the read-lock, so
//     3.78 s of it was usable — against this repo's own 6 s p50 for the exact
//     skill `pack.json` declares.
//
// A child who read the equation honestly could not finish inside the window, and
// a child who guessed to beat the window lost a lamp three times in four. The
// only strategy that never lost anything was to let every sigil expire. The
// pressure did not make the game harder. It made the maths optional.
//
// Everything that decides that is in this file, it is pure, and
// `economy.test.ts` plays bots against it.

import { SECOND_GRADE_FLOW, revealMs } from "../../../../packs/shared/game-pacing/index.ts"

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

/**
 * How long the lanterns hang, in seconds.
 *
 * p90 for the item's class **plus** the read-lock, so that the time a child can
 * actually act in is never less than the time the repo measured them needing. It
 * was `4.2 + (difficulty − 1) × 0.2`, which topped out at 6 s gross for the
 * hardest item the pack covers — against a 40 s p90.
 */
export function moteSecondsFor(difficulty: number): number {
  return usableAnswerSeconds(difficulty) + CANDIDATE_READ_LOCK_MS / 1000
}

/**
 * The part of the window a child can actually cut in, and the number the fleet
 * invariant is quoted against. Derived first, so no float rounding can shave a
 * millisecond off the p90 on its way back out of `moteSecondsFor`.
 */
export function usableAnswerSeconds(difficulty: number): number {
  return comprehensionP90Ms(difficulty) / 1000
}

// ── what an answer is worth, and what it costs ──────────────────────────────

export type Verdict = "correct" | "wrong" | "timeout"

export const FAVOUR_MAX = 4
export const FAVOUR_SECONDS = 9
/** Sigils read to buy a lamp back. Cumulative, never consecutive. */
export const READ_PER_LAMP = 2
export const LAMPS = 3

/**
 * Lamps a verdict costs. **Zero, for all three.**
 *
 * This is the fix, and it is a subtraction rather than an addition. The rule the
 * audit set is that a timeout may never cost *less* than an honest wrong answer,
 * because the moment it does, not-answering strictly dominates answering and the
 * arithmetic becomes optional. There are two ways to satisfy that and only one
 * of them is allowed: taking a lamp on a timeout punishes a child for still
 * thinking, which is the one thing this product does not do. So the wrong answer
 * gives its lamp up instead.
 *
 * A wrong lantern still costs the whole economy — favour drops to one, and
 * favour multiplies *everything*, every gourd and every prime and every cascade.
 * That was always the real deterrent to guessing; the lamp was a second, harsher
 * one stacked on top of it, and it was the reason a rational child never
 * answered at all. Lamps are now spent on bombs, which are the one hazard a
 * child chooses to touch.
 */
export function lampCost(verdict: Verdict): number {
  void verdict
  return 0
}

/**
 * Favour after a verdict.
 *
 * Correct climbs. **A wrong answer falls all the way to one. A timeout costs
 * nothing at all.**
 *
 * This is a reversal of the line that used to be here, and the reasoning it
 * replaces was sound about the wrong thing. The rule the audit set was "a
 * timeout may never cost *less* than an honest wrong answer", because a timeout
 * that is cheaper than a guess makes not-answering the dominant strategy. That
 * was satisfied here by sending both verdicts to one — and the price of it was
 * that a child who was still thinking was charged the same as a child who was
 * wrong. THE SPLIT then flashed the answer past them and moved on. A timeout is
 * not a wrong answer; it is the sound of a child working.
 *
 * The rule is kept, but it is kept where it belongs: in `marketHushSeconds`. A
 * timeout forfeits the **whole window** of market a child who answers hands
 * straight back — thirteen seconds at difficulty five, forty at ten — and market
 * time is where nearly all of the score comes from. Refusing is still strictly
 * dominated, at every difficulty and at every price a second of slicing could
 * be worth; `economy.test.ts` plays the bots that prove it, including one that
 * banks favour to the ceiling and then refuses on purpose.
 *
 * So a timeout costs the window, not the score. Nothing about being slow takes
 * anything away from the child.
 */
export function favourAfter(verdict: Verdict, favour: number): number {
  if (verdict === "correct") return Math.min(FAVOUR_MAX, favour + 1)
  if (verdict === "timeout") return favour
  return 1
}

/**
 * Whether a verdict is evidence about the child, fit to send to the ladder.
 *
 * A timeout is not. A child who was still computing is not a child who does not
 * know the skill, and the ladder is the one place that mistake compounds: it
 * would feed them easier items, which is exactly the wrong medicine for somebody
 * who is merely deliberate. The game still charges the timeout — see
 * `marketHushSeconds` — it just does not lie to the curriculum about it.
 */
export function reportsToCurriculum(verdict: Verdict): boolean {
  return verdict !== "timeout"
}

/** What a correct lantern pays, before the favour wave doubles it. */
export function answerGain(difficulty: number, mult: number): number {
  return Math.round((320 + difficulty * 110) * mult)
}

/**
 * How long the market stays hushed for, given a verdict at `answeredAtSeconds`.
 *
 * **This is where a timeout costs more than a wrong answer.**
 *
 * The market holds its breath for as long as a question is live — see
 * `Director.quiet`, which is now genuinely quiet — so the hush ends when the
 * question is settled, however it is settled. A child who answers, right or
 * wrong, hands the market back at the moment they cut. A child who lets the
 * sigil expire hands it back at the end of the window, and everything they could
 * have been slicing in between is gone.
 *
 * So the cost ordering is: correct (short hush, plus favour, plus the wave) <
 * wrong (short hush, favour gone) < timeout (the entire window, favour gone).
 * Never-answering is strictly dominated, and nothing in that chain punishes a
 * slow child — the time a deliberate child spends is time they are using.
 */
export function marketHushSeconds(
  verdict: Verdict,
  difficulty: number,
  answeredAtSeconds: number,
): number {
  const window = moteSecondsFor(difficulty)
  if (verdict === "timeout") return window
  return Math.max(0, Math.min(window, answeredAtSeconds))
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
 * Where the child is between the calm end and the top, 0…1, from the favour they
 * were carrying when the question settled.
 *
 * **Favour and not elapsed time.** The obvious signal was `Director.heat`, THE
 * SPLIT's own escalation curve, and it is the wrong one: heat is a stopwatch. It
 * reaches half its range about twenty-five seconds into a run, so a child who was
 * still struggling in minute five would have been handed the same nine-tenths of
 * a second the game already gave them, and the patient reveal would have existed
 * only for the first twenty seconds anybody ever played. Measured, in
 * `marinate.test.ts`'s own table, before it was changed.
 *
 * Favour is the one thing in this game that says something about the child rather
 * than about the clock: it climbs one rung per correct answer and drops to one on
 * a wrong one. So the top is a player who has just answered four in a row and
 * slipped on the fifth — blowing past the sum is the reward for that — and the
 * calm end is everybody else, at any point in any run, for as long as they need
 * it.
 */
export function revealIntensity(favour: number): number {
  const f = Math.max(1, Math.min(FAVOUR_MAX, favour))
  return (f - 1) / (FAVOUR_MAX - 1)
}

/**
 * How long the completed sum stays up, given `revealIntensity`.
 *
 * Not this game's curve: `packs/shared/game-pacing`'s, the one ARENA and THE
 * GAVEL already spend — `revealCalmMs × (1 − intensity)²`, patient at the calm
 * end and skipped at the top, "because being held for it would be a punishment
 * for being good".
 *
 * It is a **cap on a screen nobody is touching**, not a hold. The child's very
 * next stroke takes it down, and the next sigil going live clears it outright, so
 * nothing here can hold a fast player for a moment. "There is no reason to be
 * like WRONG and then just rush past the lesson/content — let the kid marinate on
 * it and dismiss it or answer or move on in their own time."
 */
export function revealDwellSeconds(intensity: number): number {
  return Math.max(REVEAL_MIN_SECONDS, revealMs(SECOND_GRADE_FLOW, intensity) / 1000)
}
