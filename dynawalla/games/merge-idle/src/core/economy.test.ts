import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  baseStepFor,
  bloomLevel,
  bloomYield,
  DIFFICULTY_CAP,
  difficultyAt,
  difficultyFor,
  emitPeriodMs,
  FORM_UNLOCK,
  formsAt,
  GROW_EVERY,
  growthsAt,
  maxDifficultyAt,
  maxDifficultyFor,
  offlineGrowth,
  OFFLINE_CAP_MS,
  OFFLINE_MAX_POLYPS,
  OFFLINE_MIN_MS,
  STOCK_PERIOD_MS,
  sumSlotsAt,
  wantDigitsAt,
} from './economy.ts'

test('the currency is gone — nothing here prices anything', async () => {
  const src = await import('node:fs/promises').then((fs) =>
    fs.readFile(new URL('./economy.ts', import.meta.url), 'utf8'),
  )
  // The founder: "the score number doesn't even show, the 4.7M/sec, the essence,
  // the flowx2 .. none of that even really makes sense or seems to do anything".
  for (const gone of ['ventRate', 'assayPayout', 'flowAfter', 'ventCost', 'growCost', 'upwellCost', 'tideMultiplier']) {
    assert.equal(src.includes(`export function ${gone}`), false, `${gone} should be deleted`)
  }
})

test('depth drives everything, and every curve is monotone in it', () => {
  let lastBloom = -1
  let lastStep = -1
  let lastYield = -1
  let lastPeriod = 1e9
  for (let d = 0; d <= 120; d++) {
    assert.ok(bloomLevel(d) >= lastBloom)
    assert.ok(baseStepFor(d) >= lastStep)
    assert.ok(bloomYield(d) >= lastYield)
    assert.ok(emitPeriodMs(d) <= lastPeriod)
    lastBloom = bloomLevel(d)
    lastStep = baseStepFor(d)
    lastYield = bloomYield(d)
    lastPeriod = emitPeriodMs(d)
  }
  assert.equal(bloomLevel(0), 0)
  assert.equal(bloomLevel(1000), 1)
  assert.ok(emitPeriodMs(1000) >= 1400, 'the reef must never out-emit a child')
})

test('the shelf grows every GROW_EVERY blooms and never un-grows', () => {
  assert.equal(growthsAt(0), 0)
  assert.equal(growthsAt(GROW_EVERY - 1), 0)
  assert.equal(growthsAt(GROW_EVERY), 1)
  assert.equal(growthsAt(GROW_EVERY * 4), 4)
  for (let d = 1; d < 200; d++) assert.ok(growthsAt(d) >= growthsAt(d - 1))
})

test('forms unlock in the order the curriculum teaches them, and never lock again', () => {
  assert.deepEqual(formsAt(0), ['sum'])
  assert.deepEqual(formsAt(FORM_UNLOCK.minus), ['sum', 'minus'])
  assert.deepEqual(formsAt(FORM_UNLOCK.times), ['sum', 'minus', 'times'])
  assert.deepEqual(formsAt(FORM_UNLOCK.over), ['sum', 'minus', 'times', 'over'])
  for (let d = 1; d < 60; d++) {
    for (const f of formsAt(d - 1)) assert.ok(formsAt(d).includes(f), `${f} was taken away at depth ${d}`)
  }
})

test('a sum starts at two polyps and opens to three', () => {
  assert.equal(sumSlotsAt(0), 2)
  assert.equal(sumSlotsAt(5), 2)
  assert.equal(sumSlotsAt(6), 3)
  assert.equal(sumSlotsAt(200), 3)
})

/**
 * The founder's `58042 + 968`. The ceiling exists so a target is never a number
 * three polyps cannot build; see the note on `DIFFICULTY_CAP` and the measurement
 * in `target.test.ts`.
 */
test('the difficulty request is capped, and the ceiling is never below the request', () => {
  for (let d = 0; d <= 300; d++) {
    const want = difficultyAt(d)
    const cap = maxDifficultyAt(d)
    assert.ok(want >= 1 && want <= DIFFICULTY_CAP, `depth ${d} asked for ${want}`)
    assert.ok(cap >= want, `depth ${d}: ceiling ${cap} below request ${want}`)
    assert.ok(cap <= DIFFICULTY_CAP)
  }
  assert.equal(difficultyAt(0), 1)
  assert.ok(difficultyAt(200) > difficultyAt(0), 'it still has to get harder')
})

test('the target size the score aims for climbs with depth and stops at four digits', () => {
  assert.equal(wantDigitsAt(0), 1)
  for (let d = 1; d < 200; d++) assert.ok(wantDigitsAt(d) >= wantDigitsAt(d - 1))
  assert.equal(wantDigitsAt(1000), 4)
})

/* ------------------------------------------------------------------ offline */

test('away time is paid in polyps, is capped, and never nags for a short absence', () => {
  assert.equal(offlineGrowth(0, 0), 0)
  assert.equal(offlineGrowth(OFFLINE_MIN_MS - 1, 0), 0)
  assert.ok(offlineGrowth(OFFLINE_MIN_MS, 0) >= 1)
  const eight = offlineGrowth(OFFLINE_CAP_MS, 0)
  const forty = offlineGrowth(OFFLINE_CAP_MS * 5, 0)
  assert.equal(eight, forty, 'past the cap, staying away longer must be worth nothing')
  // A gift, not a strategy: eight hours is about a shelf, not a shortcut.
  assert.ok(eight <= OFFLINE_MAX_POLYPS, `eight hours away paid ${eight} polyps, which is a shortcut`)
  assert.ok(offlineGrowth(OFFLINE_MIN_MS * 4, 0) < eight, 'a longer absence should still be worth more')
})

test('an operator target is asked BELOW the plain one, because its polyps are not its size', () => {
  for (let d = 0; d <= 200; d += 7) {
    assert.equal(difficultyFor(d, 'sum'), difficultyAt(d))
    assert.equal(difficultyFor(d, 'minus'), difficultyAt(d))
    assert.ok(difficultyFor(d, 'times') <= difficultyAt(d))
    assert.ok(difficultyFor(d, 'over') <= difficultyFor(d, 'times'))
    for (const f of ['sum', 'minus', 'times', 'over'] as const) {
      assert.ok(difficultyFor(d, f) >= 1, `${f} at depth ${d} asked for ${difficultyFor(d, f)}`)
      assert.ok(maxDifficultyFor(d, f) >= difficultyFor(d, f))
      assert.ok(maxDifficultyFor(d, f) <= DIFFICULTY_CAP)
    }
  }
  // The offsets have to be a real shift, or the rare forms go back to never
  // appearing — see FORM_RUNGS for the measurement.
  assert.ok(difficultyAt(200) - difficultyFor(200, 'over') >= 3)
})

test('a debt on the shelf is paid far faster than the reef ordinarily breathes', () => {
  for (let d = 0; d <= 120; d += 10) {
    assert.ok(STOCK_PERIOD_MS * 3 < emitPeriodMs(d), `depth ${d}: stocking is not fast enough to matter`)
  }
})
