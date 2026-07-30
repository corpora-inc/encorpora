// THE CLAIM THIS WHOLE PACK RESTS ON: **the room cannot be beaten without doing
// the arithmetic.**
//
// COUNTERPOISE shipped with the answer as the rightmost weight 97.2% of the time,
// and a bot that always took the rightmost weight scored 97.2% without doing any
// maths at all. Nothing in that game failed; it simply was not a maths game. So the
// bots here are the strongest arithmetic-free strategies THE GAVEL admits, plus two
// that do the arithmetic and then skip one of the other three steps — and each of
// them has to be beaten decisively.
//
// **The budget is decisions, not lots.** A child's sitting is bounded by attention,
// and a strategy that keeps losing lots does not get extra turns to make up for it.
//
// Every bot plays its OWN adapted run, which is the harder comparison and the
// honest one: the controller hands a struggling player the calmest room the game
// has — wide broker margins, no traps, the easiest rung — so each bot below is
// measured in the most forgiving world it can reach.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  BIDS_THE_MAX,
  EYEBALLS_THE_ROOM,
  FOLDS,
  IGNORES_THE_OFFER,
  MASHES,
  PERFECT,
  READS_ONLY_THE_OFFER,
  mean,
  play,
  type Player,
} from "./harness.ts"

const SEEDS = [0x1, 0xbeef, 0x2718, 0x5eed1ce, 0xfeed, 0xd00d, 0x1414, 0xc0ffee]
const DECISIONS = 40

/** Coins per seed for one player. */
function purse(player: Player, opts: { warm?: number } = {}): number[] {
  return SEEDS.map((seed) => play(player, DECISIONS, seed, opts).coins)
}

/**
 * Every arithmetic-free strategy earns a small fraction of what computing earns,
 * on every seed, both from a cold start and after thirty lots have carried the run
 * up the ladder.
 */
test("computing the room beats every strategy that does not, on every seed", () => {
  for (const warm of [0, 30]) {
    const computed = purse(PERFECT, { warm })
    const tag = warm === 0 ? "from cold" : "after thirty lots"
    assert.ok(mean(computed) > 100, `${tag}: computing earned only ${String(mean(computed))}`)

    for (const bot of [READS_ONLY_THE_OFFER, EYEBALLS_THE_ROOM, MASHES, IGNORES_THE_OFFER]) {
      const blind = purse(bot, { warm })
      for (const [i, coins] of blind.entries()) {
        const seed = SEEDS[i] ?? 0
        const best = computed[i] ?? 0
        assert.ok(
          coins * 3 < best,
          `${tag}, seed ${seed.toString(16)}: "${bot.name}" earned ${String(coins)} against ` +
            `${String(best)} for computing — less than a threefold gap is not a maths game`,
        )
      }
      assert.ok(
        mean(blind) * 4 < mean(computed),
        `${tag}: "${bot.name}" averaged ${mean(blind).toFixed(1)} against ${mean(computed).toFixed(1)}`,
      )
    }
  }
})

/**
 * The founder's rule, as a test: *if you can bid just one over the highest bid you
 * win the item.* One over, not level with it.
 */
test("bidding the highest instead of one over it wins nothing at all, ever", () => {
  for (const seed of SEEDS) {
    const sitting = play(BIDS_THE_MAX, DECISIONS, seed)
    assert.equal(
      sitting.coins,
      0,
      `seed ${seed.toString(16)}: bidding the room's own highest earned ${String(sitting.coins)}`,
    )
    // Every single lot went to a rival, so the consignment only ever grew.
    assert.equal(sitting.game.tally.sold, 0)
    assert.equal(sitting.game.tally.outbid, sitting.decisions)
    // The host is told this is wrong, and it is: the question THE GAVEL asks is "one
    // more than this tablet", and `highest` is not one more than `highest`. The
    // reported value is `bid − 1`, so what the host sees is an answer one under the
    // canonical one — an off-by-one, which is exactly the error being made.
    assert.ok(
      sitting.reports.every((r) => !r.correct),
      "bidding level with the room was reported as a correct answer",
    )
    assert.ok(
      sitting.reports.every((r) => Number(r.answered) >= 0),
      "a negative claim reached the host",
    )
  }
})

/**
 * The other half of the founder's rule: *if we bid over 20 we lose money.* A child
 * who never looks at the broker's offer buys things nobody will buy.
 */
test("ignoring the broker's offer buys unsellable lots and earns a fraction", () => {
  let unsold = 0
  let lots = 0
  for (const seed of SEEDS) {
    const padded = play(IGNORES_THE_OFFER, DECISIONS, seed)
    const computed = play(PERFECT, DECISIONS, seed)
    unsold += padded.game.storeroom
    lots += padded.decisions
    assert.ok(
      padded.coins * 4 < computed.coins,
      `seed ${seed.toString(16)}: padding earned ${String(padded.coins)} against ${String(computed.coins)}`,
    )
    // Padding by five answers "one more than this tablet" with five more than it, so
    // the host hears an off-by-four. The real cost is still the storeroom and the
    // consignment strip: no coin is ever taken away and no life is lost.
    assert.ok(padded.reports.every((r) => !r.correct))
    assert.equal(padded.game.tally.outbid, 0, "padding the bid should never be outbid")
    assert.ok(padded.game.storeroom > 0, `seed ${seed.toString(16)}: padding was never punished`)
  }
  // The broker's headroom is two to nine coins, so padding by five buys something
  // unsellable about three times in eight. Anything much below that and the offer is
  // decoration.
  assert.ok(
    unsold / lots > 0.2,
    `padding by five went unsold on only ${((100 * unsold) / lots).toFixed(0)}% of lots`,
  )
})

/**
 * Folding is safe, and safety is not a living.
 *
 * Both halves matter. A fold that cost something would make the honest answer to a
 * lot nobody can profit from into a punishment, and a fold that paid well would make
 * the whole game optional.
 */
test("folding everything is safe, reports nothing, and earns almost nothing", () => {
  for (const seed of SEEDS) {
    const folded = play(FOLDS, DECISIONS, seed, { warm: 30 })
    const computed = play(PERFECT, DECISIONS, seed, { warm: 30 })
    assert.equal(folded.reports.length, 0, "a fold was reported to the host as an answer")
    assert.equal(folded.game.storeroom, 0)
    assert.ok(
      folded.coins * 8 < computed.coins,
      `seed ${seed.toString(16)}: folding earned ${String(folded.coins)} against ${String(computed.coins)}`,
    )
  }
})

/**
 * A room the child can sort by eye is a room they do not have to compute, and the
 * tight-cluster assembler in `lot.ts` is what stops that. This is the measurement
 * of how often the surface lies.
 */
test("the biggest number printed in the room is usually not the biggest bid", () => {
  let rooms = 0
  let misleading = 0
  for (const seed of SEEDS) {
    const sitting = play(EYEBALLS_THE_ROOM, DECISIONS, seed)
    rooms += sitting.decisions
    misleading += sitting.game.tally.outbid + sitting.game.tally.unsold
  }
  // Measured at 73% with ten spare questions on the bench and 46% with three; the
  // threshold is a guard on the assembler, not a target.
  assert.ok(
    misleading / rooms > 0.6,
    `eyeballing the room worked on ${(100 - (100 * misleading) / rooms).toFixed(0)}% of boards — ` +
      "the assembler is letting the surface give the answer away",
  )
})
