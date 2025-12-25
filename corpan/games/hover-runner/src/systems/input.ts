import { getSfx } from "../audio"
import { tuningStore } from "../tuningStore"
import { clamp } from "../core/utils"
import type { InputState } from "../core/types"

export const initInput = (
  canvas: HTMLCanvasElement,
  tiltButton: HTMLButtonElement
) => {
  const state: InputState = {
    row: 2,
    col: 0,
    tiltEnabled: false,
    tiltActive: false,
    tiltX: 0,
    tiltY: 0,
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
    state.tiltX = clamp(event.gamma / 16, -1, 1)
    const minPitch = 52
    const maxPitch = 62
    const pitch = clamp(event.beta, minPitch, maxPitch)
    const normalized = (pitch - minPitch) / (maxPitch - minPitch)
    state.tiltY = normalized * 2 - 1
  }

  const enableTilt = () => {
    if (state.tiltEnabled) {
      return
    }
    state.tiltEnabled = true
    tiltButton.textContent = "Motion Active"
    window.addEventListener("deviceorientation", orientationHandler)
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

  const dispose = () => {
    window.removeEventListener("keydown", onKey)
    canvas.removeEventListener("pointerdown", onPointer)
    window.removeEventListener("deviceorientation", orientationHandler)
    tiltButton.removeEventListener("click", requestTilt)
  }

  return { state, dispose }
}
