// THE PAUSE.
//
// The host can put a sheet over a pack that is **still mounted and still
// running** — a stopping-point card, a parent gate, a day-pass offer — and it
// sends `pause` when it does. COLOSSUS calls `transition` at the end of every
// tower it brings down, so it is one of the packs most likely to raise that
// sheet itself.
//
// Two things have to stop dead, and both of them are real damage if they do not:
//
//   1. **Input.** A touch that lands while the sheet is up is not a thing the
//      child did. Unguarded, it strikes the fist, reports an answer to a
//      keystone nobody was looking at, and puts two more floors on the tower
//      they now have to bring down. A penalty for a question they never saw is
//      the worst bug this game could ship.
//   2. **The keystone's clock.** The latency reported is meant to be time the
//      child spent thinking. Time spent behind a sheet is not that, and a
//      thirty-second sheet would tell the host a child laboured over a question
//      they answered in two seconds.
//
// Each assertion here fails if the corresponding guard in `Game` is removed —
// verified by removing them, not by reading them.

import assert from "node:assert/strict"
import { test } from "node:test"

import { rig, solutionIds } from "./harness.ts"

test("a strike behind the sheet is not taken, not reported, and does not build", () => {
  const { game, reports } = rig(0x9a05e)
  // A full, correct fist — so nothing about this press is ambiguous except
  // that it happened while the host had a sheet over the frame.
  for (const id of solutionIds(game)) game.toggle(id)
  const holding = game.holding.length
  assert.ok(holding > 0)

  const height = game.height
  const cursor = game.progress.done

  game.pause(1000)
  const events = game.strike(1400)

  assert.deepEqual(events, [], "a strike behind the sheet produced events")
  assert.equal(reports.length, 0, "a strike behind the sheet was reported to the host")
  assert.equal(game.height, height, "a strike behind the sheet changed the building")
  assert.equal(game.progress.done, cursor, "a strike behind the sheet spent a keystone")
  assert.equal(game.holding.length, holding, "a strike behind the sheet emptied the fist")
})

test("taking hold behind the sheet does nothing either", () => {
  const { game } = rig(0x40b)
  const floor = game.floors[0]
  const other = game.floors[1]
  assert.ok(floor && other)

  game.toggle(floor.id)
  game.pause(500)

  assert.deepEqual(game.toggle(other.id), [], "a slab was picked up behind the sheet")
  assert.deepEqual(game.toggle(floor.id), [], "a slab was put down behind the sheet")
  game.releaseAll()
  assert.deepEqual(game.holding, [floor.id], "the fist changed behind the sheet")

  // And everything the child was holding is still in their hand when it lifts.
  game.resume(900)
  assert.deepEqual(game.holding, [floor.id])
  assert.deepEqual(
    game.toggle(other.id).map((e) => e.kind),
    ["hold"],
  )
})

test("the sheet is not thinking time: the latency reported skips it", () => {
  const { game, reports } = rig(0x11ce)
  for (const id of solutionIds(game)) game.toggle(id)

  // Two seconds of looking at the tower, thirty seconds behind a sheet, then
  // half a second more and a strike.
  game.pause(2000)
  game.resume(32000)
  game.strike(32500)

  const report = reports[0]
  assert.ok(report)
  assert.equal(report.ms, 2500, "the sheet was counted as time the child spent thinking")
})

test("a sheet raised between keystones does not charge the next one for it", () => {
  const { game, reports } = rig(0x2ee)
  // Answer the first keystone at four seconds.
  for (const id of solutionIds(game)) game.toggle(id)
  game.strike(4000)

  // The host raises its sheet on the transition and holds it for a minute. The
  // child had a tenth of a second with the next keystone before it went up.
  game.pause(4100)
  game.resume(64100)

  for (const id of solutionIds(game)) game.toggle(id)
  game.strike(65100)

  assert.equal(reports.length, 2)
  assert.equal(reports[0]?.ms, 4000)
  assert.equal(reports[1]?.ms, 1100, "the next keystone was charged for the sheet")
})

test("pause and resume are idempotent, and resume alone changes nothing", () => {
  const { game, reports } = rig(0x1de)
  for (const id of solutionIds(game)) game.toggle(id)

  game.resume(100) // never paused
  game.pause(1000)
  game.pause(5000) // a second pause must not move the mark
  game.resume(9000)
  game.resume(50000) // a second resume must not move it either
  game.strike(10000)

  const report = reports[0]
  assert.ok(report)
  assert.equal(report.ms, 2000)
  assert.equal(game.isPaused, false)
})

test("the clock is a mark, not a stopwatch: a strike after resume is judged normally", () => {
  const { game, reports } = rig(0x7e5)
  for (const id of solutionIds(game)) game.toggle(id)
  // 300 ms with the tower, nine seconds behind a sheet, 700 ms more.
  game.pause(300)
  game.resume(9300)
  const events = game.strike(10000)
  assert.ok(events.length > 0, "the game did not come back after the sheet lifted")
  assert.equal(reports.length, 1)
  assert.equal(reports[0]?.correct, true)
  assert.equal(reports[0]?.ms, 1000)
})
