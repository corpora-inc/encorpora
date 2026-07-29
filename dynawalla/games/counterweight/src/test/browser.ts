// The browser THE STEELYARD is mounted into, headlessly.
//
// `tsc` proves the draw calls type-check and the vite build proves the modules
// resolve. Neither proves that a frame *runs* — a stale property, a function
// renamed in `render/` and not in `mount.ts`, a value read before it is
// assigned: all compile, and all crash on the first frame in front of a child.
//
// So this is a canvas that records instead of painting, a document that builds
// elements instead of nodes, and a clock the test drives by hand. It lives in
// its own module because more than one test file needs it — `mount.test.ts`
// drives whole matches through it, `manual-freeze.test.ts` drives the shared
// how-to-play sheet — and two copies of a rig this size drift within a week.
//
// **Per-element listener maps.** Not one map keyed by event type for the whole
// document. The shared chrome's help control and its PLAY button both register
// a `"click"` listener, so a shared map silently keeps only the second and the
// manual becomes unreachable from a test.

export type Listener = (event: unknown) => void

/** A 2D context that answers every call and records how much work it was asked for. */
export function fakeContext(counter: {
  calls: number
  text: string[]
}): CanvasRenderingContext2D {
  const store = new Map<string, unknown>()
  const noop = (name: string) =>
    function (...args: unknown[]) {
      counter.calls++
      if (name === "fillText" && typeof args[0] === "string") counter.text.push(args[0])
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

export type FakeElement = {
  id: string
  /** Set by the shared chrome on the controls it mounts. How a test finds them. */
  className: string
  style: Record<string, string>
  width: number
  height: number
  listeners: Map<string, Listener[]>
  appendChild(child: unknown): void
  append(...children: unknown[]): void
  setAttribute(name: string, value: string): void
  focus(): void
  remove(): void
  addEventListener(type: string, fn: Listener): void
  removeEventListener(type: string, fn: Listener): void
  getBoundingClientRect(): { width: number; height: number; left: number; top: number }
  getContext(): CanvasRenderingContext2D
  [key: string]: unknown
}

export function harness(size: { w: number; h: number }, counter: { calls: number; text: string[] }) {
  const ctx = fakeContext(counter)
  const make = (): FakeElement => {
    const listeners = new Map<string, Listener[]>()
    return {
      id: "",
      className: "",
      style: { cssText: "" },
      width: 0,
      height: 0,
      listeners,
      appendChild() {},
      append() {},
      setAttribute() {},
      focus() {},
      remove() {},
      addEventListener(type, fn) {
        const list = listeners.get(type) ?? []
        list.push(fn)
        listeners.set(type, list)
      },
      removeEventListener(type, fn) {
        listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn))
      },
      getBoundingClientRect: () => ({ width: size.w, height: size.h, left: 0, top: 0 }),
      getContext: () => ctx,
    }
  }
  const created: FakeElement[] = []
  // The shared chrome adds two things this stub has to answer for: the
  // safe-area probe, which looks itself up by id before making a second one,
  // and the how-to-play panel, which builds a small tree of buttons and lists.
  // Both are DOM the game now really does create, so the fake DOM grows to meet
  // them rather than the game being asked to skip them under test.
  const doc = {
    visibilityState: "visible",
    listeners: new Map<string, Listener[]>(),
    body: { appendChild() {} },
    activeElement: null,
    createElement() {
      const el = make()
      created.push(el)
      return el
    },
    getElementById(id: string): FakeElement | null {
      return created.find((el) => el.id === id) ?? null
    },
    addEventListener(type: string, fn: Listener) {
      const list = doc.listeners.get(type) ?? []
      list.push(fn)
      doc.listeners.set(type, list)
    },
    removeEventListener(type: string, fn: Listener) {
      doc.listeners.set(type, (doc.listeners.get(type) ?? []).filter((f) => f !== fn))
    },
  }
  return { host: make(), doc, created, ctx }
}

export type Clock = { now: number }
export type Rig = ReturnType<typeof harness> & {
  frames: Array<(t: number) => void>
  /** The wall clock `mount.ts` bills latency against, under the test's control. */
  clock: Clock
}

/**
 * Install the browser globals `mount.ts` needs, run `body`, and take them back
 * off again — including when `body` throws, which is the case these files exist
 * to catch.
 */
export function withBrowser(
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
  const clock: Clock = { now: 0 }
  set("performance", { now: () => clock.now })
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
    body({ ...rig, frames, clock })
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
}

/**
 * The listener a game registered on an element, proved to be there.
 *
 * `el.listeners.get("pointerdown")?.[0] as Listener` types the hole shut
 * without ever looking into it: a game that stopped wiring its canvas hands
 * back `undefined`, the cast calls it a `Listener`, and any `assert.ok` on the
 * result is vacuously true — `tsc` says so, TS2774. Throwing here is the check.
 */
export function listenerOn(el: FakeElement, type: string): Listener {
  const fn = el.listeners.get(type)?.[0]
  if (!fn) throw new Error(`nothing was ever registered for "${type}"`)
  return fn
}

/** The canvas is the first element `mount` creates. */
export function canvasOf(created: FakeElement[]): FakeElement {
  const el = created[0]
  if (!el) throw new Error("mount did not create a canvas")
  return el
}

/**
 * Run `n` frames at 60 Hz, draining the rAF queue each time.
 *
 * The wall clock moves with the frames, because it does on a device — which is
 * the whole point of the latency cases: a sheet held up for half a minute moves
 * `performance.now()` by half a minute whether or not the game is running.
 */
export function pump(
  frames: Array<(t: number) => void>,
  n: number,
  from = 0,
  clock?: Clock,
): number {
  let t = from
  for (let i = 0; i < n; i++) {
    const next = frames.pop()
    frames.length = 0
    if (!next) break
    t += 16.7
    if (clock) clock.now = t
    next(t)
  }
  return t
}
