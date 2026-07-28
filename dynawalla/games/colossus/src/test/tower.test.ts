// The rules of the building.
//
// The one that matters most is here: **a wrong strike makes the tower taller.**
// It is the only penalty in COLOSSUS — no lives, no buzzer, no red mark — and
// if it ever silently stops working, flailing becomes free and the game is a
// slot machine.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import { productOf } from "../game/factor.ts"
import { Game, GROWTH, MAX_FLOORS, MAX_KEYSTONES, MIN_KEYSTONES } from "../game/game.ts"
import { answerOf, standingSolution } from "../game/tower.ts"
import { createStubHost } from "../stubHost.ts"
import { currentAnswer, rig, solutionIds, stepClock } from "./harness.ts"

test("the tower always stands the current keystone's answer up in it", () => {
  const { game } = rig(0xa11ce)
  for (let i = 0; i < 40 && !game.stalled; i++) {
    const target = currentAnswer(game)
    const standing = standingSolution(game.floors, game.progress.done)
    assert.ok(standing.ids.length > 0, "the keystone has no floors standing for it")
    assert.equal(standing.product, target, `standing floors do not multiply to ${target}`)
    for (const id of standing.ids) game.toggle(id)
    game.strike((i + 1) * 1000)
  }
})

test("a wrong strike makes the tower taller — strictly, every time", () => {
  const { game, reports } = rig(0xbadbad)
  const clock = stepClock()

  // Inside one tower. The last keystone of a level rolls the building over, and
  // comparing heights across that would be comparing two different towers.
  const keystones = game.progress.total
  assert.ok(keystones >= MIN_KEYSTONES && keystones <= MAX_KEYSTONES)
  const started = game.height

  for (let i = 0; i < keystones - 1; i++) {
    const target = currentAnswer(game)
    // Hold one floor that is not on its own the answer. Deliberately wrong.
    const wrong = game.floors.find((f) => f.value !== target)
    assert.ok(wrong, "every tower has a floor that is not the answer")
    game.toggle(wrong.id)

    const before = game.height
    const reportsBefore = reports.length
    game.strike(clock())

    assert.equal(reports.length, reportsBefore + 1, "a strike must be reported exactly once")
    const last = reports[reports.length - 1]
    assert.ok(last)
    assert.equal(last.correct, false)
    assert.equal(last.answered, String(wrong.value), "the reported value is what was held")

    assert.ok(before + GROWTH <= MAX_FLOORS, "this tower was already at the cap")
    assert.equal(game.height, before + GROWTH, "a wrong strike did not grow the tower")
  }

  // And the building the child is looking at is taller than the one they were
  // handed, by exactly the work they made for themselves.
  assert.equal(game.height, started + GROWTH * (keystones - 1))
  assert.equal(game.tally.missed, keystones - 1)
  assert.equal(game.tally.cleared, 0)
})

test("nothing else in the game makes the tower taller", () => {
  // Holding, letting go, striking an empty fist, pausing: none of it builds.
  const { game } = rig(0x9111)
  const started = game.height
  for (const floor of game.floors) game.toggle(floor.id)
  assert.equal(game.height, started)
  game.releaseAll()
  game.strike(1000)
  game.pause(1200)
  game.resume(1400)
  assert.equal(game.height, started)
})

test("a correct strike takes the keystone's stone out of the building", () => {
  const { game, reports } = rig(0x0dd)
  const clock = stepClock()
  const target = currentAnswer(game)
  const ids = solutionIds(game)
  const owned = game.floors.filter((f) => f.owner === game.progress.done).length

  const before = game.height
  for (const id of ids) game.toggle(id)
  game.strike(clock())

  const last = reports[reports.length - 1]
  assert.ok(last)
  assert.equal(last.correct, true)
  assert.equal(last.answered, String(target))
  assert.ok(game.height < before, "a correct strike did not bring anything down")
  // Its answer floors and its decoy floors both leave: the keystone's lies go
  // down with its truth, which is what makes the tower a countdown.
  assert.equal(game.height, before - owned)
})

test("the reported value is the exact product of the fist, as an integer string", () => {
  const { game, reports } = rig(0x5eed)
  const clock = stepClock()
  for (let i = 0; i < 24 && !game.stalled; i++) {
    const floors = game.floors
    const rng = new Rng(0x900d ^ i)
    const grab = Math.min(2, floors.length)
    const held: number[] = []
    for (let k = 0; k < grab; k++) {
      const floor = floors[rng.int(0, floors.length - 1)]
      if (floor && !held.includes(floor.value)) {
        game.toggle(floor.id)
        held.push(floor.value)
      }
    }
    if (game.holding.length === 0) continue
    const expected = productOf(game.heldValues())
    game.strike(clock())
    const last = reports[reports.length - 1]
    assert.ok(last)
    assert.equal(last.answered, String(expected))
    assert.ok(/^\d+$/.test(last.answered), `"${last.answered}" is not an integer string`)
  }
})

test("an empty fist is not an assertion: nothing reported, nothing built", () => {
  const { game, reports } = rig(0xe0f)
  const before = game.height
  const events = game.strike(500)
  assert.deepEqual(events, [])
  assert.equal(reports.length, 0)
  assert.equal(game.height, before)
  assert.equal(game.progress.done, 0)
})

test("taking hold of stone and letting it go costs nothing", () => {
  const { game, reports } = rig(0xf157)
  const before = game.height
  const floor = game.floors[0]
  assert.ok(floor)
  for (let i = 0; i < 20; i++) game.toggle(floor.id)
  game.releaseAll()
  assert.equal(reports.length, 0)
  assert.equal(game.height, before)
  assert.equal(game.holding.length, 0)
})

test("the building stops taking stone at the cap", () => {
  const { game } = rig(0xcafe)
  const clock = stepClock()
  for (let i = 0; i < 60 && !game.stalled; i++) {
    const target = currentAnswer(game)
    const wrong = game.floors.find((f) => f.value !== target)
    if (wrong) game.toggle(wrong.id)
    game.strike(clock())
    assert.ok(game.height <= MAX_FLOORS, `the tower reached ${game.height} floors`)
  }
})

test("a tower cleared to the ground is toppled, and only then", () => {
  const { game, transitions } = rig(0x7a11)
  const clock = stepClock()
  const keystones = game.progress.total
  for (let i = 0; i < keystones; i++) {
    for (const id of solutionIds(game)) game.toggle(id)
    game.strike(clock())
  }
  assert.equal(game.tally.toppled, 1, "a perfect tower did not come down")
  assert.equal(game.tally.cleared, keystones)
  assert.equal(game.tally.missed, 0)
  assert.deepEqual(transitions, [{ kind: "level", label: "toppled" }])
})

test("a level with nothing cleared raises no stopping point", () => {
  const { game, transitions } = rig(0x1055)
  const clock = stepClock()
  const keystones = game.progress.total
  for (let i = 0; i < keystones; i++) {
    const target = currentAnswer(game)
    const wrong = game.floors.find((f) => f.value !== target)
    if (wrong) game.toggle(wrong.id)
    game.strike(clock())
  }
  assert.equal(game.tally.cleared, 0)
  assert.equal(game.tally.missed, keystones)
  assert.deepEqual(transitions, [], "a purchase sheet must never sit next to a shortfall")
})

test("a keystone whose stone was spent on an earlier answer is re-planted", () => {
  // Drive the engine with a host that serves one answer over and over, so every
  // keystone's solution is the same slab and clearing one strips the next.
  let n = 0
  const host = {
    next: () => {
      n += 1
      return {
        id: `q-${n}`,
        prompt: "8 + 4",
        answer: "12",
        distractors: ["3", "112"],
        domain: "add",
        difficulty: 0,
      }
    },
    report: () => {},
    haptic: () => {},
    prefersReducedMotion: () => true,
  }
  const game = new Game(host, new Rng(9), 0)
  game.begin(0)
  const clock = stepClock()
  const keystones = game.progress.total
  for (let i = 0; i < keystones; i++) {
    const standing = standingSolution(game.floors, game.progress.done)
    assert.equal(standing.product, 12, `keystone ${i} has no answer standing`)
    for (const id of standing.ids) game.toggle(id)
    game.strike(clock())
  }
  assert.equal(game.tally.cleared, keystones)
})

test("a host that serves nothing buildable stalls loudly rather than lying", () => {
  const host = {
    next: () => ({
      id: "bad",
      prompt: "1 ÷ 3",
      answer: "0.3333",
      distractors: [],
      domain: "frac",
      difficulty: 0,
    }),
    report: () => {
      throw new Error("an unbuildable question must never be reported")
    },
    haptic: () => {},
    prefersReducedMotion: () => true,
  }
  const errors: unknown[] = []
  const real = console.error
  console.error = (...args: unknown[]) => errors.push(args)
  try {
    const game = new Game(host, new Rng(3), 0)
    const events = game.begin(0)
    assert.deepEqual(events, [{ kind: "stalled" }])
    assert.ok(game.stalled)
    assert.deepEqual(game.strike(10), [])
    assert.equal(errors.length, 1, "a stall must be loud")
  } finally {
    console.error = real
  }
})

test("the stub host only serves what the curriculum actually has active", () => {
  const host = createStubHost({ seed: 0x515 })
  for (let i = 0; i < 400; i++) {
    const q = host.next()
    assert.ok(q.domain === "add" || q.domain === "sub", `served ${q.domain}`)
    const answer = Number(q.answer)
    assert.ok(Number.isInteger(answer) && answer > 0)
    assert.equal(answerOf(q), answer)
  }
})
