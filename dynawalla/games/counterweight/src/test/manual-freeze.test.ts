// THE YARD STOPS WHILE THE RULES ARE READ.
//
// "All games should pause while reading the instructions .. I can hear
// counterweight playing in the background while I'm reading the instructions
// ... stressing me out even more."
//
// This is the game that was named. The shared how-to-play sheet holds the sound
// itself now, and the keys and the taps with it — but it cannot hold a game's own
// clock. There is no press window left to run behind the scrim, and no sag to
// drain the pan while a child reads — but the abandonment guard is still there,
// and left running it decides nobody is home and racks a lot the child never saw.
//
// `mount.test.ts` already drives the host's `pause()` and a backgrounded tab.
// Neither of those is this: the defect was that the manual reached NEITHER of
// them. So this file never calls `pause()`. It finds the `dwc-help` control the
// shared module mounted, fires its own click handler the way a finger does, and
// watches the yard.

import assert from "node:assert/strict"
import { test } from "node:test"

import { mount } from "../contract.ts"
import type { Host } from "../contract.ts"
import { createStubHost } from "../stubHost.ts"
import { viewLayout } from "../render/layout.ts"
import { canvasOf, listenerOn, pump, withBrowser, type FakeElement } from "./browser.ts"

const W = 768
const H = 1024

/** Every face on the rack, from the real layout rather than a guessed point. */
function facePoints(): Array<{ x: number; y: number }> {
  return viewLayout(W, H).pillars.flatMap((pillar) =>
    [pillar.up, pillar.down].map((r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })),
  )
}

function stampPoint(): { x: number; y: number } {
  const { stamp } = viewLayout(W, H)
  return { x: stamp.x + stamp.w / 2, y: stamp.y + stamp.h / 2 }
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
  /**
   * Every ending a weight can have — seated, or whistled. Both close an item,
   * and a yard whose clock has stopped produces neither.
   */
  closed: unknown[]
  /** Weights the game asked the host for. A frozen bout asks for nothing. */
  asked: number
  /** A strike that reached the rules fires one. Nothing else does. */
  haptics: string[]
  reports: Array<{ ms: number }>
}

function stub(world: World): Host {
  const base = createStubHost({ seed: 0x51ab, reducedMotion: true })
  return {
    ...base,
    next: (o) => {
      world.asked++
      return base.next(o)
    },
    report: (r) => {
      world.reports.push(r)
      world.closed.push(r)
    },
    skip: (id) => {
      world.closed.push(id)
    },
    haptic: (k) => {
      world.haptics.push(k)
    },
  }
}

const counter = () => ({ calls: 0, text: [] as string[] })

/**
 * Run the yard until a round has actually gone by.
 *
 * A fixed frame count would be a guess about the press window, and the window
 * is deliberately a function of the sum. Waiting for the observable instead
 * means the test says what it means: the world was demonstrably turning before
 * anything was asked of it.
 */
function untilARoundGoesBy(
  frames: Array<(t: number) => void>,
  world: World,
  from: number,
  clock: { now: number },
): number {
  let t = from
  for (let i = 0; i < 400 && world.closed.length === 0; i++) t = pump(frames, 100, t, clock)
  assert.ok(world.closed.length > 0, "no round ever went by")
  return t
}

test("MANUAL FREEZES THE YARD: no window opens, closes or whistles behind the rules", () => {
  withBrowser({ w: W, h: H }, counter(), ({ host, frames, created, clock }) => {
    const world: World = { closed: [], asked: 0, haptics: [], reports: [] }
    const handle = mount(host as unknown as HTMLElement, stub(world))
    let t = untilARoundGoesBy(frames, world, 0, clock)

    const open = control(created, "dwc-help")
    const close = control(created, "dwc-close")
    open()

    const closed = world.closed.length
    const asked = world.asked
    // A hundred seconds behind the scrim — more than the longest abandonment
    // guard in the pack, which is exactly what the child used to lose by
    // reading.
    t = pump(frames, 6000, t, clock)

    assert.equal(
      world.closed.length,
      closed,
      `${world.closed.length - closed} rounds were closed while the child was reading the rules`,
    )
    assert.equal(world.asked, asked, "a weight was hung behind the manual")

    close()
    t = pump(frames, 6000, t, clock)
    assert.ok(world.closed.length > closed, "the yard never came back after the manual closed")
    assert.ok(world.asked > asked, "no new weight was hung after the manual closed")
    handle.unmount()
  })
})

test("a blow struck behind the manual is not a blow", () => {
  withBrowser({ w: W, h: H }, counter(), ({ host, frames, created, clock }) => {
    const world: World = { closed: [], asked: 0, haptics: [], reports: [] }
    const handle = mount(host as unknown as HTMLElement, stub(world))
    const canvas = canvasOf(created)
    // `listenerOn` throws if the rack was never wired to anything. An
    // `assert.ok` on a `as Listener` cast could not: the cast makes it
    // non-nullable before the assertion ever sees it.
    const down = listenerOn(canvas, "pointerdown")
    const up = listenerOn(canvas, "pointerup")
    const hit = (p: { x: number; y: number }): void => {
      down({ preventDefault: () => undefined, clientX: p.x, clientY: p.y })
      up({})
    }

    let t = pump(frames, 120, 0, clock)
    // The positive control. Without it, "nothing happened" below would pass
    // just as well for a sweep that lands on no plate at all.
    for (const p of facePoints()) {
      hit(p)
      t = pump(frames, 20, t, clock)
    }
    assert.ok(world.haptics.length > 0, "the sweep never struck a plate, so it proves nothing")

    const open = control(created, "dwc-help")
    const close = control(created, "dwc-close")
    open()
    const haptics = world.haptics.length
    const closed = world.closed.length
    // A child reading a manual still has a thumb on the glass. The shared
    // module swallows the pointer before the game sees it on a device; this
    // goes round the swallow and calls the game's own handler, which must
    // refuse as well — belt and braces, because only one of the two is ours.
    for (const p of facePoints()) {
      hit(p)
      t = pump(frames, 20, t, clock)
    }
    hit(stampPoint())
    t = pump(frames, 60, t, clock)

    assert.equal(world.haptics.length, haptics, "a blow behind the manual reached the rack")
    assert.equal(world.closed.length, closed, "the beam was seated through the manual")

    close()
    t = pump(frames, 30, t, clock)
    for (const p of facePoints()) {
      hit(p)
      t = pump(frames, 20, t, clock)
    }
    assert.ok(world.haptics.length > haptics, "the rack never came back after the manual closed")
    handle.unmount()
  })
})

test("the read is not billed to the child as thinking time", () => {
  // Latency is measured against the wall clock, and the wall clock keeps
  // running behind the manual. Unless `onOpen` reaches `pauseAll`, a child who
  // spends half a minute in the rules is recorded as a child who spent half a
  // minute failing to evaluate a column, and the fluency model reads it as
  // difficulty.
  const SHEET_FRAMES = 1800
  withBrowser({ w: W, h: H }, counter(), ({ host, frames, created, clock }) => {
    const world: World = { closed: [], asked: 0, haptics: [], reports: [] }
    const handle = mount(host as unknown as HTMLElement, stub(world))
    const canvas = canvasOf(created)
    const down = listenerOn(canvas, "pointerdown")
    const up = listenerOn(canvas, "pointerup")

    // Into the window, then the rules for thirty seconds.
    let t = pump(frames, 90, 0, clock)
    const open = control(created, "dwc-help")
    const close = control(created, "dwc-close")
    open()
    t = pump(frames, SHEET_FRAMES, t, clock)
    close()
    t = pump(frames, 30, t, clock)

    // Then the child seats the beam. A whistle is not reported at all, so the
    // round has to be *declared* for there to be an `ms` to bill.
    const lever = stampPoint()
    down({ preventDefault: () => undefined, clientX: lever.x, clientY: lever.y })
    up({})
    t = pump(frames, 30, t, clock)
    handle.unmount()

    assert.ok(world.reports.length > 0, "no round was ever seated")
    const sheetMs = SHEET_FRAMES * 16.7
    const first = world.reports[0]
    assert.ok(first)
    assert.ok(
      first.ms < sheetMs,
      `${Math.round(first.ms)} ms was billed for a round that had a ${Math.round(sheetMs)} ms manual over it`,
    )
  })
})

test("THE MANUAL ONLY LIFTS ITS OWN PAUSE: closing it cannot restart a host-paused game", () => {
  // The host puts a sheet over a still-mounted pack — a parent gate, a stopping
  // point, and this game raises one itself every time a scale is cleared. A child
  // stuck behind it opens the rules and closes them again. Without the guard,
  // the yard is handed back RUNNING underneath a sheet that is still up, and
  // the next window opens and whistles where nobody can see it.
  withBrowser({ w: W, h: H }, counter(), ({ host, frames, created, clock }) => {
    const world: World = { closed: [], asked: 0, haptics: [], reports: [] }
    const handle = mount(host as unknown as HTMLElement, stub(world))
    let t = untilARoundGoesBy(frames, world, 0, clock)

    handle.pause()
    const closed = world.closed.length
    const asked = world.asked

    const open = control(created, "dwc-help")
    const close = control(created, "dwc-close")
    open()
    t = pump(frames, 3000, t, clock)
    close()
    // Fifty more seconds after the manual is put away, and the host has never
    // lifted its sheet.
    t = pump(frames, 3000, t, clock)

    assert.equal(world.closed.length, closed, "the manual handed a host-paused game back to the loop")
    assert.equal(world.asked, asked, "a weight was hung behind the host's sheet")

    // And the host's own resume still works: the pause was not double-counted.
    handle.resume()
    t = pump(frames, 6000, t, clock)
    assert.ok(world.closed.length > closed, "the game never came back when the host lifted its sheet")
    handle.unmount()
  })
})

test("a backgrounded tab, read behind, and brought back is still stopped by the manual", () => {
  // Both pauses are the same flag, so the order they arrive in matters. A tab
  // hidden first must not let the manual's close resume the yard.
  withBrowser({ w: W, h: H }, counter(), ({ host, frames, created, doc, clock }) => {
    const world: World = { closed: [], asked: 0, haptics: [], reports: [] }
    const handle = mount(host as unknown as HTMLElement, stub(world))
    let t = untilARoundGoesBy(frames, world, 0, clock)

    doc.visibilityState = "hidden"
    for (const fn of doc.listeners.get("visibilitychange") ?? []) fn({})
    const closed = world.closed.length

    const open = control(created, "dwc-help")
    const close = control(created, "dwc-close")
    open()
    t = pump(frames, 1500, t, clock)
    close()
    t = pump(frames, 3000, t, clock)
    assert.equal(world.closed.length, closed, "the manual resumed a backgrounded tab")

    doc.visibilityState = "visible"
    for (const fn of doc.listeners.get("visibilitychange") ?? []) fn({})
    t = pump(frames, 6000, t, clock)
    assert.ok(world.closed.length > closed, "the yard never came back when the tab did")
    handle.unmount()
  })
})

test("opening and closing the manual repeatedly is not a stack of pauses", () => {
  withBrowser({ w: W, h: H }, counter(), ({ host, frames, created, clock }) => {
    const world: World = { closed: [], asked: 0, haptics: [], reports: [] }
    const handle = mount(host as unknown as HTMLElement, stub(world))
    let t = pump(frames, 300, 0, clock)
    const open = control(created, "dwc-help")
    const close = control(created, "dwc-close")
    for (let round = 0; round < 6; round++) {
      open()
      open() // already open: the module refuses, and `onOpen` must not run twice
      const asked = world.asked
      t = pump(frames, 2600, t, clock)
      assert.equal(world.asked, asked, `read ${round} did not stop the yard`)
      close()
      close() // and a double close must not resume a game twice
      // Long enough for the abandonment guard to rack an untouched lot. It used to
      // be 1200 frames — 20.0 s, a whole press window. There is no window now, and
      // the guard on the bottom rung is `MIN_GUARD_SECONDS`: 30 s.
      t = pump(frames, 2600, t, clock)
      assert.ok(world.asked > asked, `read ${round} left the game stuck paused`)
    }
    handle.unmount()
  })
})
