// Just enough browser to run the real game in `node --test`.
//
// CLAIM's only report used to be reachable from `die()` alone, and the test that
// pinned it counted `host.report(` calls in the source because "the game class
// needs a DOM". That is true, and it is also why the reporting hole survived:
// nothing could ever *play* the game and look at what came out. This is the
// smallest stub that lets `tick()`/`hold()` drive the actual loop — same update,
// same collision, same claim rule, same gate.
//
// Nothing here is asserted on. It exists so the assertions can be about the
// game.

type Any = Record<string, unknown>

const rect = { x: 0, y: 0, width: 1024, height: 768, top: 0, left: 0, right: 1024, bottom: 768 }

function ctx2d(): Any {
  const store: Any = {}
  return new Proxy(store, {
    get(t, k) {
      if (k === "canvas") return { width: 1024, height: 768 }
      if (k === "measureText") return () => ({ width: 12 })
      if (k === "createLinearGradient" || k === "createRadialGradient" || k === "createPattern")
        return () => ({ addColorStop: () => {} })
      if (k === "createImageData" || k === "getImageData")
        return (w: number, h: number) => ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(Math.max(4, w * h * 4)),
        })
      if (k in t) return t[k as string]
      return () => undefined
    },
    set(t, k, v) {
      t[k as string] = v
      return true
    },
  }) as unknown as Any
}

function el(tag = "div"): Any {
  const style = new Proxy({} as Any, {
    get: (t, k) => (k === "setProperty" || k === "removeProperty" ? () => {} : (t[k as string] ?? "")),
    set: (t, k, v) => {
      t[k as string] = v
      return true
    },
  })
  const node: Any = {
    tagName: tag.toUpperCase(),
    className: "",
    innerHTML: "",
    textContent: "",
    tabIndex: 0,
    style,
    dataset: {},
    children: [] as Any[],
    width: 1024,
    height: 768,
    clientWidth: 1024,
    clientHeight: 768,
    offsetWidth: 1024,
    offsetHeight: 768,
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    appendChild(c: Any) {
      ;(node.children as Any[]).push(c)
      return c
    },
    insertBefore(c: Any) {
      ;(node.children as Any[]).push(c)
      return c
    },
    removeChild() {},
    remove() {},
    append() {},
    focus() {},
    blur() {},
    click() {},
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    getAttribute: () => null,
    setPointerCapture() {},
    releasePointerCapture() {},
    // The HUD builds itself with `innerHTML` and then reaches for the pieces.
    // A stub that answers `null` makes the game crash on its first frame, so
    // every selector gets a stable element of its own.
    querySelector(sel: string) {
      const cache = node._q as Record<string, Any>
      return (cache[sel] ??= el("div"))
    },
    querySelectorAll: () => [],
    _q: {} as Record<string, Any>,
    closest: () => null,
    contains: () => false,
    getBoundingClientRect: () => rect,
    getContext: () => ctx2d(),
    toDataURL: () => "",
  }
  return node
}

let installed = false

/** Install once. Returns a detached element to mount the game into. */
export function stubDom(): Any {
  const g = globalThis as unknown as Any
  if (!installed) {
    installed = true
    const body = el("body")
    g.document = {
      createElement: (t: string) => el(t),
      createElementNS: (_ns: string, t: string) => el(t),
      createTextNode: () => el("#text"),
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
      body,
      documentElement: el("html"),
      head: el("head"),
      fonts: { ready: Promise.resolve(), load: () => Promise.resolve(), add: () => {} },
      visibilityState: "visible",
      hidden: false,
    }
    g.Path2D = class {
      moveTo() {}
      lineTo() {}
      arc() {}
      rect() {}
      closePath() {}
addPath() {}
    }
    g.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    g.requestAnimationFrame = () => 1
    g.cancelAnimationFrame = () => {}
    g.matchMedia = () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    })
    g.getComputedStyle = () => ({ getPropertyValue: () => "0px" })
    g.devicePixelRatio = 2
    g.innerWidth = 1024
    g.innerHeight = 768
    g.addEventListener = () => {}
    g.removeEventListener = () => {}
    g.window = g
  }
  return el("div")
}
