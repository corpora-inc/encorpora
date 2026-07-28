// A smoke test for the surface.
//
// `tsc` proves the draw calls type-check and the vite build proves the modules
// resolve. Neither proves that a frame *runs* — a stale property, a function
// renamed in `render/` and not in `mount.ts`, a value read before it is
// assigned, all compile and all crash on the first frame in front of a child.
//
// So this mounts the real game against a canvas that records instead of paints,
// drives several hundred frames through a lockup, a full three-count, a pinfall
// and an escape, and asserts that nothing threw and that the world actually
// moved. It is not a rendering test — there are no pixels to look at — it is a
// test that the whole thing is wired to itself.

import assert from "node:assert/strict"
import { test } from "node:test"

import { mount } from "../contract.ts"
import { createStubHost } from "../stubHost.ts"

type Listener = (event: unknown) => void

/** A 2D context that answers every call and records how much work it was asked for. */
function fakeContext(counter: { calls: number; text: string[] }): CanvasRenderingContext2D {
  const store = new Map<string, unknown>()
  const noop = (name: string) =>
    function (...args: unknown[]) {
      counter.calls++
      if (name === "fillText" && typeof args[0] === "string") counter.text.push(args[0])
      // Gradients are the one call whose result is used, so everything returns
      // something that can take a colour stop.
      return { addColorStop() {} }
    }
  return new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (store.has(prop)) return store.get(prop)
        return noop(prop)
      },
      set(_t, prop: string, value) {
        store.set(prop, value)
        return true
      },
    },
  ) as unknown as CanvasRenderingContext2D
}

type FakeElement = {
  style: { cssText: string }
  width: number
  height: number
  listeners: Map<string, Listener[]>
  appendChild(child: unknown): void
  remove(): void
  addEventListener(type: string, fn: Listener): void
  removeEventListener(type: string, fn: Listener): void
  getBoundingClientRect(): { width: number; height: number; left: number; top: number }
  getContext(): CanvasRenderingContext2D
}

function harness(size: { w: number; h: number }, counter: { calls: number; text: string[] }) {
  const ctx = fakeContext(counter)
  const make = (): FakeElement => {
    const listeners = new Map<string, Listener[]>()
    return {
      style: { cssText: "" },
      width: 0,
      height: 0,
      listeners,
      appendChild() {},
      remove() {},
      addEventListener(type, fn) {
        const list = listeners.get(type) ?? []
        list.push(fn)
        listeners.set(type, list)
      },
      removeEventListener(type, fn) {
        listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn))
      },
      getBoundingClientRect: () => ({ width: size.w, height: size.h, left: 0, top: 0 }),
      getContext: () => ctx,
    }
  }
  const created: FakeElement[] = []
  const doc = {
    visibilityState: "visible",
    listeners: new Map<string, Listener[]>(),
    createElement() {
      const el = make()
      created.push(el)
      return el
    },
    addEventListener(type: string, fn: Listener) {
      const list = doc.listeners.get(type) ?? []
      list.push(fn)
      doc.listeners.set(type, list)
    },
    removeEventListener(type: string, fn: Listener) {
      doc.listeners.set(type, (doc.listeners.get(type) ?? []).filter((f) => f !== fn))
    },
  }
  return { host: make(), doc, created, ctx }
}

type Rig = ReturnType<typeof harness> & { frames: Array<(t: number) => void> }

/**
 * Install the browser globals `mount.ts` needs, run `body`, and take them back
 * off again — including when `body` throws, which is the case this file exists
 * to catch.
 */
function withBrowser(
  size: { w: number; h: number },
  counter: { calls: number; text: string[] },
  body: (rig: Rig) => void,
): void {
  const rig = harness(size, counter)
  const g = globalThis as Record<string, unknown>
  const saved = new Map<string, PropertyDescriptor | undefined>()
  const set = (key: string, value: unknown) => {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const frames: Array<(t: number) => void> = []
  set("document", rig.doc)
  set("devicePixelRatio", 2)
  set("requestAnimationFrame", (fn: (t: number) => void) => {
    frames.push(fn)
    return frames.length
  })
  set("cancelAnimationFrame", () => {})
  if (typeof g.addEventListener !== "function") set("addEventListener", () => {})
  if (typeof g.removeEventListener !== "function") set("removeEventListener", () => {})

  try {
    body({ ...rig, frames })
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
}

/** The canvas is the second element `mount` creates: the root div, then it. */
function canvasOf(created: FakeElement[]): FakeElement {
  const el = created[1]
  if (!el) throw new Error("mount did not create a canvas")
  return el
}

/** Run `n` frames at 60Hz, draining the rAF queue each time. */
function pump(frames: Array<(t: number) => void>, n: number, from = 0): number {
  let t = from
  for (let i = 0; i < n; i++) {
    const next = frames.pop()
    frames.length = 0
    if (!next) break
    t += 16.7
    next(t)
  }
  return t
}

for (const [w, h] of [
  [320, 568],
  [768, 1024],
  [1366, 1024],
] as const) {
  test(`a whole bout renders without throwing at ${w}×${h}`, () => {
    const counter = { calls: 0, text: [] as string[] }
    const reports: Array<{ correct: boolean }> = []
    withBrowser({ w, h }, counter, ({ host, frames, created, doc }) => {
      const stub = createStubHost({
        seed: 0x51ab,
        reducedMotion: false,
        onReport: (r) => reports.push(r),
      })
      const handle = mount(host as unknown as HTMLElement, stub)
      const canvas = canvasOf(created)

      // Long enough for the lockup, a full three-count, the pinfall beat and the
      // next takedown — several times over.
      let t = pump(frames, 900)
      assert.ok(counter.calls > 5000, `only ${counter.calls} draw calls in 900 frames`)
      assert.ok(counter.text.length > 0, "nothing was ever written on the board")

      // And a tap goes all the way through the input handler into the rules.
      const down = canvas.listeners.get("pointerdown")?.[0]
      assert.ok(down, "no pointerdown listener was installed")
      const before = counter.calls
      for (let i = 0; i < 30; i++) {
        down({ preventDefault() {}, clientX: i % 2 === 0 ? w * 0.25 : w * 0.75, clientY: h * 0.9 })
        t = pump(frames, 12, t)
      }
      assert.ok(counter.calls > before)

      // Backgrounding the tab must stop the world without stopping the loop.
      doc.visibilityState = "hidden"
      for (const fn of doc.listeners.get("visibilitychange") ?? []) fn({})
      const paused = counter.calls
      t = pump(frames, 60, t)
      assert.equal(counter.calls, paused, "the count kept running while hidden")
      doc.visibilityState = "visible"
      for (const fn of doc.listeners.get("visibilitychange") ?? []) fn({})
      t = pump(frames, 30, t)
      assert.ok(counter.calls > paused, "the world never came back")

      handle.unmount()
      assert.equal(canvas.listeners.get("pointerdown")?.length ?? 0, 0)
    })

    // The frames were not just drawn, they were *played*: falls were lost to the
    // count and, once the taps started, falls were escaped.
    assert.ok(reports.length > 0, "no item was ever reported")
    assert.ok(
      reports.some((r) => !r.correct),
      "the count never ran out",
    )
    assert.ok(
      reports.some((r) => r.correct),
      "thirty taps never produced a single exact total",
    )
  })
}

test("the reduced-motion branch renders the same bout with no particles", () => {
  const counter = { calls: 0, text: [] as string[] }
  withBrowser({ w: 768, h: 1024 }, counter, ({ host, frames, created }) => {
    const stub = createStubHost({ seed: 0x51ab, reducedMotion: true })
    const handle = mount(host as unknown as HTMLElement, stub)
    let t = pump(frames, 300)
    const down = canvasOf(created).listeners.get("pointerdown")?.[0] as Listener
    for (let i = 0; i < 20; i++) {
      down({ preventDefault() {}, clientX: 200, clientY: 900 })
      t = pump(frames, 10, t)
    }
    // The information is all still there — the board, the bar and the plates are
    // written every frame — it just arrives without travel.
    assert.ok(counter.text.length > 0)
    assert.ok(counter.calls > 3000)
    handle.unmount()
  })
})
