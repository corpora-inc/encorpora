// THE OPENING, MEASURED.
//
// > "LATTICE RUNNER IS TOO FUCKING FAST FOR THE 100TH TIME. NO ONE CAN THINK
// > THAT FAST."
//
// > "Lattice runner is pretty cool but it's too hard and fast for a human ..
// > maybe one number at a time and a slower ramp up from an easier baseline ..
// > first time you enter it could be just one number calmly coming down the
// > lattice .. slower, easier, more hand-holdy. the way it starts for me now is
// > chaotic and impossible."
//
// The second of those was answered in `games/lattice` — a different pack, whose
// display name differs from this one's by one word. This file is that ramp in
// the game the report was about. See `sim/opening.ts` and `README.md`.
//
// ## What it opened with, and what it opens with
//
// Driving the real shell — the real mount, the real frame loop, the real
// keyboard handler — for sixty seconds, five seeds, 768×1024, with a bot that
// slides, fires and dismisses the way a child's hands do:
//
//                                    shipped      first sitting
//     numbered hulls, peak                 8                  2
//     numbered hulls, mean              3.92               1.62
//     the second problem arrives        6.1s              11.2s
//     problems asked in 60s             10.8                5.8
//
// The peak of eight is four ordinary automata and four candidates, all carrying
// numbers, all at once, while the child does a column sum. The first sitting is
// the CORE by itself until it fractures and then two candidates: one sum, two
// answers, nothing else moving.
//
// **And the clock is off during the ramp.** `Director.pressure` is
// `elapsed/90 × 0.65 + kills/60 × 0.45`, so two thirds of the escalation was
// time served rather than anything demonstrated — and `mount.drawWave` asks the
// host for `2 + round(level × 7)`, so it was raising the ARITHMETIC as well as
// the motion. A child who had answered nothing in ninety seconds was at level
// 0.65: five hulls alive, a 1.3s spawn gap, and item difficulty 7.
//
// Nothing is lost at the top: `openingAt(CALM_CORES)` is the shipped game in
// every field, asserted below against the constants themselves.

import assert from "node:assert/strict"
import { test } from "node:test"

import { mount } from "../contract.ts"
import type { Host, Question } from "../contract.ts"
import { Rng } from "../core/rng.ts"
import { Director } from "../sim/director.ts"
import { coresRead, noteMissed, noteRead, resetReadForTest } from "../sim/learned.ts"
import { MAX_CANDIDATES, MIN_CANDIDATES, buildCore } from "../sim/core.ts"
import { CALM_CORES, openingAt, STEADY_OPENING } from "../sim/opening.ts"
import { comprehensionWindow } from "../sim/window.ts"

// ── the table itself ────────────────────────────────────────────────────────

test("the ramp only ever gets busier, faster and harder — never the other way", () => {
  let previous = openingAt(0)
  for (let step = 1; step <= 40; step++) {
    const at = openingAt(step)
    assert.ok(at.ordinaries >= previous.ordinaries, `hulls fell at step ${step}`)
    assert.ok(at.candidates >= previous.candidates, `candidates fell at step ${step}`)
    assert.ok(at.ceiling >= previous.ceiling, `the pressure ceiling fell at step ${step}`)
    // A bigger `descentScale` is a SLOWER crossing, so this one is the other
    // way round and that is exactly the sort of thing a table gets wrong.
    assert.ok(at.descentScale <= previous.descentScale, `the lattice slowed down at step ${step}`)
    assert.ok(
      at.coreGapSeconds <= previous.coreGapSeconds,
      `the gap between problems grew at step ${step}`,
    )
    previous = at
  }
})

test("the calmest step is still a question, and the top step is the shipped game", () => {
  const first = openingAt(0)
  // A choice, not a formality: two answers is the fewest that is a question at
  // all, and the ramp may never take that away to make things easier.
  assert.ok(first.candidates >= MIN_CANDIDATES, "the first core is not a choice")
  assert.equal(first.ordinaries, 0, "the first screen has something else on it")
  assert.equal(first.ceiling, 0, "the clock is running on a child's first sitting")

  // Against the constants the rest of the game is written in, so a change to
  // any of them fails here rather than quietly making the top step a lesser
  // game than the one that shipped.
  const top = openingAt(CALM_CORES)
  assert.deepEqual(top, STEADY_OPENING)
  assert.equal(top.candidates, MAX_CANDIDATES, "the ceiling lost a candidate")
  assert.equal(top.ordinaries, Number.POSITIVE_INFINITY, "the ceiling caps the stream")
  assert.equal(top.descentScale, 1, "the ceiling is not the shipped pace")
  assert.equal(top.coreGapSeconds, 2, "the ceiling is not the shipped cadence")
  assert.equal(top.ceiling, 1, "the ceiling cannot reach the whole pressure curve")
  for (const step of [CALM_CORES, CALM_CORES + 1, 40, 4000]) {
    assert.deepEqual({ ...openingAt(step), step: 0 }, { ...top, step: 0 })
  }
  // Nothing before it is already the full game.
  for (let step = 0; step < CALM_CORES; step++) {
    const at = openingAt(step)
    assert.ok(
      at.ordinaries < top.ordinaries ||
        at.candidates < top.candidates ||
        at.descentScale > top.descentScale ||
        at.ceiling < top.ceiling,
      `step ${step} is already the shipped game`,
    )
  }
  // And nothing that is not a number is a step, and none of them throws.
  for (const bad of [Number.NaN, -1, Number.POSITIVE_INFINITY, -Number.MAX_VALUE]) {
    assert.equal(openingAt(bad).step, 0, `${String(bad)} was not read as the very beginning`)
  }
})

test("the ramp caps the clock, and the clock is what it was at the top", () => {
  const item = { prompt: "247 + 158", answer: 405 }
  const window = comprehensionWindow(item)
  for (const step of [0, 1, 2, 3, 4, CALM_CORES]) {
    const director = new Director()
    director.opening = openingAt(step)
    // Three minutes of a child sitting there answering nothing at all.
    for (let i = 0; i < 180; i++) director.advance(1)
    const p = director.pressure()
    assert.ok(
      p.level <= openingAt(step).ceiling + 1e-9,
      `step ${step}: three minutes of sitting still reached level ${p.level.toFixed(2)}`,
    )
    // The item difficulty `mount.drawWave` would ask for, which is the whole
    // reason a capped clock matters: it is the ARITHMETIC and not the motion.
    const asked = 2 + Math.round(p.level * 7)
    assert.ok(asked <= 2 + Math.round(openingAt(step).ceiling * 7), `step ${step} asked for ${asked}`)
    // And the window never moved for any of it.
    assert.equal(comprehensionWindow(item), window, `step ${step} moved the comprehension window`)
  }
  // The top step reaches the whole curve, unchanged.
  const top = new Director()
  top.opening = openingAt(CALM_CORES)
  for (let i = 0; i < 180; i++) {
    top.advance(1)
    top.recordKill()
  }
  const hot = top.pressure()
  assert.ok(hot.level > 0.99, `the shipped curve no longer reaches the top (${hot.level.toFixed(2)})`)
  assert.equal(hot.descentSeconds, 5.8, "the shipped pace changed at the top of the ramp")
  assert.equal(hot.floorCount, 5, "the shipped stream changed at the top of the ramp")
})

test("nothing on the ramp can touch how long a question is answerable for", () => {
  // The pacing audit's finding, stated for this pack: `window(d)` is a pure
  // function of the item, so a wave built at the calmest step and the same wave
  // built at the busiest carry the same window to the millisecond.
  const source = { id: "q", prompt: "247 + 158", answer: "405", distractors: ["395", "415", "504"] }
  const windows = new Set<number>()
  for (const step of [0, 1, 2, 3, 4, CALM_CORES, 400]) {
    const rng = new Rng(0xc0de)
    const built = buildCore(source, 5, () => rng.next(), openingAt(step).candidates)
    assert.ok(built, `step ${step} could not build the wave`)
    windows.add(built.windowSeconds)
    assert.ok(
      built.candidates.length <= openingAt(step).candidates,
      `step ${step} put ${built.candidates.length} candidates up against a cap of ` +
        `${openingAt(step).candidates}`,
    )
    assert.ok(built.candidates.length >= MIN_CANDIDATES, `step ${step} was not a choice`)
    assert.ok(
      built.candidates.some((c) => c.correct),
      `step ${step} trimmed the answer off its own wave`,
    )
  }
  assert.deepEqual(
    [...windows],
    [comprehensionWindow({ prompt: source.prompt, answer: 405 })],
    "the ramp moved the answering window",
  )
})

// ── the counter ─────────────────────────────────────────────────────────────

test("the step is what the child demonstrated, and it walks both ways", () => {
  resetReadForTest()
  assert.equal(coresRead(), 0)
  for (let i = 1; i <= 4; i++) assert.equal(noteRead(), i)
  assert.equal(noteMissed(), 3)
  assert.equal(noteMissed(), 2)
  // Floored, so the calmest board is a floor and not a hole.
  for (let i = 0; i < 20; i++) noteMissed()
  assert.equal(coresRead(), 0)
  assert.deepEqual(openingAt(coresRead()), openingAt(0))
})

// ── the real shell ──────────────────────────────────────────────────────────

type Snapshot = ReturnType<ReturnType<typeof mount>["snapshot"]>

/**
 * The real game, mounted on a surface with no pixels, driven a frame at a time.
 *
 * Not the sim and not the pure functions: the ramp only reaches a child through
 * the director, the spawn cadence, the fracture and the frame loop, and every
 * one of those lives in `mount.ts`. `hint.test.ts` in a sibling pack once passed
 * with the machinery it was testing entirely unwired, because the wiring lived
 * in the shell.
 */
function shell(step: number, seed: number, viewport: [number, number] = [768, 1024]) {
  resetReadForTest()
  for (let i = 0; i < step; i++) noteRead()
  const [w, h] = viewport
  const rect = { left: 0, top: 0, width: w, height: h, right: w, bottom: h, x: 0, y: 0 }
  const keys = new Map<string, (e: unknown) => void>()
  const noop = new Proxy(function () {} as unknown as Record<string, unknown>, {
    get: (_t, p) => (p === "then" ? undefined : noop),
    set: () => true,
    apply: () => noop,
  }) as unknown as CanvasRenderingContext2D
  const makeEl = (): HTMLElement =>
    ({
      style: { cssText: "" },
      width: 0,
      height: 0,
      id: "",
      type: "",
      className: "",
      textContent: "",
      tabIndex: 0,
      hidden: false,
      scrollTop: 0,
      appendChild: () => undefined,
      append: () => undefined,
      remove: () => undefined,
      focus: () => undefined,
      setAttribute: () => undefined,
      getAttribute: () => null,
      removeAttribute: () => undefined,
      getBoundingClientRect: () => rect,
      getContext: () => noop,
      setPointerCapture: () => undefined,
      releasePointerCapture: () => undefined,
      hasPointerCapture: () => false,
      addEventListener: (k: string, fn: (e: unknown) => void) => keys.set(k, fn),
      removeEventListener: (k: string) => keys.delete(k),
    }) as unknown as HTMLElement

  const saved = {
    raf: globalThis.requestAnimationFrame,
    caf: globalThis.cancelAnimationFrame,
    ro: (globalThis as { ResizeObserver?: unknown }).ResizeObserver,
    now: performance.now,
    key: globalThis.addEventListener,
    unkey: globalThis.removeEventListener,
    doc: (globalThis as { document?: unknown }).document,
    dateNow: Date.now,
    nav: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
  }
  let pending: ((t: number) => void) | null = null
  let clock = 0
  globalThis.requestAnimationFrame = ((cb: (t: number) => void) => {
    pending = cb
    return 1
  }) as typeof globalThis.requestAnimationFrame
  globalThis.cancelAnimationFrame = (() => {
    pending = null
  }) as typeof globalThis.cancelAnimationFrame
  ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe(): void {}
    disconnect(): void {}
  }
  performance.now = () => clock
  Date.now = () => seed * 7919
  Object.defineProperty(globalThis, "navigator", {
    value: { hardwareConcurrency: 12 },
    configurable: true,
    writable: true,
  })
  globalThis.addEventListener = ((k: string, fn: (e: unknown) => void) => {
    keys.set(k, fn)
  }) as unknown as typeof globalThis.addEventListener
  globalThis.removeEventListener = ((k: string) => {
    keys.delete(k)
  }) as unknown as typeof globalThis.removeEventListener
  ;(globalThis as { document?: unknown }).document = {
    createElement: () => makeEl(),
    getElementById: () => null,
    body: makeEl(),
  }

  let served = 0
  const host: Host = {
    // A fixed, small, honest item so the measurement is about the BOARD and not
    // about which question the stub happened to draw.
    next: (): Question => {
      served++
      return {
        id: `q-${String(served)}`,
        prompt: "24 + 12",
        answer: "36",
        distractors: ["26", "46", "63"],
        domain: "add",
        difficulty: 2,
      }
    },
    report: () => undefined,
    skip: () => undefined,
    haptic: () => undefined,
    prefersReducedMotion: () => false,
  }
  const handle = mount(makeEl(), host)
  return {
    handle,
    press: (k: string) => keys.get("keydown")?.({ key: k, preventDefault: () => undefined }),
    step: (ms = 16) => {
      clock += ms
      const cb = pending
      pending = null
      cb?.(clock)
    },
    done: () => {
      handle.unmount()
      globalThis.requestAnimationFrame = saved.raf
      globalThis.cancelAnimationFrame = saved.caf
      ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = saved.ro
      performance.now = saved.now
      globalThis.addEventListener = saved.key
      globalThis.removeEventListener = saved.unkey
      ;(globalThis as { document?: unknown }).document = saved.doc
      Date.now = saved.dateNow
      if (saved.nav) Object.defineProperty(globalThis, "navigator", saved.nav)
    },
  }
}

test("THE FIRST SCREEN IS ONE NUMBER, AND IT IS THE PROBLEM", () => {
  // The founder's own words, as an assertion. Nobody touches anything, so the
  // child cannot leave step 0 and the whole run is the calmest board there is.
  for (const seed of [0x10be, 0x20be, 0x30be, 0x40be, 0x50be]) {
    const rig = shell(0, seed)
    try {
      let sawPrompt = false
      let peak = 0
      let peakOrdinaries = 0
      // Twenty seconds: the gap, the approach, the fall, and the reveal that
      // follows it. More than enough for the busiest moment of a first sitting.
      for (let f = 0; f < 1250; f++) {
        rig.step()
        const s: Snapshot = rig.handle.snapshot()
        if (s.prompt !== null) sawPrompt = true
        peak = Math.max(peak, s.onLattice)
        peakOrdinaries = Math.max(peakOrdinaries, s.ordinaries)
      }
      assert.ok(sawPrompt, `seed ${seed.toString(16)}: no problem ever arrived`)
      assert.equal(
        peakOrdinaries,
        0,
        `seed ${seed.toString(16)}: ${peakOrdinaries} hull(s) with nothing to do with the sum ` +
          `were on a first sitting's lattice`,
      )
      assert.ok(
        peak <= MIN_CANDIDATES,
        `seed ${seed.toString(16)}: ${peak} numbered hulls on a first sitting's lattice`,
      )
    } finally {
      rig.done()
    }
  }
})

test("and the shipped game really does put a crowd on it, which is the point", () => {
  // The other half, and without it the assertion above is a claim about a game
  // nobody plays: the top of the ramp is the board the founder was reporting,
  // unchanged, and it is four times as busy.
  let peak = 0
  for (const seed of [0x10be, 0x20be, 0x30be, 0x40be, 0x50be]) {
    const rig = shell(CALM_CORES, seed)
    try {
      let t = 0
      for (let f = 0; f < 3750; f++) {
        rig.step()
        t = (t + 1) % 23
        if (t === 0) rig.press(" ")
        if (t === 11) rig.press(f % 2 === 0 ? "ArrowLeft" : "ArrowRight")
        peak = Math.max(peak, rig.handle.snapshot().onLattice)
      }
    } finally {
      rig.done()
    }
  }
  assert.ok(
    peak > 2 * MIN_CANDIDATES,
    `the shipped board peaked at ${peak} hulls, so the calm opening is not calmer than anything`,
  )
})

test("reading cores is what moves the board, and a miss moves it back", () => {
  // End to end through the shell: the step is persisted, it is read at mount,
  // and it is the ONLY thing that changes the board. Nothing here advances a
  // clock on purpose — the run is the same length in every case.
  resetReadForTest()
  const rig = shell(0, 0x10be)
  try {
    assert.equal(rig.handle.snapshot().step, 0, "a child with no history did not open at the floor")
    // Four cores read, without playing them: this is the counter's contract and
    // the shell's reading of it, not a claim about the bot's aim.
    for (let i = 0; i < 4; i++) noteRead()
    // The shell re-reads on the next outcome, so drive it far enough to have one.
    for (let f = 0; f < 1400; f++) rig.step()
    assert.ok(
      rig.handle.snapshot().step >= 3,
      `the shell is not reading the counter: it is on step ${rig.handle.snapshot().step} after ` +
        `four cores`,
    )
  } finally {
    rig.done()
  }

  // And a wave that reached the floor unanswered walks it back down. Nobody
  // touches anything, so every wave expires.
  resetReadForTest()
  for (let i = 0; i < CALM_CORES; i++) noteRead()
  const back = shell(CALM_CORES, 0x10be)
  try {
    assert.equal(back.handle.snapshot().step, CALM_CORES)
    let guard = 0
    while (coresRead() === CALM_CORES && guard++ < 4000) {
      back.step()
      // The reveal is held until a hand ends it, so the next wave needs one.
      if (back.handle.snapshot().revealed) back.press(" ")
    }
    assert.ok(
      coresRead() < CALM_CORES,
      "a wave reached the floor unanswered and the board did not get out of the way",
    )
  } finally {
    back.done()
  }
})
