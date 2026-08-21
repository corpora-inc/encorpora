// THE PAUSE.
//
// The host can put a sheet over a pack that is **still mounted and still
// running** — a stopping-point card, a parent gate, a day-pass offer — and it
// sends `pause` when it does. SKY LEDGER calls `transition` at the end of every
// watch the child worked, so it raises that sheet itself, routinely.
//
// Four things have to stop dead, and every one of them is real damage:
//
//   1. **Input.** A touch behind the sheet is not a thing the child did.
//      Unguarded it turns a ring, or marks a station nobody was looking at, and
//      puts a wrong answer on their record for a ledger line they never saw.
//   2. **The ledger lines' clocks.** The latency reported is meant to be time
//      the child spent thinking. Thirty seconds behind a sheet is not that.
//   3. **The sky.** Stars must not fall behind the sheet. A child who comes
//      back to a dark observatory was not beaten by the game.
//   4. **The chain.** A nine-link chain must not expire because the host chose
//      that moment to offer something.
//
// Each assertion here fails if the corresponding guard is removed — verified by
// removing them one at a time, not by reading them. In particular the input
// assertions are written against `pause()` alone, with the game otherwise in a
// state where the same call would certainly have done something.

import assert from "node:assert/strict"
import { test } from "node:test"

import { CHAIN_WINDOW_MS } from "../game/escalation.ts"
import { valueAt } from "../game/station.ts"
import { dialTo, raise, rig, truthOf } from "./harness.ts"

test("a mark behind the sheet is not taken, not reported and does not spend a sighting", () => {
  const { game, reports } = rig(0x9a05e)
  const t = raise(game)
  const star = game.sighted
  assert.ok(star)
  // A correct pair, fully dialled — so nothing about this press is ambiguous
  // except that it happened while the host had a sheet over the frame.
  dialTo(game, truthOf(star).station)
  const sightings = game.sightings
  const logged = game.ledger.logged

  game.pause(t + 100)
  const events = game.mark(t + 400)

  assert.deepEqual(events, [], "a mark behind the sheet produced events")
  assert.equal(reports.length, 0, "a mark behind the sheet was reported to the host")
  assert.equal(star.state, "falling", "a star was taken behind the sheet")
  assert.equal(game.ledger.logged, logged, "the ledger was written behind the sheet")
  assert.equal(game.sightings, sightings, "a sighting was spent behind the sheet")
  assert.equal(game.links, 0)
})

test("the rings do not turn behind the sheet, and they are where they were when it lifts", () => {
  const { game } = rig(0x40b)
  const t = raise(game)
  game.dial("ones", 1)
  game.dial("tens", 1)
  const standing = { ...game.station }

  game.pause(t + 50)
  assert.deepEqual(game.dial("ones", 1), [], "a ring turned behind the sheet")
  assert.deepEqual(game.dial("tens", -1), [], "a ring turned behind the sheet")
  assert.deepEqual(game.station, standing, "the astrolabe moved behind the sheet")

  game.resume(t + 9000)
  assert.deepEqual(game.station, standing, "the astrolabe lost its place")
  assert.equal(game.dial("ones", 1).length, 1, "the astrolabe did not come back")
})

test("a star cannot be sighted behind the sheet", () => {
  const { game } = rig(0xc0a7)
  const t = raise(game)
  const other = game.stars.find((s) => s.state === "falling" && s.t > 0 && s.id !== game.sighted?.id)
  assert.ok(other, "the sky was too empty to test a sighting")
  const held = game.sighted?.id

  game.pause(t + 10)
  assert.deepEqual(game.sight(other.id), [], "a star was sighted behind the sheet")
  assert.equal(game.sighted?.id, held, "the sight moved behind the sheet")

  game.resume(t + 5000)
  assert.equal(game.sight(other.id).length, 1, "the sight did not come back")
})

test("the sheet is not thinking time: the latency reported skips it", () => {
  const { game, reports } = rig(0x11ce)
  raise(game)
  const star = game.sighted
  assert.ok(star)
  const asked = star.askedAt
  dialTo(game, truthOf(star).station)

  // Two seconds with the ledger line, thirty behind a sheet, then half a
  // second more and a mark.
  game.pause(asked + 2000)
  game.resume(asked + 32000)
  game.mark(asked + 32500)

  const report = reports[0]
  assert.ok(report)
  assert.equal(report.ms, 2500, "the sheet was counted as time the child spent thinking")
})

test("a sheet raised between ledger lines does not charge the next one for it", () => {
  const { game, reports } = rig(0x2ee)
  raise(game)
  const first = game.sighted
  assert.ok(first)
  dialTo(game, truthOf(first).station)
  game.mark(first.askedAt + 4000)

  const next = game.sighted
  assert.ok(next, "nothing came under the sight after the bloom")
  const asked = next.askedAt

  // The host raises its sheet on the transition and holds it for a minute. The
  // child had a tenth of a second with the next line before it went up.
  game.pause(asked + 100)
  game.resume(asked + 60_100)
  dialTo(game, truthOf(next).station)
  game.mark(asked + 61_100)

  assert.equal(reports.length, 2)
  assert.equal(reports[0]?.ms, 4000)
  assert.equal(reports[1]?.ms, 1100, "the next ledger line was charged for the sheet")
})

test("the sky does not fall behind the sheet", () => {
  const { game } = rig(0x5c1e)
  const t = raise(game)
  const heights = game.stars.map((s) => s.t)
  const lamps = game.lamps

  game.pause(t)
  // A minute of wall clock, delivered as frames, exactly as a still-mounted
  // pack under a sheet would receive it if the loop were not guarded.
  let now = t
  for (let i = 0; i < 600; i++) game.tick(100, (now += 100))

  assert.deepEqual(
    game.stars.map((s) => s.t),
    heights,
    "the sky fell behind the sheet",
  )
  assert.equal(game.lamps, lamps, "a lamp went out behind the sheet")
  assert.equal(game.isOver, false, "the run ended behind the sheet")

  game.resume(now)
  game.tick(100, now + 100)
  assert.ok(
    game.stars.some((s) => s.t > (heights[game.stars.indexOf(s)] ?? 0)),
    "the sky did not start falling again",
  )
})

test("a chain survives the sheet: the light does not fade behind it", () => {
  const { game } = rig(0x3a17)
  let now = raise(game)
  const star = game.sighted
  assert.ok(star)
  dialTo(game, truthOf(star).station)
  game.mark((now += 100))
  const links = game.links
  assert.ok(links >= 1)

  // Thirty seconds behind a sheet — many times the chain's window.
  game.pause(now)
  game.tick(16, now + 30_000)
  game.resume(now + 30_000)
  assert.equal(game.links, links, "the sheet ate the chain")

  // And it still expires normally afterwards, shifted by exactly the sheet.
  assert.equal(game.tick(16, now + 30_000 + CHAIN_WINDOW_MS - 200).length, 0)
  const events = game.tick(16, now + 30_000 + CHAIN_WINDOW_MS + 10)
  assert.ok(
    events.some((e) => e.kind === "release"),
    "the chain never let go after the sheet",
  )
})

test("sightings do not refill behind the sheet", () => {
  const { game } = rig(0x60dd)
  const t = raise(game)
  const star = game.sighted
  assert.ok(star)
  const truth = truthOf(star)
  // Spend one on a wild guess.
  let guess = { x: (truth.station.x + 4) % 10, y: (truth.station.y + 6) % 10 }
  for (let i = 0; i < 12; i++) {
    const value = valueAt(star.order, guess)
    if (value !== truth.value && !star.item.distractors.includes(String(value))) break
    guess = { x: (guess.x + 1) % 10, y: guess.y }
  }
  dialTo(game, guess)
  game.mark(t + 10)
  const left = game.sightings
  assert.ok(left < 6)

  game.pause(t + 20)
  let now = t + 20
  for (let i = 0; i < 300; i++) game.tick(100, (now += 100))
  assert.equal(game.sightings, left, "the astrolabe refilled behind the sheet")
})

test("pause and resume are idempotent, and resume alone changes nothing", () => {
  const { game, reports } = rig(0x1de)
  raise(game)
  const star = game.sighted
  assert.ok(star)
  const asked = star.askedAt
  dialTo(game, truthOf(star).station)

  game.resume(asked + 100) // never paused
  game.pause(asked + 1000)
  game.pause(asked + 5000) // a second pause must not move the mark
  game.resume(asked + 9000)
  game.resume(asked + 50_000) // a second resume must not move it either
  game.mark(asked + 10_000)

  assert.equal(reports[0]?.ms, 2000)
  assert.equal(game.isPaused, false)
})

test("the clock is a mark, not a stopwatch: a mark after resume is judged normally", () => {
  const { game, reports } = rig(0x7e5)
  raise(game)
  const star = game.sighted
  assert.ok(star)
  const asked = star.askedAt
  dialTo(game, truthOf(star).station)

  game.pause(asked + 300)
  game.resume(asked + 9300)
  const events = game.mark(asked + 10_000)
  assert.ok(events.length > 0, "the game did not come back after the sheet lifted")
  assert.equal(reports.length, 1)
  assert.equal(reports[0]?.correct, true)
  assert.equal(reports[0]?.ms, 1000)
})
