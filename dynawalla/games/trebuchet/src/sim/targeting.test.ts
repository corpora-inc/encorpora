/**
 * The rule this file defends, learned the hard way in playtest:
 *
 *   A shot dialled to 22 flew over the keep standing at 14 — and the collision
 *   check caught it there, scored it against the wrong keep, and reported the
 *   WRONG answer as CORRECT. Correct arithmetic was punished and incorrect
 *   arithmetic was rewarded, both by geometry.
 *
 * So: intervening keeps are scenery. The only thing that decides a shot is the
 * metre it comes down on, computed from integers before the boulder has moved.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { LAUNCH_H, posAt, resolve, solve } from './ballistics.ts'

const LOFTS = [30, 38, 46, 55, 65]
const WORLD_X = (r: number): number => 6 + r
const KEEP_HALF_W = 4.6 / 2 + 0.55
const KEEP_TALL = 5 * 1.95 + 1.2

function towers(ranges: number[]): Array<{ id: number; range: number; value: number; alive: boolean }> {
  return ranges.map((r, i) => ({ id: i, range: r, value: r, alive: true }))
}

/** Does the arc physically pass through the box of a keep it is NOT aimed at? */
function clipsAnInnocent(R: number, loft: number, ranges: number[]): boolean {
  const s = solve(R, loft, 0, LAUNCH_H)
  const out = resolve(s.landing, towers(ranges))
  const N = 900
  for (let i = 0; i <= N; i++) {
    const p = posAt(s, (i / N) * s.T)
    const wx = p.x + 6
    for (const r of ranges) {
      if (out.target && r === out.target.range && out.errorM <= 2) continue
      if (Math.abs(wx - WORLD_X(r)) < KEEP_HALF_W && p.y < KEEP_TALL && p.y > 0) return true
    }
  }
  return false
}

test('a shot aimed past a nearer keep is never scored against that keep', () => {
  // the exact playtest case: keeps at 14 / 22 / 41, boulder says 22
  const t = towers([14, 22, 41])
  const s = solve(22, LOFTS[2], 0, LAUNCH_H)
  const out = resolve(s.landing, t)
  assert.equal(out.target?.range, 22)
  assert.equal(out.quality, 'direct')
  assert.equal(out.errorM, 0)
})

test('the outcome depends on the dial alone, not on what is standing in the way', () => {
  const crowded = [14, 22, 30, 38, 46, 54]
  for (const aim of crowded) {
    for (const loft of LOFTS) {
      const s = solve(aim, loft, 0, LAUNCH_H)
      const out = resolve(s.landing, towers(crowded))
      assert.equal(out.target?.range, aim, `aim=${aim} loft=${loft}`)
      assert.equal(out.quality, 'direct')
    }
  }
})

test('an intervening keep can be in the way, and it still changes nothing', () => {
  // At the minimum eight-metre spacing the descending arc genuinely does pass
  // through the far shoulder of the keep in front of its target — the geometry
  // does not allow otherwise. That is handled in the RENDERER (the boulder is
  // drawn behind the keeps, so it reads as depth). What must never happen is the
  // SIMULATION noticing: the outcome is identical whether or not anything stands
  // in the way.
  const field = [14, 22, 30, 38, 46, 54, 62, 70]
  const clipping = LOFTS.some((loft) => clipsAnInnocent(38, loft, field))
  assert.ok(clipping, 'if this ever stops being true the renderer note can be dropped')
  const crowded = resolve(solve(38, LOFTS[2], 0, LAUNCH_H).landing, towers(field))
  const alone = resolve(solve(38, LOFTS[2], 0, LAUNCH_H).landing, towers([38]))
  assert.equal(crowded.target?.range, alone.target?.range)
  assert.equal(crowded.quality, alone.quality)
  assert.equal(crowded.errorM, alone.errorM)
})

test('a wrong dial that lands on a rival keep is scored against THAT keep', () => {
  const t = towers([14, 22, 41])
  const out = resolve(22, t)
  assert.equal(out.target?.value, 22)
  // and a keep 3 m away is a graze, not a hit
  assert.equal(resolve(19, t).quality, 'graze')
  assert.equal(resolve(19, t).target?.value, 22)
})
