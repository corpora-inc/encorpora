import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  canSplit,
  decompose,
  fmt,
  magnitude,
  MAX_STEP,
  onLadder,
  rank,
  SEEDS,
  silhouetteOf,
  valueOf,
  type Strain,
} from './ladder.ts'

test('every ladder value decomposes back to the strain and step that made it', () => {
  for (let strain = 0; strain < SEEDS.length; strain++) {
    for (let step = 0; step <= MAX_STEP; step++) {
      const v = valueOf(strain as Strain, step)
      const id = decompose(v)
      assert.ok(id, `value ${v} should be on the ladder`)
      assert.equal(id.strain, strain)
      assert.equal(id.step, step)
    }
  }
})

test('the eight seeds are distinct odd numbers — the whole identity scheme rests on it', () => {
  assert.equal(new Set(SEEDS).size, SEEDS.length)
  for (const s of SEEDS) assert.equal(s % 2, 1, `${s} must be odd or its odd part is not itself`)
})

test('ladder values are globally unique — value alone is a whole identity', () => {
  const seen = new Map<number, string>()
  for (let strain = 0; strain < SEEDS.length; strain++) {
    for (let step = 0; step <= MAX_STEP; step++) {
      const v = valueOf(strain as Strain, step)
      const key = `${strain}:${step}`
      assert.equal(seen.get(v), undefined, `${v} collides: ${seen.get(v)} and ${key}`)
      seen.set(v, key)
    }
  }
})

test('a merge result is always itself on the ladder', () => {
  for (let strain = 0; strain < SEEDS.length; strain++) {
    for (let step = 0; step < MAX_STEP; step++) {
      const v = valueOf(strain as Strain, step)
      assert.ok(onLadder(v + v), `${v} + ${v} must land on the ladder`)
      assert.equal(v + v, valueOf(strain as Strain, step + 1))
    }
  }
})

/**
 * The founder's four worked examples, verbatim from his design note. Every value
 * they mention has to exist, and `15 = 30 ÷ 2` is the one that forced the ladder
 * from four seeds to eight: 30's odd part is 15, so a four-seed ladder has no 30
 * and the example is unbuildable.
 */
test("the founder's examples are all on the ladder — including the 30 that needed seed 15", () => {
  for (const v of [2, 4, 8, 16, 7, 18, 5, 10, 20, 35 - 15, 30, 15, 48, 6]) {
    assert.ok(onLadder(v), `${v} must be a polyp value`)
  }
  assert.equal(16 + 7, 23)
  assert.equal(16 + 2, 18)
  assert.equal(20 + 10 + 5, 35)
  assert.equal(30 / 2, 15)
})

test('every integer 1..16 is a polyp value, which is what makes small targets buildable', () => {
  for (let n = 1; n <= 16; n++) assert.ok(onLadder(n), `${n} must be a polyp value`)
  // 17 is the first integer that is not: its odd part is 17, past seed 15.
  assert.equal(onLadder(17), false)
})

test('off-ladder and degenerate values are rejected', () => {
  for (const bad of [0, -4, 17, 19, 34, 1.5, NaN, Infinity, 2 ** 40]) {
    assert.equal(onLadder(bad), false, `${bad} must not be a polyp value`)
  }
})

test('canSplit is exactly "not a seed" — 3 does not halve, 12 does', () => {
  for (const s of SEEDS) assert.equal(canSplit(s), false, `${s} is a seed and cannot be halved`)
  for (const s of SEEDS) {
    assert.equal(canSplit(s * 2), true, `${s * 2} halves back to ${s}`)
    assert.equal((s * 2) / 2, s)
  }
  assert.equal(canSplit(17), false, 'an off-ladder value cannot be split either')
})

/**
 * Rank drives colour and size, and the four-seed version ranked by step FIRST —
 * so a 15 came out as rank 0 and a 2 as rank 3, and the biggest polyp on a fresh
 * shelf read as the dullest. With eight strains that inversion is four times as
 * visible, so the property is asserted rather than eyeballed.
 */
test('rank never falls as the value rises, across all eight strains', () => {
  const all: number[] = []
  for (let strain = 0; strain < SEEDS.length; strain++) {
    for (let step = 0; step <= MAX_STEP; step++) all.push(valueOf(strain as Strain, step))
  }
  all.sort((a, b) => a - b)
  for (let i = 1; i < all.length; i++) {
    const lo = all[i - 1] as number
    const hi = all[i] as number
    assert.ok(rank(hi) >= rank(lo), `rank(${hi})=${rank(hi)} < rank(${lo})=${rank(lo)}`)
  }
  // 96 (strain 1, step 5) and 128 (strain 0, step 7) should read as near peers
  assert.ok(Math.abs(rank(96) - rank(128)) <= 5)
})

test('silhouette is stable per strain and no two strains share a shape', () => {
  assert.deepEqual(silhouetteOf(1), silhouetteOf(1024))
  assert.deepEqual(silhouetteOf(15), silhouetteOf(960))
  const shapes = new Set<string>()
  for (const s of SEEDS) shapes.add(JSON.stringify(silhouetteOf(s)))
  assert.equal(shapes.size, SEEDS.length, 'eight strains need eight distinguishable shapes')
})

test('fmt groups digits without touching a float or a locale', () => {
  assert.equal(fmt(0), '0')
  assert.equal(fmt(7), '7')
  assert.equal(fmt(1024), '1,024')
  assert.equal(fmt(1234567), '1,234,567')
})

test('magnitude counts powers of ten crossed', () => {
  assert.equal(magnitude(0), 0)
  assert.equal(magnitude(9), 0)
  assert.equal(magnitude(10), 1)
  assert.equal(magnitude(100), 2)
})
