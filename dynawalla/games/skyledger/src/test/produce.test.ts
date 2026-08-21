// PRODUCE, DO NOT POINT.
//
// This is the file that keeps SKY LEDGER from quietly becoming a tapping game.
//
// The astrolabe is the only thing in this package that can bring an ordered
// pair into existence, and it does it one detent at a time. There is no method
// that takes a number, no method that takes a point on the screen, and nothing
// anywhere on the sky whose position is a function of what a star is worth. If
// any of that stops being true, one of these fails.
//
// It is written as five independent claims rather than one, because the leak
// could arrive through any of them and a single assertion would only catch the
// one somebody happened to think of first.

import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { test } from "node:test"

import type { Host, Question } from "../contract.ts"
import { Rng } from "../core/rng.ts"
import { Game } from "../game/game.ts"
import { LOGGED_PAST_CALM } from "../game/opening.ts"
import { RINGS, detentsBetween, type Station } from "../game/station.ts"
import { createStubHost } from "../stubHost.ts"
import { raise, rig, truthOf } from "./harness.ts"

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, "..")

test("the rings are the only way a pair comes into existence, and they move one step", () => {
  const { game } = rig(0x9110)
  raise(game)

  assert.deepEqual(game.station, { x: 0, y: 0 }, "the rings did not start at the origin")

  // Every call moves exactly one detent on exactly one ring. There is no
  // multi-step turn, so there is no way to arrive anywhere in one gesture.
  let previous: Station = game.station
  for (let i = 0; i < 40; i++) {
    const ring = i % 3 === 0 ? "tens" : "ones"
    const dir = i % 5 === 0 ? -1 : 1
    game.dial(ring, dir)
    assert.equal(
      detentsBetween(previous, game.station),
      1,
      `a single dial moved ${detentsBetween(previous, game.station)} detents`,
    )
    previous = game.station
  }
})

test("a station cannot be jumped to: reaching one costs at least its distance in detents", () => {
  const { game } = rig(0x3117)
  raise(game)
  for (let y = 0; y < RINGS; y++) {
    for (let x = 0; x < RINGS; x++) {
      const want = { x, y }
      const cost = detentsBetween(game.station, want)
      let turns = 0
      while ((game.station.x !== x || game.station.y !== y) && turns < 40) {
        if (game.station.x !== x) game.dial("ones", 1)
        else game.dial("tens", 1)
        turns++
      }
      assert.deepEqual(game.station, want)
      assert.ok(turns >= cost, `(${x}, ${y}) was reached in ${turns} turns, under its ${cost}`)
    }
  }
})

test("the game exposes no way to set a pair, and no way to turn a screen point into one", () => {
  const { game } = rig(0x5e77)
  const surface = [
    ...Object.getOwnPropertyNames(Object.getPrototypeOf(game) as object),
    ...Object.getOwnPropertyNames(game),
  ]
  const forbidden = /^(set(Station|Ring|Pair|Answer)|stationAt|aimAt|pointAt|tapSky|solve|reveal)/i
  for (const name of surface) {
    assert.ok(!forbidden.test(name), `Game exposes "${name}", which is a way to point`)
  }
  // And the two methods that do exist take what they take: a ring and a
  // direction, never a value.
  assert.equal(game.dial.length, 2)
  assert.equal(game.sight.length, 1)
  assert.equal(game.mark.length, 1)
})

test("sighting a star reveals nothing: not its station, not its answer, not a hint", () => {
  const { game, reports } = rig(0x711f)
  raise(game)
  const star = game.stars.find((s) => s.state === "falling" && s.t > 0)
  assert.ok(star)
  const before = { ...game.station }

  const events = game.sight(star.id)
  assert.deepEqual(game.station, before, "sighting moved the rings")
  assert.equal(reports.length, 0, "sighting reported something")
  for (const e of events) assert.equal(e.kind, "sight")

  // What a sighting hands back is the star, and a star's own shape carries no
  // station. `order` is the part of the register that is already ruled in and
  // is drawn on the plate on purpose; everything else is where and when.
  const keys = Object.keys(star).sort()
  assert.deepEqual(keys, [
    "askedAt",
    "fallMs",
    "id",
    "item",
    "lamp",
    "lane",
    "order",
    "releaseIn",
    "state",
    "t",
    "taken",
  ])
  const truth = truthOf(star)
  for (const [key, value] of Object.entries(star)) {
    if (key === "item" || key === "order") continue
    if (typeof value !== "number") continue
    assert.notEqual(value, truth.station.x * 100 + truth.station.y, `star.${key} carries the pair`)
  }
})

test("where a star is in the sky is not a function of what it is worth", () => {
  // Two runs with identical seeds, differing only in the answers the host
  // hands over. If a star's lane or lamp were derived from its value — the one
  // leak that would turn this back into a pointing game — they would diverge.
  const shift = (host: Host): Host => ({
    ...host,
    next(opts) {
      const q: Question = host.next(opts)
      return { ...q, answer: String((Number(q.answer) + 7) % 1000) }
    },
  })

  const plain = createStubHost({ seed: 0xa11e })
  const altered = shift(createStubHost({ seed: 0xa11e }))

  const a = new Game(plain, new Rng(0xbeef), 0, false, LOGGED_PAST_CALM)
  const b = new Game(altered, new Rng(0xbeef), 0, false, LOGGED_PAST_CALM)
  a.begin(0)
  b.begin(0)

  for (let watch = 0; watch < 4; watch++) {
    assert.deepEqual(
      a.stars.map((s) => [s.lane, s.lamp, s.fallMs, s.releaseIn]),
      b.stars.map((s) => [s.lane, s.lamp, s.fallMs, s.releaseIn]),
      "changing the answers moved the stars",
    )
    // The answers really did differ, so the comparison above meant something.
    assert.notDeepEqual(
      a.stars.map((s) => s.item.answer),
      b.stars.map((s) => s.item.answer),
    )
    let now = watch * 200_000
    for (let i = 0; i < 600 && a.watch === watch + 1; i++) {
      now += 1000
      a.tick(1000, now)
      b.tick(1000, now)
      if (a.isOver) return
    }
  }
})

test("the render layer never touches an answer, a station or a value", () => {
  // The one leak a rules test cannot see. `Game` hands the renderer a `Star`,
  // and a `Star` carries the host's `Question` — so nothing but discipline
  // stops a scene file from reading `star.item.answer` and putting the star
  // where it belongs. This is that discipline, as a gate.
  const banned = [
    /\bitem\s*\.\s*answer\b/,
    /\banswerOf\b/,
    /\bstationOf\b/,
    /\bvalueAt\b/,
    /\borderOf\b/,
    /\bnamedSlips\b/,
  ]
  const files: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith(".ts")) files.push(full)
    }
  }
  walk(join(SRC, "render"))
  files.push(join(SRC, "mount.ts"))

  assert.ok(files.length >= 2, "the render layer was not found; this gate would pass vacuously")
  for (const file of files) {
    const source = readFileSync(file, "utf8")
    for (const pattern of banned) {
      assert.ok(
        !pattern.test(source),
        `${file.slice(SRC.length + 1)} reads ${String(pattern)} — the renderer can see the answer`,
      )
    }
  }
})
