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
 * A host that behaves like the shipped one: the answers it serves depend on the
 * difficulty the game asks for, and the game cannot see the mapping.
 *
 * The numbers are the measured ladder. `ladder()` over the shipped 66 rungs, at
 * the difficulties `waveConfig` asks for, returns `dw.add.facts.subtract-within-ten`
 * (answers 0-9) at the bottom, two-digit answers in the middle, and
 * `dw.add.column.subtract-no-regroup` / `dw.mul.scale.times-power-of-ten`
 * (answers in the thousands and the millions) above it. Only the middle fits on a
 * 122-metre field.
 *
 * `lagPulls` models the other half of the real host: the question pool is refilled
 * ASYNCHRONOUSLY, so the first few `next()` calls after a difficulty change still
 * return the old rung. A game that retried inside one synchronous call would never
 * see the new questions at all.
 */
function ladderHost(lagPulls = 0, startDifficulty = 0.04): { host: Host; asks: number[] } {
  const asks: number[] = []
  let n = 0
  // The resting rung, which is near the bottom — so the very first questions a
  // wave sees are the ones that do not fit, exactly as they do on the device.
  let difficulty = startDifficulty
  let pending: number | null = null
  let lag = 0
  const answerFor = (d: number): number => {
    n++
    // Below the field, on the field, then far above it — monotonic in magnitude,
    // which is what makes the game's search converge.
    if (d < 0.22) return n % 10
    if (d < 0.58) return 14 + ((n * 7) % 100)
    if (d < 0.75) return 2000 + ((n * 137) % 4000)
    return 1_000_000 + n
  }
  const host: Host & { setDifficulty?: (d: number) => void } = {
    next: (): Question => {
      if (pending !== null) {
        if (lag > 0) lag--
        else {
          difficulty = pending
          pending = null
        }
      }
      const a = answerFor(difficulty)
      return {
        id: `q${n}`,
        prompt: `? = ${a}`,
        answer: String(a),
        distractors: [String(a + 11), String(a + 23)],
        domain: 'add-sub',
        difficulty,
      }
    },
    report: () => undefined,
    haptic: () => undefined,
    prefersReducedMotion: () => true,
    setDifficulty: (d: number) => {
      asks.push(d)
      pending = d
      lag = lagPulls
    },
  }
  return { host, asks }
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
  const { host } = ladderHost()
  const game = new TrebuchetGame(dom.el, host, 0xb01de)
  game.manualDrive()

  // Read into a local: asserting on the getter itself narrows its type for the
  // rest of the function, and the loop below has to be free to see any phase.
  const opening: string = game.currentPhase
  assert.equal(opening, 'stocking', 'the wave claimed to be playable')
  assert.equal(game.fireArmed(), false, 'the fire button is lit over an empty rack')

  let armedFrames = 0
  for (let i = 0; i < 900; i++) {
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
  const found = game.stockedDifficulty()
  assert.ok(found !== null && found >= 0.22 && found < 0.58, `settled on an unplaceable rung ${found}`)
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
    for (let i = 0; i < 700; i++) game.stepFrames(1) // ~11 s of frames
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
  const dom = installDom()
  const { host } = ladderHost()
  const game = new TrebuchetGame(dom.el, host, 0xb01de)
  game.manualDrive()
  // Jumped before a single frame runs, so nothing has been found yet and the wave's
  // own difficulty — 0.832, the millions — is genuinely where the search starts.
  game.jumpToWave(12)
  assert.equal(game.stockedDifficulty(), null, 'a band was already known; nothing is being searched')
  assert.equal(game.currentPhase, 'stocking', 'a wave in the millions claimed to be playable')

  assert.ok(
    runUntil(game, () => game.currentPhase === 'aim', 2400),
    'a wave above the field never came back down to it',
  )
  const answer = game.currentAnswer()
  assert.notEqual(answer, -1, 'there is no question on the screen')
  assert.ok(answer >= 14 && answer <= 118, `${answer} does not fit on the field`)
  const found = game.stockedDifficulty()
  assert.ok(found !== null && found < 0.832, `the search never came down from 0.832 (settled ${found})`)
})

test('a wave configured above the field does not drag the game back off it', () => {
  // Once a band is known it is kept. `waveConfig` keeps raising the arithmetic it
  // asks for — 0.83 by wave 12 — and honouring that would walk the stream straight
  // back out of the window the dial can express. The wave's escalation is wind, the
  // wall, the ram and the keeps; the arithmetic stops at the width of the field.
  const dom = installDom()
  const { host } = ladderHost()
  const game = new TrebuchetGame(dom.el, host, 0xb01de)
  game.manualDrive()
  assert.ok(runUntil(game, () => game.currentPhase === 'aim'), 'wave 1 never stocked')
  const band = game.stockedDifficulty()

  game.jumpToWave(12)
  assert.ok(runUntil(game, () => game.currentPhase === 'aim', 2400), 'wave 12 never stocked')
  assert.equal(game.stockedDifficulty(), band, 'the band found at wave 1 was thrown away')
  const answer = game.currentAnswer()
  assert.ok(answer >= 14 && answer <= 118, `${answer} does not fit on the field`)
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
