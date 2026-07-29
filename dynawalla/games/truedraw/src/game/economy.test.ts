// THE ECONOMY, PLAYED BY BOTS.
//
// "A bag that grows on a coin-flip is a bag that rewards mashing." So this file does
// not assert the arithmetic — `bag.test.ts` does that — it plays whole runs with
// strategies and compares the bags they end with. A sibling pack shipped an economy
// in which never answering strictly dominated answering, and the only thing that
// finds that is a bot that tries it.
//
// Four strategies, and the ordering between them is the product claim:
//
//   a careful reader, deliberately SLOW   >>  a random swiper, at MAXIMUM SPEED
//   a careful reader                      >>  keep everything
//   a careful reader                      >>  toss everything
//   a careful reader                      >>  wait every single window out
//
// Note which way round the first one is. The slow reader gets no speed bonus at all
// and the guesser gets the whole of it on every lucky call, and the reader still
// wins by two orders of magnitude. That is what "being right is worth more than being
// fast" has to mean if it means anything.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import { createStubHost } from "../stub/host.ts"
import {
  alwaysKeep,
  alwaysToss,
  alwaysWait,
  coinFlip,
  fallible,
  perfect,
  playRun,
  type Decision,
} from "../test/harness.ts"
import { comprehensionP50Ms, comprehensionLoad, operandWidth } from "./cadence.ts"
import type { Statement } from "./statement.ts"

const RUNS = 120

/** The child's own p50 for the item: a careful, unhurried, entirely normal reader. */
const deliberate = (s: Statement): number =>
  comprehensionP50Ms(comprehensionLoad(operandWidth(s.text)))

/** Mean final bag over `RUNS` runs of a strategy. */
function meanBag(
  strategy: (seed: number) => { bag: number; calls: number; rounds: number },
  runs = RUNS,
): { bag: number; calls: number; rounds: number } {
  let bag = 0
  let calls = 0
  let rounds = 0
  for (let i = 0; i < runs; i++) {
    const r = strategy(i)
    bag += r.bag
    calls += r.calls
    rounds += r.rounds
  }
  return { bag: bag / runs, calls: calls / runs, rounds: rounds / runs }
}

function play(
  seed: number,
  decide: (s: Statement) => Decision,
  thinkMs?: (s: Statement) => number,
): { bag: number; calls: number; rounds: number } {
  const result = playRun(createStubHost({ seed: 1000 + seed, level: 3 }), 5000 + seed, decide, {
    limit: 200,
    ...(thinkMs ? { thinkMs } : {}),
  })
  return { bag: result.run.bag, calls: result.run.calls, rounds: result.statements.length }
}

test("A RANDOM SWIPER AT FULL SPEED ENDS WITH LESS THAN A SLOW CAREFUL READER", () => {
  // The headline. The guesser answers instantly on every slate, so they collect the
  // maximum speed bonus on every one of their lucky calls. The reader takes the
  // documented p50 every single time and collects no bonus at all.
  const guesser = meanBag((seed) => play(seed, coinFlip(new Rng(7000 + seed)), () => 0))
  const reader = meanBag((seed) => play(seed, fallible(0.95, new Rng(9000 + seed)), deliberate))

  assert.ok(
    reader.bag > guesser.bag * 20,
    `a slow reader banked ${reader.bag.toFixed(1)} coins; a max-speed guesser banked ` +
      `${guesser.bag.toFixed(1)}. Ratio ${(reader.bag / Math.max(1, guesser.bag)).toFixed(1)}x.`,
  )
  // Reported as the two numbers, because "guessing loses" is a claim about a size.
  console.log(
    `    slow careful reader: bag ${reader.bag.toFixed(1)} over ${reader.rounds.toFixed(1)} rounds\n` +
      `    max-speed guesser:   bag ${guesser.bag.toFixed(1)} over ${guesser.rounds.toFixed(1)} rounds`,
  )
})

test("A RANDOM SWIPER'S COINS DRIFT STRICTLY DOWN, unclamped and unprotected", () => {
  // The load-bearing one, and the reason it is separate from the test above.
  //
  // The bots above compare final BAGS, and a final bag is protected by two things
  // that are not the economy: the floor at zero, and the three-shot budget that ends
  // a guesser's run after about six rounds. Both of those would hide a break-even
  // price list. Verified: setting COIN_WRONG to 10 — exactly what a maximum-speed
  // correct call earns — leaves every bag comparison in this file passing.
  //
  // So this sums the RAW SIGNED PRICE of every call a guesser makes, across many
  // runs, with no floor and no run ending. That number is the drift, it is what
  // "guessing must be worse than reading" means, and nothing but the arithmetic in
  // `bag.ts` can make it negative.
  let coins = 0
  let calls = 0
  for (let seed = 0; seed < 250; seed++) {
    const result = playRun(
      createStubHost({ seed: 30_000 + seed, level: 3 }),
      31_000 + seed,
      coinFlip(new Rng(32_000 + seed)),
      { limit: 200, thinkMs: () => 0 },
    )
    for (const event of result.events) {
      if (event.kind !== "settled") continue
      coins += event.coins
      calls += 1
    }
  }
  assert.ok(calls > 800, `only ${String(calls)} calls sampled`)
  const drift = coins / calls
  assert.ok(
    drift < -0.5,
    `a maximum-speed random swiper drifts ${drift.toFixed(2)} coins a call — the honest number is ` +
      `about −1; at or above zero ` +
      `the bag is a free random walk and mashing pays`,
  )
  console.log(`    guesser drift: ${drift.toFixed(2)} coins per call over ${String(calls)} calls`)
})

test("a careful reader's coins drift strongly UP, by the same measure", () => {
  // The counterweight. The test above would also pass if correct calls paid nothing.
  let coins = 0
  let calls = 0
  for (let seed = 0; seed < 120; seed++) {
    const result = playRun(
      createStubHost({ seed: 40_000 + seed, level: 3 }),
      41_000 + seed,
      fallible(0.95, new Rng(42_000 + seed)),
      { limit: 120, thinkMs: deliberate },
    )
    for (const event of result.events) {
      if (event.kind !== "settled") continue
      coins += event.coins
      calls += 1
    }
  }
  const drift = coins / calls
  assert.ok(drift > 4.5, `a careful reader drifts only ${drift.toFixed(2)} coins a call`)
  console.log(`    reader drift:  ${drift.toFixed(2)} coins per call over ${String(calls)} calls`)
})

test("a random swiper's bag hovers at nothing, whatever the seed", () => {
  // Not "grows slowly" — does not grow. The drift per round is negative, and the run
  // ends after three wrong verdicts, which for a coin flip is about six rounds.
  const guesser = meanBag((seed) => play(seed, coinFlip(new Rng(2000 + seed)), () => 0))
  assert.ok(guesser.bag < 40, `a guesser averaged a bag of ${guesser.bag.toFixed(1)}`)
  assert.ok(guesser.rounds < 12, `a guesser lasted ${guesser.rounds.toFixed(1)} rounds`)
})

test("keeping everything and tossing everything are both losing, and equally so", () => {
  // The two degenerate swipers. The truth bag deals in exact halves, so neither can
  // beat 50%, and 50% loses coins by construction.
  const keeper = meanBag((seed) => play(seed, alwaysKeep, () => 0))
  const tosser = meanBag((seed) => play(seed, alwaysToss, () => 0))
  const reader = meanBag((seed) => play(seed, fallible(0.95, new Rng(4000 + seed)), deliberate))
  for (const [name, bot] of [
    ["keep everything", keeper],
    ["toss everything", tosser],
  ] as const) {
    assert.ok(
      reader.bag > bot.bag * 20,
      `${name} banked ${bot.bag.toFixed(1)} against the reader's ${reader.bag.toFixed(1)}`,
    )
    assert.ok(bot.rounds < 12, `${name} lasted ${bot.rounds.toFixed(1)} rounds`)
  }
  // And the economy does not favour one gesture over the other.
  assert.ok(
    Math.abs(keeper.bag - tosser.bag) < Math.max(6, keeper.bag * 0.6),
    `one direction pays better: keep ${keeper.bag.toFixed(1)} vs toss ${tosser.bag.toFixed(1)}`,
  )
})

test("WAITING EVERY WINDOW OUT EARNS EXACTLY NOTHING — it does not dominate answering", () => {
  // The SLICE failure, checked for. A lapse costs nothing, so the worry is that
  // never answering is the optimal play. It earns zero, forever, and a reader earns
  // hundreds — so it dominates nothing except guessing, which is the one strategy it
  // is supposed to beat.
  const waiter = meanBag((seed) => play(seed, alwaysWait), 60)
  const reader = meanBag((seed) => play(seed, fallible(0.95, new Rng(6000 + seed)), deliberate))
  assert.equal(waiter.bag, 0, `a waiter banked ${waiter.bag.toFixed(1)} coins`)
  assert.equal(waiter.calls, 0)
  assert.ok(reader.bag > 300, `a reader only banked ${reader.bag.toFixed(1)}`)
})

test("waiting is the most expensive thing in the game in wall-clock time", () => {
  // It is free in coins and it is not free in minutes: a lapse spends the whole
  // window, which is the largest single cost any round can incur. So per minute of
  // play, waiting is the worst play available to anybody who can read at all.
  const waiter = playRun(createStubHost({ seed: 77, level: 5 }), 78, alwaysWait, { limit: 30 })
  const reader = playRun(createStubHost({ seed: 77, level: 5 }), 78, perfect, {
    limit: 30,
    thinkMs: deliberate,
  })
  const spent = (r: typeof waiter): number =>
    r.events.reduce((sum, e) => sum + (e.kind === "settled" ? e.reactionMs : 0), 0)
  assert.ok(
    spent(waiter) > spent(reader) * 1.8,
    `waiting spent ${String(spent(waiter))}ms and reading spent ${String(spent(reader))}ms`,
  )
})

test("accuracy pays superlinearly: a better reader banks disproportionately more", () => {
  // Not "10% better accuracy, 10% more coins". The run length is negative-binomial in
  // accuracy AND the per-round drift rises with it, so the two multiply.
  const bags = [0.6, 0.75, 0.9, 0.98].map((p) =>
    meanBag((seed) => play(seed, fallible(p, new Rng(11_000 + seed)), deliberate), 80).bag,
  )
  for (let i = 1; i < bags.length; i++) {
    assert.ok(
      (bags[i] ?? 0) > (bags[i - 1] ?? 0),
      `bags did not rise with accuracy: ${bags.map((b) => b.toFixed(1)).join(" → ")}`,
    )
  }
  assert.ok(
    (bags[3] ?? 0) / Math.max(1, bags[0] ?? 0) > 8,
    `0.98 accuracy is only ${((bags[3] ?? 0) / Math.max(1, bags[0] ?? 1)).toFixed(1)}x a 0.6 bag`,
  )
  console.log(`    bags at p=0.6/0.75/0.9/0.98: ${bags.map((b) => b.toFixed(0)).join(" / ")}`)
})

test("fast AND right is the best there is — speed still pays, on top of correct", () => {
  // The other side of it. Correctness dominates speed, but a fast correct player must
  // still out-earn a slow correct one, or the bonus is decoration.
  const fast = meanBag((seed) => play(seed, perfect, () => 200), 120)
  const slow = meanBag((seed) => play(seed, perfect, deliberate), 120)
  assert.ok(
    fast.bag > slow.bag,
    `speed bought nothing: fast ${fast.bag.toFixed(1)} vs slow ${slow.bag.toFixed(1)}`,
  )
  // ...and never more than two thirds again as much, because the base is the bigger
  // half of every coin.
  assert.ok(
    fast.bag < slow.bag * 1.7,
    `speed is worth ${(fast.bag / slow.bag).toFixed(2)}x, which is more than being right`,
  )
})
