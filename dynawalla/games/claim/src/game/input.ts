// Two first-class control schemes, neither a port of the other.
//
// DESKTOP — arrows/WASD with turn buffering. A turn pressed up to `BUFFER_MS`
// before the player reaches a cell boundary still lands on that boundary, which
// is the difference between "tight" and "unresponsive" in any grid game.
//
// TOUCH — a floating stick that anchors wherever the thumb lands, anywhere on
// the screen. No on-screen d-pad to cover the arena with, no fixed corner to
// reach for, and a 13px deadzone so a resting thumb never steers. The stick
// re-anchors if the thumb travels far, so long drags don't drift.

export type Dir = { x: number; y: number }

const BUFFER_MS = 190
const DEADZONE = 13
const REANCHOR = 46

export class Input {
  /** Latest committed direction request. Zero means "no request". */
  dir: Dir = { x: 0, y: 0 }
  private dirAt = -1
  /** Set on any input at all — used to unlock audio and dismiss cards. */
  anyPress = false
  private held = new Set<string>()
  private touchId: number | null = null
  private ax = 0
  private ay = 0
  /** Live stick geometry, for drawing the thumb ring. */
  stick: { on: boolean; x: number; y: number; dx: number; dy: number } = {
    on: false,
    x: 0,
    y: 0,
    dx: 0,
    dy: 0,
  }
  /** Pointer position in CSS pixels relative to the element, or null. */
  pointer: { x: number; y: number } | null = null

  private el: HTMLElement
  private onAny: () => void
  private handlers: Array<[EventTarget, string, EventListener]> = []

  constructor(el: HTMLElement, onAny: () => void) {
    this.el = el
    this.onAny = onAny
    this.bind(window, "keydown", this.onKeyDown as EventListener)
    this.bind(window, "keyup", this.onKeyUp as EventListener)
    this.bind(el, "pointerdown", this.onPointerDown as EventListener)
    this.bind(el, "pointermove", this.onPointerMove as EventListener)
    this.bind(el, "pointerup", this.onPointerUp as EventListener)
    this.bind(el, "pointercancel", this.onPointerUp as EventListener)
    this.bind(el, "contextmenu", ((e: Event) => e.preventDefault()) as EventListener)
  }

  private bind(t: EventTarget, type: string, fn: EventListener): void {
    t.addEventListener(type, fn, { passive: false })
    this.handlers.push([t, type, fn])
  }

  /** Playtest seam: identical to what a keydown or a thumb produces. */
  setDir(x: number, y: number): void {
    if (x !== 0 || y !== 0) this.anyPress = true
    this.set(x, y)
  }

  private set(x: number, y: number): void {
    if (this.dir.x === x && this.dir.y === y) return
    this.dir = { x, y }
    this.dirAt = performance.now()
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase()
    const mapped =
      k === "arrowleft" || k === "a"
        ? [-1, 0]
        : k === "arrowright" || k === "d"
          ? [1, 0]
          : k === "arrowup" || k === "w"
            ? [0, -1]
            : k === "arrowdown" || k === "s"
              ? [0, 1]
              : null
    this.anyPress = true
    this.onAny()
    if (!mapped) return
    e.preventDefault()
    this.held.add(k)
    this.set(mapped[0] as number, mapped[1] as number)
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase()
    this.held.delete(k)
    if (this.held.size === 0 && this.touchId === null) this.set(0, 0)
  }

  private local(e: PointerEvent): { x: number; y: number } {
    const r = this.el.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  private onPointerDown = (e: PointerEvent): void => {
    e.preventDefault()
    this.anyPress = true
    this.onAny()
    const p = this.local(e)
    this.touchId = e.pointerId
    this.ax = p.x
    this.ay = p.y
    this.pointer = p
    this.stick = { on: true, x: p.x, y: p.y, dx: 0, dy: 0 }
    try {
      this.el.setPointerCapture(e.pointerId)
    } catch {
      /* capture is a nicety */
    }
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (this.touchId !== e.pointerId) return
    e.preventDefault()
    const p = this.local(e)
    this.pointer = p
    let dx = p.x - this.ax
    let dy = p.y - this.ay
    const len = Math.hypot(dx, dy)
    if (len > REANCHOR) {
      // Slide the anchor along behind the thumb so a long drag stays precise.
      const k = (len - REANCHOR) / len
      this.ax += dx * k
      this.ay += dy * k
      dx = p.x - this.ax
      dy = p.y - this.ay
    }
    this.stick = { on: true, x: this.ax, y: this.ay, dx, dy }
    if (Math.hypot(dx, dy) < DEADZONE) return
    // Dominant axis. Four-way movement is what keeps the cuts orthogonal and
    // the enclosed areas exact.
    if (Math.abs(dx) > Math.abs(dy)) this.set(dx > 0 ? 1 : -1, 0)
    else this.set(0, dy > 0 ? 1 : -1)
  }

  private onPointerUp = (e: PointerEvent): void => {
    if (this.touchId !== e.pointerId) return
    this.touchId = null
    this.stick = { on: false, x: 0, y: 0, dx: 0, dy: 0 }
    this.pointer = null
    if (this.held.size === 0) this.set(0, 0)
  }

  /** True while the buffered turn is still fresh enough to honour. */
  get fresh(): boolean {
    return performance.now() - this.dirAt <= BUFFER_MS
  }

  consumePress(): boolean {
    const v = this.anyPress
    this.anyPress = false
    return v
  }

  destroy(): void {
    for (const [t, type, fn] of this.handlers) t.removeEventListener(type, fn)
    this.handlers = []
    this.held.clear()
  }
}
