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
// #116 — focus HYSTERESIS: once an NPC is focused, a competitor must be CLOSER by
// this margin (squared, in world units²) to STEAL focus. Without it, two NPCs at
// nearly equal distance swap focus every frame → the Talk affordance flickers
// between them (the owner's "talk/enter glitch" when a wanderer jams a special).
// ~0.8u of separation in distance² terms; small enough to feel instant, big enough
// to kill the jitter.
const FOCUS_HYSTERESIS = 1.6

/**
 * Decide the focus target with PRIORITY + HYSTERESIS (#116). Pure — takes
 * already-computed squared distances so it is unit-testable without Babylon:
 *  - the objective `priority` (if in range) ALWAYS wins (#58, no hysteresis).
 *  - else, if someone is ALREADY focused and still in range, KEEP them unless a
 *    different `best` is closer by `FOCUS_HYSTERESIS` (kills the per-frame swap).
 *  - else the nearest `best`.
 * All distances are SQUARED world units; `range2 = RANGE*RANGE`.
 */
export function chooseFocus<T>(args: {
  best: T | null
  bestD: number
  priority: T | null
  focused: T | null
  focusedD: number
  range2: number
}): T | null {
  const { best, bestD, priority, focused, focusedD, range2 } = args
  if (priority) return priority
  if (focused && focused !== best && focusedD <= range2 && bestD > focusedD - FOCUS_HYSTERESIS) {
    return focused
  }
  return best
}
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
  /**
   * The active quest OBJECTIVE's anchor id (#58). When the player is in range of
   * the NPC stationed at this anchor, it WINS focus over any closer wandering
   * townsfolk — so the beacon's objective NPC is always the one you Talk to, never
   * an ambient passer-by who happened to drift nearer. Optional → plain nearest.
   */
  getPriorityAnchor?: () => string | null | undefined,
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
    // #58: the active objective NPC (the special stationed at the priority anchor)
    // WINS focus when in range, even if a wandering townsperson is marginally
    // closer — so you always Talk to the quest's NPC under the beacon.
    const priorityAnchor = getPriorityAnchor?.() ?? null
    let priority: FocusTarget | null = null
    let priorityD = RANGE * RANGE
    for (const it of npcs) {
      const dx = it.billboard.root.position.x - player.x
      const dz = it.billboard.root.position.z - player.z
      const d = dx * dx + dz * dz
      if (priorityAnchor && it.anchorId === priorityAnchor && d < priorityD) {
        priorityD = d
        priority = it
      }
      if (d < bestD) {
        bestD = d
        best = it
      }
    }
    // #116 HYSTERESIS: priority (objective) always wins; else keep the current
    // focus unless a rival is decisively closer — so two near-equidistant NPCs don't
    // swap the Talk affordance every frame (the flicker glitch). `chooseFocus` is the
    // pure, unit-tested decision.
    let focusedD = RANGE * RANGE + 1 // out of range by default (so it can't "stick")
    if (focused) {
      const fdx = focused.billboard.root.position.x - player.x
      const fdz = focused.billboard.root.position.z - player.z
      focusedD = fdx * fdx + fdz * fdz
    }
    setFocus(chooseFocus({ best, bestD, priority, focused, focusedD, range2: RANGE * RANGE }))

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
