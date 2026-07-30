// The test rig: a browser that is not a browser, and a canvas that behaves like
// a canvas.
//
// **Why this file exists.** The first version of the mount test built its 2D
// context out of a `Proxy` that answered every call with a stub and returned
// `{ addColorStop() {} }` for a gradient. It ran nine hundred frames of a real
// bout and proved the modules were wired to each other — and it could not have
// failed for a colour, a radius or a transform, because nothing it handed to the
// canvas was ever *checked*. THE GRAPPLE FOUNDRY then shipped a bug where the
// first kick-out of the session threw inside `drawMat` and took the rest of every
// subsequent frame with it: no wrestlers, no referee, no pedals, the audio still
// playing. That test passed the whole time.
//
// So the context here answers every call *and enforces the parts of the 2D spec
// that throw*:
//
//   * `CanvasGradient.addColorStop` throws `SyntaxError` on a colour string it
//     cannot parse. This is the one that was missed, and it is the difference
//     between a wrong colour and a dead frame.
//   * `arc`, `ellipse`, `arcTo` and `createRadialGradient` throw `IndexSizeError`
//     on a negative radius.
//   * A gradient constructor throws on a non-finite coordinate.
//   * `restore()` with an empty stack is a save/restore imbalance in the caller
//     and is recorded, because a leaked `clip()` hides everything drawn after it.
//
// And it records *where marks landed*, in screen space, with the transform
// applied. A blank screen is not a small number of draw calls — the founder's
// screenshot had the crowd, the posts and the mat on it — it is draw calls that
// stopped happening in one band of the screen. Counting calls cannot tell those
// apart. Positions can.
//
// Colours that the canvas merely *ignores* (an unparseable `fillStyle`) are
// recorded in `invalid` rather than thrown, because that is what a real canvas
// does, and a test that threw there would be testing a browser that does not
// exist.

/** One mark that reached the canvas, at its centre in screen space. */
export type Mark = {
  /** `fill`, `stroke`, `fillRect`, or `text:<the string>`. */
  kind: string
  x: number
  y: number
  /** The colour in force when it landed, or `<gradient>`. */
  style: string
}

export type Recorder = {
  /** Every drawing call, for the coarse "did anything happen" assertions. */
  calls: number
  /** Every string written with `fillText`. */
  text: string[]
  /** Marks in screen space. Cleared by the caller between measurements. */
  marks: Mark[]
  /** Colour strings the canvas would have silently ignored. Should stay empty. */
  invalid: string[]
  /** Save/restore imbalances. Should stay empty. */
  imbalance: number
}

export function recorder(): Recorder {
  return { calls: 0, text: [], marks: [], invalid: [], imbalance: 0 }
}

/** A 2D affine transform, tracked so marks can be reported in screen space. */
type Affine = { a: number; b: number; c: number; d: number; e: number; f: number }

const identity = (): Affine => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })

function map(m: Affine, x: number, y: number): [number, number] {
  return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]
}

/**
 * Is this a colour string a canvas can parse?
 *
 * Deliberately narrow: it accepts the forms this game actually produces (hex and
 * `rgb`/`rgba`) and rejects anything with a `NaN` or an `undefined` in it. A
 * looser check would have accepted `rgba(NaN,11,37,0.3)`, which is the string
 * that blanked the ring.
 */
export function parseableColour(value: unknown): boolean {
  if (typeof value !== "string") return false
  const s = value.trim()
  if (s.includes("NaN") || s.includes("undefined") || s.includes("Infinity")) return false
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return true
  if (/^rgba?\(\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?\s*(,\s*[\d.]+\s*)?\)$/.test(s)) {
    return true
  }
  // Named colours and everything else this game does not use.
  return /^[a-z]+$/i.test(s)
}

/**
 * A 2D context that draws nothing, records everything, and throws exactly where
 * the specification says a real one throws.
 */
export function recordingContext(rec: Recorder): CanvasRenderingContext2D {
  let m = identity()
  const stack: Affine[] = []
  let path: Array<[number, number]> = []
  let fillStyle = "#000000"
  let strokeStyle = "#000000"

  const colour = (value: unknown): string => {
    if (typeof value !== "string") return "<gradient>"
    if (!parseableColour(value)) {
      // A real canvas ignores this and keeps the previous colour.
      rec.invalid.push(value)
      return ""
    }
    return value
  }

  const stop = (offset: number, color: string): void => {
    if (!parseableColour(color)) {
      throw new Error(
        `SyntaxError: addColorStop(${offset}, ${JSON.stringify(color)}): not a valid colour`,
      )
    }
  }

  const gradient = { addColorStop: stop }

  const point = (x: number, y: number): void => {
    path.push(map(m, x, y))
  }

  const land = (kind: string, style: string): void => {
    rec.calls++
    if (path.length === 0) return
    let sx = 0
    let sy = 0
    for (const [x, y] of path) {
      sx += x
      sy += y
    }
    rec.marks.push({ kind, x: sx / path.length, y: sy / path.length, style })
  }

  const ctx = {
    lineWidth: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
    lineCap: "",

    get fillStyle(): string {
      return fillStyle
    },
    set fillStyle(value: unknown) {
      const next = colour(value)
      if (next !== "") fillStyle = next
    },
    get strokeStyle(): string {
      return strokeStyle
    },
    set strokeStyle(value: unknown) {
      const next = colour(value)
      if (next !== "") strokeStyle = next
    },

    save(): void {
      rec.calls++
      stack.push({ ...m })
    },
    restore(): void {
      rec.calls++
      const previous = stack.pop()
      if (!previous) {
        rec.imbalance++
        return
      }
      m = previous
    },
    translate(x: number, y: number): void {
      rec.calls++
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      const [e, f] = map(m, x, y)
      m.e = e
      m.f = f
    },
    scale(x: number, y: number): void {
      rec.calls++
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      m.a *= x
      m.b *= x
      m.c *= y
      m.d *= y
    },
    rotate(r: number): void {
      rec.calls++
      if (!Number.isFinite(r)) return
      const cos = Math.cos(r)
      const sin = Math.sin(r)
      const { a, b, c, d } = m
      m.a = a * cos + c * sin
      m.b = b * cos + d * sin
      m.c = c * cos - a * sin
      m.d = d * cos - b * sin
    },
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
      rec.calls++
      m = { a, b, c, d, e, f }
    },

    beginPath(): void {
      rec.calls++
      path = []
    },
    closePath(): void {
      rec.calls++
    },
    moveTo(x: number, y: number): void {
      rec.calls++
      point(x, y)
    },
    lineTo(x: number, y: number): void {
      rec.calls++
      point(x, y)
    },
    arc(x: number, y: number, r: number): void {
      rec.calls++
      if (r < 0) throw new Error(`IndexSizeError: arc radius ${r}`)
      point(x, y)
    },
    ellipse(x: number, y: number, rx: number, ry: number): void {
      rec.calls++
      if (rx < 0 || ry < 0) throw new Error(`IndexSizeError: ellipse radii ${rx}, ${ry}`)
      point(x, y)
    },
    arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void {
      rec.calls++
      if (r < 0) throw new Error(`IndexSizeError: arcTo radius ${r}`)
      point(x1, y1)
      point(x2, y2)
    },
    rect(x: number, y: number, w: number, h: number): void {
      rec.calls++
      point(x, y)
      point(x + w, y + h)
    },
    clip(): void {
      rec.calls++
    },
    fill(): void {
      land("fill", fillStyle)
    },
    stroke(): void {
      land("stroke", strokeStyle)
    },
    fillRect(x: number, y: number, w: number, h: number): void {
      rec.calls++
      if (![x, y, w, h].every(Number.isFinite)) return
      const [cx, cy] = map(m, x + w / 2, y + h / 2)
      rec.marks.push({ kind: "fillRect", x: cx, y: cy, style: fillStyle })
    },
    strokeRect(): void {
      rec.calls++
    },
    clearRect(): void {
      rec.calls++
    },
    fillText(t: string, x: number, y: number): void {
      rec.calls++
      rec.text.push(t)
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      const [cx, cy] = map(m, x, y)
      rec.marks.push({ kind: `text:${t}`, x: cx, y: cy, style: fillStyle })
    },
    measureText(t: string): { width: number } {
      rec.calls++
      return { width: t.length * 8 }
    },
    createLinearGradient(x0: number, y0: number, x1: number, y1: number): unknown {
      rec.calls++
      if (![x0, y0, x1, y1].every(Number.isFinite)) {
        throw new Error(`createLinearGradient: non-finite (${x0}, ${y0}, ${x1}, ${y1})`)
      }
      return gradient
    },
    createRadialGradient(
      x0: number,
      y0: number,
      r0: number,
      x1: number,
      y1: number,
      r1: number,
    ): unknown {
      rec.calls++
      if (![x0, y0, r0, x1, y1, r1].every(Number.isFinite)) {
        throw new Error("createRadialGradient: non-finite argument")
      }
      if (r0 < 0 || r1 < 0) throw new Error(`IndexSizeError: radial radii ${r0}, ${r1}`)
      return gradient
    },
  }

  return ctx as unknown as CanvasRenderingContext2D
}

// ── the document ─────────────────────────────────────────────────────────────

type Listener = (event: unknown) => void

export type FakeElement = {
  style: { cssText: string; top: string; right: string }
  width: number
  height: number
  id: string
  className: string
  listeners: Map<string, Listener[]>
  children: unknown[]
  attrs: Map<string, string>
  appendChild(child: unknown): void
  append(...children: unknown[]): void
  setAttribute(name: string, value: string): void
  remove(): void
  focus(): void
  addEventListener(type: string, fn: Listener): void
  removeEventListener(type: string, fn: Listener): void
  getBoundingClientRect(): { width: number; height: number; left: number; top: number }
  getContext(): CanvasRenderingContext2D
}

export type Rig = {
  host: FakeElement
  doc: {
    visibilityState: string
    body: FakeElement
    activeElement: null
    listeners: Map<string, Listener[]>
    createElement(): FakeElement
    getElementById(id: string): FakeElement | null
    addEventListener(type: string, fn: Listener): void
    removeEventListener(type: string, fn: Listener): void
  }
  created: FakeElement[]
  ctx: CanvasRenderingContext2D
  frames: Array<(t: number) => void>
  globals: Map<string, Listener[]>
}

function harness(size: { w: number; h: number }, ctx: CanvasRenderingContext2D) {
  const make = (): FakeElement => {
    const listeners = new Map<string, Listener[]>()
    const children: unknown[] = []
    return {
      style: { cssText: "", top: "", right: "" },
      width: 0,
      height: 0,
      id: "",
      className: "",
      listeners,
      children,
      attrs: new Map<string, string>(),
      appendChild(child) {
        children.push(child)
      },
      append(...kids) {
        children.push(...kids)
      },
      setAttribute(name, value) {
        this.attrs.set(name, value)
      },
      remove() {},
      focus() {},
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
  // The shared chrome measures `env(safe-area-inset-*)` through a hidden probe
  // element and mounts a how-to-play button, so this document has to answer
  // `getElementById`, own a `body`, and hand back elements that can take
  // attributes. A partial document is worse than none: it type-checks, it looks
  // like a browser, and it throws on the first real call.
  const byId = new Map<string, FakeElement>()
  const body = make()
  body.appendChild = (child: unknown): void => {
    const el = child as FakeElement
    if (el?.id) byId.set(el.id, el)
  }
  const doc = {
    visibilityState: "visible",
    body,
    activeElement: null,
    listeners: new Map<string, Listener[]>(),
    createElement() {
      const el = make()
      created.push(el)
      return el
    },
    getElementById(id: string) {
      return byId.get(id) ?? null
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

/**
 * Install the browser globals `mount.ts` needs, run `body`, and take them back
 * off again — including when `body` throws, which is the case this rig exists to
 * catch.
 */
export function withBrowser(
  size: { w: number; h: number },
  ctx: CanvasRenderingContext2D,
  body: (rig: Rig) => void,
): void {
  const rig = harness(size, ctx)
  const saved = new Map<string, PropertyDescriptor | undefined>()
  const set = (key: string, value: unknown): void => {
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
  // No notch off a real device. Zeros are the honest answer, and are what the
  // safe-area probe resolves to on a laptop too.
  set("getComputedStyle", () => ({
    paddingTop: "0px",
    paddingRight: "0px",
    paddingBottom: "0px",
    paddingLeft: "0px",
  }))
  // The global listeners are RECORDED rather than swallowed. `mount.ts` puts its
  // keyboard on `globalThis`, and the how-to-play panel is a DOM scrim — which
  // stops the pointer and nothing else — so the only way to test that a key
  // cannot reach the bout through the manual is to be able to fire one.
  const globals = new Map<string, Listener[]>()
  set("addEventListener", (type: string, fn: Listener) => {
    globals.set(type, [...(globals.get(type) ?? []), fn])
  })
  set("removeEventListener", (type: string, fn: Listener) => {
    globals.set(type, (globals.get(type) ?? []).filter((f) => f !== fn))
  })

  try {
    body({ ...rig, frames, globals })
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
}

/** The canvas is the second element `mount` creates: the root div, then it. */
export function canvasOf(created: FakeElement[]): FakeElement {
  const el = created[1]
  if (!el) throw new Error("mount did not create a canvas")
  return el
}

/**
 * Run `n` frames at 60Hz, draining the rAF queue each time.
 *
 * A frame that throws is *reported*, not swallowed. `mount.ts` re-arms its rAF on
 * the first line of `frame()`, so a throwing loop keeps being scheduled forever
 * and a rig that quietly caught the exception would be reproducing the exact
 * blindness that let the blank ring ship.
 */
export function pump(frames: Array<(t: number) => void>, n: number, from = 0): number {
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
