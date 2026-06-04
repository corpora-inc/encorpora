/**
 * chromeVisibility — the SINGLE owner of top-of-screen chrome visibility
 * (TOP_HUD §4). One enum drives the whole chrome (the top band — Status Capsule
 * + Place Tag — AND the bottom-right pack button), so no element hides itself ad
 * hoc. This is the discipline that fixes today's pack-button-over-NPC-window
 * overlap bug: instead of z-raising the dialogue over a still-painted satchel, we
 * RECEDE the chrome the moment a blocking surface (dialogue / challenge / menu)
 * opens — the dialogue/challenge becomes the WHOLE surface, exactly as the menu
 * already does.
 *
 * It is fed by the FIVE existing game.ts edges (focus change / dialogue open+close
 * / challenge / menu open+close) — no new event plumbing. The orchestrator routes
 * those edges into `setChromeState(state)` alongside its existing
 * `setWorldActive(active)`; this helper translates a state into opacity/interaction
 * for each registered surface.
 *
 * It mounts NOTHING and owns no DOM of its own — it only toggles classes /
 * attributes on the surfaces the orchestrator registers. Compositor-only fades
 * live in each surface's CSS; reduced-motion is each surface's concern.
 */

const LOG = "[wp/chromeVisibility]"

/**
 * The chrome visibility states (TOP_HUD §4.2). Drives BOTH the top band and the
 * pack button through one setter.
 */
export type ChromeState =
  /** free-roam: full chrome visible (capsule + tag + pack). */
  | "world"
  /** an NPC is focused, Talk button showing — top band stays, pack RECEDES slightly. */
  | "focused"
  /** NPC window open — top band + pack FULLY recede (hidden). */
  | "dialogue"
  /** a centered challenge running — top band + pack FULLY recede. */
  | "challenge"
  /** the pack/menu panel open — chrome recedes (the menu IS the surface). */
  | "menu"
  /** pre-game / track-picker — no chrome at all. */
  | "onboarding"

/**
 * How a single registered surface should respond to each state. A surface is
 * either part of the "top band" (capsule + place tag) or the "pack" (the satchel
 * button), which recede on slightly different rules (the pack dims on `focused`,
 * the band does not).
 */
export type ChromeRole = "band" | "pack"

/** One registered chrome surface: its element + which receding rule it follows. */
export interface ChromeSurface {
  el: HTMLElement
  role: ChromeRole
}

export interface ChromeVisibility {
  /** The single owner: set the chrome state; applies to every registered surface. */
  set(state: ChromeState): void
  /** The current state (for re-deriving on register, edge debugging). */
  current(): ChromeState
  /** Register a surface (idempotent); immediately applies the current state to it. */
  register(surface: ChromeSurface): void
  /** Drop a surface from governance (e.g. on its own dispose). */
  unregister(el: HTMLElement): void
  dispose(): void
}

/**
 * The visibility decision for one surface in one state: a CSS class suffix the
 * surface's own stylesheet styles (`--hidden` → opacity 0 + no pointer; `--dim`
 * → reduced opacity but still interactive; default → fully shown). Encoded as a
 * data-attribute so each surface's scoped CSS keys off it with zero coupling.
 */
type Visibility = "shown" | "dim" | "hidden"

// `role` is currently uniform across states (every surface follows the same
// recede rule); it stays in the signature so a future state can diverge bands
// from the pack/map again without touching call sites.
function visibilityFor(_role: ChromeRole, state: ChromeState): Visibility {
  switch (state) {
    case "world":
      return "shown"
    case "focused":
      // An NPC is in range (Talk button showing). EVERYTHING stays fully shown
      // AND interactive — in a crowded plaza you are almost always "focused", so
      // dimming the pack to `pointer-events:none` here made it permanently dead
      // (taps fell through to the joystick). The Talk CTA reads as the hero on
      // its own (center-bottom); the pack/band/map stay reachable in their corners.
      return "shown"
    case "dialogue":
    case "challenge":
    case "menu":
    case "onboarding":
      // A blocking surface owns the screen — ALL chrome recedes fully.
      return "hidden"
    default:
      return "shown"
  }
}

/**
 * Create the chrome visibility owner. The orchestrator calls `register` for each
 * chrome surface (the capsule root, the place tag root, the pack button) and
 * routes its five existing edges into `set(state)`.
 */
export function createChromeVisibility(initial: ChromeState = "world"): ChromeVisibility {
  let state: ChromeState = initial
  const surfaces = new Set<ChromeSurface>()

  function apply(surface: ChromeSurface): void {
    const vis = visibilityFor(surface.role, state)
    const el = surface.el
    el.setAttribute("data-wp-chrome", vis)
    // Belt-and-suspenders for a11y + input: a fully-hidden surface is removed
    // from the a11y tree AND made non-interactive (the CSS also sets
    // pointer-events:none, but the attributes make it robust if CSS is missing).
    if (vis === "hidden") {
      el.setAttribute("aria-hidden", "true")
    } else {
      el.removeAttribute("aria-hidden")
    }
  }

  const handle: ChromeVisibility = {
    set(next: ChromeState): void {
      if (next === state) return
      state = next
      for (const s of surfaces) apply(s)
    },
    current: () => state,
    register(surface: ChromeSurface): void {
      try {
        surfaces.add(surface)
        apply(surface)
      } catch (err) {
        console.error(`${LOG} register failed:`, err)
      }
    },
    unregister(el: HTMLElement): void {
      for (const s of surfaces) {
        if (s.el === el) {
          surfaces.delete(s)
          break
        }
      }
    },
    dispose(): void {
      surfaces.clear()
    },
  }
  return handle
}
