// **The bar this game was designed against: no mashing strategy wins.**
//
// The canon entry calls THE STEELYARD (shipped as THE COUNTERWEIGHT) the most
// unmashable design in the catalogue, and that is a claim about behaviour, so it
// is settled by playing rather than by reading the source. Every case below drives
// the shipping `Bout` with a bot and counts what it got. The bots are in
// `harness.ts`.
//
// **These now run without a round clock at all.** The press window was deleted —
// see `guard.ts` — so every bot below has as long as it likes, and what stops it
// has to be a rule rather than a whistle. That makes this file a stronger result
// than it was, not a weaker one:
//
//   * **Hit everything fast.** The steel shears — `strain.ts`. It is not that
//     mashing is inefficient; it is that mashing ends the round.
//   * **Hit one plate fast.** Same shear.
//   * **Hit one plate slowly**, under the resonance window, so the steel never
//     shears. Then the arithmetic gets you: a pan walking in ones never stops at
//     one over, because nothing about walking it knows where that is.
//   * **Hunt by watching the beam** instead of computing. A beam announces
//     *level*, and level is `margin === 0`, which is SHORT. This is the case the
//     window used to be covering, and it turns out the rule was doing the work.
//
// And the control, without which none of the above means anything: a bot that
// *does* the arithmetic wins comfortably, every seed.

import assert from "node:assert/strict"
import { test } from "node:test"

import { MIN_GUARD_SECONDS } from "../game/guard.ts"
import { FACES } from "../game/places.ts"
import { hammer, masher, patient, play, prober, solver } from "./harness.ts"

/** Fixed, so this file has no unseeded randomness in it anywhere. */
const SEEDS = Array.from({ length: 12 }, (_, i) => i * 7919 + 3)

test("hitting everything as fast as a thumb can move never clears a scale", () => {
  for (const seed of SEEDS) {
    const run = play(masher(56), { seed, seconds: 600 })
    assert.equal(run.won, 0, `a masher cleared a scale on seed ${seed}`)
    assert.equal(run.held, 0, `a masher held ${run.held} rounds on seed ${seed}`)
    // And it is not that they ran out of time: they played eighty-odd rounds and
    // sheared the beam in every single one.
    assert.ok(run.rounds > 40, `only ${run.rounds} rounds on seed ${seed}`)
    assert.equal(run.verdicts.shear, run.rounds)
    // **And not one of those rounds was reported as an answer.** A sheared beam
    // leaves the pan wherever the mashing happened to put it; filing that as the
    // child's answer to `400 + 100` would be inventing a misconception out of
    // noise and stepping the host's ladder on it.
    assert.deepEqual(run.reports, [], `a masher had ${run.reports.length} answers filed`)
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

test("hunting for the tipping point by watching the beam never wins either", () => {
  // **The case the deleted clock used to be covering.** A beam-watcher can now
  // probe for as long as it likes: nothing runs out, and every probe refills the
  // abandonment guard. It still gets nowhere, because a beam announces *level* and
  // level is `margin === 0`, which is SHORT. The "one over" rule was doing this
  // work all along, and the clock was only hiding that.
  //
  // The odd round is allowed — a beam that told you nothing at all would be a beam
  // not worth drawing. What it must not do is carry anybody through a scale,
  // because clearing one needs five net good weights.
  for (const seed of SEEDS) {
    const run = play(prober(), { seed, seconds: 600 })
    assert.equal(run.won, 0, `a beam-watcher cleared a scale on seed ${seed}`)
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
    assert.ok(run.won >= 6, `a solver only cleared ${run.won} scales on seed ${seed}`)
    assert.ok(
      run.held / run.rounds > 0.85,
      `a solver held only ${run.held} of ${run.rounds} on seed ${seed}`,
    )
    assert.equal(run.verdicts.shear, 0, `a solver sheared the beam on seed ${seed}`)
  }
})

test("a player who thinks slowly still wins, just fewer of them", () => {
  // Comprehension time is the child's and is never the thing being scored. A bot
  // that takes four seconds to read the chit before its first blow must still be
  // able to clear scales.
  for (const seed of SEEDS.slice(0, 6)) {
    const run = play(solver(4200, 300), { seed, seconds: 600 })
    assert.ok(run.won >= 3, `a slow thinker only cleared ${run.won} scales on seed ${seed}`)
  }
})

test("what a wrong docket reports is a number the child wrote, not noise", () => {
  // The diagnosis rides on this: the value reported is the brass minus the one
  // over, so a child running a broken column procedure reports its output.
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
  // **The headline defect.** Measured on this bot against the original ratchet:
  // at a nine second pause it held 45 of 96 rounds; at the documented p90 it held
  // 0 of 78 and never won once, because the window was falling from 13.0 s to
  // 7.6 s while the sums climbed to four digits.
  for (const think of [2400, 4200, 6000, 9000]) {
    for (const seed of SEEDS.slice(0, 6)) {
      const run = play(solver(think, 350), { seed, seconds: 400 })
      assert.ok(
        run.won >= 3,
        `a ${think} ms thinker only cleared ${run.won} scales on seed ${seed}`,
      )
      assert.ok(
        run.held / run.rounds > 0.9,
        `a ${think} ms thinker held ${run.held} of ${run.rounds} on seed ${seed}`,
      )
      assert.equal(run.verdicts.shear, 0, `a ${think} ms thinker sheared on seed ${seed}`)
    }
  }
})

test("nothing moves under a child who is still thinking, at any think time", () => {
  // **"Sometimes the timing is sort of impossible."** The sag used to drain a pan
  // left alone, so a child who read the chit, did the sum and then reached for the
  // rack found the number they had computed against was no longer there — with no
  // way of knowing. `patient` is the honest model of that child: it plans from the
  // pan it read when the lot came on and never looks again.
  //
  // The sag is gone, so this is now a fence rather than a fix — and it is run out
  // to a think time longer than the *whole* old window at two digits, which the
  // old game could not have survived at all.
  for (const think of [6000, 12_000, 18_000]) {
    for (const seed of SEEDS.slice(0, 6)) {
      const run = play(patient(think, 350), { seed, seconds: 600 })
      assert.ok(
        run.won >= 2,
        `a ${think} ms honest thinker only cleared ${run.won} scales on seed ${seed}`,
      )
      assert.equal(
        run.verdicts.short,
        0,
        `a ${think} ms honest thinker came up short ${run.verdicts.short} times on seed ${seed} — something moved the pan`,
      )
    }
  }
})

test("the patience a lot gets never depends on how long anybody has been playing", () => {
  // **The ratchet, gone.** The same seed played for one minute and for ten has to
  // serve the same guard for the same lot. A scale counter anywhere near the guard
  // would show up here as a second, shorter figure for a prompt that already had
  // one.
  const short = play(solver(2400, 350), { seed: 3, seconds: 90 })
  const long = play(solver(2400, 350), { seed: 3, seconds: 600 })
  assert.ok(long.rounds > short.rounds * 3, "the long run was not actually longer")
  assert.ok(long.won >= 8, `only ${long.won} scales were cleared in ten minutes`)
  for (let i = 0; i < short.guards.length; i++) {
    assert.equal(
      long.guards[i],
      short.guards[i],
      `lot ${i} was served a different guard in the longer session`,
    )
  }
  // And the guards never trend down as the ladder climbs: the last quarter of a
  // ten-minute session is the hardest content in the pack and must have the most
  // patience, not the least.
  const quarter = Math.floor(long.guards.length / 4)
  const opening = long.guards.slice(0, quarter)
  const closing = long.guards.slice(-quarter)
  const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length
  assert.ok(
    mean(closing) > mean(opening),
    `the guard shrank from ${Math.round(mean(opening))} ms to ${Math.round(mean(closing))} ms as the maths got harder`,
  )
})

test("walking away costs nothing, and is never reported as an answer", () => {
  // **A lapse is not a wrong answer.** A bot that sits on its hands for a quarter
  // of an hour must reach the end of it with the day's run where it started and
  // with nothing filed against it — the whistle used to take a length of ground
  // and report the pan's load as the child's answer.
  const run = play(() => [], { seed: 3, seconds: 900 })
  assert.ok(run.rounds > 8, `only ${run.rounds} rounds went by`)
  assert.equal(run.verdicts.lapsed, run.rounds, "a round nobody touched was judged")
  assert.deepEqual(run.reports, [], "a round nobody answered was reported as an answer")
  assert.equal(run.bestRun, 0)
  assert.equal(run.won, 0)
})

test("a player striking once every fifteen seconds is never told nobody was there", () => {
  // The other half of the case above, and the whole point of a guard rather than a
  // clock: a hand on the rack refills it, so somebody playing very slowly indeed
  // still never lapses. Fifteen seconds a blow is slower than the ENTIRE old
  // window for `43 + 25` (14.5 s), and this bot plays for a quarter of an hour of
  // it without one round being taken away.
  let since = 0
  let blows = 0
  const run = play(
    ({ bout }) => {
      since += 16
      if (bout.phase !== "press" || since < 15_000) return []
      since = 0
      blows += 1
      // Six blows and then a stamp, so rounds actually close and this is not
      // measuring an empty run. Ninety seconds a round, on the bottom rung, where
      // the whole window used to be 14.5.
      if (blows >= 6) {
        blows = 0
        return ["stamp"]
      }
      return [{ place: 1 as const, dir: 1 as const }]
    },
    { seed: 3, seconds: 900 },
  )
  assert.ok(run.rounds > 5, `only ${run.rounds} rounds closed, so this measured nothing`)
  assert.equal(
    run.verdicts.lapsed,
    0,
    `a player striking every 15 s lapsed ${run.verdicts.lapsed} times`,
  )
})

test("staring at a two-digit sum for twenty-five seconds still wins", () => {
  // **The bot finding that set `MIN_GUARD_SECONDS`.** The guard has to be finite,
  // so somewhere there is a pause long enough to be read as an empty room — and
  // the first floor tried, twenty seconds, put this bot into a lapse on every one
  // of three hundred rounds. Twenty-five seconds of *complete stillness* on a
  // two-digit sum is nearly twice the house p90 and it has to be fine.
  // Named rather than left to fail mysteriously: this bot's pause and the floor
  // are coupled, and moving either without the other is the bug.
  assert.ok(
    MIN_GUARD_SECONDS * 1000 > 25_000,
    `the floor is ${MIN_GUARD_SECONDS}s and no longer clears this bot's 25s pause`,
  )
  for (const seed of SEEDS.slice(0, 6)) {
    const run = play(solver(25_000, 350), { seed, seconds: 900 })
    assert.equal(
      run.verdicts.lapsed,
      0,
      `a 25 s starer lapsed ${run.verdicts.lapsed} of ${run.rounds} rounds on seed ${seed}`,
    )
    assert.ok(run.won >= 3, `a 25 s starer only cleared ${run.won} scales on seed ${seed}`)
    assert.equal(run.held, run.rounds, `a 25 s starer missed one on seed ${seed}`)
  }
})

test("a slow thinker is never worse off than a fast one on the same seed", () => {
  // The property that makes thinking free: taking longer may cost throughput, and
  // must never cost accuracy.
  for (const seed of SEEDS.slice(0, 4)) {
    const quick = play(solver(1200, 350), { seed, seconds: 400 })
    const slow = play(solver(P90_TWO_DIGIT_MS / 2, 350), { seed, seconds: 400 })
    assert.equal(quick.held, quick.rounds, `a fast solver missed one on seed ${seed}`)
    assert.equal(slow.held, slow.rounds, `a slow solver missed one on seed ${seed}`)
  }
})
