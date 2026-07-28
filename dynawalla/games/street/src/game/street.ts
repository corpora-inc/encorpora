// The street, as a machine.
//
// Driven by elapsed milliseconds rather than by frames, so `street.test.ts`
// plays whole blocks with no canvas, no rAF and no clock — and so the one thing
// that must be true about time here can be tested at all.
//
// ## The clock, and the sheet
//
// The host may put a sheet over a pack that is **still mounted and still
// running** and send `pause`. This game calls `transition` when a block is
// finished, which is precisely the call that raises the sheet, so it is not a
// hypothetical. Two things would go wrong without a guard, and both of them
// take something from the child:
//
//   * A phase behind the sheet would run to its end. A wave would clear, a
//     shutter would roll, a block would tick over, all unwatched.
//   * The latency reported for a shutter is measured on this machine's own
//     clock, and a clock that keeps running behind a sheet reports forty
//     seconds of thinking for a plate the child never saw. The host records
//     that against them.
//
// So `advance` stops dead while paused and the clock does not accumulate, which
// means every wall-clock mark this file holds is automatically shifted forward
// by exactly the length of the pause. Input is refused separately, because
// "the machine did not move" and "the tap did not count" are two different
// guards and removing either one is a bug on its own.

import { CRACK_PX_PER_S, TIMING, type Timing, crackMs } from "../core/feel.ts"
import type { Rng } from "../core/rng.ts"
import {
  type Crowd,
  type PunchResult,
  type StrikeResult,
  isCleanBreak,
  isCleared,
  newCrowd,
  punch,
  strike,
} from "./crowd.ts"
import { type Beat } from "./energy.ts"
import { bestSeam, isPrime, minimumTaps, smallestPrimeFactor } from "./factor.ts"
import { type Push, isShoved, newPush, pressed, relieved } from "./push.ts"
import {
  type Shutter,
  type ShutterSource,
  newShutter,
  strikeRivet,
} from "./shutter.ts"
import { WAVES_PER_BLOCK, nextWaveSize } from "./wave.ts"

export type Phase =
  /** The plate coming down. */
  | "shutter-down"
  /** The plate is up on the wall and readable. **Input open.** */
  | "shutter"
  /** A rivet caving in. */
  | "rivet"
  /** The plate going up. */
  | "shutter-up"
  /** The mob walking on. */
  | "approach"
  /** The mob is in front of you. **Input open.** */
  | "melee"
  /** A seam landed and the crack is running. */
  | "crack"
  /** A seam refused. */
  | "ringoff"
  /** Fists off locked arms. */
  | "bounce"
  /** A rank going down. */
  | "fall"
  /** The street empty. */
  | "clear"
  /** Shoved back. */
  | "shove"

export type StreetEvent =
  | { readonly kind: "shutter"; readonly shutter: Shutter }
  | {
      readonly kind: "report"
      readonly questionId: string
      readonly answered: string
      readonly correct: boolean
      readonly ms: number
    }
  | { readonly kind: "wave"; readonly size: number; readonly solid: boolean }
  | { readonly kind: "crack"; readonly seam: number; readonly crowd: Crowd }
  | { readonly kind: "ringoff"; readonly seam: number; readonly remainder: number }
  | { readonly kind: "bounce"; readonly size: number }
  | { readonly kind: "down"; readonly felled: number; readonly crowd: Crowd }
  | {
      readonly kind: "cleared"
      readonly size: number
      readonly taps: number
      readonly clean: boolean
      readonly solid: boolean
    }
  | { readonly kind: "shove" }
  | { readonly kind: "block"; readonly blocks: number }
  /** Everything that wants a sound, a shake and a motor. Ordered with the rest. */
  | { readonly kind: "beat"; readonly beat: Beat; readonly size: number; readonly best: boolean }

export type StreetOptions = {
  /** Where the plates come from. Called once per shutter. */
  readonly deal: () => ShutterSource
  readonly rng: Rng
  readonly timing?: Timing
}

/** How wide the crack has to run, before the scene has ever been measured. */
const DEFAULT_STREET_PX = 720

export class Street {
  private readonly deal: () => ShutterSource
  private readonly rng: Rng
  private readonly timing: Timing

  private phaseName: Phase = "shutter-down"
  private elapsed = 0
  private duration: number
  private stopped = false

  /** Monotonic while running, frozen while paused. Every mark below is on it. */
  private clock = 0
  private litAt = 0

  private streetPx = DEFAULT_STREET_PX

  private plate: Shutter | null = null
  private mob: Crowd = newCrowd(4)
  private pushState: Push = newPush()

  private waveSize = 0
  private previousSize = 0
  private tapCount = 0
  private errorCount = 0
  private hint = 0

  private blockIndex = 0
  private waveInBlock = 0
  private blocksDone = 0

  constructor(options: StreetOptions) {
    this.deal = options.deal
    this.rng = options.rng
    this.timing = options.timing ?? TIMING
    this.duration = this.timing.shutterDown
  }

  get phase(): Phase {
    return this.phaseName
  }

  get crowd(): Crowd {
    return this.mob
  }

  get shutter(): Shutter | null {
    return this.plate
  }

  get push(): Push {
    return this.pushState
  }

  get blocks(): number {
    return this.blocksDone
  }

  get block(): number {
    return this.blockIndex
  }

  get waveOfBlock(): number {
    return this.waveInBlock
  }

  get taps(): number {
    return this.tapCount
  }

  /** The lit stud after a shove-back. `0` when there is no hint standing. */
  get hintSeam(): number {
    return this.hint
  }

  get paused(): boolean {
    return this.stopped
  }

  /** 0..1 through the current phase. The renderer's only clock. */
  get progress(): number {
    if (this.duration <= 0) return 1
    return Math.max(0, Math.min(1, this.elapsed / this.duration))
  }

  get elapsedMs(): number {
    return this.elapsed
  }

  get durationMs(): number {
    return this.duration
  }

  /** Whether a tap would be read right now. Drives the renderer's affordances. */
  get open(): boolean {
    if (this.stopped) return false
    return this.phaseName === "melee" || this.phaseName === "shutter"
  }

  /**
   * How wide the crack runs. Set on every resize.
   *
   * The crack is a **speed** (`CRACK_PX_PER_S`), so this changes how long a
   * break takes rather than how fast it looks — which is the point: a break
   * across an iPad is a longer event than the same break on a phone, and it
   * should be.
   */
  setStreetWidth(px: number): void {
    this.streetPx = Math.max(80, px)
  }

  /**
   * The host put something over the frame. **The clock stops dead.**
   * See the file header for what a running clock costs the child here.
   */
  pause(): void {
    this.stopped = true
  }

  resume(): void {
    this.stopped = false
  }

  /** The first plate. Idempotent — a second call is a no-op. */
  begin(): StreetEvent[] {
    if (this.plate !== null) return []
    return this.raisePlate()
  }

  private raisePlate(): StreetEvent[] {
    this.plate = newShutter(this.deal(), this.rng)
    this.enter("shutter-down")
    return []
  }

  private enter(phase: Phase): void {
    this.phaseName = phase
    this.elapsed = 0
    this.duration = this.durationOf(phase)
    if (phase === "shutter") this.litAt = this.clock
  }

  private durationOf(phase: Phase): number {
    switch (phase) {
      case "shutter-down":
        return this.timing.shutterDown
      case "shutter":
        return 0
      case "rivet":
        return this.timing.rivet
      case "shutter-up":
        return this.timing.shutterUp
      case "approach":
        return this.timing.approach
      case "melee":
        return 0
      case "crack":
        return crackMs(this.streetPx) + this.timing.settle
      case "ringoff":
        return this.timing.ringoff
      case "bounce":
        return this.timing.bounce
      case "fall":
        return this.timing.fall
      case "clear":
        return this.timing.clear
      case "shove":
        return this.timing.shove
    }
  }

  /** The two phases that wait on the child rather than on the clock. */
  private waits(phase: Phase): boolean {
    return phase === "melee" || phase === "shutter"
  }

  advance(dt: number): StreetEvent[] {
    // Guard one: the machine does not move behind a sheet, and the clock does
    // not accumulate, which is what shifts every mark forward by the length of
    // the pause. Removing this line breaks three tests in `street.test.ts`.
    if (this.stopped) return []
    const step = Math.max(0, dt)
    this.clock += step
    if (this.waits(this.phaseName)) return []

    const out: StreetEvent[] = []
    this.elapsed += step
    // A `while`, not an `if`: a frame delta longer than a phase would otherwise
    // owe the child a beat that never played.
    let guard = 0
    while (this.elapsed >= this.duration && !this.waits(this.phaseName) && guard++ < 24) {
      const over = this.elapsed - this.duration
      out.push(...this.finish())
      this.elapsed += over
      if (this.waits(this.phaseName)) break
    }
    return out
  }

  /** The current phase ran out. Decide what the street does next. */
  private finish(): StreetEvent[] {
    switch (this.phaseName) {
      case "shutter-down":
        this.enter("shutter")
        return this.plate === null ? [] : [{ kind: "shutter", shutter: this.plate }]

      case "rivet":
        this.enter("shutter")
        return []

      case "shutter-up":
        return this.startWave()

      case "approach":
        this.enter("melee")
        return []

      case "crack":
      case "ringoff":
      case "bounce":
        this.enter("melee")
        return []

      case "fall": {
        if (isCleared(this.mob)) return this.finishWave()
        this.enter("melee")
        return []
      }

      case "clear":
        return this.afterWave()

      case "shove":
        return this.restartWave()

      // Waiting phases never expire; `advance` returns before it reaches here.
      case "melee":
      case "shutter":
        return []
    }
  }

  private startWave(): StreetEvent[] {
    const size = nextWaveSize(this.rng, this.blockIndex, this.previousSize)
    this.waveSize = size
    this.hint = 0
    this.previousSize = size
    this.mob = newCrowd(size)
    this.pushState = newPush()
    this.tapCount = 0
    this.errorCount = 0
    this.enter("approach")
    return [{ kind: "wave", size, solid: isPrime(size) }]
  }

  private finishWave(): StreetEvent[] {
    const size = this.waveSize
    const clean = isCleanBreak(this.tapCount, this.errorCount, minimumTaps(size))
    const solid = isPrime(size)
    this.hint = 0
    this.enter("clear")
    return [
      { kind: "cleared", size, taps: this.tapCount, clean, solid },
      { kind: "beat", beat: solid ? "solid" : "cleared", size, best: clean },
    ]
  }

  private afterWave(): StreetEvent[] {
    this.waveInBlock += 1
    const out: StreetEvent[] = []
    if (this.waveInBlock >= WAVES_PER_BLOCK) {
      this.waveInBlock = 0
      this.blockIndex += 1
      this.blocksDone += 1
      out.push({ kind: "block", blocks: this.blocksDone })
      out.push({ kind: "beat", beat: "block", size: this.waveSize, best: false })
    }
    // A fresh plate, and therefore a fresh wave: the hint is spent.
    this.waveSize = 0
    out.push(...this.raisePlate())
    return out
  }

  private restartWave(): StreetEvent[] {
    // The same mob comes back, and the smallest prime that goes into it is lit
    // on the bar. Scaffolding, not a punishment: nothing built was taken, and
    // the child gets the one fact that unsticks them.
    this.hint = smallestPrimeFactor(this.waveSize)
    this.mob = newCrowd(this.waveSize)
    this.pushState = newPush()
    this.tapCount = 0
    this.errorCount = 0
    this.enter("approach")
    return [{ kind: "wave", size: this.waveSize, solid: isPrime(this.waveSize) }]
  }

  /** A slip: the mob leans in, and may lean all the way in. */
  private lean(): StreetEvent[] {
    this.errorCount += 1
    this.pushState = pressed(this.pushState)
    if (!isShoved(this.pushState)) return []
    this.enter("shove")
    return [
      { kind: "shove" },
      { kind: "beat", beat: "shove", size: this.mob.size, best: false },
    ]
  }

  // ---------------------------------------------------------------- input --

  /**
   * Strike stud `k` at the mob.
   *
   * Guard two: a tap behind a sheet is not a tap. This is separate from the
   * clock guard on purpose — a machine that stood still but still took input
   * would spend the child's seam on a screen they could not see.
   */
  strikeStud(k: number): StreetEvent[] {
    if (this.stopped || this.phaseName !== "melee") return []
    const result: StrikeResult = strike(this.mob, k)
    if (result.kind === "ringoff") {
      this.mob = result.crowd
      const out: StreetEvent[] = [
        { kind: "ringoff", seam: result.seam, remainder: result.remainder },
        { kind: "beat", beat: "ringoff", size: this.mob.size, best: false },
      ]
      const shoved = this.lean()
      if (shoved.length === 0) this.enter("ringoff")
      return [...out, ...shoved]
    }
    const best = bestSeam(result.wasSize) === result.seam
    this.mob = result.crowd
    this.tapCount += 1
    this.hint = 0
    this.enter("crack")
    return [
      { kind: "crack", seam: result.seam, crowd: this.mob },
      { kind: "beat", beat: "crack", size: result.wasSize, best },
    ]
  }

  /** Swing at the front rank. A claim that the rank in front of you is prime. */
  swing(): StreetEvent[] {
    if (this.stopped) return []
    // Punches **chain**: a swing lands during the fall of the rank before it.
    // Eight ranks going down has to feel like a combo rather than like a queue,
    // and a beat-'em-up that made you wait 300 ms between fists would be the
    // wrong genre. A strike does not chain — re-cutting a mob mid-crack would
    // mean the child never sees the rectangle they just made.
    if (this.phaseName !== "melee" && this.phaseName !== "fall") return []
    // The last rank is already on its way down. A tap into an empty street is
    // not a claim about anything, so it is neither a bounce nor a mark.
    if (this.mob.ranks === 0) return []
    const result: PunchResult = punch(this.mob)
    if (result.kind === "bounce") {
      const out: StreetEvent[] = [
        { kind: "bounce", size: result.size },
        { kind: "beat", beat: "bounce", size: result.size, best: false },
      ]
      const shoved = this.lean()
      if (shoved.length === 0) this.enter("bounce")
      return [...out, ...shoved]
    }
    const felled = result.felled
    this.mob = result.crowd
    this.tapCount += 1
    this.pushState = relieved(this.pushState)
    this.enter("fall")
    return [
      { kind: "down", felled, crowd: this.mob },
      { kind: "beat", beat: "down", size: felled, best: false },
    ]
  }

  /**
   * Hit rivet `index` on the plate.
   *
   * Guard three, and the one with a number attached: the latency reported here
   * is `this.clock - this.litAt`, both of which are frozen while paused. A
   * strike accepted behind a sheet would carry the length of the sheet as the
   * child's thinking time.
   */
  hitRivet(index: number): StreetEvent[] {
    if (this.stopped || this.phaseName !== "shutter" || this.plate === null) return []
    const before = this.plate
    const result = strikeRivet(before, index)
    if (result.shutter === before) return []
    this.plate = result.shutter

    const out: StreetEvent[] = []
    if (result.report !== null) {
      out.push({
        kind: "report",
        questionId: result.report.questionId,
        answered: result.report.answered,
        correct: result.opened,
        ms: Math.max(0, Math.round(this.clock - this.litAt)),
      })
    }
    if (result.opened) {
      out.push({ kind: "beat", beat: "rivetRight", size: 0, best: false })
      this.enter("shutter-up")
      return out
    }
    out.push({ kind: "beat", beat: "rivetWrong", size: 0, best: false })
    // The rivet is out and the plate is still down: that is the whole cost, and
    // it is deliberately not also a push on the mob. The answer has already
    // gone to the host, which is where a wrong answer belongs. Charging for it
    // twice — once on the record and once on the street — would make a child
    // who is genuinely working out `503 − 178` worse off than one who guesses
    // fast, and it would make the arithmetic the thing to be afraid of.
    this.enter("rivet")
    return out
  }

  /** Tests and the renderer: the crack's speed is a stated design number. */
  static get crackSpeed(): number {
    return CRACK_PX_PER_S
  }
}
