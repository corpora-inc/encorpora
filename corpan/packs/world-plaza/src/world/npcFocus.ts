import type { WorldEngine } from "./engine"
import { Vector3, Matrix } from "@babylonjs/core/Maths/math"
import { Viewport } from "@babylonjs/core/Maths/math.viewport"

/**
 * Premium NPC engagement: proximity auto-focus instead of pixel-hunting a
 * billboard (Babylon can't reliably pick yaw-billboarded planes anyway). Walk
 * near an NPC → it highlights with a juicy pulse, a bobbing 💬 prompt floats
 * over its head, and a "Talk" button rises above the thumb. Engage via the
 * button, a tap on/near the NPC, or E/Space.
 *
 * Targets are DYNAMIC: it reads each candidate's LIVE world position every
 * frame, so it focuses the nearest WANDERING crowd agent (not a static list).
 * The focus target only needs a live position + a scale-pulse hook.
 */

const RANGE = 4.0 // world units the player must be within to focus an NPC
const HEAD_Y = 3.0 // world height of the floating prompt above an NPC
const ENGAGE_COOLDOWN = 0.6

/** Minimal contract a focusable must satisfy (crowd's CrowdFocusHandle fits). */
export interface FocusTarget {
  anchorId: string
  billboard: {
    root: { position: { x: number; y: number; z: number } }
    setScale: (s: number) => void
  }
}

export interface NpcFocus {
  update: (dt: number, player: { x: number; z: number }, tap: { x: number; y: number } | null) => void
  getFocused: () => FocusTarget | null
  /** Pause focus + engage (E/Space/tap) while a modal overlay is open. */
  setEnabled: (enabled: boolean) => void
  dispose: () => void
}

export function createNpcFocus(
  world: WorldEngine,
  overlay: HTMLElement,
  npcs: FocusTarget[],
  onEngage: (it: FocusTarget) => void,
  /** Fires whenever the focused target changes (incl. → null). Lets the caller
   *  freeze the focused NPC in place so it waits for you instead of wandering. */
  onFocusChange?: (it: FocusTarget | null) => void,
): NpcFocus {
  const prompt = document.createElement("div")
  prompt.className = "wp-prompt"
  prompt.textContent = "💬"
  prompt.style.display = "none"
  overlay.appendChild(prompt)

  const btn = document.createElement("button")
  btn.className = "wp-interact"
  btn.innerHTML = "<span class='wp-interact-ico'>💬</span><span>Talk</span>"
  btn.style.display = "none"
  overlay.appendChild(btn)

  let enabled = true
  let engageReq = false
  const onBtnDown = (e: Event) => {
    e.stopPropagation()
    e.preventDefault()
    if (enabled) engageReq = true
  }
  const stop = (e: Event) => e.stopPropagation()
  btn.addEventListener("pointerdown", onBtnDown)
  btn.addEventListener("pointerup", stop)
  // NOTE: no keyboard engage. `e`/`q` belong to camera-look (input.ts), and a
  // keyboard "activate" key double-booked with movement caused the bugs. Engage
  // is the Talk button or a tap on the NPC only.

  let focused: FocusTarget | null = null
  let pulseT = 0
  let cooldown = 0

  const hideAffordances = () => {
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

  const setFocus = (it: FocusTarget | null) => {
    if (focused === it) return
    if (focused) focused.billboard.setScale(1)
    focused = it
    pulseT = 0
    onFocusChange?.(it)
  }

  const update: NpcFocus["update"] = (dt, player, tap) => {
    if (!enabled) {
      if (focused) setFocus(null)
      hideAffordances()
      engageReq = false
      return
    }
    if (cooldown > 0) cooldown -= dt

    let best: FocusTarget | null = null
    let bestD = RANGE * RANGE
    for (const it of npcs) {
      const dx = it.billboard.root.position.x - player.x
      const dz = it.billboard.root.position.z - player.z
      const d = dx * dx + dz * dz
      if (d < bestD) {
        bestD = d
        best = it
      }
    }
    setFocus(best)

    if (focused) {
      pulseT += dt
      focused.billboard.setScale(1 + Math.sin(pulseT * 5) * 0.04)
      const pos = focused.billboard.root.position
      const sp = project(pos.x, HEAD_Y, pos.z)
      if (sp.inFront) {
        prompt.style.display = "block"
        prompt.style.left = `${sp.x}px`
        prompt.style.top = `${sp.y}px`
        btn.style.display = "inline-flex"
        if (tap) {
          const ddx = tap.x - sp.x
          const ddy = tap.y - sp.y
          if (ddx * ddx + ddy * ddy < 90 * 90) engageReq = true
        }
      } else {
        prompt.style.display = "none"
        btn.style.display = "none"
      }
      if (engageReq && cooldown <= 0) {
        cooldown = ENGAGE_COOLDOWN
        focused.billboard.setScale(1.42)
        onEngage(focused)
      }
    } else {
      prompt.style.display = "none"
      btn.style.display = "none"
    }
    engageReq = false
  }

  return {
    update,
    getFocused: () => focused,
    setEnabled: (v: boolean) => {
      enabled = v
      if (!v) {
        if (focused) setFocus(null)
        hideAffordances()
        engageReq = false
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
