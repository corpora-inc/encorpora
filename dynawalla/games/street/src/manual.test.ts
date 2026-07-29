// FROZEN BEHIND THE MANUAL.
//
// "All games should pause while reading the instructions .. I can hear
// counterweight playing in the background while I'm reading the instructions ...
// stressing me out even more."
//
// `game/street.test.ts` next door proves the machine stops when `Street.pause`
// is called. It cannot prove that anything ever calls it, and the surface that
// must — the game's own how-to-play sheet, which a child raises exactly when the
// street is beating them — is opt-in and was not wired. So this file is the
// wiring's gate: it mounts the whole shell against a headless surface and
// reaches the shared module's real help button the way a finger does.
//
// **Two observables, because one is not enough.** The street keeps DRAWING
// while it is paused, so a count of context calls proves nothing. What proves
// something is what is drawn: this scene is a pure function of the frame it is
// handed, with no clock and no randomness of its own, so every drawing call and
// every argument is recorded and the whole frame compared. A world that did not
// move draws the identical picture, to the argument. Alongside it the host's own
// record: the latency reported for a plate is measured on the machine's clock,
// and three minutes of reading must not appear on a child's record as three
// minutes of thinking.
//
// The fake elements below carry a listener map EACH, which is not tidiness: the
// help button and the PLAY button both register a `"click"`, so one shared map
// keyed by type silently drops the first and this test opens nothing.

import assert from "node:assert/strict"
import { test } from "node:test"

// From `audioHold.ts` directly, not the barrel: `index.ts` deliberately does
// NOT re-export this, because a game that reached for it would defeat the hold
// for the whole pack. Node 24 enforces that; Node 22 does not, which is how the
// wrong import passed locally and failed in CI.
import { forgetAudioContexts } from "../../../packs/shared/game-chrome/audioHold.ts"
import { mountStreet } from "./mount.ts"
import { fakeCanvas } from "./render/fakeCanvas.ts"
import { createStubHost } from "./stubHost.ts"

type Handler = (e: unknown) => void

type FakeEl = {
  className: string
  tag?: string
  fire(type: string, event?: unknown): void
  [key: string]: unknown
}

const WIDTH = 768
const HEIGHT = 1024

function makeSurface() {
  const created: FakeEl[] = []
  const rect = {
    left: 0,
    top: 0,
    right: WIDTH,
    bottom: HEIGHT,
    width: WIDTH,
    height: HEIGHT,
    x: 0,
    y: 0,
  }

  // The recording context this package already has, the one `scene.test.ts`
  // gates the renderer with. It keeps the receipt: every call, its arguments,
  // the alpha and the style in force. That is what turns "the picture did not
  // change" into an assertion instead of an impression.
  const { canvas: recordingCanvas, rec } = fakeCanvas(WIDTH, HEIGHT)
  const ctx = (recordingCanvas as { getContext(): unknown }).getContext()
  const show = (v: unknown): string =>
    typeof v === "number" && Number.isFinite(v) ? v.toFixed(4) : String(v)
  const picture = (): string =>
    rec.ops.map((op) => `${op.name}(${op.args.map(show).join(",")})@${op.alpha}/${op.style}`).join("|")

  const makeEl = (): FakeEl => {
    const listeners = new Map<string, Handler[]>()
    const el = {
      style: {} as Record<string, unknown>,
      width: 0,
      height: 0,
      id: "",
      type: "",
      className: "",
      textContent: "",
      tabIndex: 0,
      hidden: false,
      scrollTop: 0,
      offsetHeight: 400,
      appendChild: (c: unknown) => c,
      append: () => undefined,
      remove: () => undefined,
      focus: () => undefined,
      setAttribute: () => undefined,
      getAttribute: () => null,
      removeAttribute: () => undefined,
      getBoundingClientRect: () => rect,
      getContext: () => ctx,
      setPointerCapture: () => undefined,
      releasePointerCapture: () => undefined,
      hasPointerCapture: () => false,
      addEventListener(type: string, h: Handler) {
        const list = listeners.get(type) ?? []
        list.push(h)
        listeners.set(type, list)
      },
      removeEventListener(type: string, h: Handler) {
        const list = listeners.get(type) ?? []
        const at = list.indexOf(h)
        if (at >= 0) list.splice(at, 1)
      },
      fire(type: string, event: unknown = {}) {
        for (const h of [...(listeners.get(type) ?? [])]) h(event)
      },
    } as unknown as FakeEl
    created.push(el)
    return el
  }

  const root = makeEl()
  const globalKeys = new Map<string, Handler[]>()
  let pending: ((t: number) => void) | null = null
  let clock = 0

  const saved = {
    raf: globalThis.requestAnimationFrame,
    caf: globalThis.cancelAnimationFrame,
    ro: (globalThis as { ResizeObserver?: unknown }).ResizeObserver,
    now: performance.now,
    dateNow: Date.now,
    add: globalThis.addEventListener,
    remove: globalThis.removeEventListener,
    doc: (globalThis as { document?: unknown }).document,
    dpr: (globalThis as { devicePixelRatio?: number }).devicePixelRatio,
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
    // The wave order is seeded from the wall clock, which is right on a tablet
    // and fatal in a test: a suite that is green four runs in five has proved
    // nothing.
    Date.now = () => 0x57ee7
    globalThis.addEventListener = ((type: string, h: Handler): void => {
      const list = globalKeys.get(type) ?? []
      list.push(h)
      globalKeys.set(type, list)
    }) as unknown as typeof globalThis.addEventListener
    globalThis.removeEventListener = ((type: string, h: Handler): void => {
      const list = globalKeys.get(type) ?? []
      const at = list.indexOf(h)
      if (at >= 0) list.splice(at, 1)
    }) as unknown as typeof globalThis.removeEventListener
    ;(globalThis as { document?: unknown }).document = {
      createElement: (tag: string) => {
        const el = makeEl()
        el.tag = tag
        return el
      },
      getElementById: () => null,
      body: makeEl(),
      activeElement: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }
    ;(globalThis as { devicePixelRatio?: number }).devicePixelRatio = 2
    return () => {
      globalThis.requestAnimationFrame = saved.raf
      globalThis.cancelAnimationFrame = saved.caf
      ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = saved.ro
      performance.now = saved.now
      Date.now = saved.dateNow
      globalThis.addEventListener = saved.add
      globalThis.removeEventListener = saved.remove
      ;(globalThis as { document?: unknown }).document = saved.doc
      ;(globalThis as { devicePixelRatio?: number }).devicePixelRatio = saved.dpr
      forgetAudioContexts()
    }
  }

  const step = (ms: number): void => {
    clock += ms
    const cb = pending
    pending = null
    cb?.(clock)
  }

  return {
    root,
    install,
    step,
    /** Step one frame and hand back everything the street drew in it. */
    frame(ms = 16): string {
      rec.reset()
      step(ms)
      return picture()
    },
    canvas: () => created.find((e) => e.tag === "canvas"),
    /** The shared module's own controls, found the way a finger finds them. */
    help: () => created.find((e) => e.className === "dwc-help"),
    closeButton: () => created.find((e) => e.className === "dwc-close"),
  }
}

type Report = { questionId: string; correct: boolean; ms: number; answered: string }

function rig(seed = 0x57ee7): {
  surface: ReturnType<typeof makeSurface>
  handle: ReturnType<typeof mountStreet>
  reports: Report[]
  stop(): void
} {
  const surface = makeSurface()
  const restore = surface.install()
  const reports: Report[] = []
  const host = createStubHost({ seed, reducedMotion: false, onReport: (r) => reports.push(r) })
  const handle = mountStreet(surface.root as unknown as HTMLElement, host)
  return {
    surface,
    handle,
    reports,
    stop(): void {
      handle.unmount()
      restore()
    },
  }
}

function openManual(surface: ReturnType<typeof makeSurface>): void {
  const help = surface.help()
  assert.ok(help, "the shared how-to-play button was never mounted")
  help.fire("click", { target: help, type: "click" })
}

function closeManual(surface: ReturnType<typeof makeSurface>): void {
  const button = surface.closeButton()
  assert.ok(button, "the sheet has no PLAY button")
  button.fire("click", { target: button, type: "click" })
}

/**
 * Hit a rivet, without knowing where the rivets are.
 *
 * The layout is the scene's business and reproducing it here would be a second
 * copy of it that could drift. A child's finger does not know either; it lands
 * somewhere on the plate. So this walks the glass until something is struck.
 */
function tapAnyRivet(
  surface: ReturnType<typeof makeSurface>,
  reports: Report[],
): Report | undefined {
  const canvas = surface.canvas()
  assert.ok(canvas, "the game mounted no canvas")
  const before = reports.length
  for (let y = 8; y < HEIGHT; y += 16) {
    for (let x = 8; x < WIDTH; x += 16) {
      canvas.fire("pointerdown", {
        pointerId: 1,
        button: 0,
        clientX: x,
        clientY: y,
        preventDefault: () => undefined,
      })
      if (reports.length > before) return reports[reports.length - 1]
    }
  }
  return undefined
}

test("the street does not move while the rules are up", () => {
  const r = rig()
  try {
    // Five frames in, the shutter is on its way down: a phase driven by the
    // clock, so the picture changes every frame.
    const moving = new Set<string>()
    for (let i = 0; i < 5; i++) moving.add(r.surface.frame())
    assert.equal(moving.size, 5, "the street was not moving to begin with")

    openManual(r.surface)
    const held = r.surface.frame()
    // Three minutes behind the sheet, sampled throughout. Every frame draws the
    // identical picture, to the argument, because nothing underneath it moved.
    for (let i = 0; i < 11_250; i++) {
      if (i % 250 === 0) {
        assert.equal(r.surface.frame(), held, `the street moved behind the manual (frame ${i})`)
      } else {
        r.surface.step(16)
      }
    }

    closeManual(r.surface)
    const after = new Set<string>()
    for (let i = 0; i < 5; i++) after.add(r.surface.frame())
    assert.equal(after.size, 5, "the shutter never came down again")
    assert.ok(!after.has(held), "the street resumed on the same frame it froze on")

    // And the sheet is not on the child's record. The latency for a plate is
    // measured on the machine's own clock; three minutes of reading behind the
    // scrim would be reported as three minutes of thinking.
    for (let i = 0; i < 60; i++) r.surface.step(16)
    const report = tapAnyRivet(r.surface, r.reports)
    assert.ok(report, "no rivet could be struck after the sheet lifted")
    assert.ok(
      report.ms < 5_000,
      `the plate was reported at ${report.ms}ms — the manual was billed to the child`,
    )
  } finally {
    r.stop()
  }
})

test("a street the HOST already stopped is not restarted by closing the rules", () => {
  // The host puts a sheet over a still-mounted pack — this game asks for one
  // itself on every finished block — and sends `pause`. A child who opens the
  // manual on top of that and closes it must not set the street running
  // underneath the host's own scrim.
  const r = rig(0x40b)
  try {
    for (let i = 0; i < 3; i++) r.surface.frame()

    r.handle.pause()
    const held = r.surface.frame()

    openManual(r.surface)
    for (let i = 0; i < 600; i++) r.surface.step(16)
    closeManual(r.surface)
    for (let i = 0; i < 600; i++) {
      if (i % 100 === 0) {
        assert.equal(r.surface.frame(), held, "closing the manual lifted the host's own pause")
      } else {
        r.surface.step(16)
      }
    }

    // The host's pause is still the host's to lift, and lifting it works.
    r.handle.resume()
    const after = new Set<string>()
    for (let i = 0; i < 5; i++) after.add(r.surface.frame())
    assert.equal(after.size, 5, "the host could not restart its own street")
  } finally {
    r.stop()
  }
})

test("the host lifting its own sheet does not start the street behind the manual", () => {
  // The other order, and the one that reintroduces the whole defect: the host
  // pauses, the child opens the rules, and then the host takes ITS sheet down
  // while the manual is still up. The street must wait for the rules.
  const r = rig(0x7e57)
  try {
    for (let i = 0; i < 3; i++) r.surface.frame()
    r.handle.pause()
    openManual(r.surface)
    const held = r.surface.frame()

    r.handle.resume()
    for (let i = 0; i < 600; i++) {
      if (i % 100 === 0) {
        assert.equal(r.surface.frame(), held, "the street ran behind the manual")
      } else {
        r.surface.step(16)
      }
    }

    // And closing the rules is what hands it back, because by then the manual
    // is the only thing still holding it.
    closeManual(r.surface)
    const after = new Set<string>()
    for (let i = 0; i < 5; i++) after.add(r.surface.frame())
    assert.equal(after.size, 5, "the street never came back when the rules went down")
  } finally {
    r.stop()
  }
})

test("six reads cost the street nothing at all", () => {
  // The sharpest form of the claim: a child who opens the rules six times and
  // a child who never opens them are looking at the same street, to the
  // argument, once you take the reading out. Same seed, same frames played.
  const play = (reads: boolean): string => {
    const r = rig(0x1de)
    try {
      for (let i = 0; i < 6; i++) {
        if (reads) openManual(r.surface)
        // Behind the sheet. These frames must buy the street nothing.
        for (let n = 0; n < 3; n++) r.surface.step(16)
        if (reads) closeManual(r.surface)
        for (let n = 0; n < 3; n++) r.surface.step(16)
      }
      return r.surface.frame()
    } finally {
      r.stop()
    }
  }
  // The control plays only the frames the reader had the sheet down for.
  const straight = (): string => {
    const r = rig(0x1de)
    try {
      for (let n = 0; n < 18; n++) r.surface.step(16)
      return r.surface.frame()
    } finally {
      r.stop()
    }
  }
  assert.equal(play(true), straight(), "the reading was billed to the street")
  // And the control is not a frozen street either, or the equality above would
  // be two still pictures agreeing about nothing.
  assert.notEqual(play(false), straight(), "the street was not moving in either run")
})
