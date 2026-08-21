/**
 * Two verbs, no instructions.
 *
 *   steer  — a mouse steers by pointing (Agar's scheme, which is correct with
 *            a mouse); a finger steers with a floating relative stick, so your
 *            hand is never sitting on top of the thing you are trying to read.
 *   surge  — hold. A second finger, a double-tap-and-hold, a held mouse
 *            button, space or shift. All of them, because a child will try
 *            whichever one they think of first and being wrong should not be a
 *            thing that happens.
 *
 * Touch is primary. Desktop is deliberate, not a port.
 */

export type InputState = {
  /** Unit direction the player wants to move, magnitude 0..1. */
  dx: number
  dy: number
  /** Absolute screen aim, used by the mouse path. */
  hasAbsolute: boolean
  absX: number
  absY: number
  surge: boolean
  /** True once the player has surged at least once; kills the discovery hint. */
  everSurged: boolean
  anyInput: boolean
}

const DEAD = 14
const STICK = 84

export class Input {
  readonly state: InputState = {
    dx: 0,
    dy: 0,
    hasAbsolute: false,
    absX: 0,
    absY: 0,
    surge: false,
    everSurged: false,
    anyInput: false,
  }

  private el: HTMLElement
  private primary = -1
  private originX = 0
  private originY = 0
  private curX = 0
  private curY = 0
  private extraTouches = new Set<number>()
  private keySurge = false
  private mouseSurge = false
  private lastTapAt = 0
  private tapHoldSurge = false
  private readonly onCtx = (e: Event): void => e.preventDefault()

  constructor(el: HTMLElement) {
    this.el = el
    el.style.touchAction = "none"
    el.addEventListener("pointerdown", this.onDown, { passive: false })
    el.addEventListener("pointermove", this.onMove, { passive: false })
    window.addEventListener("pointerup", this.onUp, { passive: false })
    window.addEventListener("pointercancel", this.onUp, { passive: false })
    window.addEventListener("keydown", this.onKey, { passive: false })
    window.addEventListener("keyup", this.onKey, { passive: false })
    window.addEventListener("blur", this.onBlur)
    el.addEventListener("contextmenu", this.onCtx)
  }

  private readonly onDown = (e: PointerEvent): void => {
    e.preventDefault()
    this.state.anyInput = true
    if (e.pointerType === "mouse") {
      this.state.hasAbsolute = true
      this.state.absX = e.clientX
      this.state.absY = e.clientY
      if (e.button === 0 || e.button === 2) this.mouseSurge = true
      return
    }
    if (this.primary === -1) {
      const now = performance.now()
      // A double-tap that is held is the one-handed surge.
      this.tapHoldSurge = now - this.lastTapAt < 280
      this.lastTapAt = now
      this.primary = e.pointerId
      this.originX = e.clientX
      this.originY = e.clientY
      this.curX = e.clientX
      this.curY = e.clientY
      try {
        this.el.setPointerCapture(e.pointerId)
      } catch {
        /* capture is a nicety, not a requirement */
      }
    } else {
      this.extraTouches.add(e.pointerId)
    }
  }

  private readonly onMove = (e: PointerEvent): void => {
    if (e.pointerType === "mouse") {
      this.state.hasAbsolute = true
      this.state.absX = e.clientX
      this.state.absY = e.clientY
      this.state.anyInput = true
      return
    }
    if (e.pointerId !== this.primary) return
    e.preventDefault()
    this.curX = e.clientX
    this.curY = e.clientY
    // The stick re-centres if you drag past its edge, so a long drag never
    // runs out of travel and a small hand can still turn all the way round.
    const dx = this.curX - this.originX
    const dy = this.curY - this.originY
    const d = Math.hypot(dx, dy)
    if (d > STICK * 1.6) {
      const s = (d - STICK * 1.6) / d
      this.originX += dx * s
      this.originY += dy * s
    }
  }

  private readonly onUp = (e: PointerEvent): void => {
    if (e.pointerType === "mouse") {
      this.mouseSurge = false
      return
    }
    if (e.pointerId === this.primary) {
      this.primary = -1
      this.tapHoldSurge = false
    }
    this.extraTouches.delete(e.pointerId)
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    const down = e.type === "keydown"
    if (e.code === "Space" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
      e.preventDefault()
      this.keySurge = down
      this.state.anyInput = true
    }
  }

  private readonly onBlur = (): void => {
    this.keySurge = false
    this.mouseSurge = false
    this.primary = -1
    this.extraTouches.clear()
    this.tapHoldSurge = false
  }

  /** Resolve the frame's intent. Writes into the shared state object. */
  sample(): InputState {
    const s = this.state
    if (this.primary !== -1) {
      const dx = this.curX - this.originX
      const dy = this.curY - this.originY
      const d = Math.hypot(dx, dy)
      if (d <= DEAD) {
        s.dx = 0
        s.dy = 0
      } else {
        const mag = Math.min(1, (d - DEAD) / (STICK - DEAD))
        s.dx = (dx / d) * mag
        s.dy = (dy / d) * mag
      }
      s.hasAbsolute = false
    } else if (!s.hasAbsolute) {
      s.dx = 0
      s.dy = 0
    }
    s.surge = this.keySurge || this.mouseSurge || this.extraTouches.size > 0 || this.tapHoldSurge
    if (s.surge) s.everSurged = true
    return s
  }

  dispose(): void {
    this.el.removeEventListener("pointerdown", this.onDown)
    this.el.removeEventListener("pointermove", this.onMove)
    window.removeEventListener("pointerup", this.onUp)
    window.removeEventListener("pointercancel", this.onUp)
    window.removeEventListener("keydown", this.onKey)
    window.removeEventListener("keyup", this.onKey)
    window.removeEventListener("blur", this.onBlur)
    this.el.removeEventListener("contextmenu", this.onCtx)
  }
}
