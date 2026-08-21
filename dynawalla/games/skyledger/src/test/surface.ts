// A headless browser surface, shared by every test that mounts the real shell.
//
// It was `manual.test.ts`'s private fixture; `opening.test.ts` needs the same
// thing and a second copy of a hundred and fifty lines of fake DOM is how two
// tests quietly stop agreeing about what a frame is.
//
// Two things were added when it moved out, and both exist so an assertion can be
// made about pixels and about storage rather than about source text:
//
//   * the 2d context RECORDS `fillText` and the `fillStyle` in force when each
//     call was made, so a test can ask what is actually on the glass;
//   * `install()` puts a real, in-memory `localStorage` on `globalThis`, so the
//     read and write sides of a persisted count can be driven end to end.
//
// The fake elements below carry a listener map EACH, which is not tidiness: the
// help button and the PLAY button both register a `"click"`, so one shared map
// keyed by type silently drops the first and nothing opens.

// From `audioHold.ts` directly, not the barrel: `index.ts` deliberately does
// NOT re-export this, because a game that reached for it would defeat the hold
// for the whole pack. Node 24 enforces that; Node 22 does not, which is how the
// wrong import passed locally and failed in CI.
import { forgetAudioContexts } from "../../../../packs/shared/game-chrome/audioHold.ts"

export type Handler = (e: unknown) => void

export type Painted = { text: string; fill: string; x: number; y: number }

export type FakeEl = {
  className: string
  tag?: string
  fire(type: string, event?: unknown): void
  [key: string]: unknown
}

export function makeSurface(width = 768, height = 1024) {
  const created: FakeEl[] = []
  const rect = { left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0 }

  // Everything the canvas is asked to paint, in order. `fillText` is the only
  // call whose ARGUMENTS a test has ever needed, so it is the only one recorded
  // in full; the fill in force is captured with it, because "is this drawn in
  // the accent and never in the refusal colour" is a question about the pair.
  const painted: Painted[] = []
  let fill = ""
  const ctx: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") return undefined
        if (typeof prop === "symbol") return undefined
        if (prop === "fillStyle") return fill
        if (prop === "measureText") {
          // A monospace-ish estimate. Enough for the fitting loop in
          // `Scene.drawShown` to terminate on something other than zero.
          return (t: string) => ({ width: String(t).length * 10 })
        }
        if (prop === "fillText") {
          return (text: unknown, x: unknown, y: unknown) => {
            painted.push({ text: String(text), fill, x: Number(x), y: Number(y) })
          }
        }
        return () => ctx
      },
      set(_t, prop, value) {
        if (prop === "fillStyle") fill = String(value)
        return true
      },
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
    storage: (globalThis as { localStorage?: unknown }).localStorage,
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
    // A real one, in memory. `game/best.ts` and `game/seen.ts` both guard every
    // access because a pack frame throws; without a slot here they fall back to
    // module memory and a persistence assertion proves nothing.
    const slots = new Map<string, string>()
    ;(globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => slots.get(k) ?? null,
      setItem: (k: string, v: string) => {
        slots.set(k, String(v))
      },
      removeItem: (k: string) => {
        slots.delete(k)
      },
      clear: () => {
        slots.clear()
      },
      key: () => null,
      length: 0,
    }
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
      ;(globalThis as { localStorage?: unknown }).localStorage = saved.storage
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
    /** Every `fillText` since the last `clearPainted`, newest last. */
    painted: (): readonly Painted[] => painted,
    clearPainted: (): void => {
      painted.length = 0
    },
    /** The game's own canvas, so a test can press a finger to it. */
    canvas: () => created.find((e) => e.tag === "canvas"),
    /**
     * An event on `globalThis` — a keydown, a resize. The shell listens there
     * for the keyboard, so this is the only way a test can type at it.
     */
    fireGlobal(type: string, event: unknown = {}): void {
      for (const h of [...(globalKeys.get(type) ?? [])]) h(event)
    },
  }
}

