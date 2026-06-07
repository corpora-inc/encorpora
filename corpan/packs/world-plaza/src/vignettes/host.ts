/**
 * createVignetteHost — the orchestrator the city's portal anchors drive.
 *
 * It owns the lifecycle around a Vignette so each one is a pure scene that only
 * has to build into `ctx.mountRoot` and resolve a result:
 *
 *   host.enter(id, { anchorId }):
 *     1. guard: one vignette at a time (returns null if already active / unknown)
 *     2. pauseWorld()        — halt the sim + free the LLM (orchestrator wiring)
 *     3. chrome.set("menu")  — RECEDE all chrome (the vignette IS the surface);
 *                              remember the prior state to restore on exit
 *     4. create `.wp-vig-root` INSIDE `.wp-overlay` (NEVER body — §4.2), transition IN
 *     5. build the VignetteContext (services + mountRoot + anchorId + reducedMotion)
 *     6. await vignette.enter(ctx)  — the scene runs until the player exits
 *     7. transition OUT (compositor-only, reduced-motion aware), remove the node
 *     8. vignette.dispose(), resumeWorld(), restore chrome
 *     9. resolve the VignetteResult (the city reads `travelTo`/`rewards`/`questStep`)
 *
 * The host mounts its OWN universal Exit affordance + ESC handler into the root,
 * so EVERY vignette can be left even if it forgets to add one. A vignette signals
 * exit by resolving `enter`; the host also exposes an `exit(result)` hook to the
 * vignette via the root (the door / a transit completing call it).
 *
 * No window.confirm/alert (project rule). Touch targets ≥44px (in styles.ts).
 */

import { ensureVignetteStyles } from "./styles"
import type {
  EnterOptions,
  VignetteContext,
  VignetteFactory,
  VignetteHost,
  VignetteHostOptions,
  VignetteResult,
} from "./types"
import { NO_TRAVEL } from "./types"

const LOG = "[wp/vignette]"

/** A vignette signals exit by calling this; the host resolves with the result. */
type ExitFn = (result: VignetteResult) => void

/**
 * The framework hooks the host injects onto the root so a scene can drive the
 * SHARED chrome (the Exit button) — exposed via a non-enumerable symbol-ish
 * property on `mountRoot.dataset`-adjacent storage so a scene never has to thread
 * an extra callback. Scenes that want a custom in-scene exit (the taxi's door)
 * just call `ctx`-captured `exit`; the framework Exit button calls the same.
 */
export interface VignetteRootHooks {
  /** Resolve the vignette with this result (door / Exit button / transit done). */
  exit: ExitFn
  /** Localized "Leave" label for the framework Exit affordance. */
  exitLabel?: string
}

/** A weak side-table so the host's Exit button + ESC can find a root's exit hook. */
const ROOT_HOOKS = new WeakMap<HTMLElement, VignetteRootHooks>()

/**
 * Let a vignette register how the framework Exit button + ESC should leave it
 * (and the localized label). Called by a scene early in `enter`. Optional — if a
 * scene never registers, the framework Exit button resolves `NO_TRAVEL`.
 */
export function registerRootHooks(root: HTMLElement, hooks: VignetteRootHooks): void {
  ROOT_HOOKS.set(root, hooks)
  // Reflect the label onto the already-mounted Exit button if present.
  const btn = root.querySelector<HTMLElement>(".wp-vig-exit__text")
  if (btn && hooks.exitLabel) btn.textContent = hooks.exitLabel
}

/** Read a root's registered hooks — the host's Exit/ESC path, exposed so an
 *  isolated vignette test can fire the same leave the framework button would. */
export function getRootHooks(root: HTMLElement): VignetteRootHooks | undefined {
  return ROOT_HOOKS.get(root)
}

export function createVignetteHost(opts: VignetteHostOptions): VignetteHost {
  ensureVignetteStyles()
  const factories = new Map<string, VignetteFactory>()
  let activeRoot: HTMLElement | null = null
  let activeExit: ExitFn | null = null

  const reducedMotion = (): boolean =>
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches

  function register(id: string, factory: VignetteFactory): void {
    if (factories.has(id)) {
      console.warn(`${LOG} re-registering vignette "${id}" (last wins)`)
    }
    factories.set(id, factory)
  }

  async function enter(
    id: string,
    enterOpts: EnterOptions,
  ): Promise<VignetteResult | null> {
    if (activeRoot) {
      console.warn(`${LOG} enter("${id}") ignored — a vignette is already active.`)
      return null
    }
    const factory = factories.get(id)
    if (!factory) {
      console.error(`${LOG} unknown vignette id "${id}" — no portal target.`)
      return null
    }

    const vignette = factory()
    const reduced = reducedMotion()

    // ── 1. pause world + free LLM (orchestrator wiring) ──────────────────────
    try {
      opts.pauseWorld()
    } catch (err) {
      console.error(`${LOG} pauseWorld threw:`, err)
    }

    // ── 2. recede chrome; remember prior state to restore on exit ────────────
    const priorChrome = opts.chrome.current()
    try {
      // The vignette IS the whole surface — the same full recede the menu uses.
      opts.chrome.set("menu")
    } catch (err) {
      console.error(`${LOG} chrome.set threw:`, err)
    }

    // ── 3. create the fullscreen root INSIDE .wp-overlay (NEVER body) ────────
    const root = document.createElement("div")
    root.className = "wp-vig-root"
    root.setAttribute("role", "dialog")
    root.setAttribute("aria-modal", "true")
    // Pass the scene accent down as a CSS var so a vignette can tint to the world.
    const accent = opts.services.scene.palette?.accent
    if (accent) root.style.setProperty("--vig-accent", accent)
    opts.overlay.appendChild(root)
    activeRoot = root

    // The universal Exit affordance — ALWAYS present so any vignette is leavable.
    const exitBtn = document.createElement("button")
    exitBtn.className = "wp-vig-exit"
    exitBtn.type = "button"
    exitBtn.setAttribute("aria-label", "Leave")
    const exitGlyph = document.createElement("span")
    exitGlyph.className = "wp-vig-exit__glyph"
    exitGlyph.textContent = "‹" // a back-chevron, not an emoji
    const exitText = document.createElement("span")
    exitText.className = "wp-vig-exit__text"
    exitText.textContent = "Leave"
    exitBtn.append(exitGlyph, exitText)
    root.appendChild(exitBtn)

    // The single exit resolver — guarded so door/ESC/Exit can race harmlessly.
    let settled = false
    let resolveEnter!: (r: VignetteResult) => void
    const done = new Promise<VignetteResult>((res) => {
      resolveEnter = res
    })
    const exit: ExitFn = (result) => {
      if (settled) return
      settled = true
      resolveEnter(result ?? NO_TRAVEL)
    }
    activeExit = exit

    // Framework Exit / ESC route through the scene's registered hook (so a transit
    // can run its own dismiss/animation) or fall back to a plain in-place exit.
    const exitViaHook = () => {
      const hook = ROOT_HOOKS.get(root)
      if (hook) hook.exit(NO_TRAVEL)
      else exit(NO_TRAVEL)
    }
    exitBtn.addEventListener("click", exitViaHook)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        exitViaHook()
      }
    }
    root.addEventListener("keydown", onKey)

    // ── 4. transition IN (compositor-only) ───────────────────────────────────
    // Force a frame so the entrance transition runs (no layout shift — absolute).
    requestAnimationFrame(() => root.classList.add("wp-vig-root--in"))

    // ── 5. build the context the scene runs against ──────────────────────────
    const ctx: VignetteContext = {
      mountRoot: root,
      anchorId: enterOpts.anchorId,
      reducedMotion: reduced,
      learnerPair: opts.services.learnerPair,
      scene: opts.services.scene,
      speak: opts.services.speak,
      openNpc: opts.services.openNpc,
      wallet: opts.services.wallet,
      grant: opts.services.grant,
      runChallenge: opts.services.runChallenge,
      t: opts.services.t,
      iconRenderer: opts.services.iconRenderer,
    }

    // ── 6. run the scene until it resolves (its own exit, or the framework's) ─
    let result: VignetteResult = NO_TRAVEL
    try {
      // The scene resolves `enter` when ITS logic completes (e.g. it never exits
      // on its own and relies on the door/Exit). We race the scene's promise with
      // the framework exit so EITHER path resolves the lifecycle exactly once.
      result = await Promise.race([
        vignette.enter(ctx).then((r) => {
          // The scene resolved on its own → settle the framework exit too.
          exit(r ?? NO_TRAVEL)
          return r ?? NO_TRAVEL
        }),
        done,
      ])
    } catch (err) {
      console.error(`${LOG} vignette "${id}" threw during enter:`, err)
      result = NO_TRAVEL
    }

    // ── 7. transition OUT, then remove the node ──────────────────────────────
    root.removeEventListener("keydown", onKey)
    exitBtn.removeEventListener("click", exitViaHook)
    await transitionOut(root, reduced)
    ROOT_HOOKS.delete(root)
    root.remove()
    activeRoot = null
    activeExit = null

    // ── 8. dispose scene, resume world, restore chrome ───────────────────────
    try {
      vignette.dispose()
    } catch (err) {
      console.error(`${LOG} vignette "${id}" dispose threw:`, err)
    }
    try {
      opts.resumeWorld()
    } catch (err) {
      console.error(`${LOG} resumeWorld threw:`, err)
    }
    try {
      // Restore the chrome the city was in before we receded it. The city will
      // re-derive its own state on the next frame anyway, but restoring here keeps
      // the transition clean and avoids a flash of the wrong chrome.
      opts.chrome.set(priorChrome)
    } catch (err) {
      console.error(`${LOG} chrome restore threw:`, err)
    }

    // ── 9. resolve the result (the city reads travelTo/rewards/questStep) ─────
    return result
  }

  function transitionOut(root: HTMLElement, reduced: boolean): Promise<void> {
    return new Promise((resolve) => {
      root.classList.remove("wp-vig-root--in")
      root.classList.add("wp-vig-root--out")
      const ms = reduced ? 200 : 340
      window.setTimeout(resolve, ms)
    })
  }

  return {
    register,
    has: (id) => factories.has(id),
    enter,
    isActive: () => activeRoot !== null,
    dispose() {
      // Force-exit any running vignette (app background / pack teardown).
      if (activeExit) activeExit(NO_TRAVEL)
    },
  }
}
