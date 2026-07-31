/**
 * THE FLOW CONTROLLER.
 *
 * One number — `intensity`, in [0,1] — drives a Dynawalla game's maths
 * difficulty AND its pace AND its density, together, in BOTH directions. That
 * coupling is the design, not an implementation convenience. A child who is
 * struggling with 11 + 16 is not helped by easier questions arriving in the
 * same crowded, fast world; they are helped by the whole game breathing out.
 * And a child who is crushing double digits should feel the world lean in as
 * the numbers grow, all at once, so the escalation reads as one thing.
 *
 * The founder's statement of it:
 *
 *   "it should naturally shrink back down when you get something wrong ... and
 *    get more sparse and slow .. so if someone gets up to 11+16 and is
 *    struggling, it should go back down all the way to 2+3 and friends ... if
 *    they are just crushing double digits for a nice little while then the
 *    triple digits come in. it should expand and contract the difficulty and
 *    speed smoothly"
 *
 * Five properties follow, and every one of them is asserted in `flow.test.ts`:
 *
 *   1. **Asymmetric, but not crudely so.** It drops on a single failure and
 *      climbs on sustained success — and the CLIMB RATE SCALES WITH THE
 *      STRENGTH OF THE EVIDENCE. "Falls fast, climbs slow" was the first
 *      formulation and it is wrong: everybody, adult included, starts at the
 *      very bottom of the ladder, and an adult made to walk every rung from
 *      `0 + 1` quits before the third question. So somebody answering correctly
 *      AND fast climbs steeply, several rungs if warranted; somebody answering
 *      correctly but slowly holds roughly steady, which is precisely where you
 *      want them; and somebody getting it wrong drops immediately.
 *
 *   2. **Time-aware.** Correctness alone cannot tell mastery from effort. The
 *      separating signal is how long the answer took, so `observe` takes it.
 *      A game that cannot measure latency may omit it and gets the conservative
 *      reading — correct-but-slow — which costs a slower climb and nothing else.
 *
 *   3. **Smoothed.** The controller steers on a moving estimate of recent
 *      outcomes, never on the last answer alone. A per-answer flip oscillates,
 *      and an oscillating difficulty reads to a child as the game being
 *      arbitrary rather than as the game being alive.
 *
 *   4. **Silent.** There is nothing here to render. No level number, no banner,
 *      no "that was too hard for you". A child must never be able to read the
 *      controller's opinion of them, which is why this module has no strings in
 *      it at all and never will.
 *
 *   5. **Bounded, with a trivial floor.** The floor is genuinely `0 + 1`. That
 *      is not condescending, because the dignity comes from the celebration and
 *      from the visible climb, not from making the easy end harder — so the
 *      floor stays calm and sparse, and the climb does the work.
 *
 * Pure functions over plain numbers. The GAME owns the two pieces of state
 * (`intensity` and `success`); this module only ever computes the next value.
 * That keeps a sixty-times-a-second call path allocation-free and makes every
 * transition trivially testable.
 *
 * ---------------------------------------------------------------------------
 * THE LATENCY CONTRACT — read this before passing `seconds` to `observe`.
 * ---------------------------------------------------------------------------
 *
 * `seconds` is THINKING time:
 *
 *     it STARTS when the child can first read the question and act on it
 *     it ENDS at the moment they commit to an answer
 *     nothing else belongs in it
 *
 * Not when the question object was created. Not when an opening animation
 * began. Not when a projectile landed, a card finished flipping, a token
 * finished travelling, or a result finished settling.
 *
 * This is a contract rather than a suggestion because the controller separates
 * "already knew it" from "worked it out" on this number alone, and those two
 * want opposite things from the world. Contamination here is SYSTEMATIC, not
 * noisy: it does not average out, it looks like a perfectly plausible number,
 * and its effect is to quietly refuse to promote exactly the children who
 * answered fastest. Two games in this catalogue were found charging children
 * for animation they could not have answered inside — one for 0.55 s of an
 * opening ramp, one for 2-3 seconds of a boulder's flight.
 *
 * If a game's act of answering unavoidably contains travel or animation, take
 * it out of `seconds` before calling this, and leave it in whatever the game
 * reports to its Host. What the Host wants is the honest observable; what this
 * wants is deliberation.
 *
 * And use a clock the SIMULATION owns, not the wall clock, or a seeded run
 * stops reproducing on a slower machine.
 */

import { clamp01, uncurved, valueAt, type Curve } from "./curve.ts"

export type FlowSpec = {
  /** The calmest the world may ever get. A real destination, not a limit case. */
  floor: number
  /** The hardest the world may ever get. */
  ceiling: number
  /** Where a fresh run starts. Near the floor: the opening is earned, not granted. */
  start: number
  /**
   * Seconds to travel the whole range floor -> ceiling at the SLOWEST climb —
   * the one a player earns by being right without being quick.
   */
  climbSeconds: number
  /**
   * How much faster the climb goes when the target is far above where the world
   * currently is, which is what strong evidence looks like from here.
   *
   * The rate is `(span / climbSeconds) * (1 + climbBoost * gap)`, so a player
   * who has just proved they belong several rungs up is carried there in tens
   * of seconds, and the last stretch — where the gap is small — eases in. This
   * is the single constant that decides whether an adult is trapped at the
   * bottom of the ladder.
   */
  climbBoost: number
  /**
   * Seconds at or under which a correct answer is STRONG evidence of mastery.
   * Anything this fast scores a full 1.
   */
  briskSeconds: number
  /**
   * Seconds at or over which a correct answer is WEAK evidence — the child is
   * working, and working is the point. Scores `laboredScore`.
   */
  laboredSeconds: number
  /**
   * What a correct-but-slow answer is worth. Chosen so a run of them converges
   * to the middle of the ladder rather than to either end.
   */
  laboredScore: number
  /**
   * Seconds of unbroken struggle to travel ceiling -> floor.
   * Much shorter than `climbSeconds`. Relief is not something to be earned.
   */
  fallSeconds: number
  /**
   * Answers the success estimate is effectively drawn from. Larger is smoother
   * and slower to react; smaller is twitchier. Three is deliberately short —
   * long enough that no single answer decides the world, short enough that
   * three quick correct answers are allowed to say something.
   */
  window: number
  /**
   * How long a completed answer is held in front of a player at the FLOOR,
   * in milliseconds.
   *
   * At the bottom of the range this is the channel that is working. A player
   * who is not producing answers is still absorbing numerals, symbols and the
   * shape of an equation resolving, and that exposure is a real mechanism
   * rather than a consolation — the founder: "if the game is calmly showing
   * them the answer in a pleasing way, with tons of patience, the youngster
   * might really start picking stuff up like wild". Patience is the feature.
   */
  revealCalmMs: number
  /**
   * …and at the CEILING. Zero, meaning skipped.
   *
   * The same reveal is an obstacle at the top: somebody blowing through at
   * speed does not want to be held for a patient explanation of a sum they
   * already know. Skipping it is itself a reward for mastery.
   */
  revealFullMs: number
  /** At or below this success rate the controller steers all the way to the floor. */
  strugglingBelow: number
  /** At or above this success rate it steers all the way to the ceiling. */
  thrivingAbove: number
  /** How demand is distributed across the success rate between those two marks. */
  curve: Curve
}

/**
 * The recommended shape, and the one ARENA uses.
 *
 * The three timing constants are calibrated against the curriculum rather than
 * guessed. `dw.ns.compare.whole-numbers` publishes `fluencyTarget.p50Ms: 9000`
 * — nine seconds is the median a fluent child is expected to take — so nine
 * seconds must score in the MIDDLE, and it does: it lands at 0.70, which
 * `demandFor` maps to the middle of the ladder. Three seconds is unambiguously
 * "already knew it"; twelve is unambiguously "worked it out".
 *
 * `settle` because both ends of the range want a soft approach: a world that
 * snaps to its floor is as jarring as one that snaps to its ceiling.
 */
export const SECOND_GRADE_FLOW: FlowSpec = {
  floor: 0,
  ceiling: 1,
  start: 0.04,
  climbSeconds: 300,
  climbBoost: 14,
  fallSeconds: 50,
  briskSeconds: 3,
  laboredSeconds: 12,
  laboredScore: 0.55,
  revealCalmMs: 4200,
  revealFullMs: 0,
  window: 3,
  strugglingBelow: 0.55,
  thrivingAbove: 0.85,
  curve: "settle",
}

/**
 * How quick an answer was, 0 (laboured or slower) to 1 (brisk or faster).
 *
 * **This is a reward signal, never a penalty one, and the distinction is the
 * whole design.** A countdown that kills you and a bonus that accrues when you
 * are fast read the same clock and produce opposite emotional experiences. The
 * founder's rule: "we can usually measure, pace and reward, not cause anxiety".
 * So a game spends this on multipliers, on richer celebration, on loot — on
 * things a fast player GAINS — and never on a window a slow player LOSES.
 *
 * A game that cannot measure latency gets 0, which costs a bonus and nothing
 * else.
 */
export function quickness(spec: FlowSpec, seconds?: number): number {
  if (seconds === undefined || !Number.isFinite(seconds)) return 0
  const brisk = spec.briskSeconds
  const labored = spec.laboredSeconds
  if (!(labored > brisk)) return seconds <= brisk ? 1 : 0
  return clamp01((labored - seconds) / (labored - brisk))
}

/**
 * What one answer is worth as evidence, in [0,1].
 *
 * Wrong is zero, however fast. Correct is worth at LEAST `laboredScore`
 * however slow — a correct answer is a correct answer, and taking four minutes
 * over it can knock a player back a little but can never make it worthless.
 * Above that floor it walks to 1 as the answer gets quicker, which is the only
 * way the controller can tell "already knew it" from "worked it out", and those
 * two want opposite things from the world.
 *
 * `seconds` may be omitted by a game that cannot measure it. That reads as the
 * slow case on purpose: the conservative direction is the one that keeps a
 * player in the range they are demonstrably succeeding in.
 */
export function outcomeScore(spec: FlowSpec, correct: boolean, seconds?: number): number {
  if (!correct) return 0
  if (seconds === undefined || !Number.isFinite(seconds)) return clamp01(spec.laboredScore)
  const q = quickness(spec, seconds)
  return clamp01(spec.laboredScore + (1 - spec.laboredScore) * q)
}

/**
 * The success estimate after one more outcome.
 *
 * An exponential moving average with `1/window` as its weight, which is the
 * cheapest thing that is genuinely a moving estimate: no ring buffer for the
 * caller to own and no allocation. A window of three is deliberately short —
 * long enough that no single answer decides the world, short enough that three
 * quick correct answers are allowed to say something.
 */
export function observe(spec: FlowSpec, success: number, correct: boolean, seconds?: number): number {
  const w = Math.max(1, spec.window)
  const k = 1 / w
  const prev = clamp01(success)
  return clamp01(prev + (outcomeScore(spec, correct, seconds) - prev) * k)
}

/**
 * Where the controller WANTS intensity to be, given the success estimate.
 *
 * Flat at the floor at or below `strugglingBelow`, flat at the ceiling at or
 * above `thrivingAbove`, and shaped by `curve` between them. The flats matter:
 * a child at 30% correct and a child at 45% correct both need the same thing,
 * which is the easiest world the game has.
 */
export function demandFor(spec: FlowSpec, success: number): number {
  const lo = spec.strugglingBelow
  const hi = spec.thrivingAbove
  const s = clamp01(success)
  if (hi <= lo) return s >= hi ? spec.ceiling : spec.floor
  const u = clamp01((s - lo) / (hi - lo))
  // `uncurved` rather than `curved`, and the direction is the point: it makes
  // the LOW end of the success range spend more of the intensity range, so
  // pulling out of a struggle is felt immediately while the last stretch to the
  // ceiling stays something to earn.
  return spec.floor + (spec.ceiling - spec.floor) * uncurved(u, spec.curve)
}

/**
 * How long to hold a completed answer in front of the player, in milliseconds.
 *
 * The last thing that touches a player and was still a constant. It rides the
 * same scalar as everything else, and it rides it BACKWARDS: long, calm and
 * generous at the floor; brief or skipped at the ceiling.
 *
 * `steep` is deliberate. It keeps the reveal near its full length only for the
 * bottom of the range and sheds it quickly thereafter, so patience is spent
 * where it teaches and nowhere else.
 *
 * The reveal is a REVEAL, not a lesson: the finished equation, shown the way
 * you would celebrate one and merely quieter. It may never read as correction.
 * There is no string in this module to make it read as anything.
 */
export function revealMs(spec: FlowSpec, intensity: number): number {
  return Math.max(0, valueAt(clamp01(intensity), spec.revealCalmMs, spec.revealFullMs, "steep"))
}

/** Is the reveal worth showing at all at this intensity? */
export function revealShown(spec: FlowSpec, intensity: number): boolean {
  return revealMs(spec, intensity) >= 250
}

/**
 * How long a reveal must be up before ANY input may take it down, in ms.
 *
 * Not pedagogy — latency. A reveal is put up by the same gesture that ended the
 * question, and on a touch screen that gesture is routinely still arriving: a
 * second tap of an impatient double-tap, a finger that had already committed to
 * the next key. Without a floor those taps land inside the reveal's own fade-in
 * and the child sees the lesson appear and vanish in the same breath, which is
 * precisely the report this constant exists to answer — "the answers flashed for
 * a second and then go on".
 *
 * Deliberately SHORT. It is a lockout, and a long lockout is its own rudeness:
 * "dismiss it or answer or move on in their own time" means the child's hand
 * wins, and this only makes sure the hand meant it. Long enough to outlast a
 * reveal's fade-in (THE GAVEL's is 260 ms) and a double-tap, and no longer.
 */
export const REVEAL_SETTLE_MS = 350

/**
 * What a game should do with a reveal it has just put up.
 *
 * See `revealPlan`. Two independent facts, because they were being conflated by
 * a single duration everywhere in the fleet.
 */
export type RevealPlan = {
  /** Whether there is a reveal at all. False is mastery, not neglect. */
  readonly shown: boolean
  /** Milliseconds before the child's own input may take it down. */
  readonly settleMs: number
  /**
   * Milliseconds after which the reveal takes ITSELF down.
   *
   * `Number.POSITIVE_INFINITY` whenever it is shown: nothing but the child ends
   * a reveal. Zero when it is not shown, so the game moves on in the same frame.
   */
  readonly holdMs: number
}

/**
 * The reveal, as a plan rather than as a number.
 *
 * **A shown reveal never expires.** `revealMs` says how much patience this
 * intensity deserves, and every game in the fleet spent that answer as a
 * countdown — hold the finished sum for 1050 ms, or 900, or 850, then take it
 * away whether or not anybody had finished reading. That is the defect: a child
 * who has just been told they are wrong is the slowest reader in the session,
 * and a timer sized for a fluent one removes the evidence exactly when it was
 * about to be useful. The founder: "let the user marinate on the displayed
 * answers and never rush through", and "you should be able to study the answers
 * and then go on, not just have the answers flashed for a second and then go
 * on". "Then go on" is the child's own hand, and a hand needs no deadline.
 *
 * **The adaptation survives, on the same scalar, inverted — it just moved from
 * the length to the existence.** `revealShown` already draws the line at
 * 250 ms, below which the module's own view is that the reveal is not worth
 * putting up; above intensity ≈0.75 the plan is therefore no reveal at all and
 * an immediate move on. Skipping the ceremony is still the reward for mastery.
 * What has gone is the middle: the half-patient reveal that was long enough to
 * be noticed and too short to be read, which served nobody at either end.
 *
 * **Games decide WHEN to ask for one, and should not ask after a clean win.**
 * There is nothing to marinate on in a sum you just got right, and a reveal on
 * every item would turn a flowing game into a queue of dismissals. This is for
 * the miss, the fold, and the timeout — "there is no reason to be like WRONG and
 * then just rush past the lesson/content".
 */
export function revealPlan(spec: FlowSpec, intensity: number): RevealPlan {
  if (!revealShown(spec, intensity)) return { shown: false, settleMs: 0, holdMs: 0 }
  return { shown: true, settleMs: REVEAL_SETTLE_MS, holdMs: Number.POSITIVE_INFINITY }
}

/**
 * The success estimate that would demand a given intensity.
 *
 * The inverse of `demandFor`, and it exists so a fresh run can be seeded
 * consistently: a game starting at `spec.start` sets `success = seedSuccess(
 * spec)` and the controller is immediately at rest rather than lurching on the
 * first frame toward a target its own state disagrees with.
 */
export function seedSuccess(spec: FlowSpec, intensity = spec.start): number {
  const span = spec.ceiling - spec.floor
  if (span <= 0) return spec.thrivingAbove
  const v = clamp01((intensity - spec.floor) / span)
  // `uncurved` was applied in `demandFor`, so `curved` undoes it.
  const u = v <= 0 ? 0 : v >= 1 ? 1 : curvedInverse(v, spec.curve)
  return spec.strugglingBelow + (spec.thrivingAbove - spec.strugglingBelow) * u
}

/** Local, so `flow.ts` does not export a second name for `curved`. */
function curvedInverse(v: number, curve: Curve): number {
  switch (curve) {
    case "linear":
      return v
    case "gentle":
      return v * v
    case "steep":
      return 1 - (1 - v) * (1 - v)
    case "settle":
      return v * v * (3 - 2 * v)
  }
}

/**
 * Intensity after `dt` seconds of moving toward what `success` demands.
 *
 * Falling is LINEAR in time, on purpose: "fifty seconds to the floor" is then a
 * real, testable number rather than a half-life that never quite arrives, and
 * relief is the half of this that must be predictable.
 *
 * Climbing is GAP-SCALED. The rate is
 *
 *     (span / climbSeconds) * (1 + climbBoost * gap)
 *
 * where `gap` is how far above the current world the target sits, as a fraction
 * of the range. A player who has just demonstrated they belong near the top is
 * carried most of the way in tens of seconds and then eases in; a player
 * holding steady one rung up walks. That is the whole difference between a
 * ladder an adult can leave and a ladder an adult is trapped on.
 *
 * Never overshoots the target, and is clamped into `[floor, ceiling]` whatever
 * it is handed.
 */
export function settle(spec: FlowSpec, intensity: number, success: number, dt: number): number {
  const lo = Math.min(spec.floor, spec.ceiling)
  const hi = Math.max(spec.floor, spec.ceiling)
  const cur = Number.isFinite(intensity) ? Math.min(hi, Math.max(lo, intensity)) : spec.start
  if (!Number.isFinite(dt) || dt <= 0) return cur

  const target = Math.min(hi, Math.max(lo, demandFor(spec, success)))
  const span = hi - lo
  if (span <= 0) return lo

  if (target > cur) {
    if (!(spec.climbSeconds > 0)) return target
    const gap = (target - cur) / span
    const rate = (span / spec.climbSeconds) * (1 + Math.max(0, spec.climbBoost) * gap)
    return Math.min(target, cur + rate * dt)
  }
  if (!(spec.fallSeconds > 0)) return target
  return Math.max(target, cur - (span / spec.fallSeconds) * dt)
}

/**
 * Seconds for `settle` to carry intensity from `from` to `to`, holding the
 * success estimate wherever it has to be to demand `to`.
 *
 * Integrated rather than divided, because the climb rate is not constant. Only
 * for tests and design notes — nothing on a frame path calls it — but it is the
 * honest way to state a claim like "an adult answering fast leaves the bottom
 * of the ladder inside a minute", because it is derived from the same constants
 * the controller actually uses rather than from a comment.
 */
export function secondsBetween(spec: FlowSpec, from: number, to: number): number {
  const span = Math.abs(spec.ceiling - spec.floor)
  if (span <= 0) return 0
  if (to <= from) return ((from - to) / span) * spec.fallSeconds
  const dt = 1 / 120
  let t = 0
  let x = from
  // The rate falls as the gap closes, so the last sliver is asymptotic. Stop at
  // a thousandth of the range, which is far finer than any rung.
  while (x < to - span * 1e-3 && t < spec.climbSeconds * 20) {
    const gap = (to - x) / span
    x += (span / spec.climbSeconds) * (1 + Math.max(0, spec.climbBoost) * gap) * dt
    t += dt
  }
  return t
}
