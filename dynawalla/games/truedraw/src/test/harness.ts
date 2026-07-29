// A headless player.
//
// The round is driven by elapsed milliseconds rather than by frames precisely so
// that the design's central claim — that drawing at everything is a three-call
// run — can be played out ten thousand times with no canvas, no clock and no
// browser. This is that driver.

import type { Host } from "../contract.ts"
import { Rng } from "../core/rng.ts"
import { Dealer } from "../game/dealer.ts"
import type { Outcome } from "../game/response.ts"
import { Round, TIMING, type RoundEvent, type Timing } from "../game/round.ts"
import type { Run } from "../game/run.ts"
import type { Statement } from "../game/statement.ts"

export type Decision = "draw" | "hold"

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
  /** Fraction into the draw window at which a draw is committed. */
  readonly drawAt?: number
  /**
   * How long this player takes to work the statement out, in absolute ms.
   *
   * The point of an absolute think time rather than a fraction is that it is
   * the *child's* number, not the game's: a bot that always acts at 40% of
   * whatever window it is given can never be timed out, so it can never detect
   * a window that is too short. One that takes six seconds because six seconds
   * is what the cadence table says the item costs can.
   */
  readonly thinkMs?: (statement: Statement) => number
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
  const drawAt = options.drawAt ?? 0

  const rng = new Rng(seed)
  const dealer = new Dealer(host, rng)
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
      else if (event.kind === "settled") outcomes.push(event.outcome)
    }
  }

  consume(round.begin())
  for (let i = 0; i < 2_000_000 && round.phase !== "over"; i++) {
    consume(round.advance(step))
    if (statements.length > limit) break
    const index = statements.length - 1
    const current = statements[index]
    if (round.phase !== "call" || current === undefined || actedOn === index) continue
    const readyAt = options.thinkMs ? options.thinkMs(current) : current.windowMs * drawAt
    // Still working it out. If the window closes first the call is never made,
    // which is exactly the failure this option exists to expose.
    if (round.elapsedMs < readyAt) continue
    if (decide(current) === "draw") consume(round.press())
    actedOn = index
  }

  return { outcomes, statements, events, run: round.run, finished: round.phase === "over" }
}

/** Draw at everything. The strategy the format has to defeat. */
export const alwaysDraw = (): Decision => "draw"

/** Never draw. The other half of the same coin, and just as short. */
export const alwaysHold = (): Decision => "hold"

/** Read the slate and call it. */
export const perfect = (statement: Statement): Decision => (statement.truth ? "draw" : "hold")

/** Read the slate, and be wrong `1 − p` of the time. */
export function fallible(p: number, rng: Rng): (statement: Statement) => Decision {
  return (statement) => {
    const right = perfect(statement)
    if (rng.chance(p)) return right
    return right === "draw" ? "hold" : "draw"
  }
}
