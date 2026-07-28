// A smoke test for the surface.
//
// `tsc` proves the draw calls type-check and the vite build proves the modules
// resolve. Neither proves that a frame *runs* — a stale property, a function
// renamed in `render/` and not in `mount.ts`, a value read before it is
// assigned: all compile, and all crash on the first frame in front of a child.
//
// So this mounts the real game against a canvas that records instead of paints,
// drives several hundred frames through weights hung, plates struck, beams
// seated and Turks put over, and asserts that nothing threw and that the world
// actually moved. It is not a rendering test — there are no pixels — it is a
// test that the whole thing is wired to itself.
//
// It also drives the two pause paths the host can take: the sheet (`pause()`)
// and a backgrounded tab (`visibilitychange`).

import assert from "node:assert/strict"
import { test } from "node:test"

import { mount } from "../contract.ts"
import type { Host, Question } from "../contract.ts"
import { openingLoad } from "../game/bout.ts"
import { PLACES, planStrikes } from "../game/places.ts"
import { layoutFor } from "../render/layout.ts"
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

type Clock = { now: number }
type Rig = ReturnType<typeof harness> & {
  frames: Array<(t: number) => void>
  /** The wall clock `mount.ts` bills latency against, under the test's control. */
  clock: Clock
}

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
  const clock: Clock = { now: 0 }
  set("performance", { now: () => clock.now })
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
    body({ ...rig, frames, clock })
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
}

/** The canvas is the second element `mount` creates: the root stand-in, then it. */
function canvasOf(created: FakeElement[]): FakeElement {
  const el = created[0]
  if (!el) throw new Error("mount did not create a canvas")
  return el
}

/**
 * Run `n` frames at 60 Hz, draining the rAF queue each time.
 *
 * The wall clock moves with the frames, because it does on a device — which is
 * the whole point of the latency case below: a sheet held up for half a minute
 * moves `performance.now()` by half a minute whether or not the game is running.
 */
function pump(
  frames: Array<(t: number) => void>,
  n: number,
  from = 0,
  clock?: Clock,
): number {
  let t = from
  for (let i = 0; i < n; i++) {
    const next = frames.pop()
    frames.length = 0
    if (!next) break
    t += 16.7
    if (clock) clock.now = t
    next(t)
  }
  return t
}

/**
 * Every face on the rack, taken from the real layout rather than guessed. A
 * guessed coordinate that lands on nothing turns this file into a test that the
 * game renders while nobody is playing it.
 */
function facePoints(w: number, h: number): Array<{ x: number; y: number }> {
  const box = layoutFor(w, h)
  return box.pillars.flatMap((pillar) =>
    [pillar.up, pillar.down].map((r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })),
  )
}

/** The seat lever, likewise. */
function seatPoint(w: number, h: number): { x: number; y: number } {
  const { seat } = layoutFor(w, h)
  return { x: seat.x + seat.w / 2, y: seat.y + seat.h / 2 }
}

for (const [w, h] of [
  [320, 568],
  [768, 1024],
  [1366, 1024],
] as const) {
  test(`a whole match renders without throwing at ${w}×${h}`, () => {
    const counter = { calls: 0, text: [] as string[] }
    const reports: Array<{ correct: boolean; answered: string; ms: number }> = []
    withBrowser({ w, h }, counter, ({ host, frames, created }) => {
      const stub = createStubHost({
        seed: 0x51ab,
        reducedMotion: false,
        onReport: (r) => reports.push(r),
      })
      const handle = mount(host as unknown as HTMLElement, stub)
      const canvas = canvasOf(created)

      let t = pump(frames, 900)
      assert.ok(counter.calls > 5000, `only ${counter.calls} draw calls in 900 frames`)
      assert.ok(counter.text.length > 0, "nothing was ever written in the yard")

      // And a press goes all the way through the input handler into the rules.
      const down = canvas.listeners.get("pointerdown")?.[0]
      const up = canvas.listeners.get("pointerup")?.[0]
      assert.ok(down && up, "the rack was never wired to anything")
      const before = counter.calls
      const points = facePoints(w, h)
      for (let i = 0; i < 120; i++) {
        const p = points[i % points.length] as { x: number; y: number }
        down({ preventDefault() {}, clientX: p.x, clientY: p.y })
        up({})
        t = pump(frames, 20, t)
      }
      assert.ok(counter.calls > before)

      // The seat lever, at the very bottom.
      const lever = seatPoint(w, h)
      for (let i = 0; i < 30; i++) {
        down({ preventDefault() {}, clientX: lever.x, clientY: lever.y })
        up({})
        t = pump(frames, 40, t)
      }

      handle.unmount()
      assert.equal(canvas.listeners.get("pointerdown")?.length ?? 0, 0)
    })

    // The frames were not just drawn, they were *played*: rounds were seated and
    // the value that crossed was a whole number the child put on the beam.
    assert.ok(reports.length > 4, `only ${reports.length} rounds were ever reported`)
    for (const r of reports) {
      assert.match(r.answered, /^-?\d+$/)
      assert.ok(r.ms >= 0)
    }
  })
}

test("the reduced-motion branch plays the same match with no sparks", () => {
  const counter = { calls: 0, text: [] as string[] }
  const reports: unknown[] = []
  withBrowser({ w: 768, h: 1024 }, counter, ({ host, frames, created }) => {
    const stub = createStubHost({ seed: 0x51ab, reducedMotion: true, onReport: (r) => reports.push(r) })
    const handle = mount(host as unknown as HTMLElement, stub)
    let t = pump(frames, 400)
    const canvas = canvasOf(created)
    const down = canvas.listeners.get("pointerdown")?.[0] as Listener
    const up = canvas.listeners.get("pointerup")?.[0] as Listener
    for (let i = 0; i < 90; i++) {
      const p = facePoints(768, 1024)[i % 8] as { x: number; y: number }
      down({ preventDefault() {}, clientX: p.x, clientY: p.y })
      up({})
      t = pump(frames, 20, t)
    }
    const lever = seatPoint(768, 1024)
    for (let i = 0; i < 8; i++) {
      down({ preventDefault() {}, clientX: lever.x, clientY: lever.y })
      up({})
      t = pump(frames, 60, t)
    }
    // The information is all still there — the pans, the rack, the gauges are
    // written every frame — it just arrives without travel.
    assert.ok(counter.text.length > 0)
    assert.ok(counter.calls > 3000)
    handle.unmount()
  })
  assert.ok(reports.length > 0)
})

test("a Turk going over is the only thing that ever reaches `transition`", () => {
  const counter = { calls: 0, text: [] as string[] }
  const stops: string[] = []
  let rounds = 0
  let held = 0
  withBrowser({ w: 768, h: 1024 }, counter, ({ host, frames }) => {
    const stub = createStubHost({
      seed: 0x51ab,
      reducedMotion: true,
      onTransition: (kind) => stops.push(kind),
      onReport: (r) => {
        rounds += 1
        if (r.correct) held += 1
      },
    })
    const handle = mount(host as unknown as HTMLElement, stub)
    // No input at all: every round runs out of window and is lost. Dozens of
    // failures, and not one of them may raise a purchase surface.
    pump(frames, 20000)
    handle.unmount()
  })
  assert.ok(rounds > 8, `only ${rounds} rounds went by`)
  assert.equal(held, 0, "a match with no input somehow held a round")
  assert.deepEqual(stops, [], "a stopping point was offered next to a failure")
})

test("the sheet stops the world, and lifting it gives the window back", () => {
  // The host's `pause`, exactly as the pack seam calls it. Both halves are under
  // test: the clock must stop, and a tap on the sheet must not reach the rack.
  const counter = { calls: 0, text: [] as string[] }
  const reports: unknown[] = []
  withBrowser({ w: 768, h: 1024 }, counter, ({ host, frames, created }) => {
    const stub = createStubHost({ seed: 0x51ab, reducedMotion: true, onReport: (r) => reports.push(r) })
    const handle = mount(host as unknown as HTMLElement, stub)
    let t = pump(frames, 120)
    const canvas = canvasOf(created)
    const down = canvas.listeners.get("pointerdown")?.[0] as Listener
    const up = canvas.listeners.get("pointerup")?.[0] as Listener

    handle.pause()
    const seated = reports.length
    // Thirty seconds behind the sheet — more than two whole windows.
    t = pump(frames, 1800, t)
    assert.equal(reports.length, seated, "rounds were seated behind the sheet")

    // And presses on the sheet are presses on the sheet.
    for (const p of facePoints(768, 1024)) {
      down({ preventDefault() {}, clientX: p.x, clientY: p.y })
      up({})
    }
    const lever = seatPoint(768, 1024)
    down({ preventDefault() {}, clientX: lever.x, clientY: lever.y })
    up({})
    t = pump(frames, 60, t)
    assert.equal(reports.length, seated, "the beam was seated through the sheet")

    handle.resume()
    t = pump(frames, 1800, t)
    assert.ok(reports.length > seated, "the world never came back")
    handle.unmount()
  })
})

test("a backgrounded tab is the same as a sheet", () => {
  const counter = { calls: 0, text: [] as string[] }
  const reports: unknown[] = []
  withBrowser({ w: 768, h: 1024 }, counter, ({ host, frames, doc }) => {
    const stub = createStubHost({ seed: 0x51ab, reducedMotion: true, onReport: (r) => reports.push(r) })
    const handle = mount(host as unknown as HTMLElement, stub)
    let t = pump(frames, 120)

    doc.visibilityState = "hidden"
    for (const fn of doc.listeners.get("visibilitychange") ?? []) fn({})
    const seated = reports.length
    t = pump(frames, 1800, t)
    assert.equal(reports.length, seated, "the window closed while the tab was hidden")

    doc.visibilityState = "visible"
    for (const fn of doc.listeners.get("visibilitychange") ?? []) fn({})
    t = pump(frames, 1800, t)
    assert.ok(reports.length > seated, "the world never came back")
    handle.unmount()
  })
})

test("a round can be held all the way through the canvas", () => {
  // The end-to-end claim, and the one the rest of this file leans on: a player
  // who reads the column, works out what the pan is missing, presses those faces
  // and pulls the lever is told they held it. Everything above proves the game
  // *runs*; this proves it can be *won* by the only route a child has.
  const counter = { calls: 0, text: [] as string[] }
  const reports: Array<{ correct: boolean; answered: string }> = []
  const w = 768
  const h = 1024

  withBrowser({ w, h }, counter, ({ host, frames, created }) => {
    let served: Question | null = null
    const base = createStubHost({
      seed: 0x51ab,
      reducedMotion: true,
      level: 3,
      onReport: (r) => reports.push(r),
    })
    const stub: Host = {
      ...base,
      next: (o) => {
        served = base.next(o)
        return served
      },
    }

    const handle = mount(host as unknown as HTMLElement, stub)
    const canvas = canvasOf(created)
    const down = canvas.listeners.get("pointerdown")?.[0] as Listener
    const up = canvas.listeners.get("pointerup")?.[0] as Listener

    // Past the weight coming down, into the open window.
    let t = pump(frames, 60)
    const question = served as Question | null
    assert.ok(question, "no weight was ever hung")

    // What the pan started on, and what the round is therefore asking for. The
    // child does this in their head; the test does it in `places.ts`.
    const target = Number(question.answer)
    const plan = planStrikes(target + 1 - openingLoad(target))
    assert.ok(plan.length > 0)

    const faces = facePoints(w, h)
    for (const strike of plan) {
      const index = PLACES.indexOf(strike.place) * 2 + (strike.dir > 0 ? 0 : 1)
      const p = faces[index] as { x: number; y: number }
      down({ preventDefault() {}, clientX: p.x, clientY: p.y })
      up({})
      // Well clear of the pillar's swing-back and of the resonance window, and
      // well inside the grace before the pan starts to settle.
      t = pump(frames, 20, t)
    }

    const lever = seatPoint(w, h)
    down({ preventDefault() {}, clientX: lever.x, clientY: lever.y })
    up({})
    pump(frames, 10, t)

    handle.unmount()
  })

  assert.equal(reports.length, 1, `${reports.length} rounds were reported, not one`)
  assert.equal(reports[0]?.correct, true, "the arithmetic was right and the beam did not hold")
})

test("time behind the sheet is not billed to the child as thinking time", () => {
  // `Bout` can stop its own clock; it cannot do this one. Latency is measured
  // against the wall clock, and the wall clock keeps running behind a sheet —
  // so `mount.ts` has to shift the mark forward by exactly how long the sheet
  // was up. Without that, a parent gate held open for half a minute is recorded
  // as half a minute of a child staring at a column, and the fluency model in
  // `EXPERIENCE_DESIGN.md` reads it as difficulty.
  const counter = { calls: 0, text: [] as string[] }
  const reports: Array<{ ms: number }> = []
  const SHEET_FRAMES = 1800

  withBrowser({ w: 768, h: 1024 }, counter, ({ host, frames, clock }) => {
    const stub = createStubHost({ seed: 0x51ab, reducedMotion: true, onReport: (r) => reports.push(r) })
    const handle = mount(host as unknown as HTMLElement, stub)

    // Into the window, then the sheet goes up for thirty seconds.
    let t = pump(frames, 90, 0, clock)
    handle.pause()
    t = pump(frames, SHEET_FRAMES, t, clock)
    handle.resume()
    // And then the window runs its course.
    t = pump(frames, 1400, t, clock)
    handle.unmount()
  })

  assert.ok(reports.length > 0, "no round was ever seated")
  const sheetMs = SHEET_FRAMES * 16.7
  const first = reports[0] as { ms: number }
  assert.ok(
    first.ms < sheetMs,
    `${Math.round(first.ms)} ms was billed for a round that had a ${Math.round(sheetMs)} ms sheet over it`,
  )
})
