import assert from "node:assert/strict"
import test from "node:test"

import { Rng } from "../core/rng.ts"
import {
  MAX_PLACE,
  breakAt,
  breaksNeeded,
  canBreak,
  canonical,
  coilOf,
  fuseOnce,
  isCanonical,
  linkValue,
  suffixValue,
  suffixValues,
  valueOf,
} from "./place.ts"

/** Seeded inside the file: no test in this package touches `Math.random`. */
const SEED = 0x0c011960

test("a link is an exact power of ten, at every place the game can reach", () => {
  for (let p = 0; p <= MAX_PLACE; p++) {
    const v = linkValue(p)
    assert.ok(Number.isSafeInteger(v), `10^${String(p)} is exact`)
    assert.equal(String(v), `1${"0".repeat(p)}`)
  }
  assert.throws(() => linkValue(-1), RangeError)
  assert.throws(() => linkValue(MAX_PLACE + 1), RangeError)
  assert.throws(() => linkValue(1.5), RangeError)
})

test("a coil is the numeral: 72 is seven tens and two ones", () => {
  assert.deepEqual(coilOf(72), [1, 1, 1, 1, 1, 1, 1, 0, 0])
  assert.deepEqual(coilOf(0), [])
  assert.deepEqual(coilOf(5), [0, 0, 0, 0, 0])
  // A zero digit is the *absence* of a link, which is what makes borrowing
  // across a zero a physical fact rather than a rule about digits.
  assert.deepEqual(coilOf(403), [2, 2, 2, 2, 0, 0, 0])
  assert.equal(coilOf(403).filter((p) => p === 1).length, 0)
})

test("coilOf round-trips through valueOf for a wide sweep", () => {
  const rng = new Rng(SEED)
  for (let i = 0; i < 400; i++) {
    const v = rng.int(0, 999_999)
    assert.equal(valueOf(coilOf(v)), v)
  }
})

test("coilOf refuses anything that is not a whole number", () => {
  assert.throws(() => coilOf(-1), RangeError)
  assert.throws(() => coilOf(1.5), RangeError)
  assert.throws(() => coilOf(Number.NaN), RangeError)
})

test("breaking preserves the coil's value, exactly", () => {
  const rng = new Rng(SEED ^ 0x11)
  for (let i = 0; i < 200; i++) {
    const value = rng.int(1, 99_999)
    let links = coilOf(value)
    for (let k = 0; k < 6; k++) {
      const at = rng.int(0, links.length - 1)
      if (!canBreak(links, at)) continue
      links = breakAt(links, at)
      assert.equal(valueOf(links), value)
    }
  }
})

test("breaking adds exactly nine links and leaves the ten in place", () => {
  const links = coilOf(72)
  const broken = breakAt(links, 4)
  assert.equal(broken.length, links.length + 9)
  assert.deepEqual(broken.slice(0, 4), [1, 1, 1, 1])
  assert.deepEqual(broken.slice(4, 14), Array.from({ length: 10 }, () => 0))
  assert.deepEqual(broken.slice(14), [1, 1, 0, 0])
})

test("breaking at the cut never changes what the cut is worth", () => {
  // This is the property the whole interaction rests on: a child cracks a link
  // open to get finer resolution, not to change the amount they are holding.
  const rng = new Rng(SEED ^ 0x22)
  for (let i = 0; i < 200; i++) {
    let links = coilOf(rng.int(10, 99_999))
    for (let k = 0; k < 5; k++) {
      const cut = rng.int(0, links.length - 1)
      if (!canBreak(links, cut)) continue
      const before = suffixValue(links, cut)
      links = breakAt(links, cut)
      assert.equal(suffixValue(links, cut), before)
    }
  }
})

test("a bead cannot be cracked open", () => {
  const links = coilOf(5)
  assert.equal(canBreak(links, 0), false)
  assert.deepEqual(breakAt(links, 0), links)
  assert.equal(canBreak(links, 99), false)
})

test("fuse is the inverse of break, and it is the carry", () => {
  const links = coilOf(72)
  const broken = breakAt(links, 4)
  const fused = fuseOnce(broken)
  assert.notEqual(fused, null)
  assert.deepEqual(fused, links)
  assert.equal(fuseOnce(links), null)
})

test("fusing twelve ones onto sixty makes a numeral again", () => {
  // 47 welded to 25: six tens and twelve ones, which is not how a number is
  // written. Fusing until it no longer applies is the carry, and it lands on 72.
  const welded = [...coilOf(40), ...coilOf(7), ...coilOf(20), ...coilOf(5)]
  assert.equal(valueOf(welded), 72)
  let chain = welded.slice()
  for (let guard = 0; guard < 20; guard++) {
    const next = fuseOnce(chain)
    if (!next) break
    chain = next
  }
  assert.equal(valueOf(chain), 72)
  assert.deepEqual(canonical(chain), coilOf(72))
})

test("canonical form is the numeral, and a fresh coil is already in it", () => {
  assert.equal(isCanonical(coilOf(4_003)), true)
  assert.equal(isCanonical(breakAt(coilOf(4_003), 0)), false)
  assert.deepEqual(canonical(breakAt(coilOf(4_003), 0)), coilOf(4_003))
})

test("suffixValues agrees with suffixValue at every joint", () => {
  const rng = new Rng(SEED ^ 0x33)
  const links = breakAt(breakAt(coilOf(rng.int(1_000, 9_999)), 0), 3)
  const table = suffixValues(links)
  assert.equal(table.length, links.length + 1)
  assert.equal(table[links.length], 0)
  for (let i = 0; i <= links.length; i++) assert.equal(table[i], suffixValue(links, i))
})

test("72 − 25: the demand costs exactly one break, and it is reachable", () => {
  const links = coilOf(72)
  // Twenty-five is not a suffix of seven tens and two ones. There is no cut.
  assert.equal(suffixValues(links).includes(25), false)
  assert.equal(breaksNeeded(links, 25), 1)

  // Crack the ten at the boundary and walk the cut back through the ones.
  const broken = breakAt(links, 4)
  const table = suffixValues(broken)
  const cut = table.indexOf(25)
  assert.ok(cut > 0, "twenty-five is now a cut")
  assert.equal(suffixValue(broken, cut), 25)
  // What crawls on is the answer, and nobody subtracted anything.
  assert.equal(valueOf(broken.slice(0, cut)), 47)
})

test("the change a demand costs is one break per place it has to reach down", () => {
  const cases: [number, number, number][] = [
    // Nothing to reach for: the demand is already the tail of the chain.
    [72, 72, 0],
    [403, 3, 0],
    [9_999, 999, 0],
    // One ten cracked open to make ones.
    [72, 25, 1],
    [93, 47, 1],
    // No column of `64 − 31` regroups, and the cut still needs change: three
    // tens and one one cannot be the end of a chain ending in four ones.
    [64, 31, 1],
    // Reaching from a hundred, or a thousand, down to a single one.
    [500, 1, 2],
    [1_000, 1, 3],
    // Borrowing across a zero, physically: the tens link does not exist.
    [403, 87, 2],
    [4_003, 87, 3],
    [400_300, 87, 2],
  ]
  for (const [whole, part, expected] of cases) {
    assert.equal(breaksNeeded(coilOf(whole), part), expected, `${String(whole)} − ${String(part)}`)
  }
})

test("a demand the coil cannot cover has no cut at all", () => {
  assert.equal(breaksNeeded(coilOf(72), 73), -1)
  assert.equal(breaksNeeded(coilOf(72), -1), -1)
  assert.equal(breaksNeeded([], 1), -1)
})

test("every demand is reachable, and the search always terminates", () => {
  const rng = new Rng(SEED ^ 0x44)
  for (let i = 0; i < 500; i++) {
    const whole = rng.int(1, 99_999)
    const part = rng.int(0, whole)
    const links = coilOf(whole)
    const breaks = breaksNeeded(links, part)
    assert.ok(breaks >= 0, `${String(part)} out of ${String(whole)} is reachable`)

    // Replay the breaks the count promises and check the cut really exists.
    let chain = links
    for (let k = 0; k < breaks; k++) {
      let taken = 0
      let j = chain.length - 1
      while (j >= 0 && taken + linkValue(chain[j] as number) <= part) {
        taken += linkValue(chain[j] as number)
        j--
      }
      chain = breakAt(chain, j)
    }
    assert.ok(suffixValues(chain).includes(part), "the cut exists after the breaks")
    assert.equal(valueOf(chain), whole)
  }
})
