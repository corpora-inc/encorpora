// Where a host question becomes a claim on a slate.
//
// One place, so there is exactly one path a statement can reach the screen by,
// and one place for the property that has to hold on every single one of them:
// a statement the game presents as false is false.

import type { Host } from "../contract.ts"
import type { Rng } from "../core/rng.ts"
import { TruthBag } from "./schedule.ts"
import { buildStatement, type Statement } from "./statement.ts"

export class Dealer {
  private readonly host: Host
  private readonly rng: Rng
  private readonly bag: TruthBag

  constructor(host: Host, rng: Rng) {
    this.host = host
    this.rng = rng
    this.bag = new TruthBag(rng)
  }

  deal(): Statement {
    const question = this.host.next()
    const wanted = this.bag.take()
    const statement = buildStatement(question, wanted, this.rng)
    // The bag asked for a lie and the item could not tell one — every
    // distractor it carried was unusable. The `false` was never spent, so it
    // goes back rather than silently biasing the run towards true.
    if (statement.truth !== wanted) this.bag.give(wanted)
    return statement
  }
}
