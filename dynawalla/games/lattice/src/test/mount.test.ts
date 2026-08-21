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
import { safeRect } from "../../../../packs/shared/game-chrome/index.ts"
import { hudLayout } from "../render/hud.ts"
import { createStubHost } from "../stubHost.ts"
import { noteOpen, opensEver, resetOpensForTest } from "../game/seen.ts"

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

test("a fresh profile never sees NO RESONATOR — SWEEP ON", () => {
  // **The founder's screen, at the shell.** `band.test.ts` has the full account
  // and the rules-level assertions; this one is here because the line he read
  // out is drawn by `render/scene.ts` off `arena.stalled`, and neither the rules
  // nor the renderer can be asked on its own whether a child saw it.
  //
  // So: the real mount, the real loop, the real HUD, a canvas that records every
  // string it is asked to paint, and a host whose own ladder is standing on rung
  // 0 the way it is on every launch of every fresh profile. Sixty seconds of it.
  //
  // Against the shipped 0.3.10 build this fails on the first frame and stays
  // failed: the notice is the only thing on the screen that changes.
  const realNow = Date.now
  Date.now = () => 1_700_000_000_000
  try {
    const counter = { calls: 0, text: [] as string[] }
    withBrowser({ w: 390, h: 740 }, counter, ({ host, frames }) => {
      const stub = createStubHost({ seed: 0x1a771ce, reducedMotion: true })
      assert.equal(stub.position(), 0, "the host did not open on a fresh profile")
      const handle = mount(host as unknown as HTMLElement, stub)
      pump(frames, 3600)
      const stalls = counter.text.filter((s) => s.includes("NO RESONATOR"))
      assert.deepEqual(
        stalls.slice(0, 1),
        [],
        `a child on a fresh profile was told there is no resonator, on ${stalls.length} frames ` +
          `of 3600`,
      )
      // And the ring was really drawn, rather than the notice merely being
      // absent because nothing was drawn at all.
      assert.ok(
        counter.text.some((s) => /^\d+\s[+−]\s\d+$/.test(s)),
        "no resonator ever put a problem on its face",
      )
      handle.unmount()
    })
  } finally {
    Date.now = realNow
  }
})

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
      //
      // Both thumbs go down again, because that is what actually happens: the
      // manual's PLAY button is a DOM control, so the child's thumbs came off the
      // canvas to reach it, and opening the manual let the sticks go anyway (a
      // stick still held behind a sheet is the bug the guard exists for). Without
      // pressing again this test flew nothing at all and passed on the Brownian
      // motion of a drifting resonator finding a stationary ship.
      play.listeners.get("click")?.[0]?.({})
      down({ preventDefault() {}, pointerId: 1, pointerType: "touch", clientX: 225, clientY: 350 })
      down({ preventDefault() {}, pointerId: 2, pointerType: "touch", clientX: 675, clientY: 350 })
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

test("the shell is wired to the hint: a tap unfolds the tree, and so does the quiet", () => {
  // The bug this file already carries a scar from, in a new place. `Arena.enter`
  // was asserted to death in the rules tests and NEVER CALLED BY THE SHELL, and
  // the whole reasoning layer was unreachable in the shipped game while every
  // test was green. `askHint`, `unfold` and `Arena.hint` are three more calls
  // that live entirely in the shell, and every assertion about them in
  // `hint.test.ts` would pass with all three unwired — a hint system a child
  // could never see, in a game whose whole problem is getting stuck.
  //
  // So this drives the REAL shell: the real pointer handler, the real loop, the
  // real renderer, and asks whether a `?` ever reached the canvas.
  const realNow = Date.now
  const savedPerformance = Object.getOwnPropertyDescriptor(globalThis, "performance")
  Date.now = () => 1_700_000_000_000
  // The hint's quiet is measured against the wall clock the shell reads, so the
  // wall clock has to be one this test owns. Nothing else in the loop uses it.
  let wall = 0
  Object.defineProperty(globalThis, "performance", {
    configurable: true,
    writable: true,
    value: { now: () => wall },
  })
  try {
    const counter = { calls: 0, text: [] as string[] }
    withBrowser({ w: 900, h: 700 }, counter, ({ host, frames, created }) => {
      const stub = createStubHost({ seed: 0x1a771ce, reducedMotion: true })
      const handle = mount(host as unknown as HTMLElement, stub)
      const canvas = canvasOf(created)
      const down = canvas.listeners.get("pointerdown")?.[0]
      assert.ok(down, "the pointer listener was not installed")

      let t = pump(frames, 8)
      counter.text.length = 0
      t = pump(frames, 2, t)
      assert.equal(
        counter.text.includes("?"),
        false,
        "the factor tree was on screen before anybody asked for it and before any quiet",
      )

      // A tap on the control, where `hudLayout` says it is. Down AND up: the
      // control fires on release, so that a thumb coming to rest at the
      // bottom-left of the screen — which is where the movement stick lives —
      // does not ask for a hint nobody wanted.
      const up = canvas.listeners.get("pointerup")?.[0]
      assert.ok(up, "the release listener was not installed")
      const { cx, cy } = hudLayout(900, safeRect(900, 700)).hint
      down({ preventDefault() {}, pointerId: 9, pointerType: "touch", clientX: cx, clientY: cy })
      wall += 16.7
      t = pump(frames, 1, t)
      up({ pointerId: 9, pointerType: "touch", clientX: cx, clientY: cy })
      counter.text.length = 0
      t = pump(frames, 3, t)
      assert.ok(
        counter.text.includes("?"),
        "tapping the hint control drew no tree at all — the control is not wired to the arena",
      )

      handle.unmount()
    })

    // A thumb that lands on the control and then flies the ship is a child
    // reaching for the stick, not a child asking for anything. This is the exact
    // gesture that broke the first cut: the control sits at the bottom-left of
    // the safe area, which is where a left thumb comes to rest, and firing on
    // pointer-DOWN meant that settling your hand there BOTH unfolded a tree
    // nobody wanted AND swallowed the touch, so the ship would not move.
    const rest = { calls: 0, text: [] as string[] }
    withBrowser({ w: 900, h: 700 }, rest, ({ host, frames, created }) => {
      wall = 0
      const stub = createStubHost({ seed: 0x1a771ce, reducedMotion: true })
      const handle = mount(host as unknown as HTMLElement, stub)
      const canvas = canvasOf(created)
      const down = canvas.listeners.get("pointerdown")?.[0]
      const move = canvas.listeners.get("pointermove")?.[0]
      const up = canvas.listeners.get("pointerup")?.[0]
      assert.ok(down && move && up)

      let t = pump(frames, 8)
      const { cx, cy } = hudLayout(900, safeRect(900, 700)).hint

      // Thumb down on the control, then slid up and to the right to fly.
      down({ preventDefault() {}, pointerId: 3, pointerType: "touch", clientX: cx, clientY: cy })
      rest.text.length = 0
      for (let i = 0; i < 40; i++) {
        move({ pointerId: 3, pointerType: "touch", clientX: cx + 4 + i * 2, clientY: cy - i * 2 })
        wall += 16.7
        t = pump(frames, 1, t)
      }
      up({ pointerId: 3, pointerType: "touch", clientX: cx + 84, clientY: cy - 80 })
      t = pump(frames, 3, t)
      assert.equal(
        rest.text.includes("?"),
        false,
        "resting a thumb on the control and then flying asked for a hint nobody wanted",
      )

      // And a thumb that lands on the control, sweeps out to fly, and comes
      // back to where it started — which is what a stick held in a circle does
      // every revolution. It ends up inside the control and it was never a tap.
      down({ preventDefault() {}, pointerId: 5, pointerType: "touch", clientX: cx, clientY: cy })
      // Deliberately inside `HINT_TAP_MS`, so that the only thing that can catch
      // this gesture is the travel flag and not the duration.
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        move({
          pointerId: 5,
          pointerType: "touch",
          clientX: cx + Math.sin(a) * 70,
          clientY: cy - 70 + Math.cos(a) * 70,
        })
        wall += 16.7
        t = pump(frames, 1, t)
      }
      up({ pointerId: 5, pointerType: "touch", clientX: cx, clientY: cy })
      t = pump(frames, 3, t)
      assert.equal(
        rest.text.includes("?"),
        false,
        "a stick swept in a circle back to where it started asked for a hint",
      )

      // A gesture the PLATFORM took away is not a tap.
      //
      // `pointercancel` is WKWebView saying the touch is no longer the child's —
      // an edge drag, a palm rejected, a system gesture claiming it — and it
      // arrives with the last known coordinates, so it satisfies every test a
      // real tap satisfies. Routed into the release handler, which is where it
      // used to go, a thumb that landed on the control and was cancelled 200ms
      // later unfolded a stage. That is not a small leak: the clock deliberately
      // stops one stage short of the reveal, so on a question the child has been
      // sitting with, the phantom stage IS the one that states the answer.
      const cancel = canvas.listeners.get("pointercancel")?.[0]
      assert.ok(cancel, "the cancel listener was not installed")
      down({ preventDefault() {}, pointerId: 6, pointerType: "touch", clientX: cx, clientY: cy })
      wall += 200
      t = pump(frames, 3, t)
      cancel({ pointerId: 6, pointerType: "touch", clientX: cx, clientY: cy })
      t = pump(frames, 3, t)
      assert.equal(
        rest.text.includes("?"),
        false,
        "a touch the platform cancelled asked for a hint the child never did",
      )

      // A thumb that lands there and simply STAYS is not a tap either.
      down({ preventDefault() {}, pointerId: 4, pointerType: "touch", clientX: cx, clientY: cy })
      for (let i = 0; i < 60; i++) {
        wall += 16.7
        t = pump(frames, 1, t)
      }
      up({ pointerId: 4, pointerType: "touch", clientX: cx, clientY: cy })
      t = pump(frames, 3, t)
      assert.equal(
        rest.text.includes("?"),
        false,
        "a thumb resting on the control for a second asked for a hint",
      )
      handle.unmount()
    })

    // And the same thing again with nobody touching anything, on the clock.
    const quiet = { calls: 0, text: [] as string[] }
    withBrowser({ w: 900, h: 700 }, quiet, ({ host, frames, created }) => {
      wall = 0
      const felt: string[] = []
      const stub = createStubHost({
        seed: 0x1a771ce,
        reducedMotion: true,
        onHaptic: (k) => felt.push(k),
      })
      const handle = mount(host as unknown as HTMLElement, stub)
      assert.ok(canvasOf(created))
      let t = pump(frames, 8)
      quiet.text.length = 0
      t = pump(frames, 4, t)
      assert.equal(quiet.text.includes("?"), false, "a hint arrived in the first fifth of a second")

      // Two minutes of a child sitting there, which is what "stuck" looks like.
      // The hint's clock is PLAYED time now, accumulated in `Arena.step` off the
      // frame delta, so this has to be real frames — which is also the point:
      // `wall` moving on its own can no longer unfold anything.
      for (let i = 0; i < 8000 && !quiet.text.includes("?"); i++) {
        wall += 16.7
        t = pump(frames, 1, t)
      }
      assert.ok(
        quiet.text.includes("?"),
        "two minutes with the question and the game never offered a thing",
      )
      // And it ARRIVED rather than merely appearing. Nobody touched anything for
      // two minutes, so the only thing that can have made the hand buzz is the
      // hint event reaching the shell — which is the sound, the ripple under the
      // ring, and the reason a child looks down at all. Drawn without it, the
      // tree fades in silently at the bottom of the screen while the child is
      // watching a husk at the top.
      assert.deepEqual(felt, ["light"], `the hint never announced itself: ${felt.join(",")}`)
      handle.unmount()
    })

    // And on a keyboard, where the child has no thumb to put on the control.
    // Tablet and desktop are equal targets in this pack, and `H` is the only way
    // in on one of them.
    const keys = { calls: 0, text: [] as string[] }
    const savedAdd = Object.getOwnPropertyDescriptor(globalThis, "addEventListener")
    const handlers = new Map<string, Array<(e: unknown) => void>>()
    Object.defineProperty(globalThis, "addEventListener", {
      configurable: true,
      writable: true,
      value: (type: string, fn: (e: unknown) => void) => {
        handlers.set(type, [...(handlers.get(type) ?? []), fn])
      },
    })
    try {
      withBrowser({ w: 900, h: 700 }, keys, ({ host, frames, created }) => {
        wall = 0
        const stub = createStubHost({ seed: 0x1a771ce, reducedMotion: true })
        const handle = mount(host as unknown as HTMLElement, stub)
        assert.ok(canvasOf(created))
        let t = pump(frames, 8)
        keys.text.length = 0
        t = pump(frames, 2, t)
        assert.equal(keys.text.includes("?"), false, "a tree was up before the key was pressed")

        // Every keydown listener on the window, because the shared how-to-play
        // chrome installs one of its own before this pack installs the arena's
        // and a real key press reaches both.
        const keyDowns = handlers.get("keydown") ?? []
        assert.ok(keyDowns.length > 0, "the keyboard listener was not installed")
        for (const fn of keyDowns) fn({ key: "h", repeat: false, preventDefault() {} })
        // A key has no release to wait for; `H` fires on the press.
        keys.text.length = 0
        t = pump(frames, 3, t)
        assert.ok(keys.text.includes("?"), "pressing H drew no tree — the key is not wired")
        handle.unmount()
      })
    } finally {
      if (savedAdd) Object.defineProperty(globalThis, "addEventListener", savedAdd)
      else Reflect.deleteProperty(globalThis, "addEventListener")
    }
  } finally {
    Date.now = realNow
    if (savedPerformance) Object.defineProperty(globalThis, "performance", savedPerformance)
    else Reflect.deleteProperty(globalThis, "performance")
  }
})

// ── THE FIRST SCREEN, THROUGH THE REAL SHELL ────────────────────────────────
//
// The calm opening hangs off one wire: `mountLattice` reads `game/seen.ts` and
// hands it to the arena as `experience`. Every assertion in `opening.test.ts`
// is about the arena and would pass in full with that wire cut — the arena
// would simply never be told, and a first-time child would get the field the
// founder reported. So it is asserted here, at the shell, on the frame a child
// actually sees.
//
// What is counted is the numerals the renderer was asked to fill that are
// nothing but digits. On the first frame that is exactly the numbers on the
// field: the resonator's prompt has an operator and a space in it, the counters
// read `OPENED 0` and `BEST 0`, the empty hold reads `SWEEP THE LIT ONES`, and
// the factor tree is at stage nought and draws nothing at all.

/** Run `body` with a `localStorage` that starts out holding `seed`. */
function withStorage(seed: Record<string, string>, body: () => void): void {
  const store = new Map(Object.entries(seed))
  const saved = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
    },
  })
  try {
    body()
  } finally {
    if (saved) Object.defineProperty(globalThis, "localStorage", saved)
    else Reflect.deleteProperty(globalThis, "localStorage")
  }
}

/** The numerals on the field, on the first frame after mounting. */
function numeralsOnFirstFrame(opens: string | null): string[] {
  const counter = { calls: 0, text: [] as string[] }
  let out: string[] = []
  withStorage(opens === null ? {} : { "dw.lattice.opens": opens }, () => {
    resetOpensForTest()
    withBrowser({ w: 390, h: 740 }, counter, ({ host, frames }) => {
      const stub = createStubHost({ seed: 0x1a771ce, reducedMotion: true })
      const handle = mount(host as unknown as HTMLElement, stub)
      counter.text.length = 0
      pump(frames, 1)
      out = counter.text.filter((s) => /^\d+$/.test(s))
      handle.unmount()
    })
    resetOpensForTest()
  })
  return out
}

test("a child who has never played this opens on ONE number", () => {
  const numerals = numeralsOnFirstFrame(null)
  assert.equal(
    numerals.length,
    1,
    `the first screen of a first sitting had ${numerals.length} numbers on it: ${numerals.join(", ")}`,
  )
})

test("a child who has played before does not get walked through it again", () => {
  const fresh = numeralsOnFirstFrame(null)
  const returning = numeralsOnFirstFrame("9")
  assert.equal(fresh.length, 1)
  assert.ok(
    returning.length > fresh.length,
    `a child on their tenth ring got ${returning.length} numbers, the same as a first sitting`,
  )
})

test("what a sitting opened is remembered for the next one", () => {
  withStorage({}, () => {
    resetOpensForTest()
    assert.equal(opensEver(), 0, "a device that has never run this remembers something")
    assert.equal(noteOpen(), 1)
    assert.equal(noteOpen(), 2)
    assert.equal(noteOpen(), 3)
    // A new sitting: the module's memory is gone and only what was written back
    // is left, which is the whole point of the slot.
    resetOpensForTest()
    assert.equal(opensEver(), 3, "three rings opened were not there the next morning")
    resetOpensForTest()
  })
})

test("a frame with no storage at all still runs, and starts calm", () => {
  // `localStorage` throws on an opaque origin, which a pack frame is. The
  // failure mode has to be the gentle opening, never a game that will not start.
  const saved = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("SecurityError: the document is on an opaque origin")
    },
  })
  try {
    resetOpensForTest()
    assert.equal(opensEver(), 0)
    assert.equal(noteOpen(), 1, "a write that could not land lost the count in memory too")
  } finally {
    if (saved) Object.defineProperty(globalThis, "localStorage", saved)
    else Reflect.deleteProperty(globalThis, "localStorage")
    resetOpensForTest()
  }
})

test("a ring opened through the shell is written down for the next sitting", () => {
  // The other half of the wire. `numeralsOnFirstFrame` proves the shell READS
  // what a child has opened; this proves it WRITES it, by flying the real ship
  // through the real ring until the host hears a correct answer and then asking
  // the storage slot what it holds.
  //
  // Reachable blind precisely because of the calm opening: the first field is
  // one husk carrying the whole answer and nothing else, so every prime the
  // ship can possibly sweep is one of the answer's own.
  const realNow = Date.now
  Date.now = () => 1_700_000_000_000
  const store = new Map<string, string>()
  const saved = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
    },
  })
  try {
    resetOpensForTest()
    const counter = { calls: 0, text: [] as string[] }
    withBrowser({ w: 900, h: 700 }, counter, ({ host, frames, created }) => {
      let opened = 0
      const stub = createStubHost({
        seed: 0x1a771ce,
        reducedMotion: true,
        // Every open calls `transition("level", ...)` and nothing else does.
        // `report` will not do: a resonator that refused once has spent its id,
        // so the open that follows it is never reported at all — measured, the
        // slot held 2 against 1 correct answer, which is the shell being right
        // and the assertion being wrong.
        onTransition: (kind) => {
          if (kind === "level") opened += 1
        },
      })
      const handle = mount(host as unknown as HTMLElement, stub)
      const canvas = canvasOf(created)
      const down = canvas.listeners.get("pointerdown")?.[0]
      const move = canvas.listeners.get("pointermove")?.[0]
      assert.ok(down && move, "the twin-stick listeners were not installed")
      down({ preventDefault() {}, pointerId: 1, pointerType: "touch", clientX: 225, clientY: 350 })
      down({ preventDefault() {}, pointerId: 2, pointerType: "touch", clientX: 675, clientY: 350 })
      let t = 0
      // A circle whose heading turns about 1.4 radians a second — at the ship's
      // top speed that is an orbit of roughly 250 units — with the heading's
      // bias walking slowly round, so the orbit's centre crawls over the whole
      // arena and the ship passes through everything on it, the ring included.
      for (let i = 0; i < 30_000 && opened === 0; i++) {
        const heading = i * 0.023 + Math.sin(i / 900) * 2.4
        move({
          pointerId: 1,
          pointerType: "touch",
          clientX: 225 + Math.cos(heading) * 70,
          clientY: 350 + Math.sin(heading) * 70,
        })
        move({
          pointerId: 2,
          pointerType: "touch",
          clientX: 675 + Math.cos(i / 11) * 50,
          clientY: 350 + Math.sin(i / 13) * 50,
        })
        t = pump(frames, 1, t)
      }
      assert.ok(opened > 0, "no ring was ever opened, so there is nothing to have written down")
      assert.equal(
        store.get("dw.lattice.opens"),
        String(opened),
        `${opened} rings opened and the slot holds ${String(store.get("dw.lattice.opens"))}`,
      )
      handle.unmount()
    })
  } finally {
    Date.now = realNow
    if (saved) Object.defineProperty(globalThis, "localStorage", saved)
    else Reflect.deleteProperty(globalThis, "localStorage")
    resetOpensForTest()
  }
})
