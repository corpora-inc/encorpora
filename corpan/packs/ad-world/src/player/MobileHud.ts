import type { TouchState } from "./FirstPersonController"

export type MobileHud = {
  updateJoystick(touchState: TouchState): void
  setTargeting(targeting: boolean): void
  dispose(): void
}

export const createMobileHud = (hud: HTMLElement): MobileHud => {
  // Left joystick — ring + knob
  const joystickRing = document.createElement("div")
  joystickRing.className = "aw-joystick-ring"
  hud.appendChild(joystickRing)

  const joystickKnob = document.createElement("div")
  joystickKnob.className = "aw-joystick-knob"
  joystickRing.appendChild(joystickKnob)

  // Interact button — bottom right, only visible when targeting a billboard
  const interactBtn = document.createElement("button")
  interactBtn.className = "aw-interact-btn"
  interactBtn.textContent = "WATCH AD"
  interactBtn.style.display = "none"
  hud.appendChild(interactBtn)

  // Right-side hint — fades out after 3s
  const hint = document.createElement("div")
  hint.className = "aw-look-hint"
  hint.textContent = "DRAG TO LOOK"
  hud.appendChild(hint)

  const hintTimer = setTimeout(() => {
    hint.classList.add("aw-look-hint--fade")
  }, 3000)

  const JOYSTICK_RADIUS = 60

  const updateJoystick = (touchState: TouchState) => {
    if (touchState.moveActive) {
      joystickRing.style.display = "block"
      joystickRing.style.left = `${touchState.moveOrigin.x - JOYSTICK_RADIUS}px`
      joystickRing.style.top = `${touchState.moveOrigin.y - JOYSTICK_RADIUS}px`

      const knobX = touchState.moveKnob.x * JOYSTICK_RADIUS
      const knobY = touchState.moveKnob.y * JOYSTICK_RADIUS
      joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`
    } else {
      joystickRing.style.display = "none"
    }
  }

  let targeting = false
  const setTargeting = (isTargeting: boolean) => {
    if (isTargeting === targeting) return
    targeting = isTargeting
    interactBtn.style.display = isTargeting ? "block" : "none"
  }

  const dispose = () => {
    clearTimeout(hintTimer)
    joystickRing.remove()
    interactBtn.remove()
    hint.remove()
  }

  return { updateJoystick, setTargeting, dispose }
}
