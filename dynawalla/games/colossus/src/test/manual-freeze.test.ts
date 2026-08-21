// THE BUILDING HOLDS STILL WHILE THE RULES ARE READ.
//
// "All games should pause while reading the instructions .. I can hear
// counterweight playing in the background while I'm reading the instructions
// ... stressing me out even more."
//
// The shared how-to-play sheet holds the sound, the keys and the taps. It cannot
// hold a game's own clock, and COLOSSUS has two that matter: the slab physics,
// and the keystone's stopwatch. A child who opens the manual because a wrong
// strike just made the tower taller is billed for every second they spend
// reading why.
//
// **Why this file exists at all when `pause.test.ts` is right there.** That file
// tests `Game.pause` in isolation, and `Game` was never the thing that was
// broken — the defect is in the *wiring*: whether the manual's `onOpen` ever
// reaches it. So this is a mount-level test. There was no mount-level harness in
// this package before it; the one below is modelled on COUNTERWEIGHT's, which is
// the same shape.
//
// **How the freeze is observed.** COLOSSUS deliberately keeps DRAWING while it
// is paused — a frozen frame under a translucent host sheet is what a paused
// pack should look like — so a frozen draw *count* would prove nothing here.
// What is asserted instead is that the frames are IDENTICAL: every call and
// every argument the renderer makes, recorded and compared. The giant breathes
// on `Scene.time`, which only advances in `Scene.advance`, so a world that is
// still moving produces a different frame and a frozen one repeats itself
// exactly.

import assert from "node:assert/strict"
import { test } from "node:test"

import { mount } from "../contract.ts"
import type { Host } from "../contract.ts"
import { createStubHost } from "../stubHost.ts"
import { viewLayout } from "../render/layout.ts"

type Handler = (event: unknown) => void

type FakeElement = {
  className: string
  id: string
  /**
   * PER ELEMENT. Both the shared module's help control and its PLAY button
   * register a `"click"` listener, so a harness with one map keyed by event
   * type — which is what most of the packs' harnesses have — silently drops the
   * first of the two and makes this test unwritable.
   */
  listeners: Map<string, Handler[]>
  style: Record<string, string>
  [key: string]: unknown
}

/**
 * A 2D context that writes down exactly what it was asked to draw.
 *
 * Every call and every property assignment lands in `frame`, in order, with its
 * arguments. Two frames are the same frame if and only if those transcripts are
 * equal — which is a much stronger statement than a call count, and the only one
 * worth making about a game that keeps painting while it is stopped.
 */
function recorder(frame: string[]): CanvasRenderingContext2D {
  const store = new Map<string, unknown>()
  const gradient = {
    addColorStop(...args: unknown[]): void {
      frame.push(`stop(${args.map(String).join(",")})`)
    },
  }
  return new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (store.has(prop)) return store.get(prop)
        return (...args: unknown[]) => {
          frame.push(`${prop}(${args.map(String).join(",")})`)
          return gradient
        }
      },
      set(_t, prop: string, value: unknown) {
        frame.push(`${prop}=${String(value)}`)
        store.set(prop, value)
        return true
      },
    },
  ) as unknown as CanvasRenderingContext2D
}

type Rig = {
  el: HTMLElement
  created: FakeElement[]
  /** The transcript of the most recent frame drawn. */
  frame: string[]
  /** Advance the clock by `ms` and run the frame the game asked for. */
  step(ms: number): void
  restore(): void
}

function install(width: number, height: number): Rig {
  const rect = { left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0 }
  const frame: string[] = []
  const ctx = recorder(frame)
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
      getContext: () => ctx,
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
  // The tower's shape is seeded from the wall clock, which is right on a device
  // and fatal in a test. Pinned, so a green run is green every time.
  Date.now = () => 0x0c0105
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

  const rig: Rig = {
    el: makeEl() as unknown as HTMLElement,
    created,
    frame,
    step: (ms: number) => {
      clock += ms
      const cb = pending
      pending = null
      frame.length = 0
      cb?.(clock)
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
    },
  }
  return rig
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
  /** Keystones the game asked the host for. A frozen tower asks for nothing. */
  asked: number
  reports: Array<{ ms: number; correct: boolean }>
  /**
   * Every haptic the game fired. This is the cheapest honest proof that a
   * press reached the rules: taking hold of a slab fires one, and nothing else
   * on the screen does.
   */
  haptics: string[]
}

function stub(world: World): Host {
  const base = createStubHost({ seed: 0xc0105, reducedMotion: false })
  return {
    ...base,
    next: (o) => {
      world.asked++
      return base.next(o)
    },
    report: (r) => {
      world.reports.push(r)
    },
    haptic: (k) => {
      world.haptics.push(k)
    },
  }
}

const W = 768
const H = 1024

/** The strike pill, from the real layout rather than a guessed coordinate. */
function strikePoint(): { x: number; y: number } {
  const { strike } = viewLayout(W, H)
  return { x: strike.x + strike.w / 2, y: strike.y + strike.h / 2 }
}

function pump(rig: Rig, frames: number): void {
  for (let i = 0; i < frames; i++) rig.step(16)
}

test("MANUAL FREEZES THE BUILDING: the same frame, over and over, until it closes", () => {
  const rig = install(W, H)
  const world: World = { asked: 0, reports: [], haptics: [] }
  const handle = mount(rig.el, stub(world))
  try {
    // Past the opening drop, so the slabs are seated and the only thing still
    // moving is the giant himself — which is the honest hard case, because a
    // freeze that only stopped the falling stone would still pass here.
    pump(rig, 300)
    const moving = [...rig.frame]
    pump(rig, 1)
    assert.notDeepEqual(rig.frame, moving, "the yard was already frozen before the manual opened")

    const open = control(rig.created, "dwc-help")
    const close = control(rig.created, "dwc-close")
    open()

    // The first frame behind the sheet, and then a hundred and sixty seconds of
    // reading — every one of which must be pixel-for-pixel the same frame.
    pump(rig, 1)
    const held = [...rig.frame]
    assert.ok(held.length > 100, "the frame behind the sheet drew nothing at all")
    const asked = world.asked
    for (let i = 0; i < 10_000; i++) {
      rig.step(16)
      if (i % 1000 === 0) {
        assert.deepEqual(rig.frame, held, `the building moved ${i} frames into the read`)
      }
    }
    assert.deepEqual(rig.frame, held, "the building moved while the rules were up")
    assert.equal(world.asked, asked, "a keystone was served behind the manual")

    close()
    pump(rig, 30)
    assert.notDeepEqual(rig.frame, held, "the building never came back after the manual closed")
  } finally {
    handle.unmount()
    rig.restore()
  }
})

test("a press behind the manual is not a press, and the read is not thinking time", () => {
  const rig = install(W, H)
  const world: World = { asked: 0, reports: [], haptics: [] }
  const handle = mount(rig.el, stub(world))
  try {
    const canvas = rig.created[0]
    assert.ok(canvas, "mount did not create a canvas")
    const press = canvas.listeners.get("pointerdown")?.[0]
    assert.ok(press, "the tower was never wired to anything")
    const at = (x: number, y: number): void => {
      press({ preventDefault: () => undefined, clientX: x, clientY: y })
    }
    /** Walk down the middle of the frame until a slab is taken hold of. */
    const grabOne = (): boolean => {
      const before = world.haptics.length
      for (let y = 0; y < H; y += 6) {
        at(W / 2, y)
        if (world.haptics.length > before) return true
      }
      return false
    }

    pump(rig, 300)
    // The positive control. Without this the "nothing happened" below would
    // pass just as well for a sweep that misses the building entirely.
    assert.ok(grabOne(), "the sweep never found a slab, so it proves nothing")

    const open = control(rig.created, "dwc-help")
    const close = control(rig.created, "dwc-close")
    open()
    // Two and a half minutes of reading, with a thumb on the glass throughout.
    pump(rig, 9000)
    pump(rig, 1)
    const held = [...rig.frame]
    const haptics = world.haptics.length
    for (let y = 0; y < H; y += 6) at(W / 2, y)
    at(strikePoint().x, strikePoint().y)
    pump(rig, 1)

    assert.equal(world.haptics.length, haptics, "a press behind the manual reached the tower")
    // Length, not `deepEqual(world.reports, [])`. Node's `deepEqual` is typed
    // `asserts actual is T`, so comparing against a bare `[]` narrows
    // `world.reports` to `never[]` for the rest of the function — and the
    // latency assertion at the bottom, the one with the teeth, then reads `.ms`
    // off `never` and stops meaning anything.
    assert.equal(
      world.reports.length,
      0,
      `${world.reports.length} keystones were answered from behind the manual`,
    )
    assert.deepEqual(rig.frame, held, "the building changed under the manual")

    close()
    pump(rig, 30)
    assert.ok(grabOne(), "the tower never came back after the manual closed")
    at(strikePoint().x, strikePoint().y)
    pump(rig, 5)

    assert.ok(world.reports.length > 0, "the fist never landed after the manual closed")
    const first = world.reports[0]
    assert.ok(first)
    // The keystone's stopwatch, which is a wall clock and keeps running behind
    // any sheet. `Game.resume` shifts the mark; if the manual never reached it,
    // the 144 seconds of reading are billed as a child staring at a sum.
    assert.ok(
      first.ms < 30_000,
      `${Math.round(first.ms)} ms was billed for a keystone that had a 144 s manual over it`,
    )
  } finally {
    handle.unmount()
    rig.restore()
  }
})

test("THE MANUAL ONLY LIFTS ITS OWN PAUSE: closing it cannot restart a host-paused game", () => {
  // This game raises the host's sheet ITSELF, every time a tower comes down —
  // `transition("level")` — so a child stuck behind a stopping-point card is
  // exactly the child who opens the rules. Closing them must not hand the
  // building back running underneath a sheet that is still up.
  const rig = install(W, H)
  const world: World = { asked: 0, reports: [], haptics: [] }
  const handle = mount(rig.el, stub(world))
  try {
    pump(rig, 300)
    handle.pause()
    pump(rig, 1)
    const held = [...rig.frame]

    const open = control(rig.created, "dwc-help")
    const close = control(rig.created, "dwc-close")
    open()
    pump(rig, 600)
    close()
    pump(rig, 600)

    assert.deepEqual(rig.frame, held, "the manual handed a host-paused game back to the loop")

    // And the host's own resume still works: nothing was double-counted.
    handle.resume()
    pump(rig, 30)
    assert.notDeepEqual(rig.frame, held, "the game never came back when the host lifted its sheet")
  } finally {
    handle.unmount()
    rig.restore()
  }
})

test("opening and closing the manual repeatedly is not a stack of pauses", () => {
  const rig = install(W, H)
  const world: World = { asked: 0, reports: [], haptics: [] }
  const handle = mount(rig.el, stub(world))
  try {
    pump(rig, 300)
    const open = control(rig.created, "dwc-help")
    const close = control(rig.created, "dwc-close")
    for (let round = 0; round < 6; round++) {
      open()
      open() // already open: the module refuses, and `onOpen` must not run twice
      pump(rig, 1)
      const held = [...rig.frame]
      pump(rig, 200)
      assert.deepEqual(rig.frame, held, `read ${round} did not stop the building`)
      close()
      close() // and a double close must not resume a game twice
      pump(rig, 30)
      assert.notDeepEqual(rig.frame, held, `read ${round} left the game stuck paused`)
    }
  } finally {
    handle.unmount()
    rig.restore()
  }
})
