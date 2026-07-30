/**
 * The one thing this game may never do.
 *
 * `game.ts` already says it, at the top of `pending`: "Anything else would punish
 * correct arithmetic, which is the one thing this game may never do." These tests
 * hold the whole shot pipeline — aim, land, resolve, report — to that sentence.
 *
 * The child modelled here is a competent one. She reads `47 + 25`, works out 72,
 * takes the stated wind off it, dials the result, and fires. Every assertion below
 * is about what happens to her.
 *
 * There have now been two ways of getting the wind wrong, and this file has to rule
 * out both at once:
 *
 *   - **Punishing her.** The original defect: the wind was added to the landing
 *     after she committed and nothing let her account for it. `the correct child
 *     always lands it` is the sweep that closes this, over every wind at every cap.
 *   - **Being pointless.** The first fix: the machine compensated for her, so
 *     ignoring the wind was optimal and reasoning about it was punished. `the wind
 *     is not decoration` closes that one, and it is the test the founder's question
 *     is about.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { posAt, resolve, samplePath, type TargetRef } from './ballistics.ts'
import { claimOf, rollWind, shotFor, verdictFor, windValues, type ShotKind } from './verdict.ts'
import {
  dialRange,
  DIAL_MAX,
  DIAL_MIN,
  LOFT_DEG,
  PLACEABLE_HI,
  PLACEABLE_LO,
  WIND_MAX,
  windCapFor,
} from './world.ts'
import { makeRng } from '../core/rng.ts'

const LAUNCH_H = 11

/** A plausible field: keeps at least MIN_GAP (8 m) apart, one of them the answer. */
const FIELD = [40, 56, 72, 88, 104]
const ANSWER = 72

const towers = (): TargetRef[] =>
  FIELD.map((range, id) => ({ id, range, value: range, alive: true }))

/**
 * One shot, through exactly the path `game.ts` walks: throw at the dialled range in
 * the stated wind, see where it comes down, resolve that against the keeps, and turn
 * the result into what the host is told.
 */
function takeShot(
  dial: number,
  answer: number,
  wind: number,
  kind: ShotKind = 'ground',
): {
  landing: number
  felled: boolean
  report: boolean
  correct: boolean
  answered: string
  claim: number
} {
  const shot = shotFor(dial, LOFT_DEG, wind, LAUNCH_H)
  // The game resolves the landing against the keeps to decide what comes apart.
  // The verdict may not depend on the answer to that question — but the child
  // watching does: being told she is right while the keep stays standing is its
  // own kind of lie, so both are measured.
  const out = resolve(shot.landing, towers())
  const felled = out.quality === 'direct' && out.target?.value === answer
  const v = verdictFor({ dial, wind, landing: shot.landing, answer, kind })
  return { landing: shot.landing, felled, ...v }
}

/** The dial a child who has done both steps correctly winds on. */
const dialFor = (answer: number, wind: number): number => answer - wind

/**
 * The host does not receive `correct`. `game-host/index.ts` sends
 * `answer({ response: answered })` and the curriculum judges the string.
 * So this — not the game's own opinion — is what lands in the learner model.
 */
const recordedCorrect = (answered: string, answer: number): boolean => answered === String(answer)

/** Every wind cap the game can put on the field, weakest first. */
const CAPS = [0, 3, 4, 5, 6, 7, 8, WIND_MAX]
const pct = (n: number, d: number): string => (d === 0 ? 'n/a' : `${((n / d) * 100).toFixed(1)}%`)

/* ------------------------------------------------------------------ *
 * The sweep. Every wind, every answer, one competent child.
 * ------------------------------------------------------------------ */

test('the correct child always lands it: every wind, every answer on the field', () => {
  // THE test. A child who works out the sum and then takes the stated wind off it
  // must land on the metre she named — every time, at every wind the game can
  // produce, for every answer the field can hold. If a single case in here fails,
  // the original defect is back: correct arithmetic, scored wrong.
  const failures: string[] = []
  let shots = 0
  for (const cap of CAPS) {
    for (const wind of cap ? windValues(cap) : [0]) {
      for (let answer = PLACEABLE_LO; answer <= PLACEABLE_HI; answer++) {
        shots++
        const dial = dialFor(answer, wind)
        const where = `cap ${cap}, wind ${wind}, answer ${answer}, dial ${dial}`
        // 1. She can physically enter it. A compensation off the end of the dial is
        //    a right answer she is unable to give.
        const stops = dialRange(wind)
        if (dial < stops.lo || dial > stops.hi) {
          failures.push(`${where}: the dial does not reach (${stops.lo}..${stops.hi})`)
          continue
        }
        const r = takeShot(dial, answer, wind)
        // 2. The boulder comes down on the metre she named, exactly.
        if (r.landing !== answer) failures.push(`${where}: landed at ${r.landing}`)
        // 3. The game agrees she was right.
        if (!r.correct) failures.push(`${where}: scored WRONG`)
        // 4. The curriculum is told she was right, and told her number.
        if (!recordedCorrect(r.answered, answer)) {
          failures.push(`${where}: recorded as "${r.answered}"`)
        }
      }
    }
  }
  assert.equal(
    failures.slice(0, 8).join('\n'),
    '',
    `${failures.length} of ${shots} correct shots were punished`,
  )
  // A guard on the sweep itself, so a loop that quietly stopped iterating cannot
  // pass by testing nothing. 8,925 today: 85 winds across the caps, 105 answers.
  assert.ok(shots > 8000, `only ${shots} shots were swept`)
})

test('the correct child always lands it, at every difficulty the ladder has', () => {
  // The same sweep, driven the way the game drives it: the wind cap comes from the
  // item's difficulty, so walk the whole ladder rather than a list of caps someone
  // chose. A rung whose cap the dial cannot express is a rung that punishes her.
  const failures: string[] = []
  for (let d = 0; d <= 1.0001; d += 0.01) {
    const cap = windCapFor(d)
    for (const wind of cap ? windValues(cap) : [0]) {
      for (const answer of [PLACEABLE_LO, 40, 72, 99, PLACEABLE_HI]) {
        const dial = dialFor(answer, wind)
        const stops = dialRange(wind)
        const r = takeShot(dial, answer, wind)
        if (dial < stops.lo || dial > stops.hi || r.landing !== answer || !r.correct) {
          failures.push(`d=${d.toFixed(2)} cap ${cap} wind ${wind} answer ${answer}: dial ${dial}, landed ${r.landing}, correct ${String(r.correct)}`)
        }
      }
    }
  }
  assert.equal(failures.slice(0, 8).join('\n'), '', `${failures.length} punished cases`)
})

/* ------------------------------------------------------------------ *
 * The wind now earns its place on the glass.
 * ------------------------------------------------------------------ */

test('the wind is not decoration: ignoring it misses, accounting for it lands', () => {
  // The founder's question, as a measurement. "It seems that usually we just ignore
  // for the best results but then I'm not sure what the point is."
  //
  // Before this change the answer was: ignore it, always. The machine aimed off for
  // her, so a child who ignored the wind was right 492/492 times and a child who
  // reasoned about it was scored WRONG 480/492 times. The wind bent the arc, read a
  // number on a chip, and decided nothing.
  const rows: string[] = []
  for (const cap of CAPS.filter((c) => c > 0)) {
    let cases = 0
    let ignoreLands = 0
    let compensateLands = 0
    for (const wind of windValues(cap)) {
      for (const answer of FIELD) {
        cases++
        // The child who reads the sum and dials the answer, wind and all.
        if (takeShot(answer, answer, wind).correct) ignoreLands++
        // The child who takes the wind off first.
        if (takeShot(dialFor(answer, wind), answer, wind).correct) compensateLands++
      }
    }
    rows.push(
      `cap ${cap}: ignoring the wind lands ${pct(ignoreLands, cases)}, ` +
        `accounting for it lands ${pct(compensateLands, cases)}`,
    )
  }
  assert.equal(
    rows.join('\n'),
    CAPS.filter((c) => c > 0)
      .map((cap) => `cap ${cap}: ignoring the wind lands 0.0%, accounting for it lands 100.0%`)
      .join('\n'),
  )
})

test('below the threshold there is no wind, and the dial is the answer', () => {
  // The low end is untouched, and that is a promise: a child meeting this game gets
  // one idea — read the sum, dial the answer, the keep falls. Every rung the shipped
  // ladder has below `WIND_FROM_D` that this field can hold.
  for (const d of [0, 0.169, 0.2, 0.246, 0.262, 0.277, 0.292, 0.308, 0.323, 0.339]) {
    assert.equal(windCapFor(d), 0, `d=${String(d)} has a wind on it`)
  }
  for (const answer of FIELD) {
    const r = takeShot(answer, answer, 0)
    assert.equal(r.claim, answer, 'with no wind, her claim is the dial')
    assert.equal(r.landing, answer)
    assert.equal(r.correct, true)
    assert.equal(r.answered, String(answer))
    assert.equal(r.felled, true, 'the keep she named comes down')
  }
  // ...and the ends of the window, where there is no keep in this fixture but the
  // arithmetic still has to hold.
  for (const answer of [PLACEABLE_LO, PLACEABLE_HI]) {
    const r = takeShot(answer, answer, 0)
    assert.equal(r.claim, answer)
    assert.equal(r.landing, answer)
    assert.equal(r.correct, true)
  }
})

/* ------------------------------------------------------------------ *
 * What reaches the curriculum.
 * ------------------------------------------------------------------ */

test('the number reported is her answer to the SUM, not the dial', () => {
  // The dial and her answer are now deliberately different numbers, so which one is
  // reported is the whole question. #654 established that the dial was reported,
  // because then the dial WAS her answer. It is not any more: she is asked for 72
  // and turns the dial to 67.
  for (const wind of [-9, -5, -1, 1, 5, 9]) {
    for (const answer of [20, 47, 72, 100]) {
      const dial = dialFor(answer, wind)
      const r = takeShot(dial, answer, wind)
      assert.equal(r.answered, String(answer), `wind ${wind}, answer ${answer}: dialled ${dial}`)
      assert.notEqual(r.answered, String(dial), 'the dial is not what she was asked for')
    }
  }
})

test('her answer is computed from what she saw, never read off the ground', () => {
  // `claimOf` takes the dial she set and the wind she was shown, and adds two
  // integers. Nothing from the simulation is in it. That is not fastidiousness: the
  // original defect reported the metre the wind chose, and it did that by reading
  // the ground.
  for (const dial of [-4, 0, 8, 72, 127, 500]) {
    for (const wind of [-9, 0, 9]) {
      assert.equal(claimOf(dial, wind), dial + wind, `dial ${dial}, wind ${wind}`)
    }
  }
  // And a landing that disagrees cannot change it.
  const real = console.error
  const shouted: string[] = []
  console.error = (...args: unknown[]) => shouted.push(args.join(' '))
  try {
    for (const drift of [-9, -4, -1, 1, 5, 9]) {
      const v = verdictFor({ dial: 67, wind: 5, landing: 72 + drift, answer: 72, kind: 'ground' })
      assert.equal(v.answered, '72', `drift ${drift}`)
      assert.equal(v.correct, true, `drift ${drift}`)
    }
  } finally {
    console.error = real
  }
  assert.equal(shouted.length, 6, 'every disagreement is logged')
  assert.match(shouted[0], /landed at 63 but the dial said 67 in a wind of 5, which is 72/)
})

test('a wrong dial is never recorded as a right answer', () => {
  // The mirror image, and just as poisoning: a child who is one out must not be
  // written into the model as a child who knew it. Two ways to be one out now — the
  // sum, or the adjustment — and neither may be forgiven.
  const bad: string[] = []
  for (const cap of CAPS.filter((c) => c > 0)) {
    for (const wind of windValues(cap)) {
      const right = dialFor(ANSWER, wind)
      for (const off of [-3, -2, -1, 1, 2, 3]) {
        const r = takeShot(right + off, ANSWER, wind)
        if (recordedCorrect(r.answered, ANSWER)) {
          bad.push(`wind ${wind}: dialled ${right + off} instead of ${right} -> recorded "${r.answered}"`)
        }
        if (r.correct) bad.push(`wind ${wind}: dialled ${right + off} -> scored CORRECT`)
      }
      // The particular wrong answer this mechanic invites: the right sum, the
      // adjustment applied the WRONG WAY.
      const flipped = takeShot(ANSWER + wind, ANSWER, wind)
      if (flipped.correct) bad.push(`wind ${wind}: adjusting the wrong way scored CORRECT`)
      if (recordedCorrect(flipped.answered, ANSWER)) {
        bad.push(`wind ${wind}: adjusting the wrong way recorded "${flipped.answered}"`)
      }
      // ...and it is recorded as the number she actually named, so the curriculum
      // can see how she was wrong instead of only that she was.
      if (flipped.answered !== String(ANSWER + 2 * wind)) {
        bad.push(`wind ${wind}: adjusting the wrong way recorded "${flipped.answered}"`)
      }
    }
  }
  assert.equal(bad.slice(0, 6).join('\n'), '', `${bad.length} wrong dials were treated as right`)
})

/* ------------------------------------------------------------------ *
 * The physics under it.
 * ------------------------------------------------------------------ */

test('the landing metre is dial + wind, exactly, for every input', () => {
  for (const cap of CAPS) {
    for (const wind of cap ? windValues(cap) : [0]) {
      for (const dial of [DIAL_MIN, 8, 14, 40, 72, 104, PLACEABLE_HI, DIAL_MAX]) {
        // `solve` is unconditional: the arithmetic holds for anything, and the
        // stops are a separate rule about what the dial will let her ask for.
        assert.equal(
          shotFor(dial, LOFT_DEG, wind, LAUNCH_H).landing,
          dial + wind,
          `dial ${dial}, wind ${wind}`,
        )
      }
    }
  }
})

test('every shot the dial can express is a real arc, even in the worst corner', () => {
  // The shortest throw the dial allows, against the strongest wind, must still be a
  // finite drawable arc that leaves the sling forwards and upwards and comes down
  // where the arithmetic says.
  for (const wind of windValues(WIND_MAX)) {
    const stops = dialRange(wind)
    for (const dial of [stops.lo, stops.lo + 1, 20, 72, stops.hi - 1, stops.hi]) {
      const where = `dial ${dial}, wind ${wind}`
      const s = shotFor(dial, LOFT_DEG, wind, LAUNCH_H)
      assert.ok(Number.isFinite(s.T) && s.T > 0, `flight time ${where}: ${s.T}`)
      assert.ok(s.vx > 0, `${where}: launched backwards at ${s.vx} m/s`)
      assert.ok(s.vy > 0, `${where}: launched downwards at ${s.vy} m/s`)
      assert.ok(s.apexY > LAUNCH_H, `${where}: never rose above the sling`)
      for (const p of samplePath(s, 12)) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `path ${where}`)
      }
      assert.ok(Math.abs(posAt(s, s.T).x - (dial + wind)) < 1e-9, `comes down on dial+wind, ${where}`)
    }
  }
})

test('nothing the boulder does can carry it off the drawn field', () => {
  // The dial reaches past the field so the compensation is expressible. That must
  // not let a boulder fly out past where the ground is drawn (40 m beyond the field)
  // on its way to a landing that IS on the field.
  for (const wind of windValues(WIND_MAX)) {
    const stops = dialRange(wind)
    for (let dial = stops.lo; dial <= stops.hi; dial++) {
      const s = shotFor(dial, LOFT_DEG, wind, LAUNCH_H)
      // Never behind the machine: a boulder that turns round in mid-air and lands
      // on the crew is what an unbounded dial produced, and it is what `dialRange`
      // exists to stop.
      assert.ok(s.landing >= 1, `dial ${dial}, wind ${wind}: lands at ${s.landing}`)
      for (const p of samplePath(s, 48)) {
        assert.ok(
          p.x >= 0 && p.x <= DIAL_MAX + 1,
          `dial ${dial}, wind ${wind}: reached x=${String(p.x)}`,
        )
      }
    }
  }
})

/* ------------------------------------------------------------------ *
 * Shots that are not answers.
 * ------------------------------------------------------------------ */

test('a boulder spent on the ram is not an answer to the question', () => {
  // A child who knocks the siege engine off her walls has not said anything
  // about 47 + 25. Reporting it as a wrong answer writes "does not know this"
  // into the model for a shot that was never an attempt at the sum.
  const ram = takeShot(30, ANSWER, 4, 'ram')
  assert.equal(ram.report, false, 'a ram shot must not be reported as an answer')

  // And the mirror: the ram can stand on the very metre the answer is at, so a
  // perfectly aimed boulder can be swallowed on its way out. That is not a hit
  // either — no keep came down, so nothing may be scored as one.
  const intercepted = takeShot(dialFor(ANSWER, 4), ANSWER, 4, 'ram')
  assert.equal(intercepted.report, false, 'still not an answer')
  assert.equal(intercepted.correct, false, 'no keep fell, so nothing was struck')

  for (const kind of ['tower', 'ground', 'wall'] as ShotKind[]) {
    const r = takeShot(dialFor(ANSWER, 4), ANSWER, 4, kind)
    assert.equal(r.report, true, `${kind} is an answer`)
    assert.equal(r.correct, true, `${kind} on the right metre is right`)
  }
})

test('rollWind only ever produces a wind the tests enumerate', () => {
  for (const cap of [3, 5, 9]) {
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
  // Never zero when there IS a wind: a chip reading 0 tells a child to adjust by
  // nothing, which is a lie about a mechanic she has just been taught.
  const rng = makeRng(9)
  for (let i = 0; i < 2000; i++) assert.notEqual(rollWind(3, rng), 0)
})
