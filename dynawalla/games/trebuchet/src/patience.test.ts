/**
 * THE REVEAL — the completed sum, and the fact that nothing moves under it.
 *
 * The fleet's reveal-patience audit found two things about this game and they
 * are both here, driven through the real `TrebuchetGame` on the real clock:
 *
 *   1. **The reveal was a visual no-op on waves 1 to 8.** `waveConfig` sets
 *      `banners: true` for those waves, so every keep already wore its number,
 *      and the whole reveal was "draw that banner again" — behind a fill clause
 *      (`reveal && !showBanner`) that could not even change its colour. A
 *      child's entire first session had no correction in it at all.
 *   2. **The ram advanced through `settle`.** The world kept moving while she
 *      read, on a 1.6-second countdown she had no say in.
 *
 * Every test below drives the actual simulation and reads what a child would
 * see. **Every loop in this file is bounded and the bound is asserted**, which
 * is not decoration: a reveal that never expires makes an unbounded
 * `while (!done)` immortal, and a test that hangs reports nothing at all.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import type { Host, Question } from './contract.ts'
import { TrebuchetGame } from './game.ts'
import { hudLayout } from './render/hud.ts'
import { REVEAL_SETTLE_MS, revealPlan, SECOND_GRADE_FLOW } from '../../../packs/shared/game-pacing/index.ts'

/* ---------------------------------------------------------------- the glass */

type Listeners = Map<string, Array<(e: unknown) => void>>

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
  return {
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
}

const VIEW = { w: 1024, h: 768 }

function installDom(): { el: HTMLElement; canvas: Record<string, unknown>; keys: Listeners } {
  const created: Array<Record<string, unknown>> = []
  const keys: Listeners = new Map()
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
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      const list = keys.get(type) ?? []
      list.push(fn)
      keys.set(type, list)
    },
    removeEventListener: () => undefined,
  }
  g.requestAnimationFrame = () => 1
  g.cancelAnimationFrame = () => undefined
  const el = stubElement('div', VIEW.w, VIEW.h) as unknown as HTMLElement
  return {
    el,
    keys,
    get canvas() {
      return created.find((c) => c.tagName === 'CANVAS') as Record<string, unknown>
    },
  }
}

/* ----------------------------------------------------------------- driving */

type Reported = { questionId: string; correct: boolean; ms: number; answered: string }

function recordingHost(
  answers: number[],
  difficulty: number,
): { host: Host; reports: Reported[]; served: () => number } {
  const reports: Reported[] = []
  let n = 0
  const host: Host = {
    next: (): Question => {
      const a = answers[n % answers.length]
      n++
      return {
        id: `q${n}`,
        prompt: `${a - 10} + 10`,
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
  return { host, reports, served: () => n }
}

/** The one bound this file trusts. Everything that waits, waits this long at most. */
const MAX_FRAMES = 900

/**
 * Step until `done`, or give up.
 *
 * Bounded, and the bound is what every caller asserts on. An unbounded loop
 * against a reveal that never expires is a test that hangs — the CI symptom of
 * which is a job that reports nothing, which is indistinguishable from a pass
 * until somebody looks at the clock.
 */
function runUntil(game: TrebuchetGame, done: () => boolean, maxFrames = MAX_FRAMES): boolean {
  for (let i = 0; i < maxFrames; i++) {
    game.stepFrames(1)
    if (done()) return true
  }
  return false
}

function tapField(canvas: Record<string, unknown>): void {
  const listeners = canvas.__listeners as Listeners
  for (const fn of listeners.get('pointerdown') ?? []) {
    fn({ clientX: VIEW.w * 0.5, clientY: VIEW.h * 0.62, pointerId: 1 })
  }
}

function tapButton(canvas: Record<string, unknown>, id: string): void {
  const layout = hudLayout(VIEW.w, VIEW.h, { x: 0, y: 0, w: VIEW.w, h: VIEW.h })
  const btn = layout.buttons.find((b) => b.id === id)
  assert.ok(btn, `no ${id} button in the HUD`)
  const listeners = canvas.__listeners as Listeners
  for (const fn of listeners.get('pointerdown') ?? []) {
    fn({ clientX: btn.x + btn.w / 2, clientY: btn.y + btn.h / 2, pointerId: 1 })
  }
}

function newGame(
  answers: number[],
  wave: number,
  difficulty: number,
): ReturnType<typeof installDom> & { game: TrebuchetGame; reports: Reported[]; served: () => number } {
  const dom = installDom()
  const { host, reports, served } = recordingHost(answers, difficulty)
  const game = new TrebuchetGame(dom.el, host, 0xb01de)
  game.manualDrive()
  game.jumpToWave(wave)
  assert.ok(runUntil(game, () => game.currentPhase === 'aim'), 'the wave never became playable')
  assert.notEqual(game.currentAnswer(), -1, 'the wave became playable with an empty rack')
  return { ...dom, game, reports, served }
}

/** Fire at a metre that is not the answer, and settle into whatever follows. */
function miss(game: TrebuchetGame, canvas: Record<string, unknown>): void {
  // Three metres past the answer: wrong, and inside `MIN_GAP` so it cannot
  // accidentally be another keep's number.
  game.aimAt(game.currentAnswer() - game.currentWind() + 3)
  tapButton(canvas, 'fire')
  assert.ok(
    runUntil(game, () => game.currentPhase === 'impact' || game.currentPhase === 'settle'),
    'the shot never landed',
  )
}

/* ------------------------------------------------------------------- tests */

test('a miss on WAVE ONE completes the sum in front of the child', () => {
  // Precisely where there was no reveal at all. Wave 1 has `banners: true`, so
  // the old reveal drew a banner that was already on the screen, in the same
  // colour, in the same place — nothing changed and nothing was corrected.
  const { game, canvas } = newGame([56, 72, 88], 1, 0.3)
  assert.equal(game.revealedSum(), null, 'the sum is up before anything went wrong')

  const answer = game.currentAnswer()
  miss(game, canvas)
  game.stepFrames(2)

  const sum = game.revealedSum()
  assert.ok(sum !== null, 'a miss on wave 1 showed the child nothing')
  assert.ok(sum.includes(String(answer)), `the reveal "${sum}" does not contain the answer ${answer}`)
  assert.ok(sum.includes('='), `the reveal "${sum}" is not a completed sum`)
  // Never a telling-off. The HUD has no words in it and the reveal adds none.
  assert.ok(!/wrong|WRONG|✗|✕|X/.test(sum), `the reveal says "${sum}"`)
})

test('nothing advances underneath the reveal — the ram included', () => {
  // The audit's finding, in the wave where it bites: 7 is the first wave with a
  // ram, and `ramAdvances` lets it roll through `settle` — which is exactly the
  // beat a reveal occupies. A child reading the answer was losing ground for it.
  const { game, canvas, reports, served } = newGame([56, 72, 88, 40], 7, 0.3)
  const ram = game.ramRangeM()
  assert.ok(ram !== null, 'wave 7 has no ram, so this test proves nothing')

  miss(game, canvas)
  game.stepFrames(2)
  assert.ok(game.revealedSum() !== null, 'no reveal to hold anything still')

  const phase = game.currentPhase
  const ramAt = game.ramRangeM()
  const reportsAt = reports.length
  const servedAt = served()

  // Ten seconds of real frames. Long enough that the settle beat (0.72 s), the
  // wave-clear card (2.1 s) and the ram's whole approach would all have gone by.
  const frames = 600
  const still = runUntil(game, () => game.revealedSum() === null, frames)
  assert.equal(still, false, `the reveal took itself down inside ${frames} frames`)

  assert.equal(game.currentPhase, phase, 'the phase machine ran under the reveal')
  assert.equal(game.ramRangeM(), ramAt, 'the ram rolled while the child was reading')
  assert.equal(reports.length, reportsAt, 'another answer was reported under the reveal')
  assert.equal(served(), servedAt, 'the game pulled another question under the reveal')
})

test('only a hand takes the sum down, and then the game carries on', () => {
  const { game, canvas } = newGame([56, 72, 88], 1, 0.3)
  miss(game, canvas)
  game.stepFrames(2)
  assert.ok(game.revealedSum() !== null)

  // Past the settle lockout, then one tap.
  runUntil(game, () => false, 40)
  assert.ok(game.revealedSum() !== null, 'the reveal expired on its own')
  tapField(canvas)
  assert.equal(game.revealedSum(), null, 'a hand on the glass did not take the sum down')

  // And the world is moving again — otherwise "held" would just be "broken".
  assert.ok(
    runUntil(game, () => game.currentPhase === 'aim' || game.currentPhase === 'clear'),
    'the game never resumed after the reveal was dismissed',
  )
})

test('a tap still in flight from the last question cannot take it down', () => {
  // Latency, not pedagogy: the gesture that ended the question is routinely
  // still arriving — the second tap of an impatient double-tap, a finger
  // already committed to the fire button. Without the floor the child sees the
  // lesson appear and vanish in the same breath.
  const { game, canvas } = newGame([56, 72, 88], 1, 0.3)
  miss(game, canvas)
  game.stepFrames(1)
  assert.ok(game.revealedSum() !== null)

  // Well inside REVEAL_SETTLE_MS at 60 fps.
  const early = Math.floor((REVEAL_SETTLE_MS / 1000) * 60) - 6
  assert.ok(early > 0, 'the settle window is too short to test')
  for (let i = 0; i < early; i++) {
    tapField(canvas)
    game.stepFrames(1)
    assert.ok(game.revealedSum() !== null, `frame ${i}: a tap inside the settle window dismissed it`)
  }
  // …and once the window has passed, the same tap works.
  runUntil(game, () => false, 12)
  tapField(canvas)
  assert.equal(game.revealedSum(), null, 'the settle window never opened')
})

test('the dismissing gesture cannot also load a different boulder', () => {
  // The path that is NOT protected by the frozen phase. Winding the dial and
  // firing are both phase-gated and the phase is stuck at 'impact' under a
  // reveal — but tapping a rack stone and pressing 1–5 are not, and either one
  // swaps the loaded question AND restarts the answer clock. So the gesture
  // that takes the lesson down would silently change what she is being asked
  // and hand the host a latency measured from the wrong moment.
  //
  // A rack row is laid out from its contents, so rather than reproduce that
  // arithmetic this sweeps the row — with a CONTROL that proves the sweep
  // actually lands on a stone, because a sweep that hits nothing would satisfy
  // the guarded case for the wrong reason.
  const answers = [20, 40, 60, 80, 100]
  const rackY = hudLayout(VIEW.w, VIEW.h, { x: 0, y: 0, w: VIEW.w, h: VIEW.h }).rackTop + 8
  const xs = Array.from({ length: 14 }, (_, i) => VIEW.w * (0.2 + i * 0.045))

  let controlHits = 0
  for (const x of xs) {
    const { game, canvas } = newGame(answers, 5, 0.3)
    const before = game.currentAnswer()
    for (const fn of (canvas.__listeners as Listeners).get('pointerdown') ?? []) {
      fn({ clientX: x, clientY: rackY, pointerId: 1 })
    }
    if (game.currentAnswer() !== before) controlHits++
  }
  assert.ok(controlHits > 0, 'the sweep never touched a rack stone, so the guarded case proves nothing')

  for (const x of xs) {
    const { game, canvas } = newGame(answers, 5, 0.3)
    miss(game, canvas)
    runUntil(game, () => false, 40)
    assert.ok(game.revealedSum() !== null, 'no reveal to guard')
    const before = game.currentAnswer()
    for (const fn of (canvas.__listeners as Listeners).get('pointerdown') ?? []) {
      fn({ clientX: x, clientY: rackY, pointerId: 1 })
    }
    assert.equal(game.revealedSum(), null, 'the tap did not dismiss')
    assert.equal(game.currentAnswer(), before, `a tap at x=${x.toFixed(0)} loaded a different boulder`)
  }
})

test('a key that dismisses the sum cannot also load a different boulder', () => {
  const { game, keys, canvas } = newGame([20, 40, 60, 80, 100], 5, 0.3)
  const press = (key: string): void => {
    for (const fn of keys.get('keydown') ?? []) fn({ key, shiftKey: false, preventDefault: () => undefined })
  }
  // The control: 1–5 really do swap the loaded stone.
  const start = game.currentAnswer()
  press('4')
  assert.notEqual(game.currentAnswer(), start, 'the number keys do not select a boulder, so nothing is proved')

  miss(game, canvas)
  runUntil(game, () => false, 40)
  assert.ok(game.revealedSum() !== null)
  const before = game.currentAnswer()
  press('2')
  assert.equal(game.revealedSum(), null, 'the key did not dismiss')
  assert.equal(game.currentAnswer(), before, 'the dismissing key also loaded a different boulder')
})

test('the tap that dismisses the sum does not also wind the dial', () => {
  // A reveal that does not CONSUME its own dismissal is worse than no reveal.
  // A tap on the field is how this game aims — it jumps the dial to the metre
  // under the finger — so the same touch that takes the lesson down would set
  // her answer to wherever she happened to be looking, and the next boulder
  // would be thrown at a number she never chose.
  const { game, canvas } = newGame([56, 72, 88], 1, 0.3)
  miss(game, canvas)
  runUntil(game, () => false, 40)
  assert.ok(game.revealedSum() !== null)

  const dial = game.stats().dial
  const phase = game.currentPhase
  tapField(canvas)
  assert.equal(game.revealedSum(), null, 'the tap did not dismiss')
  assert.equal(game.stats().dial, dial, 'the dismissing tap also wound the dial')
  assert.equal(game.currentPhase, phase, 'the dismissing tap also fired a boulder')
})

test('mastery skips the ceremony instead of shortening it', () => {
  // Adaptation lives in the reveal's EXISTENCE, not its length. Above intensity
  // ~0.75 `revealPlan` returns `holdMs: 0`, and skipping the beat is the reward
  // for being good — not a half-patient reveal that is long enough to notice
  // and too short to read.
  const hard = 0.9
  assert.equal(revealPlan(SECOND_GRADE_FLOW, hard).holdMs, 0, 'the premise of this test has moved')
  const { game, canvas } = newGame([56, 72, 88], 1, hard)
  miss(game, canvas)
  game.stepFrames(2)
  assert.equal(game.revealedSum(), null, 'a child at the top of the ladder was held for a lesson')
  assert.ok(
    runUntil(game, () => game.currentPhase === 'aim' || game.currentPhase === 'clear'),
    'the game did not move straight on',
  )
})

test('a clean hit is never held for a lesson', () => {
  // There is nothing to marinate on in a sum you just got right, and a reveal on
  // every item would turn a flowing game into a queue of dismissals.
  const { game, canvas } = newGame([56, 72, 88], 1, 0.3)
  game.aimAt(game.currentAnswer() - game.currentWind())
  tapButton(canvas, 'fire')
  assert.ok(runUntil(game, () => game.currentPhase === 'impact'), 'the shot never landed')
  assert.ok(
    runUntil(game, () => game.currentPhase === 'aim' || game.currentPhase === 'clear'),
    'a correct answer did not carry straight on',
  )
  assert.equal(game.revealedSum(), null, 'a correct answer put a lesson on the glass')
})

test('the keep she was aiming at is the one that lights up', () => {
  // The old reveal lit the keeps still WANTED, which is the one set guaranteed
  // to exclude the answer she just missed: `markWanted()` runs after her boulder
  // is spent. The lit keep is now the answer, and the answer only.
  const { game, canvas } = newGame([56, 72, 88], 1, 0.3)
  const answer = game.currentAnswer()
  assert.ok(game.towerRanges().includes(answer), 'the answer has no keep')
  assert.deepEqual(game.litKeeps(), [], 'a keep is lit before anything went wrong')

  miss(game, canvas)
  game.stepFrames(4)
  const sum = game.revealedSum()
  assert.ok(sum !== null)
  assert.ok(sum.endsWith(String(answer)), `"${sum}" does not finish on the keep she wanted`)
  assert.deepEqual(game.litKeeps(), [answer], 'the wrong keeps are lit out on the field')

  // …and the field goes dark again when she takes the sum down.
  runUntil(game, () => false, 40)
  tapField(canvas)
  assert.ok(runUntil(game, () => game.litKeeps().length === 0), 'a keep stayed lit after the reveal went')
})

test('there is no clock: a child who is only thinking is never marked', () => {
  // The version of "a timeout must never be reported as incorrect" that this
  // game can have — it has no timer at all, and that is the property to keep.
  // A clock that quietly reported a lapse as a wrong answer would poison the
  // ladder and make guessing free, and it would do it invisibly.
  const { game, reports } = newGame([56, 72, 88, 40], 7, 0.3)
  const ram = game.ramRangeM()
  assert.ok(ram !== null, 'wave 7 has no ram, so the harshest case is not covered')

  // Fifteen seconds of a child staring at the sum with her hands in her lap.
  const idle = runUntil(game, () => game.currentPhase !== 'aim', MAX_FRAMES)
  assert.equal(idle, false, `the game left 'aim' on its own inside ${MAX_FRAMES} frames`)
  assert.equal(reports.length, 0, 'a child who never fired was marked anyway')
  assert.equal(game.revealedSum(), null, 'a child who never fired was shown a correction')
  assert.equal(game.ramRangeM(), ram, 'the ram closed on a child who was thinking')
})

test('a reveal happens exactly when a wrong ANSWER was reported, over a whole run', () => {
  // The other half of the timeout rule: nothing that is not an answer may raise
  // a correction. Driven over many shots rather than asserted at one moment,
  // because the two failures — a reveal with no report behind it, and a wrong
  // report with no reveal — are opposite mistakes and one test that only ever
  // sees hits would miss both.
  const { game, canvas, reports } = newGame([56, 72, 88, 40], 7, 0.3)
  let misses = 0
  let reveals = 0
  for (let shot = 0; shot < 8; shot++) {
    if (game.currentPhase !== 'aim') {
      if (!runUntil(game, () => game.currentPhase === 'aim')) break
    }
    const before = reports.length
    const wrong = shot % 2 === 0
    game.aimAt(game.currentAnswer() - game.currentWind() + (wrong ? 3 : 0))
    tapButton(canvas, 'fire')
    if (!runUntil(game, () => reports.length > before || game.revealedSum() !== null)) break
    game.stepFrames(2)
    const last = reports[reports.length - 1]
    const shown = game.revealedSum() !== null
    if (last && !last.correct) {
      misses++
      assert.ok(shown, `a wrong answer (${last.answered}) showed the child nothing`)
    } else {
      assert.equal(shown, false, 'a correct answer put a correction on the glass')
    }
    if (shown) {
      reveals++
      runUntil(game, () => false, 40)
      tapField(canvas)
    }
  }
  assert.ok(misses >= 2, `only ${misses} miss(es) were driven, so nothing was proved`)
  assert.equal(reveals, misses, 'reveals and wrong answers did not line up')
})

test('the reveal cannot survive a wave change and freeze the next wave', () => {
  // The failure mode of a beat that only a hand ends: something else tears the
  // question down, the hand never arrives, and the game is stopped forever with
  // no way back. `startWave` clears it, and this is what says so.
  const { game, canvas } = newGame([56, 72, 88], 1, 0.3)
  miss(game, canvas)
  game.stepFrames(2)
  assert.ok(game.revealedSum() !== null)
  game.jumpToWave(2)
  assert.equal(game.revealedSum(), null, 'a stale sum survived into the next wave')
  assert.ok(runUntil(game, () => game.currentPhase === 'aim'), 'the next wave never became playable')
})
