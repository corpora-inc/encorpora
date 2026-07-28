// The round, as a clock.
//
//   RAISE    the slate comes up out of the dust, blank
//   STILL    the statement is cut into it, unlit. Nothing else moves.
//   CALL     the slate lights. The window is open. One press is your call.
//   VERDICT  what the street does about it
//   CLEAR    the slate goes back down
//
// Two rules in here carry the whole feel.
//
// **A wrong draw does not stop the clock.** Drawing at a true slate commits
// instantly and the round moves on — that is the reward for reading, and it is
// the only thing in the game that makes time go faster. Drawing at a *false*
// slate commits too, but the window still runs out to the last millisecond,
// with nothing on screen changing. A masher therefore gets no tempo out of
// mashing: they get the slowest possible game, sitting through a window they
// already spent, watching a slate that does not care.
//
// **Nothing escalates.** The window is a function of the statement and of
// nothing else — not of how long the run has lasted. `EXPERIENCE_DESIGN.md`
// bans escalation on run length and a creeping timer is that ban's exact
// target. A long run here is longer, never faster.
//
// The machine is driven by elapsed milliseconds rather than by frames, so
// `round.test.ts` plays whole runs with no canvas, no rAF and no clock.

import { applyFlinch, applyOutcome, newRun, type Run } from "./run.ts"
import { isCorrect, outcomeOf, type Outcome } from "./response.ts"
import type { Statement } from "./statement.ts"

export type Phase = "idle" | "raise" | "still" | "call" | "verdict" | "clear" | "over"

export type RoundEvent =
  | { kind: "present"; statement: Statement }
  /** The slate lit. This is the go signal and the only cue there is. */
  | { kind: "cue"; statement: Statement }
  /** A press before the slate lit. Counted, and otherwise ignored. */
  | { kind: "flinch" }
  | { kind: "settled"; outcome: Outcome; statement: Statement; reactionMs: number }
  | { kind: "over"; run: Run }
  | { kind: "begin" }

export type Timing = {
  raise: number
  clear: number
  verdict: Record<Outcome, number>
  /** How long the ledger is untouchable, so a run does not end in a stray tap. */
  overLock: number
}

export const TIMING: Timing = {
  raise: 220,
  clear: 200,
  verdict: {
    // Struck, seated, gone. The correct draw is the fast one.
    hit: 520,
    // The bow, and the slate rolling itself right. The longest thing in the
    // game, because it is the best thing in the game.
    bow: 940,
    // Nothing happens. The beat exists so the silence is legible as silence
    // rather than as a dropped frame.
    wild: 620,
    slow: 640,
  },
  overLock: 900,
}

export const TIMING_REDUCED: Timing = {
  raise: 110,
  clear: 100,
  verdict: {
    hit: 300,
    // Still the longest, still the payoff: a cross-fade from the wrong numeral
    // to the right one instead of a roll. A branch, not a degradation.
    bow: 520,
    // Unchanged, and it is the one that could not change: there is no motion in
    // being ignored to reduce.
    wild: 620,
    slow: 360,
  },
  overLock: 900,
}

export class Round {
  private readonly deal: () => Statement
  private readonly timing: Timing

  private phaseName: Phase = "idle"
  private elapsed = 0
  private duration = 0
  private current: Statement | null = null
  private lastOutcome: Outcome | null = null
  private committed: Outcome | null = null
  private reaction = 0
  private state: Run = newRun()

  constructor(deal: () => Statement, timing: Timing = TIMING) {
    this.deal = deal
    this.timing = timing
  }

  get phase(): Phase {
    return this.phaseName
  }

  get run(): Run {
    return this.state
  }

  get statement(): Statement | null {
    return this.current
  }

  /** The outcome the verdict is currently showing, if any. */
  get outcome(): Outcome | null {
    return this.phaseName === "verdict" || this.phaseName === "clear" ? this.lastOutcome : null
  }

  /** 0..1 through the current phase. The renderer's only clock. */
  get progress(): number {
    return this.duration <= 0 ? 1 : Math.max(0, Math.min(1, this.elapsed / this.duration))
  }

  get elapsedMs(): number {
    return this.elapsed
  }

  get durationMs(): number {
    return this.duration
  }

  /** Start a run. Legal from `idle` and from `over`. */
  begin(): RoundEvent[] {
    if (this.phaseName !== "idle" && this.phaseName !== "over") return []
    this.state = newRun()
    this.lastOutcome = null
    const events: RoundEvent[] = [{ kind: "begin" }]
    events.push(...this.present())
    return events
  }

  advance(dt: number): RoundEvent[] {
    if (this.phaseName === "idle" || this.phaseName === "over") {
      this.elapsed += Math.max(0, dt)
      return []
    }
    const events: RoundEvent[] = []
    this.elapsed += Math.max(0, dt)
    // A `while`, not an `if`: a backgrounded tab hands back a delta longer than
    // several phases, and a machine that advanced one phase per frame would owe
    // the child a round it never played.
    let guard = 0
    // `phase` rather than `this.phaseName`: the guard clause above narrowed the
    // field, and the compiler does not know that `finishPhase` widens it again.
    while (this.elapsed >= this.duration && this.phase !== "over" && guard++ < 16) {
      const carry = this.elapsed - this.duration
      events.push(...this.finishPhase())
      this.elapsed = carry
    }
    return events
  }

  /** One press. Returns whatever it caused, which is often nothing. */
  press(): RoundEvent[] {
    switch (this.phaseName) {
      case "raise":
      case "still": {
        this.state = applyFlinch(this.state)
        return [{ kind: "flinch" }]
      }
      case "call": {
        if (this.committed !== null) return []
        const statement = this.current
        if (!statement) return []
        this.reaction = this.elapsed
        const outcome = outcomeOf("draw", statement.truth)
        this.committed = outcome
        // A true draw stops the clock. A wild one does not: the window runs its
        // full length with the world declining to react.
        if (outcome === "hit") return this.settle(outcome)
        return []
      }
      case "idle": {
        // Nothing on the street but the caller and three loaded shots. The
        // first tap is the start button, which is why there is not one.
        return this.begin()
      }
      case "over": {
        if (this.elapsed < this.timing.overLock) return []
        return this.begin()
      }
      default:
        return []
    }
  }

  private present(): RoundEvent[] {
    this.current = this.deal()
    this.committed = null
    this.reaction = 0
    this.enter("raise", this.timing.raise)
    return [{ kind: "present", statement: this.current }]
  }

  private finishPhase(): RoundEvent[] {
    const statement = this.current
    switch (this.phaseName) {
      case "raise": {
        this.enter("still", statement ? statement.stillMs : 900)
        return []
      }
      case "still": {
        this.enter("call", statement ? statement.windowMs : 2000)
        return statement ? [{ kind: "cue", statement }] : []
      }
      case "call": {
        // Either a wild draw that has been sitting on the clock, or no press at
        // all — which is a hold, and a hold is a call like any other.
        const outcome = this.committed ?? outcomeOf("hold", statement ? statement.truth : true)
        if (this.committed === null) this.reaction = this.duration
        return this.settle(outcome)
      }
      case "verdict": {
        this.enter("clear", this.timing.clear)
        return []
      }
      case "clear": {
        if (this.state.over) {
          this.enter("over", Number.POSITIVE_INFINITY)
          return [{ kind: "over", run: this.state }]
        }
        return this.present()
      }
      default:
        return []
    }
  }

  private settle(outcome: Outcome): RoundEvent[] {
    const statement = this.current
    this.lastOutcome = outcome
    this.committed = outcome
    this.state = applyOutcome(this.state, outcome)
    this.enter("verdict", this.timing.verdict[outcome])
    if (!statement) return []
    return [
      {
        kind: "settled",
        outcome,
        statement,
        reactionMs: Math.round(this.reaction),
      },
    ]
  }

  private enter(phase: Phase, duration: number): void {
    this.phaseName = phase
    this.duration = duration
    this.elapsed = 0
  }
}

/** Convenience for the tests and the ledger: was this a call or a miss. */
export function settledCorrectly(event: RoundEvent): boolean {
  return event.kind === "settled" && isCorrect(event.outcome)
}
