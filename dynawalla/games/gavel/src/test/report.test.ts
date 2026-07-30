// WHAT THE HOST IS TOLD, AND WHAT IT IS NOT.
//
// Two games shipped reporting a derived value and marked correct children wrong:
// TREBUCHET added an ungraded crosswind to every question so a child who computed
// `47 + 25 = 72` and dialled 72 was reported WRONG with probability up to 8/9, and
// POLARITY reported `String(core)` after clamping, so perfect play was recorded as a
// miss. Both of those verdicts went to the curriculum.
//
// THE GAVEL reports `bid − 1` against the tablet the child marked, so this file
// exists to hold the one property that makes that honest:
//
//   **a child who works out the tablet they marked and bids one over it is NEVER
//   reported as wrong — whatever the money did.**
//
// That is what separates the arithmetic from the pricing. Marking the wrong tablet
// loses the lot; padding the bid buys a thing nobody wants; folding earns a coin or
// nothing. None of those three is a fact about whether the child can add, and the
// only one of them the host hears about is the one that is.

import assert from "node:assert/strict"
import { test } from "node:test"

import { isTrap } from "../game/lot.ts"
import { PERFECT, rig, settleOn, stepClock, typeBid } from "./harness.ts"

const SEEDS = [0x1, 0xbeef, 0x2718, 0x5eed1ce, 0xfeed, 0xd00d]

test("one over the tablet you marked is always reported correct, whatever the money did", () => {
  for (const seed of SEEDS) {
    const r = rig(seed)
    const clock = stepClock()
    // Deliberately perverse: mark whichever tablet is NOT the highest wherever there
    // is a choice, then bid one over it. Every one of these loses the lot, and every
    // one of them is correct arithmetic.
    for (let i = 0; i < 40; i++) {
      const room = r.game.room
      if (!room) break
      let at = room.tablets.findIndex((t) => t.value !== room.highest)
      if (at < 0) at = 0
      const tablet = room.tablets[at]
      if (!tablet) break
      r.game.tapTablet(at)
      typeBid(r.game, tablet.value + 1)
      r.game.hammer(clock())
      settleOn(r.game, clock)
    }
    assert.ok(r.reports.length > 20, `seed ${seed.toString(16)}: only ${String(r.reports.length)} reports`)
    const wrong = r.reports.filter((report) => !report.correct)
    assert.deepEqual(
      wrong,
      [],
      `seed ${seed.toString(16)}: ${String(wrong.length)} reports of correct arithmetic as wrong — ` +
        `first was ${JSON.stringify(wrong[0])}`,
    )
    // …and the game still said no. The comparison is graded by the auction, not by
    // the curriculum.
    assert.ok(r.game.tally.outbid > 0, "marking a lower tablet somehow won lots")
  }
})

test("what crosses the wire is the value the bid asserts, and nothing else", () => {
  const r = rig(0x2718)
  const clock = stepClock()
  const room = r.game.room
  assert.ok(room)
  r.game.tapTablet(0)
  const marked = room.tablets[0]
  assert.ok(marked)
  typeBid(r.game, 77)
  r.game.hammer(clock())
  assert.equal(r.reports.length, 1, "a round reported more than one answer")
  assert.equal(r.reports[0]?.questionId, marked.id)
  assert.equal(
    r.reports[0]?.answered,
    "76",
    "bidding 77 while beating a tablet asserts that the tablet is worth 76",
  )
  assert.equal(r.reports[0]?.correct, marked.value === 76)
})

test("every tablet the child read and did not answer is skipped, never filed as wrong", () => {
  // The defect this replaces: `report({ correct: false, answered: "" })` for a
  // question nobody answered. The empty string does not parse, so the learner model
  // takes a WRONG attempt and the ladder steps down — four times a round, here.
  for (const seed of SEEDS) {
    const r = rig(seed)
    const clock = stepClock()
    const rooms: number[] = []
    for (let i = 0; i < 20; i++) {
      const room = r.game.room
      if (!room) break
      rooms.push(room.tablets.length)
      PERFECT.act(r.game, room, undefined as never, clock())
      settleOn(r.game, clock)
    }
    const answered = r.reports.length
    const closed = r.skips.length
    assert.ok(answered > 0)
    // A folded lot answers none of its tablets and skips all of them, so the totals
    // are "every tablet ever raised" minus "the ones answered".
    const raised = rooms.reduce((a, b) => a + b, 0)
    assert.ok(
      closed >= raised - answered,
      `${String(raised)} tablets went up, ${String(answered)} were answered and only ` +
        `${String(closed)} were closed — the rest are open in the host's ledger`,
    )
    assert.equal(new Set(r.skips).size, r.skips.length, "a question was skipped twice")
    assert.equal(
      r.skips.filter((id) => r.reports.some((report) => report.questionId === id)).length,
      0,
      "a question was both answered and skipped",
    )
  }
})

test("a fold reports nothing at all", () => {
  const r = rig(0xbeef)
  const clock = stepClock()
  for (let i = 0; i < 12; i++) {
    if (!r.game.room) break
    r.game.fold()
    settleOn(r.game, clock)
  }
  assert.equal(r.reports.length, 0)
  assert.ok(r.skips.length >= 12 * 3, "a folded room left its tablets open")
})

test("an unarmed hammer is not an assertion: no mark, or no bid, reports nothing", () => {
  const r = rig(0x1414)
  assert.ok(r.game.room)
  // The board assembler draws a few spare questions and closes the ones it does not
  // use, so the skip ledger is not empty before the child has touched anything.
  const closedByAssembly = r.skips.length
  // No mark.
  typeBid(r.game, 12)
  assert.equal(r.game.armed, false)
  assert.deepEqual(r.game.hammer(1000), [])
  // A mark and no bid.
  while (r.game.digits !== "") r.game.backspace()
  r.game.tapTablet(0)
  assert.equal(r.game.armed, false)
  assert.deepEqual(r.game.hammer(1000), [])
  assert.equal(r.reports.length, 0)
  assert.equal(r.skips.length, closedByAssembly, "an unarmed hammer closed the room's questions")
  // Both, and now it fires.
  typeBid(r.game, 5)
  assert.equal(r.game.armed, true)
  assert.equal(r.game.hammer(1000).length, 1)
})

test("the latency reported is thinking time, with any sheet the host raised taken out", () => {
  const r = rig(0x777)
  r.game.tapTablet(0)
  typeBid(r.game, 9)
  // The lot came to the block at t = 0. A sheet goes up at 1 s and comes off at 61 s, and
  // the child answers at 63 s: one second before the sheet plus two after it, so three
  // seconds of looking at the room rather than sixty-three.
  r.game.pause(1_000)
  r.game.resume(61_000)
  r.game.hammer(63_000)
  assert.equal(r.reports.length, 1)
  assert.equal(r.reports[0]?.ms, 3_000)
})

test("nothing the child does behind a sheet is a thing the child did", () => {
  const r = rig(0xd00d)
  const closedByAssembly = r.skips.length
  r.game.pause(500)
  r.game.tapTablet(0)
  typeBid(r.game, 40)
  assert.equal(r.game.marked, null, "a tablet was marked behind the sheet")
  assert.equal(r.game.digits, "", "digits reached the paddle behind the sheet")
  assert.deepEqual(r.game.hammer(900), [])
  assert.deepEqual(r.game.fold(), [])
  assert.equal(r.reports.length, 0)
  assert.equal(r.skips.length, closedByAssembly)
})

test("a lot nobody can profit from is a real state, and folding it is what pays", () => {
  // Reached by playing perfectly for long enough that the ladder is high enough for
  // the broker to start making offers that are not worth chasing.
  const r = rig(0x5eed1ce)
  const clock = stepClock()
  let traps = 0
  let scoutFees = 0
  for (let i = 0; i < 120; i++) {
    const room = r.game.room
    if (!room) break
    if (isTrap(room)) {
      traps++
      const before = r.game.coins
      r.game.fold()
      scoutFees += r.game.coins - before
    } else {
      PERFECT.act(r.game, room, undefined as never, clock())
    }
    settleOn(r.game, clock)
  }
  assert.ok(traps > 4, `only ${String(traps)} unprofitable lots in 120 — the trap never fires`)
  assert.equal(scoutFees, traps, "spotting an unprofitable lot did not pay the scout's fee")
})
