import { test } from "node:test"
import assert from "node:assert/strict"

import {
  cleanFraction,
  partOf,
  percentOf,
  percentInt,
  percentTenths,
  reduce,
} from "../src/game/exact.ts"
import {
  ARENAS,
  CLAIMED,
  INTERIOR_CELLS,
  TRAIL,
  VOID,
  burnBack,
  commitClaim,
  idx,
  makeGrid,
  previewClaim,
  pickArena,
  resetGrid,
} from "../src/game/grid.ts"
import { goalFromQuestion, levelAt } from "../src/game/levels.ts"
import { makeRng, hashSeed } from "../src/game/rng.ts"
import { createStubHost } from "../src/stubHost.ts"

// ---------------------------------------------------------------------------
// Exact arithmetic. Every one of these is a wrong answer if it drifts.
// ---------------------------------------------------------------------------

test("the arena divides exactly by every denominator the game can ask for", () => {
  assert.equal(INTERIOR_CELLS, 7200)
  for (const d of [2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 16, 20, 24, 25, 100]) {
    assert.equal(INTERIOR_CELLS % d, 0, `7200 must divide by ${d}`)
  }
  assert.equal(partOf(7200, 3, 4), 5400)
  assert.equal(partOf(7200, 5, 8), 4500)
  assert.equal(partOf(7200, 7, 12), 4200)
  assert.equal(percentOf(7200, 35), 2520)
})

test("a fraction that is not a whole number of cells throws instead of rounding", () => {
  assert.throws(() => partOf(7200, 1, 7))
  assert.throws(() => partOf(100, 1, 3))
})

test("percent display is built from integers, never from a float", () => {
  assert.equal(percentTenths(2664, 7200), "37.0")
  assert.equal(percentTenths(1, 7200), "0.0")
  assert.equal(percentTenths(7200, 7200), "100.0")
  assert.equal(percentInt(5400, 7200), 75)
})

test("the meter recognises the fractions a child recognises", () => {
  assert.deepEqual(cleanFraction(3600, 7200), { n: 1, d: 2 })
  assert.deepEqual(cleanFraction(2700, 7200), { n: 3, d: 8 })
  assert.deepEqual(cleanFraction(4800, 7200), { n: 2, d: 3 })
  assert.equal(cleanFraction(2701, 7200), null) // 2701/7200 is nobody's fraction
  assert.deepEqual(reduce(675, 7200), { n: 3, d: 32 })
})

// ---------------------------------------------------------------------------
// The claim rule — the whole game rests on this being exact.
// ---------------------------------------------------------------------------

/** Cut a full-height line at column `x`, exactly as the player would. */
function cutColumn(g: ReturnType<typeof makeGrid>, x: number): number[] {
  const trail: number[] = []
  for (let y = 1; y <= g.h - 2; y++) {
    const c = idx(g, x, y)
    g.own[c] = TRAIL
    trail.push(c)
  }
  return trail
}

test("a cut takes exactly the side the hunters cannot reach", () => {
  const g = makeGrid(pickArena(96 / 75))
  assert.equal(g.total, 7200)
  assert.equal(g.w, 98)
  assert.equal(g.h, 77)

  const trail = cutColumn(g, 10)
  // One hunter, well inside the right-hand region.
  const res = commitClaim(g, trail, [idx(g, 50, 30)], 1)

  // Left of the cut: columns 1..9 over rows 1..75. Plus the 75-cell line.
  const expected = 9 * 75 + 75
  assert.equal(expected, 750)
  assert.equal(g.claimed, 750)
  assert.equal(res.count, 750)
  assert.equal(res.cells.length, 750)
  assert.equal(g.own[idx(g, 5, 40)], CLAIMED)
  assert.equal(g.own[idx(g, 60, 40)], VOID)
  // 750 / 7200 is exactly 5/48 — no rounding anywhere in the pipeline.
  assert.deepEqual(reduce(g.claimed, g.total), { n: 5, d: 48 })
})

test("hunters on both sides means only the line itself is taken", () => {
  const g = makeGrid(pickArena(96 / 75))
  const trail = cutColumn(g, 10)
  commitClaim(g, trail, [idx(g, 5, 40), idx(g, 50, 30)], 1)
  assert.equal(g.claimed, 75)
  assert.equal(g.own[idx(g, 5, 40)], VOID)
  assert.equal(g.own[idx(g, 60, 40)], VOID)
})

test("with nothing hunting, the whole plane falls", () => {
  const g = makeGrid(pickArena(96 / 75))
  const trail = cutColumn(g, 10)
  commitClaim(g, trail, [], 1)
  assert.equal(g.claimed, g.total)
})

test("the reveal order starts at the cut line and spreads outward", () => {
  const g = makeGrid(pickArena(96 / 75))
  const trail = cutColumn(g, 10)
  const res = commitClaim(g, trail, [idx(g, 50, 30)], 1)
  assert.equal(res.dists[0], 0)
  for (let i = 1; i < res.dists.length; i++) {
    assert.ok(
      (res.dists[i] as number) >= (res.dists[i - 1] as number),
      "flood distances must be non-decreasing",
    )
  }
  // The far column is nine cells from the line, so that is the wave's length.
  assert.equal(res.maxDist, 9)
})

test("the preview predicts exactly what the cut will deliver", () => {
  const g = makeGrid(pickArena(96 / 75))
  // Half a cut: down column 10 to row 40, still travelling downward.
  const trail: number[] = []
  for (let y = 1; y <= 40; y++) {
    const c = idx(g, 10, y)
    g.own[c] = TRAIL
    trail.push(c)
  }
  const hunters = [idx(g, 50, 30)]
  const predicted = previewClaim(g, trail, 10, 40, 0, 1, hunters)

  // Now actually finish the cut the way the preview assumed.
  for (let y = 41; y <= g.h - 2; y++) {
    const c = idx(g, 10, y)
    g.own[c] = TRAIL
    trail.push(c)
  }
  const res = commitClaim(g, trail, hunters, 1)
  assert.equal(predicted, res.count)
  assert.equal(predicted, 750)
})

test("overshooting gives the ground back — exactly the ground it took", () => {
  const g = makeGrid(pickArena(96 / 75))
  const trail = cutColumn(g, 10)
  const res = commitClaim(g, trail, [idx(g, 50, 30)], 1)
  assert.equal(g.claimed, 750)
  const burned = burnBack(g, res.cells)
  assert.equal(burned.length, 750)
  assert.equal(g.claimed, 0)
  assert.equal(g.own[idx(g, 5, 40)], VOID)
  assert.equal(g.own[idx(g, 10, 40)], VOID)
})

test("every arena is 7200 cells cut into exactly 40 equal blocks", () => {
  for (const a of ARENAS) {
    assert.equal(a.iw * a.ih, 7200, `${a.iw}x${a.ih}`)
    assert.equal(a.iw % a.bx, 0)
    assert.equal(a.ih % a.by, 0)
    assert.equal((a.iw / a.bx) * (a.ih / a.by), 40, `${a.iw}x${a.ih} block count`)
  }
  // The picker reaches for the shape that wastes the least of the screen.
  assert.equal(pickArena(2.4).iw, 120)
  assert.equal(pickArena(0.5).ih, 120)
  assert.equal(pickArena(1.3).iw, 96)
})

test("both orientations are the same 7200 cells", () => {
  const land = makeGrid(pickArena(96 / 75))
  const port = makeGrid(pickArena(75 / 96))
  assert.equal(land.total, port.total)
  assert.equal(land.total, 7200)
  assert.equal(port.w, 77)
  assert.equal(port.h, 98)
})

test("resetting the arena restores the rail and clears the count", () => {
  const g = makeGrid(pickArena(96 / 75))
  commitClaim(g, cutColumn(g, 10), [idx(g, 50, 30)], 1)
  resetGrid(g)
  assert.equal(g.claimed, 0)
  assert.equal(g.own[idx(g, 0, 0)], CLAIMED)
  assert.equal(g.own[idx(g, 1, 1)], VOID)
})

// ---------------------------------------------------------------------------
// Goals and the ladder
// ---------------------------------------------------------------------------

test("a host question that is a cell count becomes the goal", () => {
  const goal = goalFromQuestion(levelAt(3), 7200, {
    id: "q1",
    prompt: "5/8 of 7200",
    answer: "4500",
  })
  assert.equal(goal.target, 4500)
  assert.equal(goal.n, 5)
  assert.equal(goal.d, 8)
  assert.equal(goal.questionId, "q1")
  assert.equal(goal.lo, 4500 - 288)
  assert.equal(goal.hi, 4500 + 288)
  assert.ok(Number.isInteger(goal.lo) && Number.isInteger(goal.hi))
})

test("a question the level cannot use falls back to the ladder", () => {
  // Not an area at all — "15 − 8" is seven of something, not seven ten-thousandths
  // of a plane, and a seven-cell goal is not a game.
  const tiny = goalFromQuestion(levelAt(1), 7200, { id: "q2", prompt: "15 − 8", answer: "7" })
  assert.equal(tiny.target, 3600)
  assert.equal(tiny.questionId, null)

  // Not an integer.
  const frac = goalFromQuestion(levelAt(1), 7200, { id: "q3", prompt: "1/2", answer: "0.5" })
  assert.equal(frac.target, 3600)
  assert.equal(frac.questionId, null)
  assert.equal(frac.prompt, "1/2 of 7200")

  // A legal area, but far too much of the plane to take on level one against
  // a full arena. Level nine may ask for exactly the same thing.
  const huge = { id: "q4", prompt: "9/10 of 7200", answer: "6480" }
  assert.equal(goalFromQuestion(levelAt(1), 7200, huge).questionId, null)
  assert.equal(goalFromQuestion(levelAt(9), 7200, huge).questionId, "q4")
  assert.equal(goalFromQuestion(levelAt(9), 7200, huge).target, 6480)
})

test("every level's own ladder goal is inside its own share window", () => {
  for (let i = 1; i <= 60; i++) {
    const l = levelAt(i)
    const cells = (7200 * l.goal.n) / l.goal.d
    assert.ok(
      cells * 100 <= 7200 * l.maxShare,
      `level ${i} asks for ${l.goal.n}/${l.goal.d} but caps at ${l.maxShare}%`,
    )
  }
})

test("the ladder tightens and never inverts", () => {
  let prevBand = Infinity
  for (let i = 1; i <= 9; i++) {
    const l = levelAt(i)
    assert.ok(l.band < prevBand, `level ${i} band must be tighter`)
    assert.ok(Number.isInteger(l.band))
    assert.ok(l.cutSpeed < l.railSpeed, "cutting must feel heavier than skating")
    prevBand = l.band
  }
  const deep = levelAt(40)
  assert.ok(deep.band >= 72, "the band bottoms out rather than becoming impossible")
  assert.ok(deep.drifters <= 6 && deep.crawlers <= 4 && deep.chargers <= 3)
})

test("every ladder goal is a whole number of cells", () => {
  for (let i = 1; i <= 60; i++) {
    const l = levelAt(i)
    assert.equal((7200 * l.goal.n) % l.goal.d, 0, `level ${i}: ${l.goal.n}/${l.goal.d}`)
  }
})

// ---------------------------------------------------------------------------
// Determinism and the stub host
// ---------------------------------------------------------------------------

test("the same seed replays the same run", () => {
  const a = makeRng(hashSeed("claim-seed"))
  const b = makeRng(hashSeed("claim-seed"))
  for (let i = 0; i < 500; i++) assert.equal(a.int(1000), b.int(1000))
  assert.notEqual(makeRng(1).int(1e6), makeRng(2).int(1e6))
})

test("the stub host is seeded and its answers are exact", () => {
  const a = createStubHost({ total: 7200, seed: "abc" })
  const b = createStubHost({ total: 7200, seed: "abc" })
  for (let i = 0; i < 60; i++) {
    const qa = a.next()
    const qb = b.next()
    assert.deepEqual(qa, qb)
    const n = Number(qa.answer)
    assert.ok(Number.isInteger(n), `${qa.prompt} → ${qa.answer} must be a whole number`)
    assert.ok(n > 0 && n < 7200)
    assert.ok(qa.difficulty >= 0 && qa.difficulty <= 1)
  }
})

test("distractors are wrong, plausible, and never accidentally right", () => {
  const h = createStubHost({ total: 7200, seed: 12345 })
  for (let i = 0; i < 200; i++) {
    const q = h.next()
    assert.ok(q.distractors.length >= 1, `${q.prompt} produced no distractor`)
    const seen = new Set([q.answer])
    for (const d of q.distractors) {
      assert.ok(!seen.has(d), `duplicate option ${d} for ${q.prompt}`)
      seen.add(d)
      const n = Number(d)
      assert.ok(Number.isInteger(n) && n > 0 && n <= 7200, `${d} is not a legal area`)
    }
  }
})

test("the host never serves the same target twice running", () => {
  const h = createStubHost({ total: 7200, seed: "repeat" })
  let last = ""
  for (let i = 0; i < 200; i++) {
    const q = h.next()
    assert.notEqual(q.answer, last)
    last = q.answer
  }
})

test("report reaches the sink with what the player actually did", () => {
  const seen: Array<{ questionId: string; correct: boolean }> = []
  const h = createStubHost({ total: 7200, seed: 7, onReport: (r) => seen.push(r) })
  const q = h.next()
  h.report({ questionId: q.id, correct: true, ms: 4200, answered: "5400" })
  assert.equal(seen.length, 1)
  assert.equal(seen[0]?.questionId, q.id)
  assert.equal(seen[0]?.correct, true)
})

test("reduced motion is honoured when the platform asks for it", () => {
  assert.equal(createStubHost({ total: 7200, reducedMotion: true }).prefersReducedMotion(), true)
  assert.equal(createStubHost({ total: 7200, reducedMotion: false }).prefersReducedMotion(), false)
  // No matchMedia in Node at all: must not throw, must default to motion on.
  assert.equal(createStubHost({ total: 7200 }).prefersReducedMotion(), false)
})

test("haptics degrade silently where there is no vibration API", () => {
  const h = createStubHost({ total: 7200 })
  assert.doesNotThrow(() => {
    h.haptic("light")
    h.haptic("heavy")
    h.haptic("success")
  })
})
