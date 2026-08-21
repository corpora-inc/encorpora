/**
 * One verb: MOVE. Weapons fire themselves.
 *
 * Touch is primary — a floating stick that materialises wherever the thumb
 * lands, because a fixed stick in a corner is a thumb-stretch on a tablet and
 * a child re-grips constantly. Desktop is deliberate, not an afterthought:
 * WASD/arrows are analogue-smoothed so a keyboard player still gets the
 * drifting, momentum-y feel a stick gives, and holding the pointer steers too.
 */

export type Stick = {
  /** −1..1 */
  x: number
  y: number
  /** 0..1 */
  mag: number
  /** Screen-space anchor for drawing the stick, in CSS pixels. */
  originX: number
  originY: number
  knobX: number
  knobY: number
  active: boolean
  /** True while the current gesture came from a finger. */
  touch: boolean
}

const DEAD = 0.06
const RADIUS = 62

export class Input {
  readonly stick: Stick = {
    x: 0, y: 0, mag: 0,
    originX: 0, originY: 0, knobX: 0, knobY: 0,
    active: false, touch: false,
  }

  private keys = new Set<string>()
  private pointerId: number | null = null
  private kx = 0
  private ky = 0
  private detachers: (() => void)[] = []
  /** Consumed by the game each frame; set by any key or tap. */
  anyPress = false

  private el: HTMLElement

  constructor(el: HTMLElement) {
    this.el = el
    const stop = (e: Event) => e.preventDefault()

    const down = (e: PointerEvent) => {
      // Anything with its own pointer-events (cards, buttons) already ate this.
      if (this.pointerId !== null) return
      this.pointerId = e.pointerId
      this.stick.touch = e.pointerType !== "mouse"
      const r = this.el.getBoundingClientRect()
      this.stick.originX = e.clientX - r.left
      this.stick.originY = e.clientY - r.top
      this.stick.knobX = this.stick.originX
      this.stick.knobY = this.stick.originY
      this.stick.active = true
      this.anyPress = true
      try { this.el.setPointerCapture(e.pointerId) } catch { /* not capturable */ }
    }

    const move = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return
      const r = this.el.getBoundingClientRect()
      const px = e.clientX - r.left
      const py = e.clientY - r.top
      let dx = px - this.stick.originX
      let dy = py - this.stick.originY
      const d = Math.hypot(dx, dy)
      if (d > RADIUS) {
        // Re-anchor so the stick never feels "stuck" during a long drag.
        this.stick.originX = px - (dx / d) * RADIUS
        this.stick.originY = py - (dy / d) * RADIUS
        dx = (dx / d) * RADIUS
        dy = (dy / d) * RADIUS
      }
      this.stick.knobX = this.stick.originX + dx
      this.stick.knobY = this.stick.originY + dy
    }

    const up = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return
      this.pointerId = null
      this.stick.active = false
    }

    const kd = (e: KeyboardEvent) => {
      this.keys.add(e.key.toLowerCase())
      this.anyPress = true
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(e.key.toLowerCase())) e.preventDefault()
    }
    const ku = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase())
    const blur = () => this.keys.clear()

    this.el.addEventListener("pointerdown", down)
    this.el.addEventListener("pointermove", move)
    this.el.addEventListener("pointerup", up)
    this.el.addEventListener("pointercancel", up)
    this.el.addEventListener("touchstart", stop, { passive: false })
    this.el.addEventListener("contextmenu", stop)
    window.addEventListener("keydown", kd)
    window.addEventListener("keyup", ku)
    window.addEventListener("blur", blur)

    this.detachers.push(() => {
      this.el.removeEventListener("pointerdown", down)
      this.el.removeEventListener("pointermove", move)
      this.el.removeEventListener("pointerup", up)
      this.el.removeEventListener("pointercancel", up)
      this.el.removeEventListener("touchstart", stop)
      this.el.removeEventListener("contextmenu", stop)
      window.removeEventListener("keydown", kd)
      window.removeEventListener("keyup", ku)
      window.removeEventListener("blur", blur)
    })
  }

  held(k: string): boolean {
    return this.keys.has(k)
  }

  /** Latches: returns true once per press. */
  pressed(k: string): boolean {
    if (!this.keys.has(k)) return false
    this.keys.delete(k)
    return true
  }

  update(dt: number): void {
    // Keyboard, smoothed toward the raw axis so it behaves like a stick.
    const kxTarget =
      (this.held("d") || this.held("arrowright") ? 1 : 0) - (this.held("a") || this.held("arrowleft") ? 1 : 0)
    const kyTarget =
      (this.held("s") || this.held("arrowdown") ? 1 : 0) - (this.held("w") || this.held("arrowup") ? 1 : 0)
    const k = 1 - Math.pow(0.0007, dt)
    this.kx += (kxTarget - this.kx) * k
    this.ky += (kyTarget - this.ky) * k
    if (Math.abs(this.kx) < 0.004) this.kx = 0
    if (Math.abs(this.ky) < 0.004) this.ky = 0

    let x = this.kx
    let y = this.ky

    if (this.stick.active) {
      const dx = (this.stick.knobX - this.stick.originX) / RADIUS
      const dy = (this.stick.knobY - this.stick.originY) / RADIUS
      const m = Math.hypot(dx, dy)
      if (m > DEAD) {
        // Rescale past the dead zone so the first millimetre of travel counts.
        const s = (m - DEAD) / (1 - DEAD) / m
        x = dx * s
        y = dy * s
      }
    }

    const mag = Math.hypot(x, y)
    if (mag > 1) {
      x /= mag
      y /= mag
    }
    this.stick.x = x
    this.stick.y = y
    this.stick.mag = Math.min(1, mag)
  }

  takeAnyPress(): boolean {
    const v = this.anyPress
    this.anyPress = false
    return v
  }

  destroy(): void {
    for (const d of this.detachers) d()
    this.detachers.length = 0
  }
}
