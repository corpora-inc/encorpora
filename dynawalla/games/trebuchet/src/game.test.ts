/**
 * The whole game, driven the way a child drives it.
 *
 * The rest of the suite tests `sim/` in isolation, which is where the arithmetic
 * lives — but the defect this file exists for did not live there. `release()`
 * and `impact()` are separated by two to three seconds of boulder flight, and
 * every input the game listens to is still live across them. So this test builds
 * the real `TrebuchetGame` on a stub canvas, presses the real buttons through
 * the real listeners, advances the real `tick`, and reads what the real host was
 * told. Nothing is mocked but the paint.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import type { Host, Question } from './contract.ts'
import { TrebuchetGame } from './game.ts'
import { hudLayout } from './render/hud.ts'

/* ---------------------------------------------------------------- the glass */

type Listeners = Map<string, Array<(e: unknown) => void>>

/** Everything a 2D context is asked for here, and nothing it is asked to draw. */
function stubCtx(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => undefined }
  const target: Record<string, unknown> = {}
  return new Proxy(target, {
    get: (t, prop: string) => {
      if (prop in t) return t[prop]
      if (prop === 'measureText') return () => ({ width: 8 })
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient
      if (prop === 'canvas') return undefined
      return () => undefined
    },
    set: (t, prop: string, value) => {
      t[prop] = value
      return true
    },
  }) as unknown as CanvasRenderingContext2D
}

function stubElement(tag: string, w: number, h: number): Record<string, unknown> {
  const listeners: Listeners = new Map()
  const el: Record<string, unknown> = {
    tagName: tag.toUpperCase(),
    style: { cssText: '' },
    width: w,
    height: h,
    __listeners: listeners,
    setAttribute: () => undefined,
    appendChild: () => undefined,
    remove: () => undefined,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
    getContext: () => stubCtx(),
    getBoundingClientRect: () => ({ x: 0, y: 0, top: 0, left: 0, right: w, bottom: h, width: w, height: h }),
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      const list = listeners.get(type) ?? []
      list.push(fn)
      listeners.set(type, list)
    },
    removeEventListener: (type: string, fn: (e: unknown) => void) => {
      listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn))
    },
  }
  return el
}

const VIEW = { w: 1024, h: 768 }

/** Installs a canvas-shaped world on `globalThis`. Returns the mount element. */
function installDom(): { el: HTMLElement; canvas: Record<string, unknown> } {
  const created: Array<Record<string, unknown>> = []
  const g = globalThis as unknown as Record<string, unknown>
  g.document = {
    createElement: (tag: string) => {
      const el = stubElement(tag, VIEW.w, VIEW.h)
      created.push(el)
      return el
    },
    getElementById: () => null,
    body: { appendChild: () => undefined },
  }
  g.window = {
    devicePixelRatio: 1,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }
  g.requestAnimationFrame = () => 1
  g.cancelAnimationFrame = () => undefined
  const el = stubElement('div', VIEW.w, VIEW.h)
  // The game appends its canvas to the mount element; the first canvas created
  // after that call is the one carrying the pointer listeners.
  const mount = el as unknown as HTMLElement
  return {
    el: mount,
    get canvas() {
      return created.find((c) => c.tagName === 'CANVAS') as Record<string, unknown>
    },
  }
}

/* ---------------------------------------------------------------- the host */

type Reported = { questionId: string; correct: boolean; ms: number; answered: string }

function recordingHost(answers: number[]): { host: Host; reports: Reported[] } {
  const reports: Reported[] = []
  let n = 0
  const host: Host = {
    next: (): Question => {
      const a = answers[n % answers.length]
      n++
      return {
        id: `q${n}`,
        prompt: `? = ${a}`,
        answer: String(a),
        distractors: [String(a + 11), String(a - 13)],
        domain: 'add-sub',
        difficulty: 0.4,
      }
    },
    report: (r) => reports.push(r),
    haptic: () => undefined,
    prefersReducedMotion: () => true,
  }
  return { host, reports }
}

/* ---------------------------------------------------------------- driving */

/** Tap a HUD button through the canvas's own pointerdown listener. */
function tap(canvas: Record<string, unknown>, id: string): void {
  const layout = hudLayout(VIEW.w, VIEW.h, { x: 0, y: 0, w: VIEW.w, h: VIEW.h }, true)
  const btn = layout.buttons.find((b) => b.id === id)
  assert.ok(btn, `no ${id} button in the HUD`)
  const listeners = canvas.__listeners as Listeners
  const down = listeners.get('pointerdown') ?? []
  assert.ok(down.length > 0, 'the canvas has no pointerdown listener')
  for (const fn of down) {
    fn({ clientX: btn.x + btn.w / 2, clientY: btn.y + btn.h / 2, pointerId: 1 })
  }
}

function runUntil(game: TrebuchetGame, done: () => boolean, maxFrames = 1200): boolean {
  for (let i = 0; i < maxFrames; i++) {
    game.stepFrames(1)
    if (done()) return true
  }
  return false
}

function newGame(answers: number[], wave: number): ReturnType<typeof installDom> & {
  game: TrebuchetGame
  reports: Reported[]
} {
  const dom = installDom()
  const { host, reports } = recordingHost(answers)
  const game = new TrebuchetGame(dom.el, host, 0xb01de)
  game.manualDrive()
  game.jumpToWave(wave)
  assert.ok(runUntil(game, () => game.currentPhase === 'aim'), 'the wave never became playable')
  // A wave that is "playable" with nothing in the rack is the bug this guard
  // exists for: `phase` reached 'aim' happily with no boulder and no question,
  // and every assertion below it read -1 and passed anyway.
  assert.notEqual(game.currentAnswer(), -1, 'the wave became playable with an empty rack')
  return { ...dom, game, reports }
}

/**
 * The shape of the shipped ladder, rung by rung.
 *
 * Not invented: this is the measured `ladder()` over the 66 active rungs, banded by
 * the magnitude of the answers each returns. The two things it exists to preserve
 * are the two that break a naive search:
 *
 *   - **Magnitude is NOT monotonic.** Division rungs return single-digit QUOTIENTS
 *     and they sit ABOVE placeable multiplication-table rungs. Measured:
 *     0.323 placeable (8..81), 0.338 quotients (0..5), 0.415 placeable (6..110),
 *     0.508 quotients (2..12), 0.538 hundreds of thousands. A search that treats a
 *     "too small" verdict as a floor excludes the placeable band and never returns.
 *   - **Only a narrow middle fits on 122 metres.** Everything below is single-digit
 *     facts; everything above is column arithmetic in the thousands and scaling in
 *     the millions.
 */
const RUNGS: Array<{ upto: number; lo: number; hi: number }> = [
  { upto: 0.246, lo: 0, hi: 9 }, // add/sub facts within ten
  { upto: 0.33, lo: 8, hi: 81 }, // tables — placeable
  { upto: 0.354, lo: 0, hi: 5 }, // division facts — small, and ABOVE a placeable rung
  { upto: 0.43, lo: 6, hi: 110 }, // tables — placeable
  { upto: 0.523, lo: 2, hi: 12 }, // division facts — small again, higher still
  { upto: 0.75, lo: 2000, hi: 5400 }, // column arithmetic
  { upto: 1.01, lo: 1_000_000, hi: 9_000_000 }, // times a power of ten
]

/**
 * A host that behaves like the shipped one.
 *
 * Faithful in the four ways that decide whether the search is correct:
 *
 *   - the answers depend on the rung, and the game cannot see the mapping;
 *   - the ladder is quantised — a request lands on `round(d * 65)`, so many distinct
 *     requests are the same rung, exactly as in `items.ts`;
 *   - the difficulty reported back is the ORDINATE OF THE RUNG SERVED, not the
 *     number that was asked for, which is what the app actually returns;
 *   - `lagPulls` models the asynchronous pool: the first calls after a change still
 *     return the old rung, so a game that retried inside one synchronous call would
 *     never see the new questions.
 */
function ladderHost(
  lagPulls = 0,
  opts: { start?: number; rungs?: typeof RUNGS; nonInteger?: boolean } = {},
): { host: Host; asks: number[]; served: number[] } {
  const table = opts.rungs ?? RUNGS
  const asks: number[] = []
  const served: number[] = []
  const span = 65
  let n = 0
  let difficulty = opts.start ?? 0.04
  let pending: number | null = null
  let lag = 0
  const host: Host & { setDifficulty?: (d: number) => void } = {
    next: (): Question => {
      if (pending !== null) {
        if (lag > 0) lag--
        else {
          difficulty = pending
          pending = null
        }
      }
      n++
      // The app's own quantisation: a 0..1 request picks a whole rung.
      const index = Math.max(0, Math.min(span, Math.round(difficulty * span)))
      const ordinate = index / span
      const band = table.find((b) => ordinate < b.upto) ?? table[table.length - 1]
      const spread = band.hi - band.lo + 1
      const a = band.lo + ((n * 7) % spread)
      served.push(ordinate)
      return {
        id: `q${n}`,
        prompt: `? = ${a}`,
        // A rung of fractions is a rung this game can never place, and it must not
        // be able to stop the search either.
        answer: opts.nonInteger ? `${String(a)}.5` : String(a),
        distractors: [String(a + 11), String(a + 23)],
        domain: 'add-sub',
        difficulty: ordinate,
      }
    },
    report: () => undefined,
    haptic: () => undefined,
    prefersReducedMotion: () => true,
    setDifficulty: (d: number) => {
      asks.push(d)
      pending = d
      // Only a big move restarts the wait. `game-host` flushes and refills its pool
      // when a request moves by `FLUSH_BAND` (0.1) or more and otherwise just retargets
      // it, so a search stepping by a fraction of a rung does NOT keep resetting the
      // refill — and a test that assumed it did would demand the impossible.
      if (Math.abs(d - difficulty) >= 0.1) lag = lagPulls
    },
  }
  return { host, asks, served }
}

/* ------------------------------------------------------------------ tests */

test('the fire button throws a boulder', () => {
  // The control a child actually presses, pressed the way she presses it. Every
  // test in this file used to reach `fireNow()` instead — the harness door — so
  // `pressBtn`'s `case 'fire'` had no coverage at all, and a fire button that did
  // nothing was invisible to all 166 of them.
  const { game, canvas } = newGame([42, 60, 78, 96], 2)
  assert.equal(game.currentPhase, 'aim')
  assert.equal(game.fireArmed(), true, 'the button is not offering itself')

  tap(canvas, 'fire')
  assert.ok(
    runUntil(game, () => game.currentPhase === 'flight'),
    'tapping fire did not put a boulder in the air',
  )
})

test('a stream the field cannot hold still becomes a playable wave', () => {
  // The founder's bug. TREBUCHET stands a keep at the answer in METRES, so it can
  // only ask a question whose answer fits on 122 metres of field — and the ladder
  // it was asking for at wave 1 serves differences within ten. Every answer was
  // dropped, the rack came back empty, and an empty rack has no equation to draw
  // and no boulder to throw: the child saw no question and the fire button did
  // nothing. Both symptoms, one cause.
  const dom = installDom()
  const { host } = ladderHost()
  const game = new TrebuchetGame(dom.el, host, 0xb01de)
  game.manualDrive()

  assert.ok(runUntil(game, () => game.currentPhase === 'aim'), 'the wave never became playable')
  const answer = game.currentAnswer()
  assert.notEqual(answer, -1, 'there is no question on the screen')
  assert.ok(game.towerRanges().includes(answer), 'the answer has no keep to knock down')

  // And it is playable through the real control, not just internally consistent.
  game.aimAt(answer)
  tap(dom.canvas, 'fire')
  assert.ok(runUntil(game, () => game.currentPhase === 'flight'), 'the shot never left')
})

test('the fire button is never lit over an empty rack', () => {
  // The other half of the report: the button did not merely fail, it *invited* the
  // press. `canFire` was `phase === 'aim' || phase === 'intro'` and phase reached
  // 'aim' with an empty rack, so the button drew lit and pulsing while `fire()`
  // returned on its second line for want of a boulder. A control that lies about
  // being ready is worse than one that is plainly dark.
  //
  // Asserted as an invariant over a whole run rather than at one moment, because
  // the moment is the easy part: what has to hold is that the button and the
  // machine never disagree, in any phase, on any wave.
  const dom = installDom()
  // A ladder whose placeable band is nowhere near where the first search starts, so
  // the game genuinely opens with an empty rack and has to go looking.
  const { host } = ladderHost(0, {
    rungs: [
      { upto: 0.8, lo: 0, hi: 9 },
      { upto: 1.01, lo: 20, hi: 90 },
    ],
  })
  const game = new TrebuchetGame(dom.el, host, 0xb01de)
  game.manualDrive()

  // Read into a local: asserting on the getter itself narrows its type for the
  // rest of the function, and the loop below has to be free to see any phase.
  const opening: string = game.currentPhase
  assert.equal(opening, 'stocking', 'the wave claimed to be playable')
  assert.equal(game.fireArmed(), false, 'the fire button is lit over an empty rack')

  let armedFrames = 0
  for (let i = 0; i < 3000; i++) {
    game.stepFrames(1)
    if (game.fireArmed()) {
      armedFrames++
      assert.notEqual(game.currentAnswer(), -1, `frame ${i}: the button is lit with no boulder`)
    }
    if (game.currentPhase === 'aim' && game.currentAnswer() > 0) {
      game.aimAt(game.currentAnswer())
      tap(dom.canvas, 'fire')
    }
  }
  assert.ok(armedFrames > 0, 'the button was never armed at all, so nothing was proved')
})

test('the search for a placeable rung survives a pool that refills late', () => {
  // The reason stocking is a phase and not a loop. The real host refills its
  // question pool asynchronously, so the questions that answer a difficulty change
  // arrive several `next()` calls later. A synchronous retry re-reads the drained
  // pool for as long as it is willing to spin and concludes, wrongly, that there
  // is nothing playable anywhere on the ladder.
  const dom = installDom()
  const { host, asks } = ladderHost(40)
  const game = new TrebuchetGame(dom.el, host, 0xb01de)
  game.manualDrive()

  assert.ok(
    runUntil(game, () => game.currentPhase === 'aim', 2400),
    'the game never found a rung it could place',
  )
  assert.notEqual(game.currentAnswer(), -1)
  assert.ok(asks.length > 1, 'the game never asked for a different rung')
  const a = game.currentAnswer()
  assert.ok(a >= 14 && a <= 118, `${a} does not fit on the field`)
})

test('a ladder whose difficulty does not track answer size is still searched', () => {
  // The premise a bisection would need, and the one the real ladder breaks. Division
  // rungs return single-digit quotients and sit ABOVE placeable multiplication
  // rungs, so "the answers here are too small" is not evidence that the band is
  // higher up. A search that treated it as a floor would raise its bound past the
  // placeable band at 0.246-0.43 and search only the region where nothing fits —
  // turning the fix for a blank screen into a blank screen.
  //
  // Started deliberately on the HIGHER of the two small-quotient rungs (0.5), which
  // is the exact probe that would poison a bisection.
  const dom = installDom()
  const { host } = ladderHost(0, { start: 0.5 })
  const game = new TrebuchetGame(dom.el, host, 0xb01de)
  game.manualDrive()
  game.jumpToWave(9) // difficulty 0.616 — above the band, below the millions

  assert.ok(
    runUntil(game, () => game.currentPhase === 'aim', 3000),
    'a non-monotonic ladder was never searched successfully',
  )
  const a = game.currentAnswer()
  assert.ok(a >= 14 && a <= 118, `${a} does not fit on the field`)
})

test('a rung that yields no verdict at all does not stop the search', () => {
  // Every probe must move. A rung of non-integer answers is unplaceable and says
  // nothing about direction — nothing is too big, nothing is too small — and a probe
  // that drew no conclusion used to leave the difficulty untouched. The next probe
  // then re-asked nothing, because a difficulty already stated is not re-stated, and
  // re-read the identical stream: a search that has silently finished, with a dark
  // button on an empty field. Standing still is the one outcome not allowed.
  const dom = installDom()
  const fractions = [{ upto: 1.01, lo: 20, hi: 90 }]
  const { host, asks } = ladderHost(0, { rungs: fractions, nonInteger: true })
  const game = new TrebuchetGame(dom.el, host, 0xb01de)
  game.manualDrive()
  for (let i = 0; i < 300; i++) game.stepFrames(1)

  assert.equal(game.currentPhase, 'stocking', 'fractions cannot stand on the field')
  // The point: it kept looking. A frozen search asks once and never again.
  assert.ok(asks.length > 8, `the search stopped after ${asks.length} asks`)
  const unique = new Set(asks)
  assert.ok(unique.size > 8, `the search re-asked the same rung: ${unique.size} distinct`)
})

test('the search walks the whole ladder rather than excluding parts of it', () => {
  // A band that exists only at the very top, reached from the very bottom. Nothing
  // may be ruled out on the way: the walk steps by less than one rung and wraps, so
  // every rung is visited whatever shape the ladder has.
  const dom = installDom()
  const topOnly = [
    { upto: 0.9, lo: 2, hi: 6 },
    { upto: 1.01, lo: 30, hi: 90 },
  ]
  const { host } = ladderHost(0, { start: 0.0, rungs: topOnly })
  const game = new TrebuchetGame(dom.el, host, 0xb01de)
  game.manualDrive()

  assert.ok(
    runUntil(game, () => game.currentPhase === 'aim', 6000),
    'a band at the top of the ladder was never reached from the bottom',
  )
  const found = game.stockedDifficulty()
  assert.ok(found !== null && found >= 0.9, `settled at ${found}, which is not where the band is`)
})

test('a wave that cannot be stocked at all says so out loud', () => {
  // The one case the search cannot rescue: a ladder with no rung whose answers fit
  // on 122 metres. The screen then looks exactly like the reported bug — an empty
  // field, no equation, a dark fire button — so it must not be a silent one.
  const dom = installDom()
  let n = 0
  const host: Host = {
    next: (): Question => {
      n++
      // Nothing this field can hold, at any difficulty.
      return {
        id: `q${n}`,
        prompt: '? = 9000',
        answer: '9000',
        distractors: [],
        domain: 'add-sub',
        difficulty: 0.5,
      }
    },
    report: () => undefined,
    haptic: () => undefined,
    prefersReducedMotion: () => true,
  }
  const said: string[] = []
  const realError = console.error
  console.error = (...args: unknown[]) => said.push(args.map(String).join(' '))
  try {
    const game = new TrebuchetGame(dom.el, host, 0xb01de)
    game.manualDrive()
    for (let i = 0; i < 1300; i++) game.stepFrames(1) // ~22 s: past a full pass of the ladder
    assert.equal(game.currentPhase, 'stocking')
    assert.equal(game.fireArmed(), false, 'the button is lit on a field with no keeps')
  } finally {
    console.error = realError
  }
  assert.equal(said.length, 1, `expected exactly one complaint, got ${said.length}`)
  assert.match(said[0], /cannot be stocked/)
})

test('a rung far above the field is searched downward, not only upward', () => {
  // The top end was broken too, and for longer than the bottom: wave 6 asked for a
  // difficulty that returns four-digit column subtraction and wave 7 one that
  // returns millions, and neither can put a keep on 122 metres of field. So the
  // same blank screen and dead button waited for anyone who got that far. The
  // search has to move both ways.
  // A ladder whose only placeable rungs are BELOW where the first search starts, and
  // where everything above them is in the thousands. The opening probe therefore
  // reads "too big" and the sweep has to go down to find the field.
  const dom = installDom()
  const { host } = ladderHost(0, {
    rungs: [
      { upto: 0.14, lo: 20, hi: 90 },
      { upto: 1.01, lo: 2000, hi: 9000 },
    ],
  })
  const game = new TrebuchetGame(dom.el, host, 0xb01de)
  game.manualDrive()
  const opening: string = game.currentPhase
  assert.equal(opening, 'stocking', 'a rung in the thousands claimed to be playable')

  assert.ok(
    runUntil(game, () => game.currentPhase === 'aim', 3000),
    'a wave above the field never came back down to it',
  )
  const answer = game.currentAnswer()
  assert.notEqual(answer, -1, 'there is no question on the screen')
  assert.ok(answer >= 14 && answer <= 118, `${answer} does not fit on the field`)
  const found = game.stockedDifficulty()
  assert.ok(found !== null && found < 0.14, `the search never came down to the band (settled ${found})`)
})

test('the arithmetic creeps up with the waves and never off the field', () => {
  // `waveConfig` keeps raising the difficulty it asks for — 0.83 by wave 12 — and
  // honouring that walks the stream straight out of the window the dial can express,
  // which is how waves 6 upward went blank. But pinning it forever would mean a
  // twenty-wave run of the same two-digit sums.
  //
  // So each wave asks for one notch above the rung that last worked, and a notch
  // that does not fit is not adopted. The result has to be both: it moves, and it
  // never leaves the field.
  const dom = installDom()
  const { host } = ladderHost()
  const game = new TrebuchetGame(dom.el, host, 0xb01de)
  game.manualDrive()
  assert.ok(runUntil(game, () => game.currentPhase === 'aim'), 'wave 1 never stocked')
  const first = game.stockedDifficulty()
  assert.ok(first !== null)

  const bands: number[] = []
  for (let w = 2; w <= 12; w++) {
    game.jumpToWave(w)
    assert.ok(runUntil(game, () => game.currentPhase === 'aim', 3000), `wave ${w} never stocked`)
    const a = game.currentAnswer()
    assert.ok(a >= 14 && a <= 118, `wave ${w} put ${a} on a 122-metre field`)
    const band = game.stockedDifficulty()
    assert.ok(band !== null)
    bands.push(band)
  }
  assert.ok(bands[bands.length - 1] > first, 'the arithmetic never got any harder across 12 waves')
  // ...and it did not run away up the ladder either: every wave stayed placeable,
  // which is asserted above, wave by wave.
})

test('a bullseye stays a bullseye when the dial is nudged mid-flight', () => {
  // Wave 8: wind up to ±5, and the +/- buttons are not phase-gated, so a child
  // fidgeting with the dial while the boulder is in the air used to have her
  // answer re-read at impact — a keep hit dead centre, scored wrong, and the
  // nudged number sent to the curriculum as what she said.
  const { game, canvas, reports } = newGame([42, 60, 78, 96], 8)
  const answer = game.currentAnswer()
  assert.ok(game.towerRanges().includes(answer), 'the answer must have a keep')

  game.aimAt(answer)
  game.fireNow()
  assert.ok(runUntil(game, () => game.currentPhase === 'flight'), 'the shot never left')

  tap(canvas, 'plus')
  tap(canvas, 'plus')

  assert.ok(runUntil(game, () => reports.length > 0), 'nothing was ever reported')
  const r = reports[0]
  assert.equal(r.answered, String(answer), 'the number she committed to is the number reported')
  assert.equal(r.correct, true, 'a keep struck dead centre is a right answer')
  assert.ok(!game.towerRanges().includes(answer), 'the keep she named must come down')
})

test('a wrong dial stays wrong when it is corrected mid-flight', () => {
  // The mirror: turning the dial onto the answer after the boulder has gone must
  // not buy the answer, and must not blow up a keep the shot never went near.
  const { game, reports } = newGame([42, 60, 78, 96], 8)
  const answer = game.currentAnswer()
  const standing = game.towerRanges()
  // A metre with no keep on it and none within blast range.
  const wrong = standing.reduce((a, b) => Math.max(a, b), 0) + 4

  game.aimAt(wrong)
  game.fireNow()
  assert.ok(runUntil(game, () => game.currentPhase === 'flight'), 'the shot never left')

  game.aimAt(answer)

  assert.ok(runUntil(game, () => reports.length > 0), 'nothing was ever reported')
  const r = reports[0]
  assert.equal(r.answered, String(wrong), 'what she fired is what she answered')
  assert.equal(r.correct, false)
  assert.deepEqual(game.towerRanges(), standing, 'no keep may fall for a wrong answer')
})

test('the reported latency is thinking time, not boulder flight time', () => {
  // `ms` is what reaches the curriculum as `latencyMs`. Measuring it at impact
  // adds the whole arc — two to three seconds — to every answer in the game, so
  // the wall clock is taken over here and pushed forward only during the flight.
  const realPerf = globalThis.performance
  let clock = 1000
  ;(globalThis as unknown as Record<string, unknown>).performance = { now: () => clock }
  try {
    const { game, reports } = newGame([42, 60, 78, 96], 4)
    clock += 4000 // she thinks for four seconds
    game.aimAt(game.currentAnswer())
    game.fireNow()
    assert.ok(
      runUntil(game, () => {
        // ...and the boulder is a long time in the air. Only the flight is on
        // this clock: the wind-up is the machine's, and the thinking already
        // happened above.
        if (game.currentPhase === 'flight') clock += 100
        return reports.length > 0
      }),
      'nothing was ever reported',
    )
    assert.ok(reports[0].ms >= 4000, `latency ${reports[0].ms} ms lost the thinking time`)
    assert.ok(reports[0].ms < 4600, `latency ${reports[0].ms} ms includes the flight`)
  } finally {
    ;(globalThis as unknown as Record<string, unknown>).performance = realPerf
  }
})

test('the whole rack can be answered without a false verdict', () => {
  // Nine waves of perfect play, wind and all: every report must be correct, and
  // must be the number that was dialled.
  const { game, reports } = newGame([42, 60, 78, 96, 30, 110], 6)
  const dialled: number[] = []
  for (let shot = 0; shot < 12; shot++) {
    if (game.currentPhase !== 'aim') {
      if (!runUntil(game, () => game.currentPhase === 'aim')) break
    }
    const a = game.currentAnswer()
    if (a < 0 || !game.towerRanges().includes(a)) break
    dialled.push(a)
    game.aimAt(a)
    game.fireNow()
    const want = reports.length + 1
    if (!runUntil(game, () => reports.length >= want)) break
    // Told she is right is only half of it: the keep she named has to fall, or
    // the game is contradicting its own verdict on the screen in front of her.
    assert.ok(!game.towerRanges().includes(a), `the keep at ${a} was named and stayed standing`)
  }
  assert.ok(reports.length >= 6, `only ${reports.length} shots resolved`)
  for (let i = 0; i < reports.length; i++) {
    assert.equal(reports[i].correct, true, `shot ${i + 1} on ${dialled[i]} was scored wrong`)
    assert.equal(reports[i].answered, String(dialled[i]), `shot ${i + 1} reported the wrong number`)
  }
})
