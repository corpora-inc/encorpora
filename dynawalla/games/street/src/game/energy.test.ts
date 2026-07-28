import assert from "node:assert/strict"
import { test } from "node:test"

import {
  type Beat,
  HAPTIC,
  REWARDS,
  SEATS,
  SLIPS,
  TIER_BUDGET,
  energy,
  reactionFor,
} from "./energy.ts"

const ctx = { size: 8, bestSeam: false }

test("being wrong is never more interesting than being right", () => {
  // `energy(SLIP) < energy(SEAT)`, the invariant from EXPERIENCE_DESIGN.md, and
  // in this game the temptation it guards is specific: a refused seam wants
  // sparks the whole width of the street.
  const quietestSeat = Math.min(...SEATS.map((b) => energy(reactionFor(b, ctx))))
  for (const slip of SLIPS) {
    const e = energy(reactionFor(slip, ctx))
    assert.ok(e < quietestSeat, `${slip} (${e}) is louder than the quietest seat (${quietestSeat})`)
  }
})

test("a reward is louder than a seat, and a block is the loudest thing there is", () => {
  const loudestSeat = Math.max(...SEATS.map((b) => energy(reactionFor(b, ctx))))
  for (const reward of REWARDS) {
    assert.ok(energy(reactionFor(reward, ctx)) > loudestSeat, `${reward} is quieter than a seat`)
  }
  const block = energy(reactionFor("block", ctx))
  for (const beat of [...SLIPS, ...SEATS, ...REWARDS] as Beat[]) {
    if (beat === "block") continue
    assert.ok(block > energy(reactionFor(beat, ctx)), `${beat} outweighs a finished block`)
  }
})

test("escalation takes no streak, no combo and no run length", () => {
  // The signature is the assertion. `reactionFor` sees what happened and the
  // number it happened to, and there is nowhere to put "you have been right
  // nine times" — which is the loop this product bans.
  assert.equal(reactionFor.length, 2)
  const keys = Object.keys(ctx).sort()
  assert.deepEqual(keys, ["bestSeam", "size"])
  // And it is stable: the same beat on the same number is the same reaction
  // however long the child has been playing.
  const first = reactionFor("crack", { size: 8, bestSeam: false })
  const later = reactionFor("crack", { size: 8, bestSeam: false })
  assert.deepEqual(first, later)
})

test("a crack escalates on the size of the mob and on choosing well", () => {
  const plain = reactionFor("crack", { size: 8, bestSeam: false })
  const big = reactionFor("crack", { size: 18, bestSeam: false })
  const good = reactionFor("crack", { size: 8, bestSeam: true })
  assert.equal(plain.tier, 0)
  assert.equal(big.tier, 1)
  assert.equal(good.tier, 1)
  assert.ok(energy(big) > energy(plain))
  assert.ok(energy(good) > energy(plain))
  assert.equal(big.budgetMs, TIER_BUDGET[1])
})

test("nothing but a crack escalates at all", () => {
  for (const beat of [...SLIPS, ...REWARDS, "down", "rivetRight"] as Beat[]) {
    assert.deepEqual(
      reactionFor(beat, { size: 2, bestSeam: false }),
      reactionFor(beat, { size: 24, bestSeam: true }),
      `${beat} escalated`,
    )
  }
})

test("every reaction sits inside its tier's budget", () => {
  for (const beat of [...SLIPS, ...SEATS, ...REWARDS] as Beat[]) {
    const r = reactionFor(beat, ctx)
    assert.ok(r.budgetMs <= TIER_BUDGET[r.tier], `${beat} overruns tier ${r.tier}`)
    assert.ok(r.particles > 0 && r.peakGain > 0 && r.elements > 0)
    assert.ok(r.peakGain <= 0.5, `${beat} peaks at ${r.peakGain}`)
  }
})

test("the device only says failure for the one thing that takes something away", () => {
  const failures = (Object.keys(HAPTIC) as Beat[]).filter((b) => HAPTIC[b] === "failure")
  assert.deepEqual(failures, ["shove"])
  // A refused seam is how the child finds out a number does not go. The motor
  // must not editorialise about it.
  assert.equal(HAPTIC.ringoff, "light")
  assert.equal(HAPTIC.bounce, "light")
  assert.equal(HAPTIC.rivetWrong, "light")
})
