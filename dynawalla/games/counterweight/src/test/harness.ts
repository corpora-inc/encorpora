// A headless player.
//
// `play()` drives a real `Bout` — the same class `mount.ts` drives — at a fixed
// 16 ms step, feeding it strikes from a strategy. That is what lets the mashing
// tests be an experiment rather than an argument: the masher is not a
// description of mashing, it is a player, and it plays the shipping rules.

import { Bout, type BoutEvent, type Timing, type Verdict } from "../game/bout.ts"
import { FACES, planStrikes, type Strike } from "../game/places.ts"
import type { Question } from "../contract.ts"
import { Rng } from "../core/rng.ts"
import { Beam, TUNING } from "../sim/beam.ts"
import { createStubHost } from "../stubHost.ts"

export type Table = {
  /** The bout under way, so a strategy can read the beam and the clock. */
  readonly bout: Bout
  /** The beam, integrated alongside — a strategy that watches it pays for it. */
  readonly beam: Beam
  readonly rng: Rng
  /** Milliseconds since this window opened. */
  readonly windowMs: number
}

/** Return the actions to take on this tick. `"seat"` judges the beam. */
export type Strategy = (table: Table) => ReadonlyArray<Strike | "seat">

export type Play = {
  readonly won: number
  readonly held: number
  readonly rounds: number
  readonly verdicts: Record<Verdict, number>
  readonly bestArm: number
  readonly reports: ReadonlyArray<{ correct: boolean; answered: string }>
}

export type PlayOptions = {
  readonly seed?: number
  readonly seconds?: number
  readonly level?: number
  readonly timing?: Timing
}

const STEP = 16

export function play(strategy: Strategy, options: PlayOptions = {}): Play {
  const host = createStubHost({
    seed: options.seed ?? 0x51ee,
    reducedMotion: true,
    ...(options.level === undefined ? {} : { level: options.level }),
  })
  const rng = new Rng((options.seed ?? 0x51ee) ^ 0x2f19)
  const beam = new Beam(TUNING)
  const deal = (): Question => host.next({ domain: "add" })
  const bout = options.timing ? new Bout(deal, options.timing) : new Bout(deal)

  const verdicts: Record<Verdict, number> = { true: 0, short: 0, over: 0, shear: 0 }
  const reports: Array<{ correct: boolean; answered: string }> = []
  let rounds = 0
  let bestArm = 0
  let windowMs = 0

  const absorb = (events: readonly BoutEvent[]): void => {
    for (const event of events) {
      if (event.kind === "open") windowMs = 0
      if (event.kind === "strike") beam.hit(event.impulse, event.strike.dir)
      if (event.kind === "hang" || event.kind === "strike" || event.kind === "sag") {
        beam.aim(bout.margin)
      }
      if (event.kind === "seat") {
        rounds += 1
        verdicts[event.seat.verdict] += 1
        reports.push({
          correct: event.seat.verdict === "true",
          answered: String(event.seat.asserted),
        })
        beam.aim(bout.margin)
        bestArm = Math.max(bestArm, event.arm)
      }
    }
  }

  absorb(bout.begin())
  beam.settleTo(bout.margin)

  const ticks = Math.round(((options.seconds ?? 120) * 1000) / STEP)
  for (let i = 0; i < ticks; i++) {
    absorb(bout.advance(STEP))
    beam.advance(STEP)
    if (bout.phase === "press") windowMs += STEP
    for (const action of strategy({ bout, beam, rng, windowMs })) {
      absorb(action === "seat" ? bout.seatNow() : bout.strike(action))
      if (bout.phase !== "press") break
    }
  }

  return { won: bout.match.won, held: bout.match.held, rounds, verdicts, bestArm, reports }
}

// ---------------------------------------------------------------------------
// The strategies.
// ---------------------------------------------------------------------------

/** Hit anything, as fast as a thumb can. The thing the design has to beat. */
export function masher(gapMs = 56): Strategy {
  let since = 0
  return ({ rng, bout }) => {
    since += STEP
    if (bout.phase !== "press" || since < gapMs) return []
    since = 0
    return [rng.pick(FACES)]
  }
}

/** One plate, over and over — the other shape mashing takes. */
export function hammer(strike: Strike, gapMs = 56): Strategy {
  let since = 0
  return ({ bout }) => {
    since += STEP
    if (bout.phase !== "press" || since < gapMs) return []
    since = 0
    return [strike]
  }
}

/**
 * A child who does the arithmetic: read his column, work out the difference,
 * strike the places it decomposes into, seat.
 *
 * `thinkMs` is the pause before the first blow — the comprehension time
 * EXPERIENCE_DESIGN measures and never limits.
 */
export function solver(thinkMs = 2400, gapMs = 280): Strategy {
  let plan: Strike[] = []
  let planned = false
  let since = 0
  let phase: string | null = null
  return ({ bout, windowMs }) => {
    if (bout.phase !== phase) {
      phase = bout.phase
      planned = false
      plan = []
      since = 0
    }
    if (bout.phase !== "press") return []
    if (windowMs < thinkMs) return []
    if (!planned) {
      planned = true
      // The arithmetic, done: his column's value, plus the one notch, less what
      // is already on the pan.
      plan = planStrikes(Number(bout.question?.answer ?? 0) + 1 - bout.load)
      since = gapMs
    }
    since += STEP
    if (since < gapMs) return []
    since = 0
    const next = plan.shift()
    if (next) return [next]
    return ["seat"]
  }
}

/**
 * A player who refuses to do the arithmetic and hunts for the notch by watching
 * which way the beam leans: strike, wait for it to stop swinging, read the sign,
 * strike again. The descent is by place, heaviest first — the fastest hunt there
 * is on this rack.
 */
export function prober(): Strategy {
  const order = [1000, 100, 10, 1] as const
  let index = 0
  let phase: string | null = null
  let last: number | null = null
  return ({ bout, beam }) => {
    if (bout.phase !== phase) {
      phase = bout.phase
      index = 0
      last = null
    }
    if (bout.phase !== "press") return []
    // No reading off a beam that is still travelling.
    if (!beam.settled) return []
    const sign = Math.sign(beam.angle)
    if (last !== null && sign !== 0 && sign !== last) {
      // It crossed. Drop to the next place down.
      index += 1
      last = null
      if (index >= order.length) return ["seat"]
    }
    const place = order[Math.min(index, order.length - 1)] ?? 1
    // Positive angle is your side ahead; take weight off. Otherwise add.
    const dir: 1 | -1 = sign > 0 ? -1 : 1
    last = sign === 0 ? last : sign
    return [{ place, dir }]
  }
}
