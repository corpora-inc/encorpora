// THE COUNTERWEIGHT — the rules.
//
// A steelyard beam between you and the Iron Turk.
//
//   * **His pan carries a column sum** — `473 + 168`, drawn as a column and
//     never as a total. The number is there; nobody is going to write it down
//     for you.
//   * **Your pan carries a load**, a numeral, and it stays where you left it
//     between rounds. You move it by striking place-value counterweights.
//   * **You must hold exactly one notch ahead.** `load − his = 1`. Not
//     "somewhere above": one. That is what winning an arm-wrestle looks like —
//     never comfortable, a hair in front — and it is what makes the answer exact
//     rather than a range you can bracket by watching the beam.
//   * Strike **SEAT** and the beam is judged. One notch ahead and he gives
//     ground. Anything else and he takes it.
//
// Three pressures keep it live, and none of them is a mash:
//
//   1. **The clock.** The round has a window; when it runs out the beam is
//      seated where it stands. The whistle does not wait.
//   2. **The sag.** Leave the beam alone and your pan settles — one unit, then
//      another. You cannot find the notch early and sit on it. Any strike
//      re-seats the pan and the sag starts over, so this only bites a player who
//      has stopped playing.
//   3. **The strain.** Every strike rings the steel and strain does not bleed
//      out as fast as a mash puts it in. See `strain.ts` — that module is the
//      answer to "what stops a child hitting plates fast".
//
// What crosses to the host is `load − 1`: the value the child's beam asserts his
// column sum to be. Get the sum right and it is the canonical value. Drop a
// carry and it is the mal-rule output, exactly, so the diagnosis routes with no
// extra wiring — the game never compares anything to an answer.

import type { Question } from "../contract.ts"
import { applyStrike, PILLAR_COOLDOWN_MS, type Place, type Strike } from "./places.ts"
import { Strain } from "./strain.ts"

/** How far the arm travels before somebody is over. */
export const GROUND = 5

export type Phase =
  /** The weight is coming down on his pan. The beam lurches; input is dead. */
  | "hang"
  /** The window. Strike plates, read the beam, seat when you believe it. */
  | "press"
  /** The verdict is showing. */
  | "settle"

export type Verdict = "true" | "short" | "over" | "shear"

export type Timing = {
  /** The weight coming down. */
  readonly hangMs: number
  /** The window to find the notch and seat it. */
  readonly pressMs: number
  /** The verdict beat. */
  readonly settleMs: number
  /** Quiet time before the pan starts to settle. */
  readonly sagGraceMs: number
  /** How long each further unit of sag takes. */
  readonly sagPeriodMs: number
  /** Strain at which the steel shears. */
  readonly shearAt: number
}

export const TIMING: Timing = {
  hangMs: 760,
  pressMs: 13000,
  settleMs: 1150,
  sagGraceMs: 1500,
  sagPeriodMs: 1300,
  shearAt: 34,
}

/**
 * Reduced motion is a branch, not a degradation, and a clock is not motion.
 * Every duration here is identical to the one above; what changes is in
 * `sim/beam.ts`, where the beam travels to its reading instead of ringing its
 * way there. Nobody gets less time for asking for a calmer screen.
 */
export const TIMING_REDUCED: Timing = TIMING

/**
 * The Turk gets stronger. Never by making the arithmetic unfair — the host owns
 * the ladder — but by shortening the window, tightening the steel and grinding
 * harder.
 */
export function timingForBout(bout: number, base: Timing = TIMING): Timing {
  const step = Math.max(0, bout - 1)
  return {
    hangMs: base.hangMs,
    pressMs: Math.max(7600, base.pressMs - step * 1100),
    settleMs: base.settleMs,
    sagGraceMs: Math.max(900, base.sagGraceMs - step * 120),
    sagPeriodMs: Math.max(750, base.sagPeriodMs - step * 110),
    shearAt: Math.max(24, base.shearAt - step * 2),
  }
}

export type Match = {
  /** Which Turk, one-based. */
  bout: number
  /** −GROUND (you are over) … +GROUND (he is over). */
  arm: number
  /** Turks put over, this session. */
  won: number
  /** Rounds seated exactly true, this session. */
  held: number
}

export type Seat = {
  readonly question: Question
  readonly verdict: Verdict
  /** The load on your pan at the moment of judgement. */
  readonly load: number
  /** The value the beam asserted his column to be: `load − 1`. */
  readonly asserted: number
  /** Milliseconds from the window opening to the seat. */
  readonly ms: number
  /** True when the child struck SEAT rather than running out of window. */
  readonly declared: boolean
}

export type BoutEvent =
  | { kind: "hang"; question: Question; delta: number }
  | { kind: "open" }
  | { kind: "strike"; strike: Strike; load: number; impulse: number }
  | { kind: "refused"; reason: "cooldown" | "phase" }
  | { kind: "sag"; load: number }
  | { kind: "seat"; seat: Seat; arm: number }
  | { kind: "won"; bout: number }
  | { kind: "pinned"; bout: number }

/**
 * Where the first pan of a session starts.
 *
 * Deliberately not the answer and deliberately not zero: a handful of strikes
 * away, on a value with the same shape, rounded to a round number so the
 * opening move is legible. The child's first act is to see that they are, say,
 * 142 light.
 */
export function openingLoad(target: number): number {
  const grain = target >= 1000 ? 1000 : target >= 100 ? 100 : 10
  const base = Math.round(target / grain) * grain
  return Math.max(grain, base - grain)
}

/**
 * The state machine. Pure: it is handed a `deal()` and told how much time
 * passed, and it hands back events. It touches no canvas, no audio and no host.
 */
export class Bout {
  private readonly deal: () => Question
  private readonly base: Timing
  private phaseName: Phase = "hang"
  private elapsed = 0
  private duration: number
  private state: Match = { bout: 1, arm: 0, won: 0, held: 0 }
  private current: Question | null = null
  private target = 0
  private loadValue = 0
  private lastSeat: Seat | null = null
  private strainMeter: Strain
  private timing: Timing
  private readonly cooldowns = new Map<Place, number>()
  private sagIdleMs = 0
  private stopped = false
  private started = false
  private seeded = false

  constructor(deal: () => Question, base: Timing = TIMING) {
    this.deal = deal
    this.base = base
    this.timing = timingForBout(1, this.base)
    this.strainMeter = new Strain({ shearAt: this.timing.shearAt })
    this.duration = this.timing.hangMs
  }

  get phase(): Phase {
    return this.phaseName
  }

  get match(): Match {
    return this.state
  }

  get question(): Question | null {
    return this.current
  }

  /** His column's value. Known to the game, never drawn. */
  get his(): number {
    return this.target
  }

  /** Your pan. */
  get load(): number {
    return this.loadValue
  }

  /** `load − his`. Zero is dead level; the game wants exactly 1. */
  get margin(): number {
    return this.loadValue - this.target
  }

  get strain(): Strain {
    return this.strainMeter
  }

  /** The verdict currently on the beam, if one is showing. */
  get seat(): Seat | null {
    return this.phaseName === "settle" ? this.lastSeat : null
  }

  get paused(): boolean {
    return this.stopped
  }

  get elapsedMs(): number {
    return this.elapsed
  }

  /** 0..1 through the current phase. The renderer's only clock. */
  get progress(): number {
    return this.duration <= 0 ? 1 : Math.max(0, Math.min(1, this.elapsed / this.duration))
  }

  get timings(): Timing {
    return this.timing
  }

  /** Whether this pillar is still swinging back. */
  cooling(place: Place): boolean {
    return (this.cooldowns.get(place) ?? 0) > 0
  }

  /**
   * The host has put something over the frame. **The clock stops dead.**
   *
   * This game calls `transition` every time a Turk goes over, and the SDK
   * documents that a transition may raise a sheet while leaving the pack
   * mounted and its rAF running. Without this the press window would open and
   * close behind that sheet, seat the beam wherever it stood, and mark the child
   * wrong for a column they were never shown — while taking ground off them for
   * it. A reward that costs the match is the worst bug this game could have.
   */
  pause(): void {
    this.stopped = true
  }

  resume(): void {
    this.stopped = false
  }

  /** Deal the first weight. Legal once. */
  begin(): BoutEvent[] {
    if (this.started) return []
    this.started = true
    return this.hang()
  }

  /**
   * Time passes. Returns everything that happened in it.
   *
   * A paused bout consumes nothing — not the window, not the sag, not the
   * strain bleed. Time behind a sheet is not the child's time.
   */
  advance(dtMs: number): BoutEvent[] {
    if (this.stopped || dtMs <= 0 || !this.started) return []
    const events: BoutEvent[] = []
    let left = dtMs
    // Chunked so a long frame cannot skip a phase boundary or a sag tick.
    while (left > 0) {
      const step = Math.min(left, 40)
      left -= step
      events.push(...this.step(step))
    }
    return events
  }

  /**
   * Strike a face on the rack.
   *
   * Refused outside the window and refused while that pillar is still swinging
   * back. Every accepted strike moves the pan by exactly the place's value and
   * puts strain into the steel — and if that strain reaches the shear limit, the
   * round ends on the blow that broke it.
   */
  strike(strike: Strike): BoutEvent[] {
    if (this.stopped || this.phaseName !== "press") return [{ kind: "refused", reason: "phase" }]
    if (this.cooling(strike.place)) return [{ kind: "refused", reason: "cooldown" }]

    this.cooldowns.set(strike.place, PILLAR_COOLDOWN_MS)
    const impulse = this.strainMeter.strike()
    this.loadValue = applyStrike(this.loadValue, strike)
    this.sagIdleMs = 0
    const events: BoutEvent[] = [{ kind: "strike", strike, load: this.loadValue, impulse }]
    if (this.strainMeter.isSheared) events.push(...this.judge(false, "shear"))
    return events
  }

  /** Strike SEAT: judge the beam now. */
  seatNow(): BoutEvent[] {
    if (this.stopped || this.phaseName !== "press") return [{ kind: "refused", reason: "phase" }]
    return this.judge(true)
  }

  private step(dt: number): BoutEvent[] {
    const events: BoutEvent[] = []
    for (const [place, left] of this.cooldowns) {
      const next = left - dt
      if (next <= 0) this.cooldowns.delete(place)
      else this.cooldowns.set(place, next)
    }

    if (this.phaseName === "press") {
      this.strainMeter.advance(dt)
      // The pan settles under a load nobody is tending.
      this.sagIdleMs += dt
      while (this.sagIdleMs >= this.timing.sagGraceMs + this.timing.sagPeriodMs) {
        this.sagIdleMs -= this.timing.sagPeriodMs
        this.loadValue -= 1
        events.push({ kind: "sag", load: this.loadValue })
      }
    }

    this.elapsed += dt
    if (this.elapsed < this.duration) return events

    // Carried across the boundary, so a chunked frame does not quietly shave a
    // few milliseconds off every phase it crosses.
    const over = this.elapsed - this.duration
    switch (this.phaseName) {
      case "hang": {
        this.enter("press", this.timing.pressMs)
        this.sagIdleMs = 0
        events.push({ kind: "open" })
        break
      }
      case "press": {
        // The whistle. The beam is judged where it stands — which is honest:
        // that load is the claim the child had on the bar when time ran out.
        events.push(...this.judge(false))
        break
      }
      case "settle": {
        if (this.state.arm >= GROUND) {
          const bout = this.state.bout
          this.state.won += 1
          this.state.bout += 1
          this.state.arm = 0
          this.timing = timingForBout(this.state.bout, this.base)
          events.push({ kind: "won", bout })
        } else if (this.state.arm <= -GROUND) {
          // Pinned. The Turk does not get stronger for it and nothing is taken
          // away: the arm goes back to level and the same one squares up again.
          // Stakes without loss — ADR-0009.
          this.state.arm = 0
          events.push({ kind: "pinned", bout: this.state.bout })
        }
        events.push(...this.hang())
        break
      }
      default:
        break
    }
    this.elapsed = Math.min(over, this.duration)
    return events
  }

  private hang(): BoutEvent[] {
    const question = this.deal()
    this.current = question
    const answer = Number(question.answer)
    if (!Number.isInteger(answer)) {
      // A host that served something this game cannot weigh. Loud, never
      // silent: a pan with no number on it is a round nobody can win.
      console.error("[counterweight] a question arrived with a non-integer answer", question.answer)
    }
    this.target = Number.isInteger(answer) ? answer : 0
    // The very first weight of the session lands on an empty pan. Give it a
    // start within striking distance so the first round is arithmetic rather
    // than a hundred blows on the thousands pillar.
    //
    // Flagged rather than tested against a load of zero: a player who happens to
    // drive their pan down to nothing would otherwise be handed a free reset
    // onto the next weight, which is a rule nobody was told about and a way to
    // dodge a round you had already lost.
    if (!this.seeded) {
      this.seeded = true
      this.loadValue = openingLoad(this.target)
    }
    this.strainMeter = new Strain({ shearAt: this.timing.shearAt })
    this.sagIdleMs = 0
    this.enter("hang", this.timing.hangMs)
    return [{ kind: "hang", question, delta: this.target + 1 - this.loadValue }]
  }

  private judge(declared: boolean, forced?: "shear"): BoutEvent[] {
    const question = this.current
    if (!question) return []
    const margin = this.margin
    const verdict: Verdict =
      forced === "shear" ? "shear" : margin === 1 ? "true" : margin < 1 ? "short" : "over"
    const seat: Seat = {
      question,
      verdict,
      load: this.loadValue,
      asserted: this.loadValue - 1,
      ms: Math.max(0, Math.round(this.elapsed)),
      declared,
    }
    this.lastSeat = seat
    // Ground moves by one either way. An arm-wrestle is a tug, not a scoreline.
    if (verdict === "true") {
      this.state.arm = Math.min(GROUND, this.state.arm + 1)
      this.state.held += 1
    } else {
      this.state.arm = Math.max(-GROUND, this.state.arm - 1)
    }
    this.enter("settle", this.timing.settleMs)
    return [{ kind: "seat", seat, arm: this.state.arm }]
  }

  private enter(phase: Phase, duration: number): void {
    this.phaseName = phase
    this.elapsed = 0
    this.duration = duration
  }
}
