// THE GALLERY HOLDS STILL WHILE THE RULES ARE READ.
//
// "All games should pause while reading the instructions .. I can hear counterweight
// playing in the background while I'm reading the instructions ... stressing me out
// even more."
//
// The shared how-to-play sheet holds the sound, the keys and the taps by itself. What
// it cannot hold is a game's own clock, and it cannot know that a game exists — so
// `onOpen`/`onClose` are the one part of pausing a game has to opt into, and eleven of
// the twenty-seven shipped games had not.
//
// **Why this file exists when the sim's own pause is already tested.**
// `report.test.ts` tests `Auction.pause` in isolation, and `Auction` was never the
// thing that broke: the defect is in the *wiring* — whether the manual's `onOpen` ever
// reaches it. So this is a mount-level test, and it is the only test in the package
// that runs the real `mount`.
//
// **How the freeze is observed.** THE GAVEL keeps DRAWING while it is paused — a
// frozen frame under a translucent host sheet is what a paused pack should look like —
// so a frozen draw *count* would prove nothing. What is asserted instead is that the
// frames are IDENTICAL: every call and every argument the renderer makes, recorded and
// compared.
//
// The moment chosen is the reveal after the hammer, because that is the only thing in
// this game that moves on its own: the tablets turn over, the coin counter walks up to
// its new total, and when the hold expires the next lot is drawn. A child who opens the
// rules to find out why a lot did not sell must not come back to a different room.

import assert from "node:assert/strict"
import { test } from "node:test"

import { mount } from "../contract.ts"
import type { Host } from "../contract.ts"
import { createStubHost } from "../stubHost.ts"
import { Auction } from "../game/auction.ts"
import { Rng } from "../core/rng.ts"
import { layout } from "../render/layout.ts"
import { MIN_NUMERAL_PX, MIN_TABLETS } from "../game/ladder.ts"

type Handler = (event: unknown) => void

type FakeElement = {
  className: string
  id: string
  /**
   * PER ELEMENT. Both the shared module's help control and its close button register a
   * `"click"` listener, so a harness with one map keyed by event type silently drops
   * the first of the two and makes this test unwritable.
   */
  listeners: Map<string, Handler[]>
  style: Record<string, string>
  [key: string]: unknown
}

/**
 * A 2D context that writes down exactly what it was asked to draw.
 *
 * Two frames are the same frame if and only if these transcripts are equal, which is a
 * far stronger statement than a call count and the only one worth making about a game
 * that keeps painting while it is stopped.
 */
function recorder(frame: string[]): CanvasRenderingContext2D {
  const store = new Map<string, unknown>()
  const measured = { width: 40 }
  return new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (store.has(prop)) return store.get(prop)
        return (...args: unknown[]) => {
          frame.push(`${prop}(${args.map(String).join(",")})`)
          return measured
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
  frame: string[]
  /** Advance the clock by `ms` and run the frame the game asked for. */
  step(ms: number): void
  /** A pointerdown at canvas coordinates. */
  tap(x: number, y: number): void
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
        listeners.set(
          k,
          (listeners.get(k) ?? []).filter((f) => f !== h),
        )
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
  // The run is seeded from the wall clock, which is right on a device and fatal in a
  // test. Pinned to the value that makes `mount`'s `Date.now() ^ 0x9a7e1` come out zero,
  // so `firstRoom` below can mirror the run exactly.
  Date.now = () => SEED
  ;(globalThis as { devicePixelRatio?: number }).devicePixelRatio = 2
  globalThis.addEventListener = ((k: string, h: Handler): void => {
    globals.set(k, [...(globals.get(k) ?? []), h])
  }) as unknown as typeof globalThis.addEventListener
  globalThis.removeEventListener = ((k: string, h: Handler): void => {
    globals.set(
      k,
      (globals.get(k) ?? []).filter((f) => f !== h),
    )
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
    tap: (x: number, y: number) => {
      // The canvas is the first element the game creates, and the only one it binds a
      // pointerdown to.
      const canvas = created.find((el) => el.listeners.has("pointerdown"))
      assert.ok(canvas, "the game never bound a pointerdown")
      const handler = canvas.listeners.get("pointerdown")?.[0]
      assert.ok(handler)
      handler({ clientX: x, clientY: y, preventDefault: () => undefined })
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
  return () => {
    click({ type: "click", target: el })
  }
}

type World = {
  /** Questions the game asked the host for. A frozen gallery asks for none. */
  asked: number
  reports: Array<{ ms: number; correct: boolean; answered: string }>
  skips: string[]
  haptics: string[]
}

function stub(world: World): Host {
  const base = createStubHost({ seed: SEED, reducedMotion: false })
  return {
    ...base,
    next: (ask) => {
      world.asked++
      return base.next(ask)
    },
    report: (r) => {
      world.reports.push(r)
    },
    skip: (id) => {
      world.skips.push(id)
    },
    haptic: (k) => {
      world.haptics.push(k)
    },
  }
}



const W = 768
const H = 1024
/** Pinned in `install`, and the seed the harness gives the stub host. */
const SEED = 0x9a7e1

function pump(rig: Rig, frames: number): void {
  for (let i = 0; i < frames; i++) rig.step(16)
}

/** Where a key and a tablet are, from the real layout rather than a guess. */
function points() {
  const l = layout(W, H, MIN_TABLETS)
  const key = (id: string) => {
    const k = l.keys.find((entry) => entry.id === id)
    assert.ok(k, `no ${id} key`)
    return { x: k.rect.x + k.rect.w / 2, y: k.rect.y + k.rect.h / 2 }
  }
  const at = (index: number) => {
    const t = l.tablets[index]
    assert.ok(t, `no tablet ${String(index)}`)
    return { x: t.x + t.w / 2, y: t.y + t.h / 2 }
  }
  return {
    tablet: at(0),
    at,
    digit: (d: number) => key(`d${String(d)}`),
    one: key("d1"),
    two: key("d2"),
    gavel: key("gavel"),
    fold: key("fold"),
  }
}

/**
 * The room the mounted game is about to show, computed rather than guessed.
 *
 * `install` pins `Date.now` and the harness pins the host seed, so an `Auction` built with
 * the same two numbers draws the same first room. That is what lets a mount-level test bid
 * a *winning* price without reaching inside the mounted game.
 */
function firstRoom() {
  const mirror = new Auction(createStubHost({ seed: SEED, reducedMotion: false }), new Rng(0), 0)
  mirror.begin(0)
  const room = mirror.room
  assert.ok(room, "the mirrored auction drew no room")
  return room
}

test("a lot can be marked, bid on and hammered through the real mount", () => {
  const rig = install(W, H)
  const world: World = { asked: 0, reports: [], skips: [], haptics: [] }
  const handle = mount(rig.el, stub(world))
  try {
    pump(rig, 3)
    const p = points()
    rig.tap(p.tablet.x, p.tablet.y)
    assert.ok(world.haptics.includes("light"), "marking a tablet fired no haptic")
    rig.tap(p.one.x, p.one.y)
    rig.tap(p.two.x, p.two.y)
    rig.tap(p.gavel.x, p.gavel.y)
    assert.equal(world.reports.length, 1, "the hammer reported nothing")
    assert.equal(world.reports[0]?.answered, "11", "a bid of 12 asserts the tablet is worth 11")
    assert.ok(world.skips.length > 0, "the tablets the child did not answer were left open")
    // A bid of 12 will usually be under the room, and being outbid must not feel like a
    // buzzer. There is no `failure` haptic anywhere in this pack: a lot that got away is
    // a "medium" thud, the same weight as stone arriving in COLOSSUS.
    assert.equal(
      world.haptics.includes("failure"),
      false,
      "a losing lot fired the failure haptic — this pack has no buzzer",
    )
  } finally {
    handle.unmount()
    rig.restore()
  }
})

/**
 * Every numeral a child has to read, and the size it was drawn at.
 *
 * Walks the transcript keeping the current `font`, and reports each `fillText` whose text
 * contains a digit. A caption with no digits in it is exempt: "BROKER PAYS" at ten pixels
 * is a label on a plate whose number is drawn at thirty-four.
 */
function numerals(frame: readonly string[]): Array<{ text: string; px: number }> {
  const out: Array<{ text: string; px: number }> = []
  let px = 0
  for (const call of frame) {
    const font = /^font=.*?(\d+(?:\.\d+)?)px/.exec(call)
    if (font) {
      px = Number(font[1])
      continue
    }
    const drawn = /^fillText\((.*),[-\d.]+,[-\d.]+\)$/.exec(call)
    if (drawn && /\d/.test(drawn[1] ?? "")) out.push({ text: drawn[1] ?? "", px })
  }
  return out
}

test("no numeral a child has to read is drawn under the pack's own legibility floor", () => {
  // `MIN_NUMERAL_PX = 13` is described in `ladder.ts` as "a floor, not a target", citing
  // SERPENT's four-to-seven-pixel orbs. Four numerals were under it and nothing measured:
  // `CONSIGNMENT 1` and `3 UNSOLD` at 9px, the verdict line carrying the coins earned at
  // 11px, and `BEATING 88 + 61` — the marked tablet's own sum — at 10px.
  //
  // A transcript walk rather than a list of call sites, so the next numeral is covered by
  // being drawn rather than by somebody remembering to add it here.
  const rig = install(W, H)
  const world: World = { asked: 0, reports: [], skips: [], haptics: [] }
  const handle = mount(rig.el, stub(world))
  try {
    pump(rig, 3)
    const p = points()
    const room = firstRoom()
    const best = room.tablets.findIndex((t) => t.value === room.highest)
    // Live room, with a mark on a tablet so the paddle prints `BEATING <sum>`.
    rig.tap(p.at(best).x, p.at(best).y)
    pump(rig, 2)
    const live = numerals(rig.frame)
    assert.ok(live.length > 8, `only ${String(live.length)} numerals drawn on a live room`)

    // A keen bid, so the settled room prints a verdict WITH COINS IN IT. Bidding blind
    // here would usually be outbid, whose verdict has no numeral in it at all, and the
    // 11px verdict line would go unmeasured — which is exactly how it shipped.
    for (const ch of String(room.highest + 1)) {
      const k = p.digit(Number(ch))
      rig.tap(k.x, k.y)
    }
    rig.tap(p.gavel.x, p.gavel.y)
    pump(rig, 30)
    assert.equal(world.reports.length, 1)
    assert.ok(
      rig.frame.some((call) => call.startsWith("fillText(") && /◉/.test(call)),
      "the settled room printed no coin verdict, so the verdict's size went unmeasured",
    )
    const settled = numerals(rig.frame)
    assert.ok(settled.length > 8, `only ${String(settled.length)} numerals drawn on a settled room`)

    for (const { text, px } of [...live, ...settled]) {
      assert.ok(
        px >= MIN_NUMERAL_PX,
        `"${text}" was drawn at ${String(px)}px, under the ${String(MIN_NUMERAL_PX)}px floor`,
      )
    }
  } finally {
    handle.unmount()
    rig.restore()
  }
})

test("the settled room actually draws what the rivals were bidding", () => {
  // The reveal is the teaching moment: every tablet turns over and the highest is
  // ringed, so a child who marked the wrong one sees the number they should have read.
  // Asserted off the renderer's own transcript, because a reveal that draws nothing
  // fails no other test in this package — POLARITY shipped four blank glowing discs.
  const rig = install(W, H)
  const world: World = { asked: 0, reports: [], skips: [], haptics: [] }
  const handle = mount(rig.el, stub(world))
  try {
    pump(rig, 3)
    const p = points()
    rig.tap(p.tablet.x, p.tablet.y)
    rig.tap(p.one.x, p.one.y)
    rig.tap(p.two.x, p.two.y)
    rig.tap(p.gavel.x, p.gavel.y)
    // Far enough into the reveal that the values have faded in.
    pump(rig, 30)
    const drawn = rig.frame.filter((call) => call.startsWith("fillText("))
    assert.ok(drawn.length > 6, "the settled room drew almost nothing")
    // The verdict line is there, in words a child can read.
    assert.ok(
      drawn.some((call) => /OUTBID|SOLD|KEEN|NOBODY WILL BUY|NOTHING IN IT/.test(call)),
      `the settled room drew no verdict: ${drawn.join(" | ")}`,
    )
    // Three tablets, each with a numeral under its sum. Every value is a whole number,
    // so every one of them is a plain integer in the transcript.
    const numerals = drawn.filter((call) => /^fillText\(\d+,/.test(call))
    assert.ok(
      numerals.length >= 3,
      `only ${String(numerals.length)} rival bids were printed: ${drawn.join(" | ")}`,
    )
  } finally {
    handle.unmount()
    rig.restore()
  }
})

test("MANUAL FREEZES THE GALLERY: the same frame, over and over, until it closes", () => {
  const rig = install(W, H)
  const world: World = { asked: 0, reports: [], skips: [], haptics: [] }
  const handle = mount(rig.el, stub(world))
  try {
    pump(rig, 3)
    const p = points()
    // Settle a lot, so the reveal is running: the tablets are turning over and the coin
    // counter is walking. This is the only thing in THE GAVEL that moves on its own,
    // and it is exactly the moment a child reaches for the rules.
    rig.tap(p.tablet.x, p.tablet.y)
    rig.tap(p.one.x, p.one.y)
    rig.tap(p.two.x, p.two.y)
    rig.tap(p.gavel.x, p.gavel.y)

    pump(rig, 2)
    const moving = [...rig.frame]
    pump(rig, 1)
    assert.notDeepEqual(rig.frame, moving, "the gallery was already frozen before the manual opened")

    const open = control(rig.created, "dwc-help")
    const close = control(rig.created, "dwc-close")
    open()

    pump(rig, 1)
    const held = [...rig.frame]
    assert.ok(held.length > 100, "the frame behind the sheet drew nothing at all")
    const asked = world.asked
    const reports = world.reports.length
    for (let i = 0; i < 10_000; i++) {
      rig.step(16)
      if (i % 2000 === 0) {
        assert.deepEqual(rig.frame, held, `the gallery moved ${String(i)} frames into the read`)
      }
    }
    assert.deepEqual(rig.frame, held, "the gallery moved while the rules were up")
    assert.equal(world.asked, asked, "a question was served behind the manual")

    // …and a touch behind the scrim is not a touch. The sheet swallows pointer events
    // itself, but a game that took them anyway would drop the hammer on a room nobody
    // was looking at.
    rig.tap(p.gavel.x, p.gavel.y)
    rig.tap(p.tablet.x, p.tablet.y)
    assert.equal(world.reports.length, reports, "the hammer fell behind the manual")

    close()
    pump(rig, 2)
    assert.notDeepEqual(rig.frame, held, "the gallery never came back after the manual closed")

    // …and the settled room the child left is STILL THERE. It was a lot with
    // something to learn from, so no amount of frames takes it down: seven
    // seconds here, against a reveal whose old full-patience length was 4.2 s.
    pump(rig, 400)
    assert.equal(world.asked, asked, "the settled room expired while the manual was up")

    // It goes when the child's own hand says so, and not before.
    rig.tap(p.gavel.x, p.gavel.y)
    pump(rig, 2)
    assert.ok(world.asked > asked, "no new lot was ever called")
  } finally {
    handle.unmount()
    rig.restore()
  }
})

test("the host's own pause does the same thing, and resuming does not skip the reveal", () => {
  const rig = install(W, H)
  const world: World = { asked: 0, reports: [], skips: [], haptics: [] }
  const handle = mount(rig.el, stub(world))
  try {
    pump(rig, 3)
    const p = points()
    rig.tap(p.tablet.x, p.tablet.y)
    rig.tap(p.one.x, p.one.y)
    rig.tap(p.gavel.x, p.gavel.y)
    pump(rig, 2)

    handle.pause()
    pump(rig, 1)
    const held = [...rig.frame]
    const asked = world.asked
    pump(rig, 600)
    assert.deepEqual(rig.frame, held, "the gallery ran on behind the host's sheet")
    assert.equal(world.asked, asked)

    handle.resume()
    // The first frame back must not be ten seconds of reveal in one step: `last` is
    // forgotten across a pause, so the delta is a single frame.
    rig.step(16)
    assert.notDeepEqual(rig.frame, held)
    assert.equal(world.asked, asked, "resuming skipped straight past the settled room")
  } finally {
    handle.unmount()
    rig.restore()
  }
})

test("a room that is waiting for the child says so, and only once a tap would work", () => {
  // The settled room after a fold now has no deadline on it, and a screen that
  // is waiting with no sign that it is waiting reads as a screen that has hung.
  // The sign is a brass hairline under the gallery — `Scene.onward`, the only
  // thing in the renderer that sets a round line cap — and it arrives AFTER
  // `nudge`'s settle floor, so it is never an invitation to press something that
  // is being swallowed.
  const rig = install(W, H)
  const world: World = { asked: 0, reports: [], skips: [], haptics: [] }
  const handle = mount(rig.el, stub(world))
  const cued = (): boolean => rig.frame.includes("lineCap=round")
  try {
    pump(rig, 3)
    assert.equal(cued(), false, "the go-on mark was drawn over a live room the child is still bidding on")

    rig.tap(p_fold().x, p_fold().y)
    pump(rig, 1)
    assert.equal(cued(), false, "the go-on mark appeared inside the settle floor, where a tap does nothing")

    // Past the settle floor and far enough into the cue's own ramp to be visible.
    pump(rig, 90)
    assert.equal(cued(), true, "a room with no deadline on it never said it was waiting")

    // …and it goes with the room it belongs to.
    rig.tap(p_fold().x, p_fold().y)
    pump(rig, 2)
    assert.equal(cued(), false, "the go-on mark outlived the room it was inviting a tap on")
  } finally {
    handle.unmount()
    rig.restore()
  }
})

/** The FOLD key, from the real layout. */
function p_fold(): { x: number; y: number } {
  return points().fold
}
