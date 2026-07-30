// Where a host question becomes a claim on a slate — and where this game finally
// asks for a difficulty.
//
// One place, so there is exactly one path a statement can reach the screen by, and
// one place for the property that has to hold on every single one of them: a
// statement the game presents as false is false.
//
// ── the request ──────────────────────────────────────────────────────────────
//
// `deal()` used to call `host.next()` with no argument. That is the whole of why
// the game "stays on way too easy way too long": it took the front of the prefetch
// pool forever and never once said what it wanted. It now passes the `Ladder`'s
// position on every deal, and the SDK flushes the pool by itself once the request
// has moved a tenth of the ladder — so a child who is quick feels the change within
// two questions rather than thirty-three.
//
// `settle` is the other half. The mount hands every settled outcome back here with
// its quickness, and the ladder moves. It is one call site and it is on the same
// object that does the asking, so the two can never fall out of step.

import type { Host } from "../contract.ts"
import type { Rng } from "../core/rng.ts"
import { Ladder } from "./ladder.ts"
import type { Outcome } from "./response.ts"
import { TruthBag } from "./schedule.ts"
import { buildStatement, type Statement } from "./statement.ts"

export class Dealer {
  private readonly host: Host
  private readonly rng: Rng
  private readonly bag: TruthBag
  private readonly ladder: Ladder

  constructor(host: Host, rng: Rng, ladder: Ladder = new Ladder()) {
    this.host = host
    this.rng = rng
    this.bag = new TruthBag(rng)
    this.ladder = ladder
  }

  /** What the game is currently asking the host for, 0..1. Never exactly 1. */
  get difficulty(): number {
    return this.ladder.difficulty
  }

  deal(): Statement {
    const question = this.host.next({ difficulty: this.ladder.difficulty })
    const wanted = this.bag.take()
    const statement = buildStatement(question, wanted, this.rng)
    // The bag asked for a lie and the item could not tell one — every distractor
    // it carried was unusable. The `false` was never spent, so it goes back rather
    // than silently biasing the run towards true.
    if (statement.truth !== wanted) this.bag.give(wanted)
    return statement
  }

  /** Move the request. A lapse moves it by nothing; see `ladder.stepFor`. */
  settle(outcome: Outcome, quickness: number): void {
    this.ladder.settle(outcome, quickness)
  }
}
