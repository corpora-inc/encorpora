// The claim the whole design rests on: **flailing is strictly worse than
// thinking, and the game shows you why rather than telling you off.**
//
// COLOSSUS has no lives, no buzzer, no timer and no red mark. The only thing a
// wrong strike costs is more building. If that ever stops being true — a growth
// path quietly clamped, a penalty accidentally made free — nothing else in the
// game would fail, and it would become a slot machine that rewards speed.
//
// So this file plays it twice from identical seeds: same host, same stream of
// keystones, same first tower, one child who works each keystone out and one
// who grabs whatever is under their thumb and hits STRIKE.
//
// **Why a sitting and not a strike.** A single random grab can be right — on
// the easiest tier the answer is one slab, and a tower is only nine or ten
// floors, so a lucky poke lands sometimes. That is not a flaw; a game where
// flailing is impossible is a game where nobody explores. The claim is about
// the shape of a sitting, and that is what is measured here: over thirty
// strikes the masher clears less, topples nothing, and spends the whole time
// under a taller building.
//
// Everything is seeded from a literal. Nothing here reads `Math.random`, and
// nothing here reads a wall clock.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import { GROWTH } from "../game/game.ts"
import { mean, playByMashing, playCarefully, rig, stepClock } from "./harness.ts"

const SEEDS = [0x1, 0xc0105, 0x5eed1ce, 0xbeef, 0x2718, 0x1414, 0xfeed, 0xd00d]
const STRIKES = 30

test("a mashing sitting is spent under a strictly taller building", () => {
  for (const seed of SEEDS) {
    const careful = rig(seed)
    const masher = rig(seed)
    const tag = `seed ${seed.toString(16)}`

    // Identical towers: the level is built before anybody touches anything, so
    // any difference from here is a difference in how it was played.
    assert.deepEqual(
      careful.game.floors.map((f) => f.value),
      masher.game.floors.map((f) => f.value),
      `${tag} did not build the same tower twice`,
    )

    const carefulHeights = playCarefully(careful.game, STRIKES, stepClock())
    const masherHeights = playByMashing(masher.game, STRIKES, new Rng(seed ^ 0x77), stepClock())

    assert.equal(carefulHeights.length, STRIKES)
    assert.equal(masherHeights.length, STRIKES)
    assert.ok(
      mean(masherHeights) > mean(carefulHeights),
      `${tag}: mashing averaged ${mean(masherHeights).toFixed(1)} floors, careful ${mean(carefulHeights).toFixed(1)}`,
    )
    assert.ok(
      Math.max(...masherHeights) > Math.max(...carefulHeights),
      `${tag}: mashing never got further behind than careful play did`,
    )
    // Careful play sees the ground. Mashing never does — the heights sampled
    // here are read after the level has already rolled over, so a toppled
    // tower shows up in the tally rather than as a zero in the series.
    assert.ok(careful.game.tally.toppled > 0, `${tag}: careful play never cleared a tower`)
    assert.equal(masher.game.tally.toppled, 0, `${tag}: mashing put a colossus on the ground`)
  }
})

test("over a sitting, mashing clears less, topples nothing, and builds more", () => {
  for (const seed of SEEDS) {
    const careful = rig(seed)
    const masher = rig(seed)
    const tag = `seed ${seed.toString(16)}`

    playCarefully(careful.game, STRIKES, stepClock())
    playByMashing(masher.game, STRIKES, new Rng(seed ^ 0x77), stepClock())

    assert.equal(careful.game.tally.cleared, STRIKES, `${tag}: careful play missed one`)
    assert.equal(careful.game.tally.missed, 0, tag)
    assert.ok(careful.game.tally.toppled >= 6, `${tag}: only ${careful.game.tally.toppled} toppled`)

    assert.ok(
      masher.game.tally.cleared < careful.game.tally.cleared,
      `${tag}: mashing cleared ${masher.game.tally.cleared}`,
    )
    assert.equal(masher.game.tally.toppled, 0, `${tag}: mashing toppled a colossus`)
    assert.ok(
      masher.game.tally.missed > masher.game.tally.cleared * 2,
      `${tag}: ${masher.game.tally.missed} missed against ${masher.game.tally.cleared} cleared`,
    )
    // Every miss is stone the child now has to punch back out.
    assert.ok(masher.game.tally.missed * GROWTH >= 2 * STRIKES - 20, tag)

    // The reports agree: a mashing sitting is a run of wrong answers, not a run
    // of unanswered questions. Every strike in both sittings is judged.
    assert.equal(careful.reports.length, STRIKES)
    assert.equal(masher.reports.length, STRIKES)
    assert.ok(careful.reports.every((r) => r.correct))
    assert.ok(
      masher.reports.filter((r) => r.correct).length < careful.reports.length / 2,
      tag,
    )
  }
})

test("striking faster never helps: the penalty is stone, and stone does not decay", () => {
  // Two mashers on the same seed, one taking eight seconds a strike and one
  // taking a fifth of a second. They end up under the same tower, because
  // nothing in COLOSSUS is on a clock.
  const slow = rig(0x51004)
  const fast = rig(0x51004)
  playByMashing(slow.game, 12, new Rng(4), stepClock(8000))
  playByMashing(fast.game, 12, new Rng(4), stepClock(200))
  assert.equal(slow.game.height, fast.game.height)
  assert.deepEqual(slow.game.tally, fast.game.tally)
  assert.deepEqual(
    slow.reports.map((r) => r.answered),
    fast.reports.map((r) => r.answered),
  )
  // Only the latency differs, which is the one thing that should.
  assert.ok(slow.reports.every((r, i) => r.ms > (fast.reports[i]?.ms ?? 0)))
})
