import { getSfx } from "../audio"
import { triggerHaptic } from "../haptics"
import { tuningStore } from "../tuningStore"
import { clamp } from "../core/utils"
import type { InputState } from "../core/types"

/**
 * Reactive state of the device-orientation input.
 *
 * - `off`      — user has not enabled tilt (toggle off)
 * - `pending`  — iOS only: permission prompt is being requested
 * - `active`   — listener attached AND at least one event arrived
 * - `waiting`  — listener attached but no event yet (Android/desktop typically skip straight to active)
 * - `denied`   — iOS permission prompt was rejected
 * - `error`    — last requestTilt() threw
 */
export type TiltState =
  | "off"
  | "pending"
  | "active"
  | "waiting"
  | "denied"
  | "error"

export type InputApi = ReturnType<typeof initInput>

export const initInput = (
  canvas: HTMLCanvasElement,
  hooks: { onTiltStateChange?: (state: TiltState) => void } = {},
) => {
  const state: InputState = {
    row: 2,
    col: 0,
    tiltEnabled: false,
    tiltActive: false,
    tiltX: 0,
    tiltY: 0,
  }

  // Lane/row change haptic. Fired only when the discrete lane (col) or row
  // actually changes, and DEBOUNCED so rapid input (or repeated key events)
  // can't machine-gun the vibration motor. `triggerHaptic` itself is gated by
  // the `hapticsEnabled` setting and is a silent no-op off-device.
  const LANE_HAPTIC_DEBOUNCE_MS = 60
  let lastLaneHapticAt = 0
  const fireLaneChangeHaptic = () => {
    const now =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now()
    if (now - lastLaneHapticAt < LANE_HAPTIC_DEBOUNCE_MS) return
    lastLaneHapticAt = now
    triggerHaptic("selection")
  }

  let tiltState: TiltState = "off"
  function setTiltState(next: TiltState) {
    if (next === tiltState) return
    tiltState = next
    hooks.onTiltStateChange?.(next)
  }

  // Monotonic counter for outstanding permission requests. If the user
  // dismisses the overlay (or otherwise calls `disableTilt`) while a
  // `requestPermission` promise is still pending, we don't want the
  // late "granted" resolution to silently re-enable tilt and overwrite
  // their choice. Each `requestTilt` captures the current seq and
  // bails if it has changed by the time the promise resolves.
  let tiltRequestSeq = 0

  // Smoothing state for motion input
  let smoothedX = 0
  let smoothedY = 0
  const DEAD_ZONE = 0.08
  const SMOOTHING_FACTOR_SMALL = 0.15
  const SMOOTHING_FACTOR_LARGE = 0.4
  const LARGE_MOVEMENT_THRESHOLD = 0.3

  type ScreenOrientationType =
    | "portrait-primary"
    | "portrait-secondary"
    | "landscape-primary"
    | "landscape-secondary"

  const getScreenOrientation = (): ScreenOrientationType => {
    const orientation = window.screen?.orientation
    if (orientation?.type) {
      const type = orientation.type
      if (
        type === "portrait-primary" ||
        type === "portrait-secondary" ||
        type === "landscape-primary" ||
        type === "landscape-secondary"
      ) {
        return type
      }
    }
    let angle = 0
    if (orientation?.angle != null) {
      angle = orientation.angle
    } else if ((window as typeof window & { orientation?: number }).orientation != null) {
      angle = (window as typeof window & { orientation?: number }).orientation ?? 0
    }

    let isPortrait: boolean | null = null
    if (window.matchMedia) {
      isPortrait = window.matchMedia("(orientation: portrait)").matches
    }
    if (isPortrait == null && orientation?.type) {
      isPortrait = orientation.type.startsWith("portrait")
    }
    if (isPortrait == null) {
      isPortrait = window.innerHeight >= window.innerWidth
    }

    const normalizedAngle = ((angle % 360) + 360) % 360
    if (isPortrait) {
      if (normalizedAngle === 180 || normalizedAngle === 270) {
        return "portrait-secondary"
      }
      return "portrait-primary"
    }

    if (normalizedAngle === 180 || normalizedAngle === 270) {
      return "landscape-secondary"
    }
    return "landscape-primary"
  }

  const onKey = (event: KeyboardEvent) => {
    const audio = getSfx()
    if (tuningStore.getState().settings.musicEnabled && !audio.isMusicPlaying()) {
      audio.unlock()
      audio.playMusic()
    }

    const prevRow = state.row
    const prevCol = state.col

    if (event.key === "ArrowUp" || event.key === "w") {
      state.row = clamp(state.row - 1, 0, 2)
    }
    if (event.key === "ArrowDown" || event.key === "s") {
      state.row = clamp(state.row + 1, 0, 2)
    }
    if (event.key === "ArrowLeft" || event.key === "a") {
      state.col = 0
    }
    if (event.key === "ArrowRight" || event.key === "d") {
      state.col = 1
    }

    if (state.row !== prevRow || state.col !== prevCol) {
      fireLaneChangeHaptic()
    }
  }

  const onPointer = (event: PointerEvent) => {
    if (!canvas.isConnected || !canvas.offsetParent) {
      return
    }

    const rect = canvas.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      return
    }

    const audio = getSfx()
    if (tuningStore.getState().settings.musicEnabled && !audio.isMusicPlaying()) {
      audio.unlock()
      audio.playMusic()
    }

    const prevRow = state.row
    const prevCol = state.col

    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    state.col = x < rect.width / 2 ? 0 : 1
    if (y < rect.height / 3) {
      state.row = 0
    } else if (y < (rect.height * 2) / 3) {
      state.row = 1
    } else {
      state.row = 2
    }

    if (state.row !== prevRow || state.col !== prevCol) {
      fireLaneChangeHaptic()
    }
  }

  const orientationHandler = (event: DeviceOrientationEvent) => {
    if (event.gamma == null || event.beta == null) {
      return
    }
    state.tiltActive = true
    // First event arriving means we've gone from "waiting" → "active".
    if (tiltState === "waiting" || tiltState === "pending") {
      setTiltState("active")
    }

    const screenOrientation = getScreenOrientation()
    let rawX = 0
    let rawY = 0

    switch (screenOrientation) {
      case "landscape-primary":
        rawX = event.beta
        rawY = -event.gamma
        break
      case "landscape-secondary":
        rawX = -event.beta
        rawY = event.gamma
        break
      case "portrait-secondary":
        rawX = -event.gamma
        rawY = -event.beta
        break
      default:
        rawX = event.gamma
        rawY = event.beta
        break
    }

    const targetX = clamp(rawX / 16, -1, 1)
    const minPitch = 52
    const maxPitch = 62
    const pitch = clamp(rawY, minPitch, maxPitch)
    const normalized = (pitch - minPitch) / (maxPitch - minPitch)
    const targetY = normalized * 2 - 1

    const deltaX = Math.abs(targetX - smoothedX)
    const deltaY = Math.abs(targetY - smoothedY)

    if (deltaX > DEAD_ZONE) {
      const factorX = deltaX > LARGE_MOVEMENT_THRESHOLD
        ? SMOOTHING_FACTOR_LARGE
        : SMOOTHING_FACTOR_SMALL
      smoothedX += (targetX - smoothedX) * factorX
    }

    if (deltaY > DEAD_ZONE) {
      const factorY = deltaY > LARGE_MOVEMENT_THRESHOLD
        ? SMOOTHING_FACTOR_LARGE
        : SMOOTHING_FACTOR_SMALL
      smoothedY += (targetY - smoothedY) * factorY
    }

    state.tiltX = clamp(smoothedX, -1, 1)
    state.tiltY = clamp(smoothedY, -1, 1)
  }

  const onOrientationChange = () => {
    smoothedX = 0
    smoothedY = 0
  }

  const enableTilt = () => {
    if (state.tiltEnabled) {
      return
    }
    state.tiltEnabled = true
    smoothedX = state.tiltX
    smoothedY = state.tiltY
    window.addEventListener("deviceorientation", orientationHandler)
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener("change", onOrientationChange)
    } else {
      window.addEventListener("orientationchange", onOrientationChange)
    }
    // No event has fired yet — sit in `waiting` until the first
    // `deviceorientation` arrives (which flips us to `active`).
    setTiltState("waiting")
  }

  const disableTilt = () => {
    // Invalidate any in-flight permission request so a late `granted`
    // resolution doesn't re-enable tilt after the user explicitly
    // turned it off (or dismissed the iOS overlay).
    tiltRequestSeq += 1
    if (!state.tiltEnabled) {
      // Even if we never enabled (because permission flow is in flight),
      // make sure we land back at `off` so the UI doesn't get stuck.
      if (tiltState !== "off") setTiltState("off")
      return
    }
    state.tiltEnabled = false
    state.tiltActive = false
    window.removeEventListener("deviceorientation", orientationHandler)
    if (window.screen?.orientation) {
      window.screen.orientation.removeEventListener("change", onOrientationChange)
    } else {
      window.removeEventListener("orientationchange", onOrientationChange)
    }
    setTiltState("off")
  }

  /**
   * Kick off tilt synchronously from inside a user-gesture handler.
   *
   * iOS / WebKit gotchas this routine works around:
   *
   *   1. `DeviceOrientationEvent.requestPermission()` MUST be dispatched
   *      as a method on `DeviceOrientationEvent` itself. Older
   *      WebKit builds (iOS 16, some WKWebView versions) reject with
   *      `NotAllowedError` when called via an extracted reference —
   *      so we never destructure `requestPermission` into a local.
   *
   *   2. The call must land on the user-gesture tick. We never
   *      `await` or do any async work before invoking it.
   *
   *   3. The promise's resolution arrives on a later microtask after
   *      the prompt is dismissed; gesture context is gone by then,
   *      which is fine — `enableTilt()` just attaches event listeners.
   *
   * Returns immediately. Subscribe to `onTiltStateChange` for the outcome.
   */
  const requestTilt = (): void => {
    const requestSeq = ++tiltRequestSeq
    type DOEStatic = {
      requestPermission?: () => Promise<"granted" | "denied">
    }
    // Read through globalThis so an unsupported browser (no
    // `DeviceOrientationEvent` global) throws `undefined.requestPermission`
    // a few lines down rather than `ReferenceError` here, which the
    // existing try/catch can't catch.
    const DOE = (globalThis as unknown as {
      DeviceOrientationEvent?: DOEStatic
    }).DeviceOrientationEvent

    if (!DOE) {
      setTiltState("error")
      return
    }

    if (typeof DOE.requestPermission !== "function") {
      enableTilt()
      return
    }

    // Method dispatch (DOE.requestPermission()) — DO NOT extract.
    // Critical: call this BEFORE any other work in this function so
    // the user-gesture/activation context is as fresh as possible.
    let promise: Promise<"granted" | "denied">
    try {
      promise = DOE.requestPermission()
    } catch (err) {
      console.error("[hover-runner] requestPermission threw synchronously:", err)
      setTiltState("error")
      return
    }

    setTiltState("pending")
    promise
      .then((result) => {
        // A later disableTilt() or requestTilt() bumps the seq — if
        // ours is no longer current, the user has moved on and we
        // must not stomp their state.
        if (requestSeq !== tiltRequestSeq) return
        if (result === "granted") {
          enableTilt()
        } else if (result === "denied") {
          // WebKit does not give us a reliable way to distinguish a
          // fresh deny from a remembered deny. Don't invent certainty
          // from timing; let the UI offer retry + touch fallback.
          setTiltState("denied")
        } else {
          console.warn("[hover-runner] requestPermission unexpected result:", result)
          setTiltState("denied")
        }
      })
      .catch((err: unknown) => {
        if (requestSeq !== tiltRequestSeq) return
        console.error("[hover-runner] requestPermission rejected:", err)
        setTiltState("error")
      })
  }

  window.addEventListener("keydown", onKey)
  canvas.addEventListener("pointerdown", onPointer)

  const dispose = () => {
    window.removeEventListener("keydown", onKey)
    canvas.removeEventListener("pointerdown", onPointer)
    disableTilt()
  }

  return {
    state,
    dispose,
    enableTilt,
    disableTilt,
    requestTilt,
    getTiltState: () => tiltState,
  }
}
