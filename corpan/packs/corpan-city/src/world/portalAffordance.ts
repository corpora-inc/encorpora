import type { WorldEngine } from "./engine"
import { Vector3, Matrix } from "@babylonjs/core/Maths/math"
import { Viewport } from "@babylonjs/core/Maths/math.viewport"

/**
 * Portal affordance — the city's "ENTER this place" prompt, the vignette twin of
 * the NPC Talk button. Walk near a portal anchor (a taxi rank, a café door) and a
 * dignified prompt floats over the spot + a labelled button rises above the thumb;
 * tapping it ENTERS the vignette bound to that anchor.
 *
 * This MIRRORS `world/npcFocus.ts` (same proximity model, same screen projection,
 * same joystick-steals-taps discipline — the button swallows pointer events,
 * GAME_DEV_PLAYBOOK §3.1) but for a STATIC topology anchor instead of a wandering
 * NPC. It owns its own scoped `.wp-portal-*` CSS (injected once, never touches the
 * shared `styles.css`) so the integration adds no styles to the global sheet.
 *
 * The label is fully localized (injected `label`) and the affordance is ≥44px,
 * reduced-motion safe (the pulse is dropped under `prefers-reduced-motion`).
 */

const RANGE = 4.0 // world units the player must be within to surface the portal
const HEAD_Y = 2.4 // world height of the floating prompt above the rank

/** A single portal: an anchor position + the label + what to do on enter. */
export interface PortalSpec {
  anchorId: string
  /** Live world position of the rank (read every frame — anchors are static). */
  pos: { x: number; z: number }
  /** The localized affordance label (e.g. "Take a taxi"). */
  label: string
  /** Fired when the player taps Enter (the orchestrator runs the vignette). */
  onEnter: (anchorId: string) => void
}

export interface PortalAffordance {
  /** Proximity tick — surfaces/hides the prompt+button by distance + tap-on-spot. */
  update: (player: { x: number; z: number }, tap: { x: number; y: number } | null) => void
  /** Suppress the affordance entirely (while a vignette/dialogue owns the screen). */
  setEnabled: (enabled: boolean) => void
  dispose: () => void
}

let stylesInjected = false
function ensureStyles(): void {
  if (stylesInjected || typeof document === "undefined") return
  stylesInjected = true
  const style = document.createElement("style")
  style.setAttribute("data-wp-portal", "")
  // Mirrors `.wp-prompt` / `.wp-interact` but in the `.wp-portal-*` namespace and
  // tinted toward "a place to enter" (cool slate) rather than "a person to talk to".
  style.textContent = `
.wp-portal-prompt {
  position: absolute; z-index: 15; line-height: 1;
  font: 700 13px/1 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.02em; color: #2a3a4d;
  padding: 7px 11px; border-radius: 14px 14px 14px 4px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 6px 16px rgba(20, 50, 63, 0.22);
  pointer-events: none; transform: translate(-50%, -100%);
  animation: wp-portal-bob 0.9s ease-in-out infinite alternate;
}
@keyframes wp-portal-bob {
  from { transform: translate(-50%, -100%); }
  to { transform: translate(-50%, -126%); }
}
.wp-portal-btn {
  position: absolute; z-index: 16;
  bottom: calc(92px + env(safe-area-inset-bottom, 0px));
  left: 50%; transform: translateX(-50%);
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  min-height: 48px; padding: 13px clamp(24px, 3vw, 32px);
  border: none; border-radius: 999px;
  background: linear-gradient(180deg, #8fc6e6, #4f86b6);
  color: #0f2433;
  font: 700 clamp(15px, 0.7vw + 13px, 18px) / 1 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.01em;
  box-shadow: 0 8px 22px rgba(30, 80, 120, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.6);
  pointer-events: auto; cursor: pointer; -webkit-tap-highlight-color: transparent;
  animation: wp-portal-pulse 1.3s ease-in-out infinite;
}
.wp-portal-btn:active { transform: translateX(-50%) scale(0.95); }
@keyframes wp-portal-pulse {
  0%, 100% { box-shadow: 0 8px 22px rgba(30, 80, 120, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.6); }
  50% { box-shadow: 0 8px 30px rgba(79, 134, 182, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.6); }
}
@media (hover: hover) and (pointer: fine) {
  .wp-portal-btn { transition: transform 0.12s ease, filter 0.16s ease; }
  .wp-portal-btn:hover { filter: brightness(1.05); }
}
@media (max-width: 540px) {
  .wp-portal-btn { min-height: 52px; bottom: calc(84px + env(safe-area-inset-bottom, 0px)); }
}
@media (prefers-reduced-motion: reduce) {
  .wp-portal-prompt, .wp-portal-btn { animation: none; }
}
`
  document.head.appendChild(style)
}

/**
 * Create the portal affordance for ONE rank. Surfaces a prompt + an Enter button
 * when the player is within `RANGE` of the anchor; a tap on the rank (or the
 * button) fires `onEnter`. The orchestrator suppresses it (`setEnabled(false)`)
 * whenever a vignette is active so nothing re-triggers mid-scene.
 */
export function createPortalAffordance(
  world: WorldEngine,
  overlay: HTMLElement,
  portal: PortalSpec,
): PortalAffordance {
  ensureStyles()

  const prompt = document.createElement("div")
  prompt.className = "wp-portal-prompt"
  prompt.textContent = portal.label
  prompt.style.display = "none"
  overlay.appendChild(prompt)

  const btn = document.createElement("button")
  btn.type = "button"
  btn.className = "wp-portal-btn"
  btn.textContent = portal.label
  btn.style.display = "none"
  overlay.appendChild(btn)

  let enabled = true
  let enterReq = false
  // The joystick-steals-taps rule (GAME_DEV_PLAYBOOK §3.1): the button must
  // swallow its own pointer events so they never bleed into the look/move sticks.
  const onBtnDown = (e: Event) => {
    e.stopPropagation()
    e.preventDefault()
    if (enabled) enterReq = true
  }
  const stop = (e: Event) => e.stopPropagation()
  btn.addEventListener("pointerdown", onBtnDown)
  btn.addEventListener("pointerup", stop)

  const hide = () => {
    prompt.style.display = "none"
    btn.style.display = "none"
  }

  const project = (x: number, y: number, z: number) => {
    const e = world.engine
    const hw = e.getHardwareScalingLevel()
    const p = Vector3.Project(
      new Vector3(x, y, z),
      Matrix.Identity(),
      world.scene.getTransformMatrix(),
      new Viewport(0, 0, e.getRenderWidth(), e.getRenderHeight()),
    )
    return { x: p.x * hw, y: p.y * hw, inFront: p.z > 0 && p.z < 1 }
  }

  const update: PortalAffordance["update"] = (player, tap) => {
    if (!enabled) {
      hide()
      enterReq = false
      return
    }
    const dx = portal.pos.x - player.x
    const dz = portal.pos.z - player.z
    const near = dx * dx + dz * dz < RANGE * RANGE
    if (!near) {
      hide()
      enterReq = false
      return
    }
    const sp = project(portal.pos.x, HEAD_Y, portal.pos.z)
    if (sp.inFront) {
      prompt.style.display = "block"
      prompt.style.left = `${sp.x}px`
      prompt.style.top = `${sp.y}px`
      btn.style.display = "inline-flex"
      // A tap on/near the rank counts as Enter (mirrors npcFocus's tap-on-NPC).
      if (tap) {
        const ddx = tap.x - sp.x
        const ddy = tap.y - sp.y
        if (ddx * ddx + ddy * ddy < 90 * 90) enterReq = true
      }
    } else {
      hide()
    }
    if (enterReq) {
      enterReq = false
      portal.onEnter(portal.anchorId)
    }
  }

  return {
    update,
    setEnabled: (v: boolean) => {
      enabled = v
      if (!v) {
        hide()
        enterReq = false
      }
    },
    dispose: () => {
      btn.removeEventListener("pointerdown", onBtnDown)
      btn.removeEventListener("pointerup", stop)
      prompt.remove()
      btn.remove()
    },
  }
}
