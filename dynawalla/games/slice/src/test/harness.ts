// The harness every behavioural test in this pack mounts the real game through.
//
// Extracted verbatim from `manual.test.ts`, which grew it: a surface with no
// pixels but one that counts, a virtual clock, the shared how-to-play sheet
// reachable through its OWN help button, and a swipe that is a cut rather than a
// drag. `marinate.test.ts` needs every one of those to say anything at all about
// a completed sum, and a second copy of two hundred lines of fake DOM is how two
// files come to disagree about what "the world did not move" means.
//
// `wiring.test.ts` reads `mount.ts` as text and says so; nothing here does.

import assert from "node:assert/strict"

import { mount } from "../contract.ts"
import { createStubHost } from "../stubHost.ts"

export type Handler = (e: unknown) => void
export type Report = { questionId: string; correct: boolean; ms: number; answered: string }
export type Target = {
  x: number
  y: number
  r: number
  kind: number
  text: string
  correct: boolean
  value: number
}
export type Dbg = {
  stats(): Record<string, number | string>
  targets(): Target[]
  setIntensity(v: number): void
}

export const B_GOURD = 0
export const B_MELON = 1
export const B_MOTE = 2
export const B_BOMB = 3

/**
 * A surface with no pixels, but one that counts.
 *
 * Every element gets its OWN listener map. A single map keyed by event type is
 * the trap here: the shared sheet's help button and its PLAY button both
 * register a `"click"`, so a shared map would leave the second overwriting the
 * first and a test that "opened the manual" would in fact be closing it.
 */
export function surface(width: number, height: number, cores = 12) {
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

export type Surface = ReturnType<typeof surface>

/** The shared sheet's own controls, found the way a finger finds them. */
export function control(s: Surface, cls: string): { fire(type: string, e?: unknown): void } {
  const el = s.made.find((e) => e.className === cls)
  assert.ok(el, `no ${cls} in the mounted tree — the shared sheet did not mount`)
  return el as unknown as { fire(type: string, e?: unknown): void }
}

export const openManual = (s: Surface): void => control(s, "dwc-help").fire("click")
export const closeManual = (s: Surface): void => control(s, "dwc-close").fire("click")

export function dbg(): Dbg {
  const d = (globalThis as { __slice?: Dbg }).__slice
  assert.ok(d, "the debug surface is missing — mount did not see ?debug")
  return d
}

/** Everything this file calls "the world". */
export function snapshot(s: Surface): string {
  const st = dbg().stats()
  return JSON.stringify({
    draws: s.drawsSoFar(),
    elapsed: st.elapsed,
    bodies: st.bodies,
    intensity: st.intensity,
    score: st.score,
    lamps: st.lamps,
    particles: st.particles,
    chunks: st.chunks,
    targets: dbg()
      .targets()
      .map((t) => [t.x, t.y, t.kind, t.text]),
  })
}

export function begin(
  opts: { seed?: number; onReport?: (r: Report) => void; onHaptic?: (k: string) => void } = {},
) {
  const s = surface(768, 1024)
  const restore = s.install()
  const nexts: number[] = []
  const base = createStubHost({ seed: opts.seed ?? 0x51ce, reducedMotion: false, onReport: opts.onReport })
  // `haptic` is watched rather than trusted: the stub's own is a no-op, and a
  // test that asserts "no `failure` cue" against a no-op asserts nothing at all.
  const host = {
    ...base,
    next: (o?: { domain?: string; difficulty?: number }) => {
      nexts.push(1)
      return base.next(o)
    },
    haptic: (k: "light" | "medium" | "heavy" | "success" | "failure") => {
      opts.onHaptic?.(k)
      base.haptic(k)
    },
  }
  const handle = mount(s.el as unknown as HTMLElement, host)
  return { s, handle, restore, nextCount: () => nexts.length }
}

/** A swipe straight through a point, fast enough to be a cut and not a drag. */
/** The values that would advance the order right now, straight off the plate. */
export function frontier(): number[] {
  const raw = String(dbg().stats().frontier)
  return raw === "" ? [] : raw.split(",").map(Number)
}

/** A gourd in the air whose value would advance the order, if one is up. */
export function helpfulUp(): Target | undefined {
  const f = frontier()
  return dbg()
    .targets()
    .find((t) => t.kind === B_GOURD && t.value > 0 && f.includes(t.value))
}

/** A gourd in the air that is bigger than what is left — the one miss. */
export function overshootUp(): Target | undefined {
  const residual = Number(dbg().stats().residual)
  return dbg()
    .targets()
    .find((t) => t.kind === B_GOURD && t.value > residual)
}

/** Step until a predicate holds, or give up. Returns whether it held. */
export function until(s: Surface, frames: number, ok: () => boolean): boolean {
  for (let i = 0; i < frames; i++) {
    if (ok()) return true
    s.step(16)
  }
  return ok()
}

export function swipe(s: Surface, x: number, y: number): void {
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
