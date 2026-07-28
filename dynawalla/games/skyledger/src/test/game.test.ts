// THE WATCH — the rules of the observatory.
//
// Every seed in this file is written down. A test that reaches for
// `Math.random` is a test that fails one run in five on somebody else's
// machine, and the reproduction has to be in the failure message.

import assert from "node:assert/strict"
import { test } from "node:test"

import { CHAIN_WINDOW_MS } from "../game/escalation.ts"
import { LAMPS, REFILL_MS, SIGHTINGS } from "../game/game.ts"
import { valueAt } from "../game/station.ts"
import { aimAt, dialTo, falling, raise, rig, truthOf } from "./harness.ts"

test("a watch opens with stars falling and one of them already under the sight", () => {
  const { game } = rig(0x0b5e21)
  assert.equal(game.watch, 1)
  assert.equal(game.lamps, LAMPS)
  assert.ok(game.stars.length >= 2)
  raise(game)
  assert.ok(game.sighted, "nothing was under the sight when the watch opened")
  assert.ok(falling(game).length >= 2, "the sky never filled")
  assert.equal(game.isOver, false)
  assert.equal(game.stalled, false)
})

test("a mark on the true station blooms, and it is the only pair on the lattice that does", () => {
  const { game, reports } = rig(0x1a7c)
  const t = raise(game)
  const star = game.sighted
  assert.ok(star)
  const { value, station } = truthOf(star)

  // Every other pair on the lattice, first. All ninety-nine of them are wrong,
  // and every one is reported as a number the host can diagnose.
  let now = t
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      if (x === station.x && y === station.y) continue
      const before = reports.length
      dialTo(game, { x, y })
      game.mark((now += 5))
      const report = reports[before]
      if (!report) continue // the astrolabe ran dry; the refusal has its own test
      assert.equal(report.correct, false, `(${x}, ${y}) was taken for ${value}`)
      assert.equal(report.answered, String(valueAt(star.order, { x, y })))
      assert.notEqual(Number(report.answered), value)
    }
  }

  // Now the true one. Same star, same rings, one pair apart.
  assert.equal(game.sighted?.id, star.id, "the star was lost while the lattice was swept")
  dialTo(game, station)
  const events = game.mark((now += 5))
  assert.ok(
    events.some((e) => e.kind === "bloom"),
    "the true station did not bloom",
  )
  assert.equal(star.state, "caught")
  const last = reports.at(-1)
  assert.equal(last?.correct, true)
  assert.equal(last?.answered, String(value))
})

test("what crosses to the host is the number the child produced, exactly", () => {
  const { game, reports } = rig(0x33f0)
  const t = raise(game)
  const star = game.sighted
  assert.ok(star)
  dialTo(game, { x: 3, y: 4 })
  game.mark(t + 10)
  assert.equal(reports[0]?.answered, String(valueAt(star.order, { x: 3, y: 4 })))
  assert.ok(/^\d+$/.test(reports[0]?.answered ?? ""), "a non-integer reached the host")
  assert.equal(reports[0]?.questionId, star.item.id)
})

test("the chain escalates per link and snaps back when the light fades", () => {
  const { game } = rig(0x9c4a1)
  let now = raise(game)

  let links = 0
  let peak = 0
  for (let i = 0; i < 12; i++) {
    const star = game.sighted
    if (!star) break
    aimAt(game, star)
    for (const e of game.mark((now += 120))) {
      if (e.kind !== "bloom") continue
      links += 1
      assert.equal(e.link, links, "a link landed out of order")
      assert.ok(e.channels.bloom >= peak, "the chain got quieter as it got longer")
      peak = e.channels.bloom
    }
  }
  assert.ok(links >= 3, `only ${links} links — the sky was too small to chain`)
  assert.equal(game.links, links)
  assert.ok(game.channels.bloom > 0 && game.channels.timescale < 1)

  // The light fades. One release, carrying the whole chain, and the channels
  // are at rest immediately afterwards rather than sagging back over half a
  // second: the hard snap-back.
  const after = game.tick(16, now + CHAIN_WINDOW_MS + 1)
  const release = after.find((e) => e.kind === "release")
  assert.ok(release, "the chain never let go")
  assert.equal(release.release.links, links)
  assert.equal(release.release.broken, false)
  assert.equal(game.links, 0)
  assert.deepEqual(game.channels, { hitstopMs: 0, bloom: 0, chromaRpx: 0, timescale: 1 })
  assert.equal(game.ledger.longest, links)
})

test("a wrong mark cuts the chain on the spot", () => {
  const { game } = rig(0x5011)
  let now = raise(game)
  const first = game.sighted
  assert.ok(first)
  aimAt(game, first)
  game.mark((now += 100))
  assert.equal(game.links, 1)

  const second = game.sighted
  assert.ok(second)
  const truth = truthOf(second).station
  dialTo(game, { x: (truth.x + 3) % 10, y: (truth.y + 5) % 10 })
  const events = game.mark((now += 100))
  assert.ok(events.some((e) => e.kind === "wide"))
  const release = events.find((e) => e.kind === "release")
  assert.ok(release, "a wrong mark did not cut the chain")
  assert.equal(release.release.broken, true)
  assert.equal(release.release.links, 1)
  assert.equal(game.links, 0)
  assert.deepEqual(game.channels, { hitstopMs: 0, bloom: 0, chromaRpx: 0, timescale: 1 })
})

test("one true mark takes every star worth the same number", () => {
  // Constructed rather than drawn: two stars have to agree, and waiting for a
  // seed where they happen to is how a test becomes flaky.
  const { game, reports } = rig(0x7e11)
  const t = raise(game)
  const sky = falling(game)
  const a = sky[0]
  const b = sky[1]
  assert.ok(a && b)
  // `answer` is the host's word and the game only ever reads it; making two
  // stars agree here is the same as the host drawing two items with one answer.
  b.item.answer = a.item.answer

  game.sight(a.id)
  dialTo(game, truthOf(a).station)
  const bloomed = game.mark(t + 10).filter((e) => e.kind === "bloom")
  assert.ok(bloomed.length >= 2, "the second star worth the same number was left falling")
  assert.equal(a.state, "caught")
  assert.equal(b.state, "caught")

  // Both are reported, each under its own id, and neither with a made-up value.
  const ids = reports.map((r) => r.questionId)
  assert.ok(ids.includes(a.item.id) && ids.includes(b.item.id))
  for (const r of reports) {
    assert.equal(r.correct, true)
    assert.equal(r.answered, a.item.answer)
    assert.ok(r.ms >= 0)
  }
})

test("being right costs nothing; a wild guess costs a sighting", () => {
  const { game } = rig(0x2c0d)
  let now = raise(game)
  const star = game.sighted
  assert.ok(star)
  aimAt(game, star)
  game.mark((now += 50))
  assert.equal(game.sightings, SIGHTINGS, "a correct mark spent a sighting")

  const next = game.sighted
  assert.ok(next)
  const truth = truthOf(next)
  // Somewhere that is neither the answer nor a mal-rule anybody has named.
  let guess = { x: (truth.station.x + 5) % 10, y: (truth.station.y + 5) % 10 }
  for (let i = 0; i < 12; i++) {
    const value = valueAt(next.order, guess)
    if (value !== truth.value && !next.item.distractors.includes(String(value))) break
    guess = { x: (guess.x + 1) % 10, y: guess.y }
  }
  dialTo(game, guess)
  game.mark((now += 50))
  assert.equal(game.sightings, SIGHTINGS - 1, "a wild guess was free")
})

test("a mark on a mal-rule the host named is a recognised slip and costs nothing", () => {
  // Constructed, again: the point is the rule, not whether a given draw happens
  // to have a mal-rule inside the same hundred.
  const { game, reports } = rig(0x4415)
  const t = raise(game)
  const star = game.sighted
  assert.ok(star)
  const truth = truthOf(star)
  const slip = truth.value >= 10 ? truth.value - 10 : truth.value + 10
  star.item.distractors = [String(slip)]

  dialTo(game, { x: slip % 10, y: Math.floor(slip / 10) % 10 })
  game.mark(t + 10)
  assert.equal(game.sightings, SIGHTINGS, "a recognised slip cost a sighting")
  const report = reports.at(-1)
  assert.equal(report?.correct, false, "a recognised slip was reported as correct")
  assert.equal(report?.answered, String(slip), "the slip was not reported as itself")
})

test("a dry astrolabe refuses rather than reporting, and refills on a clock", () => {
  const { game, reports } = rig(0x60dd)
  let now = raise(game)
  const star = game.sighted
  assert.ok(star)
  const truth = truthOf(star)

  let spent = 0
  for (let y = 0; y < 10 && game.sightings > 0; y++) {
    for (let x = 0; x < 10 && game.sightings > 0; x++) {
      const value = valueAt(star.order, { x, y })
      if (value === truth.value || star.item.distractors.includes(String(value))) continue
      dialTo(game, { x, y })
      const before = game.sightings
      game.mark((now += 5))
      if (game.sightings < before) spent++
    }
  }
  assert.equal(spent, SIGHTINGS)
  assert.equal(game.sightings, 0)

  const before = reports.length
  assert.deepEqual(
    game.mark((now += 5)).map((e) => e.kind),
    ["refused"],
    "a dry astrolabe still fired",
  )
  assert.equal(reports.length, before, "a refused mark was reported to the host")

  // And it comes back on its own, so nothing is ever lost — only delayed.
  game.tick(16, now + REFILL_MS + 1)
  assert.equal(game.sightings, 1)
})

test("a star that reaches the horizon snuffs a lamp and is never reported", () => {
  const { game, reports } = rig(0x8a11)
  const star = game.stars[0]
  assert.ok(star)
  let now = 0
  let landed = 0
  for (let i = 0; i < 400 && landed === 0; i++) {
    now += 500
    for (const e of game.tick(500, now)) if (e.kind === "land") landed++
  }
  assert.ok(landed >= 1, "nothing landed after a full fall")
  assert.ok(game.lamps < LAMPS)
  assert.equal(reports.length, 0, "a star the child never answered was reported")
})

test("the run ends when the last lamp goes out, and the ledger is written", () => {
  const { game } = rig(0x0f1e)
  let now = 0
  let over: { logged: number; watches: number; longest: number; wide: number } | null = null
  // Answer nothing at all. Every star lands; the lamps go out one at a time.
  for (let i = 0; i < 600 && !over; i++) {
    now += 1000
    for (const e of game.tick(1000, now)) if (e.kind === "over") over = e.ledger
  }
  assert.ok(over, "the observatory never closed")
  assert.equal(game.isOver, true)
  assert.equal(game.lamps, 0)
  assert.equal(over.logged, 0)
  // And nothing happens after: the run is over, not looping.
  assert.deepEqual(game.tick(16, now + 16), [])
})

test("there is no win state — a watch ends and the next one opens", () => {
  const { game, transitions } = rig(0x77a2)
  const firstWatch = game.watch
  let now = raise(game)
  let turned = false
  for (let i = 0; i < 400 && !turned && !game.isOver; i++) {
    const star = game.sighted
    if (star) {
      aimAt(game, star)
      game.mark((now += 60))
    }
    now += 300
    for (const e of game.tick(300, now)) if (e.kind === "watch") turned = true
  }
  assert.ok(turned, "the watch never turned over")
  assert.equal(game.watch, firstWatch + 1)
  assert.ok(game.stars.length > 0, "the next watch opened empty")
  // A watch the child logged stars in is a stopping point the host may sheet.
  assert.ok(
    transitions.some((t) => t.kind === "level"),
    "a watch the child worked was never offered as a stopping point",
  )
})

test("a run can be restarted, and the ledger starts blank", () => {
  const { game } = rig(0x1ced)
  let now = 0
  for (let i = 0; i < 600 && !game.isOver; i++) {
    now += 1000
    game.tick(1000, now)
  }
  assert.equal(game.isOver, true)
  assert.ok(game.restart(now).length > 0)
  assert.equal(game.isOver, false)
  assert.equal(game.lamps, LAMPS)
  assert.equal(game.watch, 1)
  assert.equal(game.ledger.logged, 0)
  assert.equal(game.ledger.wide, 0)
})

test("the same seed replays the same watch, star for star", () => {
  const a = rig(0xd0d0)
  const b = rig(0xd0d0)
  assert.deepEqual(
    a.game.stars.map((s) => [s.item.prompt, s.item.answer, s.lane, s.lamp]),
    b.game.stars.map((s) => [s.item.prompt, s.item.answer, s.lane, s.lamp]),
  )
})
