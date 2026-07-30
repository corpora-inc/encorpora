// WHAT BEING WRONG COSTS: MORE WORK, VISIBLE AND COUNTABLE, AND NOTHING ELSE.
//
// COLOSSUS is the fleet's reference for this and its rule is stated in the game's own
// manual: "two new floors thud down on top. Nothing is taken away from you. No buzzer,
// no lost life, no red cross. You just get more building to knock down."
//
// THE GAVEL's version: a lot that does not sell stays in the consignment and the broker
// adds one more, so being wrong costs two more lots of work than being right. The strip
// at the top of the screen is one pip per lot owed, so it is countable from across a
// room. This file holds the four things that have to be true for that to be the whole
// cost.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  BENCH_CAP,
  CONSIGNMENT,
  EXTRA_ON_MISS,
  MAX_CONSIGNMENT,
  SCOUT_FEE,
} from "../game/auction.ts"
import { Rng } from "../core/rng.ts"
import { isTrap } from "../game/lot.ts"
import {
  BIDS_THE_MAX,
  EYEBALLS_THE_ROOM,
  FOLDS,
  IGNORES_THE_OFFER,
  MASHES,
  PERFECT,
  READS_ONLY_THE_OFFER,
  rig,
  settleOn,
  stepClock,
  typeBid,
} from "./harness.ts"

const SEEDS = [0x1, 0xbeef, 0x2718, 0x5eed1ce, 0xfeed, 0xd00d]

test("a lot that does not sell costs exactly two more lots of work than one that does", () => {
  const r = rig(0x2718)
  const clock = stepClock()
  const room = r.game.room
  assert.ok(room)
  assert.equal(r.game.remaining, CONSIGNMENT)

  // A bid under the room: outbid.
  r.game.tapTablet(room.tablets.findIndex((t) => t.value === room.highest))
  typeBid(r.game, 1)
  r.game.hammer(clock())
  assert.equal(r.game.settled?.outcome, "outbid")
  assert.equal(
    r.game.remaining,
    CONSIGNMENT + EXTRA_ON_MISS,
    "the lot did not come back, or the broker did not add one",
  )
  settleOn(r.game, clock)

  // …and a sale takes one off.
  const next = r.game.room
  assert.ok(next)
  const before = r.game.remaining
  r.game.tapTablet(next.tablets.findIndex((t) => t.value === next.highest))
  typeBid(r.game, next.highest + 1)
  r.game.hammer(clock())
  assert.equal(r.game.settled?.outcome, isTrap(next) ? "unsold" : "sold")
  if (!isTrap(next)) {
    assert.equal(r.game.remaining, before - 1)
  }
})

test("no coin is ever taken away, whatever anybody does", () => {
  // `EXPERIENCE_DESIGN.md`: construction never regresses. The strongbox is the only
  // score in the game and it is the child-safe form of loss aversion — the pull to come
  // back is "my consignment is unsold", never "my coins are at risk".
  for (const player of [
    PERFECT,
    BIDS_THE_MAX,
    IGNORES_THE_OFFER,
    READS_ONLY_THE_OFFER,
    EYEBALLS_THE_ROOM,
    MASHES,
    FOLDS,
  ]) {
    for (const seed of SEEDS) {
      const r = rig(seed)
      const clock = stepClock()
      let last = 0
      for (let i = 0; i < 30; i++) {
        const room = r.game.room
        if (!room) break
        player.act(r.game, room, new Rng(seed ^ 0x99), clock())
        assert.ok(
          r.game.coins >= last,
          `"${player.name}" on seed ${seed.toString(16)}: the strongbox fell from ` +
            `${String(last)} to ${String(r.game.coins)}`,
        )
        last = r.game.coins
        settleOn(r.game, clock)
      }
    }
  }
})

test("the storeroom counts overpaid lots, only ever rises, and nothing else touches it", () => {
  const padded = rig(0x1)
  const clock = stepClock()
  let last = 0
  for (let i = 0; i < 40; i++) {
    const room = padded.game.room
    if (!room) break
    padded.game.tapTablet(room.tablets.findIndex((t) => t.value === room.highest))
    typeBid(padded.game, room.offer + 3)
    padded.game.hammer(clock())
    assert.equal(padded.game.settled?.outcome, "unsold")
    assert.equal(padded.game.storeroom, last + 1, "an overpaid lot did not reach the shelf")
    last = padded.game.storeroom
    settleOn(padded.game, clock)
  }
  assert.equal(last, 40)
  // …and a player who never overpays never has one.
  const clean = rig(0x1)
  const clock2 = stepClock()
  for (let i = 0; i < 40; i++) {
    const room = clean.game.room
    if (!room) break
    PERFECT.act(clean.game, room, undefined as never, clock2())
    settleOn(clean.game, clock2)
  }
  assert.equal(clean.game.storeroom, 0)
})

test("the consignment strip stays countable: it never grows past its cap", () => {
  const r = rig(0xbeef)
  const clock = stepClock()
  for (let i = 0; i < 200; i++) {
    const room = r.game.room
    if (!room) break
    // Never win anything, forever.
    r.game.tapTablet(0)
    typeBid(r.game, 1)
    r.game.hammer(clock())
    assert.ok(
      r.game.remaining <= MAX_CONSIGNMENT,
      `the consignment reached ${String(r.game.remaining)} lots — a strip that long is not countable`,
    )
    settleOn(r.game, clock)
  }
  assert.equal(r.game.remaining, MAX_CONSIGNMENT)
  assert.equal(r.game.coins, 0)
})

test("a stopping point is only ever offered after a consignment that sold something", () => {
  // ADR-0013: a purchase surface must never sit next to a shortfall. `transition` is the
  // call that can put one there, so it is only made when the child finished something.
  const good = rig(0x2718)
  const clock = stepClock()
  for (let i = 0; i < 40; i++) {
    const room = good.game.room
    if (!room) break
    PERFECT.act(good.game, room, undefined as never, clock())
    settleOn(good.game, clock)
  }
  assert.ok(good.transitions.length > 0, "a consignment was sold out and nothing was offered")
  assert.ok(good.transitions.every((t) => t.kind === "level"))

  // A child who folded every lot cleared the consignment without selling a thing.
  const folded = rig(0x2718)
  const clock2 = stepClock()
  for (let i = 0; i < 40; i++) {
    if (!folded.game.room) break
    folded.game.fold()
    settleOn(folded.game, clock2)
  }
  assert.ok(folded.game.consignmentNumber > 1, "no consignment was ever cleared")
  assert.deepEqual(folded.transitions, [], "a stopping point was offered after selling nothing")
})

test("the scout's fee is the only coin that arrives without a sale", () => {
  const r = rig(0x5eed1ce)
  const clock = stepClock()
  let fees = 0
  let sales = 0
  for (let i = 0; i < 120; i++) {
    const room = r.game.room
    if (!room) break
    const before = r.game.coins
    if (isTrap(room)) {
      r.game.fold()
      const gained = r.game.coins - before
      assert.ok(gained === 0 || gained === SCOUT_FEE)
      fees += gained
    } else {
      PERFECT.act(r.game, room, undefined as never, clock())
      sales += r.game.coins - before
    }
    settleOn(r.game, clock)
  }
  assert.ok(fees > 0, "no unprofitable lot was ever spotted")
  assert.ok(sales > fees * 10, `the fees are ${String(fees)} against ${String(sales)} from selling`)
})

test("a long sitting never holds more than a boardful and a benchful of questions", () => {
  // A leak guard, and it replaces a test that asserted a count of CLOSED questions was
  // over a hundred — which 120 lots of ordinary play satisfies whatever the bench does.
  // The accounting identity is in `lot.test.ts`; this is the bound over a long sitting.
  const r = rig(0xd00d)
  const clock = stepClock()
  let worst = 0
  for (let i = 0; i < 120; i++) {
    const room = r.game.room
    if (!room) break
    PERFECT.act(r.game, room, undefined as never, clock())
    settleOn(r.game, clock)
    worst = Math.max(worst, r.game.benched)
    assert.ok(r.game.benched <= BENCH_CAP, `the bench reached ${String(r.game.benched)}`)
  }
  assert.equal(worst, BENCH_CAP, `the bench never filled: high-water mark ${String(worst)}`)
  assert.ok(r.game.trimmed > 20, `only ${String(r.game.trimmed)} benched questions were closed`)
})
