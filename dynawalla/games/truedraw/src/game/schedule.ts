// The truth balancer.
//
// A coin flip per round is wrong twice over. It drifts — a seeded run can hand a
// child seven true statements in a row and teach them that drawing always works
// — and it makes the 50% mashing ceiling a statement about expectation rather
// than about what actually happened in the run they just played.
//
// So truth is dealt from a bag: blocks of four, two true and two false,
// shuffled. Over any whole block the counts are exactly equal, and over any
// prefix the imbalance is at most two. A masher therefore does not get 50% on
// average — they get within one call of half, every single run.
//
// One more constraint: a shuffle is rejected if it would extend a same-truth
// tail past three. Four falses in a row is inside the bag's guarantee and
// outside what a child reads as fair.

import type { Rng } from "../core/rng.ts"

export const BLOCK = 4
const MAX_SAME_RUN = 3

export class TruthBag {
  private readonly rng: Rng
  private queue: boolean[] = []
  private tailTruth = true
  private tailLength = 0

  constructor(rng: Rng) {
    this.rng = rng
  }

  /** The next truth value to try to tell. */
  take(): boolean {
    if (this.queue.length === 0) this.refill()
    const next = this.queue.shift()
    // The refill above guarantees a non-empty queue; this keeps the types
    // honest without a non-null assertion.
    const truth = next ?? true
    if (truth === this.tailTruth) this.tailLength += 1
    else {
      this.tailTruth = truth
      this.tailLength = 1
    }
    return truth
  }

  /**
   * Give a truth value back, unspent.
   *
   * An item whose distractors are all unusable can only be told truthfully, so
   * the `false` the bag dealt was never spent. Returning it keeps the block
   * balanced instead of quietly biasing the whole run towards true.
   */
  give(truth: boolean): void {
    // A stream of items that can only be told truthfully would otherwise pile
    // up an unspendable debt of `false`s and, the moment one usable item
    // arrived, spend it all at once. Past a block's worth the debt is written
    // off: the balance guarantee is about a run, not about an accounting
    // identity.
    if (this.queue.length >= BLOCK) return
    this.queue.unshift(truth)
    if (this.tailLength > 0) this.tailLength -= 1
  }

  private refill(): void {
    const block = [true, true, false, false]
    for (let attempt = 0; attempt < 8; attempt++) {
      this.rng.shuffle(block)
      if (!this.extendsRunTooFar(block)) break
    }
    this.queue = block.slice()
  }

  private extendsRunTooFar(block: readonly boolean[]): boolean {
    let value = this.tailTruth
    let length = this.tailLength
    for (const truth of block) {
      if (truth === value) {
        length += 1
        if (length > MAX_SAME_RUN) return true
      } else {
        value = truth
        length = 1
      }
    }
    return false
  }
}
