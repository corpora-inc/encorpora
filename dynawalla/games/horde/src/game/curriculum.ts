/**
 * What the swarm is allowed to ask, and what the host is told about it.
 *
 * Every question in DEEPSWARM — the CORE orbs, the sealed CACHE at level-up, the
 * RIFT you charge to come back — goes through here, and nothing else in the game
 * calls `host.next` or `host.report`. That is the point of the file: the two
 * decisions below were previously spread across three call sites and both of
 * them were wrong in the same way.
 *
 * ── Escalation is on demonstrated success, never on survival ─────────────────
 *
 * The old rule was `1 + floor(runT / 88)`: one step harder every eighty-eight
 * seconds of *being alive*. A child who missed every single orb still met
 * three-digit addition at minute eleven, purely for not dying — and the counters
 * that would have caught it (`correct`, `asked`) were already being kept and
 * already being printed on the game-over panel. The signal existed and was
 * ignored.
 *
 * So the ladder is climbed with right answers and nothing else. Two solved
 * questions earn one step. A run that answers nothing correctly stays on step 1
 * forever, however long it lasts, which is the whole fix: a child who is not
 * getting them right is never handed harder arithmetic as a reward for
 * surviving. This matches every well-paced game in the fleet — STACK on floors
 * built, SIEGE on waves cleared, SERPENT on eats, SPLITBEAT on gate outcome —
 * and `dynawalla/docs/EXPERIENCE_DESIGN.md`: *"Escalation is on difficulty and
 * repair, never run length."*
 *
 * ── A non-answer is not a wrong answer ──────────────────────────────────────
 *
 * When the CORE closes on its own, the old code reported
 * `{ correct: false, ms: 8500, answered: "" }`. The host does not keep the
 * game's opinion of `correct` — it records the *response* — so an empty
 * response was filed as an attempt the child got wrong. A child who knew the
 * answer and was slow with their hands became, in the record, a child who does
 * not know the skill.
 *
 * The `Host` contract this game mounts against
 * (`dynawalla/packs/shared/game-host/index.ts`) offers exactly one way to say
 * anything about a question: `report`, which forwards to `items.answer`. There
 * is no "unanswered" flag on it, and `items.skip` — which the SDK does have —
 * is not exposed on the game-facing `Host`. So the only truthful thing this
 * game can do with a timeout is *say nothing*, and that is what `expired` does.
 * An unreported item is simply an item the child was served and never answered,
 * which is what happened.
 *
 * ── The thinking window grows with the arithmetic ───────────────────────────
 *
 * `COMPREHENSION — not budgeted. The child's time. Measured, never limited.`
 * The CORE cannot literally be unlimited — it is a hole in a swarm, not a
 * worksheet — but the window must at least not shrink as the sums get harder.
 * It widens instead, and it is always at or above the p90 cadence target for
 * the class of problem being asked (6 s single-digit, 14 s two-digit with
 * regrouping).
 *
 * ── One rung is not a curriculum ────────────────────────────────────────────
 *
 * From a founder playtest: *"more variable questions for the rift, they are all
 * like 2-digit plus 2-digit without carrying? I think we could have some single
 * and triple digit (adapting to user level) and some carrying .. and why not
 * subtraction, multiplication and division sometimes."*
 *
 * He is describing the symptom of asking for exactly one number, on a scale too
 * coarse to say anything else. The host does not take an operation — `domain`
 * on `next()` is a cosmetic label and the host's own comment says so. What
 * decides whether a child sees `7 + 8`, `284 + 157` or `6 × 7` is WHERE ON THE
 * LADDER the question is drawn from.
 *
 * ── Sixty rungs, ten of them addressable ────────────────────────────────────
 *
 * The shipped ladder is 60 rungs (18 active skills at up to four levels each,
 * multiplication and division live since PR #683, the bottom reaching `0 + 1`
 * since PR #655). This game spoke the host's *integer* scale, where 1 is the
 * bottom and 10 the top and `toUnit` maps a value `v >= 1` to `(v - 1) / 9`.
 * Ten integers across fifty-nine rungs is a stride of 6.5, so the ten rungs
 * DEEPSWARM could name were:
 *
 *      1 -> 0  add-within-ten L0        6 -> 33 divide-exact L0
 *      2 -> 7  subtract-within-ten L3   7 -> 39 zero-in-the-quotient L0
 *      3 -> 13 add-across-ten L2        8 -> 46 times-two-digit L1
 *      4 -> 20 tables-within-five L3    9 -> 52 subtract-short-subtrahend L1
 *      5 -> 26 subtract-no-regroup L2  10 -> 59 subtract-across-zero L2
 *
 * and the other fifty were unreachable BY CONSTRUCTION. Both easy levels of
 * `column.add-no-regroup`, every level of `regroup.add-multidigit` — the whole
 * of carrying — and `times-one-digit` are in that gap. A nine-minute run climbs
 * about five of these steps, so a child met five questions' worth of the
 * curriculum and met them over and over. Measured over 600 simulated runs
 * against the real `ladder()`: **9 of 60 rungs and 9 of 18 skills, ever.**
 *
 * So the game now speaks the FRACTION scale — `toUnit` reads `v < 1` as a
 * position on the ladder, used as is — which makes all sixty rungs addressable,
 * and asks across a BAND rather than at a point:
 *
 *   - `difficulty()` is unchanged and still means what PR #656 made it mean:
 *     the step this run has EARNED, `1 + floor(solved / 2)`, moved by right
 *     answers and by nothing else. `edgeUnit()` is that step as a ladder
 *     position, and it is the top of the band.
 *   - `askUnit()` is where one question comes from: the edge, less a few
 *     LADDER rungs. Six rungs is about one old step, so the band is narrow in
 *     absolute terms and wide in the only sense that matters — it contains the
 *     rungs that were skipped.
 *   - The band is DOWNWARD only, and `maxDifficulty` pins the ceiling at the
 *     host too. That is the same promise as before, stated once: nothing a
 *     child has not demonstrated is ever served, so a run that answers nothing
 *     right stays at the bottom however long it survives.
 *
 * Same 600 runs, after: **46 of 60 rungs and 17 of 18 skills**, with carrying,
 * multiplication and division all present, and the distinct rungs a single run
 * serves up from 5.8 to 9.6.
 *
 * ── And it comes back down ──────────────────────────────────────────────────
 *
 * *"adapting up and down"* — the ladder above only went up. A run that earned
 * rung 7 and then started missing kept being asked rung-7 questions, which is
 * the moment a child puts a tablet down. `RECENT_WINDOW` recent answers are
 * kept, and each recent MISS drops the band one further rung for the next
 * question. Three misses in a row and the sums get visibly easier within one
 * question; get them right again and the window refills and the band comes
 * back. The earned ceiling itself never falls, so recovery is immediate rather
 * than something that has to be re-earned.
 *
 * This is the game's own record and not `host.recentOutcomes()`, deliberately:
 * the host's verdict is authoritative but arrives after a round trip, and this
 * decision is made synchronously inside a `requestAnimationFrame` the moment an
 * orb is struck. The two agree except in the window where the host has not
 * answered yet.
 */

import type { Host, Question } from "../contract.ts"

/** The host ladder this game asks against. */
export const MIN_DIFFICULTY = 1
export const MAX_DIFFICULTY = 10

/** Right answers needed per step up the ladder. */
export const SOLVES_PER_STEP = 2

/**
 * Rungs above the bottom of the host's ladder.
 *
 * Read off the shipped active graph (60 rungs; `dynawalla-app/src/packs/items.ts`
 * `ladder()`). The game is not authoritative about it and does not need to be:
 * it is used only to size the band in rungs, so a curriculum that grows makes
 * this game's band proportionally narrower and never makes it wrong.
 */
export const LADDER_SPAN = 59

/** One ladder rung, as a fraction of the whole ladder. */
const RUNG = 1 / LADDER_SPAN

/**
 * The top of the fraction scale.
 *
 * Strictly below 1, because `toUnit` reads `1` as the BOTTOM of the integer
 * scale rather than the top of the fraction scale — the one ambiguous value in
 * the host's contract, and it is documented to resolve the way that would send
 * a struggling child the hardest content in the product. Half a rung under 1
 * still rounds to the top rung.
 */
const UNIT_TOP = 1 - 1 / (2 * LADDER_SPAN)

/**
 * How many LADDER rungs below the edge a question may be drawn from.
 *
 * Six, because six rungs is roughly one step of the old integer scale — so the
 * band is about as wide as the gap the old scale used to jump over, which is
 * exactly the content that was unreachable.
 */
export const SPREAD_RUNGS = 6

/** Rungs the band comes down for each miss inside the recent window. */
export const MISS_RUNGS = 4

/** Rungs at which the miss-drop stops. */
export const MAX_DROP_RUNGS = 16

/**
 * How far down the band may ever reach, as a fraction of the edge's own height.
 *
 * Without this the band is the wrong shape at the bottom of the ladder: a child
 * at rung 6 with two recent misses is asked for rung −2, which clamps to `0 + 1`
 * — and measured, 36% of every early run collapsed onto that single rung. A
 * descent of half the height scales at every height, so a run at rung 33 can
 * fall to 16 and a run at rung 6 falls to 3.
 */
const DESCENT_CEILING = 0.5

/** Recent answers kept, for deciding whether the band should come down. */
export const RECENT_WINDOW = 5

/** Seconds on the clock at step 1 — the p90 for a single-digit fact, plus room. */
export const BASE_THINKING_SECONDS = 8.5

/** Extra seconds granted for every step up the ladder. */
export const THINKING_SECONDS_PER_STEP = 1.2

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)

export type Report = { questionId: string; correct: boolean; ms: number; answered: string }

/**
 * The run's arithmetic ledger. One per run; `reset()` starts a new one.
 *
 * `asked` and `solved` are the numbers the game-over panel prints, so the panel
 * and the ladder cannot disagree about what happened.
 */
export class Curriculum {
  /** Questions served this run, answered or not. */
  asked = 0
  /** Questions answered correctly. The only thing that moves the ladder. */
  solved = 0
  /** Questions that closed with no answer at all. Never reported, never punished. */
  unanswered = 0

  /** The last `RECENT_WINDOW` answers, newest last. Timeouts are not answers. */
  private recent: boolean[] = []
  private readonly rng: () => number

  /** `rng` is injected so the spread can be measured rather than believed. */
  constructor(rng: () => number = Math.random) {
    this.rng = rng
  }

  /** Questions the child actually answered. A timeout is not an answer. */
  get answeredCount(): number {
    return Math.max(0, this.asked - this.unanswered)
  }

  reset(): void {
    this.asked = 0
    this.solved = 0
    this.unanswered = 0
    this.recent.length = 0
  }

  /** Misses inside the recent window. The only thing that brings the band down. */
  get recentMisses(): number {
    let n = 0
    for (const ok of this.recent) if (!ok) n++
    return n
  }

  /**
   * The step of the ladder this run has earned.
   *
   * `offset` is the one thing a surface may say about its own stakes — the RIFT
   * asks a touch easier than the run has earned, because it is asked of a child
   * who has just died. It never reads the clock.
   */
  difficulty(offset = 0): number {
    const earned = 1 + Math.floor(this.solved / SOLVES_PER_STEP)
    return clamp(earned + offset, MIN_DIFFICULTY, MAX_DIFFICULTY)
  }

  /** Seconds the CORE stays open. Grows with the ladder; never shrinks. */
  thinkingSeconds(): number {
    return BASE_THINKING_SECONDS + (this.difficulty() - 1) * THINKING_SECONDS_PER_STEP
  }

  /**
   * The top of the band, as a position on the host's whole ladder.
   *
   * This is `difficulty()` on the fraction scale and nothing more — the same
   * trajectory PR #656 set, said in units that can name every rung instead of
   * every sixth one.
   */
  edgeUnit(offset = 0): number {
    return Math.min(UNIT_TOP, (this.difficulty(offset) - 1) / (MAX_DIFFICULTY - 1))
  }

  /**
   * The ladder position ONE question is drawn from.
   *
   * The edge, less a descent: the recent-miss drop plus a random step, capped
   * at half the edge's own height so the band never bottoms out on `0 + 1`.
   *
   * The step is `min` of two draws, so it is heaviest at zero — most questions
   * are at or just under the edge, and the tail is the interleaved easier
   * retrieval. Never above the edge, never below the floor of the ladder.
   */
  askUnit(offset = 0): number {
    const edge = this.edgeUnit(offset)
    const drop = Math.min(MAX_DROP_RUNGS, this.recentMisses * MISS_RUNGS)
    const step = Math.floor(Math.min(this.rng(), this.rng()) * (SPREAD_RUNGS + 1))
    const descent = Math.min(drop + step, edge * LADDER_SPAN * DESCENT_CEILING)
    return clamp(edge - descent * RUNG, 0, edge)
  }

  /**
   * Pull the next question.
   *
   * Two scales, on purpose, and both are what the host's `toUnit` reads:
   *
   *   - `difficulty` is a FRACTION (`< 1`), used as is. That is what makes all
   *     sixty rungs addressable instead of ten.
   *   - `maxDifficulty` is on the INTEGER ladder scale (`>= 1`), because the
   *     host's ceiling FLOORS where its request ROUNDS, and a fraction strictly
   *     below 1 can therefore never admit the top rung. The host's own note
   *     says it: *"A caller that needs to be exact at the top should speak the
   *     ladder scale, where every 0..1 position has an unambiguous spelling:
   *     `1 + unit * 9`."* The extra half-rung makes the floor of the cap land
   *     on the same rung the edge rounds to.
   */
  ask(host: Host, offset = 0): Question {
    this.asked++
    const edge = this.edgeUnit(offset)
    return host.next({
      difficulty: this.askUnit(offset),
      maxDifficulty: 1 + Math.min(1, edge + RUNG / 2) * (MAX_DIFFICULTY - 1),
    })
  }

  /**
   * The child answered. This is the only path that reports, and the only path
   * that moves the ladder.
   */
  answered(host: Host, q: Question, answered: string, correct: boolean, ms: number): void {
    if (correct) this.solved++
    this.recent.push(correct)
    if (this.recent.length > RECENT_WINDOW) this.recent.shift()
    host.report({ questionId: q.id, correct, ms: Math.max(0, Math.round(ms)), answered })
  }

  /**
   * The question closed with no answer. Nothing is reported and nothing moves:
   * a child who was still computing has not told the host anything about what
   * they know, and inventing a wrong answer on their behalf is a lie the
   * adaptive controller downstream would act on.
   */
  expired(): void {
    this.unanswered++
  }
}
