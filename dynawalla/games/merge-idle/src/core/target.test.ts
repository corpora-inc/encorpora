/**
 * THE TARGET MUST BE BUILDABLE. That is the whole point of the redesign, and
 * these are the tests that hold it.
 *
 * The founder's diagnosis, verbatim: "the problems don't line up with the polyp
 * numbers ... the weird 58134+483 doesn't really jive with the polyps ... 'some
 * answers are not numbers a polyp can have' ... maybe that is a design mistake".
 */

import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { onLadder } from './ladder.ts'
import { makeRng } from './rng.ts'
import {
  bagOf,
  candidates,
  evaluate,
  expressible,
  faceOf,
  formsFor,
  funScore,
  ladderRoute,
  ladderValues,
  pickCandidate,
  routeIn,
  slotsFor,
  stockFor,
  type Form,
} from './target.ts'

const ALL: Form[] = ['sum', 'minus', 'times', 'over']

/* --------------------------------------------------------- the reach itself */

test('routeIn finds only routes the board can actually pay for', () => {
  const bag = bagOf([16, 7, 4])
  assert.deepEqual(routeIn(bag, 23, 'sum', 3), [16, 7])
  assert.deepEqual(routeIn(bag, 27, 'sum', 3), [16, 7, 4])
  // 32 would need two 16s and the board has one.
  assert.equal(routeIn(bag, 32, 'sum', 3), null)
  // ...and with two, it is found.
  assert.deepEqual(routeIn(bagOf([16, 16]), 32, 'sum', 2), [16, 16])
})

test('routeIn respects the slot limit — a three-polyp answer is refused at two slots', () => {
  const bag = bagOf([20, 10, 5])
  assert.deepEqual(routeIn(bag, 35, 'sum', 3), [20, 10, 5])
  assert.equal(routeIn(bag, 35, 'sum', 2), null)
})

test('the non-commutative forms come back in the order the mouth wants them', () => {
  assert.deepEqual(routeIn(bagOf([30, 2]), 15, 'over', 2), [30, 2])
  assert.deepEqual(routeIn(bagOf([16, 1]), 15, 'minus', 2), [16, 1])
  assert.deepEqual(routeIn(bagOf([6, 8]), 48, 'times', 2), [8, 6])
})

test('evaluate is the mouth’s arithmetic and nothing else', () => {
  assert.equal(evaluate([16, 2], 'sum'), 18)
  assert.equal(evaluate([20, 10, 5], 'sum'), 35)
  assert.equal(evaluate([30, 2], 'over'), 15)
  assert.equal(evaluate([16, 1], 'minus'), 15)
  assert.equal(evaluate([6, 8], 'times'), 48)
  // A division that does not divide is NOT quietly floored. The mouth reports
  // what the child produced and the host judges it.
  assert.equal(evaluate([30, 4], 'over'), null)
  assert.equal(evaluate([2, 30], 'over'), null)
})

/* ------------------------------------------------- the buildability measure */

/**
 * The number that justifies eight strains.
 *
 * `core/ladder.ts` cites 100% of 1..2000 and a fall-off above it, and
 * `core/economy.ts` sets `DIFFICULTY_CAP` from those numbers. If the seed set
 * ever changes, this is the test that notices the citation has gone stale.
 */
test('every integer 1..2000 is expressible as a sum of at most three polyps', () => {
  const holes: number[] = []
  for (let n = 1; n <= 2000; n++) {
    if (!expressible(n, 'sum', 3)) holes.push(n)
  }
  assert.deepEqual(holes.slice(0, 12), [], `${holes.length} unbuildable targets below 2000`)
})

test('the fall-off above 2000 is real, and reported so the cap can be checked', () => {
  const band = (lo: number, hi: number): number => {
    let ok = 0
    for (let n = lo; n <= hi; n++) if (expressible(n, 'sum', 3)) ok++
    return (100 * ok) / (hi - lo + 1)
  }
  const a = band(2001, 5000)
  const b = band(5001, 10000)
  console.log(`   sum/3 reachability: 2k..5k ${a.toFixed(1)}%  5k..10k ${b.toFixed(1)}%`)
  // The shape the cap is chosen from: still high just above the cap, and
  // materially worse a band later.
  assert.ok(a > 90, `2k..5k was ${a.toFixed(1)}%`)
  assert.ok(b < a - 10, `5k..10k (${b.toFixed(1)}%) should be clearly worse than ${a.toFixed(1)}%`)
})

test('ladderRoute never returns a route with an off-ladder term', () => {
  const rng = makeRng(9)
  for (let i = 0; i < 3000; i++) {
    const n = rng.int(2, 4000)
    for (const form of ALL) {
      const route = ladderRoute(n, form, slotsFor(form, 3))
      if (!route) continue
      for (const v of route) assert.ok(onLadder(v), `${form} route for ${n} used ${v}`)
      assert.equal(evaluate(route, form), n, `${form} route for ${n} does not evaluate to it`)
    }
  }
})

test('expressible and ladderRoute agree, always — ask.ts trusts that they do', () => {
  const rng = makeRng(31)
  for (let i = 0; i < 2000; i++) {
    const n = rng.int(2, 3000)
    for (const form of ALL) {
      const slots = slotsFor(form, 3)
      assert.equal(expressible(n, form, slots), ladderRoute(n, form, slots) !== null)
    }
  }
})

test('formsFor only ever offers a form the number can express', () => {
  // 17's odd part is past the seeds, so it is no polyp — but it is a difference
  // and it is a sum of three, and it is NOT a product of two polyps.
  const forms = formsFor(17, ALL, 3)
  assert.ok(forms.includes('sum'))
  assert.ok(forms.includes('minus'))
  assert.equal(forms.includes('times'), false, '17 is prime and past the seeds')
  for (const f of forms) assert.ok(expressible(17, f, slotsFor(f, 3)))
})

test('an unlocked form is an offer, never a demand', () => {
  // Only the forms actually passed in can come back, whatever the number admits.
  assert.deepEqual(formsFor(48, ['sum'], 3), ['sum'])
})

/* -------------------------------------------------------------- the stocking */

test('stockFor asks for HALVES, so a missing term arrives as a merge to do', () => {
  // The shelf has nothing. 18 = 16 + 2, and neither is there.
  assert.deepEqual(stockFor(bagOf([]), [16, 2]), [8, 8, 1, 1])
  // A seed cannot be halved, so it comes whole.
  assert.deepEqual(stockFor(bagOf([]), [15]), [15])
  // Anything already on the shelf is not asked for twice.
  assert.deepEqual(stockFor(bagOf([16]), [16, 2]), [1, 1])
  // ...and two of a term needs two of it on the shelf.
  assert.deepEqual(stockFor(bagOf([16]), [16, 16]), [8, 8])
})

test('a stocked route becomes buildable once the stock has landed', () => {
  const rng = makeRng(77)
  for (let i = 0; i < 500; i++) {
    const n = rng.int(2, 2000)
    const route = ladderRoute(n, 'sum', 3)
    assert.ok(route, `${n} should be expressible`)
    const stock = stockFor(bagOf([]), route)
    // The child merges every pair of halves back up; what is left is the route.
    const bag = bagOf([...route])
    assert.ok(routeIn(bag, n, 'sum', 3), `${n} not buildable from its own route`)
    // And every stocked value is itself a legal polyp.
    for (const v of stock) assert.ok(onLadder(v), `stocked ${v} is off the ladder`)
  }
})

/* -------------------------------------------------------------- the candidates */

test('candidates only ever proposes numbers the board can pay for right now', () => {
  const rng = makeRng(4242)
  for (let i = 0; i < 300; i++) {
    const values: number[] = []
    const ladder = ladderValues().filter((v) => v <= 2048)
    for (let k = 0; k < rng.int(3, 18); k++) values.push(rng.pick(ladder))
    const bag = bagOf(values)
    for (const list of [candidates(bag, ['sum'], 2, 2), candidates(bag, ALL, 3, 2)]) {
      for (const c of list) {
        assert.equal(evaluate(c.route, c.form), c.value, `${c.value} route does not evaluate`)
        assert.ok(
          routeIn(bag, c.value, c.form, slotsFor(c.form, 3)),
          `candidate ${c.value} (${c.form}) is not on this board`,
        )
      }
    }
  }
})

test('candidates is a pure function of the board, and caps at 32 for host.focus', () => {
  const values = ladderValues().filter((v) => v <= 512)
  const bag = bagOf(values)
  const a = candidates(bag, ALL, 3, 2)
  const b = candidates(bag, ALL, 3, 2)
  assert.deepEqual(a, b)
  assert.ok(a.length <= 32, `focus takes 32 values, got ${a.length}`)
})

test('funScore prefers a real question to a hand-over', () => {
  // A target one polyp already satisfies needs no arithmetic at all.
  assert.ok(funScore(16, 3, false, 2) > funScore(16, 3, true, 2))
  // Round numbers read as deliberate.
  assert.ok(funScore(35, 3, false, 2) > funScore(37, 3, false, 2))
  // ...and the size the curriculum asked for wins over both.
  assert.ok(funScore(35, 3, false, 2) > funScore(3500, 3, false, 2))
})

test('pickCandidate is deterministic given the rng, and refuses an empty list', () => {
  const bag = bagOf([1, 2, 4, 8, 16])
  const list = candidates(bag, ['sum'], 3, 2)
  assert.equal(pickCandidate([], makeRng(1)), null)
  assert.deepEqual(pickCandidate(list, makeRng(5)), pickCandidate(list, makeRng(5)))
})

test('faceOf shows a bare number for a sum and the blanks for the rest', () => {
  assert.equal(faceOf(18, 'sum'), '18')
  assert.equal(faceOf(15, 'over'), '15 = ▢ ÷ ▢')
  assert.equal(faceOf(48, 'times'), '48 = ▢ × ▢')
  assert.equal(faceOf(15, 'minus'), '15 = ▢ − ▢')
})
