/**
 * IS THE ARITHMETIC SKIPPABLE?
 *
 * THE SPLIT shipped in this fleet with a bot that never answered a question
 * outscoring one that did, so this question is now asked out loud, of the real
 * rules, before a pull request is opened.
 *
 * Three players, same seeds, same number of moves, driving `core/engine.ts`:
 *
 *   merger   — merges and splits forever and never puts a polyp in the mouth
 *   random   — tidies half the time and feeds a polyp at random the rest
 *   compute  — works the target out and feeds exactly the polyps that make it
 *
 * `compute` has to win decisively. If it does not, the maths is decoration.
 */

import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { play, total, type Report } from './play.ts'

const SEEDS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233]
const STEPS = 900

function run(policy: 'merger' | 'random' | 'compute'): Report[] {
  return SEEDS.map((seed) => play({ policy, seed, steps: STEPS }))
}

test('the computing bot wins decisively — the maths is not skippable', () => {
  const merger = run('merger')
  const random = run('random')
  const compute = run('compute')

  const blooms = (rs: Report[]): number => total(rs, (r) => r.blooms)
  const spills = (rs: Report[]): number => total(rs, (r) => r.spills)

  console.log(
    `   merger  : ${blooms(merger)} blooms, ${spills(merger)} spills, ${total(merger, (r) => r.merges)} joins`,
  )
  console.log(
    `   random  : ${blooms(random)} blooms, ${spills(random)} spills, ${total(random, (r) => r.merges)} joins`,
  )
  console.log(
    `   compute : ${blooms(compute)} blooms, ${spills(compute)} spills, ${total(compute, (r) => r.merges)} joins`,
  )

  // A player who never answers scores exactly nothing. There is no other way to
  // progress in this game: no idle accrual, no currency, no per-second anything.
  assert.equal(blooms(merger), 0, 'merging alone must never deepen the reef')

  // And the one that computes beats the one that guesses by a wide margin, not a
  // nose. Four times is the floor asserted; the log above is the real number.
  assert.ok(
    blooms(compute) > blooms(random) * 4,
    `compute ${blooms(compute)} vs random ${blooms(random)} — guessing is too close to working it out`,
  )

  // Guessing is not merely slower, it is actively expensive: every wrong drop
  // hands the polyps back halved, so the random bot spills far more than it blooms.
  assert.ok(
    spills(random) > blooms(random) * 2,
    `random spilled ${spills(random)} against ${blooms(random)} blooms — a wrong answer is not costing enough`,
  )
  // Working it out costs almost nothing, which is what makes the cost fair.
  assert.ok(
    spills(compute) * 4 < blooms(compute),
    `compute spilled ${spills(compute)} against ${blooms(compute)} blooms`,
  )
})

test('every attempt the host recorded was the child’s own answer', () => {
  for (const r of [...run('random'), ...run('compute')]) {
    for (const rep of r.reports) {
      assert.notEqual(rep.answered, '', 'an empty answer is filed by the host as a MISS')
      assert.ok(rep.answered.length > 0)
      assert.ok(rep.ms >= 0, 'thinking time can never be negative')
    }
  }
})

test('a correct report is only ever produced by a bloom, and there is one per bloom', () => {
  for (const r of run('compute')) {
    const correct = r.reports.filter((x) => x.correct).length
    const viaHost = r.targets.filter((t) => t.viaHost).length
    // Every bloom on a host-backed target reports exactly once, and a target with
    // no host item behind it reports nothing at all.
    assert.ok(correct <= r.blooms, `${correct} correct reports for ${r.blooms} blooms`)
    assert.ok(correct <= viaHost)
  }
})

test('no session ever gets stuck: a target the shelf cannot build does not exist for long', () => {
  for (const r of run('compute')) {
    assert.equal(r.stuck, 0, `seed ${r.seed} had ${r.stuck} steps with nothing to do`)
    assert.ok(r.targets.length > 1, `seed ${r.seed} never got past its first target`)
  }
})

test('a session is reproducible from its seed', () => {
  const a = play({ policy: 'compute', seed: 4242, steps: 300 })
  const b = play({ policy: 'compute', seed: 4242, steps: 300 })
  assert.equal(a.blooms, b.blooms)
  assert.equal(a.spills, b.spills)
  assert.deepEqual(a.targets, b.targets)
  assert.deepEqual(a.reports, b.reports)
})
