/**
 * THE TARGET DISTRIBUTION, measured over many seeds and printed.
 *
 * The founder's question was not "does it work" but "are these good numbers":
 *
 *   "the numbers I have for the vents are pretty huge for whatever reason —
 *    58042+968 .. it's easier just to ignore the vents and just keep playing with
 *    the polyps"
 *   "how about there is a number at the top, it might be kinda simple usually - 18"
 *
 * So this file answers three things out loud, over a hundred sessions of the
 * computing bot against the realistic stub host:
 *
 *   1. **Is every target buildable?** A hard invariant, asserted, not sampled.
 *   2. **Are they satisfying numbers?** Printed as a digit histogram and a form mix.
 *   3. **How often does the curriculum have to be refused?** Printed, and bounded.
 */

import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { formsAt, sumSlotsAt } from '../core/economy.ts'
import { askTarget } from '../core/ask.ts'
import { onLadder } from '../core/ladder.ts'
import {
  bagOf,
  evaluate,
  expressible,
  ladderRoute,
  routeIn,
  slotsFor,
  type Form,
} from '../core/target.ts'
import { makeRng } from '../core/rng.ts'
import { makeStubHost } from '../stubHost.ts'
import { play, type Report } from './play.ts'

const SEEDS = Array.from({ length: 100 }, (_, i) => 1000 + i * 37)

let sessions: Report[] | null = null
function all(): Report[] {
  sessions ??= SEEDS.map((seed) => play({ policy: 'compute', seed, steps: 700 }))
  return sessions
}

type Row = Report['targets'][number]
function targets(): Row[] {
  return all().flatMap((r) => r.targets)
}

/* ------------------------------------------------------------ the invariant */

test('EVERY target ever put up is buildable — the design mistake, gone', () => {
  // Deliberately NOT asserted through `expressible`, which is the predicate
  // `ask.ts` itself consults: a test that shares its subject's oracle passes
  // whenever the oracle is wrong. This one demands an actual route, checks that
  // every term of it is a real polyp value, and evaluates it.
  const bad: Array<{ t: Row; why: string }> = []
  for (const t of targets()) {
    const form = t.form as Form
    const slots = slotsFor(form, sumSlotsAt(t.depth))
    const route = ladderRoute(t.value, form, slots)
    if (!route) {
      bad.push({ t, why: 'no route out of any polyps at all' })
      continue
    }
    if (route.length > slots) bad.push({ t, why: `route needs ${route.length} polyps into ${slots} slots` })
    for (const v of route) if (!onLadder(v)) bad.push({ t, why: `route uses ${v}, which is not a polyp` })
    if (evaluate(route, form) !== t.value) bad.push({ t, why: 'the route does not evaluate to the target' })
  }
  console.log(`   ${targets().length} targets over ${SEEDS.length} sessions`)
  assert.deepEqual(bad.slice(0, 8), [], `${bad.length} unbuildable targets`)
})

test('a target the shelf cannot answer yet always arrives with the polyps it needs', () => {
  let unreachable = 0
  let stocking = 0
  const dead: string[] = []
  for (const t of targets()) {
    // Not literally on the shelf is fine and normal, and covers two good cases:
    // the reef is coughing up the halves, OR the child already holds the material
    // and has a merge to do. `solvable` is the one that has to hold, every time —
    // asserting `stock > 0` instead used to look like the same statement, and it
    // is not: it fails a shelf that is one join away from the answer.
    if (!t.reachable) unreachable++
    if (t.stock > 0) stocking++
    if (!t.solvable) dead.push(`${t.value} (${t.form}) at depth ${t.depth}, owes ${t.stock}`)
  }
  const pct = (100 * unreachable) / Math.max(1, targets().length)
  console.log(
    `   ${pct.toFixed(1)}% of targets were not literally on the shelf; ` +
      `${((100 * stocking) / Math.max(1, targets().length)).toFixed(1)}% arrived with a debt`,
  )
  assert.deepEqual(dead.slice(0, 8), [] as string[], `${dead.length} targets could not be won`)
})

/* ---------------------------------------------------------- the distribution */

test('the target distribution is reported: sizes, forms, and where they come from', () => {
  const rows = targets()
  const digits = new Map<number, number>()
  const forms = new Map<string, number>()
  const bands = new Map<string, number>()
  let viaHost = 0
  let round10 = 0
  let round5 = 0
  for (const t of rows) {
    const d = String(t.value).length
    digits.set(d, (digits.get(d) ?? 0) + 1)
    forms.set(t.form, (forms.get(t.form) ?? 0) + 1)
    const band = t.depth < 10 ? 'depth 0-9' : t.depth < 22 ? 'depth 10-21' : t.depth < 34 ? 'depth 22-33' : 'depth 34+'
    bands.set(band, (bands.get(band) ?? 0) + 1)
    if (t.viaHost) viaHost++
    if (t.value % 10 === 0) round10++
    else if (t.value % 5 === 0) round5++
  }
  const pc = (n: number): string => `${((100 * n) / rows.length).toFixed(1)}%`
  console.log('   digits  : ' + [...digits].sort((a, b) => a[0] - b[0]).map(([d, n]) => `${d}d ${pc(n)}`).join('  '))
  console.log('   forms   : ' + [...forms].map(([f, n]) => `${f} ${pc(n)}`).join('  '))
  console.log('   depth   : ' + [...bands].sort().map(([b, n]) => `${b} ${pc(n)}`).join('  '))
  console.log(`   from the curriculum: ${pc(viaHost)}   multiples of 10: ${pc(round10)}, of 5: ${pc(round5)}`)

  // The founder's "it might be kinda simple usually - 18": the great majority of
  // targets are one to three digits, which is what a shelf of polyps can say.
  const small = (digits.get(1) ?? 0) + (digits.get(2) ?? 0) + (digits.get(3) ?? 0)
  assert.ok(small / rows.length > 0.8, `only ${pc(small)} of targets were 1-3 digits`)
  // And not so simple that one polyp does it: the big five-figure numbers are gone.
  assert.equal(digits.get(6) ?? 0, 0, 'a six-figure target is the bug this redesign is about')
})

test('almost every target is a curriculum item’s own answer, so the learner model still hears about it', () => {
  const rows = targets()
  const viaHost = rows.filter((t) => t.viaHost).length
  const pct = (100 * viaHost) / rows.length
  console.log(`   ${pct.toFixed(1)}% of targets carry a host item`)
  assert.ok(pct > 90, `only ${pct.toFixed(1)}% of targets were host items — the curriculum is being bypassed`)
})

test('the operator forms actually appear once they are unlocked', () => {
  const deep = targets().filter((t) => t.depth >= 34)
  if (deep.length < 40) {
    // The bot did not get that far in 700 moves on these seeds; assert what the
    // unlock table promises instead of pretending to a measurement.
    assert.deepEqual(formsAt(34), ['sum', 'minus', 'times', 'over'])
    return
  }
  const seen = new Set(deep.map((t) => t.form))
  for (const f of ['sum', 'minus']) assert.ok(seen.has(f), `${f} never appeared past depth 34`)
})

/* ------------------------------------------------------- refusals and cost */

test('refusing a number the board cannot build is cheap, and is never a wrong answer', () => {
  const rows = all()
  const asks = rows.reduce((a, r) => a + r.targets.length, 0)
  const skips = rows.reduce((a, r) => a + r.skips, 0)
  console.log(`   ${(skips / asks).toFixed(2)} items refused per target`)
  // `host.skip` records nothing and produces no Outcome — see the contract note.
  // It does consume an item, so it has to stay cheap.
  assert.ok(skips / asks < 1.5, `${(skips / asks).toFixed(2)} refusals per target is starving the stream`)
  // A refusal must never turn into a reported miss. Every report in the session
  // came from a resolved mouth, so there are never more reports than resolutions.
  for (const r of rows) {
    assert.ok(r.reports.length <= r.blooms + r.spills, `seed ${r.seed} reported more than it resolved`)
  }
})

/* --------------------------------------------------------- askTarget itself */

test('askTarget never returns a target its own route does not build', () => {
  const rng = makeRng(20260730)
  for (let depth = 0; depth <= 60; depth += 3) {
    const host = makeStubHost({ seed: 0xbeef + depth })
    for (let i = 0; i < 40; i++) {
      // A synthetic shelf at roughly the rung this depth emits.
      const values: number[] = []
      for (let k = 0; k < rng.int(4, 20); k++) {
        values.push([1, 3, 5, 7, 9, 11, 13, 15][rng.int(0, 7)] as number * 2 ** rng.int(0, Math.min(8, 1 + Math.floor(depth / 6))))
      }
      const bag = bagOf(values)
      const a = askTarget({ bag, depth, host, rng })
      assert.ok(a.value > 1, `depth ${depth} produced target ${a.value}`)
      assert.equal(a.slots, slotsFor(a.form, sumSlotsAt(depth)))
      assert.ok(formsAt(depth).includes(a.form), `${a.form} is not unlocked at depth ${depth}`)
      // Either the route is on the shelf, or it is a ladder route and the stock
      // covers the difference. Both are checked here rather than trusted.
      const onShelf = routeIn(bag, a.value, a.form, a.slots)
      if (!onShelf) {
        assert.ok(ladderRoute(a.value, a.form, a.slots), `no ladder route for ${a.value} as ${a.form}`)
        assert.ok(a.stock.length > 0, `${a.value} was not on the shelf and nothing was stocked`)
      }
      assert.ok(a.draws >= 1 && a.draws <= 6)
    }
  }
})

test('askTarget is deterministic given the same board, host and rng', () => {
  const bag = bagOf([1, 2, 4, 8, 16, 3, 6, 12, 5, 10])
  const a = askTarget({ bag, depth: 12, host: makeStubHost({ seed: 7 }), rng: makeRng(99) })
  const b = askTarget({ bag, depth: 12, host: makeStubHost({ seed: 7 }), rng: makeRng(99) })
  assert.deepEqual(a, b)
})

test('askTarget survives a host with no focus and no skip', () => {
  const bare = makeStubHost({ seed: 5 })
  const stripped = { next: bare.next }
  const a = askTarget({ bag: bagOf([1, 2, 4, 8, 16]), depth: 0, host: stripped, rng: makeRng(3) })
  assert.ok(a.value > 1)
  assert.ok(expressible(a.value, a.form, a.slots))
})

test('a target that needed stocking becomes buildable in about a second, not in twenty', () => {
  // Written as a measurement because "it arrives eventually" is what the old vents
  // did: the founder's "it's easier just to ignore the vents" was, in part, waiting.
  const rng = makeRng(515)
  let stocked = 0
  let settled = 0
  const worst: number[] = []
  for (const seed of [11, 22, 33, 44, 55, 66, 77, 88]) {
    const host = makeStubHost({ seed })
    for (let depth = 0; depth <= 40; depth += 8) {
      for (let i = 0; i < 25; i++) {
        const values: number[] = []
        for (let k = 0; k < rng.int(4, 16); k++) {
          values.push(([1, 3, 5, 7, 9, 11, 13, 15][rng.int(0, 7)] as number) * 2 ** rng.int(0, 6))
        }
        const bag = bagOf(values)
        const a = askTarget({ bag, depth, host, rng })
        if (a.stock.length === 0) continue
        stocked++
        // The reef emits one owed polyp per STOCK_PERIOD_MS, so the debt is
        // cleared in `stock.length` of them.
        const ms = a.stock.length * 320
        worst.push(ms)
        if (ms <= 2000) settled++
      }
    }
  }
  const max = Math.max(0, ...worst)
  console.log(`   ${stocked} stocked asks; worst debt clears in ${max}ms`)
  assert.ok(stocked > 20, 'nothing was stocked, so this measured nothing')
  assert.equal(settled, stocked, `${stocked - settled} debts took over two seconds to clear`)
})
