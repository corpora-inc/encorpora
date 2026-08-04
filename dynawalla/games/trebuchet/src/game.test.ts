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
import { resetFelledForTest } from './sim/felled.ts'
import { WIND_MAX, WIND_MIN, WIND_STEPS } from './sim/world.ts'

/**
 * The felled keeps this device remembers, set to whatever the test needs.
 *
 * The wind is bought with keeps felled and the count is persisted, so a test that
 * wants the windy game has to say what this child has already done — and a test
 * that wants the beginner's game has to say she has done nothing. Both go through
 * the REAL storage the game reads, so the read side is exercised rather than
 * reached round.
 */
function seedFelled(n: number): Map<string, string> {
  const cells = new Map<string, string>()
  const g = globalThis as unknown as Record<string, unknown>
  g.localStorage = {
    getItem: (k: string) => cells.get(k) ?? null,
    setItem: (k: string, v: string) => {
      cells.set(k, String(v))
    },
    removeItem: (k: string) => {
      cells.delete(k)
    },
    clear: () => cells.clear(),
    key: () => null,
    get length() {
      return cells.size
    },
  }
  if (n > 0) cells.set('dw.trebuchet.felled', String(n))
  resetFelledForTest()
  return cells
}

/** The first step of the wind ramp, and the top of it, read off the ramp itself. */
const FIRST_WIND = WIND_STEPS[1].felled
const FLUENT = WIND_STEPS[WIND_STEPS.length - 1].felled

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

/**
 * Installs a canvas-shaped world on `globalThis`. Returns the mount element.
 *
 * It resets the felled-keep count too, and it has to: the count lives in module
 * scope behind a `localStorage` slot, so a test that fells twelve keeps leaves
 * every test after it in this file starting on the windy game. Eleven tests build
 * a `TrebuchetGame` directly rather than through `newGame`, and none of them are
 * about the wind — they would have been silently handed one.
 */
function installDom(): { el: HTMLElement; canvas: Record<string, unknown> } {
  seedFelled(0)
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

/**
 * A host that serves the answers it is given, on the rung it is told to.
 *
 * The rung no longer decides whether the wind blows — `seedFelled` does, because
 * the wind is bought with right answers rather than handed over when the curriculum
 * ladder drifts. The difficulty here is what the questions are, and nothing else.
 */
function recordingHost(answers: number[], difficulty = 0.4): { host: Host; reports: Reported[] } {
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
        difficulty,
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
  const layout = hudLayout(VIEW.w, VIEW.h, { x: 0, y: 0, w: VIEW.w, h: VIEW.h })
  const btn = layout.buttons.find((b) => b.id === id)
  assert.ok(btn, `no ${id} button in the HUD`)
  const listeners = canvas.__listeners as Listeners
  const down = listeners.get('pointerdown') ?? []
  assert.ok(down.length > 0, 'the canvas has no pointerdown listener')
  for (const fn of down) {
    fn({ clientX: btn.x + btn.w / 2, clientY: btn.y + btn.h / 2, pointerId: 1 })
  }
}

/**
 * A hand on the open field — the gesture that takes a reveal down.
 *
 * Not a HUD button: `tap()` above goes through `hitBtn`, and the reveal is
 * dismissed by a pointerdown anywhere the buttons are not.
 */
function tapField(canvas: Record<string, unknown>): void {
  const listeners = canvas.__listeners as Listeners
  for (const fn of listeners.get('pointerdown') ?? []) {
    fn({ clientX: VIEW.w * 0.5, clientY: VIEW.h * 0.62, pointerId: 1 })
  }
}

/**
 * Take the reveal down, if one is up, and say whether the world is moving again.
 *
 * #774 made a miss stop the siege until the child dismisses the completed sum by
 * hand: `revealPlan` supplies `holdMs: Infinity` and one gate (`stopped`) freezes
 * the phase clock, the dial repeat, the phase machine, the counter-fire and the
 * ram. So EVERY drive loop in this file that crosses a wrong answer has to take
 * the sum down before it can expect another boulder — and it has to do it on a
 * bound, because a loop waiting on a world that has stopped forever is a test that
 * hangs, which reports nothing and is indistinguishable from a pass.
 *
 * There is a short settle lockout before the gesture is accepted, so this steps
 * frames until it is honoured rather than tapping once and hoping.
 */
function dismissReveal(game: TrebuchetGame, canvas: Record<string, unknown>, maxFrames = 240): boolean {
  if (game.revealedSum() === null) return true
  for (let i = 0; i < maxFrames; i++) {
    game.stepFrames(1)
    tapField(canvas)
    if (game.revealedSum() === null) return true
  }
  return false
}

function runUntil(game: TrebuchetGame, done: () => boolean, maxFrames = 1200): boolean {
  for (let i = 0; i < maxFrames; i++) {
    game.stepFrames(1)
    if (done()) return true
  }
  return false
}

function newGame(
  answers: number[],
  wave: number,
  difficulty = 0.4,
  felled = 0,
): ReturnType<typeof installDom> & {
  game: TrebuchetGame
  reports: Reported[]
  /** The storage the game's felled-keep count is written into. */
  cells: Map<string, string>
} {
  // `installDom` clears the count; the seed goes on after it, not before.
  const dom = installDom()
  const cells = seedFelled(felled)
  const { host, reports } = recordingHost(answers, difficulty)
  const game = new TrebuchetGame(dom.el, host, 0xb01de)
  game.manualDrive()
  game.jumpToWave(wave)
  assert.ok(runUntil(game, () => game.currentPhase === 'aim'), 'the wave never became playable')
  // A wave that is "playable" with nothing in the rack is the bug this guard
  // exists for: `phase` reached 'aim' happily with no boulder and no question,
  // and every assertion below it read -1 and passed anyway.
  assert.notEqual(game.currentAnswer(), -1, 'the wave became playable with an empty rack')
  return { ...dom, game, reports, cells }
}

/**
 * The dial a child who has done BOTH steps sets: the answer, less the wind she can
 * see on the chip. With no wind it is just the answer, which is the beginner's game.
 */
function correctDial(game: TrebuchetGame): number {
  return game.currentAnswer() - game.currentWind()
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
      game.aimAt(correctDial(game))
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
  // A fluent child, so there IS a wind and the dial is a different number from her
  // answer — the +/- buttons are not phase-gated, so a child fidgeting with the
  // dial while the boulder is in the air used to have her answer re-read at impact:
  // a keep hit dead centre, scored wrong, and the nudged number sent to the
  // curriculum as what she said.
  const { game, canvas, reports } = newGame([42, 60, 78, 96], 8, 0.4, FLUENT)
  const answer = game.currentAnswer()
  assert.ok(game.towerRanges().includes(answer), 'the answer must have a keep')

  game.aimAt(correctDial(game))
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
  const { game, reports } = newGame([42, 60, 78, 96], 8, 0.4, FLUENT)
  const standing = game.towerRanges()
  // A metre with no keep on it and none within blast range.
  const wrong = standing.reduce((a, b) => Math.max(a, b), 0) + 4
  const wind = game.currentWind()

  game.aimAt(wrong - wind)
  game.fireNow()
  assert.ok(runUntil(game, () => game.currentPhase === 'flight'), 'the shot never left')

  game.aimAt(correctDial(game))

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
    game.aimAt(correctDial(game))
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
    game.aimAt(correctDial(game))
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

/* ------------------------------------------------------- the wind, at the mount */

test('the beginner never meets a wind, and dialling the answer is enough', () => {
  // The founder is not complaining about the low end and it must not move. A child
  // who has not yet put a boulder on the metre gets no wind at all, on any wave,
  // however long she plays — and, now, however hard the arithmetic she is served.
  // That last clause is the change: the wind used to arrive because the ladder had
  // moved, so a child who had never felled a keep could be handed a second
  // arithmetic step for reasons that were nothing to do with her.
  const { game, canvas, reports } = newGame([42, 60, 78, 96], 3, 0.95, 0)
  for (const wave of [1, 3, 6, 9, 14, 20]) {
    game.jumpToWave(wave)
    assert.ok(runUntil(game, () => game.currentPhase === 'aim', 3000), `wave ${wave} never stocked`)
    assert.equal(game.currentWindCap(), 0, `wave ${wave} put a wind on a child who has felled nothing`)
    assert.equal(game.currentWind(), 0, `wave ${wave} is blowing`)
  }
  const answer = game.currentAnswer()
  game.aimAt(answer)
  tap(canvas, 'fire')
  assert.ok(runUntil(game, () => reports.length > 0), 'nothing was ever reported')
  assert.equal(reports[0].answered, String(answer))
  assert.equal(reports[0].correct, true, 'the beginner dialled her answer and was marked wrong')
})

test('once she has bought it the wind decides the shot: ignoring it misses, taking it off lands', () => {
  // The founder's actual question — "are we supposed to shoot it longer, shorter,
  // ignore it?" — answered through the real fire button rather than in `sim/`.
  //
  // Both children fire at the same keep. The one who dials her answer and ignores
  // the wind is wrong, and is recorded as having answered the metre the boulder
  // reached. The one who takes the wind off her answer first is right. That is the
  // whole of "the wind does something".
  const ignoring = newGame([42, 60, 78, 96], 6, 0.55, FLUENT)
  const cap = ignoring.game.currentWindCap()
  assert.ok(cap >= WIND_MIN, `a fluent child must meet a wind; cap is ${cap}`)
  const wind = ignoring.game.currentWind()
  assert.notEqual(wind, 0, 'a wind of zero is not a wind')
  const answer = ignoring.game.currentAnswer()

  ignoring.game.aimAt(answer)
  tap(ignoring.canvas, 'fire')
  assert.ok(runUntil(ignoring.game, () => ignoring.reports.length > 0), 'nothing was reported')
  assert.equal(ignoring.reports[0].correct, false, 'ignoring the wind still lands the shot')
  assert.equal(
    ignoring.reports[0].answered,
    String(answer + wind),
    'she is recorded as having named the metre her boulder actually reached',
  )
  assert.ok(
    ignoring.game.towerRanges().includes(answer),
    'the keep she failed to allow for must still be standing',
  )

  const thinking = newGame([42, 60, 78, 96], 6, 0.55, FLUENT)
  const answer2 = thinking.game.currentAnswer()
  thinking.game.aimAt(correctDial(thinking.game))
  tap(thinking.canvas, 'fire')
  assert.ok(runUntil(thinking.game, () => thinking.reports.length > 0), 'nothing was reported')
  assert.equal(thinking.reports[0].correct, true, 'the child who did the arithmetic was marked wrong')
  assert.equal(thinking.reports[0].answered, String(answer2), 'her answer is the sum, not the dial')
  assert.ok(!thinking.game.towerRanges().includes(answer2), 'the keep she named must come down')
})

test('the dial reaches every compensation the wind can ask for', () => {
  // A correct answer she cannot physically enter is the same defect as a correct
  // answer scored wrong. The dial's stops move with the wind (`dialRange`), so this
  // drives the REAL `setDial` through `aimAt` and checks the number stuck.
  const { game } = newGame([14, 40, 72, 100, 118], 6, 1, FLUENT)
  assert.equal(game.currentWindCap(), WIND_MAX, 'the top of the ramp must blow its hardest')
  let taken = 0
  for (let shot = 0; shot < 40; shot++) {
    if (game.currentPhase !== 'aim' && !runUntil(game, () => game.currentPhase === 'aim')) break
    const answer = game.currentAnswer()
    if (answer < 0) break
    const want = correctDial(game)
    game.aimAt(want)
    assert.equal(
      game.stats().dial,
      want,
      `wind ${game.currentWind()}, answer ${answer}: the dial would not go to ${want}`,
    )
    game.fireNow()
    taken++
    if (!runUntil(game, () => game.currentPhase === 'aim' || game.currentPhase === 'clear')) break
    // Every shot here is the correct compensation, so #774's reveal must never come
    // up. If one ever did, the world would stop, the loop would break out on its
    // bound, and this test would pass having swept two dials instead of forty.
    assert.equal(game.revealedSum(), null, `shot ${taken}: a correct compensation raised the reveal`)
  }
  assert.ok(taken >= 8, `only ${taken} compensations were entered`)
})

test('the wind does not move between the question appearing and the boulder landing', () => {
  // The safety property the whole mechanic rests on. The original defect was a term
  // added AFTER the child committed; if the wind can change while she is thinking,
  // or between her pressing fire and the impact, then `dial + wind` is not a number
  // she could have worked out and this is the same bug again.
  //
  // Sampled every frame from the moment the question is on the glass to the moment
  // the host is told, rather than at two moments — the two moments are the easy part.
  const { game, reports } = newGame([42, 60, 78, 96], 6, 0.55, FLUENT)
  for (let shot = 0; shot < 6; shot++) {
    if (game.currentPhase !== 'aim' && !runUntil(game, () => game.currentPhase === 'aim')) break
    const answer = game.currentAnswer()
    if (answer < 0) break
    const shown = game.currentWind()
    assert.notEqual(shown, 0, 'this test is pointless without a wind')
    const seen = new Set<number>([shown])
    // She reads it, thinks about it, winds the dial about. Nothing may move.
    for (let i = 0; i < 40; i++) {
      game.stepFrames(1)
      game.aimAt(20 + i)
      seen.add(game.currentWind())
    }
    game.aimAt(answer - shown)
    const want = reports.length + 1
    game.fireNow()
    assert.ok(
      runUntil(game, () => {
        seen.add(game.currentWind())
        return reports.length >= want
      }),
      'nothing was ever reported',
    )
    assert.deepEqual([...seen], [shown], `the wind moved under her: saw ${[...seen].join(', ')}`)
    assert.equal(reports[want - 1].correct, true, 'a correct, compensated shot was scored wrong')
    assert.equal(reports[want - 1].answered, String(answer))
  }
  assert.ok(reports.length >= 3, `only ${reports.length} shots resolved`)
})

test('the manual is raised the first time the wind blows, and only then', () => {
  // A mechanic that arrives silently mid-run and changes what a right answer looks
  // like is the original defect in a new costume. `index.ts` wires this to
  // `guide.open()`; here it is a counter, so the rule "exactly once a run" is a test
  // and not a comment.
  const dom = installDom()
  seedFelled(FLUENT)
  const { host } = recordingHost([42, 60, 78, 96], 0.55)
  const game = new TrebuchetGame(dom.el, host, 0xb01de)
  let raised = 0
  game.setExplainer(() => {
    raised++
  })
  game.manualDrive()
  assert.ok(runUntil(game, () => game.currentPhase === 'aim'), 'the wave never became playable')
  assert.ok(game.currentWindCap() > 0, 'this rung must have a wind on it')
  assert.equal(raised, 1, `the wind arrived and the manual was raised ${raised} times`)

  // Twelve more waves of it, and it is never explained again.
  for (const wave of [2, 3, 4, 7, 9, 11, 13]) {
    game.jumpToWave(wave)
    assert.ok(runUntil(game, () => game.currentPhase === 'aim', 3000), `wave ${wave} never stocked`)
  }
  assert.equal(raised, 1, `the manual was raised ${raised} times across nine waves`)
})

test('the manual is never raised on a run that has no wind in it', () => {
  // The mirror. A child who has not bought the wind must not have a panel about it
  // thrown at her; there is no wind, so there is nothing to explain.
  const dom = installDom()
  const { host } = recordingHost([42, 60, 78, 96], 0.28)
  const game = new TrebuchetGame(dom.el, host, 0xb01de)
  let raised = 0
  game.setExplainer(() => {
    raised++
  })
  game.manualDrive()
  for (const wave of [1, 4, 8, 12, 18]) {
    game.jumpToWave(wave)
    assert.ok(runUntil(game, () => game.currentPhase === 'aim', 3000), `wave ${wave} never stocked`)
    assert.equal(game.currentWind(), 0)
  }
  assert.equal(raised, 0, 'a windless run explained the wind')
})

test('a whole windy rack can be answered without one false verdict', () => {
  // Perfect play on a rung the wind is blowing on: every report correct, every
  // report the answer to the SUM and not the number on the dial, and every keep she
  // named on the ground.
  const { game, reports } = newGame([42, 60, 78, 96, 30, 110], 6, 0.55, FLUENT)
  assert.ok(game.currentWindCap() > 0, 'a fluent child must meet a wind')
  const named: number[] = []
  const dials: number[] = []
  for (let shot = 0; shot < 12; shot++) {
    if (game.currentPhase !== 'aim' && !runUntil(game, () => game.currentPhase === 'aim')) break
    const a = game.currentAnswer()
    if (a < 0 || !game.towerRanges().includes(a)) break
    named.push(a)
    dials.push(correctDial(game))
    game.aimAt(correctDial(game))
    game.fireNow()
    const want = reports.length + 1
    if (!runUntil(game, () => reports.length >= want)) break
    assert.ok(!game.towerRanges().includes(a), `the keep at ${a} was named and stayed standing`)
  }
  assert.ok(reports.length >= 6, `only ${reports.length} shots resolved`)
  for (let i = 0; i < reports.length; i++) {
    assert.equal(reports[i].correct, true, `shot ${i + 1} on ${named[i]} was scored wrong`)
    assert.equal(reports[i].answered, String(named[i]), `shot ${i + 1} reported the wrong number`)
  }
  // ...and the dial genuinely was a different number from the answer, or this test
  // would pass with the wind switched off.
  assert.ok(
    dials.some((d, i) => d !== named[i]),
    'no shot in this run needed any compensation at all',
  )
})

test('the loft lever is gone, and nothing took its place in the corner', () => {
  // It changed nothing a child could be scored on and its two lowest notches were
  // strictly worse than the default. A control that does nothing teaches a child
  // that controls do nothing.
  //
  // Checked at the mount, on a wave the lever used to be on: the layout the game
  // hands the renderer, and the buttons the hit test walks, are the same object, so
  // this is about the control a child can actually press.
  const { game, canvas } = newGame([42, 60, 78, 96], 9)
  const layout = hudLayout(VIEW.w, VIEW.h, { x: 0, y: 0, w: VIEW.w, h: VIEW.h })
  assert.equal(layout.buttons.some((b) => b.id === 'loft'), false, 'the lever is back')
  assert.deepEqual(
    layout.buttons.map((b) => b.id).sort(),
    ['fire', 'minus', 'mute', 'plus'],
    'the control set changed',
  )
  // Mute has the bottom-left corner to itself now, and pressing it must be pressing
  // mute rather than a lever that used to sit on top of it.
  const before = game.stats().dial
  tap(canvas, 'mute')
  assert.equal(game.stats().dial, before, 'the bottom-left corner moved the dial')
})

test('only a felled keep buys the wind — a miss buys nothing, and the reveal takes nothing', () => {
  // The currency has to be the thing it claims to be, or the ramp is indexed on
  // something else wearing its name. A keep on the ground is a sum worked out and a
  // boulder put on the metre; a miss is not, and must move nothing.
  //
  // The second half is what makes the TOP step reachable. A first draft counted
  // only still-air kills, and a child playing perfectly froze at fifteen: the
  // currency stopped being earnable the moment she crossed the first threshold, so
  // the wider wind could never arrive. A keep felled in a wind counts too.
  //
  // And the miss is now driven THROUGH #774's reveal, which is the interaction this
  // test used to get wrong: a wrong answer stops the siege until the child takes
  // the completed sum down, so "the next boulder loads" is something she causes and
  // not something that happens.
  {
    const { game, canvas, reports, cells: still } = newGame([42, 60, 78, 96], 3, 0.4, 0)
    assert.equal(game.currentWind(), 0, 'this half of the test needs still air')
    // A miss first: two metres short, which is a wrong answer and buys nothing.
    game.aimAt(game.currentAnswer() - 2)
    tap(canvas, 'fire')
    assert.ok(runUntil(game, () => reports.length > 0), 'nothing was reported')
    assert.equal(reports[0].correct, false)
    assert.equal(still.get('dw.trebuchet.felled'), undefined, 'a miss bought progress')

    // The world has stopped on the completed sum, and it stays stopped. Bounded,
    // and the bound is asserted: an unbounded wait on a world that has been held
    // forever is a test that hangs and reports nothing.
    assert.notEqual(game.revealedSum(), null, 'a miss did not raise the reveal')
    assert.equal(
      runUntil(game, () => game.currentPhase === 'aim', 300),
      false,
      'the next boulder loaded underneath the sum she was reading',
    )
    assert.equal(still.get('dw.trebuchet.felled'), undefined, 'the held reveal bought progress')

    // She takes it down, and only then does the siege carry on.
    assert.ok(dismissReveal(game, canvas), 'the reveal would not come down')
    assert.ok(runUntil(game, () => game.currentPhase === 'aim'), 'the next boulder never loaded')
    game.aimAt(game.currentAnswer())
    tap(canvas, 'fire')
    assert.ok(runUntil(game, () => reports.length > 1), 'the second shot never resolved')
    assert.equal(reports[1].correct, true)
    assert.equal(still.get('dw.trebuchet.felled'), '1', 'a felled keep bought nothing')

    // A right answer raises no reveal at all, so there is no second beat in which a
    // keep could be counted twice. Held for a long stretch of frames: `noteFelled`
    // sits in `impact`, and a reveal that re-entered it would show up here.
    assert.equal(game.revealedSum(), null, 'a felled keep raised a reveal')
    runUntil(game, () => false, 300)
    assert.equal(still.get('dw.trebuchet.felled'), '1', 'one felled keep was counted more than once')
  }

  // And the same perfect play in a wind, from a child on the first step of the ramp:
  // it has to keep counting, or the second step is unreachable.
  {
    const { game, canvas, reports, cells: windy } = newGame([42, 60, 78, 96], 3, 0.4, FIRST_WIND)
    assert.notEqual(game.currentWind(), 0, 'this half of the test needs a wind')
    game.aimAt(correctDial(game))
    tap(canvas, 'fire')
    assert.ok(runUntil(game, () => reports.length > 0), 'nothing was reported')
    assert.equal(reports[0].correct, true, 'the compensated shot was scored wrong')
    assert.equal(
      windy.get('dw.trebuchet.felled'),
      String(FIRST_WIND + 1),
      'a keep felled in a wind bought nothing, so the top step can never arrive',
    )
  }
})

test('a miss in a wind stops the siege, and hands the wind back when she is ready', () => {
  // The two changes that landed together, composed. #774 freezes the world on a
  // wrong answer; the wind is bought with felled keeps and rolled fresh for each
  // boulder. So a miss in a wind has to hold the sum AND the wind she got it wrong
  // against — a chip that re-rolled underneath the reveal would be showing her the
  // arithmetic for a shot she has not taken yet, next to the sum for one she has.
  const { game, canvas, reports, cells } = newGame([42, 60, 78, 96], 3, 0.4, FLUENT)
  const wind = game.currentWind()
  assert.notEqual(wind, 0, 'this test is pointless without a wind')
  const answer = game.currentAnswer()

  // She does the sum right and forgets the wind — the exact error this mechanic
  // invites, and the one the reveal exists to answer.
  game.aimAt(answer)
  tap(canvas, 'fire')
  assert.ok(runUntil(game, () => reports.length > 0), 'nothing was reported')
  assert.equal(reports[0].correct, false, 'ignoring the wind landed the shot')
  assert.equal(reports[0].answered, String(answer + wind), 'she is recorded as naming the wrong metre')

  const sum = game.revealedSum()
  assert.notEqual(sum, null, 'a miss in a wind did not raise the reveal')
  assert.ok(sum?.includes(String(answer)), `the reveal "${String(sum)}" does not finish the sum`)

  // Nothing moves under it — the wind included.
  for (let i = 0; i < 240; i++) {
    game.stepFrames(1)
    assert.equal(game.currentWind(), wind, `frame ${i}: the wind re-rolled under the reveal`)
  }
  assert.equal(cells.get('dw.trebuchet.felled'), String(FLUENT), 'the reveal moved the count')

  // She takes it down. The siege resumes, the wind is still in play, and the ramp
  // is exactly where she left it: a miss costs her nothing she had already bought.
  assert.ok(dismissReveal(game, canvas), 'the reveal would not come down')
  assert.ok(runUntil(game, () => game.currentPhase === 'aim'), 'the siege never resumed')
  assert.equal(game.currentWindCap(), WIND_MAX, 'the wind was taken away by a wrong answer')
  assert.notEqual(game.currentWind(), 0, 'the chip went blank after a miss')
  assert.equal(cells.get('dw.trebuchet.felled'), String(FLUENT), 'a miss spent what she had bought')

  // ...and she can still win the very next boulder.
  game.aimAt(correctDial(game))
  tap(canvas, 'fire')
  assert.ok(runUntil(game, () => reports.length > 1), 'the next shot never resolved')
  assert.equal(reports[1].correct, true, 'the shot after a miss was scored wrong')
  assert.equal(cells.get('dw.trebuchet.felled'), String(FLUENT + 1), 'the keep she felled bought nothing')

  // And across the wave boundary, which is the only place the loss would show.
  // `windCap` is read once per wave, so a miss that quietly spent the count would
  // leave this wave blowing exactly as before and take the wind away at the NEXT
  // one — a mechanic disappearing a minute after the thing that cost her it.
  assert.ok(dismissReveal(game, canvas), 'a reveal was left standing')
  game.jumpToWave(4)
  assert.ok(runUntil(game, () => game.currentPhase === 'aim', 3000), 'the next wave never stocked')
  assert.equal(game.currentWindCap(), WIND_MAX, 'the wind was gone by the next wave')
})

test('the wind arrives because she FELLED KEEPS, and only then', () => {
  // The founder's second complaint, end to end through the real fire button.
  //
  // It used to arrive because the LADDER had moved. That sounds like the same thing
  // and it is not: `stock()` sweeps for a rung whose answers fit on 122 metres and
  // wraps when it runs out, so the difficulty served oscillates. Measured on
  // `origin/main` over five seeds through this same `ladderHost`, the cap by wave
  // came out 0,0,0,3,3,4,4,0,0,0,0,0,0,3,3,4,4,0,0,0 — the wind switched on at
  // wave 4, OFF at wave 8, back at 14 and off again at 18, for reasons entirely
  // invisible from where the child is sitting and none of which were anything she
  // did.
  //
  // So this plays the game properly, wave after wave, and watches for the moment
  // the rule changes. Two things have to be true at once and a wave counter can
  // only ever manage one of them: she is windless until she has demonstrated the
  // one-step game, AND the wind does arrive once she has.
  const dom = installDom()
  const { host } = ladderHost()
  // `ladderHost` throws its reports away; this loop counts felled keeps off them,
  // so they have to be kept. Wrapped rather than reached into, because `report` is
  // the real channel the curriculum is judged on.
  const reports: Reported[] = []
  const watched: Host = { ...host, report: (r) => reports.push(r) }
  const game = new TrebuchetGame(dom.el, watched, 0xb01de)
  game.manualDrive()
  assert.ok(runUntil(game, () => game.currentPhase === 'aim'), 'wave 1 never stocked')
  assert.equal(game.currentWindCap(), 0, 'a child on her first wave was handed a wind')

  let felled = 0
  let firstWindyShot = -1
  const caps: number[] = []
  for (let shot = 0; shot < 60; shot++) {
    if (game.currentPhase !== 'aim' && !runUntil(game, () => game.currentPhase === 'aim', 3000)) break
    // Every shot below is the correct compensation, so nothing here may ever be
    // reading a completed sum. If one were, #774's reveal would hold the world and
    // this loop would count keeps that never fell.
    assert.equal(game.revealedSum(), null, `shot ${shot}: the siege is stopped on a reveal`)
    const answer = game.currentAnswer()
    if (answer < 0) break
    const cap = game.currentWindCap()
    caps.push(cap)
    // Before she has felled FIRST_WIND keeps, the chip may not be showing anything.
    if (felled < FIRST_WIND) {
      assert.equal(cap, 0, `the wind blew after only ${felled} keeps`)
      assert.equal(game.currentWind(), 0, `the chip read ${game.currentWind()} after ${felled} keeps`)
    } else if (firstWindyShot < 0 && cap > 0) firstWindyShot = shot
    game.aimAt(correctDial(game))
    const want = felled + 1
    game.fireNow()
    if (!runUntil(game, () => reports.length >= want, 600)) break
    // Counted off the host's own record, not off "a shot went out": a wrong answer
    // would report too, and it must not be mistaken for a keep on the ground.
    assert.equal(reports[want - 1].correct, true, `shot ${shot} was scored wrong`)
    felled++
  }
  assert.ok(felled >= FIRST_WIND, `only ${felled} keeps fell across ${caps.length} shots`)
  assert.ok(firstWindyShot >= 0, `the wind never arrived across ${caps.length} shots: ${caps.join(',')}`)
  // ...and once it arrives it never goes away again. The old behaviour would fail
  // here: a cap of 0 after a cap of 3 is the wave-8 hole in the measurement above.
  const started = caps.findIndex((c) => c > 0)
  for (let i = started; i < caps.length; i++) {
    assert.ok(caps[i] > 0, `the wind stopped at shot ${i}: ${caps.join(',')}`)
  }
  // And when it does arrive it is a real subtraction, never a nudge the blast eats.
  for (const c of caps) assert.ok(c === 0 || c >= WIND_MIN, `a cap of ${c} is not arithmetic`)
})

/* ------------------------------------------------------------------ *
 * The band, which the harness above does not have.
 * ------------------------------------------------------------------ */

/**
 * A host that behaves like the shipped one *including its band*.
 *
 * `ladderHost` models a host that serves whatever rung it is asked for, and
 * every search test in this file passed against it while the game was showing
 * the founder an empty prompt frame over an empty field on a real tablet. What
 * it was missing is `HINT_BAND`: since host 0.3.7 a `difficulty` is a HINT,
 * clamped to one rung either side of where the host's own evidence stands, and
 * that evidence opens at rung 0 every session. So the sweep asked for rung 18
 * a hundred times and was served rung 1 a hundred times.
 *
 * `minDifficulty` is the host's capability channel and is honoured absolutely,
 * because a question the game cannot put on the field is not a question. This
 * host honours it the way `items.ts` does: after the band, ceil-rounded, and it
 * never moves the ladder — a pack does not get to promote a child by declaring
 * what it can draw.
 */
function bandedHost(opts: { standing?: number; rungs?: typeof RUNGS } = {}): {
  host: Host
  asks: number[]
  floors: Array<number | null>
  served: number[]
} {
  const table = opts.rungs ?? RUNGS
  const span = 65
  const standing = opts.standing ?? 0
  const asks: number[] = []
  const floors: Array<number | null> = []
  const served: number[] = []
  let want: number | null = null
  let floor: number | null = null
  let n = 0
  const host: Host & {
    setDifficulty?: (d: number) => void
    setMinDifficulty?: (d: number | null) => void
  } = {
    next: (): Question => {
      n++
      const asked = want === null ? standing : Math.round(want * span)
      let index = Math.max(standing - 1, Math.min(standing + 1, asked))
      if (floor !== null) index = Math.max(index, Math.ceil(floor * span))
      index = Math.max(0, Math.min(span, index))
      const ordinate = index / span
      const band = table.find((b) => ordinate < b.upto) ?? table[table.length - 1]
      const spread = band.hi - band.lo + 1
      const a = band.lo + ((n * 7) % spread)
      served.push(ordinate)
      return {
        id: `q${n}`,
        prompt: `? = ${a}`,
        answer: String(a),
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
      want = d
    },
    setMinDifficulty: (d: number | null) => {
      floors.push(d)
      floor = d
    },
  }
  return { host, asks, floors, served }
}

test('the opening wave stocks against a host that clamps a difficulty to its own band', () => {
  // **The founder's screenshot, reproduced and then fixed.** 0.3.9, Android,
  // portrait: the prompt box drew as an empty rounded rectangle and the range
  // held no keeps at all. The trebuchet, the ground, the ruler and every control
  // rendered normally, because the pack mounts and lays out fine — it had simply
  // been handed a hundred probes' worth of `dw.add.facts` and could not stand a
  // keep at an answer of 7.
  //
  // Nothing in this pack had changed. `HINT_BAND` landed in the host in 0.3.7
  // and there was no channel through which a game could say "I cannot draw a
  // question that easy", only one for "I cannot draw a question that hard".
  const dom = installDom()
  const { host, floors } = bandedHost({ standing: 0 })
  const game = new TrebuchetGame(dom.el, host, 0xb01de)
  game.manualDrive()

  assert.ok(
    runUntil(game, () => game.currentPhase === 'aim'),
    'the wave never became playable — the search was served the bottom of the ladder on every ' +
      'probe and dropped every answer, which is an empty prompt frame over an empty field',
  )
  const answer = game.currentAnswer()
  assert.notEqual(answer, -1, 'there is no question on the screen')
  assert.ok(game.towerRanges().length > 0, 'the range has no keeps standing on it')
  assert.ok(game.towerRanges().includes(answer), 'the answer has no keep to knock down')

  // And it got there by SAYING what it cannot draw, not by luck.
  assert.ok(floors.length > 0, 'the pack never stated a floor, so the band was never escaped')
})

test('every probe states the floor it is probing, so the sweep is a sweep', () => {
  // The floor moves WITH the search. A pack that stated one floor and then swept
  // its `difficulty` underneath it would be pinned at the opening guess forever,
  // because the floor is the only channel the host honours — the `difficulty`
  // under it is a hint the band eats. And the opening guess is documented as a
  // guess: answer magnitude is not monotonic in the ladder, which is the whole
  // reason `stock()` walks instead of bisecting.
  //
  // So the ladder here has NOTHING placeable at the opening probe. A floor
  // stated once and held pins the served rung there and the wave never stocks;
  // a floor that follows the sweep climbs out. A table whose opening probe is
  // already placeable was written here first and proved neither.
  const dom = installDom()
  const { host, asks, floors } = bandedHost({
    standing: 0,
    rungs: [
      { upto: 0.5, lo: 0, hi: 9 }, // where the search opens — unplaceable
      { upto: 1.01, lo: 20, hi: 90 }, // placeable, and only reachable by sweeping
    ],
  })
  const game = new TrebuchetGame(dom.el, host, 0xb01de)
  game.manualDrive()

  assert.ok(
    runUntil(game, () => game.currentPhase === 'aim'),
    'the search never climbed out of the unplaceable rungs it opened on — a floor that does not ' +
      'follow the sweep is a floor that pins it',
  )
  assert.notEqual(game.currentAnswer(), -1, 'there is no question on the screen')

  assert.ok(asks.length > 1, 'the search stocked on its first probe, so it never had to move')
  assert.equal(
    floors.length,
    asks.length,
    `the pack made ${String(asks.length)} difficulty requests and stated ${String(floors.length)} ` +
      `floors — a probe without a floor is a probe the band eats`,
  )
  for (let i = 0; i < asks.length; i++) {
    assert.equal(
      floors[i],
      asks[i],
      `probe ${String(i)} asked for ${String(asks[i])} and declared a floor of ${String(floors[i])}`,
    )
  }
})
