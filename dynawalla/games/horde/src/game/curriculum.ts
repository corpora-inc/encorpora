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
 */

import type { Host, Question } from "../contract.ts"

/** The host ladder this game asks against. */
export const MIN_DIFFICULTY = 1
export const MAX_DIFFICULTY = 10

/** Right answers needed per step up the ladder. */
export const SOLVES_PER_STEP = 2

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

  /** Questions the child actually answered. A timeout is not an answer. */
  get answeredCount(): number {
    return Math.max(0, this.asked - this.unanswered)
  }

  reset(): void {
    this.asked = 0
    this.solved = 0
    this.unanswered = 0
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

  /** Pull the next question at the difficulty this run has earned. */
  ask(host: Host, offset = 0): Question {
    this.asked++
    return host.next({ difficulty: this.difficulty(offset) })
  }

  /**
   * The child answered. This is the only path that reports, and the only path
   * that moves the ladder.
   */
  answered(host: Host, q: Question, answered: string, correct: boolean, ms: number): void {
    if (correct) this.solved++
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
