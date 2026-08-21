// THE STEELYARD — the rules.
//
// ── Where you are ───────────────────────────────────────────────────────────
//
// The Steelyard is the weigh-house of the Dynawalla Bazaar: one room off the
// spice lane with a beam scale in the middle of it and a rack of brass weights
// on the wall. Nothing gets sold in this market until it has been across that
// beam, so there is a barrow at the door all day.
//
// You are the one weighing.
//
//   * **A lot comes onto the far pan** — two parcels off the same barrow, and the
//     chit that came with them says what each one is: `473 + 168`. Nobody has
//     added them up. That is the job.
//   * **You put brass on the near pan.** The rack is a weigh-house weight set,
//     which is why it is thousands, hundreds, tens and ones: that is what a
//     weight set *is*. You strike a plate to hang one on and strike the face
//     below it to take one off. Your brass stays on the pan between lots — you
//     only ever change the difference.
//   * **The brass has to just outweigh the goods.** One over. Not two, not
//     level: one.
//
// ── Why one over, and not level ─────────────────────────────────────────────
//
// This is the part that is real, and it is the reason the rule is not arbitrary.
//
// **A level beam is not a reading.** A beam sitting flat has not told you the
// goods weigh 641 — it has told you it has not decided, and a scale that has not
// decided is a scale you cannot write a number off. What you can trust is the
// *lightest brass that certainly tips it*. Put 642 on and the beam comes down on
// the brass side: now you know the goods are under 642, and 641 is the number
// that goes on the docket.
//
// So the weigh-house rule is the weighing itself:
//
//   * **One over and it is a good weight.** Strike **STAMP** and the docket goes
//     out with `brass − 1` written on it — which is exactly the value the child
//     computed, and exactly what crosses to the host.
//   * **Short** — the beam is still down on the goods' side. You have proved
//     nothing about them yet.
//   * **Over** — you piled on. All you have shown is that the goods are lighter
//     than some big number, which is no use to anybody, and the docket is
//     refused.
//
// ── What is *not* here ──────────────────────────────────────────────────────
//
// **There is no clock on the answer.** The round has no length. Nothing on the
// screen counts down, nothing drains, and a child may look at the chit for as
// long as they like, hang a weight, look again, and take it off again. The one
// thing that ends an untouched round is the abandonment guard in `guard.ts`,
// which measures *silence*, is reset by any hand on the rack, and is never drawn.
//
// **And nothing drains your pan.** There used to be a sag: leave the beam alone
// after your first blow and the pan settled a unit, then another. That is a clock
// taking something away from a child — the exact thing this game is not allowed
// to do — and it fired on the one behaviour we most want, which is a child
// stopping halfway to check their column. It is gone. Brass on a pan does not
// evaporate.
//
// What is left to stop a player who will not do the arithmetic is not a clock at
// all: it is **the strain in the steel**. Every blow rings the beam, ring
// compounds, and past the limit the beam shears — `strain.ts`. That is the answer
// to "what stops a child hitting plates fast", and it answers to their hands
// rather than to a timer.
//
// ── The day ─────────────────────────────────────────────────────────────────
//
// **The scale gets heavier by the arithmetic and by nothing else.** There is no
// counter in any duration in this file. The guard and the shear limit are the
// same at the ninth scale as at the first; what changes is the rung the yard asks
// the host for — `ladder.ts` — which moves up on a scale cleared and comes back
// down when a barrow goes back.

import type { Question } from "../contract.ts"
import { guardMsFor, MIN_GUARD_SECONDS } from "./guard.ts"
import { applyStrike, PILLAR_COOLDOWN_MS, strikesFor, type Place, type Strike } from "./places.ts"
import { Strain } from "./strain.ts"

/** How many dockets in a row, either way, decide a scale. */
export const RUN = 5

export type Phase =
  /** The lot is coming onto the far pan. The beam lurches; input is dead. */
  | "hang"
  /** Open. Hang brass, read the beam, stamp when you believe it. */
  | "press"
  /** The docket is showing. */
  | "settle"

export type Verdict =
  | "true"
  | "short"
  | "over"
  | "shear"
  /** Nobody was there. The lot went back on the barrow. Costs nothing, says nothing. */
  | "lapsed"

/**
 * Everything with a duration.
 *
 * Three beats and a limit, and **not one of them is a clock on the answer**.
 * `hang` and `settle` are theatre either side of the round; `shearAt` is a
 * property of the steel. The round itself has no entry here because the round
 * has no length, and a field for one is how a countdown would get back in.
 */
export type Timing = {
  /** The lot coming down. */
  readonly hangMs: number
  /** The docket beat. */
  readonly settleMs: number
  /** Strain at which the steel shears. */
  readonly shearAt: number
}

export const TIMING: Timing = {
  hangMs: 760,
  settleMs: 1150,
  shearAt: 34,
}

/**
 * Reduced motion is a branch, not a degradation. Every duration here is
 * identical to the one above; what changes is in `sim/beam.ts`, where the beam
 * travels to its reading instead of ringing its way there.
 */
export const TIMING_REDUCED: Timing = TIMING

/**
 * How far out of position the brass may be before the weigh-master resets it.
 *
 * Your brass staying where you left it is the good rule and it holds nearly
 * always: consecutive lots of the same size are a handful of strikes apart.
 * What it cannot survive is the ladder moving under it — a pan sitting on 8,367
 * when the next chit reads `43 + 25` costs a whole round of unwinding before any
 * arithmetic happens, which is a calm round spent on nothing. So when the brass
 * is this many strikes worse than a fresh set would be, the weigh-master clears
 * the pan and lays out a starting set. Measured in strikes rather than in
 * magnitude because strikes are the thing that costs the child time.
 */
export const RERACK_SLACK = 5

export type Day = {
  /** Which scale you are on, one-based. Bigger scale, heavier goods. */
  scale: number
  /** −RUN (the barrow goes back) … +RUN (the scale is cleared). */
  run: number
  /** Scales cleared, this session. */
  won: number
  /** Barrows sent back, this session. The relief half of the ladder. */
  sentBack: number
  /** Dockets stamped at a good weight, this session. */
  held: number
}

export type Docket = {
  readonly question: Question
  /** What the weigh-master made of it. */
  readonly verdict: Verdict
  /** The brass on the near pan at the moment of stamping. */
  readonly load: number
  /** The weight written on the docket: `load − 1`. */
  readonly asserted: number
  /** Milliseconds from the round opening to the stamp. Measured, never limited. */
  readonly ms: number
  /** True when the child struck STAMP rather than walking away. */
  readonly declared: boolean
}

export type BoutEvent =
  | { kind: "hang"; question: Question; delta: number }
  /** The weigh-master laid out a fresh set — the ladder moved out from under it. */
  | { kind: "rerack"; load: number }
  | { kind: "open" }
  | { kind: "strike"; strike: Strike; load: number; impulse: number }
  | { kind: "refused"; reason: "cooldown" | "phase" }
  | { kind: "stamp"; docket: Docket; run: number }
  | { kind: "won"; scale: number }
  | { kind: "sentBack"; scale: number }

/**
 * The brass already on the pan when the day starts.
 *
 * Deliberately not the answer and deliberately not an empty pan: a handful of
 * strikes away, on a value with the same shape, rounded so the opening move is
 * legible. The child's first act is to see that they are, say, 142 light.
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
  private state: Day = { scale: 1, run: 0, won: 0, sentBack: 0, held: 0 }
  private current: Question | null = null
  private target = 0
  private loadValue = 0
  private lastDocket: Docket | null = null
  private strainMeter: Strain
  private readonly timing: Timing
  /**
   * This round's abandonment guard. Set from the item at `hang`, from nothing
   * else ever — see `guard.ts`.
   */
  private guardWindowMs: number
  private readonly cooldowns = new Map<Place, number>()
  /**
   * Milliseconds since the last hand on the rack. **Not** time in the round:
   * every strike puts it back to zero, so the only thing it can ever measure is
   * a child who has stopped.
   */
  private idleMs = 0
  private stopped = false
  private started = false
  private seeded = false

  constructor(deal: () => Question, base: Timing = TIMING) {
    this.deal = deal
    this.timing = base
    this.guardWindowMs = MIN_GUARD_SECONDS * 1000
    this.strainMeter = new Strain({ shearAt: this.timing.shearAt })
    this.duration = this.timing.hangMs
  }

  get phase(): Phase {
    return this.phaseName
  }

  get day(): Day {
    return this.state
  }

  get question(): Question | null {
    return this.current
  }

  /** The goods' weight. Known to the game, never drawn. */
  get goods(): number {
    return this.target
  }

  /** The brass on your pan. */
  get load(): number {
    return this.loadValue
  }

  /** `load − goods`. Zero is dead level, which is not a reading; the job is 1. */
  get margin(): number {
    return this.loadValue - this.target
  }

  get strain(): Strain {
    return this.strainMeter
  }

  /** The docket currently on the spike, if one is showing. */
  get docket(): Docket | null {
    return this.phaseName === "settle" ? this.lastDocket : null
  }

  get paused(): boolean {
    return this.stopped
  }

  get elapsedMs(): number {
    return this.elapsed
  }

  get timings(): Timing {
    return this.timing
  }

  /**
   * This round's abandonment guard, in milliseconds.
   *
   * A property of the lot on the far pan and of nothing else — not of the scale,
   * not of the run, not of how long anybody has been playing. `guard.ts` is the
   * only thing that can produce it. **Nothing in `render/` may read this**, and
   * `guard.test.ts` scans that directory to hold the line: it is a guard, not a
   * gauge, and a guard a child can watch is a countdown.
   */
  get guardMs(): number {
    return this.guardWindowMs
  }

  /** How long the counter has been quiet. Zero after every blow. */
  get idle(): number {
    return this.idleMs
  }

  /** Whether this pillar is still swinging back. */
  cooling(place: Place): boolean {
    return (this.cooldowns.get(place) ?? 0) > 0
  }

  /**
   * The host has put something over the frame. **Everything stops dead.**
   *
   * This game calls `transition` every time a scale is cleared, and the SDK
   * documents that a transition may raise a sheet while leaving the pack mounted
   * and its rAF running. Without this the guard would run out behind that sheet
   * and rack a lot the child never saw — while the steel quietly healed. Time
   * behind a sheet is not the child's time in either direction.
   */
  pause(): void {
    this.stopped = true
  }

  resume(): void {
    this.stopped = false
  }

  /** Take the first lot. Legal once. */
  begin(): BoutEvent[] {
    if (this.started) return []
    this.started = true
    return this.hang()
  }

  /** Time passes. Returns everything that happened in it. */
  advance(dtMs: number): BoutEvent[] {
    if (this.stopped || dtMs <= 0 || !this.started) return []
    const events: BoutEvent[] = []
    let left = dtMs
    // Chunked so a long frame cannot skip a phase boundary.
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
   * Refused outside the round and refused while that pillar is still swinging
   * back. Every accepted strike moves the pan by exactly the place's value and
   * puts strain into the steel — and if that strain reaches the shear limit, the
   * round ends on the blow that broke it.
   */
  strike(strike: Strike): BoutEvent[] {
    if (this.stopped || this.phaseName !== "press") return [{ kind: "refused", reason: "phase" }]
    // A hand on the rack is a hand on the rack even when the plate is still
    // swinging back, so the guard is refilled before the refusal. Otherwise a
    // child drumming on one pillar could be told nobody was there.
    this.idleMs = 0
    if (this.cooling(strike.place)) return [{ kind: "refused", reason: "cooldown" }]

    this.cooldowns.set(strike.place, PILLAR_COOLDOWN_MS)
    const impulse = this.strainMeter.strike()
    this.loadValue = applyStrike(this.loadValue, strike)
    const events: BoutEvent[] = [{ kind: "strike", strike, load: this.loadValue, impulse }]
    if (this.strainMeter.isSheared) events.push(...this.judge(false, "shear"))
    return events
  }

  /** Strike STAMP: write the docket now. */
  stamp(): BoutEvent[] {
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

    this.elapsed += dt

    if (this.phaseName === "press") {
      this.strainMeter.advance(dt)
      this.idleMs += dt
      // **The round has no length.** The only thing that can end it from here is
      // silence — and every blow above put `idleMs` back to zero, so this can
      // never fire on somebody who is playing.
      if (this.idleMs >= this.guardWindowMs) events.push(...this.lapse())
      return events
    }

    if (this.elapsed < this.duration) return events

    // Carried across the boundary, so a chunked frame does not quietly shave a
    // few milliseconds off every beat it crosses.
    const over = this.elapsed - this.duration
    switch (this.phaseName) {
      case "hang": {
        this.enter("press", Number.POSITIVE_INFINITY)
        this.idleMs = 0
        events.push({ kind: "open" })
        break
      }
      case "settle": {
        if (this.state.run >= RUN) {
          const scale = this.state.scale
          this.state.won += 1
          this.state.scale += 1
          this.state.run = 0
          events.push({ kind: "won", scale })
        } else if (this.state.run <= -RUN) {
          // The barrow goes back. Nothing is taken away: the run goes to level
          // and the same scale carries on. Stakes without loss — ADR-0009. What
          // it does do is drop the rung the yard asks for, which is relief rather
          // than punishment and is the only thing it changes.
          this.state.run = 0
          this.state.sentBack += 1
          events.push({ kind: "sentBack", scale: this.state.scale })
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
    // The guard comes from the lot and from nothing else. Computed here, at the
    // moment the item is known, so that by the time the phase machine needs it
    // there is no other number it could have come from.
    this.guardWindowMs = guardMsFor({ prompt: question.prompt, answer: this.target })

    const events: BoutEvent[] = []
    // The very first lot of the day lands on an empty pan. Lay out a set within
    // striking distance so the first round is arithmetic rather than a hundred
    // blows on the thousands pillar.
    //
    // Flagged rather than tested against a load of zero: a player who happens to
    // clear their own pan would otherwise be handed a free reset onto the next
    // lot, which is a rule nobody was told about and a way to dodge a round you
    // had already lost.
    if (!this.seeded) {
      this.seeded = true
      this.loadValue = openingLoad(this.target)
    } else {
      const fresh = openingLoad(this.target)
      const fromHere = strikesFor(this.target + 1 - this.loadValue)
      const fromFresh = strikesFor(this.target + 1 - fresh)
      // The ladder moved out from under the pan. Lay out a fresh set rather than
      // spend the round unwinding the last one — the adaptation audit's one named
      // defect in this pack.
      if (fromHere > fromFresh + RERACK_SLACK) {
        this.loadValue = fresh
        events.push({ kind: "rerack", load: this.loadValue })
      }
    }
    this.strainMeter = new Strain({ shearAt: this.timing.shearAt })
    this.idleMs = 0
    this.enter("hang", this.timing.hangMs)
    events.push({ kind: "hang", question, delta: this.target + 1 - this.loadValue })
    return events
  }

  /**
   * Nobody was there.
   *
   * No run moves, no tally moves, nothing is reported. The lot goes back on the
   * barrow and the next one comes onto the pan. A child who was still carrying
   * the hundreds column has told us nothing, and filing that as a wrong answer
   * would be lying to the curriculum about them.
   */
  private lapse(): BoutEvent[] {
    const question = this.current
    if (!question) return []
    const docket: Docket = {
      question,
      verdict: "lapsed",
      load: this.loadValue,
      asserted: this.loadValue - 1,
      ms: Math.max(0, Math.round(this.elapsed)),
      declared: false,
    }
    this.lastDocket = docket
    this.enter("settle", this.timing.settleMs)
    return [{ kind: "stamp", docket, run: this.state.run }]
  }

  private judge(declared: boolean, forced?: "shear"): BoutEvent[] {
    const question = this.current
    if (!question) return []
    const margin = this.margin
    const verdict: Verdict =
      forced === "shear" ? "shear" : margin === 1 ? "true" : margin < 1 ? "short" : "over"
    const docket: Docket = {
      question,
      verdict,
      load: this.loadValue,
      asserted: this.loadValue - 1,
      ms: Math.max(0, Math.round(this.elapsed)),
      declared,
    }
    this.lastDocket = docket
    // The run moves by one either way. A day at the counter is a tally, not a
    // scoreline.
    if (verdict === "true") {
      this.state.run = Math.min(RUN, this.state.run + 1)
      this.state.held += 1
    } else {
      this.state.run = Math.max(-RUN, this.state.run - 1)
    }
    this.enter("settle", this.timing.settleMs)
    return [{ kind: "stamp", docket, run: this.state.run }]
  }

  private enter(phase: Phase, duration: number): void {
    this.phaseName = phase
    this.elapsed = 0
    this.duration = duration
  }
}
