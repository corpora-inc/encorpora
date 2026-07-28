// The bout — the rules of the match, with nothing drawn.
//
// Every judgement in the game lives here and is synchronous, pure integer
// arithmetic over the current fall. The renderer reads this state; it never
// decides anything. That split is what lets the whole loop be tested without a
// canvas, and it is why the tests in `bout.test.ts` are about the rules and not
// about pixels.
//
// A fall, end to end:
//
//   LOCKUP   the challenger takes you down. ~0.8s. Taps skip it.
//   PIN      the referee's board shows the sum; the count begins. Two plates.
//            Land the exact total and you kick out. Anything else loses the
//            fall — over the total, out of moves, or out of count.
//   KICKOUT  the escape. Budget comes from the reaction tier the fall earned.
//   PINFALL  silence. The crowd bed cuts, nothing bursts, the referee's hand
//            comes down. Shorter and quieter than the escape, always, because
//            `energy(SLIP) < energy(SEAT)` is a rule and not a preference.

import type { Host, Question } from "../contract.ts"
import { Rng } from "../core/rng.ts"
import { choosePlates, minTapsFor, reachable, type Plates } from "./plates.ts"
import { reactionTier, REACTIONS, type ReactionTier } from "./reaction.ts"

export type Phase = "lockup" | "pin" | "kickout" | "pinfall"

/** How a fall ended. Exactly one of these is reported per served item. */
export type FallOutcome = "escaped" | "overshot" | "stuck" | "counted-out"

export type PlateSide = "a" | "b"

export type BoutEvent =
  | { kind: "lockup"; challenger: string }
  | { kind: "pin-begin" }
  | { kind: "slap"; index: 1 | 2 | 3 }
  | { kind: "load"; side: PlateSide; value: number; load: number; fraction: number }
  | { kind: "false-finish"; value: number }
  | { kind: "escape"; tier: ReactionTier; taps: number; minTaps: number; repaired: boolean }
  | {
      kind: "pinfall"
      reason: Exclude<FallOutcome, "escaped">
      /** The bar came to rest on the exact output of a known broken procedure. */
      diagnosed: boolean
    }
  | { kind: "cast"; beltPlates: number }
  | { kind: "title"; challenger: string; beaten: number }

/** The three slaps, and then you are out. */
export const SLAP_COUNT = 3

const LOCKUP_S = 0.82
const PINFALL_S = 1.3
/** A false finish costs count, but it may never *be* the third slap. */
const FALSE_FINISH_COST_S = 0.36
const FALSE_FINISH_SAFETY_S = 0.55

/**
 * Escapes needed to put a challenger away.
 *
 * Driven by how many challengers have been **beaten**, never by how many have
 * walked out. Losing a bout brings a fresh opponent out at the same demand: a
 * game that asked for one more escape after a defeat would be escalating on
 * failure, which is the shape of thing this product does not do.
 */
export function fallsToBeat(challengersBeaten: number): number {
  return 4 + Math.min(4, challengersBeaten)
}

/**
 * Challengers cast in the foundry. Names only — the art is procedural and the
 * names exist so a child can tell one bout from the next and so the title beat
 * has something true to say.
 */
export const CHALLENGERS = [
  "THE BELLOWS",
  "SLAG BROTHER",
  "COLD CHISEL",
  "THE ANVIL WIDOW",
  "TONGS",
  "QUENCH",
  "THE CRUCIBLE",
  "HAMMERHEAD",
] as const

/**
 * Whatever the host reports, squashed to 0..1.
 *
 * The pack host sends `item.level / 8`, already normalised. A host that sent a
 * raw 1..10 ladder index instead would otherwise pin every fall at maximum
 * pressure, so the out-of-range branch exists and is tested rather than assumed
 * unreachable.
 */
export function normalizeDifficulty(d: number): number {
  if (!Number.isFinite(d)) return 0
  if (d <= 1) return Math.max(0, d)
  return Math.max(0, Math.min(1, (d - 1) / 9))
}

/** Digits in the prompt — a cheap, honest proxy for how long it takes to read. */
export function promptDigits(prompt: string): number {
  let n = 0
  for (const ch of prompt) if (ch >= "0" && ch <= "9") n++
  return n
}

/**
 * Seconds between referee slaps.
 *
 * **Time is a function of the work, never of the run.** A longer decomposition
 * and a longer sum both buy count; winning six falls in a row buys nothing,
 * because a clock that tightens on a streak is the loop this product bans. The
 * only concession to the ladder is a ~15% tempo lift across its whole length,
 * which is pace, not pressure.
 *
 * The canon asked for four seconds. A single-digit sum with a three-tap escape
 * lands at almost exactly that; `4,003 − 87` gets nearer eight, because a child
 * who can do that sum still has to *do* it.
 */
export function slapPeriodFor(minTaps: number, digits: number, difficulty: number): number {
  const base = 0.55 + 0.17 * Math.max(0, minTaps) + 0.19 * Math.max(0, digits)
  const tempo = 1.06 - 0.16 * Math.max(0, Math.min(1, difficulty))
  return Math.max(1.05, Math.min(3.2, base * tempo))
}

export type Fall = {
  questionId: string
  prompt: string
  target: number
  plates: Plates
  /** What is on the bar right now. Starts at 0, only ever rises. */
  load: number
  taps: number
  /** Taps spent on each plate, so the escape can be read back as a sentence. */
  tapsA: number
  tapsB: number
  /** The fewest taps this escape could cost from an empty bar. */
  minTaps: number
  /** Mal-rule totals: values a real broken procedure produces, either side of the target. */
  traps: number[]
  /** Traps already sprung — each one only ever fires once. */
  sprung: number[]
  slapPeriod: number
  /** Seconds since the pin began. */
  elapsed: number
  /** Seconds of count eaten by false finishes. */
  advance: number
  /** Slaps that have landed, 0..3. */
  slaps: number
  difficulty: number
}

export type BoutOptions = {
  host: Host
  seed?: number
  /** Called for every rule-level event, in order, during `tick`. */
  onEvent?: (e: BoutEvent) => void
}

export class Bout {
  private readonly host: Host
  private readonly rng: Rng
  private readonly emit: (e: BoutEvent) => void

  phase: Phase = "lockup"
  /** Seconds remaining in a non-`pin` phase. */
  phaseLeft = LOCKUP_S
  fall: Fall
  /** 0..1. Crowd noise and lantern light only — it touches no rule and no clock. */
  heat = 0.1
  /** Cast onto the belt on every escape, and never taken off again. */
  beltPlates = 0
  challengerIndex = 0
  /** Escapes taken off the current challenger. */
  falls = 0
  /** Falls the current challenger has taken off you. */
  lost = 0
  challengersBeaten = 0
  /** The reaction the last escape earned, for the renderer to size the beat by. */
  lastTier: ReactionTier = 0
  lastOutcome: FallOutcome | null = null

  constructor(options: BoutOptions) {
    this.host = options.host
    this.rng = new Rng(options.seed ?? 0x9a11ed)
    this.emit = options.onEvent ?? (() => {})
    this.fall = this.cutFall()
  }

  get challenger(): string {
    return CHALLENGERS[this.challengerIndex % CHALLENGERS.length] as string
  }

  /** Escapes still owed before this challenger is beaten. */
  get toBeat(): number {
    return Math.max(0, fallsToBeat(this.challengersBeaten) - this.falls)
  }

  /** 0..1 through the count. 1 is the third slap. */
  get countFraction(): number {
    if (this.phase !== "pin") return 0
    const window = this.fall.slapPeriod * SLAP_COUNT
    return Math.max(0, Math.min(1, (this.fall.elapsed + this.fall.advance) / window))
  }

  /** Cut the next fall: pull an item, turn its value into a target, hang plates. */
  private cutFall(): Fall {
    const q: Question = this.host.next()
    const parsed = Number.parseInt(q.answer, 10)
    // A pool that ran dry hands back a drawable question with no id. The fall is
    // still playable — a child must never see a frozen ring — but nothing about
    // it is reported, because there is no item to report it against.
    const usable = Number.isInteger(parsed) && parsed >= 1
    const target = usable ? parsed : 12
    const difficulty = normalizeDifficulty(q.difficulty)
    const plates = choosePlates(target, this.rng, { pressure: difficulty })
    const minTaps = minTapsFor(target, plates.a, plates.b) ?? plates.taps

    // Mal-rule totals, above and below the target alike, because the two are
    // different beats rather than one beat and one dead case:
    //
    //   * **Below** the target the bar passes through the value and the fall
    //     goes on. The hall comes up, the referee waves it off, it costs count.
    //   * **Above** it, the bar can only arrive there by going over — so the
    //     fall is already lost when it lands. It is still worth naming: the
    //     value is not noise, it is a specific broken procedure, and the child
    //     gets told what was refused rather than just that something was.
    //
    // The second case is the only one subtraction has. Every mal-rule this
    // domain produces for a difference comes out *larger* than the difference —
    // smaller-from-larger skips the borrow, borrow-across-zero keeps a thousand
    // it should have given up, and reading `−` as `+` is larger still. A rule
    // that only kept the ones below the target would have left every
    // subtraction fall with no diagnosis at all.
    const traps: number[] = []
    for (const d of q.distractors) {
      const v = Number.parseInt(d, 10)
      if (!Number.isInteger(v) || v < 1 || v === target) continue
      if (!traps.includes(v)) traps.push(v)
    }

    return {
      questionId: usable ? q.id : "",
      prompt: q.prompt,
      target,
      plates,
      load: 0,
      taps: 0,
      tapsA: 0,
      tapsB: 0,
      minTaps,
      traps,
      sprung: [],
      slapPeriod: slapPeriodFor(minTaps, promptDigits(q.prompt), difficulty),
      elapsed: 0,
      advance: 0,
      slaps: 0,
      difficulty,
    }
  }

  /**
   * Advance the rules. `dt` is seconds of *simulation* time, already scaled.
   *
   * Clamped to a quarter-second because a tab that was backgrounded for a
   * minute must not deliver a minute of count in one frame — a child coming
   * back to three slaps they never saw has been cheated by the app, not beaten
   * by the game. The visibility handler pauses the loop as well; this is the
   * belt to that pair of braces.
   */
  tick(dt: number): void {
    const step = Math.max(0, Math.min(0.25, dt))
    this.decayHeat(step)

    if (this.phase === "pin") {
      this.fall.elapsed += step
      const t = this.fall.elapsed + this.fall.advance
      while (this.fall.slaps < SLAP_COUNT && t >= (this.fall.slaps + 1) * this.fall.slapPeriod) {
        this.fall.slaps++
        this.emit({ kind: "slap", index: this.fall.slaps as 1 | 2 | 3 })
        this.host.haptic(this.fall.slaps === SLAP_COUNT ? "heavy" : "medium")
      }
      if (this.fall.slaps >= SLAP_COUNT) this.loseFall("counted-out")
      return
    }

    this.phaseLeft -= step
    if (this.phaseLeft > 0) return
    if (this.phase === "lockup") {
      this.phase = "pin"
      this.emit({ kind: "pin-begin" })
      return
    }
    // A kickout or a pinfall has played out. Next challenger takedown.
    this.nextFall()
  }

  /**
   * A plate went down.
   *
   * During a lockup this skips the takedown instead of loading — a child who is
   * already reaching for the pedals should not have their first tap eaten by an
   * animation, and should not have it spent either.
   */
  tap(side: PlateSide): void {
    if (this.phase === "lockup") {
      this.phaseLeft = 0
      return
    }
    // A tap during the escape or the pinfall cuts the beat short. It never
    // loads, so nothing is ever spent on a screen that was not asking for it.
    if (this.phase !== "pin") {
      if (this.phaseLeft > 0.16) this.phaseLeft = 0.16
      return
    }

    const f = this.fall
    const value = side === "a" ? f.plates.a : f.plates.b
    f.load += value
    f.taps++
    if (side === "a") f.tapsA++
    else f.tapsB++
    const fraction = f.target > 0 ? Math.min(1, f.load / f.target) : 1
    this.emit({ kind: "load", side, value, load: f.load, fraction })

    if (f.load === f.target) {
      this.escape()
      return
    }
    if (f.load > f.target) {
      this.host.haptic("failure")
      this.loseFall("overshot")
      return
    }
    // Below the target from here down.
    // A known wrong answer, reached exactly. The crowd comes up, the referee
    // waves it off, and it costs count — but never the fall. A false finish
    // that could itself end the match would be a trap, and the child would have
    // learned that a mal-rule is fatal rather than that it is wrong.
    let falseFinish = false
    if (f.traps.includes(f.load) && !f.sprung.includes(f.load)) {
      falseFinish = true
      f.sprung.push(f.load)
      const window = f.slapPeriod * SLAP_COUNT
      const room = Math.max(0, window - FALSE_FINISH_SAFETY_S - (f.elapsed + f.advance))
      f.advance += Math.min(FALSE_FINISH_COST_S, room)
      this.emit({ kind: "false-finish", value: f.load })
    }
    // The bar is under the target and there is no combination of these two
    // plates that closes the gap. Not out of time and not over — out of moves,
    // which is the shape the coin problem actually has, and saying so at once
    // is more honest than running a count down on a dead position.
    if (!reachable(f.target - f.load, f.plates.a, f.plates.b)) {
      this.host.haptic("failure")
      this.loseFall("stuck")
      return
    }
    this.host.haptic(falseFinish ? "medium" : "light")
  }

  private escape(): void {
    const f = this.fall
    const repaired = f.sprung.length > 0
    const tier = reactionTier({
      difficulty: f.difficulty,
      minTaps: f.minTaps,
      taps: f.taps,
      repaired,
    })
    this.lastTier = tier
    this.lastOutcome = "escaped"
    this.report(true, String(f.target))
    this.host.haptic("success")

    this.beltPlates++
    this.falls++
    this.heat = Math.min(1, this.heat + 0.15)
    this.emit({ kind: "escape", tier, taps: f.taps, minTaps: f.minTaps, repaired })
    this.emit({ kind: "cast", beltPlates: this.beltPlates })

    if (this.falls >= fallsToBeat(this.challengersBeaten)) {
      const beaten = this.challenger
      this.challengersBeaten++
      this.emit({ kind: "title", challenger: beaten, beaten: this.challengersBeaten })
      // A stopping point the child *reached*. Only ever here: never after a
      // pinfall, never after the count, never after an overshoot.
      this.host.transition?.("level", beaten)
      this.challengerIndex++
      this.falls = 0
      this.lost = 0
    }

    this.phase = "kickout"
    this.phaseLeft = Math.max(0.75, REACTIONS[tier].budgetMs / 1000)
  }

  private loseFall(reason: Exclude<FallOutcome, "escaped">): void {
    const f = this.fall
    this.lastOutcome = reason
    this.lastTier = -1
    // Where the bar came to rest, and whether that is a value with a name.
    const diagnosed = f.traps.includes(f.load)
    this.report(false, f.load > 0 ? String(f.load) : "")
    this.lost++
    // The crowd goes quiet. Nothing the child built comes off the belt.
    this.heat = Math.max(0, this.heat - 0.24)
    this.emit({ kind: "pinfall", reason, diagnosed })
    if (this.lost >= SLAP_COUNT) {
      // The challenger takes the bout. A fresh one walks out; the belt keeps
      // every plate it was ever handed.
      this.challengerIndex++
      this.falls = 0
      this.lost = 0
    }
    this.phase = "pinfall"
    this.phaseLeft = PINFALL_S
  }

  /** Exactly once per fall, and only for an item the host actually served. */
  private report(correct: boolean, answered: string): void {
    const f = this.fall
    if (f.questionId === "") return
    this.host.report({
      questionId: f.questionId,
      correct,
      ms: Math.round(f.elapsed * 1000),
      answered,
    })
    f.questionId = ""
  }

  private nextFall(): void {
    this.fall = this.cutFall()
    this.phase = "lockup"
    this.phaseLeft = LOCKUP_S
    this.emit({ kind: "lockup", challenger: this.challenger })
  }

  private decayHeat(dt: number): void {
    const floor = 0.08
    if (this.heat > floor) this.heat = Math.max(floor, this.heat - dt * 0.035)
  }
}
