import { test } from "node:test"
import assert from "node:assert/strict"

import { ARENAS, makeGrid, pickArena } from "../src/game/grid.ts"
import { levelAt } from "../src/game/levels.ts"
import {
  PLATE_ARM,
  PLATE_HALF_H,
  PLATE_HALF_W,
  holdPlates,
  layoutPlates,
  onPlate,
  type Plate,
} from "../src/game/plates.ts"

const LABELS = [
  { label: "4500", correct: true },
  { label: "3600", correct: false },
  { label: "5040", correct: false },
]

/** Every arena the game can be played on, rail included. */
const GRIDS = ARENAS.map((a) => makeGrid(a))

// ---------------------------------------------------------------------------
// The plate row. This is the defect: three answers on one line, in a game where
// the player travels along lines.
// ---------------------------------------------------------------------------

test("no two plates share a row or a column", () => {
  for (const g of GRIDS) {
    const ps = layoutPlates(g.w, g.h, LABELS)
    assert.equal(ps.length, 3)
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i] as Plate
        const b = ps[j] as Plate
        assert.ok(
          Math.abs(a.gx - b.gx) > PLATE_HALF_W * 2,
          `${g.w}x${g.h}: plates ${i} and ${j} are ${Math.abs(a.gx - b.gx).toFixed(1)} cells apart in x`,
        )
        assert.ok(
          Math.abs(a.gy - b.gy) > PLATE_HALF_H * 2,
          `${g.w}x${g.h}: plates ${i} and ${j} share a row (${a.gy.toFixed(1)} vs ${b.gy.toFixed(1)})`,
        )
      }
    }
  }
})

test("a plate is never off the arena, on the rail, or under the prompt card", () => {
  for (const g of GRIDS) {
    for (const p of layoutPlates(g.w, g.h, LABELS)) {
      assert.ok(p.gx - PLATE_HALF_W > 1 && p.gx + PLATE_HALF_W < g.w - 1, `${g.w}x${g.h}: ${p.label} off the side`)
      assert.ok(p.gy - PLATE_HALF_H > 1 && p.gy + PLATE_HALF_H < g.h - 1, `${g.w}x${g.h}: ${p.label} off the top/bottom`)
      // The prompt is a DOM card centred over the canvas. A plate behind it is
      // a candidate a child cannot read — which is what the middle plate was,
      // sitting at exactly `h * 0.5`.
      assert.ok(
        Math.abs(p.gy - g.h / 2) > PLATE_HALF_H,
        `${g.w}x${g.h}: ${p.label} sits under the prompt card`,
      )
    }
  }
})

// ---------------------------------------------------------------------------
// Arriving is not answering.
// ---------------------------------------------------------------------------

/**
 * Drive the player in a straight line, one axis at a time, exactly as
 * `movePlayer` does: constant cells per second, no acceleration.
 *
 * Returns every plate index that answered along the way.
 */
function drive(
  plates: Plate[],
  from: [number, number],
  to: [number, number],
  cellsPerSecond: number,
): number[] {
  const dt = 1 / 60
  const dist = Math.hypot(to[0] - from[0], to[1] - from[1])
  const steps = Math.ceil((dist / cellsPerSecond) * 60)
  const answered: number[] = []
  for (let s = 0; s <= steps; s++) {
    const k = s / steps
    const px = from[0] + (to[0] - from[0]) * k
    const py = from[1] + (to[1] - from[1]) * k
    const i = holdPlates(plates, px, py, dt)
    if (i >= 0) {
      answered.push(i)
      ;(plates[i] as Plate).taken = true
    }
  }
  return answered
}

test("driving across a plate never answers with it, at any speed the ladder reaches", () => {
  // The old rule answered on contact. On a 120-wide arena the plates sat at
  // x=30, 60 and 90 on the same row, so a child who worked out the answer, saw
  // it on the right-hand plate and drove right was recorded as having chosen
  // whichever plate they crossed first.
  for (const g of GRIDS) {
    for (const li of [1, 2, 5, 9, 20, 40, 60]) {
      const speed = levelAt(li).railSpeed
      for (const p of layoutPlates(g.w, g.h, LABELS)) {
        const ps = layoutPlates(g.w, g.h, LABELS)
        // Straight through the middle of it, both ways, both axes.
        const runs: Array<[[number, number], [number, number]]> = [
          [[0.5, p.gy], [g.w - 0.5, p.gy]],
          [[g.w - 0.5, p.gy], [0.5, p.gy]],
          [[p.gx, 0.5], [p.gx, g.h - 0.5]],
          [[p.gx, g.h - 0.5], [p.gx, 0.5]],
        ]
        for (const [a, b] of runs) {
          for (const q of ps) {
            q.charge = 0
            q.taken = false
          }
          const hits = drive(ps, a, b, speed)
          assert.deepEqual(
            hits,
            [],
            `${g.w}x${g.h} level ${li} (${speed} c/s): driving ${a} → ${b} answered with ` +
              hits.map((i) => (ps[i] as Plate).label).join(","),
          )
        }
      }
    }
  }
})

test("the hold is longer than the crossing, with room to spare, on every level", () => {
  // The invariant the test above is a consequence of. `railSpeed` is the fast
  // one — `cutSpeed` is slower and the player is never cutting at the gate.
  for (let i = 1; i <= 60; i++) {
    const speed = levelAt(i).railSpeed
    const crossing = Math.max(PLATE_HALF_W * 2, PLATE_HALF_H * 2) / speed
    assert.ok(
      PLATE_ARM > crossing * 1.3,
      `level ${i}: crossing a plate takes ${crossing.toFixed(2)}s and the hold is only ${PLATE_ARM}s`,
    )
  }
})

test("standing on the plate you meant does answer with it, and quickly", () => {
  const g = makeGrid(pickArena(96 / 75))
  const ps = layoutPlates(g.w, g.h, LABELS)
  const want = ps.findIndex((p) => p.correct)
  const target = ps[want] as Plate
  let held = 0
  let answered = -1
  for (let s = 0; s < 600 && answered < 0; s++) {
    held += 1 / 60
    answered = holdPlates(ps, target.gx, target.gy, 1 / 60)
  }
  assert.equal(answered, want, "the plate under the player is the one that answers")
  assert.equal((ps[answered] as Plate).correct, true)
  assert.ok(held < 1, `it took ${held.toFixed(2)}s to answer a plate you are standing on`)
  // There is no gate clock to be inside of any more (`gate.ts`) — the hold is
  // now the only duration in the gate, and it is under a second.
  assert.ok(held < PLATE_ARM * 1.2, `the hold is ${PLATE_ARM}s but answering took ${held.toFixed(2)}s`)
})

test("stepping off empties a plate rather than banking it", () => {
  const g = makeGrid(pickArena(96 / 75))
  const ps = layoutPlates(g.w, g.h, LABELS)
  const p = ps[0] as Plate
  // Nearly there...
  for (let s = 0; s < 30; s++) holdPlates(ps, p.gx, p.gy, 1 / 60)
  assert.ok(p.charge > 0.4)
  // ...and away. Two near-misses must not add up to an answer.
  holdPlates(ps, p.gx + PLATE_HALF_W + 1, p.gy, 1 / 60)
  assert.equal(p.charge, 0)
  for (let s = 0; s < 30; s++) {
    assert.equal(holdPlates(ps, p.gx, p.gy, 1 / 60), -1, "a second half-crossing answered")
  }
})

test("the hit box is what the plate looks like, not something smaller", () => {
  const g = makeGrid(pickArena(96 / 75))
  const p = (layoutPlates(g.w, g.h, LABELS)[0] as Plate)
  assert.equal(onPlate(p, p.gx, p.gy), true)
  assert.equal(onPlate(p, p.gx + PLATE_HALF_W * 0.9, p.gy + PLATE_HALF_H * 0.9), true)
  assert.equal(onPlate(p, p.gx + PLATE_HALF_W + 0.01, p.gy), false)
  assert.equal(onPlate(p, p.gx, p.gy + PLATE_HALF_H + 0.01), false)
})
