/**
 * The safe rectangle, in numbers a canvas can use.
 *
 * **Why this exists.** Every game here declares `viewport-fit=cover`, which is
 * not a neutral setting: it opts the document *into* the notch, the home
 * indicator and the rounded corners. A DOM HUD can then claw that back with
 * `padding: env(safe-area-inset-top)` — and the handful of games with DOM HUDs
 * do exactly that. A canvas HUD cannot. `env()` is a CSS value; a canvas knows
 * nothing about it, so `fillText` at `y = 24` lands under the notch on every
 * device that has one.
 *
 * That was true of 20 of the 27 shipped games. They all declared `cover` and
 * none of them read the insets back, so they were drawing into the unsafe
 * region deliberately and then ignoring it.
 *
 * **How it works.** `env()` cannot be read from JavaScript, so this measures it:
 * a zero-size fixed probe whose padding is set to the four `env()` values, read
 * back through `getComputedStyle`. That is the standard trick and it is exact,
 * because the browser resolves `env()` before computing the padding.
 *
 * The probe is `visibility:hidden`, out of flow, `aria-hidden`, and never
 * receives pointer events, so it cannot affect layout, hit-testing or the
 * accessibility tree.
 */

export type Insets = { top: number; right: number; bottom: number; left: number }

/**
 * Insets supplied by the HOST, which are the only trustworthy ones inside a
 * pack.
 *
 * A pack runs in an iframe sandboxed `allow-scripts` with deliberately no
 * `allow-same-origin`. `env(safe-area-inset-*)` is a property of the TOP-LEVEL
 * browsing context, so a cross-origin child resolves all four to 0 — the probe
 * below is correct in a browser tab and useless in the shipped app. Every game
 * that trusted it drew its HUD under the notch believing it was safe.
 *
 * The host measures the real values and sends them on the `settings` channel;
 * `pack.ts` calls this once the host handshake completes. Until then, and in
 * the dev harness where there is no host, the probe is the best available
 * answer and costs nothing.
 */
let hostInsets: Insets | null = null

export function setHostInsets(i: Insets | null | undefined): void {
  hostInsets =
    i && [i.top, i.right, i.bottom, i.left].every((n) => Number.isFinite(n) && n >= 0)
      ? { top: i.top, right: i.right, bottom: i.bottom, left: i.left }
      : null
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 }

const PROBE_ID = "dw-safe-probe"

function probe(): HTMLElement | null {
  if (typeof document === "undefined") return null
  const found = document.getElementById(PROBE_ID)
  if (found) return found
  const el = document.createElement("div")
  el.id = PROBE_ID
  el.setAttribute("aria-hidden", "true")
  el.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
    "padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);" +
    "padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left)"
  document.body.appendChild(el)
  return el
}

const px = (v: string): number => {
  const n = Number.parseFloat(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * The current safe-area insets in CSS pixels.
 *
 * Returns zeros where there is no environment to measure — node, a test, a
 * device without insets — so a caller never has to branch on platform.
 */
export function safeInsets(): Insets {
  // The host's measurement wins whenever there is one: inside the shipped app
  // the probe below can only ever return zeros.
  if (hostInsets) return { ...hostInsets }
  const el = probe()
  if (!el || typeof getComputedStyle !== "function") return { ...NO_INSETS }
  const s = getComputedStyle(el)
  return {
    top: px(s.paddingTop),
    right: px(s.paddingRight),
    bottom: px(s.paddingBottom),
    left: px(s.paddingLeft),
  }
}

/**
 * Watch the insets and call back when they change.
 *
 * They change more often than "never": rotation swaps top/bottom with
 * left/right, and iPadOS changes them when a pack is resized in Split View. A
 * game that reads them once at mount and never again is correct until the first
 * rotation and wrong after it.
 *
 * Returns an unsubscribe. Call it in `unmount` — a listener that outlives the
 * frame keeps the whole closure alive.
 */
export function onInsetsChange(fn: (insets: Insets) => void): () => void {
  if (typeof globalThis.addEventListener !== "function") return () => undefined
  let last = safeInsets()
  const check = (): void => {
    const now = safeInsets()
    if (
      now.top === last.top &&
      now.right === last.right &&
      now.bottom === last.bottom &&
      now.left === last.left
    ) {
      return
    }
    last = now
    fn(now)
  }
  globalThis.addEventListener("resize", check)
  globalThis.addEventListener("orientationchange", check)
  return () => {
    globalThis.removeEventListener("resize", check)
    globalThis.removeEventListener("orientationchange", check)
  }
}

/**
 * The safe rectangle inside a canvas of `w` x `h` CSS pixels.
 *
 * This is the value a canvas HUD actually wants: lay chrome out inside this
 * rect and it clears the notch and the home indicator on every device, and is
 * identical to the full rect on devices with no insets.
 *
 * The playfield does NOT have to obey it — a full-bleed background reaching
 * under the notch is usually what you want, and is why `viewport-fit=cover` is
 * set in the first place. It is the things a child must *read or touch* that
 * belong inside this rect.
 */
export function safeRect(
  w: number,
  h: number,
  insets: Insets = safeInsets(),
): { x: number; y: number; w: number; h: number } {
  const x = Math.min(insets.left, w)
  const y = Math.min(insets.top, h)
  return {
    x,
    y,
    w: Math.max(0, w - x - Math.min(insets.right, w)),
    h: Math.max(0, h - y - Math.min(insets.bottom, h)),
  }
}
