// THE GALLERY HAS NO CLOCK, AND THIS IS THE PROOF.
//
// `PACING_AUDIT_2026-07.md` found seventeen of twenty-seven games rushed, and it
// found one architectural cause rather than seventeen tuning problems: *the
// comprehension window is derived from a motion constant that is also the
// escalation knob*, so every one of them shrank a child's thinking time as a side
// effect of getting more exciting. It named COLOSSUS as the reference for *proving*
// pacing rather than asserting it: play one seed at eight seconds a strike and at a
// fifth of a second a strike and require byte-identical results.
//
// This is that test for THE GAVEL. Two sittings from the same seed, identical
// decisions, one taking eight seconds a lot and one taking two hundred milliseconds:
//
//   * the same coins,
//   * the same tally,
//   * the same reported answers, in the same order,
//   * the same room in front of the child at the end,
//
// and the ONLY difference is the latency each answer was reported with, which is the
// one thing that should differ. If any of that ever stops holding, something in this
// pack has started reading a clock, and nothing else in the game would fail.

import assert from "node:assert/strict"
import { test } from "node:test"

import { MASHES, PERFECT, play, type Player } from "./harness.ts"

const SEEDS = [0x1, 0xc0105, 0x5eed1ce, 0xbeef, 0x2718, 0x1414, 0xfeed, 0xd00d]
const DECISIONS = 24

function twoSpeeds(player: Player, seed: number) {
  const slow = play(player, DECISIONS, seed, { step: 8000 })
  const fast = play(player, DECISIONS, seed, { step: 200 })
  return { slow, fast }
}

for (const player of [PERFECT, MASHES]) {
  test(`taking eight seconds a lot changes nothing at all: ${player.name}`, () => {
    for (const seed of SEEDS) {
      const { slow, fast } = twoSpeeds(player, seed)
      const tag = `seed ${seed.toString(16)}`

      assert.equal(slow.decisions, fast.decisions, tag)
      assert.equal(slow.coins, fast.coins, `${tag}: ${String(slow.coins)} coins slow, ${String(fast.coins)} fast`)
      assert.deepEqual(slow.game.tally, fast.game.tally, tag)
      assert.equal(slow.game.storeroom, fast.game.storeroom, tag)
      assert.equal(slow.game.remaining, fast.game.remaining, tag)
      assert.equal(slow.game.consignmentNumber, fast.game.consignmentNumber, tag)
      assert.deepEqual(
        slow.reports.map((r) => r.answered),
        fast.reports.map((r) => r.answered),
        `${tag}: the answers reported to the host differ between a slow and a fast sitting`,
      )
      assert.deepEqual(
        slow.reports.map((r) => r.correct),
        fast.reports.map((r) => r.correct),
        tag,
      )
      // The rooms themselves are identical, which is the stronger claim: the
      // difficulty the host was asked for cannot have moved either.
      assert.deepEqual(
        slow.game.room?.tablets.map((t) => t.prompt),
        fast.game.room?.tablets.map((t) => t.prompt),
        `${tag}: a slow sitting is looking at a different room`,
      )
      assert.equal(slow.game.intensity, fast.game.intensity, `${tag}: the ladder moved on the clock`)
    }
  })
}

test("the only thing a slow sitting changes is the latency it reports", () => {
  const { slow, fast } = twoSpeeds(PERFECT, 0x51004)
  assert.ok(slow.reports.length > 10, "not enough reports to compare")
  assert.ok(
    slow.reports.every((r, i) => r.ms > (fast.reports[i]?.ms ?? 0)),
    "the reported thinking time did not track the clock",
  )
})

test("time cannot accumulate at all while a bid is being set", () => {
  // The FOUNDRY STREET shape, and its comment: "a child who is thinking must never
  // be losing." The bidding phase has no duration and `advance` returns before it
  // touches anything, so a whole minute of frames is not merely harmless — it is
  // unobservable.
  const { slow } = twoSpeeds(PERFECT, 0x777)
  const before = {
    coins: slow.game.coins,
    tally: { ...slow.game.tally },
    prompts: slow.game.room?.tablets.map((t) => t.prompt),
    remaining: slow.game.remaining,
  }
  assert.equal(slow.game.phase, "bidding", "the sitting did not end on a live room")
  for (let i = 0; i < 4000; i++) slow.game.advance(16, 1_000_000 + i * 16)
  assert.equal(slow.game.coins, before.coins)
  assert.deepEqual(slow.game.tally, before.tally)
  assert.equal(slow.game.remaining, before.remaining)
  assert.deepEqual(slow.game.room?.tablets.map((t) => t.prompt), before.prompts)
  assert.equal(slow.game.phase, "bidding")
})
