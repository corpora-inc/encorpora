// THE STEELYARD — the rules.
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
// Three pressures keep it live, and none of them is a mash — and none of them,
// now, is allowed to charge a child for thinking:
//
//   1. **The clock.** The round has a window, and the window is a pure function
//      of the weight on his pan — see `window.ts`. When it runs out the round is
//      simply over: no verdict, no ground either way, nothing reported. A child
//      who was still carrying the hundreds column has told us nothing about what
//      they know, and a game that filed that as a wrong answer would be lying to
//      the curriculum about them.
//   2. **The sag.** Leave the beam alone *after you have moved it* and your pan
//      settles — one unit, then another. You cannot find the notch early and sit
//      on it. **It does not run before your first blow of the round**, which is
//      the whole of the child's reading time: a pan that drained while they read
//      his column made the arithmetic they had just done wrong by the time they
//      reached the rack, and that is what "sometimes the timing is sort of
//      impossible" was.
//   3. **The strain.** Every strike rings the steel and strain does not bleed
//      out as fast as a mash puts it in. See `strain.ts` — that module is the
//      answer to "what stops a child hitting plates fast".
//
// **The Turk gets stronger by the arithmetic and by nothing else.** There is no
// bout counter in any duration in this file. The window, the sag and the shear
// limit are the same at the ninth Turk as at the first; what changes is the rung
// the yard asks the host for — `ladder.ts` — which moves on Turks put over and
// comes back down on a pinning.
//
// What crosses to the host is `load − 1`: the value the child's beam asserts his
// column sum to be. Get the sum right and it is the canonical value. Drop a
// carry and it is the mal-rule output, exactly, so the diagnosis routes with no
// extra wiring — the game never compares anything to an answer.

import type { Question } from "../contract.ts"
import { applyStrike, PILLAR_COOLDOWN_MS, strikesFor, type Place, type Strike } from "./places.ts"
import { Strain } from "./strain.ts"
import { MIN_PRESS_SECONDS, pressMsFor } from "./window.ts"

/** How far the arm travels before somebody is over. */
export const GROUND = 5

export type Phase =
  /** The weight is coming down on his pan. The beam lurches; input is dead. */
  | "hang"
  /** The window. Strike plates, read the beam, seat when you believe it. */
  | "press"
  /** The verdict is showing. */
  | "settle"

export type Verdict =
  | "true"
  | "short"
  | "over"
  | "shear"
  /** The whistle blew on a round nobody declared. Costs nothing, says nothing. */
  | "expired"

/**
 * Everything with a duration except the press window, which is not here on
 * purpose: it belongs to the item, it lives in `window.ts`, and a field for it
 * in this record is how it would get a game constant folded back into it.
 */
export type Timing = {
  /** The weight coming down. */
  readonly hangMs: number
  /** The verdict beat. */
  readonly settleMs: number
  /** Quiet time, after the first blow of the round, before the pan settles. */
  readonly sagGraceMs: number
  /** How long each further unit of sag takes. */
  readonly sagPeriodMs: number
  /** Strain at which the steel shears. */
  readonly shearAt: number
}

export const TIMING: Timing = {
  hangMs: 760,
  settleMs: 1150,
  // Was 1500/1300, and tightening with every Turk. A child mid-execution is
  // striking every third of a second, so this never fires on them; it fires on a
  // pan that has been parked, which is the only thing it was ever for.
  sagGraceMs: 3000,
  sagPeriodMs: 1600,
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
 * How far out of position the pan may be before the yard re-racks it.
 *
 * Your load staying where you left it is the good rule and it holds nearly
 * always: consecutive weights of the same size are a handful of strikes apart.
 * What it cannot survive is the ladder moving under it — a pan sitting on 8,367
 * when the next weight is `43 + 25` costs a whole round of unwinding before any
 * arithmetic happens, which is a calm round spent on nothing. So when the load
 * is this many strikes worse than a fresh seed would be, the yard racks it back.
 * Measured in strikes rather than in magnitude because strikes are the thing
 * that costs the child time.
 */
export const RERACK_SLACK = 5

export type Match = {
  /** Which Turk, one-based. */
  bout: number
  /** −GROUND (you are over) … +GROUND (he is over). */
  arm: number
  /** Turks put over, this session. */
  won: number
  /** Times pinned, this session. The relief half of the ladder. */
  pinned: number
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
  /** The yard racked the pan back — the ladder moved out from under it. */
  | { kind: "rerack"; load: number }
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
  private phaseName: Phase = "hang"
  private elapsed = 0
  private duration: number
  private state: Match = { bout: 1, arm: 0, won: 0, pinned: 0, held: 0 }
  private current: Question | null = null
  private target = 0
  private loadValue = 0
  private lastSeat: Seat | null = null
  private strainMeter: Strain
  private readonly timing: Timing
  /** This round's window. Set from the item at `hang`, from nothing else ever. */
  private pressWindowMs: number
  private readonly cooldowns = new Map<Place, number>()
  private sagIdleMs = 0
  /**
   * Whether the sag is live yet. False until the child's first blow of the
   * round: reading his column is not "leaving the pan alone".
   */
  private sagArmed = false
  private stopped = false
  private started = false
  private seeded = false

  constructor(deal: () => Question, base: Timing = TIMING) {
    this.deal = deal
    this.timing = base
    this.pressWindowMs = MIN_PRESS_SECONDS * 1000
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

  /**
   * This round's window, in milliseconds.
   *
   * A property of the weight on his pan and of nothing else — not of the Turk,
   * not of the arm, not of how long anybody has been playing. `window.ts` is the
   * only thing that can produce it.
   */
  get pressMs(): number {
    return this.pressWindowMs
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
    // The first blow of the round is what arms the sag. Before it, the child is
    // reading his column, and reading is not neglect.
    this.sagArmed = true
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
      // The pan settles under a load nobody is tending — but only once somebody
      // has tended it. A round nobody has touched yet is a round being read.
      if (this.sagArmed) {
        this.sagIdleMs += dt
        while (this.sagIdleMs >= this.timing.sagGraceMs + this.timing.sagPeriodMs) {
          this.sagIdleMs -= this.timing.sagPeriodMs
          this.loadValue -= 1
          events.push({ kind: "sag", load: this.loadValue })
        }
      }
    }

    this.elapsed += dt
    if (this.elapsed < this.duration) return events

    // Carried across the boundary, so a chunked frame does not quietly shave a
    // few milliseconds off every phase it crosses.
    const over = this.elapsed - this.duration
    switch (this.phaseName) {
      case "hang": {
        this.enter("press", this.pressWindowMs)
        this.sagArmed = false
        this.sagIdleMs = 0
        events.push({ kind: "open" })
        break
      }
      case "press": {
        // The whistle. The round is **over**, not lost.
        //
        // It used to judge the beam where it stood, on the argument that the
        // load was the claim the child had on the bar when time ran out. It is
        // not. It is where they had got to, and marking it took ground off them
        // *and* filed a wrong answer against a sum they were still working —
        // which walks the host's ladder DOWN on a child who was doing the
        // arithmetic. `mount.ts` closes the item with `skip` instead: an
        // absence, which is what it is.
        events.push(...this.expire())
        break
      }
      case "settle": {
        if (this.state.arm >= GROUND) {
          const bout = this.state.bout
          this.state.won += 1
          this.state.bout += 1
          this.state.arm = 0
          events.push({ kind: "won", bout })
        } else if (this.state.arm <= -GROUND) {
          // Pinned. Nothing is taken away: the arm goes back to level and the
          // same Turk squares up again. Stakes without loss — ADR-0009. What it
          // does do is drop the rung the yard asks for, which is relief rather
          // than punishment and is the only thing a pinning changes.
          this.state.arm = 0
          this.state.pinned += 1
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
    // The window comes from the weight and from nothing else. Computed here, at
    // the moment the item is known, so that by the time the phase machine needs
    // it there is no other number it could have come from.
    this.pressWindowMs = pressMsFor({ prompt: question.prompt, answer: this.target })

    const events: BoutEvent[] = []
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
    } else {
      const seat = openingLoad(this.target)
      const fromHere = strikesFor(this.target + 1 - this.loadValue)
      const fromSeat = strikesFor(this.target + 1 - seat)
      // The ladder moved out from under the pan. Rack it back rather than spend
      // the round unwinding the last one — the adaptation audit's one named
      // defect in this pack.
      if (fromHere > fromSeat + RERACK_SLACK) {
        this.loadValue = seat
        events.push({ kind: "rerack", load: this.loadValue })
      }
    }
    this.strainMeter = new Strain({ shearAt: this.timing.shearAt })
    this.sagArmed = false
    this.sagIdleMs = 0
    this.enter("hang", this.timing.hangMs)
    events.push({ kind: "hang", question, delta: this.target + 1 - this.loadValue })
    return events
  }

  /**
   * The whistle on a round nobody declared.
   *
   * No ground moves, no tally moves, nothing is reported. The only thing that
   * happens is that the beat is spent showing the child that time went, and then
   * the next weight comes down.
   */
  private expire(): BoutEvent[] {
    const question = this.current
    if (!question) return []
    const seat: Seat = {
      question,
      verdict: "expired",
      load: this.loadValue,
      asserted: this.loadValue - 1,
      ms: Math.max(0, Math.round(this.elapsed)),
      declared: false,
    }
    this.lastSeat = seat
    this.enter("settle", this.timing.settleMs)
    return [{ kind: "seat", seat, arm: this.state.arm }]
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
