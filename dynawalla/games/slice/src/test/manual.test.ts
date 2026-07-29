// The market stops while the rules are up.
//
// "I can hear counterweight playing in the background while I'm reading the
// instructions ... stressing me out even more." THE SPLIT had the same defect
// and worse than most: the answering window IS the lanterns' fall, so a child
// who opened the manual *because they were stuck* watched the question they were
// stuck on expire behind the scrim, and a bomb could take a lamp while they read
// about bombs.
//
// `wiring.test.ts` reads `mount.ts` as text and says so; this file does not. It
// mounts the real game against a fake surface, drives the real frame loop on a
// virtual clock, reaches the shared how-to-play sheet through its OWN help
// button — the same click a child makes — and watches whether the world moved.
//
// Three independent observables, because one is a flag and a flag can lie:
//
//   1. `draws`  — every call into the 2D context. Zero while frozen.
//   2. `elapsed` — the director's own clock, which is what decides when the next
//      gourd is thrown. This is simulation, not rendering.
//   3. the bodies' positions, straight out of the debug surface.

import assert from "node:assert/strict"
import { test } from "node:test"

import { mount } from "../contract.ts"
import { createStubHost } from "../stubHost.ts"

type Handler = (e: unknown) => void
type Report = { questionId: string; correct: boolean; ms: number; answered: string }
type Target = { x: number; y: number; r: number; kind: number; text: string; correct: boolean }
type Dbg = {
  stats(): Record<string, number | string>
  targets(): Target[]
}

const B_SIGIL = 1
const B_MOTE = 2

/**
 * A surface with no pixels, but one that counts.
 *
 * Every element gets its OWN listener map. A single map keyed by event type is
 * the trap here: the shared sheet's help button and its PLAY button both
 * register a `"click"`, so a shared map would leave the second overwriting the
 * first and a test that "opened the manual" would in fact be closing it.
 */
function surface(width: number, height: number, cores = 12) {
  const rect = { left: 0, top: 0, width, height, right: width, bottom: height, x: 0, y: 0 }
  const made: FakeEl[] = []
  const globals = new Map<string, Handler[]>()
  let draws = 0

  const ctx = new Proxy(function () {} as unknown as Record<string, unknown>, {
    get: (_t, prop) => {
      if (prop === "then") return undefined
      // `measureText().width` must be a NUMBER. Through a bare proxy it is a
      // proxy, every glyph atlas is sized `NaN × NaN`, every body lands at NaN
      // and "the world did not move" becomes unfalsifiable — NaN never equals
      // itself, so the assertion could not fail even if the game ran.
      if (prop === "measureText") {
        return (t: string) => {
          draws++
          return { width: String(t).length * 42, actualBoundingBoxAscent: 40, actualBoundingBoxDescent: 12 }
        }
      }
      return ctx
    },
    set: () => true,
    apply: () => {
      draws++
      return ctx
    },
  }) as unknown as CanvasRenderingContext2D

  type FakeEl = {
    className: string
    listeners: Map<string, Handler[]>
    fire(type: string, e?: unknown): void
    [k: string]: unknown
  }

  const makeEl = (): FakeEl => {
    const listeners = new Map<string, Handler[]>()
    const el: FakeEl = {
      style: {} as Record<string, string>,
      width: 0,
      height: 0,
      id: "",
      type: "",
      className: "",
      textContent: "",
      tabIndex: 0,
      hidden: false,
      scrollTop: 0,
      offsetHeight: height,
      clientWidth: width,
      clientHeight: height,
      listeners,
      appendChild: () => undefined,
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
      addEventListener: (k: string, h: Handler) => {
        const list = listeners.get(k) ?? []
        list.push(h)
        listeners.set(k, list)
      },
      removeEventListener: (k: string, h: Handler) => {
        const list = listeners.get(k) ?? []
        const at = list.indexOf(h)
        if (at >= 0) list.splice(at, 1)
      },
      fire: (k: string, e?: unknown) => {
        for (const h of [...(listeners.get(k) ?? [])]) h(e ?? {})
      },
    }
    made.push(el)
    return el
  }

  let pending: ((t: number) => void) | null = null
  let clock = 1000

  const saved = {
    raf: globalThis.requestAnimationFrame,
    caf: globalThis.cancelAnimationFrame,
    ro: (globalThis as { ResizeObserver?: unknown }).ResizeObserver,
    now: performance.now,
    add: globalThis.addEventListener,
    remove: globalThis.removeEventListener,
    dpr: (globalThis as { devicePixelRatio?: number }).devicePixelRatio,
    doc: (globalThis as { document?: unknown }).document,
    loc: (globalThis as { location?: unknown }).location,
    ls: (globalThis as { localStorage?: unknown }).localStorage,
    dateNow: Date.now,
    nav: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
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
    Date.now = () => 0x51ce51ce
    Object.defineProperty(globalThis, "navigator", {
      value: { hardwareConcurrency: cores },
      configurable: true,
      writable: true,
    })
    ;(globalThis as { devicePixelRatio?: number }).devicePixelRatio = 2
    // `?debug` is what publishes `globalThis.__slice`, and that surface is how
    // this file sees the simulation at all.
    ;(globalThis as { location?: unknown }).location = { search: "?debug" }
    const store = new Map<string, string>()
    ;(globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    }
    globalThis.addEventListener = ((k: string, h: Handler): void => {
      const list = globals.get(k) ?? []
      list.push(h)
      globals.set(k, list)
    }) as unknown as typeof globalThis.addEventListener
    globalThis.removeEventListener = ((k: string, h: Handler): void => {
      const list = globals.get(k) ?? []
      const at = list.indexOf(h)
      if (at >= 0) list.splice(at, 1)
    }) as unknown as typeof globalThis.removeEventListener
    const body = makeEl()
    ;(globalThis as { document?: unknown }).document = {
      createElement: () => makeEl(),
      getElementById: () => null,
      body,
      hidden: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }
    return () => {
      globalThis.requestAnimationFrame = saved.raf
      globalThis.cancelAnimationFrame = saved.caf
      ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = saved.ro
      performance.now = saved.now
      Date.now = saved.dateNow
      ;(globalThis as { devicePixelRatio?: number }).devicePixelRatio = saved.dpr
      globalThis.addEventListener = saved.add
      globalThis.removeEventListener = saved.remove
      ;(globalThis as { document?: unknown }).document = saved.doc
      ;(globalThis as { location?: unknown }).location = saved.loc
      ;(globalThis as { localStorage?: unknown }).localStorage = saved.ls
      if (saved.nav) Object.defineProperty(globalThis, "navigator", saved.nav)
      delete (globalThis as { __slice?: unknown }).__slice
    }
  }

  return {
    el: makeEl(),
    install,
    made,
    globals,
    drawsSoFar: () => draws,
    now: () => clock,
    step: (ms: number): void => {
      clock += ms
      const cb = pending
      pending = null
      cb?.(clock)
    },
  }
}

type Surface = ReturnType<typeof surface>

/** The shared sheet's own controls, found the way a finger finds them. */
function control(s: Surface, cls: string): { fire(type: string, e?: unknown): void } {
  const el = s.made.find((e) => e.className === cls)
  assert.ok(el, `no ${cls} in the mounted tree — the shared sheet did not mount`)
  return el as unknown as { fire(type: string, e?: unknown): void }
}

const openManual = (s: Surface): void => control(s, "dwc-help").fire("click")
const closeManual = (s: Surface): void => control(s, "dwc-close").fire("click")

function dbg(): Dbg {
  const d = (globalThis as { __slice?: Dbg }).__slice
  assert.ok(d, "the debug surface is missing — mount did not see ?debug")
  return d
}

/** Everything this file calls "the world". */
function snapshot(s: Surface): string {
  const st = dbg().stats()
  return JSON.stringify({
    draws: s.drawsSoFar(),
    elapsed: st.elapsed,
    bodies: st.bodies,
    heat: st.heat,
    score: st.score,
    lamps: st.lamps,
    particles: st.particles,
    chunks: st.chunks,
    targets: dbg()
      .targets()
      .map((t) => [t.x, t.y, t.kind, t.text]),
  })
}

function begin(opts: { seed?: number; onReport?: (r: Report) => void } = {}) {
  const s = surface(768, 1024)
  const restore = s.install()
  const nexts: number[] = []
  const base = createStubHost({ seed: opts.seed ?? 0x51ce, reducedMotion: false, onReport: opts.onReport })
  const host = {
    ...base,
    next: (o?: { domain?: string; difficulty?: number }) => {
      nexts.push(1)
      return base.next(o)
    },
  }
  const handle = mount(s.el as unknown as HTMLElement, host)
  return { s, handle, restore, nextCount: () => nexts.length }
}

/** A swipe straight through a point, fast enough to be a cut and not a drag. */
function swipe(s: Surface, x: number, y: number): void {
  const canvas = s.made.find((e) => e.listeners.has("pointerdown"))
  assert.ok(canvas, "the canvas never bound a pointerdown")
  const t = s.now()
  const ev = (cx: number, cy: number, ts: number) => ({
    pointerId: 1,
    button: 0,
    clientX: cx,
    clientY: cy,
    timeStamp: ts,
    preventDefault: () => undefined,
  })
  canvas.fire("pointerdown", ev(x - 120, y, t))
  canvas.fire("pointermove", ev(x - 40, y, t + 8))
  canvas.fire("pointermove", ev(x + 40, y, t + 16))
  canvas.fire("pointermove", ev(x + 120, y, t + 24))
  canvas.fire("pointerup", ev(x + 120, y, t + 24))
}

test("THE MARKET STOPS: nothing advances while the manual is up", () => {
  const { s, handle, restore } = begin({ seed: 0xf00d })
  try {
    for (let i = 0; i < 900; i++) s.step(16)
    const before = snapshot(s)
    assert.ok(dbg().targets().length > 0, "nothing was in the air before the manual opened")

    openManual(s)
    // Three minutes of a child reading, at sixty frames a second.
    for (let i = 0; i < 11_250; i++) s.step(16)
    assert.equal(snapshot(s), before, "the market kept running behind the manual")

    closeManual(s)
    for (let i = 0; i < 240; i++) s.step(16)
    assert.notEqual(snapshot(s), before, "the market never came back after the manual closed")
  } finally {
    handle.unmount()
    restore()
  }
})

test("the manual does not serve the child a question they never saw", () => {
  const { s, handle, restore, nextCount } = begin({ seed: 0xbeef })
  try {
    for (let i = 0; i < 900; i++) s.step(16)
    const before = nextCount()
    openManual(s)
    for (let i = 0; i < 11_250; i++) s.step(16)
    assert.equal(nextCount(), before, "the director drew questions from the host behind the sheet")
  } finally {
    handle.unmount()
    restore()
  }
})

test("closing the manual does not hand the loop one enormous frame", () => {
  // `last` has to keep tracking the real clock across the read, or the first
  // frame back is `now − last` — three minutes of gravity in a single step. The
  // loop's 64ms clamp catches the worst of it, which is exactly why this needs
  // asserting rather than eyeballing: the bug survives the clamp as a visible
  // four-frame lurch of everything in the air, not as a crash.
  //
  // Measured as how far the gourds actually moved, because the director's clock
  // is only published to a tenth of a second and a frame is well under that.
  const key = (t: Target): string => `${t.kind}:${t.text}:${t.r.toFixed(4)}`
  const travel = (): number => {
    const before = new Map(dbg().targets().map((t) => [key(t), t]))
    s.step(16)
    let most = 0
    for (const t of dbg().targets()) {
      const was = before.get(key(t))
      if (!was) continue
      most = Math.max(most, Math.hypot(t.x - was.x, t.y - was.y))
    }
    return most
  }

  const { s, handle, restore } = begin({ seed: 0xc0ffee })
  try {
    for (let i = 0; i < 900; i++) s.step(16)
    const ordinary = travel()
    assert.ok(ordinary > 0, "nothing was moving before the manual opened, so this measures nothing")

    openManual(s)
    for (let i = 0; i < 11_250; i++) s.step(16)
    closeManual(s)

    const firstBack = travel()
    assert.ok(
      firstBack <= ordinary * 1.6,
      `the first frame back moved the market ${firstBack.toFixed(1)}px against an ordinary ${ordinary.toFixed(1)}px`,
    )
  } finally {
    handle.unmount()
    restore()
  }
})

test("THE READ IS NOT BILLED: a question survives the manual, and costs nothing", () => {
  // The wall-clock half of the fix. `liveQAt` is a `performance.now()` mark and
  // the answering window is a countdown; a manual left up for three minutes must
  // not expire the question, and the latency handed to the curriculum must be
  // the child's thinking, not their reading.
  const reports: Report[] = []
  const { s, handle, restore } = begin({ seed: 0x5161, onReport: (r) => reports.push(r) })
  try {
    let sliced = false
    for (let i = 0; i < 4000 && !sliced; i++) {
      s.step(16)
      const sigil = dbg()
        .targets()
        .find((t) => t.kind === B_SIGIL)
      if (sigil) {
        swipe(s, sigil.x, sigil.y)
        s.step(16)
        sliced = dbg().targets().some((t) => t.kind === B_MOTE)
      }
    }
    assert.ok(sliced, "never managed to open a sigil, so this test proved nothing")

    // Let the read-lock lapse so the candidates are cuttable.
    for (let i = 0; i < 60; i++) s.step(16)
    const liveBefore = String(dbg().stats().liveQ)
    assert.ok(liveBefore.length > 0, "no question was live after the sigil opened")
    const motesBefore = dbg().targets().filter((t) => t.kind === B_MOTE).length

    openManual(s)
    for (let i = 0; i < 11_250; i++) s.step(16)
    closeManual(s)

    assert.equal(String(dbg().stats().liveQ), liveBefore, "the question expired behind the manual")
    assert.equal(
      dbg().targets().filter((t) => t.kind === B_MOTE).length,
      motesBefore,
      "candidates went away while the child was reading",
    )

    const mote = dbg()
      .targets()
      .find((t) => t.kind === B_MOTE)
    assert.ok(mote, "the candidates vanished across the pause")
    const n = reports.length
    swipe(s, mote.x, mote.y)
    s.step(16)
    assert.equal(reports.length, n + 1, "cutting a candidate after the manual reported nothing")
    const r = reports[reports.length - 1] as Report
    assert.ok(
      r.ms < 60_000,
      `the read was billed to the child: ${r.ms}ms of "thinking" for a question answered at once`,
    )
  } finally {
    handle.unmount()
    restore()
  }
})

test("the read-lock survives the manual — a candidate is not cuttable on the way back", () => {
  // `cuttableAt` is the other wall-clock mark, and it is the one the manual
  // says out loud: "You cannot cut them straight away. You get a moment to read
  // them first." Unshifted, three minutes of reading burns the lock, and the
  // stroke a child makes as they close the sheet answers a question they have
  // not looked at yet.
  const reports: Report[] = []
  const { s, handle, restore } = begin({ seed: 0x5161, onReport: (r) => reports.push(r) })
  try {
    let motes: Target[] = []
    for (let i = 0; i < 4000 && motes.length === 0; i++) {
      s.step(16)
      const sigil = dbg()
        .targets()
        .find((t) => t.kind === B_SIGIL)
      if (sigil) {
        swipe(s, sigil.x, sigil.y)
        s.step(16)
        motes = dbg().targets().filter((t) => t.kind === B_MOTE)
      }
    }
    assert.ok(motes.length > 0, "never managed to open a sigil, so this test proved nothing")

    // Straight into the manual, inside the 420ms lock.
    openManual(s)
    for (let i = 0; i < 11_250; i++) s.step(16)
    closeManual(s)

    const n = reports.length
    const mote = dbg()
      .targets()
      .find((t) => t.kind === B_MOTE)
    assert.ok(mote, "the candidates vanished across the pause")
    swipe(s, mote.x, mote.y)
    s.step(16)
    assert.equal(reports.length, n, "the read-lock was spent on the manual — the first stroke back answered")

    // And the lock does still lapse, on the game's own time.
    for (let i = 0; i < 60; i++) s.step(16)
    const m2 = dbg()
      .targets()
      .find((t) => t.kind === B_MOTE)
    assert.ok(m2, "the candidates fell away before the lock lapsed")
    swipe(s, m2.x, m2.y)
    s.step(16)
    assert.equal(reports.length, n + 1, "the lock never lapsed — the candidates are permanently uncuttable")
  } finally {
    handle.unmount()
    restore()
  }
})

test("the manual only lifts a pause it put on itself", () => {
  // The host puts a sheet over a still-mounted pack — a purchase surface, a
  // parent gate — and the child, behind it, closes the how-to-play they had
  // open. The game must stay stopped: the host is still holding it.
  const { s, handle, restore } = begin({ seed: 0x9001 })
  try {
    for (let i = 0; i < 600; i++) s.step(16)
    handle.setPaused(true)
    const held = snapshot(s)

    openManual(s)
    for (let i = 0; i < 600; i++) s.step(16)
    closeManual(s)
    for (let i = 0; i < 1200; i++) s.step(16)
    assert.equal(snapshot(s), held, "closing the rules handed the game back while the host held it")

    handle.setPaused(false)
    for (let i = 0; i < 240; i++) s.step(16)
    assert.notEqual(snapshot(s), held, "the host could not get its own game back")
  } finally {
    handle.unmount()
    restore()
  }
})

test("pausing twice is one pause, and resuming a running game is nothing", () => {
  const { s, handle, restore } = begin({ seed: 0x1d3a })
  try {
    handle.setPaused(false)
    for (let i = 0; i < 600; i++) s.step(16)
    handle.setPaused(true)
    handle.setPaused(true)
    const held = snapshot(s)
    for (let i = 0; i < 3000; i++) s.step(16)
    assert.equal(snapshot(s), held, "a doubled pause let the market through")
    handle.setPaused(false)
    handle.setPaused(false)
    for (let i = 0; i < 240; i++) s.step(16)
    assert.notEqual(snapshot(s), held, "a doubled resume left the market stopped")
  } finally {
    handle.unmount()
    restore()
  }
})

test("the manual can be opened and closed all run without the game drifting", () => {
  const { s, handle, restore } = begin({ seed: 0x2b2b })
  try {
    for (let i = 0; i < 40; i++) {
      for (let k = 0; k < 30; k++) s.step(16)
      openManual(s)
      for (let k = 0; k < 30; k++) s.step(16)
      closeManual(s)
    }
    const st = dbg().stats()
    assert.ok(Number(st.elapsed) > 0, "forty opens and closes left the game never having run")
    assert.ok(Number(st.lamps) >= 0)
  } finally {
    handle.unmount()
    restore()
  }
})
