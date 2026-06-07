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
 * How a single registered surface should respond to each state:
 *   - `band` — the top band (Status Capsule + Place Tag). Stays readable while an
 *     NPC is `focused`, but steps BACK a touch (dim @ .7) so the Talk CTA is the
 *     clear hero; fully recedes during dialogue/challenge/menu.
 *   - `pack` — the bottom-left satchel button. Stays reachable while `focused`
 *     (a crowded plaza is almost always "focused"; dimming it to pointer-none made
 *     it permanently dead), fully recedes during a blocking surface.
 *   - `map`  — the bottom-right minimap. Like the band, it stays VISIBLE (dim)
 *     during `focused` (you want to orient while a Talk button shows), but recedes
 *     fully on dialogue/challenge/menu — fixing the "minimap stays fully lit while
 *     everything else recedes" incoherence (FAB_POLISH §7.1).
 */
export type ChromeRole = "band" | "pack" | "map"

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

// The recede rule now DIVERGES by role on `focused` (FAB_POLISH §7.2): the band
// steps back (dim @ .7, still readable + interactive) so the Talk CTA is the hero;
// the pack stays fully reachable; the minimap stays VISIBLE but dim. On any
// blocking surface EVERY role — band, pack AND map — recedes fully, as one breath.
function visibilityFor(role: ChromeRole, state: ChromeState): Visibility {
  switch (state) {
    case "world":
      return "shown"
    case "focused":
      // An NPC is in range (Talk button showing). The band + minimap STEP BACK to
      // `dim` (still readable/interactive — the CSS keeps band dim at .7, map at
      // .4) so the Talk CTA reads as the hero; the pack stays fully reachable
      // (dimming it to pointer-none made it dead — taps fell through to the stick).
      if (role === "pack") return "shown"
      return "dim"
    case "dialogue":
    case "challenge":
    case "menu":
    case "onboarding":
      // A blocking surface owns the screen — ALL chrome recedes fully, together.
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
