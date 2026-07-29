// FROZEN BEHIND THE MANUAL.
//
// "All games should pause while reading the instructions .. I can hear
// counterweight playing in the background while I'm reading the instructions ...
// stressing me out even more."
//
// `pause.test.ts` next door proves the *rules* stop when `Game.pause` is called.
// It cannot prove that anything ever calls it, and the one surface that must —
// the game's own how-to-play sheet, which a child raises precisely when they are
// losing — is opt-in and was not wired. So this file is the wiring's gate: it
// mounts the whole shell against a headless surface, reaches the shared module's
// real help button the way a finger does, and watches the sky.
//
// **The observable is the host, not the canvas.** This game keeps DRAWING a
// frozen frame while paused, on purpose, so a count of context calls would be
// meaningless. What is unambiguously simulation is that a falling star pulls a
// ledger line from the host when it is released and buzzes the motor when it
// lands. Neither can happen if the sky is not moving.
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
import { forgetAudioContexts } from "../../../../packs/shared/game-chrome/audioHold.ts"
import { mountSkyLedger } from "../mount.ts"
import { createStubHost } from "../stubHost.ts"

type Handler = (e: unknown) => void

type FakeEl = {
  className: string
  tag?: string
  fire(type: string, event?: unknown): void
  [key: string]: unknown
}

function makeSurface(width = 768, height = 1024) {
  const created: FakeEl[] = []
  const rect = { left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0 }

  const ctx: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return undefined
        if (typeof prop === "symbol") return undefined
        return () => ctx
      },
      set: () => true,
    },
  )

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
    // The scene seeds itself from the wall clock, which is right on a tablet and
    // fatal in a test: a suite that is green four runs in five has proved
    // nothing.
    Date.now = () => 0x5eed
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

  return {
    root,
    install,
    step(ms: number): void {
      clock += ms
      const cb = pending
      pending = null
      cb?.(clock)
    },
    /** The shared module's own controls, found the way a finger finds them. */
    help: () => created.find((e) => e.className === "dwc-help"),
    closeButton: () => created.find((e) => e.className === "dwc-close"),
  }
}

type Rig = {
  surface: ReturnType<typeof makeSurface>
  handle: ReturnType<typeof mountSkyLedger>
  /** Ledger lines pulled from the host. Only a released star pulls one. */
  served: () => number
  haptics: string[]
  reports: Array<{ ms: number }>
  stop(): void
}

function rig(seed = 0x5c7ed6): Rig {
  const surface = makeSurface()
  const restore = surface.install()
  const haptics: string[] = []
  const reports: Array<{ ms: number }> = []
  let served = 0
  const stub = createStubHost({
    seed,
    reducedMotion: false,
    onHaptic: (k) => haptics.push(k),
    onReport: (r) => reports.push(r),
  })
  const host = {
    ...stub,
    next: (o?: { domain?: string; difficulty?: number }) => {
      served++
      return stub.next(o)
    },
  }
  const handle = mountSkyLedger(surface.root as unknown as HTMLElement, host)
  return {
    surface,
    handle,
    served: () => served,
    haptics,
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

test("the sky does not fall while the rules are up", () => {
  const r = rig()
  try {
    // Twenty-four seconds of watch. Stars are released, fall, and land.
    for (let i = 0; i < 1500; i++) r.surface.step(16)
    const servedBefore = r.served()
    const hapticsBefore = r.haptics.length
    assert.ok(servedBefore > 1, `the sky never released a star (${servedBefore} served)`)
    assert.ok(hapticsBefore > 0, "nothing ever landed, so there is nothing to freeze")

    openManual(r.surface)
    // Three minutes behind the sheet. A child reading the manual after a bad
    // watch should not come back to a dark observatory.
    for (let i = 0; i < 11_250; i++) r.surface.step(16)
    assert.equal(r.served(), servedBefore, "the sky pulled a ledger line behind the manual")
    assert.equal(r.haptics.length, hapticsBefore, "a star landed behind the manual")

    closeManual(r.surface)
    // And it does not teleport. The frame after the sheet is one frame, not
    // three minutes: a burst of releases here would mean the sky dumped a whole
    // read's worth of stars into the ground at once.
    r.surface.step(16)
    assert.ok(
      r.served() - servedBefore <= 1,
      `${r.served() - servedBefore} ledger lines were pulled in the first frame after the sheet`,
    )

    for (let i = 0; i < 1800; i++) r.surface.step(16)
    assert.ok(r.served() > servedBefore, "the sky never started falling again")
    assert.ok(r.haptics.length > hapticsBefore, "the watch did not come back")
  } finally {
    r.stop()
  }
})

test("a watch the HOST already stopped is not restarted by closing the rules", () => {
  // The host puts a sheet over a still-mounted pack — a stopping-point card, a
  // parent gate, a day-pass offer — and this game raises one itself at the end
  // of every watch. If the child then opens the manual on top of it and closes
  // it, the observatory must not start running underneath the host's sheet.
  const r = rig(0x40b)
  try {
    for (let i = 0; i < 1500; i++) r.surface.step(16)
    assert.ok(r.served() > 1)

    r.handle.pause()
    const servedBefore = r.served()
    const hapticsBefore = r.haptics.length

    openManual(r.surface)
    for (let i = 0; i < 1200; i++) r.surface.step(16)
    closeManual(r.surface)
    for (let i = 0; i < 6000; i++) r.surface.step(16)

    assert.equal(r.served(), servedBefore, "closing the manual lifted the host's own pause")
    assert.equal(r.haptics.length, hapticsBefore, "a star fell out from under the host's sheet")

    // The host's pause is still the host's to lift, and lifting it works.
    r.handle.resume()
    for (let i = 0; i < 1800; i++) r.surface.step(16)
    assert.ok(r.served() > servedBefore, "the host could not restart its own watch")
  } finally {
    r.stop()
  }
})

test("the host lifting its own sheet does not start the sky behind the manual", () => {
  // The other order, and the one that reintroduces the whole defect: the host
  // pauses, the child opens the rules, and then the host takes ITS sheet down
  // while the manual is still up. The sky must wait for the rules.
  const r = rig(0x7e57)
  try {
    for (let i = 0; i < 1500; i++) r.surface.step(16)
    assert.ok(r.served() > 1)

    r.handle.pause()
    openManual(r.surface)
    const servedBefore = r.served()
    const hapticsBefore = r.haptics.length

    r.handle.resume()
    for (let i = 0; i < 6000; i++) r.surface.step(16)
    assert.equal(r.served(), servedBefore, "the sky fell behind the manual")
    assert.equal(r.haptics.length, hapticsBefore, "a star landed behind the manual")

    // And closing the rules is what hands it back, because by then the manual
    // is the only thing still holding it.
    closeManual(r.surface)
    for (let i = 0; i < 1800; i++) r.surface.step(16)
    assert.ok(r.served() > servedBefore, "the watch never came back when the rules went down")
  } finally {
    r.stop()
  }
})

test("opening and closing the rules repeatedly is not a stack of pauses", () => {
  const r = rig(0x1de)
  try {
    for (let i = 0; i < 1200; i++) r.surface.step(16)
    for (let i = 0; i < 6; i++) {
      openManual(r.surface)
      for (let n = 0; n < 30; n++) r.surface.step(16)
      closeManual(r.surface)
      for (let n = 0; n < 30; n++) r.surface.step(16)
    }
    const servedBefore = r.served()
    for (let i = 0; i < 1800; i++) r.surface.step(16)
    assert.ok(r.served() > servedBefore, "the watch never came back after six reads")
    // Nothing was billed to the child for the reading.
    for (const report of r.reports) {
      assert.ok(report.ms < 60_000, `a report carried ${report.ms}ms — the sheet leaked into it`)
    }
  } finally {
    r.stop()
  }
})
