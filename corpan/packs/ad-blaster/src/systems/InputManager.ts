import type { Scene } from "@babylonjs/core"
import type { InputSnapshot } from "../core/types"
import { ARENA_HALF_WIDTH, ARENA_HALF_HEIGHT } from "../core/constants"

export type InputManager = {
  snapshot: () => InputSnapshot
  setScene: (scene: Scene) => void
  dispose: () => void
}

export const createInputManager = (canvas: HTMLCanvasElement): InputManager => {
  let targetX = 0
  let targetY = 0
  let hasTarget = false
  let tapOnAd = false
  let tapAdId: string | null = null

  let scene: Scene | null = null

  // WASD for dev keyboard control
  const keys = new Set<string>()
  let keyDirX = 0
  let keyDirY = 0

  const onKeyDown = (e: KeyboardEvent) => {
    keys.add(e.code)
  }
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code)
  }
  window.addEventListener("keydown", onKeyDown)
  window.addEventListener("keyup", onKeyUp)

  const screenToWorld = (clientX: number, clientY: number): { x: number; y: number } => {
    const cam = scene?.activeCamera
    if (!cam) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const nx = (clientX - rect.left) / rect.width
    const ny = (clientY - rect.top) / rect.height

    // Direct trig from camera params — no dependency on Babylon's coordinate pipeline
    const dist = Math.abs(cam.position.z)
    const halfH = Math.tan(cam.fov / 2) * dist
    const halfW = halfH * (rect.width / rect.height)

    return {
      x: (nx - 0.5) * 2 * halfW,
      y: -(ny - 0.5) * 2 * halfH,
    }
  }

  // Pointer events: unified mouse+touch, fires before Babylon can suppress
  let pointerDown = false
  const onPointerDown = (e: PointerEvent) => {
    pointerDown = true
    const world = screenToWorld(e.clientX, e.clientY)
    targetX = world.x
    targetY = world.y
    hasTarget = true
  }
  const onPointerMove = (e: PointerEvent) => {
    if (!pointerDown) return
    const world = screenToWorld(e.clientX, e.clientY)
    targetX = world.x
    targetY = world.y
  }
  const onPointerUp = () => {
    pointerDown = false
  }
  canvas.addEventListener("pointerdown", onPointerDown)
  canvas.addEventListener("pointermove", onPointerMove)
  window.addEventListener("pointerup", onPointerUp)

  const snapshot = (): InputSnapshot => {
    // Keyboard: WASD direct movement
    keyDirX = 0
    keyDirY = 0
    if (keys.has("KeyA") || keys.has("ArrowLeft")) keyDirX -= 1
    if (keys.has("KeyD") || keys.has("ArrowRight")) keyDirX += 1
    if (keys.has("KeyW") || keys.has("ArrowUp")) keyDirY += 1
    if (keys.has("KeyS") || keys.has("ArrowDown")) keyDirY -= 1

    const keyboardActive = keyDirX !== 0 || keyDirY !== 0

    if (keyboardActive) {
      // Normalize diagonal movement
      const len = Math.sqrt(keyDirX * keyDirX + keyDirY * keyDirY)
      if (len > 0) {
        keyDirX /= len
        keyDirY /= len
      }
      // Set target far in that direction
      targetX = keyDirX * ARENA_HALF_WIDTH * 2
      targetY = keyDirY * ARENA_HALF_HEIGHT * 2
      hasTarget = true
    }

    const result: InputSnapshot = {
      targetX,
      targetY,
      hasTarget: hasTarget || keyboardActive,
      tapOnAd,
      tapAdId,
    }

    // Clear ad tap state after building snapshot to prevent repeated firing
    tapOnAd = false
    tapAdId = null

    return result
  }

  const setScene = (s: Scene) => {
    scene = s
  }

  const dispose = () => {
    window.removeEventListener("keydown", onKeyDown)
    window.removeEventListener("keyup", onKeyUp)
    canvas.removeEventListener("pointerdown", onPointerDown)
    canvas.removeEventListener("pointermove", onPointerMove)
    window.removeEventListener("pointerup", onPointerUp)
  }

  return { snapshot, setScene, dispose }
}
