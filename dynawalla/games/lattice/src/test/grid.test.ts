// THE GRID — the sheet the arena is strung on, and the reduced-motion branch.
//
// This is the fleet's juice benchmark, which means it is also the thing most
// likely to be quietly broken: a spring simulation that blows up produces NaN
// and draws nothing, and a canvas that draws nothing looks exactly like a
// canvas that is fine on a screenshot.
//
// Three properties, all of them about the simulation rather than the pixels:
// it never produces a NaN, it always comes back to rest, and every strut it
// tears is a strut it knits back.
//
// And one about the branch: **reduced motion is a different simulation, not an
// absent one.** The sheet still dents where a number came apart — that is the
// only cue saying where the split happened — but it is critically damped, so it
// arrives and returns without a single overshoot, and its amplitude ceiling is
// a fraction of the full one.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Grid } from "../sim/grid.ts"

function make(reduced: boolean): Grid {
  return new Grid({ cols: 20, rows: 15, width: 900, height: 675, reduced })
}

function finite(grid: Grid, where: string): void {
  for (let i = 0; i < grid.x.length; i++) {
    assert.ok(Number.isFinite(grid.x[i] as number), `${where}: x[${i}] is not finite`)
    assert.ok(Number.isFinite(grid.y[i] as number), `${where}: y[${i}] is not finite`)
    assert.ok(Number.isFinite(grid.vx[i] as number), `${where}: vx[${i}] is not finite`)
    assert.ok(Number.isFinite(grid.vy[i] as number), `${where}: vy[${i}] is not finite`)
  }
}

test("the sheet starts flat, with every strut whole", () => {
  for (const reduced of [false, true]) {
    const grid = make(reduced)
    assert.equal(grid.peakDisplacement, 0)
    assert.equal(grid.tornCount, 0)
    assert.ok(grid.struts > 500, "the sheet has too few struts to be a lattice")
    finite(grid, "at rest")
  }
})

test("it never produces a NaN, however hard it is hit", () => {
  for (const reduced of [false, true]) {
    const grid = make(reduced)
    for (let i = 0; i < 400; i++) {
      grid.impulse((i * 37) % 900, (i * 53) % 675, 4000, 4)
      grid.implode((i * 71) % 900, (i * 29) % 675, 3000, 6)
      // Including the frames a backgrounded tab hands back.
      grid.step(i % 17 === 0 ? 100000 : 16)
      finite(grid, `after hit ${i} (reduced=${reduced})`)
    }
  }
})

test("the sheet always comes back to rest", () => {
  for (const reduced of [false, true]) {
    const grid = make(reduced)
    grid.impulse(450, 340, 2600, 3)
    let peak = 0
    for (let i = 0; i < 20; i++) {
      grid.step(16)
      peak = Math.max(peak, grid.peakDisplacement)
    }
    assert.ok(peak > 1, `the sheet did not move at all (reduced=${reduced})`)
    for (let i = 0; i < 400; i++) grid.step(16)
    assert.ok(
      grid.peakDisplacement < 0.5,
      `the sheet was still ringing after six seconds (reduced=${reduced}): ${grid.peakDisplacement}`,
    )
    assert.equal(grid.tornCount, 0, "a strut never knitted back")
  }
})

test("a hard enough hit tears the sheet, and the sheet knits back", () => {
  const grid = make(false)
  grid.impulse(450, 340, 9000, 2)
  let tore = 0
  for (let i = 0; i < 30; i++) {
    grid.step(16)
    tore = Math.max(tore, grid.tornCount)
  }
  assert.ok(tore > 0, "nothing tore under a hit that should have opened the sheet")
  for (let i = 0; i < 300; i++) grid.step(16)
  assert.equal(grid.tornCount, 0, "the sheet did not knit back")
  assert.ok(grid.peakDisplacement < 0.5, "the sheet did not settle after a tear")
})

test("reduced motion is a branch: the sheet still dents, and it stops dead", () => {
  const full = make(false)
  const calm = make(true)
  full.impulse(450, 340, 3000, 3)
  calm.impulse(450, 340, 3000, 3)

  // Sample the displacement at the centre of the hit over a second, and count
  // how many times it turns around. A spring that rings crosses its own peak
  // several times; a critically damped one rises once and comes back.
  const trace = (grid: Grid): number[] => {
    const out: number[] = []
    for (let i = 0; i < 60; i++) {
      grid.step(16)
      out.push(grid.peakDisplacement)
    }
    return out
  }
  const turns = (xs: readonly number[]): number => {
    let n = 0
    for (let i = 2; i < xs.length; i++) {
      const a = (xs[i - 1] as number) - (xs[i - 2] as number)
      const b = (xs[i] as number) - (xs[i - 1] as number)
      if (a > 0.02 && b < -0.02) n += 1
      if (a < -0.02 && b > 0.02) n += 1
    }
    return n
  }

  const fullTrace = trace(full)
  const calmTrace = trace(calm)
  const fullPeak = Math.max(...fullTrace)
  const calmPeak = Math.max(...calmTrace)

  // It is present. This is the assertion that fails if someone "fixes" reduced
  // motion by switching the simulation off — which would delete the only cue
  // saying where a number came apart.
  assert.ok(calmPeak > 0.5, `the reduced branch did not move at all: ${calmPeak}`)
  // And it is calm: a fraction of the travel, and no ringing.
  assert.ok(
    calmPeak < fullPeak * 0.5,
    `the reduced branch travelled ${calmPeak} against ${fullPeak}`,
  )
  assert.ok(
    turns(calmTrace) <= 1,
    `the reduced branch rang ${turns(calmTrace)} times; it must rise once and return`,
  )
  assert.ok(turns(fullTrace) >= 1, "the full branch did not ring at all")
})

test("resizing re-lays the sheet without leaving a strut torn or a point adrift", () => {
  const grid = make(false)
  grid.impulse(450, 340, 9000, 2)
  for (let i = 0; i < 12; i++) grid.step(16)
  grid.resize(1400, 500)
  assert.equal(grid.tornCount, 0)
  assert.equal(grid.peakDisplacement, 0)
  finite(grid, "after a resize")
  assert.ok(Math.abs((grid.x[grid.cols - 1] as number) - 1400) < 1e-3, "the sheet is not the box")
})
