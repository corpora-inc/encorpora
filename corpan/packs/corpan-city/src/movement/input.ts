/**
 * Dual virtual joystick (left = move, right = look) with dynamic origin per
 * screen-half — the solved mobile-RPG control pattern. Also merges keyboard
 * (WASD / arrows for move, Q/E or right-drag for look) so the world is pleasant
 * to test on macOS desktop. A DOM overlay (not Babylon's overlay-canvas
 * joystick, which would steal pointer events from scene picking).
 *
 * Each screen-half owns at most ONE stick, keyed to the pointerId that spawned
 * it. Left and right sticks can be active simultaneously (true multi-touch:
 * move + look at once). All per-gesture state (origin, drag distance, tap
 * candidacy) lives PER STICK so a second finger can never corrupt the first's
 * tap/drag bookkeeping.
 */

export interface InputSample {
  /** move vector in [-1,1], y is forward(+)/back(-) */
  moveX: number
  moveY: number
  /** accumulated look delta since last sample (radians) */
  lookDelta: number
}

export interface Input {
  /** call once per frame: returns merged stick+keyboard move + accumulated look. */
  sample: () => InputSample
  /** a tap that wasn't a drag — screen coords; world pick handled by the game. */
  consumeTap: () => { x: number; y: number } | null
  /** Disable while a modal overlay is open: joystick + keyboard go inert, any
   *  visible sticks are dismissed, and held keys/taps are cleared. */
  setEnabled: (enabled: boolean) => void
  dispose: () => void
}

type Side = "left" | "right"

interface Stick {
  side: Side
  base: HTMLDivElement
  knob: HTMLDivElement
  /** pointerId currently driving this stick, or null when idle. */
  pointerId: number | null
  originX: number
  originY: number
  /** where this gesture began (for tap/drag classification). */
  downX: number
  downY: number
  /** has this gesture moved past the tap threshold yet? */
  movedFar: boolean
  /** analog vector in [-1,1] (vecY: screen-down positive). */
  vecX: number
  vecY: number
  /** previous look-vec x for right-stick delta integration. */
  prevLookX: number
}

const RADIUS = 56
const TAP_SLOP = 10
/** below this normalized magnitude the move stick reads as zero (anti-jitter). */
const DEAD_ZONE = 0.12

export function createInput(host: HTMLElement): Input {
  host.style.touchAction = "none"

  const mkStick = (side: Side): Stick => {
    const base = document.createElement("div")
    base.style.cssText =
      `position:absolute;width:${RADIUS * 2}px;height:${RADIUS * 2}px;border-radius:50%;` +
      "background:rgba(255,255,255,.18);border:2px solid rgba(255,255,255,.5);" +
      "display:none;pointer-events:none;z-index:20;transform:translate(-50%,-50%)"
    const knob = document.createElement("div")
    knob.style.cssText =
      "position:absolute;width:54px;height:54px;border-radius:50%;background:rgba(255,255,255,.7);" +
      "border:2px solid rgba(20,40,55,.35);pointer-events:none;z-index:21;transform:translate(-50%,-50%)"
    knob.style.display = "none"
    host.appendChild(base)
    host.appendChild(knob)
    return {
      side,
      base,
      knob,
      pointerId: null,
      originX: 0,
      originY: 0,
      downX: 0,
      downY: 0,
      movedFar: false,
      vecX: 0,
      vecY: 0,
      prevLookX: 0,
    }
  }

  const left = mkStick("left")
  const right = mkStick("right")
  const sticks = [left, right]
  const keys = new Set<string>()

  let lookDelta = 0
  let pendingTap: { x: number; y: number } | null = null
  let enabled = true

  const showStick = (s: Stick, x: number, y: number) => {
    s.originX = x
    s.originY = y
    s.base.style.left = `${x}px`
    s.base.style.top = `${y}px`
    s.base.style.display = "block"
    s.knob.style.left = `${x}px`
    s.knob.style.top = `${y}px`
    s.knob.style.display = "block"
    s.vecX = 0
    s.vecY = 0
    s.prevLookX = 0
  }
  const hideStick = (s: Stick) => {
    s.pointerId = null
    s.movedFar = false
    s.vecX = 0
    s.vecY = 0
    s.prevLookX = 0
    s.base.style.display = "none"
    s.knob.style.display = "none"
  }
  const moveStick = (s: Stick, x: number, y: number) => {
    let dx = x - s.originX
    let dy = y - s.originY
    const len = Math.hypot(dx, dy)
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS
      dy = (dy / len) * RADIUS
    }
    s.knob.style.left = `${s.originX + dx}px`
    s.knob.style.top = `${s.originY + dy}px`
    s.vecX = dx / RADIUS
    s.vecY = dy / RADIUS
  }

  /** find the stick (if any) currently owning this pointerId. */
  const stickFor = (pointerId: number): Stick | null => {
    if (left.pointerId === pointerId) return left
    if (right.pointerId === pointerId) return right
    return null
  }

  const onDown = (e: PointerEvent) => {
    if (!enabled) return
    // NEVER start a stick from a press on interactive chrome. The overlay owns
    // the joystick AND hosts every chrome button (pack, minimap, capsule deep-
    // links, dialogue, challenge) as children. Without this guard, pressing a
    // button bubbles to the overlay, which calls `setPointerCapture` and STEALS
    // the gesture — the button then never receives `pointerup`, so its `click`
    // never fires ("the button does nothing; tapping just works the joystick").
    // One robust target check fixes it for ALL chrome at once — far safer than
    // hoping every element remembers to stopPropagation on pointerdown.
    const tgt = e.target as Element | null
    if (
      tgt &&
      typeof tgt.closest === "function" &&
      tgt.closest('button, a, input, textarea, select, [role="button"], [data-wp-nojoystick]')
    ) {
      return
    }
    const rect = host.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const side: Side = x < rect.width / 2 ? "left" : "right"
    const s = side === "left" ? left : right
    // One stick per half: if this half is already held, ignore the extra finger
    // (prevents a "ghost" second stick and stray taps).
    if (s.pointerId !== null) return

    s.pointerId = e.pointerId
    s.downX = x
    s.downY = y
    s.movedFar = false
    showStick(s, x, y)
    // Keep tracking even if the finger/mouse leaves the overlay mid-drag.
    try {
      host.setPointerCapture(e.pointerId)
    } catch {
      /* capture is best-effort; not all environments allow it */
    }
  }

  const onMove = (e: PointerEvent) => {
    const s = stickFor(e.pointerId)
    if (!s) return
    const rect = host.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    if (Math.hypot(x - s.downX, y - s.downY) > TAP_SLOP) s.movedFar = true
    moveStick(s, x, y)
    if (s.side === "right") {
      lookDelta += (s.vecX - s.prevLookX) * 1.4 + s.vecX * 0.04
      s.prevLookX = s.vecX
    }
  }

  const endPointer = (e: PointerEvent) => {
    const s = stickFor(e.pointerId)
    if (!s) return
    // Quick press without drag → tap (for NPC engagement). Never leaves a stick.
    if (!s.movedFar) {
      const rect = host.getBoundingClientRect()
      pendingTap = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    hideStick(s)
    try {
      host.releasePointerCapture(e.pointerId)
    } catch {
      /* may already be released */
    }
  }

  // lostpointercapture fires if capture is stolen (e.g. browser scroll/gesture);
  // treat it as an end so a stick can never get stuck on screen.
  const onLostCapture = (e: PointerEvent) => {
    const s = stickFor(e.pointerId)
    if (s) hideStick(s)
  }

  host.addEventListener("pointerdown", onDown)
  host.addEventListener("pointermove", onMove)
  host.addEventListener("pointerup", endPointer)
  host.addEventListener("pointercancel", endPointer)
  host.addEventListener("lostpointercapture", onLostCapture)

  const onKeyDown = (e: KeyboardEvent) => keys.add(e.key.toLowerCase())
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase())
  window.addEventListener("keydown", onKeyDown)
  window.addEventListener("keyup", onKeyUp)

  const sample = (): InputSample => {
    if (!enabled) {
      lookDelta = 0
      return { moveX: 0, moveY: 0, lookDelta: 0 }
    }
    // --- move stick: dead-zone + analog magnitude (full tilt = full speed) ---
    let mx = 0
    let my = 0
    const mag = Math.hypot(left.vecX, left.vecY)
    if (mag > DEAD_ZONE) {
      // Re-map [DEAD_ZONE..1] → [0..1] so motion starts gently at the edge of
      // the dead-zone, and ease slightly for an analog feel (not binary).
      const norm = Math.min((mag - DEAD_ZONE) / (1 - DEAD_ZONE), 1)
      const eased = norm * (0.55 + 0.45 * norm) // gentle low-end, full at tilt
      const scale = eased / mag
      mx = left.vecX * scale
      my = -left.vecY * scale // screen-down = backward
    }

    if (keys.has("a") || keys.has("arrowleft")) mx -= 1
    if (keys.has("d") || keys.has("arrowright")) mx += 1
    if (keys.has("w") || keys.has("arrowup")) my += 1
    if (keys.has("s") || keys.has("arrowdown")) my -= 1
    const len = Math.hypot(mx, my)
    if (len > 1) {
      mx /= len
      my /= len
    }

    let kl = 0
    if (keys.has("q")) kl -= 1
    if (keys.has("e")) kl += 1

    const out: InputSample = { moveX: mx, moveY: my, lookDelta: lookDelta + kl * 0.03 }
    lookDelta = 0
    return out
  }

  const setEnabled = (v: boolean) => {
    enabled = v
    if (!v) {
      for (const s of sticks) {
        if (s.pointerId !== null) {
          try {
            host.releasePointerCapture(s.pointerId)
          } catch {
            /* may already be released */
          }
        }
        hideStick(s)
      }
      keys.clear()
      pendingTap = null
      lookDelta = 0
    }
  }

  const input: Input = {
    sample,
    consumeTap: () => {
      const t = pendingTap
      pendingTap = null
      return t
    },
    setEnabled,
    dispose: () => {
      host.removeEventListener("pointerdown", onDown)
      host.removeEventListener("pointermove", onMove)
      host.removeEventListener("pointerup", endPointer)
      host.removeEventListener("pointercancel", endPointer)
      host.removeEventListener("lostpointercapture", onLostCapture)
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      left.base.remove()
      left.knob.remove()
      right.base.remove()
      right.knob.remove()
      delete (window as unknown as { __wpInput?: unknown }).__wpInput
    },
  }

  // --- TEST-ONLY hook (no gameplay logic; pure observability) -------------
  // Exposes stick visibility/vectors so the Playwright control harness can
  // assert "one stick per half" + "hides on release" without screen-scraping.
  // Guarded behind a dev flag so it never participates in shipped behavior.
  const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV
  if (typeof window !== "undefined" && isDev) {
    ;(window as unknown as { __wpInput?: unknown }).__wpInput = {
      sticks: () =>
        sticks.map((s) => ({
          side: s.side,
          active: s.pointerId !== null,
          visible: s.base.style.display !== "none",
          vecX: s.vecX,
          vecY: s.vecY,
        })),
    }
  }

  return input
}
