// The construction is a promise with two halves, and both are testable.
//
//   `P-04`  it never regresses — no code path removes a placed element
//   `Q-02`  it stays under the live-SVG-node cap, at any history
//
// The second one is the interesting test, because a budget that no reachable
// input can exceed is not a gate. So the cap is asserted twice: against the
// real model at a million apertures, where it holds with two orders of
// magnitude of room, **and** against `unfusedNodes` — the same world drawn one
// node per aperture, which is what this file would do if fusion had been left
// as an optimisation for later. That one blows the cap, which is what proves
// the cap can fail.

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  aperturesIn,
  breakdown,
  CELLS_PER_COURSE,
  CELLS_PER_ROSETTE,
  CELLS_PER_SCREEN,
  CELLS_PER_STAR,
  CHROME_NODES,
  COURSES_PER_SCREEN,
  liveNodes,
  milestoneAt,
  NODE_CAP,
  NOTHING_BUILT,
  place,
  rosetteOnBench,
  rosettesShown,
  ROSETTES_PER_COURSE,
  screenBox,
  screenPieces,
  unfusedNodes,
  VISIBLE_PANELS,
} from "./construction.ts"
import { CELLS_PER_ROSETTE as CELLS, CUT_ORDER, rosetteCells } from "./rosette.ts"

const here = path.dirname(fileURLToPath(import.meta.url))

test("P-04: no code path in the world lowers what has been placed", () => {
  // Read as source, not as behaviour: the claim is about what exists, and a
  // behavioural test can only ever cover the paths somebody thought of.
  const source = ["construction.ts", "store.ts"].map((name) =>
    fs.readFileSync(path.join(here, name), "utf8"),
  )
  for (const text of source) {
    const body = text
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//") && !line.trimStart().startsWith("*"))
      .join("\n")
    assert.equal(/placed\s*-[-=]/.test(body), false, "a decrement of `placed`")
    assert.equal(/placed:\s*0\b/.test(body.replace(/NOTHING_BUILT[\s\S]{0,60}/, "")), false)
  }
})

test("P-04: placing is the only transition, and it only ever adds one", () => {
  let world = NOTHING_BUILT
  for (let i = 1; i <= 250; i++) {
    const before = world.placed
    world = place(world)
    assert.equal(world.placed, before + 1)
  }
})

test("the milestones are the four scales, in order of rarity", () => {
  assert.equal(milestoneAt(0), null)
  assert.equal(milestoneAt(9), null)
  assert.equal(milestoneAt(CELLS_PER_STAR), "star")
  assert.equal(milestoneAt(CELLS_PER_ROSETTE), "rosette")
  assert.equal(milestoneAt(CELLS_PER_COURSE), "course")
  assert.equal(milestoneAt(CELLS_PER_SCREEN), "screen")
  // A course boundary is also a rosette and a star boundary. The rarest wins,
  // or the child gets three reactions and three remarks for one answer.
  assert.equal(CELLS_PER_COURSE % CELLS_PER_ROSETTE, 0)
  assert.equal(CELLS_PER_SCREEN % CELLS_PER_COURSE, 0)
})

test("aperturesIn matches the scale it names", () => {
  assert.equal(aperturesIn("star"), CELLS_PER_STAR)
  assert.equal(aperturesIn("rosette"), CELLS_PER_ROSETTE)
  assert.equal(aperturesIn("course"), CELLS_PER_COURSE)
  assert.equal(aperturesIn("screen"), CELLS_PER_SCREEN)
})

test("a session's cadence: a milestone is reachable, and they are not constant", () => {
  // Twenty minutes is roughly forty answers. The child must be able to close a
  // rosette in one sitting and a course over the two the M2 playtest runs, and
  // must not be handed a milestone every few cards.
  const inForty = [...Array(40).keys()].filter((i) => milestoneAt(i + 1) !== null).length
  assert.ok(inForty >= 3 && inForty <= 6, `milestones in forty answers: ${String(inForty)}`)
  assert.ok(CELLS_PER_COURSE <= 80, "a course is reachable in two sessions")
})

test("a closed thing stays on the bench until the next answer starts a new one", () => {
  assert.equal(rosetteOnBench(0), 0)
  assert.equal(rosetteOnBench(1), 1)
  assert.equal(rosetteOnBench(CELLS_PER_ROSETTE), CELLS_PER_ROSETTE)
  assert.equal(rosetteOnBench(CELLS_PER_ROSETTE + 1), 1)
  // Same convention one scale up: finishing a whole screen must not show an
  // empty plate at the largest milestone the product has.
  const full = breakdown(CELLS_PER_SCREEN)
  assert.equal(full.courses, COURSES_PER_SCREEN)
  assert.equal(full.panels, 0)
  const next = breakdown(CELLS_PER_SCREEN + 1)
  assert.equal(next.panels, 1)
  assert.equal(next.cells, 1)
})

test("Q-02: live nodes stay under the cap at any history", () => {
  for (const placed of [0, 1, 19, 20, 50, 200, 500, 5_000, 50_000, 1_000_000]) {
    assert.ok(
      liveNodes(placed) <= NODE_CAP,
      `${String(placed)} placed drew ${String(liveNodes(placed))} nodes`,
    )
  }
  // Bounded by construction, not by luck: panels are occluded past
  // VISIBLE_PANELS and everything else is one screen's worth.
  const ceiling =
    VISIBLE_PANELS +
    COURSES_PER_SCREEN +
    ROSETTES_PER_COURSE +
    CELLS_PER_ROSETTE +
    CHROME_NODES
  assert.ok(ceiling < NODE_CAP / 4, `ceiling ${String(ceiling)} is not comfortably under the cap`)
})

test("Q-02: the cap is a gate — the unfused world blows it", () => {
  // If this ever passes, fusion has stopped being load bearing and the test
  // above has stopped meaning anything.
  assert.ok(unfusedNodes(5_000) > NODE_CAP)
  assert.ok(liveNodes(5_000) < unfusedNodes(5_000) / 100)
})

test("the model's node count is exactly what the drawing emits", () => {
  for (const placed of [0, 1, 13, 20, 21, 59, 60, 61, 179, 180, 181, 900, 5_000]) {
    assert.equal(
      screenPieces(placed).length + CHROME_NODES,
      liveNodes(placed),
      `pieces + chrome != liveNodes at ${String(placed)}`,
    )
  }
})

test("every piece is one path with a real `d`, and keys are unique", () => {
  for (const placed of [7, 45, 61, 181, 900]) {
    const pieces = screenPieces(placed)
    assert.equal(new Set(pieces.map((piece) => piece.key)).size, pieces.length)
    for (const piece of pieces) {
      assert.match(piece.d, /^M/, `${piece.key} is not a path`)
      assert.ok(!piece.d.includes("NaN"), `${piece.key} has NaN in it`)
    }
  }
})

test("fusion is lossless: a closed course holds every aperture it closed", () => {
  const course = screenPieces(CELLS_PER_COURSE).find((piece) => piece.kind === "course")
  assert.ok(course !== undefined)
  // One subpath per aperture in the course, all in one node.
  assert.equal((course.d.match(/M/g) ?? []).length, CELLS_PER_COURSE)
})

test("the plate is cropped on both axes to what is actually built", () => {
  // It cropped the height and never the width, so the "four fifths of an empty
  // plate" the crop exists to prevent was simply rotated onto the horizontal —
  // which is the axis a first session lives on. At nineteen apertures the child
  // had one small rosette in the left third of a three-rosette-wide box.
  const one = screenBox(1)
  const full = screenBox(CELLS_PER_SCREEN)
  assert.ok(one.width < full.width / 2, "the first rosette is drawn on a course-wide plate")
  assert.ok(one.height < full.height / 2, "the first rosette is not drawn on a year-sized plate")

  // Square-ish while there is one rosette: it fills its plate rather than
  // sitting in a letterbox.
  assert.ok(Math.abs(one.width - one.height) < 1e-9, "a single rosette is not on a square plate")

  // It grows a rosette at a time to the right, then a course at a time upward.
  assert.equal(rosettesShown(0), 1)
  assert.equal(rosettesShown(19), 1, "the rosette on the bench is the only one there is")
  assert.equal(rosettesShown(CELLS_PER_ROSETTE), 1, "a just-closed rosette stays alone on its plate")
  assert.equal(rosettesShown(CELLS_PER_ROSETTE + 1), 2)
  assert.equal(rosettesShown(CELLS_PER_COURSE), ROSETTES_PER_COURSE)
  assert.equal(rosettesShown(CELLS_PER_SCREEN), ROSETTES_PER_COURSE, "a wall does not narrow again")

  // Monotone within a screen. It resets when one is finished and set into the
  // wall — the next screen starts from bare stone, and the finished one is a
  // panel edge behind it — so the walk is bounded to a single screen, which is
  // the span the crop is a claim about.
  let widest = 0
  let tallest = 0
  for (let placed = 0; placed <= CELLS_PER_SCREEN; placed++) {
    const box = screenBox(placed)
    assert.ok(box.width >= widest, `the plate narrowed at ${String(placed)}`)
    assert.ok(box.height >= tallest, `the plate shortened at ${String(placed)}`)
    widest = box.width
    tallest = box.height
  }
})

test("the cut order is a permutation, star before ring", () => {
  assert.equal(CUT_ORDER.length, CELLS)
  assert.equal(new Set(CUT_ORDER).size, CELLS)
  const star = CUT_ORDER.slice(0, CELLS / 2)
  assert.ok(
    star.every((cell) => cell < CELLS / 2),
    "the first ten cuts must close the star",
  )
  // Not sequential: a ring filled in index order is a pie chart, and a filling
  // ring is on the hostile reference board by name.
  assert.notDeepEqual([...CUT_ORDER], [...Array(CELLS).keys()])
})

test("the twenty apertures are twenty distinct shapes", () => {
  const cells = rosetteCells({ x: 0, y: 0 })
  assert.equal(cells.length, CELLS)
  assert.equal(new Set(cells).size, CELLS)
})

test("the geometry is deterministic — the same call, the same string", () => {
  assert.deepEqual(rosetteCells({ x: 3, y: 4 }), rosetteCells({ x: 3, y: 4 }))
})

test("a rosette rejects proportions that are not a rosette", () => {
  const at = { x: 0, y: 0 }
  assert.throws(() => rosetteCells(at, { radius: 0, tip: 0.6, valley: 0.3, rib: 0.1 }))
  // Valley outside tip turns the star inside out; both draw without complaint.
  assert.throws(() => rosetteCells(at, { radius: 10, tip: 0.3, valley: 0.6, rib: 0.1 }))
  assert.throws(() => rosetteCells(at, { radius: 10, tip: 1.4, valley: 0.3, rib: 0.1 }))
  assert.throws(() => rosetteCells(at, { radius: 10, tip: 0.6, valley: 0.3, rib: 1 }))
})

test("Q-05: the world imports nothing from the work surface or the engine", () => {
  const offenders: string[] = []
  for (const name of fs.readdirSync(here)) {
    if (!/\.(ts|tsx)$/.test(name) || name.endsWith(".test.ts")) continue
    const text = fs.readFileSync(path.join(here, name), "utf8")
    for (const [, specifier] of text.matchAll(/from\s+"([^"]+)"/g)) {
      if (/(\.\.\/work\/|\.\.\/reactions\/|engine|curriculum)/.test(specifier ?? "")) {
        offenders.push(`${name} -> ${specifier ?? ""}`)
      }
    }
  }
  assert.deepEqual(offenders, [])
})
