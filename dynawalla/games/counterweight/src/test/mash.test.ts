// **The bar this game was designed against: no mashing strategy wins.**
//
// The canon entry calls THE STEELYARD (shipped as THE COUNTERWEIGHT) the most
// unmashable design in the
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
import { hammer, masher, patient, play, prober, solver } from "./harness.ts"

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

// ---------------------------------------------------------------------------
// **The other half of the bar: a child who is thinking must not be losing.**
//
// Everything above proves the game cannot be beaten without the arithmetic.
// These prove it can be beaten *with* it, at the speeds real children do it at,
// which is the half the pacing audit found missing. The founder's report was
// "this one is stressful and rushed and sometimes the timing is sort of
// impossible"; each case below is one of the reasons it was.
// ---------------------------------------------------------------------------

/** The house cadence table's p90 for two-digit-with-regrouping. */
const P90_TWO_DIGIT_MS = 14000

test("a child who thinks at the house table's own pace wins comfortably", () => {
  // **The headline defect.** Measured on this bot before the change: at a nine
  // second pause it held 45 of 96 rounds and put over 7 Turks in the time it
  // now takes to put over 18; at the documented p90 it held 0 of 78 and never
  // put over a single one. The window it was thinking against was falling from
  // 13.0 s to 7.6 s while the sums climbed to four digits.
  for (const think of [2400, 4200, 6000, 9000]) {
    for (const seed of SEEDS.slice(0, 6)) {
      const run = play(solver(think, 350), { seed, seconds: 400 })
      assert.ok(
        run.won >= 3,
        `a ${think} ms thinker only put ${run.won} Turks over on seed ${seed}`,
      )
      assert.ok(
        run.held / run.rounds > 0.9,
        `a ${think} ms thinker held ${run.held} of ${run.rounds} on seed ${seed}`,
      )
      assert.equal(run.verdicts.shear, 0, `a ${think} ms thinker sheared on seed ${seed}`)
    }
  }
})

test("nothing moves under a child who has not touched the rack yet", () => {
  // **"Sometimes the timing is sort of impossible."** The sag used to run from
  // the instant the window opened, so a child taking the p90 for their sum
  // arrived at the rack with a pan several units below the number they had done
  // the arithmetic against — and no way of knowing. `patient` is the honest
  // model of that child: it plans from the pan it read when the weight came
  // down and never looks again. It has to be able to win.
  for (const seed of SEEDS.slice(0, 6)) {
    const run = play(patient(6000, 350), { seed, seconds: 400 })
    assert.ok(run.won >= 3, `an honest thinker only put ${run.won} Turks over on seed ${seed}`)
    assert.equal(
      run.verdicts.short,
      0,
      `an honest thinker came up short ${run.verdicts.short} times on seed ${seed} — the pan moved under them`,
    )
  }
})

test("the window a weight gets never depends on how long anybody has been playing", () => {
  // **The ratchet, gone.** The same seed played for one minute and for ten has
  // to serve the same window for the same weight. A bout counter anywhere in the
  // window would show up here as a second, shorter figure for a prompt that
  // already had one.
  const short = play(solver(2400, 350), { seed: 3, seconds: 90 })
  const long = play(solver(2400, 350), { seed: 3, seconds: 600 })
  assert.ok(long.rounds > short.rounds * 3, "the long run was not actually longer")
  assert.ok(long.won >= 8, `only ${long.won} Turks went over in ten minutes`)
  for (let i = 0; i < short.windows.length; i++) {
    assert.equal(
      long.windows[i],
      short.windows[i],
      `weight ${i} was served a different window in the longer session`,
    )
  }
  // And the windows never trend down as the ladder climbs: the last quarter of a
  // ten-minute session is the hardest content in the pack and must have the most
  // time, not the least.
  const quarter = Math.floor(long.windows.length / 4)
  const opening = long.windows.slice(0, quarter)
  const closing = long.windows.slice(-quarter)
  const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length
  assert.ok(
    mean(closing) > mean(opening),
    `the window shrank from ${Math.round(mean(opening))} ms to ${Math.round(mean(closing))} ms as the maths got harder`,
  )
})

test("running out of time costs nothing, and is never reported as an answer", () => {
  // **A timeout is not a wrong answer.** A bot that sits on its hands for a
  // quarter of an hour must reach the end of it with the arm where it started
  // and with nothing filed against it — the whistle used to take a length of
  // ground and report the pan's load as the child's answer.
  const run = play(() => [], { seed: 3, seconds: 900 })
  assert.ok(run.rounds > 15, `only ${run.rounds} rounds went by`)
  assert.equal(run.verdicts.expired, run.rounds, "a round nobody touched was judged")
  assert.deepEqual(run.reports, [], "a round nobody answered was reported as an answer")
  assert.equal(run.bestArm, 0)
  assert.equal(run.won, 0)
})

test("a slow thinker is never worse off than a fast one on the same seed", () => {
  // The property that makes the window a ceiling rather than a pace: taking
  // longer may cost throughput, and must never cost accuracy.
  for (const seed of SEEDS.slice(0, 4)) {
    const quick = play(solver(1200, 350), { seed, seconds: 400 })
    const slow = play(solver(P90_TWO_DIGIT_MS / 2, 350), { seed, seconds: 400 })
    assert.equal(quick.held, quick.rounds, `a fast solver missed one on seed ${seed}`)
    assert.equal(slow.held, slow.rounds, `a slow solver missed one on seed ${seed}`)
  }
})
