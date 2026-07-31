// A headless player.
//
// The round is driven by elapsed milliseconds rather than by frames precisely so
// that the design's central claims — that swiping at random empties the bag, that a
// careful reader's bag grows without bound, and that waiting every window out earns
// exactly nothing — can be played out thousands of times with no canvas, no clock
// and no browser. This is that driver.
//
// The decision a bot returns is one of THREE things now, and the third is the point:
//
//   "keep"  swipe down
//   "toss"  swipe up
//   "wait"  do not touch the screen — which is no longer a verdict

import type { Host } from "../contract.ts"
import { Rng } from "../core/rng.ts"
import { Dealer } from "../game/dealer.ts"
import type { Outcome } from "../game/response.ts"
import { Round, TIMING, type RoundEvent, type Timing } from "../game/round.ts"
import type { Run } from "../game/run.ts"
import type { Statement } from "../game/statement.ts"

export type Decision = "keep" | "toss" | "wait"

export type PlayResult = {
  readonly outcomes: readonly Outcome[]
  readonly statements: readonly Statement[]
  readonly events: readonly RoundEvent[]
  readonly run: Run
  /** True when the run ended on its own rather than by hitting the cap. */
  readonly finished: boolean
}

export type PlayOptions = {
  readonly timing?: Timing
  /** Milliseconds per simulated frame. */
  readonly stepMs?: number
  /** Rounds after which the driver gives up, for a strategy that never misses. */
  readonly limit?: number
  /** Fraction into the window at which a verdict is committed. */
  readonly callAt?: number
  /**
   * How long this player takes to work the statement out, in absolute ms.
   *
   * The point of an absolute think time rather than a fraction is that it is the
   * *child's* number, not the game's: a bot that always acts at 40% of whatever
   * window it is given can never be timed out, so it can never detect a window that
   * is too short. One that takes six seconds because six seconds is what the cadence
   * table says the item costs can.
   */
  readonly thinkMs?: (statement: Statement) => number
  /** A dealer to share across runs, so the difficulty request can be observed. */
  readonly dealer?: Dealer
}

export function playRun(
  host: Host,
  seed: number,
  decide: (statement: Statement) => Decision,
  options: PlayOptions = {},
): PlayResult {
  const timing = options.timing ?? TIMING
  const step = options.stepMs ?? 20
  const limit = options.limit ?? 400
  const callAt = options.callAt ?? 0

  const rng = new Rng(seed)
  const dealer = options.dealer ?? new Dealer(host, rng)
  const round = new Round(() => dealer.deal(), timing)

  const outcomes: Outcome[] = []
  const statements: Statement[] = []
  const events: RoundEvent[] = []
  /** Which statement index has already been called. One call per round. */
  let actedOn = -1

  const consume = (batch: readonly RoundEvent[]): void => {
    for (const event of batch) {
      events.push(event)
      if (event.kind === "present") statements.push(event.statement)
      else if (event.kind === "settled") {
        outcomes.push(event.outcome)
        // The mount does this too, and a harness that skipped it would measure a
        // game whose difficulty never moves — which is the defect, not the fix.
        dealer.settle(event.outcome, event.quickness)
      }
    }
  }

  consume(round.begin())
  for (let i = 0; i < 2_000_000 && round.phase !== "over"; i++) {
    consume(round.advance(step))
    // A miss now HOLDS the completed sum with no deadline on it, so a harness
    // that only advances time sits on one slate forever. This is the hand that
    // takes it down — and it cannot be moved above `advance`, because `tap` is
    // deaf inside the reveal's settle floor.
    if (round.dismissible) consume(round.tap())
    if (statements.length > limit) break
    const index = statements.length - 1
    const current = statements[index]
    if (round.phase !== "call" || current === undefined || actedOn === index) continue
    const readyAt = options.thinkMs ? options.thinkMs(current) : current.windowMs * callAt
    // Still working it out. If the window closes first the call is never made,
    // which is exactly the failure this option exists to expose.
    if (round.elapsedMs < readyAt) continue
    const decision = decide(current)
    if (decision !== "wait") consume(round.verdict(decision))
    actedOn = index
  }

  return { outcomes, statements, events, run: round.run, finished: round.phase === "over" }
}

/** Keep everything. One of the two degenerate swipers. */
export const alwaysKeep = (): Decision => "keep"

/** Throw everything away. The other one, and it is exactly as bad. */
export const alwaysToss = (): Decision => "toss"

/** Never touch the screen. Every window lapses. */
export const alwaysWait = (): Decision => "wait"

/** Read the slate and call it. */
export const perfect = (statement: Statement): Decision => (statement.truth ? "keep" : "toss")

/** Swipe without reading, one direction or the other, at random. */
export function coinFlip(rng: Rng): (statement: Statement) => Decision {
  return () => (rng.chance(0.5) ? "keep" : "toss")
}

/** Read the slate, and be wrong `1 − p` of the time. */
export function fallible(p: number, rng: Rng): (statement: Statement) => Decision {
  return (statement) => {
    const right = perfect(statement)
    if (rng.chance(p)) return right
    return right === "keep" ? "toss" : "keep"
  }
}
