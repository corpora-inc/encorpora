/**
 * The one thing this game may never do.
 *
 * `game.ts` already says it, at the top of `pending`: "Anything else would punish
 * correct arithmetic, which is the one thing this game may never do." These tests
 * hold the whole shot pipeline — aim, land, resolve, report — to that sentence.
 *
 * The child modelled here is a competent one. She reads `47 + 25`, works out 72,
 * dials 72, and fires. Every assertion below is about what happens to her.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { posAt, resolve, samplePath, type TargetRef } from './ballistics.ts'
import { aimShot, rollWind, verdictFor, windValues, type ShotKind } from './verdict.ts'
import { waveConfig } from './world.ts'
import { makeRng } from '../core/rng.ts'

/** The lofts the machine offers. The landing may not depend on any of them. */
const LOFTS = [30, 38, 46, 55, 65]
const LAUNCH_H = 11

/** A plausible field: keeps at least MIN_GAP (8 m) apart, one of them the answer. */
const FIELD = [40, 56, 72, 88, 104]
const ANSWER = 72

const towers = (): TargetRef[] =>
  FIELD.map((range, id) => ({ id, range, value: range, alive: true }))

/**
 * One shot, through exactly the path `game.ts` walks: aim at the dialled metre,
 * see where it comes down, resolve that against the keeps, and turn the result
 * into what the host is told.
 */
function takeShot(
  dial: number,
  answer: number,
  wind: number,
  angleDeg: number,
  kind: ShotKind = 'ground',
): { landing: number; felled: boolean; report: boolean; correct: boolean; answered: string } {
  const shot = aimShot(dial, angleDeg, wind, LAUNCH_H)
  // The game resolves the landing against the keeps to decide what comes apart.
  // The verdict may not depend on the answer to that question — but the child
  // watching does: being told she is right while the keep stays standing is its
  // own kind of lie, so both are measured.
  const out = resolve(shot.landing, towers())
  const felled = out.quality === 'direct' && out.target?.value === answer
  const v = verdictFor({ dial, landing: shot.landing, answer, kind })
  return { landing: shot.landing, felled, ...v }
}

/**
 * The host does not receive `correct`. `game-host/index.ts` sends
 * `answer({ response: answered })` and the curriculum judges the string.
 * So this — not the game's own opinion — is what lands in the learner model.
 */
const recordedCorrect = (answered: string, answer: number): boolean => answered === String(answer)

const WAVES = [3, 5, 7, 10, 12, 16]
const pct = (n: number, d: number): string => (d === 0 ? 'n/a' : `${((n / d) * 100).toFixed(1)}%`)

test('wind never turns a correct answer into a wrong one, at any wave', () => {
  const rows: string[] = []
  for (const w of WAVES) {
    const cap = waveConfig(w).wind
    let shots = 0
    let falseWrong = 0
    let stoodThere = 0
    for (const wind of windValues(cap)) {
      for (const angle of LOFTS) {
        const r = takeShot(ANSWER, ANSWER, wind, angle)
        shots++
        if (!r.correct) falseWrong++
        if (!r.felled) stoodThere++
      }
    }
    rows.push(
      `wave ${w} (wind cap ${cap}): ${pct(falseWrong, shots)} of correct answers scored WRONG, ` +
        `${pct(stoodThere, shots)} left the keep standing`,
    )
  }
  assert.equal(
    rows.join('\n'),
    WAVES.map(
      (w) =>
        `wave ${w} (wind cap ${waveConfig(w).wind}): 0.0% of correct answers scored WRONG, ` +
        `0.0% left the keep standing`,
    ).join('\n'),
  )
})

test('wind never turns a correct answer into a wrong one IN THE LEARNER MODEL', () => {
  const rows: string[] = []
  for (const w of WAVES) {
    const cap = waveConfig(w).wind
    let shots = 0
    let falseWrong = 0
    for (const wind of windValues(cap)) {
      for (const angle of LOFTS) {
        const r = takeShot(ANSWER, ANSWER, wind, angle)
        shots++
        if (!recordedCorrect(r.answered, ANSWER)) falseWrong++
      }
    }
    rows.push(`wave ${w} (wind cap ${cap}): ${pct(falseWrong, shots)} recorded as a WRONG ANSWER`)
  }
  assert.equal(
    rows.join('\n'),
    WAVES.map((w) => `wave ${w} (wind cap ${waveConfig(w).wind}): 0.0% recorded as a WRONG ANSWER`).join('\n'),
  )
})

test('a wrong dial is never recorded as a right answer', () => {
  // The mirror image, and just as poisoning: a child who dials one short must
  // not be written into the model as a child who knew it.
  const bad: string[] = []
  for (const w of WAVES) {
    const cap = waveConfig(w).wind
    for (const wind of windValues(cap)) {
      for (const dial of [ANSWER - 3, ANSWER - 2, ANSWER - 1, ANSWER + 1, ANSWER + 2, ANSWER + 3]) {
        const r = takeShot(dial, ANSWER, wind, LOFTS[2])
        if (recordedCorrect(r.answered, ANSWER)) {
          bad.push(`wave ${w}: dialled ${dial} for ${ANSWER} with wind ${wind} -> recorded "${r.answered}"`)
        }
        if (r.correct) {
          bad.push(`wave ${w}: dialled ${dial} for ${ANSWER} with wind ${wind} -> scored CORRECT`)
        }
      }
    }
  }
  assert.equal(bad.slice(0, 6).join('\n'), '', `${bad.length} wrong dials were treated as right`)
})

test('the number reported to the host is the number the child dialled', () => {
  for (const wind of [-9, -4, -1, 0, 1, 4, 9]) {
    for (const dial of [14, 40, 71, 72, 73, 104, 118]) {
      const r = takeShot(dial, ANSWER, wind, LOFTS[2])
      assert.equal(r.answered, String(dial), `dial ${dial}, wind ${wind}`)
    }
  }
})

test('if anything ever moves the landing again, the dial still wins — loudly', () => {
  // `aimShot` makes landing === dial, so today this cannot happen. It could not
  // happen before either, right up until the wind was added. The report is pinned
  // to the child's number independently of the ground, and the disagreement is
  // logged rather than swallowed, because the alternative is silently marking a
  // child on a number she never chose.
  const real = console.error
  const shouted: string[] = []
  console.error = (...args: unknown[]) => shouted.push(args.join(' '))
  try {
    for (const drift of [-9, -4, -1, 1, 5, 9]) {
      const v = verdictFor({ dial: 72, landing: 72 + drift, answer: 72, kind: 'ground' })
      assert.equal(v.answered, '72', `drift ${drift}`)
      assert.equal(v.correct, true, `drift ${drift}`)
    }
    const wrong = verdictFor({ dial: 71, landing: 72, answer: 72, kind: 'ground' })
    assert.equal(wrong.answered, '71', 'the metre struck is not the answer given')
    assert.equal(wrong.correct, false)
  } finally {
    console.error = real
  }
  assert.equal(shouted.length, 7, 'every disagreement is logged')
  assert.match(shouted[0], /landed at 63 but the dial said 72/)
})

test('the dial IS the landing metre — the wind does not move it', () => {
  for (const w of WAVES) {
    for (const wind of windValues(waveConfig(w).wind)) {
      for (const angle of LOFTS) {
        for (const dial of [8, 14, 40, 72, 104, 122]) {
          assert.equal(
            aimShot(dial, angle, wind, LAUNCH_H).landing,
            dial,
            `wave ${w}: dial ${dial}, wind ${wind}, loft ${angle}`,
          )
        }
      }
    }
  }
})

test('aiming into the wind still produces a real arc, even in the worst corner', () => {
  // The compensation launches at `dial − wind`, which at the bottom of the dial
  // against the strongest wind is a very short throw. It must still be a finite,
  // drawable arc that reaches the ground on the dialled metre.
  for (const wind of windValues(9)) {
    for (const angle of LOFTS) {
      for (const dial of [8, 9, 10, 17, 122]) {
        const where = `dial ${dial}, wind ${wind}, loft ${angle}`
        const s = aimShot(dial, angle, wind, LAUNCH_H)
        assert.ok(Number.isFinite(s.T) && s.T > 0, `flight time ${where}: ${s.T}`)
        // Out of the sling forwards and upwards — never lobbed backwards off the
        // escarpment to be dragged onto the target by the crosswind.
        assert.ok(s.vx > 0, `${where}: launched backwards at ${s.vx} m/s`)
        assert.ok(s.vy > 0, `${where}: launched downwards at ${s.vy} m/s`)
        assert.ok(s.apexY > LAUNCH_H, `${where}: never rose above the sling`)
        for (const p of samplePath(s, 12)) {
          assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `path ${where}`)
        }
        assert.ok(Math.abs(posAt(s, s.T).x - dial) < 1e-9, `comes down on the dial, ${where}`)
      }
    }
  }
})

test('a boulder spent on the ram is not an answer to the question', () => {
  // A child who knocks the siege engine off her walls has not said anything
  // about 47 + 25. Reporting it as a wrong answer writes "does not know this"
  // into the model for a shot that was never an attempt at the sum.
  const ram = takeShot(30, ANSWER, 0, LOFTS[2], 'ram')
  assert.equal(ram.report, false, 'a ram shot must not be reported as an answer')

  // And the mirror: the ram can stand on the very metre the answer is at, so a
  // perfectly dialled boulder can be swallowed on its way out. That is not a hit
  // either — no keep came down, so nothing may be scored as one.
  const intercepted = takeShot(ANSWER, ANSWER, 0, LOFTS[2], 'ram')
  assert.equal(intercepted.report, false, 'still not an answer')
  assert.equal(intercepted.correct, false, 'no keep fell, so nothing was struck')

  for (const kind of ['tower', 'ground', 'wall'] as ShotKind[]) {
    const r = takeShot(ANSWER, ANSWER, 0, LOFTS[2], kind)
    assert.equal(r.report, true, `${kind} is an answer`)
    assert.equal(r.correct, true, `${kind} on the right metre is right`)
  }
})

test('rollWind only ever produces a wind the tests enumerate', () => {
  for (const cap of [2, 3, 5, 9]) {
    const allowed = new Set(windValues(cap))
    const rng = makeRng(0x51e6e)
    const seen = new Set<number>()
    for (let i = 0; i < 4000; i++) {
      const v = rollWind(cap, rng)
      assert.ok(allowed.has(v), `cap ${cap} rolled ${v}`)
      seen.add(v)
    }
    assert.equal(seen.size, allowed.size, `cap ${cap} did not cover its range`)
  }
  assert.equal(rollWind(0, makeRng(1)), 0, 'no wind means no wind')
})
