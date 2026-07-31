// THE GAVEL does not take the answers away from a child who is still reading them.
//
// The report this file exists to answer, in the founder's words: "when you fold
// you should be able to study the answers and then go on, not just have the
// answers flashed for a second and then go on". It was literally a second —
// `revealHoldMs` floors at `MIN_REVEAL_MS = 900`, and a child ten lots into a
// good run is already at that floor, so the settled room carrying every rival's
// value was up for nine hundred milliseconds and then gone whatever anybody had
// managed to read.
//
// Four claims, all driven through the real `Auction`:
//
//   1. **A settled room with something to teach never expires.** Not after the
//      old 900 ms, not after the old full-patience 4.2 s, not after a minute.
//   2. **Nothing moves underneath it.** No lot is called, no question is served,
//      no report or skip crosses to the host, the ladder does not step. A child
//      who is reading must never be losing.
//   3. **The gesture that made the reveal cannot dismiss it.** `mount.ts` routes
//      every press during the settled phase to `nudge`, so without a settle floor
//      the second tap of a double-tap on the hammer would eat the lesson inside
//      its own fade-in.
//   4. **It is still adaptive, and it is still skipped at the top.** A clean sale
//      does not wait — that would turn an auction into a queue of dismissals —
//      and neither does anything at all once the child is at the ceiling.
//
// Mutation-tested: for each assertion the line in `auction.ts` or `flow.ts` that
// implements it was broken and the named assertion is the one that fired.

import assert from "node:assert/strict"
import { test } from "node:test"

import type { Ask, Host, Question } from "../contract.ts"
import { Rng } from "../core/rng.ts"
import { Auction, teaches, type Outcome, type Settled } from "../game/auction.ts"
import { MIN_REVEAL_MS, SPEC, revealHoldMs } from "../game/ladder.ts"
import { createStubHost } from "../stubHost.ts"
import { PERFECT, play, rig, settleOn, stepClock, typeBid } from "./harness.ts"
import { REVEAL_SETTLE_MS, revealPlan } from "../../../../packs/shared/game-pacing/index.ts"

/** The reveal THE GAVEL shipped with, kept only to measure against. */
const OLD_FLOOR_MS = 900
/** …and its full-patience end, for the same reason. */
const OLD_CALM_MS = 4200

type Counted = {
  game: Auction
  host: Host
  /** Questions the host was asked for. A new lot cannot be called without one. */
  asks: () => number
  reports: string[]
  skips: string[]
}

/** A rig that counts every question served, not only the ones reported on. */
function counted(seed = 0x9a7e1): Counted {
  let asks = 0
  const reports: string[] = []
  const skips: string[] = []
  const base = createStubHost({
    seed,
    reducedMotion: true,
    onReport: (r) => reports.push(r.questionId),
    onSkip: (id) => skips.push(id),
  })
  const host: Host = {
    ...base,
    next(ask?: Ask): Question {
      asks++
      return base.next(ask)
    },
  }
  const game = new Auction(host, new Rng(seed ^ 0x1234), 0)
  game.begin(0)
  return { game, host, asks: () => asks, reports, skips }
}

/** Sixty seconds of frames at 60 Hz. Longer than any child stares at anything. */
function pump(game: Auction, ms: number, clock: () => number): void {
  for (let t = 0; t < ms; t += 16) game.advance(16, clock())
}

// -- 1 & 2: the fold the founder raised -------------------------------------

test("a fold holds the room open until the child's own hand, and nothing runs underneath", () => {
  const r = counted()
  const clock = stepClock()
  const room = r.game.room
  assert.ok(room, "no room came to the block")

  r.game.fold()
  assert.equal(r.game.phase, "settled")
  assert.equal(r.game.studying, true, "a fold was settled with no reveal to study")
  assert.equal(
    r.game.holdLeft,
    Number.POSITIVE_INFINITY,
    `the fold's reveal has a deadline on it: ${String(r.game.holdLeft)}ms`,
  )

  const asks = r.asks()
  const reports = r.reports.length
  const skips = r.skips.length
  const intensity = r.game.intensity
  const coins = r.game.coins
  const remaining = r.game.remaining

  // A full minute — sixty-six times the beat this used to get, and fourteen
  // times the longest reveal the shared curve will ever ask for.
  pump(r.game, 60_000, clock)

  assert.equal(r.game.room, room, "the settled room was taken away while it was being read")
  assert.equal(r.game.phase, "settled", "the auction moved on by itself")
  assert.equal(r.asks(), asks, "a new question was served while the child was still reading")
  assert.equal(r.reports.length, reports, "a report crossed to the host during the reveal")
  assert.equal(r.skips.length, skips, "a question was closed during the reveal")
  assert.equal(r.game.intensity, intensity, "the ladder stepped while the child was reading")
  assert.equal(r.game.coins, coins, "the strongbox moved while the child was reading")
  assert.equal(r.game.remaining, remaining, "the consignment moved while the child was reading")

  // …and the child's own hand still works, immediately.
  r.game.nudge()
  r.game.advance(1, clock())
  assert.notEqual(r.game.room, room, "the child asked to go on and the auction did not")
  assert.equal(r.game.phase, "bidding")
  assert.ok(r.asks() > asks, "the next lot came up without a single question being served")
})

test("the reveal outlasts every duration THE GAVEL used to hold it for", () => {
  for (const ms of [OLD_FLOOR_MS, OLD_CALM_MS]) {
    const r = counted(0x51ce)
    const clock = stepClock()
    const room = r.game.room
    r.game.fold()
    pump(r.game, ms, clock)
    assert.equal(
      r.game.room,
      room,
      `the settled room was gone ${String(ms)}ms after the fold — the old timer is still in there`,
    )
  }
})

test("a lot already at the reveal's floor waits too — that was the whole complaint", () => {
  // Ten lots of flawless play puts a child around 0.68 on the ladder, where
  // `revealHoldMs` is already pinned to `MIN_REVEAL_MS`. This is the exact state
  // the report was written from: a good run, one fold, and the room gone in a
  // second. It still has a reveal to show — `revealPlan` is willing at 0.68 —
  // and now it is the child who takes it down.
  const sitting = play(PERFECT, 10)
  const game = sitting.game
  assert.ok(game.intensity > 0.5, `ten flawless lots only reached ${game.intensity.toFixed(3)}`)
  assert.equal(
    revealHoldMs(game.intensity),
    MIN_REVEAL_MS,
    `at ${game.intensity.toFixed(3)} the old hold was ${revealHoldMs(game.intensity).toFixed(0)}ms, not the floor — pick a different lot count`,
  )
  assert.ok(revealPlan(SPEC, game.intensity).holdMs > 0, "the shared curve would skip this one")

  const clock = stepClock()
  const room = game.room
  game.fold()
  assert.equal(game.studying, true)
  pump(game, 30_000, clock)
  assert.equal(game.room, room, "the room a child at the reveal floor folded on was flashed away")
})

// -- 3: the settle floor ----------------------------------------------------

test("the tap that ended the lot cannot also dismiss the lesson it put up", () => {
  const r = counted(0x3f11)
  const clock = stepClock()
  const room = r.game.room
  r.game.fold()

  // The second tap of an impatient double-tap, arriving in the same frame.
  r.game.nudge()
  r.game.advance(16, clock())
  assert.equal(r.game.room, room, "an in-flight tap took the reveal down inside its own fade-in")
  assert.equal(r.game.studying, true)
  assert.equal(r.game.nudgeable, false, "a reveal one frame old is already dismissible")

  // One millisecond short of the floor, and it is still deaf.
  pump(r.game, REVEAL_SETTLE_MS - 32, clock)
  r.game.nudge()
  r.game.advance(1, clock())
  assert.equal(
    r.game.room,
    room,
    `a tap ${String(REVEAL_SETTLE_MS)}ms-minus-a-frame into the reveal was honoured`,
  )

  // Past it, and the child owns the pace again.
  pump(r.game, 64, clock)
  assert.equal(r.game.nudgeable, true, "the settle floor never expired")
  r.game.nudge()
  r.game.advance(1, clock())
  assert.notEqual(r.game.room, room, "the settle floor never let go")
})

test("a pause does not spend the settle floor", () => {
  const r = counted(0x77aa)
  const clock = stepClock()
  const room = r.game.room
  r.game.fold()
  r.game.pause(1_000)
  pump(r.game, 30_000, clock)
  r.game.resume(31_000)
  assert.equal(r.game.nudgeable, false, "half a minute behind a sheet paid off the settle floor")
  r.game.nudge()
  r.game.advance(1, clock())
  assert.equal(r.game.room, room, "the first tap back from a pause skipped the reveal")
})

// -- 4: still adaptive ------------------------------------------------------

test("a lot bought at a profit does not wait — the auction is not a queue of dismissals", () => {
  const r = counted(0x2b1d)
  const clock = stepClock()
  // Walk the consignment until a lot is worth buying, then buy it properly.
  let sold: Settled | null = null
  for (let i = 0; i < 20 && sold === null; i++) {
    const room = r.game.room
    if (!room) break
    const at = room.tablets.findIndex((t) => t.value === room.highest)
    r.game.tapTablet(at)
    typeBid(r.game, room.highest + 1)
    r.game.hammer(clock())
    const settled = r.game.settled
    if (settled?.outcome === "sold" && settled.arithmetic === true) {
      sold = settled
      break
    }
    settleOn(r.game, clock)
  }
  assert.ok(sold, "twenty lots and never one bought at a profit with the sum right")
  assert.equal(r.game.studying, false, "a clean sale held the child for a receipt")
  assert.ok(Number.isFinite(r.game.holdLeft), "a clean sale's beat has no end")

  const room = r.game.room
  pump(r.game, revealHoldMs(r.game.intensity) + 64, clock)
  assert.notEqual(r.game.room, room, "a clean sale needed a tap to move on")
})

test("at the top of the ladder there is no reveal to wait for at all", () => {
  const sitting = play(PERFECT, 24)
  const game = sitting.game
  assert.equal(
    revealPlan(SPEC, game.intensity).holdMs,
    0,
    `twenty-four flawless lots only reached ${game.intensity.toFixed(3)} — not the ceiling`,
  )
  const clock = stepClock()
  const room = game.room
  game.fold()
  assert.equal(game.studying, false, "a child at the ceiling was held for a patient reveal")
  pump(game, revealHoldMs(game.intensity) + 64, clock)
  assert.notEqual(game.room, room, "the ceiling still needed a tap")
})

// -- which lots teach -------------------------------------------------------

test("every outcome except a clean profitable sale carries something to study", () => {
  const OUTCOMES: readonly Outcome[] = ["sold", "even", "outbid", "unsold", "folded"]
  const room = rig().game.room
  assert.ok(room)
  const base = { bid: null, coins: 0, keen: false, claimed: null, room, marked: null } as const

  const teaching: Outcome[] = []
  for (const outcome of OUTCOMES) {
    if (teaches({ ...base, outcome, arithmetic: outcome === "folded" ? null : true })) {
      teaching.push(outcome)
    }
  }
  // Named individually rather than compared to a literal: `deepEqual` against an
  // array literal is how three of these have gone vacuous before.
  assert.ok(teaching.includes("folded"), "a fold has nothing to study — the founder's own case")
  assert.ok(teaching.includes("outbid"), "being beaten by the room teaches nothing")
  assert.ok(teaching.includes("unsold"), "paying over the offer teaches nothing")
  assert.ok(teaching.includes("even"), "selling with nothing in it teaches nothing")
  assert.ok(!teaching.includes("sold"), "a clean profitable sale is being held up as a lesson")
  assert.equal(teaching.length, 4, `${String(teaching.length)} of five outcomes teach`)

  // …and a sale whose arithmetic was wrong does teach, whatever the money did.
  assert.equal(
    teaches({ ...base, outcome: "sold", arithmetic: false }),
    true,
    "a lot bought at a profit on a wrong sum was rushed past",
  )
})
