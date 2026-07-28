// The two invariants `docs/EXPERIENCE_DESIGN.md` states as unit tests, plus the
// one this game adds because a wrestling pinfall is the exact thing that tempts
// a designer to break them.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  energy,
  REACTION_INPUT_KEYS,
  REACTIONS,
  reactionTier,
  type ReactionInput,
} from "../game/reaction.ts"

test("energy(SLIP) < energy(SEAT): being wrong is never the better show", () => {
  assert.ok(energy(REACTIONS[-1]) < energy(REACTIONS[0]))
  // And the ladder above SEAT is monotone, so a bigger tier is a bigger event.
  assert.ok(energy(REACTIONS[0]) < energy(REACTIONS[1]))
  assert.ok(energy(REACTIONS[1]) < energy(REACTIONS[2]))
  assert.ok(energy(REACTIONS[2]) < energy(REACTIONS[3]))
})

test("the pinfall is quieter and emptier than every escape", () => {
  // Not *shorter*: EXPERIENCE_DESIGN.md gives SLIP 260ms against SEAT's 200ms,
  // because a body settling takes longer to read than a gear tooth clicking.
  // What it must never be is louder or busier.
  assert.equal(REACTIONS[-1].particles, 0, "failure emits nothing")
  for (const tier of [0, 1, 2, 3] as const) {
    assert.ok(REACTIONS[-1].peakGain < REACTIONS[tier].peakGain)
    assert.ok(REACTIONS[-1].elements < REACTIONS[tier].elements)
  }
})

test("nothing resembling a run length is an input to the tier", () => {
  assert.deepEqual([...REACTION_INPUT_KEYS], ["difficulty", "minTaps", "taps", "repaired"])
  for (const key of REACTION_INPUT_KEYS) {
    assert.ok(
      !/streak|combo|chain|run|consecutive|multiplier/i.test(key),
      `"${key}" is a run-length input and this product bans them`,
    )
  }
  // The signature takes exactly one argument, so there is nowhere to smuggle a
  // streak in as a second parameter either.
  assert.equal(reactionTier.length, 1)
})

test("the tier is a pure function of the fall in front of it", () => {
  const input: ReactionInput = { difficulty: 0.5, minTaps: 5, taps: 5, repaired: false }
  const first = reactionTier(input)
  for (let i = 0; i < 50; i++) assert.equal(reactionTier(input), first)
})

test("escalation is on difficulty and on length of decomposition", () => {
  const easy = reactionTier({ difficulty: 0, minTaps: 2, taps: 2, repaired: false })
  const mid = reactionTier({ difficulty: 0.5, minTaps: 5, taps: 5, repaired: false })
  const hard = reactionTier({ difficulty: 0.9, minTaps: 7, taps: 7, repaired: false })
  assert.equal(easy, 0)
  assert.ok(mid > easy)
  assert.ok(hard > mid)
})

test("repairing a mal-rule is worth a tier-2 by itself", () => {
  const plain = reactionTier({ difficulty: 0, minTaps: 3, taps: 3, repaired: false })
  const repaired = reactionTier({ difficulty: 0, minTaps: 3, taps: 3, repaired: true })
  assert.ok(repaired >= 2)
  assert.ok(repaired > plain)
})

test("a wasteful escape is still an escape, it just does not climb", () => {
  const tight = reactionTier({ difficulty: 0.5, minTaps: 4, taps: 4, repaired: false })
  const loose = reactionTier({ difficulty: 0.5, minTaps: 4, taps: 8, repaired: false })
  assert.ok(loose <= tight)
  assert.ok(loose >= 0, "an exact total is never punished with a slip")
})

test("difficulty outside 0..1 is clamped rather than believed", () => {
  const wild = reactionTier({ difficulty: 40, minTaps: 9, taps: 9, repaired: true })
  const top = reactionTier({ difficulty: 1, minTaps: 9, taps: 9, repaired: true })
  assert.equal(wild, top)
  assert.ok(top <= 3)
  assert.ok(reactionTier({ difficulty: -5, minTaps: 2, taps: 2, repaired: false }) >= 0)
})
