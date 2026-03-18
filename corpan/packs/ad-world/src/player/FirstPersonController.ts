import { Vector3 } from "@babylonjs/core/Maths/math.vector"
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera"
import type { Scene } from "@babylonjs/core/scene"

const MOVE_SPEED = 4.0
const LOOK_SPEED = 0.002
const PLAYER_HEIGHT = 1.7

export type TouchState = {
  /** Whether the move joystick is active */
  moveActive: boolean
  /** Joystick center position (where thumb first touched) */
  moveOrigin: { x: number; y: number }
  /** Current joystick knob offset from origin, normalized -1..1 */
  moveKnob: { x: number; y: number }
}

export type FirstPersonController = {
  camera: UniversalCamera
  touchState: TouchState
  update: (dt: number) => void
  dispose: () => void
}

export const createFirstPersonController = (
  scene: Scene,
  canvas: HTMLCanvasElement,
): FirstPersonController => {
  const camera = new UniversalCamera("fpsCam", new Vector3(0, PLAYER_HEIGHT, 0), scene)
  camera.setTarget(new Vector3(0, PLAYER_HEIGHT, -5))
  camera.minZ = 0.1
  camera.maxZ = 200
  camera.fov = 1.2 // ~69 degrees — comfortable FPS FOV

  // Disable default camera inputs — we handle everything manually
  camera.inputs.clear()

  // Input state
  const keys = new Set<string>()
  let yaw = Math.PI // Start facing -Z
  let pitch = 0

  // Mouse drag state (replaces pointer lock — works in embedded pack context)
  let dragging = false

  // Touch state
  let touchMoveId: number | null = null
  let touchLookId: number | null = null
  let touchMoveStart = { x: 0, y: 0 }
  let touchLookStart = { x: 0, y: 0 }
  let touchMoveDelta = { x: 0, y: 0 }
  let touchLookDelta = { x: 0, y: 0 }

  // Exposed touch state for HUD joystick rendering
  const touchState: TouchState = {
    moveActive: false,
    moveOrigin: { x: 0, y: 0 },
    moveKnob: { x: 0, y: 0 },
  }

  // Keyboard
  const onKeyDown = (e: KeyboardEvent) => {
    keys.add(e.key.toLowerCase())
    e.preventDefault()
  }
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.key.toLowerCase())
  }
  window.addEventListener("keydown", onKeyDown)
  window.addEventListener("keyup", onKeyUp)

  // Mouse drag to look — mousedown starts, mouseup stops
  const onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) {
      dragging = true
      canvas.style.cursor = "grabbing"
    }
  }
  const onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      dragging = false
      canvas.style.cursor = "grab"
    }
  }
  const onMouseMove = (e: MouseEvent) => {
    if (!dragging) return
    yaw -= e.movementX * LOOK_SPEED
    pitch -= e.movementY * LOOK_SPEED
    pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch))
  }
  canvas.style.cursor = "grab"
  canvas.addEventListener("mousedown", onMouseDown)
  window.addEventListener("mouseup", onMouseUp)
  window.addEventListener("mousemove", onMouseMove)

  // Touch controls — left half = move joystick, right half = look
  const JOYSTICK_RADIUS = 60 // pixels — max drag distance for full speed

  const onTouchStart = (e: TouchEvent) => {
    const rect = canvas.getBoundingClientRect()
    const w = rect.width
    for (const t of Array.from(e.changedTouches)) {
      const localX = t.clientX - rect.left
      if (localX < w / 2 && touchMoveId === null) {
        touchMoveId = t.identifier
        touchMoveStart = { x: t.clientX, y: t.clientY }
        touchMoveDelta = { x: 0, y: 0 }
        touchState.moveActive = true
        touchState.moveOrigin = { x: t.clientX - rect.left, y: t.clientY - rect.top }
        touchState.moveKnob = { x: 0, y: 0 }
      } else if (localX >= w / 2 && touchLookId === null) {
        touchLookId = t.identifier
        touchLookStart = { x: t.clientX, y: t.clientY }
        touchLookDelta = { x: 0, y: 0 }
      }
    }
    e.preventDefault()
  }

  const onTouchMove = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === touchMoveId) {
        const rawX = t.clientX - touchMoveStart.x
        const rawY = t.clientY - touchMoveStart.y
        touchMoveDelta = {
          x: rawX / JOYSTICK_RADIUS,
          y: rawY / JOYSTICK_RADIUS,
        }
        touchState.moveKnob = {
          x: Math.max(-1, Math.min(1, rawX / JOYSTICK_RADIUS)),
          y: Math.max(-1, Math.min(1, rawY / JOYSTICK_RADIUS)),
        }
      } else if (t.identifier === touchLookId) {
        const dx = t.clientX - touchLookStart.x
        const dy = t.clientY - touchLookStart.y
        touchLookStart = { x: t.clientX, y: t.clientY }
        touchLookDelta = { x: dx, y: dy }
      }
    }
    e.preventDefault()
  }

  const onTouchEnd = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === touchMoveId) {
        touchMoveId = null
        touchMoveDelta = { x: 0, y: 0 }
        touchState.moveActive = false
        touchState.moveKnob = { x: 0, y: 0 }
      } else if (t.identifier === touchLookId) {
        touchLookId = null
        touchLookDelta = { x: 0, y: 0 }
      }
    }
  }

  canvas.addEventListener("touchstart", onTouchStart, { passive: false })
  canvas.addEventListener("touchmove", onTouchMove, { passive: false })
  canvas.addEventListener("touchend", onTouchEnd)
  canvas.addEventListener("touchcancel", onTouchEnd)

  const update = (dt: number) => {
    // Apply touch look
    if (touchLookDelta.x !== 0 || touchLookDelta.y !== 0) {
      yaw -= touchLookDelta.x * LOOK_SPEED * 2
      pitch -= touchLookDelta.y * LOOK_SPEED * 2
      pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch))
      touchLookDelta = { x: 0, y: 0 }
    }

    // Calculate forward/right vectors from yaw (ignore pitch for movement)
    const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw))
    const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw))

    // Keyboard movement
    const move = Vector3.Zero()
    if (keys.has("w") || keys.has("arrowup")) move.addInPlace(forward)
    if (keys.has("s") || keys.has("arrowdown")) move.subtractInPlace(forward)
    if (keys.has("a") || keys.has("arrowleft")) move.subtractInPlace(right)
    if (keys.has("d") || keys.has("arrowright")) move.addInPlace(right)

    // Touch movement (virtual joystick)
    if (touchMoveId !== null) {
      const clampedX = Math.max(-1, Math.min(1, touchMoveDelta.x))
      const clampedY = Math.max(-1, Math.min(1, touchMoveDelta.y))
      move.addInPlace(forward.scale(-clampedY))
      move.addInPlace(right.scale(clampedX))
    }

    // Apply movement
    if (move.lengthSquared() > 0.001) {
      move.normalize()
      camera.position.addInPlace(move.scale(MOVE_SPEED * dt))
    }

    // Lock Y to player height
    camera.position.y = PLAYER_HEIGHT

    // Clamp to world bounds
    const BOUNDS = 40
    camera.position.x = Math.max(-BOUNDS, Math.min(BOUNDS, camera.position.x))
    camera.position.z = Math.max(-BOUNDS, Math.min(BOUNDS, camera.position.z))

    // Apply look direction from yaw + pitch
    const lookDir = new Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    )
    camera.setTarget(camera.position.add(lookDir))
  }

  const dispose = () => {
    window.removeEventListener("keydown", onKeyDown)
    window.removeEventListener("keyup", onKeyUp)
    canvas.removeEventListener("mousedown", onMouseDown)
    window.removeEventListener("mouseup", onMouseUp)
    window.removeEventListener("mousemove", onMouseMove)
    canvas.removeEventListener("touchstart", onTouchStart)
    canvas.removeEventListener("touchmove", onTouchMove)
    canvas.removeEventListener("touchend", onTouchEnd)
    canvas.removeEventListener("touchcancel", onTouchEnd)
  }

  return { camera, touchState, update, dispose }
}
