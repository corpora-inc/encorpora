// THE HALL STOPS WHILE THE RULES ARE READ.
//
// "All games should pause while reading the instructions .. I can hear
// counterweight playing in the background while I'm reading the instructions
// ... stressing me out even more."
//
// The shared how-to-play sheet holds the sound, the keys and the taps by itself.
// What it cannot hold is this game's simulation clock, and LATTICE RUNNER is the
// worst case for that: a child opens the manual BECAUSE an automaton is two
// thirds of the way down and they cannot see which beam divides it. Left
// running, that automaton reaches the floor and puts a light out while the child
// is reading why.
//
// So this drives the real button. It does NOT call `setPaused` — that path is
// already covered in `loop.test.ts` and calling it here would prove only that a
// function this file also wrote does what it says. It finds the `dwc-help`
// control the shared module mounted, fires its own click handler, and watches
// the world.
//
// Two observables, deliberately. The 2D context counts every call it is asked
// for, so "nothing was drawn" is measured rather than asserted; and the host is
// wrapped, so "nothing was decided" is measured too. A freeze that stopped the
// pixels and not the mathematics would pass one and fail the other.

import assert from "node:assert/strict"
import { test } from "node:test"

import { mount } from "../contract.ts"
import type { Host } from "../contract.ts"
import { createStubHost } from "../stubHost.ts"

type Handler = (e: unknown) => void

type FakeElement = {
  className: string
  id: string
  /**
   * PER ELEMENT, and that is the whole reason this file has its own harness.
   *
   * `loop.test.ts` keeps one listener map keyed by event type for every fake
   * element in the document. Both the help control and the sheet's PLAY button
   * register a `"click"` listener, so in that harness the second silently
   * overwrites the first and there is no way to reach either of them on purpose.
   */
  listeners: Map<string, Handler[]>
  style: Record<string, string>
  [key: string]: unknown
}

type Rig = {
  el: HTMLElement
  created: FakeElement[]
  /** Advance the clock by `ms` and run the frame the game asked for. */
  step(ms: number): void
  /**
   * A key, dispatched the way a browser does it: to every `globalThis`
   * listener in registration order, stopping the moment one of them calls
   * `stopPropagation`. That is what puts the shared module's capture-phase
   * swallow in front of the game's own handler, exactly as it is on a device.
   */
  press(key: string): void
  restore(): void
  counter: { calls: number }
}

/**
 * A surface with no pixels that still counts the work.
 *
 * Every context method returns the context itself so gradient chains resolve
 * without a real canvas, and every call bumps `counter.calls`. BEAM does not
 * draw at all while it is paused — its frame callback returns before `draw` —
 * so a frozen count is exactly the claim being made.
 */
function install(width: number, height: number, wallClock: number): Rig {
  const rect = { left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0 }
  const counter = { calls: 0 }
  const noop = new Proxy(function () {} as unknown as Record<string, unknown>, {
    get: (_t, prop) => (prop === "then" ? undefined : noop),
    set: () => true,
    apply: () => {
      counter.calls++
      return noop
    },
  }) as unknown as CanvasRenderingContext2D

  const created: FakeElement[] = []
  const makeEl = (): FakeElement => {
    const listeners = new Map<string, Handler[]>()
    const el: FakeElement = {
      className: "",
      id: "",
      listeners,
      style: { cssText: "" },
      width: 0,
      height: 0,
      type: "",
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
      addEventListener: (k: string, h: Handler) => {
        listeners.set(k, [...(listeners.get(k) ?? []), h])
      },
      removeEventListener: (k: string, h: Handler) => {
        listeners.set(k, (listeners.get(k) ?? []).filter((f) => f !== h))
      },
    }
    return el
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

  const globals = new Map<string, Handler[]>()
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
  Date.now = () => wallClock
  Object.defineProperty(globalThis, "navigator", {
    value: { hardwareConcurrency: 12 },
    configurable: true,
    writable: true,
  })
  ;(globalThis as { devicePixelRatio?: number }).devicePixelRatio = 2
  globalThis.addEventListener = ((k: string, h: Handler): void => {
    globals.set(k, [...(globals.get(k) ?? []), h])
  }) as unknown as typeof globalThis.addEventListener
  globalThis.removeEventListener = ((k: string, h: Handler): void => {
    globals.set(k, (globals.get(k) ?? []).filter((f) => f !== h))
  }) as unknown as typeof globalThis.removeEventListener
  ;(globalThis as { document?: unknown }).document = {
    createElement: () => {
      const el = makeEl()
      created.push(el)
      return el
    },
    getElementById: (id: string) => created.find((el) => el.id === id) ?? null,
    body: makeEl(),
  }

  return {
    el: makeEl() as unknown as HTMLElement,
    created,
    counter,
    step: (ms: number) => {
      clock += ms
      const cb = pending
      pending = null
      cb?.(clock)
    },
    press: (key: string) => {
      let stopped = false
      const event = {
        key,
        type: "keydown",
        preventDefault: () => undefined,
        stopPropagation: () => {
          stopped = true
        },
      }
      for (const h of globals.get("keydown") ?? []) {
        if (stopped) break
        h(event)
      }
    },
    restore: () => {
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
    },
  }
}

/** The shared module's own controls, found the way a child's finger finds them. */
function control(created: FakeElement[], className: string): () => void {
  const el = created.find((e) => e.className === className)
  assert.ok(el, `the shared chrome never mounted a .${className}`)
  const click = el.listeners.get("click")?.[0]
  assert.ok(click, `.${className} was mounted with no click handler`)
  return () => click({ type: "click", target: el })
}

type World = {
  /** Every ending an item can have: answered, or run out. Both close a wave. */
  resolved: string[]
  /** Items the game asked the host for. A frozen game asks for nothing. */
  asked: number
  reports: Array<{ ms: number }>
}

function stub(world: World): Host {
  const base = createStubHost({
    seed: 0xbea3f,
    reducedMotion: false,
    onReport: (r) => {
      world.reports.push(r)
      world.resolved.push(r.questionId)
    },
    onSkip: (id) => world.resolved.push(id),
  })
  return {
    ...base,
    next: (o) => {
      world.asked++
      return base.next(o)
    },
  }
}

test("MANUAL FREEZES THE HALL: nothing descends, nothing draws, nothing is decided", () => {
  const rig = install(768, 1024, 0x51ee)
  const world: World = { resolved: [], asked: 0, reports: [] }
  const handle = mount(rig.el, stub(world))
  try {
    // Long enough that a wave is certainly in the air and one has been resolved.
    for (let i = 0; i < 2400; i++) {
      rig.step(16)
      if (i % 5 === 0) rig.press(" ")
    }
    assert.ok(world.resolved.length > 0, "nothing happened before the manual was opened")

    const open = control(rig.created, "dwc-help")
    const close = control(rig.created, "dwc-close")

    open()
    const resolved = world.resolved.length
    const asked = world.asked
    const drawn = rig.counter.calls

    // Ninety-six seconds of reading, with the child mashing at the screen the
    // whole time — which is what a five-year-old does with a wall of text.
    for (let i = 0; i < 6000; i++) {
      rig.step(16)
      if (i % 5 === 0) rig.press(" ")
      if (i % 11 === 0) rig.press("ArrowLeft")
    }

    assert.equal(
      rig.counter.calls,
      drawn,
      `${rig.counter.calls - drawn} draw calls went out behind the manual`,
    )
    assert.equal(
      world.resolved.length,
      resolved,
      "an item was resolved while the child was reading the rules",
    )
    assert.equal(world.asked, asked, "the hall asked for a new question behind the manual")

    close()
    for (let i = 0; i < 3000; i++) {
      rig.step(16)
      if (i % 5 === 0) rig.press(" ")
    }
    assert.ok(rig.counter.calls > drawn, "the hall never came back after the manual closed")
    assert.ok(world.resolved.length > resolved, "the run did not resume when the manual closed")
  } finally {
    handle.unmount()
    rig.restore()
  }

  // And the read is not billed to the child. Every latency is bounded by the
  // answering window, which is nowhere near the ninety-six seconds above.
  for (const r of world.reports) {
    assert.ok(r.ms < 60_000, `a report carried ${r.ms}ms — the manual leaked into the latency`)
  }
})

test("THE MANUAL ONLY LIFTS ITS OWN PAUSE: closing it cannot restart a host-paused game", () => {
  // The host puts a sheet over a still-mounted pack — a parent gate, a stopping
  // point — and the child, stuck behind it, opens the rules and closes them
  // again. Without the guard the game is handed back RUNNING underneath the
  // host's own sheet, which is the defect the pause existed to prevent, now
  // reachable by reading.
  const rig = install(768, 1024, 0x51ef)
  const world: World = { resolved: [], asked: 0, reports: [] }
  const handle = mount(rig.el, stub(world))
  try {
    for (let i = 0; i < 2400; i++) {
      rig.step(16)
      if (i % 5 === 0) rig.press(" ")
    }
    assert.ok(world.resolved.length > 0, "nothing happened before the host raised its sheet")

    handle.setPaused(true)
    const drawn = rig.counter.calls
    const resolved = world.resolved.length
    const asked = world.asked

    const open = control(rig.created, "dwc-help")
    const close = control(rig.created, "dwc-close")
    open()
    for (let i = 0; i < 1200; i++) {
      rig.step(16)
      if (i % 5 === 0) rig.press(" ")
    }
    close()
    // Twenty seconds after the manual was put away, and the host has never
    // lifted its sheet.
    for (let i = 0; i < 1200; i++) {
      rig.step(16)
      if (i % 5 === 0) rig.press(" ")
    }

    assert.equal(rig.counter.calls, drawn, "the manual handed a host-paused game back to the loop")
    assert.equal(world.resolved.length, resolved, "an item was resolved behind the host's sheet")
    assert.equal(world.asked, asked, "a question was drawn behind the host's sheet")

    // And the host's own resume still works: the pause was not double-counted.
    handle.setPaused(false)
    for (let i = 0; i < 3000; i++) {
      rig.step(16)
      if (i % 5 === 0) rig.press(" ")
    }
    assert.ok(rig.counter.calls > drawn, "the game never came back when the host lifted its sheet")
    assert.ok(world.resolved.length > resolved, "the run never resumed")
  } finally {
    handle.unmount()
    rig.restore()
  }
})

test("opening and closing the manual repeatedly is not a stack of pauses", () => {
  const rig = install(768, 1024, 0x51f0)
  const world: World = { resolved: [], asked: 0, reports: [] }
  const handle = mount(rig.el, stub(world))
  try {
    for (let i = 0; i < 600; i++) rig.step(16)
    const open = control(rig.created, "dwc-help")
    const close = control(rig.created, "dwc-close")
    for (let round = 0; round < 6; round++) {
      open()
      open() // already open: the module refuses, and `onOpen` must not run twice
      const frozen = rig.counter.calls
      for (let j = 0; j < 200; j++) rig.step(16)
      assert.equal(rig.counter.calls, frozen, `read ${round} did not stop the hall`)
      close()
      close() // and a double close must not resume a game twice
      for (let j = 0; j < 200; j++) rig.step(16)
      assert.ok(rig.counter.calls > frozen, `read ${round} left the game stuck paused`)
    }
  } finally {
    handle.unmount()
    rig.restore()
  }
  for (const r of world.reports) assert.ok(r.ms < 60_000)
})
