import assert from 'node:assert/strict'
import { test } from 'node:test'

import { makeRng } from '../core/rng.ts'
import { createStubHost } from '../stubHost.ts'
import {
  buildTower,
  layoutTowerValues,
  pullQuestions,
  ramAdvances,
  shatter,
  stepBlocks,
  waveConfig,
} from './world.ts'

const MIN_GAP = 8

test('no two keeps can ever occupy the same ground', () => {
  const rng = makeRng(7)
  for (let trial = 0; trial < 400; trial++) {
    const answers = [rng.int(14, 118)]
    while (answers.length < 3) {
      const v = rng.int(14, 118)
      if (answers.every((a) => Math.abs(a - v) >= MIN_GAP)) answers.push(v)
    }
    const pools = answers.map((a) => [a + 4, a - 9, a + 11, a - 20])
    const vals = layoutTowerValues(answers, pools, 3, MIN_GAP, 14, 118, rng)
    assert.equal(vals.length, answers.length + 3)
    for (let i = 1; i < vals.length; i++) {
      assert.ok(vals[i] - vals[i - 1] >= MIN_GAP, `${vals[i - 1]} and ${vals[i]} overlap`)
    }
    for (const a of answers) assert.ok(vals.includes(a), 'every answer must have a keep to stand on')
    for (const v of vals) assert.ok(Number.isInteger(v) && v >= 14 && v <= 118)
  }
})

test('a wave never hands you two boulders whose keeps would overlap', () => {
  const host = createStubHost({ seed: 31337 })
  for (let w = 1; w <= 40; w++) {
    const cfg = waveConfig(w)
    host.setDifficulty(cfg.difficulty)
    host.setDistractorCount(Math.max(2, cfg.extraTowers + 1))
    const { boulders } = pullQuestions(() => host.next(), cfg.ammo, MIN_GAP, 14, 118)
    assert.equal(boulders.length, cfg.ammo, `wave ${w} could not fill the rack`)
    for (let i = 0; i < boulders.length; i++) {
      for (let j = i + 1; j < boulders.length; j++) {
        assert.ok(Math.abs(boulders[i].answer - boulders[j].answer) >= MIN_GAP)
      }
    }
  }
})

test('escalation is monotonic where it should be and bounded everywhere', () => {
  let prevDiff = -1
  for (let w = 1; w <= 60; w++) {
    const c = waveConfig(w)
    assert.ok(c.difficulty >= prevDiff, 'difficulty never goes backwards')
    assert.ok(c.difficulty <= 0.95)
    prevDiff = c.difficulty
    assert.ok(c.ammo >= 2 && c.ammo <= 6)
    assert.ok(c.extraTowers >= 1 && c.extraTowers <= 3)
    assert.ok(c.wind >= 0 && c.wind <= 9)
  }
  // the first two waves are deliberately bare: one idea at a time
  for (const w of [1, 2]) {
    const c = waveConfig(w)
    assert.equal(c.wind, 0)
    assert.equal(c.loft, false)
    assert.equal(c.wall, false)
    assert.equal(c.ram, false)
    assert.equal(c.banners, true)
  }
  assert.ok(waveConfig(3).wind > 0, 'wind arrives at wave 3')
  assert.equal(waveConfig(4).loft, true, 'the loft lever arrives at wave 4')
  assert.equal(waveConfig(5).volley, true, 'every fifth wave is a volley')
  assert.ok(waveConfig(7).ram, 'the ram arrives at wave 7')
})

test('the ram does not roll while the child is working the sum out', () => {
  // The how-to-play panel promises "there is no clock, nothing happens until you
  // fire", and EXPERIENCE_DESIGN.md does not budget comprehension at all. Those
  // are the two phases in which the child is reading and dialling.
  assert.equal(ramAdvances('intro'), false, 'the wave has only just been laid out')
  assert.equal(ramAdvances('aim'), false, 'she is working it out')
  assert.equal(ramAdvances('impact'), false, 'the hit-stop holds everything still')
  // ...and it must still be a threat once a boulder is in the air.
  for (const phase of ['windup', 'flight', 'settle', 'clear']) {
    assert.equal(ramAdvances(phase), true, `${phase} is the world in motion`)
  }
})

test('a struck keep comes apart and then settles — no perpetual motion', () => {
  const rng = makeRng(3)
  const t = buildTower(0, 60, rng)
  const before = t.blocks.length
  const freed = shatter(t, 66, 1, 1.5, rng)
  assert.ok(freed > 0, 'a direct hit must free blocks')
  assert.equal(t.blocks.length, before, 'blocks are never allocated during play')
  let steps = 0
  while (stepBlocks(t, 1 / 60) && steps < 60 * 30) steps++
  assert.ok(steps < 60 * 30, 'the rubble must come to rest')
  for (const b of t.blocks) {
    if (!b.loose) continue
    assert.ok(b.y >= 0, 'nothing falls through the world')
    assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y))
  }
})

test('a graze frees fewer blocks than a direct hit', () => {
  const rng = makeRng(11)
  const a = buildTower(0, 60, makeRng(5))
  const b = buildTower(0, 60, makeRng(5))
  const hard = shatter(a, 66, 1, 1.5, rng)
  const soft = shatter(b, 63, 0.2, 0.32, rng)
  assert.ok(hard > soft, `direct=${hard} graze=${soft}`)
})
