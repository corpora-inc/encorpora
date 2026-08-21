// Screen-space impact flash — the DOM path.
//
// ## Why the cheapest flash is not a WebGL flash
//
// The obvious implementation is a fullscreen additive quad, or a post-process
// pass. Both are fine and the kit ships one (`three/impact-pass.ts`). But a
// *flat tinted flash* — which is what the great majority of impacts want — is
// strictly cheaper as a composited DOM layer:
//
//   * It costs zero WebGL draw calls and zero render-target bandwidth. A
//     fullscreen pass at DPR 2 on an iPad is 5.6 M texel reads and writes; the
//     compositor does the same job in hardware with no GL work at all.
//   * It survives the GL context being lost, which happens on Android when the
//     app backgrounds.
//   * It works when there is no WebGL context, which is every 2D prototype.
//
// The measured numbers are in README.md. The rule the kit follows: **flat
// flashes are DOM, spatial effects are WebGL.**
//
// ## Trap: animate `opacity`, never `background-color`
//
// `opacity` and `transform` are the only two properties a browser can animate
// without touching the main thread. Animating `background-color` — or worse,
// creating and removing the element per flash — forces style recalculation and
// paint on the exact frame the child is looking at. The element is created
// once, kept in the DOM forever at `opacity: 0`, and only its opacity moves.
//
// ## Trap: `will-change` is not free
//
// Setting `will-change: opacity` permanently on a fullscreen element holds a
// full-screen compositor layer for the life of the app — on a 2732×2048 iPad
// that is ~22 MB of VRAM doing nothing. It is set only while a flash is live.

export interface FlashOptions {
  /** Where to mount. Defaults to `document.body`. */
  parent?: HTMLElement
  /** `z-index`. Must be above the game and below any modal. */
  zIndex?: number
}

export class ScreenFlash {
  private el: HTMLElement | null = null
  private live = 0
  private peak = 0
  private durationMs = 1
  private r = 255
  private g = 255
  private b = 255

  /** Scales every flash. The governor and reduced-motion turn this down. */
  intensity = 1

  attach(opts: FlashOptions = {}): void {
    const doc = (globalThis as unknown as { document?: Document }).document
    if (!doc || this.el) return
    const el = doc.createElement("div")
    el.setAttribute("data-dw-flash", "")
    el.style.cssText = [
      "position:fixed",
      "inset:0",
      "pointer-events:none",
      "opacity:0",
      "mix-blend-mode:screen",
      `z-index:${String(opts.zIndex ?? 9999)}`,
      // Own layer from the start so the first flash does not pay for promotion.
      "transform:translateZ(0)",
      "contain:strict",
    ].join(";")
    ;(opts.parent ?? doc.body).appendChild(el)
    this.el = el
  }

  /**
   * Fire a flash.
   *
   * @param peak 0…1 at the brightest frame.
   * @param durationMs total decay. 90–160 ms; longer reads as a fade, not a hit.
   * @param color linear RGB 0…1.
   */
  fire(peak: number, durationMs = 120, color: readonly [number, number, number] = [1, 1, 1]): void {
    if (!this.el || peak <= 0) return
    const p = peak * this.intensity
    if (p <= 0.001) return
    // A brighter flash always wins; a dimmer one during a live flash is ignored
    // rather than restarting the decay, which would make rapid taps strobe.
    if (this.live > 0 && p <= this.peak * (1 - this.live / this.durationMs)) return
    this.peak = p
    this.durationMs = Math.max(1, durationMs)
    this.live = this.durationMs
    this.r = Math.round(color[0] * 255)
    this.g = Math.round(color[1] * 255)
    this.b = Math.round(color[2] * 255)
    this.el.style.backgroundColor = `rgb(${String(this.r)},${String(this.g)},${String(this.b)})`
    this.el.style.willChange = "opacity"
  }

  /** @param dtRealMs wall clock — a flash must decay through a freeze frame. */
  update(dtRealMs: number): void {
    if (!this.el || this.live <= 0) return
    this.live -= dtRealMs
    if (this.live <= 0) {
      this.live = 0
      this.el.style.opacity = "0"
      this.el.style.willChange = "auto"
      return
    }
    const k = this.live / this.durationMs
    // Quadratic decay: the eye's response to a brief luminance spike is closer
    // to this than to linear, and linear reads as a slow wipe.
    this.el.style.opacity = String(this.peak * k * k)
  }

  settle(): void {
    this.live = 0
    if (this.el) {
      this.el.style.opacity = "0"
      this.el.style.willChange = "auto"
    }
  }

  dispose(): void {
    this.el?.remove()
    this.el = null
  }
}
