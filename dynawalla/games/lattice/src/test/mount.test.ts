// A smoke test for the surface.
//
// `tsc` proves the draw calls type-check and the vite build proves the modules
// resolve. Neither proves that a frame *runs* — a stale property, a function
// renamed in `render/` and not in `mount.ts`, a value read before it is
// assigned, all compile and all crash on the first frame in front of a child.
//
// So this mounts the real game against a canvas that records instead of paints,
// drives hundreds of frames with the sticks moving and the trigger down, and
// asserts that nothing threw, that the world moved, and that the host's sheet
// stops it at the shell as well as in the rules.
//
// It is not a rendering test — there are no pixels to look at — it is a test
// that the whole thing is wired to itself.

import assert from "node:assert/strict"
import { test } from "node:test"

import { mount } from "../contract.ts"
import { createStubHost } from "../stubHost.ts"

type Listener = (event: unknown) => void

/** A 2D context that answers every call and records how much it was asked for. */
function fakeContext(counter: { calls: number; text: string[] }): CanvasRenderingContext2D {
  const store = new Map<string, unknown>()
  const noop = (name: string) =>
    function (...args: unknown[]) {
      counter.calls++
      if (name === "fillText" && typeof args[0] === "string") counter.text.push(args[0])
      if (name === "measureText") return { width: 40 }
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
  style: Record<string, string>
  width: number
  height: number
  listeners: Map<string, Listener[]>
  appendChild(child: unknown): void
  append(...children: unknown[]): void
  remove(): void
  setAttribute(name: string, value: string): void
  focus(): void
  addEventListener(type: string, fn: Listener): void
  removeEventListener(type: string, fn: Listener): void
  setPointerCapture(): void
  releasePointerCapture(): void
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
      append() {},
      remove() {},
      setAttribute() {},
      focus() {},
      addEventListener(type, fn) {
        const list = listeners.get(type) ?? []
        list.push(fn)
        listeners.set(type, list)
      },
      removeEventListener(type, fn) {
        listeners.set(
          type,
          (listeners.get(type) ?? []).filter((f) => f !== fn),
        )
      },
      setPointerCapture() {},
      releasePointerCapture() {},
      getBoundingClientRect: () => ({ width: size.w, height: size.h, left: 0, top: 0 }),
      getContext: () => ctx,
    }
  }
  const created: FakeElement[] = []
  // Enough document for the shared how-to-play chrome, which mounts a button
  // and a panel and asks the safe-area probe where the notch is. `document.body`
  // is real machinery here, not padding: `safeInsets` appends its probe to it.
  const doc = {
    body: make(),
    activeElement: null,
    getElementById: () => null,
    createElement() {
      const el = make()
      created.push(el)
      return el
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

/** The canvas is the only element `mount` creates. */
function canvasOf(created: FakeElement[]): FakeElement {
  const el = created[0]
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
  for (const reduced of [false, true]) {
    test(`a sitting runs without throwing at ${w}×${h}, reducedMotion=${reduced}`, () => {
      const counter = { calls: 0, text: [] as string[] }
      withBrowser({ w, h }, counter, ({ host, frames, created }) => {
        const stub = createStubHost({ seed: 0x1a771ce, reducedMotion: reduced })
        const handle = mount(host as unknown as HTMLElement, stub)
        const canvas = canvasOf(created)

        let t = pump(frames, 240)
        assert.ok(counter.calls > 3000, `only ${counter.calls} draw calls in 240 frames`)
        assert.ok(counter.text.length > 0, "nothing was ever drawn with a numeral on it")

        // Both thumbs down: fly with the left, aim and fire with the right.
        const down = canvas.listeners.get("pointerdown")?.[0]
        const move = canvas.listeners.get("pointermove")?.[0]
        const up = canvas.listeners.get("pointerup")?.[0]
        assert.ok(down && move && up, "the twin-stick listeners were not installed")

        down({ preventDefault() {}, pointerId: 1, pointerType: "touch", clientX: w * 0.2, clientY: h * 0.7 })
        down({ preventDefault() {}, pointerId: 2, pointerType: "touch", clientX: w * 0.8, clientY: h * 0.7 })
        const before = counter.calls
        for (let i = 0; i < 120; i++) {
          move({
            pointerId: 1,
            pointerType: "touch",
            clientX: w * 0.2 + Math.sin(i / 9) * 60,
            clientY: h * 0.7 + Math.cos(i / 7) * 60,
          })
          move({
            pointerId: 2,
            pointerType: "touch",
            clientX: w * 0.8 + Math.cos(i / 5) * 50,
            clientY: h * 0.7 + Math.sin(i / 6) * 50,
          })
          t = pump(frames, 4, t)
        }
        assert.ok(counter.calls > before, "the arena stopped drawing while it was being flown")

        up({ pointerId: 1, pointerType: "touch" })
        up({ pointerId: 2, pointerType: "touch" })
        t = pump(frames, 120, t)

        // The host's sheet: the loop keeps running, the world does not.
        handle.pause()
        const painted = counter.calls
        t = pump(frames, 60, t)
        assert.ok(counter.calls > painted, "the frame stopped being drawn under the sheet")
        assert.ok(
          counter.text.includes("PAUSED"),
          "the pack did not say it was paused under the sheet",
        )

        handle.resume()
        t = pump(frames, 120, t)
        handle.unmount()

        // Nothing is left listening, and a frame after unmount is a no-op.
        assert.equal(canvas.listeners.get("pointerdown")?.length ?? 0, 0)
        const after = counter.calls
        pump(frames, 5, t)
        assert.equal(counter.calls, after, "the loop kept drawing after unmount")
      })
    })
  }
}

test("flying into the resonator actually asserts the hold", () => {
  // The rule for this lives in `Arena.enter`, it is asserted to death in
  // `arena.test.ts` and `resonance.test.ts` — and the shell never called it.
  // Every unit test in this package passed while the one act the whole game is
  // for did nothing at all: a child could fly through the ring for an hour and
  // the host would never hear a single answer. Nothing threw. Nothing went red.
  //
  // Rules tests cannot catch that, because the missing call is not in the
  // rules. So this flies the REAL shell — the real loop, the real physics, the
  // real collision — and asserts the host was told something.
  //
  // `Date.now` is pinned because `mount` seeds its generator from it. Left
  // alone, this test would be a different arena every run.
  const realNow = Date.now
  Date.now = () => 1_700_000_000_000
  try {
    const counter = { calls: 0, text: [] as string[] }
    withBrowser({ w: 900, h: 700 }, counter, ({ host, frames, created }) => {
      const answered: string[] = []
      const stub = createStubHost({
        seed: 0x1a771ce,
        reducedMotion: true,
        onReport: (r) => answered.push(r.answered),
      })
      const handle = mount(host as unknown as HTMLElement, stub)
      const canvas = canvasOf(created)
      const down = canvas.listeners.get("pointerdown")?.[0]
      const move = canvas.listeners.get("pointermove")?.[0]
      assert.ok(down && move, "the twin-stick listeners were not installed")

      // Both thumbs down: the left one sweeps the arena on a slow figure that
      // does not repeat, the right one holds the trigger and turns the guns.
      down({ preventDefault() {}, pointerId: 1, pointerType: "touch", clientX: 225, clientY: 350 })
      down({ preventDefault() {}, pointerId: 2, pointerType: "touch", clientX: 675, clientY: 350 })

      let t = 0
      for (let i = 0; i < 5000 && answered.length === 0; i++) {
        move({
          pointerId: 1,
          pointerType: "touch",
          clientX: 225 + Math.sin(i / 37) * 70,
          clientY: 350 + Math.cos(i / 23) * 70,
        })
        move({
          pointerId: 2,
          pointerType: "touch",
          clientX: 675 + Math.cos(i / 11) * 50,
          clientY: 350 + Math.sin(i / 13) * 50,
        })
        t = pump(frames, 1, t)
      }

      assert.ok(
        answered.length > 0,
        "a ship flew through the resonator for 5000 frames and the host was never told anything",
      )
      handle.unmount()
    })
  } finally {
    Date.now = realNow
  }
})

test("reading the rules holds the world, and closing them lets it go", () => {
  // A manual that leaves a twin-stick arena running is a manual a child cannot
  // afford to open. They come back to a ship that drifted through the resonator
  // and asserted a hold they were not there for — the host's sheet does exactly
  // that damage unguarded, and the how-to-play button is a door this pack owns.
  const realNow = Date.now
  Date.now = () => 1_700_000_000_000
  try {
    const counter = { calls: 0, text: [] as string[] }
    withBrowser({ w: 900, h: 700 }, counter, ({ host, frames, created }) => {
      const answered: string[] = []
      const stub = createStubHost({
        seed: 0x1a771ce,
        reducedMotion: true,
        onReport: (r) => answered.push(r.answered),
      })
      const handle = mount(host as unknown as HTMLElement, stub)
      const canvas = canvasOf(created)
      const down = canvas.listeners.get("pointerdown")?.[0]
      const move = canvas.listeners.get("pointermove")?.[0]
      assert.ok(down && move)

      // The how-to-play button and its PLAY button are the two things the
      // shared chrome puts a click handler on, in that order.
      const clickable = created.filter((el) => (el.listeners.get("click")?.length ?? 0) > 0)
      const help = clickable[0]
      const play = clickable[1]
      assert.ok(help && play, "the how-to-play chrome was not mounted")

      down({ preventDefault() {}, pointerId: 1, pointerType: "touch", clientX: 225, clientY: 350 })
      down({ preventDefault() {}, pointerId: 2, pointerType: "touch", clientX: 675, clientY: 350 })

      /** Fly the same unrepeating sweep as the sitting above, for `n` frames. */
      let i = 0
      let t = 0
      const fly = (n: number, until?: () => boolean): void => {
        for (let k = 0; k < n; k++, i++) {
          move({
            pointerId: 1,
            pointerType: "touch",
            clientX: 225 + Math.sin(i / 37) * 70,
            clientY: 350 + Math.cos(i / 23) * 70,
          })
          t = pump(frames, 1, t)
          if (until?.() === true) return
        }
      }

      // Open the manual, then hold both thumbs on the glass for a long time.
      help.listeners.get("click")?.[0]?.({})
      fly(3000)
      assert.equal(answered.length, 0, "an answer was asserted while the child was reading")
      assert.ok(counter.calls > 0, "the frame stopped being drawn behind the manual")

      // PLAY, and the same arena carries on being an arena.
      play.listeners.get("click")?.[0]?.({})
      fly(8000, () => answered.length > 0)
      assert.ok(answered.length > 0, "the world never came back after the manual closed")
      handle.unmount()
    })
  } finally {
    Date.now = realNow
  }
})

test("a pause that arrives while a thumb is down does not fly the ship on", () => {
  // The shell half of the pause. `Arena` refuses the input; this is the guard
  // that also lets go of the sticks, so a thumb that was resting on one when
  // the sheet came up is not still steering when it lifts.
  const counter = { calls: 0, text: [] as string[] }
  withBrowser({ w: 900, h: 700 }, counter, ({ host, frames, created }) => {
    const reports: string[] = []
    const stub = createStubHost({
      seed: 0x5ee7,
      reducedMotion: true,
      onReport: (r) => reports.push(r.answered),
    })
    const handle = mount(host as unknown as HTMLElement, stub)
    const canvas = canvasOf(created)
    const down = canvas.listeners.get("pointerdown")?.[0]
    const move = canvas.listeners.get("pointermove")?.[0]
    assert.ok(down && move)

    // A thumb pinned hard against the left stick, another on the trigger.
    down({ preventDefault() {}, pointerId: 1, pointerType: "touch", clientX: 100, clientY: 400 })
    move({ pointerId: 1, pointerType: "touch", clientX: 400, clientY: 100 })
    down({ preventDefault() {}, pointerId: 2, pointerType: "touch", clientX: 700, clientY: 400 })
    let t = pump(frames, 30)

    handle.pause()
    // Three seconds behind the sheet with both thumbs still on the glass.
    for (let i = 0; i < 180; i++) {
      move({ pointerId: 1, pointerType: "touch", clientX: 400, clientY: 100 })
      t = pump(frames, 1, t)
    }
    const said = reports.length
    handle.resume()
    // One frame back, with nothing touched: the sticks were let go, so the
    // ship must not still be flying the direction it was pinned in.
    t = pump(frames, 1, t)
    assert.equal(reports.length, said, "an answer was reported across the sheet")
    handle.unmount()
  })
})
