import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { Question } from '../contract.ts'
import { makeRng } from '../core/rng.ts'
import { createStubHost } from '../stubHost.ts'
import { heightAtX, LAUNCH_H } from './ballistics.ts'
import { shotFor, windValues } from './verdict.ts'
import {
  buildTower,
  LOFT_DEG,
  layoutTowerValues,
  pullQuestions,
  ramAdvances,
  shatter,
  stepBlocks,
  wallFor,
  waveConfig,
  WIND_FROM_D,
  WIND_MAX,
  windCapFor,
  type Phase,
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

test('a rejected answer is reported with the rung it came from', () => {
  // `seen` is how the game finds a rung whose answers fit on the field, and the
  // difficulty beside each answer is what stops it steering on the stale contents
  // of a pool that has not turned over yet. An answer without its rung is a
  // rejection the game cannot act on — which is how a blank plaque and a dead fire
  // button survived for a whole release.
  let n = 0
  const stream = (answer: number, difficulty: number): Question => {
    n++
    return {
      id: `q${n}`,
      prompt: `? = ${answer}`,
      answer: String(answer),
      distractors: [],
      domain: 'add-sub',
      difficulty,
    }
  }
  // Four answers far below the field, served off rung 0.04.
  const low = pullQuestions(() => stream(3, 0.04), 2, MIN_GAP, 14, 118, 4)
  assert.equal(low.boulders.length, 0, 'a difference within ten cannot stand on the field')
  assert.equal(low.seen.length, 4, 'the rejections were thrown away')
  for (const s of low.seen) {
    assert.equal(s.answer, 3)
    assert.equal(s.difficulty, 0.04, 'the rung that produced the answer was lost')
  }

  // And an answer that fits is kept, with the draw bounded by `maxPulls`.
  const ok = pullQuestions(() => stream(20 + n * 9, 0.5), 2, MIN_GAP, 14, 118, 8)
  assert.equal(ok.boulders.length, 2)
  assert.ok(ok.seen.length <= 8, `the draw ran past maxPulls: ${ok.seen.length}`)
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
  }
  // the first two waves are deliberately bare: one idea at a time
  for (const w of [1, 2]) {
    const c = waveConfig(w)
    assert.equal(c.wall, false)
    assert.equal(c.ram, false)
    assert.equal(c.banners, true)
  }
  assert.equal(waveConfig(5).volley, true, 'every fifth wave is a volley')
  assert.ok(waveConfig(7).ram, 'the ram arrives at wave 7')
})

test('the wave number cannot start the wind blowing — only the ladder can', () => {
  // The founder's complaint about the wind was that it was pointless; the fix for
  // that is a second arithmetic step, and a second arithmetic step handed out on a
  // TIMER is worse than a pointless one. `waveConfig` no longer has a `wind` field
  // to read, which is what makes this a compile-time fact and not a convention:
  // there is nowhere left for a wave counter to say how hard the wind blows.
  const cfg = waveConfig(20) as Record<string, unknown>
  assert.equal('wind' in cfg, false, 'the wave still decides the wind')
  assert.equal('gusty' in cfg, false, 'the wave still decides whether the wind rerolls')
  assert.equal('loft' in cfg, false, 'the wave still unlocks a lever that no longer exists')
})

test('the wind arrives on the ladder, above the facts and the no-regroup columns', () => {
  // Measured over the shipped 66-rung ladder: every rung whose answers a 122-metre
  // field can stand a keep at, and what arithmetic it is. The threshold sits above
  // the last of the easy ones on purpose — a child still on tables or on column sums
  // with no regrouping is meeting this game for the first time and gets the game
  // that has no wind in it at all.
  const beginner = [
    { d: 0.246, what: 'tables-to-twelve L0' },
    { d: 0.277, what: 'add.column.add-no-regroup L0' },
    { d: 0.292, what: 'add.column.subtract-no-regroup L0' },
    { d: 0.323, what: 'tables-to-twelve L1' },
  ]
  for (const rung of beginner) {
    assert.equal(windCapFor(rung.d), 0, `${rung.what} (d=${String(rung.d)}) must have no wind`)
  }
  const higher = [
    { d: 0.369, what: 'add.column.subtract-no-regroup L1' },
    { d: 0.415, what: 'tables-to-twelve L2' },
    { d: 0.462, what: 'add.regroup.add-multidigit L0' },
    { d: 0.492, what: 'add.regroup.subtract-multidigit L0' },
  ]
  for (const rung of higher) {
    assert.ok(windCapFor(rung.d) >= 3, `${rung.what} (d=${String(rung.d)}) must have a wind`)
  }
})

test('the wind is never 1, never past WIND_MAX, and never shrinks with difficulty', () => {
  // A wind of 1 metre is not arithmetic: a child can nudge the dial one notch and
  // watch. And the dial only carries WIND_MAX of slack past the field, so a cap
  // above it would ask for a compensation she cannot enter.
  let prev = 0
  for (let d = 0; d <= 1.0001; d += 0.002) {
    const cap = windCapFor(d)
    assert.ok(cap === 0 || cap >= 3, `d=${d.toFixed(3)} gives a cap of ${String(cap)}`)
    assert.ok(cap <= WIND_MAX, `d=${d.toFixed(3)} gives a cap of ${String(cap)}`)
    assert.ok(cap >= prev, `the wind dropped at d=${d.toFixed(3)}`)
    prev = cap
  }
  assert.equal(windCapFor(WIND_FROM_D - 0.001), 0, 'just below the threshold, no wind')
  assert.equal(windCapFor(WIND_FROM_D), 3, 'at the threshold, three metres')
  assert.equal(windCapFor(1), WIND_MAX, 'at the top of the ladder, the strongest wind')
  // A difficulty that is not a number must not become a wind.
  assert.equal(windCapFor(Number.NaN), 0, 'NaN is not a difficulty')
})

test('the ram does not roll while the child is working the sum out', () => {
  // The how-to-play panel promises "there is no clock, nothing happens until you
  // fire", and EXPERIENCE_DESIGN.md does not budget comprehension at all. Those
  // are the two phases in which the child is reading and dialling.
  assert.equal(ramAdvances('stocking'), false, 'there is not even a question yet')
  assert.equal(ramAdvances('intro'), false, 'the wave has only just been laid out')
  assert.equal(ramAdvances('aim'), false, 'she is working it out')
  assert.equal(ramAdvances('impact'), false, 'the hit-stop holds everything still')
  // ...and it must still be a threat once a boulder is in the air.
  for (const phase of ['windup', 'flight', 'settle', 'clear'] as Phase[]) {
    assert.equal(ramAdvances(phase), true, `${phase} is the world in motion`)
  }
})

test('the wall can never stand between a child and a keep she named correctly', () => {
  // It may never block a correct shot — and a correct shot in a tailwind is
  // launched at `answer - wind`, which flies lower than the same shot in still
  // air, so still air is not the case to size the wall against.
  //
  // The wall used to have a second job: be tall enough that the FLATTEST loft
  // could not clear it, so the loft lever had a reason to exist. The lever is gone
  // (see `LOFT_DEG`) and so is that bound.
  let walls = 0
  let worstMargin = Infinity
  for (let w = 1; w <= 40; w++) {
    const cfg = waveConfig(w)
    if (!cfg.wall) continue
    for (const cap of [0, 3, 5, 7, WIND_MAX]) {
      for (let nearest = 14; nearest <= 118; nearest += 3) {
        const wall = wallFor(nearest, cap)
        walls++
        assert.ok(wall.x < nearest, `wave ${w}: the wall stands on the keep at ${nearest}`)
        for (const wind of cap ? windValues(cap) : [0]) {
          // The shot a child who got it right actually fires: dial the answer less
          // the wind, and let the wind carry it home.
          const opened = shotFor(nearest - wind, LOFT_DEG, wind, LAUNCH_H)
          const margin = heightAtX(opened, wall.x) - wall.h
          worstMargin = Math.min(worstMargin, margin)
          assert.ok(
            margin > 0,
            `wave ${w}, keep ${nearest}, wind ${wind}, cap ${cap}: a correct shot cannot clear a ` +
              `${wall.h.toFixed(1)} m wall (margin ${margin.toFixed(2)} m)`,
          )
        }
      }
    }
  }
  assert.ok(walls > 500, `only ${walls} walls were measured`)
  assert.ok(worstMargin > 0.3, `the worst clearance is only ${worstMargin.toFixed(2)} m`)
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
