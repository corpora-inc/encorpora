// Where the answer meets the world and the character.
//
// The claim the brief asks to be checked deliberately is here: **a wrong answer
// must never be more rewarding than a right one.** It is checked three ways,
// because the interesting failure is not "the wrong branch celebrates" — nobody
// writes that — it is a wrong answer picking up a reward through a side door.
//
//   1. It places nothing. The construction is a record of what went right.
//   2. It cannot reach a milestone, so it cannot reach the reaction tiers that
//      milestones unlock.
//   3. It earns the character nothing to say.

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { chooseTier } from "../reactions/tiers.ts"
import {
  CELLS_PER_COURSE,
  CELLS_PER_ROSETTE,
  CELLS_PER_STAR,
  milestoneAt,
} from "../world/construction.ts"
import { LADDER } from "./ladder.ts"
import { difficultyOf, respond } from "./respond.ts"
import { generateProblem, type Card, type CardRole } from "./session.ts"
import { planAt } from "./plan-fixtures.ts"

const here = path.dirname(fileURLToPath(import.meta.url))

function problemAt(step: number, role: CardRole): Card {
  const plan = planAt(step, step * 31 + 7)
  return { kind: "problem", exercise: generateProblem(plan), plan, role }
}

const TOP = LADDER.length - 1

test("a wrong answer places nothing in the world", () => {
  // `respond` is handed the count *after* any placement, and the caller only
  // places on a correct answer. Both halves are asserted: the store's placement
  // condition below, and here that a wrong answer at a would-be milestone count
  // still reports no milestone.
  const wrong = respond(problemAt(TOP, "ladder"), false, CELLS_PER_ROSETTE)
  assert.ok(wrong !== null)
  assert.equal(wrong.outcome.milestone, null)
  assert.equal(wrong.observation, null)
})

test("a wrong answer earns SLIP, at every rung and every role", () => {
  for (let rung = 0; rung <= TOP; rung++) {
    for (const role of ["ladder", "retry", "repair"] as const) {
      const response = respond(problemAt(rung, role), false, 999)
      assert.ok(response !== null)
      assert.equal(chooseTier(response.outcome), "slip")
      assert.equal(response.outcome.repaired, false, "a wrong answer claimed a repair")
    }
  }
})

test("a right answer at the same rung always outranks the wrong one", () => {
  const order = ["slip", "seat", "engage", "illuminate", "mechanism"]
  for (let rung = 0; rung <= TOP; rung++) {
    const right = respond(problemAt(rung, "ladder"), true, 3)
    const wrong = respond(problemAt(rung, "ladder"), false, 3)
    assert.ok(right !== null && wrong !== null)
    assert.ok(
      order.indexOf(chooseTier(right.outcome)) > order.indexOf(chooseTier(wrong.outcome)),
      `rung ${String(rung)}`,
    )
  }
})

test("repairing what just broke is the thing that earns tier 2", () => {
  const repair = respond(problemAt(0, "repair"), true, 3)
  const ordinary = respond(problemAt(0, "ladder"), true, 3)
  assert.ok(repair !== null && ordinary !== null)
  assert.equal(repair.outcome.repaired, true)
  assert.equal(chooseTier(repair.outcome), "illuminate")
  assert.equal(chooseTier(ordinary.outcome), "seat")
  assert.deepEqual(repair.observation, { kind: "repaired", apertures: null })
})

test("difficulty is the item's own difficulty and nothing else", () => {
  // It rises with the slice, which is ordered by `b_item`, and it stays inside
  // 0…1 at both ends. What it must not do is carry a run length, a speed or a
  // count of anything the child did — `difficultyOf` takes one card.
  // The slice's easiest step is not the catalog's easiest item — `add-multidigit`
  // level 0 sits below it — so the bottom of the scale is not 0 here, and that is
  // the scale being a curriculum fact rather than an index.
  assert.ok(difficultyOf(planAt(0, 1)) >= 0 && difficultyOf(planAt(0, 1)) < 1)
  assert.equal(difficultyOf(planAt(TOP, 1)), 1, "the slice's hardest step is the catalog's hardest item")
  for (let step = 1; step <= TOP; step++) {
    assert.ok(
      difficultyOf(planAt(step, 1)) >= difficultyOf(planAt(step - 1, 1)),
      `step ${String(step)} is easier than the one before it`,
    )
  }
  assert.equal(difficultyOf({ ...planAt(0, 1), skillId: "no.such.skill" }), 0, "an unknown card escaped the scale")
})

test("a milestone is passed through to both the reaction and the character", () => {
  const star = respond(problemAt(0, "ladder"), true, CELLS_PER_STAR)
  assert.ok(star !== null)
  assert.equal(star.outcome.milestone, "star")
  assert.deepEqual(star.observation, { kind: "closed", apertures: CELLS_PER_STAR })

  const course = respond(problemAt(0, "ladder"), true, CELLS_PER_COURSE)
  assert.ok(course !== null)
  assert.equal(course.outcome.milestone, "course")
  assert.equal(chooseTier(course.outcome), "mechanism")
})

test("a contrast card responds with nothing at all", () => {
  const locate: Card = {
    kind: "locate",
    board: { rows: [], left: { label: "", total: "" }, right: { label: "", total: "" } } as never,
    misconception: "mis.add.borrow-across-zero" as never,
    representation: "rep.counting-board" as never,
    plan: planAt(4, 1),
  }
  assert.equal(respond(locate, true, 20), null)
})

test("the store places on the correct branch only", () => {
  // The one line that decides whether the world moves. Read as source because
  // the alternative — driving zustand plus persistence under `node --test` —
  // tests the store's plumbing rather than this rule.
  const text = fs.readFileSync(path.join(here, "store.ts"), "utf8")
  assert.match(text, /const placed = correct \? worldStore\.getState\(\)\.placeOne\(\)/)
  // …and it is the only call site, so there is no second, unconditional one.
  assert.equal((text.match(/placeOne\(\)/g) ?? []).length, 1)
})

test("milestones are read from the world, not recomputed here", () => {
  for (const placed of [CELLS_PER_STAR, CELLS_PER_ROSETTE, CELLS_PER_COURSE, 7]) {
    const response = respond(problemAt(0, "ladder"), true, placed)
    assert.ok(response !== null)
    assert.equal(response.outcome.milestone, milestoneAt(placed))
  }
})
