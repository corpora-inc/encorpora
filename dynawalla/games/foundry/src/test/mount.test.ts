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
//
// The canvas it runs against lives in `rig.ts` and *enforces the parts of the 2D
// specification that throw*. The version of this file that shipped the blank-ring
// bug used a `Proxy` that answered every call with a stub, so nine hundred frames
// of a real bout could not fail for a colour, a radius or a transform — and did
// not, while every frame after the first kick-out was dying inside `drawMat`.

import assert from "node:assert/strict"
import { test } from "node:test"

import { mount } from "../contract.ts"
import { createStubHost } from "../stubHost.ts"
import {
  canvasOf,
  pump,
  recorder,
  recordingContext,
  withBrowser,
  type FakeElement,
} from "./rig.ts"

type Listener = (event: unknown) => void

for (const [w, h] of [
  [320, 568],
  [768, 1024],
  [1366, 1024],
] as const) {
  test(`a whole bout renders without throwing at ${w}×${h}`, () => {
    const rec = recorder()
    const reports: Array<{ correct: boolean }> = []
    withBrowser({ w, h }, recordingContext(rec), ({ host, frames, created, doc }) => {
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
      assert.ok(rec.calls > 5000, `only ${rec.calls} draw calls in 900 frames`)
      assert.ok(rec.text.length > 0, "nothing was ever written on the board")

      // And a tap goes all the way through the input handler into the rules.
      const down = canvas.listeners.get("pointerdown")?.[0]
      assert.ok(down, "no pointerdown listener was installed")
      const before = rec.calls
      for (let i = 0; i < 30; i++) {
        down({ preventDefault() {}, clientX: i % 2 === 0 ? w * 0.25 : w * 0.75, clientY: h * 0.9 })
        t = pump(frames, 12, t)
      }
      assert.ok(rec.calls > before)

      // Backgrounding the tab must stop the world without stopping the loop.
      doc.visibilityState = "hidden"
      for (const fn of doc.listeners.get("visibilitychange") ?? []) fn({})
      const paused = rec.calls
      t = pump(frames, 60, t)
      assert.equal(rec.calls, paused, "the count kept running while hidden")
      doc.visibilityState = "visible"
      for (const fn of doc.listeners.get("visibilitychange") ?? []) fn({})
      t = pump(frames, 30, t)
      assert.ok(rec.calls > paused, "the world never came back")

      // Nothing was ever handed a colour the canvas would have thrown out, and no
      // draw call leaked a `save()` — a leaked `clip()` hides everything after it.
      assert.deepEqual(
        [...new Set(rec.invalid)],
        [],
        "a colour string the canvas cannot parse reached it",
      )
      assert.equal(rec.imbalance, 0, "a draw call restored more than it saved")

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
  const rec = recorder()
  withBrowser({ w: 768, h: 1024 }, recordingContext(rec), ({ host, frames, created }) => {
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
    assert.ok(rec.text.length > 0)
    assert.ok(rec.calls > 3000)
    assert.deepEqual([...new Set(rec.invalid)], [], "reduced motion produced an unparseable colour")
    handle.unmount()
  })
})

test("a key cannot drop a plate through the how-to-play panel", () => {
  // The manual is a DOM scrim. A scrim stops the pointer and nothing else, and
  // `mount.ts` puts its keyboard on `globalThis` — so before this guard a child
  // reading the Controls section and trying the keys it names dropped plates
  // onto a bar hidden behind the panel.
  //
  // In this game that is not a cosmetic leak. One over the target loses the
  // fall on the spot, which is the whole reason mashing does not work, and the
  // scrim was hiding the only feedback there is. So the assertion is the
  // player-visible one: the fall must not end in TOO MUCH because of keys
  // pressed while the rules were open.
  //
  // The banner is only DRAWN on a frame and the loop is frozen while the panel
  // is up, so the panel has to be closed before anything is pumped — the first
  // draft of this test checked for the banner while the world was still frozen,
  // passed with the guard removed, and was worth nothing.
  const rec = recorder()
  withBrowser({ w: 390, h: 844 }, recordingContext(rec), ({ host, frames, created, globals }) => {
    const stub = createStubHost({ seed: 0x51ab, reducedMotion: false })
    const handle = mount(host as unknown as HTMLElement, stub)
    let t = pump(frames, 120)

    const help = created.find((el) => el.className === "dwc-help")
    const close = created.find((el) => el.className === "dwc-close")
    assert.ok(help, "the how-to-play control was never created")
    assert.ok(close, "the manual had no close button")
    const keys = globals.get("keydown") ?? []
    assert.ok(keys.length > 0, "no keyboard listener was installed on the window")

    const press = (n: number): void => {
      for (let i = 0; i < n; i++) {
        for (const fn of keys) {
          fn({ key: "d", repeat: false, preventDefault() {}, stopPropagation() {} })
        }
      }
    }
    const click = (el: FakeElement): void => {
      for (const fn of el.listeners.get("click") ?? []) fn({})
    }

    // Open the manual, lean on the heavy plate — forty taps overshoots any
    // target this game can serve, several times over — then CLOSE it and let
    // the world run, which is the only point at which a banner can be drawn.
    click(help)
    rec.text.length = 0
    press(40)
    click(close)
    t = pump(frames, 120, t)
    assert.equal(
      rec.text.includes("TOO MUCH"),
      false,
      "keys pressed behind the manual dropped plates and lost the fall",
    )

    // And the keyboard works the moment the panel is gone: a gate stuck shut is
    // the same bug wearing a different hat.
    rec.text.length = 0
    for (let i = 0; i < 40; i++) {
      press(1)
      t = pump(frames, 2, t)
    }
    t = pump(frames, 30, t)
    assert.equal(
      rec.text.includes("TOO MUCH"),
      true,
      "the keyboard never came back after the manual closed",
    )

    handle.unmount()
  })
})
