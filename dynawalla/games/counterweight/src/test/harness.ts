// A headless player.
//
// `play()` drives a real `Bout` — the same class `mount.ts` drives — at a fixed
// 16 ms step, feeding it strikes from a strategy. That is what lets the mashing
// tests be an experiment rather than an argument: the masher is not a
// description of mashing, it is a player, and it plays the shipping rules.

import { Bout, type BoutEvent, type Timing, type Verdict } from "../game/bout.ts"
import { requestFor } from "../game/ladder.ts"
import { FACES, planStrikes, type Strike } from "../game/places.ts"
import type { Question } from "../contract.ts"
import { Rng } from "../core/rng.ts"
import { Beam, TUNING } from "../sim/beam.ts"
import { createStubHost } from "../stubHost.ts"

export type Table = {
  /** The round under way, so a strategy can read the beam. */
  readonly bout: Bout
  /** The beam, integrated alongside — a strategy that watches it pays for it. */
  readonly beam: Beam
  readonly rng: Rng
  /** Milliseconds since this round opened. */
  readonly roundMs: number
}

/** Return the actions to take on this tick. `"stamp"` writes the docket. */
export type Strategy = (table: Table) => ReadonlyArray<Strike | "stamp">

export type Play = {
  readonly won: number
  readonly held: number
  readonly rounds: number
  readonly verdicts: Record<Verdict, number>
  readonly bestRun: number
  readonly reports: ReadonlyArray<{ correct: boolean; answered: string }>
  /** The rung asked for on each lot, in order. The ladder, as played. */
  readonly rungs: readonly number[]
  /** Abandonment guards served, in milliseconds, in order. */
  readonly guards: readonly number[]
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
  const rungs: number[] = []
  // The same lazy read of the day that `mount.ts` does, and for the same
  // reason: `hang()` runs before the `won` that caused it is ever seen.
  let table: Bout | null = null
  const deal = (): Question => {
    const request = requestFor(table?.day)
    rungs.push(request.difficulty)
    return host.next(request)
  }
  const bout = options.timing ? new Bout(deal, options.timing) : new Bout(deal)
  table = bout

  const verdicts: Record<Verdict, number> = { true: 0, short: 0, over: 0, shear: 0, lapsed: 0 }
  const reports: Array<{ correct: boolean; answered: string }> = []
  const guards: number[] = []
  let rounds = 0
  let bestRun = 0
  let roundMs = 0

  const absorb = (events: readonly BoutEvent[]): void => {
    for (const event of events) {
      if (event.kind === "open") {
        roundMs = 0
        guards.push(bout.guardMs)
      }
      if (event.kind === "strike") beam.hit(event.impulse, event.strike.dir)
      if (event.kind === "hang" || event.kind === "rerack" || event.kind === "strike") {
        beam.aim(bout.margin)
      }
      if (event.kind === "stamp") {
        rounds += 1
        verdicts[event.docket.verdict] += 1
        // Only a stamped docket is an answer — the same `declared` split
        // `mount.ts` makes between `report` and `skip`. A lapse and a shear both
        // leave the pan wherever the child had got to; neither is a claim.
        if (event.docket.declared) {
          reports.push({
            correct: event.docket.verdict === "true",
            answered: String(event.docket.asserted),
          })
        }
        beam.aim(bout.margin)
        bestRun = Math.max(bestRun, event.run)
      }
    }
  }

  absorb(bout.begin())
  beam.settleTo(bout.margin)

  const ticks = Math.round(((options.seconds ?? 120) * 1000) / STEP)
  for (let i = 0; i < ticks; i++) {
    absorb(bout.advance(STEP))
    beam.advance(STEP)
    if (bout.phase === "press") roundMs += STEP
    for (const action of strategy({ bout, beam, rng, roundMs })) {
      absorb(action === "stamp" ? bout.stamp() : bout.strike(action))
      if (bout.phase !== "press") break
    }
  }

  return {
    won: bout.day.won,
    held: bout.day.held,
    rounds,
    verdicts,
    bestRun,
    reports,
    rungs,
    guards,
  }
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
 * A child who does the arithmetic: read the chit, work out the difference,
 * strike the places it decomposes into, stamp.
 *
 * `thinkMs` is the pause before the first blow — the comprehension time
 * EXPERIENCE_DESIGN measures and never limits, and which nothing in this game
 * charges for any more.
 */
export function solver(thinkMs = 2400, gapMs = 280): Strategy {
  let plan: Strike[] = []
  let planned = false
  let since = 0
  let phase: string | null = null
  return ({ bout, roundMs }) => {
    if (bout.phase !== phase) {
      phase = bout.phase
      planned = false
      plan = []
      since = 0
    }
    if (bout.phase !== "press") return []
    if (roundMs < thinkMs) return []
    if (!planned) {
      planned = true
      // The arithmetic, done: the goods' weight, plus the one over, less the
      // brass already on the pan.
      plan = planStrikes(Number(bout.question?.answer ?? 0) + 1 - bout.load)
      since = gapMs
    }
    since += STEP
    if (since < gapMs) return []
    since = 0
    const next = plan.shift()
    if (next) return [next]
    return ["stamp"]
  }
}

/**
 * The same child, honestly modelled.
 *
 * `solver` re-reads the pan at the instant it starts striking, which no human
 * does — this one plans from the number in front of it *when the round opened*,
 * works the sum out, and then strikes what it worked out. That difference is what
 * caught the sag: a pan that drained while the child was thinking made the
 * arithmetic they had just done wrong by the time they reached the rack, and they
 * had no way of knowing it had happened.
 *
 * The sag is gone, so this bot and `solver` should now agree. Keep both anyway —
 * this is the bot that fails the moment anything starts moving a pan on its own.
 */
export function patient(thinkMs = 6000, gapMs = 300): Strategy {
  let plan: Strike[] = []
  let planned = false
  let read: number | null = null
  let since = 0
  let phase: string | null = null
  return ({ bout, roundMs }) => {
    if (bout.phase !== phase) {
      phase = bout.phase
      planned = false
      plan = []
      read = null
      since = 0
    }
    if (bout.phase !== "press") return []
    // The pan as it stood when the lot came on. Read once, like a child.
    if (read === null) read = bout.load
    if (roundMs < thinkMs) return []
    if (!planned) {
      planned = true
      plan = planStrikes(Number(bout.question?.answer ?? 0) + 1 - read)
      since = gapMs
    }
    since += STEP
    if (since < gapMs) return []
    since = 0
    const next = plan.shift()
    if (next) return [next]
    return ["stamp"]
  }
}

/**
 * A player who refuses to do the arithmetic and hunts for the tipping point by
 * watching which way the beam leans: strike, wait for it to stop swinging, read
 * the sign, strike again. The descent is by place, heaviest first — the fastest
 * hunt there is on this rack.
 *
 * **This bot is the reason the "one over" rule is not decoration.** A beam-watcher
 * converges on *level*, because level is the only thing a beam announces — and
 * level is `margin === 0`, which is SHORT. With the round clock deleted this bot
 * can now probe for as long as it likes, and `mash.test.ts` proves it still gets
 * nowhere, which is a stronger result than the clock was ever giving us.
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
      if (index >= order.length) return ["stamp"]
    }
    const place = order[Math.min(index, order.length - 1)] ?? 1
    // Positive angle is your brass down; take weight off. Otherwise add.
    const dir: 1 | -1 = sign > 0 ? -1 : 1
    last = sign === 0 ? last : sign
    return [{ place, dir }]
  }
}
