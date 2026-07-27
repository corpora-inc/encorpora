import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  decompose,
  fmt,
  fmtCompact,
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

test('off-ladder and degenerate values are rejected', () => {
  for (const bad of [0, -4, 11, 13, 15, 17, 1.5, NaN, Infinity, 2 ** 40]) {
    assert.equal(onLadder(bad), false, `${bad} must not be a polyp value`)
  }
})

test('rank is strictly increasing up each strain and comparable across them', () => {
  for (let strain = 0; strain < SEEDS.length; strain++) {
    for (let step = 0; step < MAX_STEP; step++) {
      assert.ok(
        rank(valueOf(strain as Strain, step + 1)) > rank(valueOf(strain as Strain, step)),
        'rank must climb with the ladder',
      )
    }
  }
  // 96 (strain 1, step 5) and 128 (strain 0, step 7) should read as near peers
  assert.ok(Math.abs(rank(96) - rank(128)) <= 5)
})

test('silhouette is stable per strain, so shape never depends on colour', () => {
  assert.equal(silhouetteOf(1), silhouetteOf(1024))
  assert.equal(silhouetteOf(3), silhouetteOf(768))
  assert.notEqual(silhouetteOf(1), silhouetteOf(3))
  assert.notEqual(silhouetteOf(5), silhouetteOf(7))
})

test('fmt groups digits without touching a float or a locale', () => {
  assert.equal(fmt(0), '0')
  assert.equal(fmt(7), '7')
  assert.equal(fmt(1024), '1,024')
  assert.equal(fmt(917504), '917,504')
  assert.equal(fmt(1234567), '1,234,567')
})

test('fmtCompact only kicks in past five digits and never rounds up a magnitude', () => {
  assert.equal(fmtCompact(999), '999')
  assert.equal(fmtCompact(99999), '99,999')
  assert.equal(fmtCompact(100000), '100K')
  assert.equal(fmtCompact(123456), '123.4K')
  assert.equal(fmtCompact(999999), '999.9K')
  assert.equal(fmtCompact(1000000), '1M')
})

test('magnitude counts powers of ten crossed', () => {
  assert.equal(magnitude(0), 0)
  assert.equal(magnitude(9), 0)
  assert.equal(magnitude(10), 1)
  assert.equal(magnitude(99), 1)
  assert.equal(magnitude(100), 2)
  assert.equal(magnitude(1_000_000), 6)
})
