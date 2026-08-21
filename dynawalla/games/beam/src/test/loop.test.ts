// The whole game, played headlessly.
//
// Every other test in this package proves a rule in isolation. This one proves
// the rules are wired to each other: it mounts the real `mountBeam` against a
// stub surface, drives the real frame loop on a virtual clock, hammers the real
// input handlers, and watches what comes out of `host.report`.
//
// It is not a rendering test — the 2D context is a no-op recorder and nothing
// about pixels is asserted. What is asserted is that a CORE can be drawn,
// descend, fracture, be intercepted from a beam that divides one of its
// candidates, and be reported; and that three minutes of adversarial input
// never throws.

import { test } from "node:test"
import assert from "node:assert/strict"

import { mount } from "../contract.ts"
import { Rng } from "../core/rng.ts"
import { noteRead, resetReadForTest } from "../sim/learned.ts"
import { CALM_CORES } from "../sim/opening.ts"
import { createStubHost } from "../stubHost.ts"

type Handler = (e: unknown) => void

/**
 * A surface with no pixels. Every context method returns the context itself, so
 * `createLinearGradient(...).addColorStop(...)` chains without a real canvas
 * and every drawing call is a no-op that still has to *typecheck at runtime*.
 */
function stubSurface(
  width: number,
  height: number,
  wallClock: number,
  cores: number,
): {
  el: HTMLElement
  install(step?: number): () => void
  pump(): (ms: number) => void
  keys: Map<string, Handler>
} {
  const rect = { left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0 }
  const keys = new Map<string, Handler>()
  const noop = new Proxy(function () {} as unknown as Record<string, unknown>, {
    get: (_t, prop) => (prop === "then" ? undefined : noop),
    set: () => true,
    apply: () => noop,
  }) as unknown as CanvasRenderingContext2D

  // Rich enough for the shared how-to-play surface, which is real DOM: a
  // button, a dialog, a stylesheet and an inset probe appended to `body`. It
  // is built once at mount and torn down in `unmount`, so it is on the path of
  // every test in this file whether or not the test is about instructions.
  const makeEl = (): HTMLElement => {
    const el = {
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
      addEventListener: (k: string, h: Handler) => keys.set(k, h),
      removeEventListener: (k: string) => keys.delete(k),
    }
    return el as unknown as HTMLElement
  }

  let pending: ((t: number) => void) | null = null
  let clock = 0

  const saved = {
    raf: globalThis.requestAnimationFrame,
    caf: globalThis.cancelAnimationFrame,
    ro: (globalThis as { ResizeObserver?: unknown }).ResizeObserver,
    now: performance.now,
    key: globalThis.addEventListener,
    unkey: globalThis.removeEventListener,
    dpr: (globalThis as { devicePixelRatio?: number }).devicePixelRatio,
    doc: (globalThis as { document?: unknown }).document,
    dateNow: Date.now,
    nav: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
  }

  /**
   * @param step where on the ramp this child is; the steady state by default,
   *   because every case in this file was written about the shipped game. See
   *   the same parameter in `comprehension.test.ts`, and `opening.test.ts` for
   *   the file that asks for a first sitting.
   */
  const install = (step: number = CALM_CORES): (() => void) => {
    // The ramp's memory is module state, node has no `localStorage`, and two
    // `play()` calls in one process would otherwise be two different games.
    resetReadForTest()
    for (let i = 0; i < step; i++) noteRead()
    globalThis.requestAnimationFrame = ((cb: (t: number) => void): number => {
      pending = cb
      return 1
    }) as typeof globalThis.requestAnimationFrame
    globalThis.cancelAnimationFrame = ((): void => {
      pending = null
    }) as typeof globalThis.cancelAnimationFrame
    ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe(): void {}
      disconnect(): void {}
    }
    performance.now = () => clock
    // The game seeds its own run RNG from the wall clock, which is right on a
    // tablet and fatal in a test: a suite that is green four runs out of five
    // has proved nothing. Pinning `Date.now` makes a whole play-through
    // reproducible, and the seed is what varies between them.
    Date.now = () => wallClock
    // The quality tier is read once from `navigator.hardwareConcurrency`, so
    // this is the knob that decides whether the game runs LOW or HIGH.
    Object.defineProperty(globalThis, "navigator", {
      value: { hardwareConcurrency: cores },
      configurable: true,
      writable: true,
    })
    ;(globalThis as { devicePixelRatio?: number }).devicePixelRatio = 2
    globalThis.addEventListener = ((k: string, h: Handler): void => {
      keys.set(k, h)
    }) as unknown as typeof globalThis.addEventListener
    globalThis.removeEventListener = ((k: string): void => {
      keys.delete(k)
    }) as unknown as typeof globalThis.removeEventListener
    // `getElementById` and `body` are what the safe-area probe needs: it
    // measures `env(safe-area-inset-*)` through a hidden fixed element, because
    // `env()` cannot be read from JavaScript any other way. There is no
    // `getComputedStyle` here, so it correctly reads zeros and node gets the
    // plain full-screen layout.
    ;(globalThis as { document?: unknown }).document = {
      createElement: () => makeEl(),
      getElementById: () => null,
      body: makeEl(),
    }
    return () => {
      globalThis.requestAnimationFrame = saved.raf
      globalThis.cancelAnimationFrame = saved.caf
      ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = saved.ro
      performance.now = saved.now
      ;(globalThis as { devicePixelRatio?: number }).devicePixelRatio = saved.dpr
      globalThis.addEventListener = saved.key
      globalThis.removeEventListener = saved.unkey
      ;(globalThis as { document?: unknown }).document = saved.doc
      Date.now = saved.dateNow
      if (saved.nav) Object.defineProperty(globalThis, "navigator", saved.nav)
    }
  }

  return {
    el: makeEl(),
    install,
    pump: () => (ms: number) => {
      clock += ms
      const cb = pending
      pending = null
      cb?.(clock)
    },
    keys,
  }
}

type Report = { questionId: string; correct: boolean; ms: number; answered: string }

function play(seed: number, frames: number, reducedMotion: boolean, cores = 12): Report[] {
  const surface = stubSurface(768, 1024, seed * 7919, cores)
  const restore = surface.install()
  const reports: Report[] = []
  const host = createStubHost({
    seed,
    reducedMotion,
    onReport: (r) => reports.push(r),
  })
  const handle = mount(surface.el, host)
  const step = surface.pump()
  const rng = new Rng(seed ^ 0x51de)
  const press = (key: string): void => {
    surface.keys.get("keydown")?.({ key, preventDefault: () => undefined })
  }
  try {
    for (let i = 0; i < frames; i++) {
      step(16)
      // A child's hands: mostly moving, firing often, and occasionally leaning
      // on the trigger the way a five-year-old does.
      if (rng.chance(0.09)) press(rng.chance(0.5) ? "ArrowLeft" : "ArrowRight")
      if (rng.chance(0.22)) press(" ")
    }
  } finally {
    handle.unmount()
    restore()
  }
  return reports
}

test("the whole loop runs: a core descends, fractures, is intercepted and reported", () => {
  // Pooled over six seeds rather than asserted on one. A single run of random
  // flailing hitting the canonical candidate is a coin toss, and a suite that
  // depends on a coin toss is a suite that goes red for no reason.
  const runs = [0x10be, 0x20be, 0x30be, 0x40be, 0x50be, 0x60be].map((s) => play(s, 3000, false))
  const reports = runs.flat()
  // 3000 frames at 16ms is 48 seconds each, so 288 seconds of play in total.
  // Random input — a bot that never once decides to answer — measures 30 items
  // out of that, one every nine and a half seconds, and a child who reads sees
  // them faster because a wave ends the moment it is answered. The floor is set
  // well under the measurement; what it guards against is a regression to the
  // first cadence tried, which managed twelve.
  assert.ok(reports.length >= 22, `only ${reports.length} items in 288s of play`)
  assert.ok(
    runs.every((r) => r.length > 0),
    "one of the six runs never served a single item",
  )
  assert.ok(
    reports.some((r) => r.correct),
    "random play never once hit the canonical candidate",
  )
  assert.ok(
    reports.some((r) => !r.correct),
    "random play never once missed",
  )
})

test("the quality tier cannot change the game — decoration never moves the maths", () => {
  // This is the invariant that a shared RNG broke: the particle emitters draw
  // once per spark, and the tier scales the spark count, so a four-core tablet
  // consumed a different number of draws and played a different game from the
  // same seed than a twelve-core one. Same seed, opposite ends of the tier
  // table, identical stream of answers.
  for (const seed of [0x9a1, 0x9a2, 0x9a3]) {
    assert.deepEqual(
      play(seed, 2400, false, 2),
      play(seed, 2400, false, 32),
      `seed ${seed} played differently on a cheap device than on an expensive one`,
    )
  }
})

test("a run is reproducible from its seed", () => {
  assert.deepEqual(play(0x7e57, 2400, false), play(0x7e57, 2400, false))
  assert.notDeepEqual(play(0x7e57, 2400, false), play(0x7e58, 2400, false))
})

test("nothing is ever reported that the host did not serve", () => {
  for (const r of play(0x2222, 5000, false)) {
    assert.ok(r.questionId.length > 0, "a report carried no item id")
    assert.ok(Number.isInteger(r.ms) && r.ms >= 0, `bad latency ${r.ms}`)
    // A value was struck. That is the only thing this game reports, so the
    // answer is always a numeral — never a float, never a sign, never a
    // fragment, and never the empty string.
    //
    // The clause here used to be `r.answered === "" || /^\d+$/` with a
    // follow-up asserting that an empty answer came with `correct: false`.
    // Both were dead: they described the timeout report, which is now a
    // `skip`, and no test in this package had ever reached one anyway.
    assert.ok(/^\d+$/.test(r.answered), `bad answer "${r.answered}"`)
  }
})

test("an item is reported at most once", () => {
  const seen = new Set<string>()
  for (const r of play(0x3333, 5000, false)) {
    assert.ok(!seen.has(r.questionId), `${r.questionId} was reported twice`)
    seen.add(r.questionId)
  }
})

test("the reduced-motion branch plays the same game, not a lesser one", () => {
  // Not asserted equal to the motion branch: hitstop and slow-motion really do
  // change how much simulation a frame carries, and reduced motion switches
  // both off. What must hold is that it is the same game — items arrive, and
  // they can be answered.
  const reports = [0x4444, 0x5555, 0x6666].flatMap((s) => play(s, 4000, true))
  assert.ok(reports.length >= 10, `reduced motion only produced ${reports.length} items`)
  assert.ok(reports.some((r) => r.correct))
  assert.ok(reports.some((r) => !r.correct))
})

test("mounting and unmounting repeatedly leaves nothing running", () => {
  for (let i = 0; i < 12; i++) play(0x5000 + i, 220, i % 2 === 0, i % 3 === 0 ? 2 : 12)
})

test("a very small viewport is still a playable lattice", () => {
  const surface = stubSurface(320, 480, 0x2b1d, 4)
  const restore = surface.install()
  const host = createStubHost({ seed: 7, reducedMotion: false })
  const handle = mount(surface.el, host)
  const step = surface.pump()
  try {
    for (let i = 0; i < 900; i++) {
      step(16)
      if (i % 7 === 0) surface.keys.get("keydown")?.({ key: " ", preventDefault: () => undefined })
    }
  } finally {
    handle.unmount()
    restore()
  }
})

test("PAUSE STOPS THE CLOCK: a wave cannot expire behind the host's sheet", () => {
  // The failure this exists to make impossible: the host puts a sheet over a
  // still-mounted pack — and the call most likely to raise one is this game's
  // own `transition()` — while the candidates keep falling underneath it. The
  // window closes, the item is reported wrong, and the child was never shown
  // the question.
  const surface = stubSurface(768, 1024, 0xba5e0, 12)
  const restore = surface.install()
  const reports: Report[] = []
  // BOTH endings are watched, and that is not tidiness. An item that runs out
  // is no longer an answer — it is a `skip` — so a test that watched only
  // `report` would have gone quiet about the exact failure this test is named
  // after: a wave expiring behind a sheet the child was never shown.
  const resolved: string[] = []
  const host = createStubHost({
    seed: 0x9e11,
    reducedMotion: false,
    onReport: (r) => {
      reports.push(r)
      resolved.push(r.questionId)
    },
    onSkip: (id) => resolved.push(id),
  })
  const handle = mount(surface.el, host)
  const step = surface.pump()
  const press = (key: string): void => {
    surface.keys.get("keydown")?.({ key, preventDefault: () => undefined })
  }
  try {
    // Play until a wave is certainly in the air and at least one item has run.
    for (let i = 0; i < 900; i++) {
      step(16)
      if (i % 5 === 0) press(" ")
    }
    assert.ok(resolved.length > 0, "nothing was resolved before the pause")
    const before = resolved.length

    handle.setPaused(true)
    // Three minutes behind the sheet, with the child mashing at it throughout.
    for (let i = 0; i < 11_250; i++) {
      step(16)
      if (i % 5 === 0) press(" ")
      if (i % 11 === 0) press("ArrowLeft")
    }
    assert.equal(resolved.length, before, "an item was resolved while the game was paused")

    handle.setPaused(false)
    for (let i = 0; i < 3000; i++) {
      step(16)
      if (i % 5 === 0) press(" ")
      if (i % 13 === 0) press("ArrowRight")
    }
    assert.ok(resolved.length > before, "the game did not come back after the sheet lifted")
  } finally {
    handle.unmount()
    restore()
  }

  // And the sheet's three minutes are not billed to the child. Every latency is
  // bounded by the answering window, which is nowhere near a minute.
  for (const r of reports) {
    assert.ok(r.ms < 60_000, `a report carried ${r.ms}ms — the pause leaked into the latency`)
  }
})

test("pausing twice is not two pauses, and resuming an unpaused game is nothing", () => {
  const surface = stubSurface(768, 1024, 0x1d3, 12)
  const restore = surface.install()
  const reports: Report[] = []
  const host = createStubHost({ seed: 0x1d3, reducedMotion: false, onReport: (r) => reports.push(r) })
  const handle = mount(surface.el, host)
  const step = surface.pump()
  try {
    handle.setPaused(false)
    for (let i = 0; i < 600; i++) step(16)
    handle.setPaused(true)
    handle.setPaused(true)
    const before = reports.length
    for (let i = 0; i < 3000; i++) step(16)
    assert.equal(reports.length, before)
    handle.setPaused(false)
    handle.setPaused(false)
    for (let i = 0; i < 1200; i++) step(16)
  } finally {
    handle.unmount()
    restore()
  }
  for (const r of reports) assert.ok(r.ms < 60_000)
})

test("a stalled tab that resumes does not teleport the lattice into the floor", () => {
  // A backgrounded tab hands the loop one enormous frame when it comes back.
  // The clamp has to swallow it, or every automaton on screen lands at once.
  const surface = stubSurface(768, 1024, 0x77a1, 12)
  const restore = surface.install()
  const reports: Report[] = []
  const host = createStubHost({ seed: 9, reducedMotion: false, onReport: (r) => reports.push(r) })
  const handle = mount(surface.el, host)
  const step = surface.pump()
  try {
    for (let i = 0; i < 400; i++) step(16)
    step(45_000) // forty-five seconds hidden
    for (let i = 0; i < 400; i++) step(16)
  } finally {
    handle.unmount()
    restore()
  }
  // Nothing threw, and the run did not silently end during the stall.
  assert.ok(reports.every((r) => r.ms >= 0))
})
