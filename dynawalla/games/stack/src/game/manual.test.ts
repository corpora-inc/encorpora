// The monument stops while the rules are up.
//
// "I can hear counterweight playing in the background while I'm reading the
// instructions ... stressing me out even more." MONUMENT was worse than noisy.
// Its manual ends with the words "Waiting never costs you anything", and behind
// that very sheet the sweep kept sweeping, the value on the stone kept turning
// over, and `dither` — the impatience penalty that makes the stone FASTER every
// three idle cycles — kept compounding. Reading the rules was charged as
// dithering. Three minutes of a child being careful took the sweep from 1.00 to
// its 1.90 ceiling.
//
// So this file mounts the real `mount()` — three, WebGL, HUD and all — against a
// stubbed drawing context, drives the real frame loop on a virtual clock,
// reaches the shared how-to-play sheet through its OWN help button, and watches
// the simulation directly through the game's `?dev=1` handle.
//
// What is NOT covered here: pixels. The GL stub records calls and returns
// plausible constants; it does not rasterise. "The canvas visibly holds its last
// frame under the scrim" is a device claim, not this file's.

import assert from "node:assert/strict"
import { test } from "node:test"

import { mount } from "./mount.ts"
import type { Sim } from "./sim.ts"
import { createStubHost } from "../host/stub.ts"
import { sweepSpeed } from "./tuning.ts"

type Handler = (e: unknown) => void
type Report = { questionId: string; correct: boolean; ms: number; answered: string }
type Dev = { sim: Sim; tap: (ts?: number) => void; latency: () => number }

/**
 * Enough WebGL2 for three to construct, compile, link and draw.
 *
 * Everything unknown becomes either an enum constant (ALL_CAPS) or a no-op
 * function, resolved on first touch. The handful of calls three actually reads a
 * value back from are answered explicitly — `getParameter(VERSION)` in
 * particular must be a string, or `WebGLState` dies on `glVersion.indexOf`.
 */
function makeGl(count: () => void, draw: () => void): WebGL2RenderingContext {
  const obj = (): Record<string, unknown> => ({})
  const target: Record<string, unknown> = {}
  let next = 0x1000
  const fixed: Record<string, unknown> = {
    canvas: null,
    drawingBufferWidth: 768,
    drawingBufferHeight: 1024,
    getParameter: (p: number) => {
      if (p === target.VERSION) return "WebGL 2.0 (stub)"
      if (p === target.SHADING_LANGUAGE_VERSION) return "WebGL GLSL ES 3.00 (stub)"
      if (p === target.VENDOR || p === target.RENDERER) return "stub"
      if (
        p === target.MAX_TEXTURE_SIZE ||
        p === target.MAX_CUBE_MAP_TEXTURE_SIZE ||
        p === target.MAX_RENDERBUFFER_SIZE ||
        p === target.MAX_3D_TEXTURE_SIZE ||
        p === target.MAX_ARRAY_TEXTURE_LAYERS
      ) {
        return 4096
      }
      if (p === target.MAX_VIEWPORT_DIMS || p === target.VIEWPORT || p === target.SCISSOR_BOX) {
        return [0, 0, 4096, 4096]
      }
      if (p === target.MAX_SAMPLES) return 4
      return 16
    },
    getExtension: () => null,
    getSupportedExtensions: () => [],
    getShaderPrecisionFormat: () => ({ precision: 23, rangeMin: 127, rangeMax: 127 }),
    createShader: obj,
    createProgram: obj,
    createBuffer: obj,
    createTexture: obj,
    createFramebuffer: obj,
    createRenderbuffer: obj,
    createVertexArray: obj,
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    getShaderInfoLog: () => "",
    getProgramInfoLog: () => "",
    getActiveAttrib: () => ({ name: "a", type: 0, size: 1 }),
    getActiveUniform: () => ({ name: "u", type: 0, size: 1 }),
    getUniformLocation: obj,
    getAttribLocation: () => 0,
    getError: () => 0,
    checkFramebufferStatus: () => 0x8cd5,
    isContextLost: () => false,
  }
  const DRAWS = new Set(["drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced", "clear"])
  for (const [k, v] of Object.entries(fixed)) {
    target[k] = typeof v === "function" ? (...a: unknown[]) => {
      count()
      return (v as (...x: unknown[]) => unknown)(...a)
    } : v
  }
  return new Proxy(target, {
    get(t, p) {
      if (p in t) return t[p as string]
      if (typeof p === "symbol") return undefined
      const name = String(p)
      if (/^[A-Z0-9_]+$/.test(name)) {
        t[name] = next++
        return t[name]
      }
      const isDraw = DRAWS.has(name)
      t[name] = () => {
        count()
        if (isDraw) draw()
      }
      return t[name]
    },
  }) as unknown as WebGL2RenderingContext
}

/**
 * A DOM with no layout.
 *
 * Every element gets its OWN listener map. A single map keyed by event type is
 * the trap here: the shared sheet's help button and its PLAY button both
 * register a `"click"`, so a shared map would leave the second overwriting the
 * first and a test that "opened the manual" would in fact be closing it.
 */
function surface(width: number, height: number) {
  const rect = { left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0 }
  const made: FakeEl[] = []
  let calls = 0
  let draws = 0
  const gl = makeGl(
    () => {
      calls++
    },
    () => {
      draws++
    },
  )

  const ctx2d = new Proxy(function () {} as unknown as Record<string, unknown>, {
    get: (_t, prop) => {
      if (prop === "then") return undefined
      if (prop === "measureText") {
        return (t: string) => {
          calls++
          return { width: String(t).length * 40, actualBoundingBoxAscent: 40, actualBoundingBoxDescent: 12 }
        }
      }
      return ctx2d
    },
    set: () => true,
    apply: () => {
      calls++
      return ctx2d
    },
  }) as unknown as CanvasRenderingContext2D

  type FakeEl = {
    className: string
    listeners: Map<string, Handler[]>
    fire(type: string, e?: unknown): void
    [k: string]: unknown
  }

  const makeEl = (): FakeEl => {
    const listeners = new Map<string, Handler[]>()
    const classes = new Set<string>()
    // The HUD writes its palette through CSS custom properties, so `style` has
    // to be a CSSStyleDeclaration and not a bag of named fields — the shared
    // sheet's own idiom is plain assignment, and both have to work on one object.
    const vars = new Map<string, string>()
    const el: FakeEl = {
      style: {
        setProperty: (k: string, v: string) => void vars.set(k, v),
        getPropertyValue: (k: string) => vars.get(k) ?? "",
        removeProperty: (k: string) => void vars.delete(k),
      } as unknown as Record<string, string>,
      dataset: {} as Record<string, string>,
      children: [] as unknown[],
      width: 0,
      height: 0,
      id: "",
      type: "",
      className: "",
      innerHTML: "",
      textContent: "",
      tabIndex: 0,
      hidden: false,
      scrollTop: 0,
      offsetHeight: height,
      clientWidth: width,
      clientHeight: height,
      listeners,
      classList: {
        add: (c: string) => void classes.add(c),
        remove: (c: string) => void classes.delete(c),
        toggle: (c: string, on?: boolean) => void (on ?? !classes.has(c) ? classes.add(c) : classes.delete(c)),
        contains: (c: string) => classes.has(c),
      },
      appendChild: (c: unknown) => c,
      append: () => undefined,
      remove: () => undefined,
      replaceChildren: () => undefined,
      focus: () => undefined,
      blur: () => undefined,
      closest: () => null,
      querySelector: () => makeEl(),
      querySelectorAll: () => [],
      animate: () => ({ cancel: () => undefined, finish: () => undefined }),
      setAttribute: () => undefined,
      getAttribute: () => null,
      removeAttribute: () => undefined,
      getBoundingClientRect: () => rect,
      getContext: (kind: string) => (kind === "2d" ? ctx2d : gl),
      setPointerCapture: () => undefined,
      releasePointerCapture: () => undefined,
      hasPointerCapture: () => false,
      addEventListener: (k: string, h: Handler) => {
        const list = listeners.get(k) ?? []
        list.push(h)
        listeners.set(k, list)
      },
      removeEventListener: (k: string, h: Handler) => {
        const list = listeners.get(k) ?? []
        const at = list.indexOf(h)
        if (at >= 0) list.splice(at, 1)
      },
      fire: (k: string, e?: unknown) => {
        for (const h of [...(listeners.get(k) ?? [])]) h(e ?? {})
      },
    }
    made.push(el)
    return el
  }

  let pending: ((t: number) => void) | null = null
  let clock = 1000

  const saved = {
    raf: globalThis.requestAnimationFrame,
    caf: globalThis.cancelAnimationFrame,
    ro: (globalThis as { ResizeObserver?: unknown }).ResizeObserver,
    now: performance.now,
    add: globalThis.addEventListener,
    remove: globalThis.removeEventListener,
    dpr: (globalThis as { devicePixelRatio?: number }).devicePixelRatio,
    doc: (globalThis as { document?: unknown }).document,
    win: (globalThis as { window?: unknown }).window,
    loc: (globalThis as { location?: unknown }).location,
    nav: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
  }

  const install = (): (() => void) => {
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
    Object.defineProperty(globalThis, "navigator", {
      value: { hardwareConcurrency: 8, deviceMemory: 8 },
      configurable: true,
      writable: true,
    })
    ;(globalThis as { devicePixelRatio?: number }).devicePixelRatio = 1
    // `?dev=1` is what publishes `window.__monument`, and that handle — which
    // carries the live `Sim` — is how this file sees the simulation at all.
    ;(globalThis as { location?: unknown }).location = { search: "?dev=1" }
    globalThis.addEventListener = (() => undefined) as unknown as typeof globalThis.addEventListener
    globalThis.removeEventListener = (() => undefined) as unknown as typeof globalThis.removeEventListener
    const body = makeEl()
    ;(globalThis as { document?: unknown }).document = {
      createElement: () => makeEl(),
      getElementById: () => null,
      body,
      hidden: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }
    ;(globalThis as { window?: unknown }).window = globalThis
    return () => {
      globalThis.requestAnimationFrame = saved.raf
      globalThis.cancelAnimationFrame = saved.caf
      ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = saved.ro
      performance.now = saved.now
      ;(globalThis as { devicePixelRatio?: number }).devicePixelRatio = saved.dpr
      globalThis.addEventListener = saved.add
      globalThis.removeEventListener = saved.remove
      ;(globalThis as { document?: unknown }).document = saved.doc
      ;(globalThis as { window?: unknown }).window = saved.win
      ;(globalThis as { location?: unknown }).location = saved.loc
      if (saved.nav) Object.defineProperty(globalThis, "navigator", saved.nav)
      delete (globalThis as { __monument?: unknown }).__monument
    }
  }

  return {
    el: makeEl(),
    install,
    made,
    calls: () => calls,
    draws: () => draws,
    step: (ms: number): void => {
      clock += ms
      const cb = pending
      pending = null
      cb?.(clock)
    },
  }
}

type Surface = ReturnType<typeof surface>

function control(s: Surface, cls: string): { fire(type: string, e?: unknown): void } {
  const el = s.made.find((e) => e.className === cls)
  assert.ok(el, `no ${cls} in the mounted tree — the shared sheet did not mount`)
  return el as unknown as { fire(type: string, e?: unknown): void }
}

const openManual = (s: Surface): void => control(s, "dwc-help").fire("click")
const closeManual = (s: Surface): void => control(s, "dwc-close").fire("click")

function dev(): Dev {
  const d = (globalThis as { __monument?: Dev }).__monument
  assert.ok(d, "the dev handle is missing — mount did not see ?dev=1")
  return d
}

/** Everything this file calls "the monument". */
function snapshot(s: Surface): string {
  const sim = dev().sim
  return JSON.stringify({
    calls: s.calls(),
    draws: s.draws(),
    sweep: sim.sweep,
    dir: sim.dir,
    slot: sim.slot,
    idleSeconds: sim.idleSeconds,
    guardSeconds: sim.guardSeconds,
    holdLeft: sim.holdLeft,
    swayT: sim.swayT,
    floor: sim.floor,
    phase: sim.phase,
    questionAt: sim.questionAt,
    prompt: sim.question.prompt,
  })
}

function begin(opts: { onReport?: (r: Report) => void } = {}) {
  const s = surface(768, 1024)
  const restore = s.install()
  const host = createStubHost({ seed: 0x51ab, onReport: opts.onReport })
  const handle = mount(s.el as unknown as HTMLElement, host)
  return { s, handle, restore }
}

test("THE SWEEP STOPS: nothing advances while the manual is up", () => {
  const { s, handle, restore } = begin()
  try {
    for (let i = 0; i < 300; i++) s.step(16)
    const before = snapshot(s)
    assert.ok(s.draws() > 0, "nothing was ever drawn, so a frozen draw count proves nothing")
    assert.notEqual(dev().sim.sweep, 0, "the sweep never moved before the manual opened")

    openManual(s)
    // Three minutes of a child reading, at sixty frames a second.
    for (let i = 0; i < 11_250; i++) s.step(16)
    assert.equal(snapshot(s), before, "the monument kept running behind the manual")

    closeManual(s)
    for (let i = 0; i < 120; i++) s.step(16)
    assert.notEqual(snapshot(s), before, "the monument never came back after the manual closed")
  } finally {
    handle.unmount()
    restore()
  }
})

test("WAITING IS FREE, INCLUDING READING: the stone never speeds up, sheet or no sheet", () => {
  // The last line of MONUMENT's own manual is "Waiting never costs you anything",
  // and `dither` — three idle sweeps and the stone got 16% faster, compounding to
  // a 1.90× ceiling — was the one mechanism in the game that made that a lie. It
  // compounded behind this very sheet. It is deleted, so this asserts the promise
  // in full rather than one exception to it: six minutes of a child being careful,
  // three of them with the rules open, and the stone is going exactly the speed it
  // was going before.
  const { s, handle, restore } = begin()
  try {
    for (let i = 0; i < 300; i++) s.step(16)
    const sim = dev().sim
    const speed = sweepSpeed(sim.floor)

    openManual(s)
    for (let i = 0; i < 11_250; i++) s.step(16)
    assert.equal(sweepSpeed(sim.floor), speed, "reading the rules moved the sweep")

    closeManual(s)
    // Three more minutes, in front of the sheet this time, doing nothing at all.
    for (let i = 0; i < 11_250; i++) s.step(16)
    assert.equal(sim.floor, 0, "a stone was set without a tap")
    assert.equal(
      sweepSpeed(sim.floor),
      speed,
      `six minutes of a child being careful pushed the stone to ${sweepSpeed(sim.floor)} u/s from ${speed}`,
    )

    // The anti-vacuity half: the sweep really can change speed in this harness —
    // it just may never do it because of a clock. Climbing the tower does. Tapped
    // only while the stone is actually over the tower, because a tap at a parked
    // turnaround is a miss and a miss sets nothing.
    for (let i = 0; i < 40; i++) {
      const from: number = sim.floor
      for (let k = 0; k < 400 && sim.floor === from; k++) {
        s.step(16)
        if (sim.holdLeft <= 0 && Math.abs(sim.sweep) < 0.02) dev().tap()
      }
    }
    assert.ok(sim.floor > 0, "forty careful taps set no stones, so nothing here was measured")
    assert.ok(
      sweepSpeed(sim.floor) > speed,
      `climbing ${sim.floor} floors did not change the sweep at all — ${sweepSpeed(sim.floor)} u/s`,
    )
  } finally {
    handle.unmount()
    restore()
  }
})

test("THE READ IS NOT BILLED: a stone set after the manual costs the reading time", () => {
  // `ms` on every report is `(clock − questionAt) × 1000`, and `clock` is the
  // loop's own accumulator. Freezing the loop is what keeps that honest: a
  // three-minute read must not reach the curriculum as three minutes of a child
  // failing to answer.
  const reports: Report[] = []
  const { s, handle, restore } = begin({ onReport: (r) => reports.push(r) })
  try {
    for (let i = 0; i < 300; i++) s.step(16)
    const askedAt = dev().sim.questionAt

    openManual(s)
    for (let i = 0; i < 11_250; i++) s.step(16)
    closeManual(s)
    assert.equal(dev().sim.questionAt, askedAt, "the question was re-stamped across the pause")

    const n = reports.length
    dev().tap()
    for (let i = 0; i < 30; i++) s.step(16)
    assert.equal(reports.length, n + 1, "setting a stone after the manual reported nothing")
    const r = reports[reports.length - 1] as Report
    assert.ok(
      r.ms < 60_000,
      `the read was billed to the child: ${r.ms}ms of "thinking" for a stone set at once`,
    )
  } finally {
    handle.unmount()
    restore()
  }
})

test("closing the manual does not hand the loop one enormous frame", () => {
  // `last` has to keep tracking the real clock while the game is stopped, or
  // the first frame back is `now − last` — the whole length of the read. The
  // loop's 0.05s clamp catches the worst of it, which is exactly why this needs
  // asserting rather than eyeballing: the bug survives the clamp as a visible
  // three-frame lurch, not as a crash.
  const { s, handle, restore } = begin()
  try {
    for (let i = 0; i < 300; i++) s.step(16)
    const a = dev().sim.swayT
    s.step(16)
    const ordinary = dev().sim.swayT - a

    openManual(s)
    for (let i = 0; i < 11_250; i++) s.step(16)
    closeManual(s)

    const b = dev().sim.swayT
    s.step(16)
    const firstBack = dev().sim.swayT - b
    assert.ok(
      firstBack <= ordinary * 1.5,
      `the first frame back carried ${(firstBack * 1000).toFixed(1)}ms against an ordinary ${(ordinary * 1000).toFixed(1)}ms`,
    )
  } finally {
    handle.unmount()
    restore()
  }
})

test("a tap cannot set a stone while the game is stopped", () => {
  const { s, handle, restore } = begin()
  try {
    for (let i = 0; i < 300; i++) s.step(16)
    const placed = dev().sim.placed
    handle.setPaused(true)
    for (let i = 0; i < 40; i++) {
      dev().tap()
      s.step(16)
    }
    assert.equal(dev().sim.placed, placed, "forty taps behind a host sheet set forty stones")
    handle.setPaused(false)
    for (let i = 0; i < 30; i++) s.step(16)
    dev().tap()
    for (let i = 0; i < 30; i++) s.step(16)
    assert.equal(dev().sim.placed, placed + 1, "the tap never came back")
  } finally {
    handle.unmount()
    restore()
  }
})

test("the manual only lifts a pause it put on itself", () => {
  // The host puts a sheet over a still-mounted pack — a purchase surface, a
  // parent gate — and the child, behind it, closes the how-to-play they had
  // open. The game must stay stopped: the host is still holding it.
  const { s, handle, restore } = begin()
  try {
    for (let i = 0; i < 300; i++) s.step(16)
    handle.setPaused(true)
    const held = snapshot(s)

    openManual(s)
    for (let i = 0; i < 600; i++) s.step(16)
    closeManual(s)
    for (let i = 0; i < 1200; i++) s.step(16)
    assert.equal(snapshot(s), held, "closing the rules handed the game back while the host held it")

    handle.setPaused(false)
    for (let i = 0; i < 120; i++) s.step(16)
    assert.notEqual(snapshot(s), held, "the host could not get its own game back")
  } finally {
    handle.unmount()
    restore()
  }
})

test("pausing twice is one pause, and resuming a running game is nothing", () => {
  const { s, handle, restore } = begin()
  try {
    handle.setPaused(false)
    for (let i = 0; i < 300; i++) s.step(16)
    handle.setPaused(true)
    handle.setPaused(true)
    const held = snapshot(s)
    for (let i = 0; i < 3000; i++) s.step(16)
    assert.equal(snapshot(s), held, "a doubled pause let the sweep through")
    handle.setPaused(false)
    handle.setPaused(false)
    for (let i = 0; i < 120; i++) s.step(16)
    assert.notEqual(snapshot(s), held, "a doubled resume left the monument stopped")
  } finally {
    handle.unmount()
    restore()
  }
})

test("the manual can be opened and closed all run without the game drifting", () => {
  const { s, handle, restore } = begin()
  try {
    for (let i = 0; i < 40; i++) {
      for (let k = 0; k < 20; k++) s.step(16)
      openManual(s)
      for (let k = 0; k < 20; k++) s.step(16)
      closeManual(s)
      if (i % 4 === 0) dev().tap()
    }
    assert.ok(dev().sim.swayT > 0, "forty opens and closes left the game never having run")
  } finally {
    handle.unmount()
    restore()
  }
})
