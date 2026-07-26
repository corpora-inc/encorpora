// The mounted stage, and the two calls the rest of the app makes to it.
//
// A module-level handle rather than a context or a prop chain. The input
// handler has to be able to say `settleNow()` on the first line of a keydown,
// before anything else happens, and threading a ref down to it through three
// components is how that line ends up conditional. Both calls are no-ops when
// nothing is mounted, so a test, a screenshot harness, or a route with no
// canvas on it behaves exactly like the app with reactions turned off.
//
// This is also the only file in `src/reactions/` that touches the DOM. The
// stage is told rectangles; finding them is done here, once, at fire time —
// after the verdict has painted, never on the answer path.

import { ANCHOR_APERTURE, ANCHOR_CARTOUCHE, ANCHOR_SEAT } from "../design/anchors.ts"
import { createStage, type Stage } from "./stage.ts"
import type { Anchor, Ink, Rect } from "./surface.ts"
import type { Outcome } from "./tiers.ts"

let stage: Stage | null = null

function boxOf(selector: string, origin: DOMRect): Rect | null {
  const element = document.querySelector(selector)
  if (element === null) return null
  const box = element.getBoundingClientRect()
  if (box.width <= 0 || box.height <= 0) return null
  return { x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height }
}

function anchorFromDom(canvas: HTMLCanvasElement): Anchor {
  const origin = canvas.getBoundingClientRect()
  return {
    seat: boxOf(`.${ANCHOR_SEAT}`, origin),
    cartouche: boxOf(`.${ANCHOR_CARTOUCHE}`, origin),
    aperture: boxOf(`.${ANCHOR_APERTURE}`, origin),
  }
}

/**
 * The palette, read from the semantic tokens rather than named here.
 *
 * `tokens.css` owns the material vocabulary and re-cuts every role under
 * `.dw-dark`; a brass literal baked into this file would be a second theme
 * that never follows, and `tokens.test.ts` fails the build over exactly that.
 * Read on every fire, so a theme change mid-session is picked up with no
 * subscription.
 *
 * An unresolved role degrades to `transparent` rather than to a guess. If the
 * stylesheet has not arrived, the honest outcome is that the canvas — which
 * carries no information — draws nothing.
 */
function inkFromTokens(root: HTMLElement): Ink {
  const style = getComputedStyle(root)
  const role = (name: string): string => style.getPropertyValue(name).trim() || "transparent"
  return {
    index: role("--dw-index"),
    seat: role("--dw-seat"),
    strike: role("--dw-strike"),
    celestial: role("--dw-field-ink"),
    line: role("--dw-line-strong"),
  }
}

/**
 * Attach the stage to a canvas. Returns the detach function.
 *
 * Sizing is the caller's only other responsibility and it happens here: the
 * backing store is device pixels, the drawing is CSS pixels, and the transform
 * that reconciles them is set once per resize rather than per frame.
 */
export function mountStage(canvas: HTMLCanvasElement): () => void {
  const context = canvas.getContext("2d")
  if (context === null) return () => undefined

  const size = (): { width: number; height: number } => {
    const box = canvas.getBoundingClientRect()
    return { width: box.width, height: box.height }
  }

  const resize = (): void => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const { width, height } = size()
    canvas.width = Math.max(1, Math.round(width * ratio))
    canvas.height = Math.max(1, Math.round(height * ratio))
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
  }
  resize()

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)")

  const mounted = createStage({
    ctx: context,
    size,
    now: () => performance.now(),
    schedule: (run) => requestAnimationFrame(run),
    cancel: (handle) => {
      cancelAnimationFrame(handle)
    },
    reducedMotion: () => motion.matches,
    ink: () => inkFromTokens(document.documentElement),
    anchor: () => anchorFromDom(canvas),
  })

  stage = mounted
  window.addEventListener("resize", resize)

  return () => {
    window.removeEventListener("resize", resize)
    mounted.dispose()
    if (stage === mounted) stage = null
  }
}

/** Start a reaction for what just happened. Never awaited, never blocking. */
export function fireReaction(outcome: Outcome): void {
  stage?.fire(outcome)
}

/**
 * Settle whatever is running. The first line of every input handler.
 *
 * Synchronous and unconditional: it is cheaper to call this on a keystroke that
 * turns out to be a no-op than to work out whether the reaction matters, and a
 * conditional here is how a fast child ends up waiting on an animation.
 */
export function settleReactions(): void {
  stage?.settleNow()
}

/** Give the session back its once-a-session reaction budget. */
export function resetReactions(): void {
  stage?.reset()
}
