// **The bar this game was designed against: no mashing strategy wins.**
//
// The canon entry calls THE COUNTERWEIGHT the most unmashable design in the
// catalogue, and that is a claim about behaviour, so it is settled by playing
// rather than by reading the source. Every case below drives the shipping `Bout`
// with a bot and counts what it got. The bots are in `harness.ts`.
//
// Four ways to not do the arithmetic, and what each of them runs into:
//
//   * **Hit everything fast.** The steel shears — `strain.ts`. It is not that
//     mashing is inefficient; it is that mashing ends the round.
//   * **Hit one plate fast.** Same shear.
//   * **Hit one plate slowly**, under the resonance window, so the steel never
//     shears. Then the clock and the arithmetic get you: a pan can only travel
//     so far in ones, and nothing about walking it lands on the one notch.
//   * **Hunt by watching the beam** instead of computing. Every probe needs the
//     beam to stop ringing first, and the window runs out — `beam.ts`.
//
// And the control, without which none of the above means anything: a bot that
// *does* the arithmetic wins comfortably, every seed.

import assert from "node:assert/strict"
import { test } from "node:test"

import { FACES } from "../game/places.ts"
import { hammer, masher, play, prober, solver } from "./harness.ts"

/** Fixed, so this file has no unseeded randomness in it anywhere. */
const SEEDS = Array.from({ length: 12 }, (_, i) => i * 7919 + 3)

test("hitting everything as fast as a thumb can move never wins a Turk", () => {
  for (const seed of SEEDS) {
    const run = play(masher(56), { seed, seconds: 600 })
    assert.equal(run.won, 0, `a masher put a Turk over on seed ${seed}`)
    assert.equal(run.held, 0, `a masher held ${run.held} rounds on seed ${seed}`)
    // And it is not that they ran out of time: they played eighty-odd rounds and
    // sheared the beam in every single one.
    assert.ok(run.rounds > 40, `only ${run.rounds} rounds on seed ${seed}`)
    assert.equal(run.verdicts.shear, run.rounds)
  }
})

test("a slower mash still never wins — at any speed a thumb can hold", () => {
  for (const gap of [80, 120, 160, 200, 250, 300, 450, 700]) {
    for (const seed of SEEDS.slice(0, 5)) {
      const run = play(masher(gap), { seed, seconds: 480 })
      assert.equal(run.won, 0, `a ${gap} ms mash won on seed ${seed}`)
      assert.equal(run.held, 0, `a ${gap} ms mash held a round on seed ${seed}`)
    }
  }
})

test("hammering a single plate never wins, whichever plate it is", () => {
  for (const face of FACES) {
    for (const gap of [56, 200, 400]) {
      for (const seed of SEEDS.slice(0, 4)) {
        const run = play(hammer(face, gap), { seed, seconds: 400 })
        const name = `${face.dir > 0 ? "+" : "−"}${face.place} at ${gap} ms`
        assert.equal(run.won, 0, `hammering ${name} won on seed ${seed}`)
        assert.equal(run.held, 0, `hammering ${name} held a round on seed ${seed}`)
      }
    }
  }
})

test("hunting for the notch by watching the beam never wins either", () => {
  // This one is allowed to land the odd round — a beam that told you nothing at
  // all would be a beam not worth drawing. What it must not do is carry anybody
  // through a Turk, because putting one over needs five net holds.
  for (const seed of SEEDS) {
    const run = play(prober(), { seed, seconds: 600 })
    assert.equal(run.won, 0, `a beam-watcher put a Turk over on seed ${seed}`)
    assert.ok(
      run.held * 8 < run.rounds,
      `a beam-watcher held ${run.held} of ${run.rounds} on seed ${seed}`,
    )
  }
})

test("and a player who does the arithmetic wins, comfortably, every seed", () => {
  // The control. Without it every assertion above would also pass on a game that
  // is simply impossible.
  for (const seed of SEEDS) {
    const run = play(solver(), { seed, seconds: 400 })
    assert.ok(run.won >= 6, `a solver only put ${run.won} Turks over on seed ${seed}`)
    assert.ok(
      run.held / run.rounds > 0.85,
      `a solver held only ${run.held} of ${run.rounds} on seed ${seed}`,
    )
    assert.equal(run.verdicts.shear, 0, `a solver sheared the beam on seed ${seed}`)
  }
})

test("a player who thinks slowly still wins, just fewer of them", () => {
  // Comprehension time is the child's and is never the thing being scored. A bot
  // that takes four seconds to read the column before its first blow must still
  // be able to put Turks over.
  for (const seed of SEEDS.slice(0, 6)) {
    const run = play(solver(4200, 300), { seed, seconds: 600 })
    assert.ok(run.won >= 3, `a slow thinker only put ${run.won} Turks over on seed ${seed}`)
  }
})

test("what a wrong seat reports is a number the child put there, not noise", () => {
  // The diagnosis rides on this: the value reported is the load minus the one
  // notch, so a child running a broken column procedure reports its output.
  const run = play(solver(2400, 280), { seed: 0x51ee, seconds: 240 })
  for (const report of run.reports) {
    assert.match(report.answered, /^-?\d+$/, `"${report.answered}" is not a whole number`)
  }
  assert.ok(run.reports.length > 10)
})
