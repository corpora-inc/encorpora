import { getSfx } from "../audio"
import { tuningStore } from "../tuningStore"
import { clamp } from "../core/utils"
import type { InputState } from "../core/types"

export const initInput = (
  canvas: HTMLCanvasElement,
  tiltButton: HTMLButtonElement | null
) => {
  const state: InputState = {
    row: 2,
    col: 0,
    tiltEnabled: false,
    tiltActive: false,
    tiltX: 0,
    tiltY: 0,
  }

  // Smoothing state for motion input
  let smoothedX = 0
  let smoothedY = 0
  const DEAD_ZONE = 0.08 // Ignore changes smaller than this
  const SMOOTHING_FACTOR_SMALL = 0.15 // Strong smoothing for small movements
  const SMOOTHING_FACTOR_LARGE = 0.4 // Light smoothing for large movements
  const LARGE_MOVEMENT_THRESHOLD = 0.3 // Threshold to detect intentional large movements

  // Detect iOS/Safari
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Mac") && "ontouchend" in document)

  // Screen orientation detection for sensor remapping
  const getScreenOrientation = (): number => {
    let angle = 0
    // Try modern API first
    if (typeof window !== "undefined" && window.screen?.orientation?.angle != null) {
      angle = window.screen.orientation.angle
    }
    // Fallback to deprecated API
    else if (typeof window !== "undefined" && (window as typeof window & { orientation?: number }).orientation != null) {
      angle = (window as typeof window & { orientation?: number }).orientation ?? 0
    }

    // iOS reports angles in reverse: when device is portrait, it says 90°
    // When device is landscape, it says 0° or 180°
    // So we need to invert the mapping for iOS
    if (isIOS) {
      if (angle === 0) return 90  // iOS portrait = our landscape-right
      if (angle === 90) return 0  // iOS landscape-right = our portrait
      if (angle === 180) return 270  // iOS portrait-inverted = our landscape-left
      if (angle === 270 || angle === -90) return 180  // iOS landscape-left = our portrait-inverted
    }

    return angle
  }

  const onKey = (event: KeyboardEvent) => {
    // Start music on first keyboard interaction (if not already playing)
    const audio = getSfx()
    if (tuningStore.getState().settings.musicEnabled && !audio.isMusicPlaying()) {
      audio.unlock()
      audio.playMusic()
    }

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
  }

  const onPointer = (event: PointerEvent) => {
    // Start music on first canvas interaction (if not already playing)
    const audio = getSfx()
    if (tuningStore.getState().settings.musicEnabled && !audio.isMusicPlaying()) {
      audio.unlock()
      audio.playMusic()
    }

    const rect = canvas.getBoundingClientRect()
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
  }

  const orientationHandler = (event: DeviceOrientationEvent) => {
    if (event.gamma == null || event.beta == null) {
      return
    }
    state.tiltActive = true

    // Get screen orientation and remap sensor axes accordingly
    const screenAngle = getScreenOrientation()
    console.log("[ORIENTATION] screenAngle:", screenAngle, "gamma:", event.gamma.toFixed(1), "beta:", event.beta.toFixed(1))
    let rawX = 0
    let rawY = 0

    // Remap axes based on device orientation
    // Portrait (0°): gamma = X (left/right), beta = Y (forward/back)
    // Landscape-right (90°): beta = X, -gamma = Y (flipped for iOS)
    // Portrait-inverted (180°): -gamma = X, -beta = Y
    // Landscape-left (270°): -beta = X, gamma = Y (flipped for iOS)
    if (screenAngle === 90) {
      // Landscape-right (flipped for iOS)
      console.log("[ORIENTATION] Using landscape-right mapping")
      rawX = event.beta
      rawY = -event.gamma
    } else if (screenAngle === 180) {
      // Portrait-inverted
      console.log("[ORIENTATION] Using portrait-inverted mapping")
      rawX = -event.gamma
      rawY = -event.beta
    } else if (screenAngle === 270 || screenAngle === -90) {
      // Landscape-left (flipped for iOS)
      console.log("[ORIENTATION] Using landscape-left mapping")
      rawX = -event.beta
      rawY = event.gamma
    } else {
      // Portrait (0° or default)
      console.log("[ORIENTATION] Using portrait mapping")
      rawX = event.gamma
      rawY = event.beta
    }
    console.log("[ORIENTATION] rawX:", rawX.toFixed(1), "rawY:", rawY.toFixed(1))

    // Calculate target values from remapped sensors
    const targetX = clamp(rawX / 16, -1, 1)
    const minPitch = 52
    const maxPitch = 62
    const pitch = clamp(rawY, minPitch, maxPitch)
    const normalized = (pitch - minPitch) / (maxPitch - minPitch)
    const targetY = normalized * 2 - 1

    // Apply smart smoothing with dead zone
    const deltaX = Math.abs(targetX - smoothedX)
    const deltaY = Math.abs(targetY - smoothedY)

    // Dead zone: ignore tiny movements (jitter from hand shake)
    if (deltaX > DEAD_ZONE) {
      // Adaptive smoothing: use less smoothing for large intentional movements
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

    // Update state with smoothed values
    state.tiltX = clamp(smoothedX, -1, 1)
    state.tiltY = clamp(smoothedY, -1, 1)
  }

  const onOrientationChange = () => {
    // Reset smoothed values when orientation changes to avoid jarring transitions
    smoothedX = 0
    smoothedY = 0
  }

  const enableTilt = () => {
    if (state.tiltEnabled) {
      return
    }
    state.tiltEnabled = true
    if (tiltButton) {
      tiltButton.textContent = "Motion Active"
    }
    // Initialize smoothed values to current state to avoid jump
    smoothedX = state.tiltX
    smoothedY = state.tiltY
    window.addEventListener("deviceorientation", orientationHandler)
    // Listen for screen orientation changes
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener("change", onOrientationChange)
    } else {
      // Fallback for older browsers
      window.addEventListener("orientationchange", onOrientationChange)
    }
  }

  const requestTilt = async () => {
    const requestPermission = (
      DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<"granted" | "denied">
      }
    ).requestPermission

    if (typeof requestPermission === "function") {
      try {
        const result = await requestPermission()
        if (result === "granted") {
          enableTilt()
        }
      } catch {
        // Ignore permission failures.
      }
    } else {
      enableTilt()
    }
  }

  window.addEventListener("keydown", onKey)
  canvas.addEventListener("pointerdown", onPointer)
  if (tiltButton) {
    tiltButton.addEventListener("click", requestTilt)
    const prefersTilt =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(pointer: coarse)").matches
    if (
      prefersTilt &&
      !(DeviceOrientationEvent as unknown as { requestPermission?: unknown })
        .requestPermission
    ) {
      enableTilt()
    }
  }

  const dispose = () => {
    window.removeEventListener("keydown", onKey)
    canvas.removeEventListener("pointerdown", onPointer)
    window.removeEventListener("deviceorientation", orientationHandler)
    // Clean up orientation change listeners
    if (window.screen?.orientation) {
      window.screen.orientation.removeEventListener("change", onOrientationChange)
    } else {
      window.removeEventListener("orientationchange", onOrientationChange)
    }
    if (tiltButton) {
      tiltButton.removeEventListener("click", requestTilt)
    }
  }

  return { state, dispose }
}
