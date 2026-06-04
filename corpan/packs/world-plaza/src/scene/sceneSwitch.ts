import { Scene as WorldSceneSchema, type Scene as WorldScene } from "@world-plaza/contracts"
import antiguaJson from "../../content/scenes/antigua-grand.json"
import tokyoJson from "../../content/scenes/tokyo-2050.json"

/**
 * sceneSwitch.ts — PROOF of the Room×Scene spine, made interactive.
 *
 * THE THESIS, IN ONE FILE
 * -----------------------
 * A **Room** is an authoritative shared collision/position TOPOLOGY. A **Scene**
 * is a per-player, data-driven SKIN of that room. Two players standing in the
 * SAME topology (`plaza-grand`) — colliding in the SAME geometry — can each see a
 * completely different world. Here we register the two ends of the spectrum:
 *
 *   • `antigua-grand` — warm colonial Antigua, 1770, market-day daylight.
 *   • `tokyo-2050`     — neon Tokyo, 2050, rain-slick night.
 *
 * BOTH carry `topologyId: "plaza-grand"`. They diverge ONLY in data: palette,
 * `sky`, `landmark`, `buildingStyle`, sprite skins, narrative. Flipping the
 * ACTIVE scene re-skins the WORLD (palette → ground/roads, `buildingStyle` →
 * buildings, `sky`/`landmark` → atmosphere/vista) WITHOUT moving a single
 * collider. That is the whole architecture, visible in one keypress.
 *
 * WHAT THIS MODULE OWNS (and what it doesn't)
 * -------------------------------------------
 * It owns the REGISTRY (the two parsed, validated Scenes) and the small state
 * machine that tracks which one is live and asks the host to re-render. It does
 * NOT render anything itself — rendering is the orchestrator's job (it already
 * knows how to dispose the world + atmosphere and rebuild from a Scene). The
 * orchestrator hands us a `rebuild(scene)` callback; we hand back `toggle()` /
 * `set()` and a keyboard hook for a debug control. This keeps the toggle
 * orthogonal to the renderer, exactly like the Look seam.
 */

export type SceneKey = "antigua" | "tokyo"

/** The registry: both ends of the divergence, parsed + validated once. */
export const SCENES: Record<SceneKey, WorldScene> = {
  antigua: WorldSceneSchema.parse(antiguaJson),
  tokyo: WorldSceneSchema.parse(tokyoJson),
}

/** Stable cycle order for `toggle()`. */
const ORDER: SceneKey[] = ["antigua", "tokyo"]

export interface SceneSwitcherOptions {
  /**
   * Which scene is live at boot. Defaults to `antigua` (matches the scene the
   * runtime already loads), so wiring this in changes nothing until you flip.
   */
  initial?: SceneKey
  /**
   * Re-skin the world to `scene`. The orchestrator implements this by disposing
   * the current world/atmosphere and rebuilding from `scene` (same topology).
   * Called once with the initial scene on construction is NOT done — the boot
   * render already happened; this fires only on an actual flip.
   */
  rebuild: (scene: WorldScene, key: SceneKey) => void
  /** Optional: notified after every flip (e.g. to update a debug label). */
  onChange?: (key: SceneKey, scene: WorldScene) => void
}

export interface SceneSwitcher {
  /** the currently-live scene key. */
  readonly active: SceneKey
  /** the currently-live parsed Scene. */
  readonly scene: WorldScene
  /** flip to the next scene in the cycle (antigua ⇄ tokyo). */
  toggle: () => SceneKey
  /** jump to a specific scene (no-op if already active). */
  set: (key: SceneKey) => void
  /**
   * Attach a keyboard debug control to `target` (default: window). Pressing the
   * key (default "p", for "place") flips the scene live. Returns an unbind fn.
   */
  bindKey: (key?: string, target?: { addEventListener: typeof window.addEventListener; removeEventListener: typeof window.removeEventListener }) => () => void
}

/**
 * createSceneSwitcher — wire the two-scene registry to the host's rebuild path.
 *
 * The orchestrator owns HOW a scene becomes pixels; this owns WHICH scene is
 * live and when to re-render. Example wiring lives in the report.
 */
export function createSceneSwitcher(opts: SceneSwitcherOptions): SceneSwitcher {
  let active: SceneKey = opts.initial ?? "antigua"

  const apply = (key: SceneKey) => {
    if (key === active) return
    active = key
    const scene = SCENES[key]
    opts.rebuild(scene, key)
    opts.onChange?.(key, scene)
  }

  const switcher: SceneSwitcher = {
    get active() {
      return active
    },
    get scene() {
      return SCENES[active]
    },
    toggle() {
      const i = ORDER.indexOf(active)
      const next = ORDER[(i + 1) % ORDER.length]
      apply(next)
      return next
    },
    set(key) {
      apply(key)
    },
    bindKey(key = "p", target = window) {
      const handler = (e: KeyboardEvent) => {
        // ignore when typing into an input/textarea/contenteditable.
        const t = e.target as HTMLElement | null
        const tag = t?.tagName
        if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable) return
        if (e.key.toLowerCase() === key.toLowerCase()) {
          e.preventDefault()
          switcher.toggle()
        }
      }
      target.addEventListener("keydown", handler as EventListener)
      return () => target.removeEventListener("keydown", handler as EventListener)
    },
  }

  return switcher
}
