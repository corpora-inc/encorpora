// THE PAUSE.
//
// The host can put a sheet over a pack that is **still mounted and still
// running** — a stopping-point card, a parent gate, a day-pass offer — and it
// sends `pause` when it does. THE LATTICE calls `transition` every time a
// resonator opens, so it is one of the packs most likely to raise that sheet
// itself.
//
// Three things have to stop dead, and all three are real damage if they do not:
//
//   1. **Input.** A thumb resting on a virtual stick behind the sheet is not
//      the child flying. Unguarded, the ship keeps moving, sweeps motes nobody
//      chose, and can fly through the resonator and assert a product the child
//      never assembled — an answer reported for a question they never saw.
//   2. **The resonator's clock.** The latency reported is meant to be time the
//      child spent thinking. Time behind a sheet is not that, and a
//      thirty-second sheet would tell the host a child laboured over a question
//      they answered in two seconds.
//   3. **The world.** Husks drift, the ship coasts, and a sheet held for a
//      minute would come off onto a completely different arena.
//
// **Every assertion here has been verified to fail with the guards removed.**
// Not by reading them — by deleting every `if (this.paused) return` in
// `Arena`, running this file, and watching it go red.

import assert from "node:assert/strict"
import { test } from "node:test"

import { grindToPrimes, rig, sweepFactorisation } from "./harness.ts"

test("a shot behind the sheet does not crack anything", () => {
  const { arena } = rig(0x5ee7)
  const husk = arena.bodies.find((b) => !b.prime)
  assert.ok(husk)
  const before = arena.bodies.map((b) => b.id).sort((a, b) => a - b)

  arena.pause(1000)
  assert.deepEqual(arena.strike(husk.id), [], "a husk came apart behind the sheet")
  assert.deepEqual(
    arena.bodies.map((b) => b.id).sort((a, b) => a - b),
    before,
    "the field changed behind the sheet",
  )
  assert.equal(arena.isPaused, true)
})

test("a mote reached behind the sheet is not swept", () => {
  const { arena } = rig(0x5ee8)
  grindToPrimes(arena)
  const mote = arena.bodies[0]
  assert.ok(mote)

  arena.pause(500)
  assert.deepEqual(arena.touch(mote.id), [], "a mote was swept behind the sheet")
  assert.equal(arena.bank.size, 0, "the hold changed behind the sheet")

  // And it is still there to sweep when the sheet lifts.
  arena.resume(900)
  const events = arena.touch(mote.id)
  assert.equal(events[0]?.kind, "sweep")
  assert.equal(arena.bank.size, 1)
})

test("flying through the resonator behind the sheet reports nothing", () => {
  // The worst bug this game could ship: a report against a question the child
  // never saw, with a product they did not assemble.
  const { arena, reports, transitions } = rig(0x5ee9)
  const res = arena.resonator
  assert.ok(res)
  grindToPrimes(arena)
  assert.ok(sweepFactorisation(arena, res.target))
  const held = arena.bank.tiles.slice()

  arena.pause(1000)
  assert.deepEqual(arena.enter(1400), [], "the resonator answered behind the sheet")
  assert.equal(reports.length, 0, "an answer was reported behind the sheet")
  assert.deepEqual(transitions, [], "a stopping point was raised behind the sheet")
  assert.equal(arena.opened, 0)
  assert.deepEqual(arena.bank.tiles.slice(), held, "the hold was spent behind the sheet")
})

test("the world does not drift behind the sheet", () => {
  const { arena } = rig(0x5eea)
  arena.setMove(1, 1)
  arena.step(16)
  const shipX = arena.ship.x
  const shipY = arena.ship.y
  const positions = arena.bodies.map((b) => ({ id: b.id, x: b.x, y: b.y }))

  arena.pause(2000)
  for (let i = 0; i < 60; i++) assert.deepEqual(arena.step(16), [])

  assert.equal(arena.ship.x, shipX, "the ship coasted behind the sheet")
  assert.equal(arena.ship.y, shipY, "the ship coasted behind the sheet")
  for (const before of positions) {
    const now = arena.bodies.find((b) => b.id === before.id)
    assert.ok(now)
    assert.equal(now.x, before.x, `body ${before.id} drifted behind the sheet`)
    assert.equal(now.y, before.y, `body ${before.id} drifted behind the sheet`)
  }
})

test("the sticks are inert behind the sheet, and a resting thumb flies nothing", () => {
  const { arena } = rig(0x5eeb)
  arena.setMove(0, 0)
  arena.setAim(1, 0)
  const aim = { ...arena.aiming }

  arena.pause(1000)
  // A thumb that was already down when the sheet came up.
  arena.setMove(1, 1)
  arena.setAim(0, 1)
  assert.deepEqual(arena.fire(), [], "the trigger fired behind the sheet")
  assert.equal(arena.shots.length, 0, "a shot was created behind the sheet")
  assert.deepEqual(arena.vent(), [], "the hold was vented behind the sheet")
  assert.deepEqual(arena.aiming, aim, "the ship was turned behind the sheet")

  // The move vector must not have been latched either: one step after resume,
  // with the stick released, and the ship is still where it was.
  const x = arena.ship.x
  arena.resume(1400)
  arena.setMove(0, 0)
  arena.step(16)
  assert.equal(arena.ship.x, x, "a stick set behind the sheet flew the ship on resume")
})

test("the sheet is not thinking time: the latency reported skips it", () => {
  const { arena, reports } = rig(0x5eec)
  const res = arena.resonator
  assert.ok(res)
  grindToPrimes(arena)
  assert.ok(sweepFactorisation(arena, res.target))

  // Two seconds with the problem, thirty seconds behind a sheet, then half a
  // second more and a run at the resonator.
  arena.pause(2000)
  arena.resume(32000)
  arena.enter(32500)

  assert.equal(reports.length, 1)
  assert.equal(reports[0]?.ms, 2500, "the sheet was counted as time the child spent thinking")
})

test("a sheet raised between resonators does not charge the next one for it", () => {
  const { arena, reports } = rig(0x5eed)
  const first = arena.resonator
  assert.ok(first)
  grindToPrimes(arena)
  assert.ok(sweepFactorisation(arena, first.target))
  arena.enter(4000)

  // The host raises its sheet on the transition and holds it for a minute. The
  // child had a tenth of a second with the next resonator before it went up.
  arena.pause(4100)
  arena.resume(64100)

  const second = arena.resonator
  assert.ok(second)
  grindToPrimes(arena)
  assert.ok(sweepFactorisation(arena, second.target))
  arena.enter(65100)

  assert.equal(reports.length, 2)
  assert.equal(reports[0]?.ms, 4000)
  assert.equal(reports[1]?.ms, 1100, "the next resonator was charged for the sheet")
})

test("pause and resume are idempotent, and resume alone changes nothing", () => {
  const { arena, reports } = rig(0x5eee)
  const res = arena.resonator
  assert.ok(res)
  grindToPrimes(arena)
  assert.ok(sweepFactorisation(arena, res.target))

  arena.resume(100) // never paused
  arena.pause(1000)
  arena.pause(5000) // a second pause must not move the mark
  arena.resume(9000)
  arena.resume(50000) // a second resume must not move it either
  arena.enter(10000)

  assert.equal(reports.length, 1)
  assert.equal(reports[0]?.ms, 2000)
  assert.equal(arena.isPaused, false)
})

test("the arena comes back: after the sheet lifts everything works again", () => {
  const { arena, reports } = rig(0x5eef)
  const res = arena.resonator
  assert.ok(res)
  arena.pause(300)
  arena.resume(9300)

  grindToPrimes(arena)
  assert.ok(sweepFactorisation(arena, res.target), "the field was unusable after a sheet")
  const events = arena.enter(10000)
  assert.ok(events.some((e) => e.kind === "open"), "the arena did not come back")
  assert.equal(reports.length, 1)
  assert.equal(reports[0]?.correct, true)
  assert.equal(reports[0]?.ms, 1000)
})
