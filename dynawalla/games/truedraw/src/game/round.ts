// The round, as a clock.
//
//   RAISE    an EMPTY slate comes up out of the dust
//   STILL    it stands blank, ~320 ms. Nothing to read, nothing to answer.
//   CALL     the statement is cut in, lit. The window is open. One flick is your
//            call, and either flick ends the round the instant it commits.
//   VERDICT  what the street does about it
//   CLEAR    the slate leaves — DOWNWARD if you kept it, UPWARD if you threw it
//
// Two rules in here carry the whole feel, and both of them are new.
//
// **EITHER VERDICT STOPS THE CLOCK.** This is the fix. There used to be one verb,
// so one of the two verdicts was expressed by letting the window run out — and a
// child who was certain in 300 ms sat through the rest of it, every time, on half
// of all slates. Measured on the widest class before this change: 300 ms of
// thinking, 14,000 ms of waiting. Now a flick in either direction settles at once
// and the next slate comes up. Nothing in this game makes a child wait for a
// verdict they have already reached.
//
// **A TIMEOUT IS NOT A VERDICT.** The window closing on an untouched screen is a
// `lapse`. It costs no coins and no shot, and it is reported to the host with
// `skip` rather than with `report` — see `response.ts` and `mount.ts`. It is not a
// wrong answer, because nobody answered.
//
// **Nothing escalates.** The window is a function of the statement and of nothing
// else — not of how long the run has lasted. `EXPERIENCE_DESIGN.md` bans escalation
// on run length and a creeping timer is that ban's exact target. A long run here is
// longer, never faster.
//
// The machine is driven by elapsed milliseconds rather than by frames, so
// `round.test.ts` plays whole runs with no canvas, no rAF and no clock.

import { coinsFor } from "./bag.ts"
import { quicknessOf } from "./cadence.ts"
import { applyFlinch, applyOutcome, newRun, type Run } from "./run.ts"
import { isCorrect, outcomeOf, type Call, type Outcome } from "./response.ts"
import type { Statement } from "./statement.ts"

export type Phase = "idle" | "raise" | "still" | "call" | "verdict" | "clear" | "over"

export type RoundEvent =
  | { kind: "present"; statement: Statement }
  /** The statement was cut in. The window is open from this instant. */
  | { kind: "cue"; statement: Statement }
  /** A touch on a blank slate. Counted, and otherwise ignored. */
  | { kind: "flinch" }
  | {
      kind: "settled"
      outcome: Outcome
      statement: Statement
      /**
       * Milliseconds from the statement becoming answerable to the flick
       * committing. Never from the slate being drawn, never from an animation
       * ending. A `lapse` reports the whole window, which is the one honest thing
       * to say about a window nobody touched — and it is never sent to the ladder.
       */
      reactionMs: number
      /** 0..1 share of the item's p50 the child did not use. */
      quickness: number
      /** Coins this call was worth. Negative on a wrong verdict, zero on a lapse. */
      coins: number
    }
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
    // Stamped, seated, and gone into the bag.
    bank: 500,
    // The bow, and the slate rolling itself right before it flies away. The
    // longest thing in the game, because it is the best thing in the game.
    spot: 940,
    // You banked a counterfeit. It goes down like a bank and the coins drain
    // back out. No sound, no buzz, no colour — the loss is the whole of it.
    dud: 560,
    // You threw a good slate away. It flies up and the coins drain. Also silent.
    burn: 560,
    // Nobody said anything. The slate just sinks. The shortest beat there is,
    // because there is nothing to show and a child who is still thinking should
    // not be made to watch a reaction to their not answering.
    lapse: 300,
  },
  overLock: 900,
}

export const TIMING_REDUCED: Timing = {
  raise: 110,
  clear: 100,
  verdict: {
    bank: 300,
    // Still the longest, still the payoff: a cross-fade from the wrong numeral
    // to the right one instead of a roll. A branch, not a degradation.
    spot: 520,
    // Unchanged, and they are the ones that could not change: there is no motion
    // in a silent loss to reduce.
    dud: 560,
    burn: 560,
    lapse: 300,
  },
  overLock: 900,
}

/** Which way the slate leaves. `+1` is down, into the bag; `-1` is up, away. */
export function exitOf(outcome: Outcome | null): 1 | -1 {
  return outcome === "spot" || outcome === "burn" ? -1 : 1
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
  private stopped = false

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

  /** Whether a flick would mean anything right now. */
  get answerable(): boolean {
    return !this.stopped && this.phaseName === "call" && this.committed === null
  }

  get paused(): boolean {
    return this.stopped
  }

  /**
   * The host put something over the frame. **The clock stops dead.**
   *
   * This matters more here than in any other pack, and it is not hypothetical:
   * this game calls `transition` on every tenth call, the SDK documents that a
   * transition may put a sheet over the frame, and the host then sends `pause`
   * while leaving the pack mounted and running. Without this a window would open
   * and close behind that sheet and settle — as a lapse now rather than as a lost
   * shot, which is already much less bad, but it would still hand the host a
   * `skip` for a slate the child was never shown and burn the question.
   */
  pause(): void {
    this.stopped = true
  }

  resume(): void {
    this.stopped = false
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
    if (this.stopped) return []
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

  /**
   * One flick, in one of the two directions. Both settle at once.
   *
   * The reaction reported is `elapsed` at this instant, and `elapsed` in the
   * `call` phase is measured from the moment the statement was cut into the slate
   * — which is the moment it became both legible and answerable. Before this
   * change the slate carried the statement, unlit, throughout `still`, so a child
   * could read it for up to 1.15 s before the clock started. See `stillFor`.
   */
  verdict(call: Call): RoundEvent[] {
    if (this.stopped) return []
    if (this.phaseName !== "call") return []
    if (this.committed !== null) return []
    const statement = this.current
    if (!statement) return []
    this.reaction = this.elapsed
    return this.settle(outcomeOf(call, statement.truth))
  }

  /**
   * A tap: a touch that did not travel far enough to mean anything.
   *
   * It is never a verdict. On an empty street it starts the run; on a lit slate it
   * is a flinch, which costs nothing and is counted. A tap that answered a
   * question would put the whole game back where it started — a child who taps
   * would be voting "true" without knowing they had voted.
   */
  tap(): RoundEvent[] {
    if (this.stopped) return []
    switch (this.phaseName) {
      case "raise":
      case "still":
      case "call": {
        this.state = applyFlinch(this.state)
        return [{ kind: "flinch" }]
      }
      case "idle": {
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
        this.enter("still", statement ? statement.stillMs : 320)
        return []
      }
      case "still": {
        this.enter("call", statement ? statement.windowMs : 2000)
        return statement ? [{ kind: "cue", statement }] : []
      }
      case "call": {
        // Nobody flicked. That is not a verdict — it is a lapse.
        this.reaction = this.duration
        return this.settle("lapse")
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
    const reactionMs = Math.round(this.reaction)
    const quickness = quicknessOf(reactionMs, statement?.p50Ms ?? 0)
    const coins = coinsFor(outcome, quickness)
    this.state = applyOutcome(this.state, outcome, coins)
    this.enter("verdict", this.timing.verdict[outcome])
    if (!statement) return []
    return [{ kind: "settled", outcome, statement, reactionMs, quickness, coins }]
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
