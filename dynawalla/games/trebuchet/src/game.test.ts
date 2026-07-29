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
  return { ...dom, game, reports }
}

/* ------------------------------------------------------------------ tests */

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
